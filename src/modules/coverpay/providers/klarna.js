/**
 * Klarna BNPL Provider
 *
 * API Documentation: https://docs.klarna.com/api/payments/
 *
 * Klarna uses HTTP Basic Auth with username (API key) and password (API secret).
 * Sessions are created via POST /payments/v1/sessions
 * Sessions expire after 48 hours.
 */
const BNPLProvider = require('./base');
const { httpRequest, basicAuth } = require('../utils');

// Klarna API endpoints by region
const KLARNA_ENDPOINTS = {
  US: {
    sandbox: 'https://api-na.playground.klarna.com',
    production: 'https://api-na.klarna.com'
  },
  EU: {
    sandbox: 'https://api.playground.klarna.com',
    production: 'https://api.klarna.com'
  },
  OC: {
    sandbox: 'https://api-oc.playground.klarna.com',
    production: 'https://api-oc.klarna.com'
  }
};

class KlarnaProvider extends BNPLProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'klarna';

    // API Credentials (from environment or config)
    this.apiKey = config.apiKey || process.env.KLARNA_API_KEY;
    this.apiSecret = config.apiSecret || process.env.KLARNA_API_SECRET;

    // Environment and region settings
    this.environment = config.environment || process.env.KLARNA_ENVIRONMENT || 'sandbox';
    this.region = config.region || process.env.KLARNA_REGION || 'US';

    // Mock mode for testing without credentials
    this.mockMode = config.mockMode ?? !this.apiKey;
    this.approvalThreshold = config.approvalThreshold || 20000; // Mock: approves under $200

    // Build base URL
    const endpoints = KLARNA_ENDPOINTS[this.region] || KLARNA_ENDPOINTS.US;
    this.baseUrl = endpoints[this.environment] || endpoints.sandbox;
  }

  /**
   * Create a Klarna payment session
   * https://docs.klarna.com/api/payments/#tag/Sessions/operation/createCreditSession
   */
  async createSession(amount, customer, merchant) {
    // Use mock mode if no credentials
    if (this.mockMode) {
      return this._mockCreateSession(amount, customer, merchant);
    }

    const payload = {
      purchase_country: customer.country || 'US',
      purchase_currency: merchant.currency || 'USD',
      locale: customer.locale || 'en-US',
      order_amount: amount,
      order_tax_amount: 0,
      order_lines: [
        {
          type: 'physical',
          name: merchant.itemDescription || 'Purchase',
          quantity: 1,
          unit_price: amount,
          tax_rate: 0,
          total_amount: amount,
          total_tax_amount: 0
        }
      ],
      intent: 'buy',
      merchant_urls: {
        confirmation: merchant.returnUrl,
        notification: merchant.webhookUrl
      },
      billing_address: customer.billingAddress ? {
        given_name: customer.billingAddress.firstName,
        family_name: customer.billingAddress.lastName,
        email: customer.email,
        phone: customer.phone,
        street_address: customer.billingAddress.street,
        postal_code: customer.billingAddress.postalCode,
        city: customer.billingAddress.city,
        region: customer.billingAddress.state,
        country: customer.billingAddress.country || 'US'
      } : undefined
    };

    try {
      const response = await httpRequest(
        `${this.baseUrl}/payments/v1/sessions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': basicAuth(this.apiKey, this.apiSecret)
          },
          body: JSON.stringify(payload)
        },
        { timeout: 15000 }
      );

      return {
        sessionId: response.session_id,
        clientToken: response.client_token,
        redirectUrl: response.redirect_url || `https://pay.klarna.com/na/checkout/${response.session_id}`,
        paymentMethods: response.payment_method_categories,
        status: 'pending',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours
      };

    } catch (error) {
      // Map Klarna errors to our format
      const klarnaError = new Error(this._mapKlarnaError(error));
      klarnaError.provider = 'klarna';
      klarnaError.code = error.code;
      klarnaError.originalError = error;
      throw klarnaError;
    }
  }

  /**
   * Check session status
   * https://docs.klarna.com/api/payments/#tag/Sessions/operation/readCreditSession
   */
  async checkStatus(sessionId) {
    if (this.mockMode) {
      return { approved: true, declined: false, pending: false };
    }

    try {
      const response = await httpRequest(
        `${this.baseUrl}/payments/v1/sessions/${sessionId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': basicAuth(this.apiKey, this.apiSecret)
          }
        }
      );

      return {
        approved: response.status === 'complete',
        declined: response.status === 'cancelled',
        pending: response.status === 'incomplete',
        status: response.status,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to check Klarna session status: ${error.message}`);
    }
  }

  /**
   * Cancel/void a session
   */
  async cancelSession(sessionId) {
    if (this.mockMode) {
      return true;
    }

    try {
      await httpRequest(
        `${this.baseUrl}/payments/v1/sessions/${sessionId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': basicAuth(this.apiKey, this.apiSecret)
          }
        }
      );
      return true;
    } catch (error) {
      console.error(`[Klarna] Failed to cancel session: ${error.message}`);
      return false;
    }
  }

  /**
   * Authorize a payment (called after customer completes checkout)
   * https://docs.klarna.com/api/payments/#tag/Authorizations
   */
  async authorizePayment(authorizationToken, orderData) {
    if (this.mockMode) {
      return {
        orderId: `klarna_order_${Date.now()}`,
        status: 'authorized',
        fraudStatus: 'ACCEPTED'
      };
    }

    try {
      const response = await httpRequest(
        `${this.baseUrl}/payments/v1/authorizations/${authorizationToken}/order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': basicAuth(this.apiKey, this.apiSecret)
          },
          body: JSON.stringify(orderData)
        }
      );

      return {
        orderId: response.order_id,
        status: 'authorized',
        fraudStatus: response.fraud_status,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to authorize Klarna payment: ${error.message}`);
    }
  }

  /**
   * Mock implementation for testing without credentials
   */
  async _mockCreateSession(amount, customer, merchant) {
    await new Promise(resolve => setTimeout(resolve, 100));

    if (amount > this.approvalThreshold) {
      throw new Error('Amount exceeds credit limit');
    }

    return {
      sessionId: `klarna_mock_session_${Date.now()}`,
      clientToken: `klarna_mock_token_${Date.now()}`,
      redirectUrl: `https://pay.klarna.com/mock/${Date.now()}`,
      paymentMethods: ['pay_later', 'pay_over_time'],
      status: 'pending',
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    };
  }

  /**
   * Map Klarna error codes to user-friendly messages
   */
  _mapKlarnaError(error) {
    const errorMap = {
      'BAD_REQUEST': 'Invalid request data',
      'UNAUTHORIZED': 'Invalid Klarna credentials',
      'FORBIDDEN': 'Access denied by Klarna',
      'NOT_FOUND': 'Klarna session not found',
      'CONFLICT': 'Session already processed',
      'NOT_ALLOWED': 'Amount outside allowed limits',
      'TIMEOUT': 'Klarna request timed out'
    };

    return errorMap[error.code] || error.message || 'Klarna request failed';
  }
}

module.exports = KlarnaProvider;
