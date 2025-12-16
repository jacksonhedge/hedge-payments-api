/**
 * PayPal Pay in 4 BNPL Provider
 *
 * API Documentation: https://developer.paypal.com/docs/checkout/pay-later/us/
 * Orders API: https://developer.paypal.com/docs/api/orders/v2/
 *
 * PayPal uses OAuth 2.0 authentication.
 * Pay in 4 is available for orders between $30 and $1,500 in the US.
 * Flow: Create order -> Redirect to PayPal -> Capture on return
 */
const BNPLProvider = require('./base');
const { httpRequest, basicAuth } = require('../utils');

// PayPal API endpoints
const PAYPAL_ENDPOINTS = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  production: 'https://api-m.paypal.com'
};

// PayPal checkout URLs
const PAYPAL_CHECKOUT_URLS = {
  sandbox: 'https://www.sandbox.paypal.com/checkoutnow',
  production: 'https://www.paypal.com/checkoutnow'
};

class PayPalProvider extends BNPLProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'paypal';

    // API Credentials (from environment or config)
    this.clientId = config.clientId || process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.PAYPAL_CLIENT_SECRET;

    // Environment settings
    this.environment = config.environment || process.env.PAYPAL_ENVIRONMENT || 'sandbox';

    // Mock mode for testing without credentials
    this.mockMode = config.mockMode ?? !this.clientId;
    this.approvalThreshold = config.approvalThreshold || 150000; // Mock: approves under $1500

    // Pay in 4 limits (US only)
    this.minAmount = 3000;   // $30.00
    this.maxAmount = 150000; // $1,500.00

    // Build base URL
    this.baseUrl = PAYPAL_ENDPOINTS[this.environment] || PAYPAL_ENDPOINTS.sandbox;
    this.checkoutUrl = PAYPAL_CHECKOUT_URLS[this.environment] || PAYPAL_CHECKOUT_URLS.sandbox;

    // Auth token cache
    this._accessToken = null;
    this._tokenExpiry = null;
  }

  /**
   * Get OAuth access token
   * https://developer.paypal.com/api/rest/authentication/
   */
  async _getAccessToken() {
    // Return cached token if still valid
    if (this._accessToken && this._tokenExpiry && Date.now() < this._tokenExpiry) {
      return this._accessToken;
    }

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v1/oauth2/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': basicAuth(this.clientId, this.clientSecret)
          },
          body: 'grant_type=client_credentials'
        }
      );

      this._accessToken = response.access_token;
      // Token typically expires in ~9 hours, refresh 5 mins early
      this._tokenExpiry = Date.now() + ((response.expires_in || 32400) * 1000) - 300000;

      return this._accessToken;

    } catch (error) {
      throw new Error(`PayPal authentication failed: ${error.message}`);
    }
  }

  /**
   * Create a PayPal order for Pay in 4
   * https://developer.paypal.com/docs/api/orders/v2/#orders_create
   */
  async createSession(amount, customer, merchant) {
    if (this.mockMode) {
      return this._mockCreateSession(amount, customer, merchant);
    }

    // Check Pay in 4 limits
    if (amount < this.minAmount) {
      throw new Error(`Minimum order amount for Pay in 4 is $${this.minAmount / 100}`);
    }
    if (amount > this.maxAmount) {
      throw new Error(`Maximum order amount for Pay in 4 is $${this.maxAmount / 100}`);
    }

    const accessToken = await this._getAccessToken();

    // Convert cents to dollars
    const amountInDollars = (amount / 100).toFixed(2);

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: merchant.orderId || `order_${Date.now()}`,
          description: merchant.itemDescription || 'Purchase',
          amount: {
            currency_code: merchant.currency || 'USD',
            value: amountInDollars,
            breakdown: {
              item_total: {
                currency_code: merchant.currency || 'USD',
                value: amountInDollars
              }
            }
          },
          items: [
            {
              name: merchant.itemDescription || 'Purchase',
              quantity: '1',
              unit_amount: {
                currency_code: merchant.currency || 'USD',
                value: amountInDollars
              },
              category: 'DIGITAL_GOODS'
            }
          ]
        }
      ],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            brand_name: merchant.name || 'Hedge Payments',
            locale: customer.locale || 'en-US',
            landing_page: 'LOGIN',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: merchant.returnUrl,
            cancel_url: merchant.cancelUrl || merchant.returnUrl
          }
        }
      }
    };

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v2/checkout/orders`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'PayPal-Request-Id': `${merchant.orderId || Date.now()}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(payload)
        },
        { timeout: 15000 }
      );

      // Find the approval link
      const approveLink = response.links?.find(l => l.rel === 'payer-action' || l.rel === 'approve');
      const redirectUrl = approveLink?.href || `${this.checkoutUrl}?token=${response.id}`;

      return {
        sessionId: response.id,
        orderId: response.id,
        redirectUrl: redirectUrl,
        status: response.status,
        expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours
        links: response.links
      };

    } catch (error) {
      const paypalError = new Error(this._mapPayPalError(error));
      paypalError.provider = 'paypal';
      paypalError.code = error.code;
      paypalError.originalError = error;
      throw paypalError;
    }
  }

  /**
   * Get order details
   * https://developer.paypal.com/docs/api/orders/v2/#orders_get
   */
  async checkStatus(orderId) {
    if (this.mockMode) {
      return { approved: true, declined: false, pending: false };
    }

    const accessToken = await this._getAccessToken();

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v2/checkout/orders/${orderId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      const statusMap = {
        'COMPLETED': { approved: true, declined: false, pending: false },
        'APPROVED': { approved: true, declined: false, pending: false },
        'VOIDED': { approved: false, declined: true, pending: false },
        'CREATED': { approved: false, declined: false, pending: true },
        'SAVED': { approved: false, declined: false, pending: true },
        'PAYER_ACTION_REQUIRED': { approved: false, declined: false, pending: true }
      };

      return {
        ...statusMap[response.status] || { approved: false, declined: false, pending: true },
        status: response.status,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to check PayPal order status: ${error.message}`);
    }
  }

  /**
   * Capture a PayPal order
   * https://developer.paypal.com/docs/api/orders/v2/#orders_capture
   */
  async captureOrder(orderId) {
    if (this.mockMode) {
      return {
        success: true,
        captureId: `capture_${Date.now()}`,
        status: 'COMPLETED'
      };
    }

    const accessToken = await this._getAccessToken();

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'Prefer': 'return=representation'
          }
        }
      );

      const capture = response.purchase_units?.[0]?.payments?.captures?.[0];

      return {
        success: response.status === 'COMPLETED',
        captureId: capture?.id,
        status: response.status,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to capture PayPal order: ${error.message}`);
    }
  }

  /**
   * Void/cancel an order (only for orders not yet captured)
   */
  async cancelSession(orderId) {
    if (this.mockMode) {
      return true;
    }

    // PayPal doesn't have a direct void for orders
    // Orders expire automatically if not captured
    console.log(`[PayPal] Order ${orderId} will expire if not captured`);
    return true;
  }

  /**
   * Refund a captured payment
   * https://developer.paypal.com/docs/api/payments/v2/#captures_refund
   */
  async refundCapture(captureId, amount, note) {
    if (this.mockMode) {
      return { success: true, refundId: `refund_${Date.now()}` };
    }

    const accessToken = await this._getAccessToken();
    const amountInDollars = amount ? (amount / 100).toFixed(2) : undefined;

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v2/payments/captures/${captureId}/refund`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            amount: amountInDollars ? {
              value: amountInDollars,
              currency_code: 'USD'
            } : undefined,
            note_to_payer: note
          })
        }
      );

      return {
        success: response.status === 'COMPLETED',
        refundId: response.id,
        status: response.status,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to refund PayPal capture: ${error.message}`);
    }
  }

  /**
   * Mock implementation for testing
   */
  async _mockCreateSession(amount, customer, merchant) {
    await new Promise(resolve => setTimeout(resolve, 140));

    if (amount < this.minAmount) {
      throw new Error(`Minimum order amount for Pay in 4 is $${this.minAmount / 100}`);
    }

    if (amount > this.approvalThreshold) {
      throw new Error('Order amount exceeds PayPal Pay in 4 limit');
    }

    const orderId = `PAYPAL_MOCK_${Date.now()}`;

    return {
      sessionId: orderId,
      orderId: orderId,
      redirectUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`,
      status: 'CREATED',
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
    };
  }

  /**
   * Map PayPal error codes
   */
  _mapPayPalError(error) {
    const errorMap = {
      'INVALID_REQUEST': 'Invalid checkout request',
      'AUTHENTICATION_FAILURE': 'Invalid PayPal credentials',
      'NOT_AUTHORIZED': 'Not authorized for this operation',
      'RESOURCE_NOT_FOUND': 'Order not found',
      'INVALID_CURRENCY': 'Invalid currency',
      'AMOUNT_MISMATCH': 'Amount mismatch',
      'MAX_AMOUNT_EXCEEDED': 'Amount exceeds Pay in 4 maximum ($1,500)',
      'INSTRUMENT_DECLINED': 'Payment declined',
      'TIMEOUT': 'PayPal request timed out'
    };

    // Check for PayPal specific error details
    if (error.data?.details?.[0]?.description) {
      return error.data.details[0].description;
    }
    if (error.data?.message) {
      return error.data.message;
    }

    return errorMap[error.code] || error.message || 'PayPal request failed';
  }
}

module.exports = PayPalProvider;
