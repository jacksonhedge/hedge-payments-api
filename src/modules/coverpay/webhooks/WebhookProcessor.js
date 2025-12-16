/**
 * WebhookProcessor
 *
 * Centralized webhook processing for all BNPL providers.
 * Handles signature verification, event parsing, and orchestration updates.
 */
const { verifySignature } = require('./signatures');
const logger = require('../../../utils/logger');

// Provider-specific event mappings
const EVENT_MAPPINGS = {
  klarna: {
    approved: ['checkout_complete', 'order_created', 'payment_captured'],
    declined: ['checkout_cancelled', 'payment_failed', 'fraud_rejected'],
    cancelled: ['checkout_expired', 'order_cancelled'],
    pending: ['checkout_pending', 'risk_check_pending']
  },
  affirm: {
    approved: ['checkout.completed', 'charge.authorized', 'charge.captured'],
    declined: ['checkout.failed', 'charge.voided'],
    cancelled: ['checkout.canceled'],
    pending: ['checkout.created']
  },
  afterpay: {
    approved: ['order.approved', 'payment.captured'],
    declined: ['order.declined', 'payment.failed'],
    cancelled: ['order.cancelled', 'order.expired'],
    pending: ['order.created']
  },
  sezzle: {
    approved: ['order.complete', 'capture.succeeded'],
    declined: ['order.failed', 'order.declined'],
    cancelled: ['order.cancelled', 'order.expired'],
    pending: ['order.created']
  },
  zip: {
    approved: ['charge.succeeded', 'checkout.completed'],
    declined: ['charge.failed', 'checkout.declined'],
    cancelled: ['checkout.cancelled', 'checkout.expired'],
    pending: ['checkout.created']
  },
  paypal: {
    approved: ['CHECKOUT.ORDER.APPROVED', 'PAYMENT.CAPTURE.COMPLETED'],
    declined: ['CHECKOUT.ORDER.DECLINED', 'PAYMENT.CAPTURE.DENIED'],
    cancelled: ['CHECKOUT.ORDER.CANCELLED'],
    pending: ['CHECKOUT.ORDER.CREATED']
  },
  stripe_bnpl: {
    approved: ['payment_intent.succeeded', 'checkout.session.completed'],
    declined: ['payment_intent.payment_failed'],
    cancelled: ['checkout.session.expired'],
    pending: ['payment_intent.created', 'checkout.session.async_payment_pending']
  }
};

class WebhookProcessor {
  constructor(options = {}) {
    this.verifySignatures = options.verifySignatures !== false;
    this.webhookRepository = options.webhookRepository;
    this.orchestrationService = options.orchestrationService;
  }

