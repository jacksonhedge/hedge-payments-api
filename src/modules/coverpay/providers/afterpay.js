/**
 * Afterpay/Clearpay BNPL Provider
 *
 * API Documentation: https://developers.afterpay.com/afterpay-online/docs/create-order
 *
 * Afterpay uses Merchant ID + Secret Key authentication.
 * Checkout flow: Create checkout -> Get token -> Redirect to Afterpay -> Capture on return
 *
 * Note: Afterpay is called "Clearpay" in UK/EU markets. This provider supports both.
 */
const BNPLProvider = require('./base');
const { httpRequest, basicAuth } = require('../utils');

// Afterpay API endpoints by region
const AFTERPAY_ENDPOINTS = {
  US: {
    sandbox: 'https://global-api-sandbox.afterpay.com',
    production: 'https://global-api.afterpay.com'
  },
  AU: {
    sandbox: 'https://global-api-sandbox.afterpay.com',
    production: 'https://global-api.afterpay.com'
  },
  UK: {
    sandbox: 'https://global-api-sandbox.afterpay.com',
    production: 'https://global-api.afterpay.com'
  },
  EU: {
    sandbox: 'https://global-api-sandbox.afterpay.com',
    production: 'https://global-api.afterpay.com'
  }
};

// Afterpay JS URLs
const AFTERPAY_JS_URLS = {
  sandbox: 'https://portal.sandbox.afterpay.com/afterpay.js',
  production: 'https://portal.afterpay.com/afterpay.js'
};

