/**
 * Sezzle BNPL Provider
 *
 * API Documentation: https://docs.sezzle.com/docs/api/intro
 *
 * Sezzle uses bearer token authentication.
 * Flow: Get auth token -> Create session -> Redirect to Sezzle -> Capture/Auth
 * Sessions can have AUTH or CAPTURE intent.
 */
const BNPLProvider = require('./base');
const { httpRequest } = require('../utils');

// Sezzle API endpoints
const SEZZLE_ENDPOINTS = {
  sandbox: 'https://sandbox.gateway.sezzle.com',
  production: 'https://gateway.sezzle.com'
};

class SezzleProvider extends BNPLProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'sezzle';

    // API Credentials (from environment or config)
    this.publicKey = config.publicKey || process.env.SEZZLE_PUBLIC_KEY;
    this.privateKey = config.privateKey || process.env.SEZZLE_PRIVATE_KEY;

    // Environment settings
    this.environment = config.environment || process.env.SEZZLE_ENVIRONMENT || 'sandbox';

    // Mock mode for testing without credentials
    this.mockMode = config.mockMode ?? !this.publicKey;
    this.approvalThreshold = config.approvalThreshold || 250000; // Mock: approves under $2500

    // Build base URL
    this.baseUrl = SEZZLE_ENDPOINTS[this.environment] || SEZZLE_ENDPOINTS.sandbox;

    // Auth token cache
    this._authToken = null;
    this._tokenExpiry = null;
  }

  /**
   * Get authentication token
   * https://docs.sezzle.com/docs/api/core/authentication/postauthentication
   */
  async _getAuthToken() {
    // Return cached token if still valid
    if (this._authToken && this._tokenExpiry && Date.now() < this._tokenExpiry) {
      return this._authToken;
    }

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v2/authentication`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            public_key: this.publicKey,
            private_key: this.privateKey
          })
        }
      );

      this._authToken = response.token;
      // Token expires in ~2 hours, refresh 5 mins early
      this._tokenExpiry = Date.now() + (response.expiration_date ?
        new Date(response.expiration_date).getTime() - Date.now() - 300000 :
        7200000 - 300000);

      return this._authToken;

    } catch (error) {
      throw new Error(`Sezzle authentication failed: ${error.message}`);
    }
  }

  /**
   * Create a Sezzle checkout session
   * https://docs.sezzle.com/docs/api/core/sessions/postv2session
   */
  async createSession(amount, customer, merchant) {
    if (this.mockMode) {
      return this._mockCreateSession(amount, customer, merchant);
    }

    const token = await this._getAuthToken();

    // Amount must be at least $1.00 (100 cents)
    if (amount < 100) {
      throw new Error('Minimum order amount is $1.00');
    }

    const payload = {
      intent: merchant.intent || 'CAPTURE', // AUTH or CAPTURE
      reference_id: merchant.orderId || `order_${Date.now()}`,
      order: {
        reference_id: merchant.orderId || `order_${Date.now()}`,
        description: merchant.itemDescription || 'Purchase',
        order_amount: {
          amount_in_cents: amount,
          currency: merchant.currency || 'USD'
        },
        items: [
          {
            name: merchant.itemDescription || 'Purchase',
            sku: merchant.sku || 'ITEM-001',
            quantity: 1,
            price: {
              amount_in_cents: amount,
              currency: merchant.currency || 'USD'
            }
          }
        ]
      },
      customer: {
        email: customer.email,
        first_name: customer.firstName || customer.name?.split(' ')[0],
        last_name: customer.lastName || customer.name?.split(' ').slice(1).join(' '),
        phone: customer.phone,
        billing_address: customer.billingAddress ? {
          street: customer.billingAddress.street,
          street2: customer.billingAddress.street2,
          city: customer.billingAddress.city,
          state: customer.billingAddress.state,
          postal_code: customer.billingAddress.postalCode,
          country_code: customer.billingAddress.country || 'US'
        } : undefined,
        shipping_address: customer.shippingAddress ? {
          street: customer.shippingAddress.street,
          street2: customer.shippingAddress.street2,
          city: customer.shippingAddress.city,
          state: customer.shippingAddress.state,
          postal_code: customer.shippingAddress.postalCode,
          country_code: customer.shippingAddress.country || 'US'
        } : undefined
      },
      urls: {
        complete: merchant.returnUrl,
        cancel: merchant.cancelUrl || merchant.returnUrl
      }
    };

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v2/session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        },
        { timeout: 15000 }
      );

      return {
        sessionId: response.uuid,
        orderUuid: response.order?.uuid,
        redirectUrl: response.checkout_url,
        status: 'pending',
        expiresAt: response.order?.expiration || new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };

    } catch (error) {
      const sezzleError = new Error(this._mapSezzleError(error));
      sezzleError.provider = 'sezzle';
      sezzleError.code = error.code;
      sezzleError.originalError = error;
      throw sezzleError;
    }
  }

  /**
   * Check order status
   * https://docs.sezzle.com/docs/api/core/orders/getv2order
   */
  async checkStatus(orderUuid) {
    if (this.mockMode) {
      return { approved: true, declined: false, pending: false };
    }

    const token = await this._getAuthToken();

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v2/order/${orderUuid}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const statusMap = {
        'AP': { approved: true, declined: false, pending: false },  // Approved
        'CA': { approved: false, declined: true, pending: false },  // Cancelled
        'CO': { approved: true, declined: false, pending: false },  // Complete
        'DE': { approved: false, declined: true, pending: false },  // Declined
        'EX': { approved: false, declined: true, pending: false },  // Expired
        'PE': { approved: false, declined: false, pending: true },  // Pending
        'RE': { approved: false, declined: false, pending: false }  // Refunded
      };

      return {
        ...statusMap[response.authorization?.status] || { approved: false, declined: false, pending: true },
        status: response.authorization?.status,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to check Sezzle order status: ${error.message}`);
    }
  }

  /**
   * Capture an authorized order
   * https://docs.sezzle.com/docs/api/core/orders/postv2capturebyorder
   */
  async captureOrder(orderUuid, amount) {
    if (this.mockMode) {
      return { success: true, status: 'captured' };
    }

    const token = await this._getAuthToken();

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v2/order/${orderUuid}/capture`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(amount ? {
            capture_amount: {
              amount_in_cents: amount,
              currency: 'USD'
            }
          } : {})
        }
      );

      return {
        success: true,
        status: 'captured',
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to capture Sezzle order: ${error.message}`);
    }
  }

  /**
   * Release/cancel an authorization
   */
  async cancelSession(orderUuid) {
    if (this.mockMode) {
      return true;
    }

    const token = await this._getAuthToken();

    try {
      await httpRequest(
        `${this.baseUrl}/v2/order/${orderUuid}/release`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      return true;
    } catch (error) {
      console.error(`[Sezzle] Failed to release order: ${error.message}`);
      return false;
    }
  }

  /**
   * Refund an order
   */
  async refundOrder(orderUuid, amount) {
    if (this.mockMode) {
      return { success: true, refundUuid: `refund_${Date.now()}` };
    }

    const token = await this._getAuthToken();

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v2/order/${orderUuid}/refund`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            amount: {
              amount_in_cents: amount,
              currency: 'USD'
            }
          })
        }
      );

      return {
        success: true,
        refundUuid: response.uuid,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to refund Sezzle order: ${error.message}`);
    }
  }

  /**
   * Mock implementation for testing
   */
  async _mockCreateSession(amount, customer, merchant) {
    await new Promise(resolve => setTimeout(resolve, 110));

    if (amount < 100) {
      throw new Error('Minimum order amount is $1.00');
    }

    if (amount > this.approvalThreshold) {
      throw new Error('Order amount exceeds Sezzle limit');
    }

    return {
      sessionId: `sezzle_mock_session_${Date.now()}`,
      orderUuid: `sezzle_mock_order_${Date.now()}`,
      redirectUrl: `https://checkout.sezzle.com/mock/${Date.now()}`,
      status: 'pending',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };
  }

  /**
   * Map Sezzle error codes
   */
  _mapSezzleError(error) {
    const errorMap = {
      'invalid_request': 'Invalid checkout request',
      'authentication_error': 'Invalid Sezzle credentials',
      'order_minimum': 'Order below minimum amount',
      'order_maximum': 'Order exceeds maximum amount',
      'TIMEOUT': 'Sezzle request timed out'
    };

    if (error.data?.message) {
      return error.data.message;
    }

    return errorMap[error.code] || error.message || 'Sezzle request failed';
  }
}

module.exports = SezzleProvider;