  /**
   * Process incoming webhook
   * @param {string} provider - Provider name
   * @param {object} payload - Webhook payload
   * @param {object} headers - Request headers
   * @returns {Promise<object>} Processing result
   */
  async process(provider, payload, headers) {
    const startTime = Date.now();
    let webhookEvent = null;

    try {
      // 1. Verify signature
      if (this.verifySignatures) {
        const isValid = verifySignature(provider, payload, headers);
        if (!isValid) {
          logger.warn('Webhook signature verification failed', { provider });
          throw new WebhookError('Invalid webhook signature', 'INVALID_SIGNATURE');
        }
      }

      // 2. Parse event
      const parsedEvent = this.parseEvent(provider, payload);
      logger.info('Webhook received', {
        provider,
        event: parsedEvent.eventType,
        status: parsedEvent.status,
        sessionId: parsedEvent.providerSessionId
      });

      // 3. Log webhook event
      if (this.webhookRepository) {
        webhookEvent = await this.webhookRepository.create({
          provider,
          eventType: parsedEvent.eventType,
          providerSessionId: parsedEvent.providerSessionId,
          status: parsedEvent.status,
          payload,
          headers: this._sanitizeHeaders(headers)
        });
      }

      // 4. Process based on status
      let result = { processed: true };

      if (this.orchestrationService && parsedEvent.providerSessionId) {
        result = await this.orchestrationService.processProviderWebhook(
          provider,
          parsedEvent.providerSessionId,
          parsedEvent.status,
          payload
        );
      }

      // 5. Update webhook event status
      if (webhookEvent && this.webhookRepository) {
        await this.webhookRepository.update(webhookEvent.id, {
          processedAt: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime,
          result: result ? 'success' : 'no_action'
        });
      }

      return {
        success: true,
        processed: true,
        status: parsedEvent.status,
        sessionId: result?.id || null
      };

    } catch (error) {
      // Log error but don't throw (webhook endpoints should return 200)
      logger.error('Webhook processing error', {
        provider,
        error: error.message,
        code: error.code
      });

      if (webhookEvent && this.webhookRepository) {
        await this.webhookRepository.update(webhookEvent.id, {
          processedAt: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime,
          result: 'error',
          errorMessage: error.message
        });
      }

      return {
        success: false,
        processed: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Parse webhook event to extract status and session ID
   * @param {string} provider - Provider name
   * @param {object} payload - Webhook payload
   * @returns {object} Parsed event data
   */
  parseEvent(provider, payload) {
    const eventType = this._extractEventType(provider, payload);
    const status = this._mapEventToStatus(provider, eventType, payload);
    const providerSessionId = this._extractSessionId(provider, payload);
    const amount = this._extractAmount(provider, payload);

    return {
      provider,
      eventType,
      status,
      providerSessionId,
      amount,
      timestamp: new Date().toISOString(),
      raw: payload
    };
  }

  /**
   * Extract event type from payload
   */
  _extractEventType(provider, payload) {
    const extractors = {
      klarna: () => payload.event_type || payload.event,
      affirm: () => payload.event || payload.type,
      afterpay: () => payload.event || payload.eventType,
      sezzle: () => payload.event || payload.type,
      zip: () => payload.type || payload.event,
      paypal: () => payload.event_type || payload.resource_type,
      stripe_bnpl: () => payload.type
    };

    const extractor = extractors[provider];
    return extractor ? extractor() : payload.event || payload.type || 'unknown';
  }

  /**
   * Map event type to standard status
   */
  _mapEventToStatus(provider, eventType, payload) {
    const mappings = EVENT_MAPPINGS[provider];
    if (!mappings) return 'unknown';

    const eventLower = (eventType || '').toLowerCase();

    // Check each status category
    for (const [status, events] of Object.entries(mappings)) {
      for (const event of events) {
        if (eventLower.includes(event.toLowerCase())) {
          return status;
        }
      }
    }

    // Fallback: check payload status field
    const payloadStatus = (payload.status || payload.state || '').toLowerCase();
    if (payloadStatus.includes('approv') || payloadStatus.includes('complet') || payloadStatus.includes('succeed')) {
      return 'approved';
    }
    if (payloadStatus.includes('declin') || payloadStatus.includes('fail') || payloadStatus.includes('reject')) {
      return 'declined';
    }
    if (payloadStatus.includes('cancel') || payloadStatus.includes('expire')) {
      return 'cancelled';
    }

    return 'pending';
  }

  /**
   * Extract provider session ID from payload
   */
  _extractSessionId(provider, payload) {
    const extractors = {
      klarna: () => payload.session_id || payload.order_id || payload.checkout?.session_id,
      affirm: () => payload.checkout_token || payload.transaction_id || payload.checkout?.id || payload.data?.id,
      afterpay: () => payload.orderToken || payload.token || payload.id || payload.order?.id,
      sezzle: () => payload.uuid || payload.order_uuid || payload.order?.uuid,
      zip: () => payload.checkoutId || payload.checkout_id || payload.id,
      paypal: () => payload.resource?.id || payload.order_id || payload.id,
      stripe_bnpl: () => payload.data?.object?.id || payload.id || payload.data?.object?.payment_intent
    };

    const extractor = extractors[provider];
    return extractor ? extractor() : null;
  }

  /**
   * Extract amount from payload (in cents)
   */
  _extractAmount(provider, payload) {
    const extractors = {
      klarna: () => payload.order_amount || payload.amount,
      affirm: () => payload.amount || payload.details?.total,
      afterpay: () => {
        const amount = payload.orderDetail?.orderAmount || payload.amount;
        return amount?.amount ? Math.round(parseFloat(amount.amount) * 100) : amount;
      },
      sezzle: () => {
        const amount = payload.order?.amount_in_cents || payload.amount_in_cents;
        return amount;
      },
      zip: () => payload.amount || payload.checkout?.amount,
      paypal: () => {
        const amount = payload.resource?.amount?.value || payload.amount?.total;
        return amount ? Math.round(parseFloat(amount) * 100) : null;
      },
      stripe_bnpl: () => payload.data?.object?.amount || payload.amount
    };

    const extractor = extractors[provider];
    return extractor ? extractor() : null;
  }

  /**
   * Sanitize headers for storage (remove sensitive data)
   */
  _sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

/**
 * Custom error class for webhook processing
 */
class WebhookError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'WebhookError';
    this.code = code;
  }
}

module.exports = {
  WebhookProcessor,
  WebhookError,
  EVENT_MAPPINGS
};
