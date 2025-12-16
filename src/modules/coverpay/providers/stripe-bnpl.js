/**
 * Stripe Unified BNPL Provider
 *
 * Uses Stripe's Payment Intents API to access multiple BNPL providers:
 * - Affirm
 * - Klarna
 * - Afterpay/Clearpay
 *
 * This acts as a FALLBACK in the CoverPay waterfall after direct providers
 * are exhausted. Stripe may have different approval criteria than direct integrations.
 *
 * API Documentation: https://stripe.com/docs/payments/buy-now-pay-later
 */
const BNPLProvider = require('./base');
const { httpRequest, bearerAuth } = require('../utils');

// Stripe API endpoint
const STRIPE_API_URL = 'https://api.stripe.com/v1';

// BNPL methods available through Stripe
const STRIPE_BNPL_METHODS = ['affirm', 'klarna', 'afterpay_clearpay'];

class StripeBNPLProvider extends BNPLProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'stripe_bnpl';

    // API Credentials
    this.secretKey = config.secretKey || process.env.STRIPE_SECRET_KEY;
    this.publishableKey = config.publishableKey || process.env.STRIPE_PUBLISHABLE_KEY;

    // Mock mode for testing without credentials
    this.mockMode = config.mockMode ?? !this.secretKey;
    this.approvalThreshold = config.approvalThreshold || 200000; // Mock: approves under $2000

    // Which BNPL methods to try (in order)
    this.enabledMethods = config.enabledMethods || STRIPE_BNPL_METHODS;

    // Amount limits (combined across providers)
    this.minAmount = 3500;   // $35 (Affirm/Afterpay minimum)
    this.maxAmount = 3000000; // $30,000 (Affirm max)
  }

  /**
   * Create a Stripe PaymentIntent with BNPL payment method
   * Tries each enabled BNPL method until one works
   */
  async createSession(amount, customer, merchant) {
    if (this.mockMode) {
      return this._mockCreateSession(amount, customer, merchant);
    }

    // Try each BNPL method in order
    let lastError = null;

    for (const method of this.enabledMethods) {
      try {
        console.log(`[Stripe BNPL] Trying ${method} for $${amount / 100}...`);

        const result = await this._createPaymentIntent(amount, customer, merchant, method);

        console.log(`[Stripe BNPL] ✅ ${method} session created`);
        return {
          ...result,
          bnplMethod: method
        };

      } catch (error) {
        console.log(`[Stripe BNPL] ❌ ${method} failed: ${error.message}`);
        lastError = error;
        continue;
      }
    }

    // All methods failed
    const finalError = new Error(lastError?.message || 'All Stripe BNPL methods failed');
    finalError.provider = 'stripe_bnpl';
    throw finalError;
  }

  /**
   * Create PaymentIntent for specific BNPL method
   */
  async _createPaymentIntent(amount, customer, merchant, bnplMethod) {
    // Build form-encoded body (Stripe uses form encoding, not JSON)
    const params = new URLSearchParams();
    params.append('amount', amount.toString());
    params.append('currency', (merchant.currency || 'usd').toLowerCase());
    params.append('payment_method_types[]', bnplMethod);

    // Return URL is required for BNPL
    if (merchant.returnUrl) {
      params.append('return_url', merchant.returnUrl);
    }

    // Add customer email if provided (helps with approval)
    if (customer.email) {
      params.append('receipt_email', customer.email);
    }

    // Add metadata
    params.append('metadata[source]', 'coverpay');
    params.append('metadata[bnpl_method]', bnplMethod);
    if (merchant.orderId) {
      params.append('metadata[order_id]', merchant.orderId);
    }

    // Description
    params.append('description', merchant.itemDescription || 'CoverPay Purchase');

    // Shipping address (required for some BNPL methods)
    if (customer.shippingAddress) {
      params.append('shipping[name]', customer.name || 'Customer');
      params.append('shipping[address][line1]', customer.shippingAddress.street || '123 Main St');
      params.append('shipping[address][city]', customer.shippingAddress.city || 'New York');
      params.append('shipping[address][state]', customer.shippingAddress.state || 'NY');
      params.append('shipping[address][postal_code]', customer.shippingAddress.postalCode || '10001');
      params.append('shipping[address][country]', customer.shippingAddress.country || 'US');
    }

    try {
      const response = await httpRequest(
        `${STRIPE_API_URL}/payment_intents`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${this.secretKey}`
          },
          body: params.toString()
        },
        { timeout: 15000 }
      );

      // Build checkout URL
      const checkoutUrl = this._buildCheckoutUrl(response, bnplMethod, merchant);

      return {
        sessionId: response.id,
        paymentIntentId: response.id,
        clientSecret: response.client_secret,
        redirectUrl: checkoutUrl,
        status: response.status,
        bnplMethod: bnplMethod,
        publishableKey: this.publishableKey
      };

    } catch (error) {
      const stripeError = new Error(this._mapStripeError(error, bnplMethod));
      stripeError.provider = 'stripe_bnpl';
      stripeError.method = bnplMethod;
      stripeError.code = error.code;
      stripeError.originalError = error;
      throw stripeError;
    }
  }

  /**
   * Build checkout redirect URL
   * For Stripe BNPL, you typically use Stripe.js or redirect to Stripe Checkout
   */
  _buildCheckoutUrl(paymentIntent, bnplMethod, merchant) {
    // If merchant has a checkout page that uses Stripe.js
    if (merchant.checkoutUrl) {
      const url = new URL(merchant.checkoutUrl);
      url.searchParams.set('payment_intent', paymentIntent.id);
      url.searchParams.set('client_secret', paymentIntent.client_secret);
      url.searchParams.set('method', bnplMethod);
      return url.toString();
    }

    // Default: return a URL that can be used with Stripe.js
    // The frontend will need to use this with stripe.confirmPayment()
    return `stripe://payment_intent/${paymentIntent.id}?client_secret=${paymentIntent.client_secret}&method=${bnplMethod}`;
  }

  /**
   * Check PaymentIntent status
   */
  async checkStatus(paymentIntentId) {
    if (this.mockMode) {
      return { approved: true, declined: false, pending: false };
    }

    try {
      const response = await httpRequest(
        `${STRIPE_API_URL}/payment_intents/${paymentIntentId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.secretKey}`
          }
        }
      );

      const statusMap = {
        'succeeded': { approved: true, declined: false, pending: false },
        'processing': { approved: false, declined: false, pending: true },
        'requires_payment_method': { approved: false, declined: true, pending: false },
        'requires_confirmation': { approved: false, declined: false, pending: true },
        'requires_action': { approved: false, declined: false, pending: true },
        'canceled': { approved: false, declined: true, pending: false },
        'requires_capture': { approved: true, declined: false, pending: false }
      };

      return {
        ...statusMap[response.status] || { approved: false, declined: false, pending: true },
        status: response.status,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to check Stripe PaymentIntent status: ${error.message}`);
    }
  }

  /**
   * Cancel a PaymentIntent
   */
  async cancelSession(paymentIntentId) {
    if (this.mockMode) {
      return true;
    }

    try {
      await httpRequest(
        `${STRIPE_API_URL}/payment_intents/${paymentIntentId}/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.secretKey}`
          }
        }
      );
      return true;
    } catch (error) {
      console.error(`[Stripe BNPL] Failed to cancel PaymentIntent: ${error.message}`);
      return false;
    }
  }

  /**
   * Capture a PaymentIntent (for manual capture mode)
   */
  async capturePayment(paymentIntentId, amount) {
    if (this.mockMode) {
      return { success: true, status: 'succeeded' };
    }

    const params = new URLSearchParams();
    if (amount) {
      params.append('amount_to_capture', amount.toString());
    }

    try {
      const response = await httpRequest(
        `${STRIPE_API_URL}/payment_intents/${paymentIntentId}/capture`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${this.secretKey}`
          },
          body: params.toString()
        }
      );

      return {
        success: response.status === 'succeeded',
        status: response.status,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to capture Stripe PaymentIntent: ${error.message}`);
    }
  }

  /**
   * Refund a PaymentIntent
   */
  async refundPayment(paymentIntentId, amount, reason) {
    if (this.mockMode) {
      return { success: true, refundId: `re_mock_${Date.now()}` };
    }

    const params = new URLSearchParams();
    params.append('payment_intent', paymentIntentId);
    if (amount) {
      params.append('amount', amount.toString());
    }
    if (reason) {
      params.append('reason', reason);
    }

    try {
      const response = await httpRequest(
        `${STRIPE_API_URL}/refunds`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${this.secretKey}`
          },
          body: params.toString()
        }
      );

      return {
        success: response.status === 'succeeded',
        refundId: response.id,
        status: response.status,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to refund Stripe PaymentIntent: ${error.message}`);
    }
  }

  /**
   * Mock implementation for testing
   */
  async _mockCreateSession(amount, customer, merchant) {
    await new Promise(resolve => setTimeout(resolve, 120));

    if (amount > this.approvalThreshold) {
      throw new Error('Amount exceeds Stripe BNPL approval threshold');
    }

    // Pick a random method for mock
    const method = this.enabledMethods[0] || 'affirm';

    return {
      sessionId: `pi_mock_${Date.now()}`,
      paymentIntentId: `pi_mock_${Date.now()}`,
      clientSecret: `pi_mock_${Date.now()}_secret_mock`,
      redirectUrl: `https://checkout.stripe.com/mock/${Date.now()}`,
      status: 'requires_action',
      bnplMethod: method,
      publishableKey: 'pk_test_mock'
    };
  }

  /**
   * Map Stripe error codes to user-friendly messages
   */
  _mapStripeError(error, method) {
    const methodName = {
      'affirm': 'Affirm',
      'klarna': 'Klarna',
      'afterpay_clearpay': 'Afterpay'
    }[method] || method;

    // Check for Stripe-specific error structure
    if (error.data?.error?.message) {
      return error.data.error.message;
    }

    const errorMap = {
      'card_declined': `${methodName} declined this transaction`,
      'invalid_request_error': 'Invalid request to Stripe',
      'authentication_required': 'Additional authentication required',
      'amount_too_small': `Amount below ${methodName} minimum`,
      'amount_too_large': `Amount exceeds ${methodName} maximum`,
      'country_not_supported': `${methodName} not available in this country`,
      'currency_not_supported': `${methodName} doesn't support this currency`
    };

    return errorMap[error.code] || error.message || `${methodName} request failed`;
  }

  /**
   * Get available BNPL methods for an amount
   */
  getAvailableMethods(amount) {
    const available = [];

    // Affirm: $50 - $30,000
    if (amount >= 5000 && amount <= 3000000) {
      available.push('affirm');
    }

    // Klarna: $10 - $10,000
    if (amount >= 1000 && amount <= 1000000) {
      available.push('klarna');
    }

    // Afterpay: $35 - $2,000
    if (amount >= 3500 && amount <= 200000) {
      available.push('afterpay_clearpay');
    }

    return available.filter(m => this.enabledMethods.includes(m));
  }
}

module.exports = StripeBNPLProvider;
