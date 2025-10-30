const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');
const { ExternalServiceError } = require('../utils/errors');

/**
 * Coinflow API Service
 * Handles all interactions with Coinflow payment processing
 */
class CoinflowService {
  constructor() {
    this.baseUrl = config.coinflow.baseUrl;
    this.apiKey = config.coinflow.apiKey;
    this.apiSecret = config.coinflow.apiSecret;
    this.merchantId = config.coinflow.merchantId;

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      timeout: 30000, // 30 seconds
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Coinflow API Request:', {
          method: config.method,
          url: config.url,
          data: config.data,
        });
        return config;
      },
      (error) => {
        logger.error('Coinflow API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Coinflow API Response:', {
          status: response.status,
          data: response.data,
        });
        return response;
      },
      (error) => {
        logger.error('Coinflow API Error:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });
        throw this.handleError(error);
      }
    );
  }

  /**
   * Handle Coinflow API errors
   */
  handleError(error) {
    if (error.response) {
      const { status, data } = error.response;
      const message = data.message || data.error || 'Coinflow API error';
      return new ExternalServiceError(`Coinflow: ${message}`, status);
    }

    if (error.request) {
      return new ExternalServiceError('Coinflow API not responding', 503);
    }

    return new ExternalServiceError(error.message, 500);
  }

  /**
   * Create a payment transaction
   */
  async createPayment(paymentData) {
    try {
      const response = await this.client.post('/v1/payments', {
        merchantId: this.merchantId,
        ...paymentData,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payment details by ID
   */
  async getPayment(paymentId) {
    try {
      const response = await this.client.get(`/v1/payments/${paymentId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(paymentId) {
    try {
      const response = await this.client.post(`/v1/payments/${paymentId}/cancel`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Refund a payment
   */
  async refundPayment(paymentId, amount, reason) {
    try {
      const response = await this.client.post(`/v1/payments/${paymentId}/refund`, {
        amount,
        reason,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get account balance
   */
  async getBalance(currency = 'USD') {
    try {
      const response = await this.client.get('/v1/balance', {
        params: { currency },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactions(filters = {}) {
    try {
      const response = await this.client.get('/v1/transactions', {
        params: {
          merchantId: this.merchantId,
          ...filters,
        },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get single transaction details
   */
  async getTransaction(transactionId) {
    try {
      const response = await this.client.get(`/v1/transactions/${transactionId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Initiate KYC verification
   */
  async initiateKYC(userData) {
    try {
      const response = await this.client.post('/v1/kyc/initiate', {
        merchantId: this.merchantId,
        ...userData,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get KYC status
   */
  async getKYCStatus(userId) {
    try {
      const response = await this.client.get(`/v1/kyc/status/${userId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Submit KYC documents
   */
  async submitKYCDocuments(userId, documents) {
    try {
      const response = await this.client.post(`/v1/kyc/${userId}/documents`, {
        documents,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create a payout
   */
  async createPayout(payoutData) {
    try {
      const response = await this.client.post('/v1/payouts', {
        merchantId: this.merchantId,
        ...payoutData,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payout details
   */
  async getPayout(payoutId) {
    try {
      const response = await this.client.get(`/v1/payouts/${payoutId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return signature === expectedSignature;
  }
}

// Export singleton instance
module.exports = new CoinflowService();