class AfterpayProvider extends BNPLProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'afterpay';

    // API Credentials (from environment or config)
    this.merchantId = config.merchantId || process.env.AFTERPAY_MERCHANT_ID;
    this.secretKey = config.secretKey || process.env.AFTERPAY_SECRET_KEY;

    // Environment and region settings
    this.environment = config.environment || process.env.AFTERPAY_ENVIRONMENT || 'sandbox';
    this.region = config.region || process.env.AFTERPAY_REGION || 'US';

    // Mock mode for testing without credentials
    this.mockMode = config.mockMode ?? !this.merchantId;
    this.approvalThreshold = config.approvalThreshold || 100000; // Mock: approves under $1000

    // Afterpay has min/max limits - store them (should fetch from config endpoint)
    this.minAmount = config.minAmount || 100; // $1.00
    this.maxAmount = config.maxAmount || 200000; // $2000.00

    // Build base URL
    const endpoints = AFTERPAY_ENDPOINTS[this.region] || AFTERPAY_ENDPOINTS.US;
    this.baseUrl = endpoints[this.environment] || endpoints.sandbox;
    this.jsUrl = AFTERPAY_JS_URLS[this.environment] || AFTERPAY_JS_URLS.sandbox;
  }

  /**
   * Get Afterpay configuration (min/max amounts, etc.)
   * Should be called once daily and cached
   * https://developers.afterpay.com/afterpay-online/reference/get-configuration
   */
  async getConfiguration() {
    if (this.mockMode) {
      return {
        minimumAmount: { amount: '1.00', currency: 'USD' },
        maximumAmount: { amount: '2000.00', currency: 'USD' }
      };
    }

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v2/configuration`,
        {
          method: 'GET',
          headers: {
            'Authorization': basicAuth(this.merchantId, this.secretKey),
            'Accept': 'application/json'
          }
        }
      );

      // Update cached limits
      if (response.minimumAmount) {
        this.minAmount = Math.round(parseFloat(response.minimumAmount.amount) * 100);
      }
      if (response.maximumAmount) {
        this.maxAmount = Math.round(parseFloat(response.maximumAmount.amount) * 100);
      }

      return response;

    } catch (error) {
      console.error(`[Afterpay] Failed to get configuration: ${error.message}`);
      return null;
    }
  }

  /**
   * Create an Afterpay checkout
   * https://developers.afterpay.com/afterpay-online/reference/create-checkout
   */
  async createSession(amount, customer, merchant) {
    // Use mock mode if no credentials
    if (this.mockMode) {
      return this._mockCreateSession(amount, customer, merchant);
    }

    // Check amount limits
    if (amount < this.minAmount || amount > this.maxAmount) {
      throw new Error(`Amount must be between $${this.minAmount/100} and $${this.maxAmount/100}`);
    }

    // Convert cents to dollars for Afterpay
    const amountInDollars = (amount / 100).toFixed(2);

    const payload = {
      amount: {
        amount: amountInDollars,
        currency: merchant.currency || 'USD'
      },
      consumer: {
        phoneNumber: customer.phone,
        givenNames: customer.firstName || customer.name?.split(' ')[0],
        surname: customer.lastName || customer.name?.split(' ').slice(1).join(' '),
        email: customer.email
      },
      billing: customer.billingAddress ? {
        name: `${customer.billingAddress.firstName} ${customer.billingAddress.lastName}`,
        line1: customer.billingAddress.street,
        suburb: customer.billingAddress.city,
        state: customer.billingAddress.state,
        postcode: customer.billingAddress.postalCode,
        countryCode: customer.billingAddress.country || 'US',
        phoneNumber: customer.phone
      } : undefined,
      shipping: customer.shippingAddress ? {
        name: `${customer.shippingAddress.firstName} ${customer.shippingAddress.lastName}`,
        line1: customer.shippingAddress.street,
        suburb: customer.shippingAddress.city,
        state: customer.shippingAddress.state,
        postcode: customer.shippingAddress.postalCode,
        countryCode: customer.shippingAddress.country || 'US',
        phoneNumber: customer.phone
      } : undefined,
      merchant: {
        redirectConfirmUrl: merchant.returnUrl,
        redirectCancelUrl: merchant.cancelUrl || merchant.returnUrl,
        name: merchant.name || 'Hedge Payments'
      },
      merchantReference: merchant.orderId || `order_${Date.now()}`,
      taxAmount: {
        amount: '0.00',
        currency: merchant.currency || 'USD'
      },
      shippingAmount: {
        amount: '0.00',
        currency: merchant.currency || 'USD'
      },
      items: [
        {
          name: merchant.itemDescription || 'Purchase',
          quantity: 1,
          price: {
            amount: amountInDollars,
            currency: merchant.currency || 'USD'
          }
        }
      ]
    };

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v2/checkouts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': basicAuth(this.merchantId, this.secretKey),
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        },
        { timeout: 15000 }
      );

      return {
        sessionId: response.token,
        token: response.token,
        redirectUrl: response.redirectCheckoutUrl,
        jsUrl: this.jsUrl,
        status: 'pending',
        expiresAt: response.expires || new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
      };

    } catch (error) {
      const afterpayError = new Error(this._mapAfterpayError(error));
      afterpayError.provider = 'afterpay';
      afterpayError.code = error.code;
      afterpayError.originalError = error;
      throw afterpayError;
    }
  }

  /**
   * Check payment status
   * https://developers.afterpay.com/afterpay-online/reference/get-payment-by-order-id
   */
  async checkStatus(orderId) {
    if (this.mockMode) {
      return { approved: true, declined: false, pending: false };
    }

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v2/payments/${orderId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': basicAuth(this.merchantId, this.secretKey),
            'Accept': 'application/json'
          }
        }
      );

      const statusMap = {
        'APPROVED': { approved: true, declined: false, pending: false },
        'DECLINED': { approved: false, declined: true, pending: false },
        'PENDING': { approved: false, declined: false, pending: true }
      };

      return {
        ...statusMap[response.status] || { approved: false, declined: false, pending: true },
        status: response.status,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to check Afterpay payment status: ${error.message}`);
    }
  }

  /**
   * Capture/confirm a payment (called after customer returns from Afterpay)
   * https://developers.afterpay.com/afterpay-online/reference/capture-payment
   */
  async capturePayment(token, merchantReference) {
    if (this.mockMode) {
      return {
        orderId: `afterpay_order_${Date.now()}`,
        status: 'APPROVED'
      };
    }

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v2/payments/capture`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': basicAuth(this.merchantId, this.secretKey),
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            token: token,
            merchantReference: merchantReference
          })
        }
      );

      return {
        orderId: response.id,
        status: response.status,
        paymentState: response.paymentState,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to capture Afterpay payment: ${error.message}`);
    }
  }

  /**
   * Create immediate capture checkout (auth + capture in one step)
   * https://developers.afterpay.com/afterpay-online/reference/create-order
   */
  async createImmediateCapture(token, merchantReference, amount) {
    if (this.mockMode) {
      return {
        orderId: `afterpay_order_${Date.now()}`,
        status: 'APPROVED'
      };
    }

    const amountInDollars = (amount / 100).toFixed(2);

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v2/payments/capture`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': basicAuth(this.merchantId, this.secretKey),
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            token: token,
            merchantReference: merchantReference,
            amount: {
              amount: amountInDollars,
              currency: 'USD'
            }
          })
        }
      );

      return {
        orderId: response.id,
        status: response.status,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to create Afterpay immediate capture: ${error.message}`);
    }
  }

  /**
   * Void/cancel a payment
   * https://developers.afterpay.com/afterpay-online/reference/void-payment
   */
  async cancelSession(orderId) {
    if (this.mockMode) {
      return true;
    }

    try {
      await httpRequest(
        `${this.baseUrl}/v2/payments/${orderId}/void`,
        {
          method: 'POST',
          headers: {
            'Authorization': basicAuth(this.merchantId, this.secretKey),
            'Accept': 'application/json'
          }
        }
      );
      return true;
    } catch (error) {
      console.error(`[Afterpay] Failed to void payment: ${error.message}`);
      return false;
    }
  }

  /**
   * Refund a payment
   * https://developers.afterpay.com/afterpay-online/reference/create-refund
   */
  async refundPayment(orderId, amount, merchantReference) {
    if (this.mockMode) {
      return { success: true, refundId: `refund_${Date.now()}` };
    }

    const amountInDollars = (amount / 100).toFixed(2);

    try {
      const response = await httpRequest(
        `${this.baseUrl}/v2/payments/${orderId}/refund`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': basicAuth(this.merchantId, this.secretKey),
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            amount: {
              amount: amountInDollars,
              currency: 'USD'
            },
            merchantReference: merchantReference
          })
        }
      );

      return {
        success: true,
        refundId: response.refundId,
        raw: response
      };

    } catch (error) {
      throw new Error(`Failed to refund Afterpay payment: ${error.message}`);
    }
  }

  /**
   * Mock implementation for testing without credentials
   */
  async _mockCreateSession(amount, customer, merchant) {
    await new Promise(resolve => setTimeout(resolve, 120));

    if (amount > this.approvalThreshold) {
      throw new Error('Order amount exceeds Afterpay limit');
    }

    if (amount < this.minAmount) {
      throw new Error(`Minimum order amount is $${this.minAmount/100}`);
    }

    return {
      sessionId: `afterpay_mock_token_${Date.now()}`,
      token: `afterpay_mock_token_${Date.now()}`,
      redirectUrl: `https://portal.afterpay.com/mock/checkout/${Date.now()}`,
      jsUrl: this.jsUrl,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    };
  }

  /**
   * Map Afterpay error codes to user-friendly messages
   */
  _mapAfterpayError(error) {
    const errorMap = {
      'invalid_object': 'Invalid request data',
      'unauthorized': 'Invalid Afterpay credentials',
      'invalid_token': 'Checkout session expired or invalid',
      'declined': 'Payment declined by Afterpay',
      'service_unavailable': 'Afterpay service temporarily unavailable',
      'precondition_failed': 'Amount outside allowed limits',
      'TIMEOUT': 'Afterpay request timed out'
    };

    // Check for specific error messages from Afterpay
    if (error.data?.message) {
      return error.data.message;
    }

    return errorMap[error.code] || error.message || 'Afterpay request failed';
  }
}

module.exports = AfterpayProvider;
