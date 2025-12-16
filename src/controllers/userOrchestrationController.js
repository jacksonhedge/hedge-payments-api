/**
 * User Orchestration Controller (B2B API)
 *
 * Handles API endpoints for CoverPay user orchestration:
 * - Pre-qualification (check BNPL eligibility)
 * - Orchestration sessions (fractured checkout flows)
 * - Status polling
 * - Provider advancement
 *
 * All endpoints receive merchant context from authenticateMerchant middleware.
 * Merchant ID is passed to all service methods for data isolation.
 */
const { createCoverPayFromEnv } = require('../modules/coverpay');
const { OrchestrationService, PrequalificationService } = require('../modules/coverpay/orchestration');
const { WebhookProcessor } = require('../modules/coverpay/webhooks');
const logger = require('../utils/logger');

// Lazy-loaded service instances
let orchestrationService = null;
let prequalService = null;
let webhookProcessor = null;

function getOrchestrationService() {
  if (!orchestrationService) {
    const coverpay = createCoverPayFromEnv();
    orchestrationService = new OrchestrationService(coverpay.providers, {
      enableLogging: true
    });
  }
  return orchestrationService;
}

function getPrequalService() {
  if (!prequalService) {
    const coverpay = createCoverPayFromEnv();
    prequalService = new PrequalificationService(coverpay.providers);
  }
  return prequalService;
}

function getWebhookProcessor() {
  if (!webhookProcessor) {
    webhookProcessor = new WebhookProcessor({
      verifySignatures: process.env.NODE_ENV === 'production',
      orchestrationService: getOrchestrationService()
    });
  }
  return webhookProcessor;
}

/**
 * Pre-qualify user for BNPL
 * Returns total BNPL capacity across all providers
 */
exports.prequalify = async (req, res, next) => {
  try {
    const { customer, amount, forceRefresh } = req.body;
    const merchantId = req.merchant.id;

    logger.info('Processing prequalification request', {
      merchantId,
      merchantSlug: req.merchant.slug,
      email: customer.email,
      amount,
      forceRefresh
    });

    const service = getPrequalService();
    const result = await service.checkEligibility({
      merchantId,
      customer,
      amount,
      forceRefresh
    });

    res.status(200).json({
      success: true,
      data: {
        totalBnplCapacity: result.totalBnplCapacity,
        eligibleProviders: result.eligibleProviders,
        ineligibleProviders: result.ineligibleProviders,
        expiresAt: result.expiresAt,
        cacheHit: result.cacheHit
      }
    });

  } catch (error) {
    logger.error('Prequalification error', { error: error.message, merchantId: req.merchant?.id });
    next(error);
  }
};

/**
 * Get cached prequalification for customer
 */
exports.getCachedPrequalification = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const merchantId = req.merchant.id;

    const service = getPrequalService();
    const cached = await service.getCachedEligibility({
      merchantId,
      customerId
    });

    if (!cached) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'No cached prequalification found'
      });
    }

    res.status(200).json({
      success: true,
      data: cached
    });

  } catch (error) {
    logger.error('Get cached prequalification error', { error: error.message, merchantId: req.merchant?.id });
    next(error);
  }
};

/**
 * Start orchestration session
 * Creates provider sessions and returns first redirect URL
 */
exports.startOrchestration = async (req, res, next) => {
  try {
    const {
      amount,
      customer,
      merchant: merchantData,
      strategy,
      deviceId,
      apnsToken,
      fcmToken,
      returnScheme,
      fracturedOptions
    } = req.body;

    const merchantId = req.merchant.id;

    logger.info('Starting orchestration', {
      merchantId,
      merchantSlug: req.merchant.slug,
      amount,
      strategy,
      email: customer.email
    });

    const service = getOrchestrationService();
    const session = await service.startOrchestration({
      merchantId,
      amount,
      customer,
      merchantData,
      strategy: strategy || 'fractured',
      deviceId,
      apnsToken,
      fcmToken,
      returnScheme,
      fracturedOptions
    });

    logger.info('Orchestration started', {
      sessionId: session.id,
      merchantId,
      providers: session.providerSessions?.length
    });

    res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        transactionId: session.externalId || session.transactionId,
        status: session.status,
        totalAmount: session.totalAmount,
        providerSessions: session.providerSessions?.map(ps => ({
          id: ps.id,
          provider: ps.provider,
          amount: ps.amount,
          sequenceOrder: ps.sequenceOrder,
          status: ps.status,
          redirectUrl: ps.redirectUrl
        })),
        currentProvider: session.currentProvider ? {
          provider: session.currentProvider.provider,
          amount: session.currentProvider.amount,
          redirectUrl: session.currentProvider.redirectUrl
        } : null,
        totalProviders: session.totalProviders,
        expiresAt: session.expiresAt,
        nextAction: session.nextAction
      }
    });

  } catch (error) {
    logger.error('Start orchestration error', { error: error.message, merchantId: req.merchant?.id });
    next(error);
  }
};

