/**
 * Affirm BNPL Provider
 *
 * API Documentation: https://docs.affirm.com/payments/docs/direct-api-overview
 *
 * Affirm uses public/private key pair authentication.
 * Checkout flow: Create checkout object -> Customer completes on Affirm -> Receive checkout_token -> Authorize
 */
const BNPLProvider = require('./base');
const { httpRequest } = require('../utils');

// Affirm API endpoints
const AFFIRM_ENDPOINTS = {
  sandbox: 'https://sandbox.affirm.com/api',
  production: 'https://api.affirm.com/api'
};

// Affirm checkout JS URLs
const AFFIRM_JS_URLS = {
  sandbox: 'https://cdn1-sandbox.affirm.com/js/v2/affirm.js',
  production: 'https://cdn1.affirm.com/js/v2/affirm.js'
};

class AffirmProvider extends BNPLProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'affirm';

    // API Credentials (from environment or config)
    this.publicKey = config.publicKey || process.env.AFFIRM_PUBLIC_KEY;
    this.privateKey = config.privateKey || process.env.AFFIRM_PRIVATE_KEY;

    // Environment settings
    this.environment = config.environment || process.env.AFFIRM_ENVIRONMENT || 'sandbox';

    // Mock mode for testing without credentials
    this.mockMode = config.mockMode ?? !this.publicKey;
    this.approvalThreshold = config.approvalThreshold || 50000; // Mock: approves under $500

    // Build base URL
    this.baseUrl = AFFIRM_ENDPOINTS[this.environment] || AFFIRM_ENDPOINTS.sandbox;
    this.jsUrl = AFFIRM_JS_URLS[this.environment] || AFFIRM_JS_URLS.sandbox;
  }

  /**
   * Create an Affirm checkout session
   * https://docs.affirm.com/developers/reference/the-checkout-object
   *
   * Note: Affirm's Direct API returns a checkout object that the frontend
   * uses to open the Affirm modal/redirect. The actual approval happens
   * client-side, then we receive a checkout_token to authorize.
   */
  async createSession(amount, customer, merchant) {
    // Use mock mode if no credentials
    if (this.mockMode) {
      return this._mockCreateSession(amount, customer, merchant);
    }

    // Build the checkout object
    const checkoutData = {
      merchant: {
        user_confirmation_url: merchant.returnUrl,
        user_cancel_url: merchant.cancelUrl || merchant.returnUrl,
        user_confirmation_url_action: 'POST',
        name: merchant.name || 'Hedge Payments'
      },
      shipping: customer.shippingAddress ? {
        name: {
          first: customer.shippingAddress.firstName,
          last: customer.shippingAddress.lastName
        },
        address: {
          line1: customer.shippingAddress.street,
          city: customer.shippingAddress.city,
          state: customer.shippingAddress.state,
          zipcode: customer.shippingAddress.postalCode,
          country: customer.shippingAddress.country || 'USA'
        },
        phone_number: customer.phone,
        email: customer.email
      } : undefined,
      billing: customer.billingAddress ? {
        name: {
          first: customer.billingAddress.firstName,
          last: customer.billingAddress.lastName
        },
        address: {
          line1: customer.billingAddress.street,
          city: customer.billingAddress.city,
          state: customer.billingAddress.state,
          zipcode: customer.billingAddress.postalCode,
          country: customer.billingAddress.country || 'USA'
        },
        phone_number: customer.phone,
        email: customer.email
      } : undefined,
      items: [
        {
          display_name: merchant.itemDescription || 'Purchase',
          sku: merchant.sku || 'ITEM-001',
          unit_price: amount,
          qty: 1,
          item_url: merchant.itemUrl
        }
      ],
      currency: merchant.currency || 'USD',
      order_id: merchant.orderId || `order_${Date.now()}`,
      shipping_amount: 0,
      tax_amount: 0,
      total: amount,
      metadata: {
        platform: 'hedge_payments',
        ...merchant.metadata
      }
    };

    try {
      // Create checkout via API
      const response = await httpRequest(
        `${this.baseUrl}/v1/transactions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${this.publicKey}:${this.privateKey}`).toString('base64')}`
          },
          body: JSON.stringify(checkoutData)
        },
        { timeout: 15000 }
      );

      return {
        sessionId: response.checkout_id || `affirm_checkout_${Date.now()}`,
        checkoutData: checkoutData, // Frontend needs this for affirm.checkout()
        redirectUrl: response.redirect_url || `https://checkout.affirm.com/${response.checkout_id}`,
        jsUrl: this.jsUrl,
        publicKey: this.publicKey,
        status: 'pending',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
      };

    } catch (error) {
      const affirmError = new Error(this._mapAffirmError(error));
      affirmError.provider = 'affirm';
      affirmError.code = error.code;
      affirmError.originalError = error;
      throw affirmError;
    }
  }

  /**
   * Check checkout/transaction status
   * https://docs.affirm.com/developers/reference/read-transaction
   */
  async checkStatus(transactionId) {
    if (this.mockMode) {
      return { approved: true, declined: false, pending: false };
    }

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v1/transactions/${transactionId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.publicKey}:${this.privateKey}`).toString('base64')}`
          }
        }
      );

      const statusMap = {
        'authorized': { approved: true, declined: false, pending: false },
        'captured': { approved: true, declined: false, pending: false },
        'voided': { approved: false, declined: true, pending: false },
        'refunded': { approved: false, declined: false, pending: false },
        'pending': { approved: false, declined: false, pending: true }
      };

      return {
        ...statusMap[response.status] || { approved: false, declined: false, pending: true },
        status: response.status,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to check Affirm transaction status: ${error.message}`);
    }
  }

  /**
   * Authorize a checkout (called after receiving checkout_token from frontend)
   * https://docs.affirm.com/developers/reference/authorize
   */
  async authorizeCheckout(checkoutToken, orderId) {
    if (this.mockMode) {
      return {
        transactionId: `affirm_txn_${Date.now()}`,
        status: 'authorized',
        amount: 0
      };
    }

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v1/transactions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${this.publicKey}:${this.privateKey}`).toString('base64')}`
          },
          body: JSON.stringify({
            checkout_token: checkoutToken,
            order_id: orderId
          })
        }
      );

      return {
        transactionId: response.id,
        status: response.status,
        amount: response.amount,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to authorize Affirm checkout: ${error.message}`);
    }
  }

  /**
   * Capture an authorized transaction
   * https://docs.affirm.com/developers/reference/capture
   */
  async captureTransaction(transactionId, amount) {
    if (this.mockMode) {
      return { success: true, status: 'captured' };
    }

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v1/transactions/${transactionId}/capture`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${this.publicKey}:${this.privateKey}`).toString('base64')}`
          },
          body: JSON.stringify(amount ? { amount } : {})
        }
      );

      return {
        success: true,
        status: response.status,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to capture Affirm transaction: ${error.message}`);
    }
  }

  /**
   * Void/cancel a transaction
   */
  async cancelSession(transactionId) {
    if (this.mockMode) {
      return true;
    }

    try {
      await httpRequest(
        `${this.baseUrl}/v1/transactions/${transactionId}/void`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.publicKey}:${this.privateKey}`).toString('base64')}`
          }
        }
      );
      return true;
    } catch (error) {
      console.error(`[Affirm] Failed to void transaction: ${error.message}`);
      return false;
    }
  }

  /**
   * Mock implementation for testing without credentials
   */
  async _mockCreateSession(amount, customer, merchant) {
    await new Promise(resolve => setTimeout(resolve, 150));

    if (amount > this.approvalThreshold) {
      throw new Error('Risk assessment failed');
    }

    return {
      sessionId: `affirm_mock_checkout_${Date.now()}`,
      checkoutData: { total: amount },
      redirectUrl: `https://checkout.affirm.com/mock/${Date.now()}`,
      jsUrl: this.jsUrl,
      publicKey: 'mock_public_key',
      status: 'pending',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };
  }

  /**
   * Map Affirm error codes to user-friendly messages
   */
  _mapAffirmError(error) {
    const errorMap = {
      'invalid_request': 'Invalid checkout request',
      'authentication_error': 'Invalid Affirm credentials',
      'rate_limit_error': 'Too many requests to Affirm',
      'api_error': 'Affirm service error',
      'checkout_token_expired': 'Checkout session expired',
      'insufficient_credit': 'Customer not approved for this amount',
      'TIMEOUT': 'Affirm request timed out'
    };

    return errorMap[error.code] || error.message || 'Affirm request failed';
  }
}

module.exports = AffirmProvider;
