/**
 * Zip (formerly Quadpay) BNPL Provider
 *
 * API Documentation: https://docs.us.zip.co/docs/custom-integration-guide
 *
 * Zip uses API key authentication.
 * Flow: Create order -> Redirect to Zip -> Customer completes -> Capture
 * Supports virtual card checkout and standard checkout.
 */
const BNPLProvider = require('./base');
const { httpRequest, basicAuth } = require('../utils');

// Zip API endpoints
const ZIP_ENDPOINTS = {
  US: {
    sandbox: 'https://gateway.sand.us.zip.co',
    production: 'https://gateway.us.zip.co'
  },
  AU: {
    sandbox: 'https://gateway.sandbox.zipmoney.com.au',
    production: 'https://gateway.zipmoney.com.au'
  }
};

class ZipProvider extends BNPLProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'zip';

    // API Credentials (from environment or config)
    this.apiKey = config.apiKey || process.env.ZIP_API_KEY;
    this.apiSecret = config.apiSecret || process.env.ZIP_API_SECRET;
    this.merchantId = config.merchantId || process.env.ZIP_MERCHANT_ID;

    // Environment and region settings
    this.environment = config.environment || process.env.ZIP_ENVIRONMENT || 'sandbox';
    this.region = config.region || process.env.ZIP_REGION || 'US';

    // Mock mode for testing without credentials
    this.mockMode = config.mockMode ?? !this.apiKey;
    this.approvalThreshold = config.approvalThreshold || 150000; // Mock: approves under $1500

    // Build base URL
    const endpoints = ZIP_ENDPOINTS[this.region] || ZIP_ENDPOINTS.US;
    this.baseUrl = endpoints[this.environment] || endpoints.sandbox;
  }

  /**
   * Create a Zip checkout order
   * https://docs.us.zip.co/docs/api-integration
   */
  async createSession(amount, customer, merchant) {
    if (this.mockMode) {
      return this._mockCreateSession(amount, customer, merchant);
    }

    // Convert cents to dollars for Zip
    const amountInDollars = (amount / 100).toFixed(2);

    const payload = {
      amount: parseFloat(amountInDollars),
      currency: merchant.currency || 'USD',
      consumer: {
        phoneNumber: customer.phone,
        givenNames: customer.firstName || customer.name?.split(' ')[0],
        surname: customer.lastName || customer.name?.split(' ').slice(1).join(' '),
        email: customer.email
      },
      billing: customer.billingAddress ? {
        addressLine1: customer.billingAddress.street,
        addressLine2: customer.billingAddress.street2,
        suburb: customer.billingAddress.city,
        state: customer.billingAddress.state,
        postcode: customer.billingAddress.postalCode,
        countryCode: customer.billingAddress.country || 'US'
      } : undefined,
      shipping: customer.shippingAddress ? {
        addressLine1: customer.shippingAddress.street,
        addressLine2: customer.shippingAddress.street2,
        suburb: customer.shippingAddress.city,
        state: customer.shippingAddress.state,
        postcode: customer.shippingAddress.postalCode,
        countryCode: customer.shippingAddress.country || 'US'
      } : undefined,
      description: merchant.itemDescription || 'Purchase',
      merchantReference: merchant.orderId || `order_${Date.now()}`,
      items: [
        {
          name: merchant.itemDescription || 'Purchase',
          amount: parseFloat(amountInDollars),
          quantity: 1,
          type: 'sku'
        }
      ],
      merchant: {
        redirectConfirmUrl: merchant.returnUrl,
        redirectCancelUrl: merchant.cancelUrl || merchant.returnUrl
      },
      metadata: {
        platform: 'hedge_payments',
        ...merchant.metadata
      }
    };

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v1/orders/authorize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': basicAuth(this.apiKey, this.apiSecret),
            'X-Merchant-Id': this.merchantId
          },
          body: JSON.stringify(payload)
        },
        { timeout: 15000 }
      );

      return {
        sessionId: response.id || response.orderId,
        orderId: response.orderId,
        token: response.token,
        redirectUrl: response.redirectUrl || response.checkoutUrl,
        status: 'pending',
        expiresAt: response.expiresAt || new Date(Date.now() + 60 * 60 * 1000).toISOString()
      };

    } catch (error) {
      const zipError = new Error(this._mapZipError(error));
      zipError.provider = 'zip';
      zipError.code = error.code;
      zipError.originalError = error;
      throw zipError;
    }
  }

  /**
   * Check order status
   */
  async checkStatus(orderId) {
    if (this.mockMode) {
      return { approved: true, declined: false, pending: false };
    }

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v1/orders/${orderId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': basicAuth(this.apiKey, this.apiSecret),
            'X-Merchant-Id': this.merchantId
          }
        }
      );

      const statusMap = {
        'Approved': { approved: true, declined: false, pending: false },
        'Completed': { approved: true, declined: false, pending: false },
        'Captured': { approved: true, declined: false, pending: false },
        'Declined': { approved: false, declined: true, pending: false },
        'Cancelled': { approved: false, declined: true, pending: false },
        'Expired': { approved: false, declined: true, pending: false },
        'Pending': { approved: false, declined: false, pending: true },
        'Authorized': { approved: true, declined: false, pending: false }
      };

      return {
        ...statusMap[response.status] || { approved: false, declined: false, pending: true },
        status: response.status,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to check Zip order status: ${error.message}`);
    }
  }

  /**
   * Capture an authorized order
   */
  async captureOrder(orderId, amount) {
    if (this.mockMode) {
      return { success: true, status: 'captured' };
    }

    const amountInDollars = amount ? (amount / 100).toFixed(2) : undefined;

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v1/orders/${orderId}/capture`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': basicAuth(this.apiKey, this.apiSecret),
            'X-Merchant-Id': this.merchantId
          },
          body: JSON.stringify(amountInDollars ? { amount: parseFloat(amountInDollars) } : {})
        }
      );

      return {
        success: true,
        status: 'captured',
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to capture Zip order: ${error.message}`);
    }
  }

  /**
   * Cancel/void an order
   */
  async cancelSession(orderId) {
    if (this.mockMode) {
      return true;
    }

    try {
      await httpRequest(
        `${this.baseUrl}/v1/orders/${orderId}/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': basicAuth(this.apiKey, this.apiSecret),
            'X-Merchant-Id': this.merchantId
          }
        }
      );
      return true;
    } catch (error) {
      console.error(`[Zip] Failed to cancel order: ${error.message}`);
      return false;
    }
  }

  /**
   * Refund an order
   */
  async refundOrder(orderId, amount, reason) {
    if (this.mockMode) {
      return { success: true, refundId: `refund_${Date.now()}` };
    }

    const amountInDollars = (amount / 100).toFixed(2);

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v1/orders/${orderId}/refund`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': basicAuth(this.apiKey, this.apiSecret),
            'X-Merchant-Id': this.merchantId
          },
          body: JSON.stringify({
            amount: parseFloat(amountInDollars),
            reason: reason || 'Refund'
          })
        }
      );

      return {
        success: true,
        refundId: response.refundId,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to refund Zip order: ${error.message}`);
    }
  }

  /**
   * Mock implementation for testing
   */
  async _mockCreateSession(amount, customer, merchant) {
    await new Promise(resolve => setTimeout(resolve, 130));

    if (amount > this.approvalThreshold) {
      throw new Error('Order amount exceeds Zip limit');
    }

    return {
      sessionId: `zip_mock_order_${Date.now()}`,
      orderId: `zip_mock_order_${Date.now()}`,
      token: `zip_mock_token_${Date.now()}`,
      redirectUrl: `https://checkout.quadpay.com/mock/${Date.now()}`,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    };
  }

  /**
   * Map Zip error codes
   */
  _mapZipError(error) {
    const errorMap = {
      'invalid_request': 'Invalid checkout request',
      'unauthorized': 'Invalid Zip credentials',
      'invalid_amount': 'Amount outside allowed range',
      'consumer_declined': 'Customer not approved for Zip',
      'order_expired': 'Checkout session expired',
      'TIMEOUT': 'Zip request timed out'
    };

    if (error.data?.message) {
      return error.data.message;
    }

    return errorMap[error.code] || error.message || 'Zip request failed';
  }
}

module.exports = ZipProvider;