/**
 * Get orchestration session status (polling endpoint)
 */
exports.getSessionStatus = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const merchantId = req.merchant.id;

    const service = getOrchestrationService();
    const session = await service.getSessionStatus(sessionId, merchantId);

    res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        transactionId: session.externalId || session.transactionId,
        status: session.status,
        totalAmount: session.totalAmount,
        approvedAmount: session.approvedAmount,
        remainingAmount: session.remainingAmount,
        completedProviders: session.completedProviders,
        totalProviders: session.totalProviders,
        progress: session.progress,
        coverage: session.coverage,
        providerSessions: session.providerSessions?.map(ps => ({
          id: ps.id,
          provider: ps.provider,
          amount: ps.amount,
          sequenceOrder: ps.sequenceOrder,
          status: ps.status,
          redirectUrl: ps.redirectUrl,
          errorMessage: ps.errorMessage
        })),
        currentProvider: session.currentProvider ? {
          id: session.currentProvider.id,
          provider: session.currentProvider.provider,
          amount: session.currentProvider.amount,
          status: session.currentProvider.status,
          redirectUrl: session.currentProvider.redirectUrl
        } : null,
        expiresAt: session.expiresAt,
        nextAction: session.nextAction,
        stats: session.stats
      }
    });

  } catch (error) {
    if (error.message === 'Orchestration session not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Orchestration session not found'
      });
    }
    logger.error('Get session status error', { error: error.message, merchantId: req.merchant?.id });
    next(error);
  }
};

/**
 * Advance to next provider
 */
exports.advanceToNextProvider = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const merchantId = req.merchant.id;

    logger.info('Advancing to next provider', { sessionId, merchantId });

    const service = getOrchestrationService();
    const session = await service.advanceToNextProvider(sessionId, merchantId);

    res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        currentProvider: session.currentProvider ? {
          id: session.currentProvider.id,
          provider: session.currentProvider.provider,
          amount: session.currentProvider.amount,
          redirectUrl: session.currentProvider.redirectUrl
        } : null,
        nextAction: session.nextAction
      }
    });

  } catch (error) {
    logger.error('Advance provider error', { error: error.message, merchantId: req.merchant?.id });
    next(error);
  }
};

/**
 * Mark provider as returned (user came back from redirect)
 */
exports.markProviderReturned = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { providerSessionId } = req.body;
    const merchantId = req.merchant.id;

    logger.info('Provider returned', { sessionId, providerSessionId, merchantId });

    const service = getOrchestrationService();
    const session = await service.markProviderReturned(sessionId, providerSessionId, merchantId);

    res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        nextAction: session.nextAction
      }
    });

  } catch (error) {
    logger.error('Mark provider returned error', { error: error.message, merchantId: req.merchant?.id });
    next(error);
  }
};

/**
 * Skip current provider
 */
exports.skipProvider = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { providerSessionId } = req.body;
    const merchantId = req.merchant.id;

    logger.info('Skipping provider', { sessionId, providerSessionId, merchantId });

    const service = getOrchestrationService();
    const session = await service.skipProvider(sessionId, providerSessionId, merchantId);

    res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        currentProvider: session.currentProvider ? {
          provider: session.currentProvider.provider,
          amount: session.currentProvider.amount,
          redirectUrl: session.currentProvider.redirectUrl
        } : null,
        nextAction: session.nextAction
      }
    });

  } catch (error) {
    logger.error('Skip provider error', { error: error.message, merchantId: req.merchant?.id });
    next(error);
  }
};

/**
 * Cancel orchestration session
 */
exports.cancelOrchestration = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const merchantId = req.merchant.id;

    logger.info('Cancelling orchestration', { sessionId, merchantId });

    const service = getOrchestrationService();
    const session = await service.cancelSession(sessionId, merchantId);

    res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        approvedAmount: session.approvedAmount,
        message: 'Orchestration cancelled'
      }
    });

  } catch (error) {
    logger.error('Cancel orchestration error', { error: error.message, merchantId: req.merchant?.id });
    next(error);
  }
};

/**
 * Handle provider webhook
 * Webhooks are public - signature verification happens in processor
 * Note: Merchant context is extracted from the webhook payload, not auth header
 */
exports.handleProviderWebhook = async (req, res, next) => {
  try {
    const { provider } = req.params;
    const payload = req.body;
    const headers = req.headers;

    logger.info('Received provider webhook', {
      provider,
      event: payload.event || payload.event_type || payload.type
    });

    const processor = getWebhookProcessor();
    const result = await processor.process(provider, payload, headers);

    // Always return 200 to prevent provider retries
    res.status(200).json({
      received: true,
      processed: result.processed,
      sessionId: result.sessionId
    });

  } catch (error) {
    logger.error('Provider webhook error', { error: error.message });
    // Return 200 to prevent retries
    res.status(200).json({
      received: true,
      processed: false,
      error: error.message
    });
  }
};
