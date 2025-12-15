/**
 * Base BNPL Provider Class
 * All BNPL providers must extend this class
 */
class BNPLProvider {
  constructor(config) {
    this.name = 'base';
    this.config = config;
  }

  /**
   * Create a BNPL session with the provider
   * @param {number} amount - Amount in cents
   * @param {object} customer - Customer info {email, phone, name}
   * @param {object} merchant - Merchant config {returnUrl, webhookUrl}
   * @returns {Promise<{sessionId: string, redirectUrl: string, status: string}>}
   */
  async createSession(amount, customer, merchant) {
    throw new Error('createSession must be implemented by provider');
  }

  /**
   * Check the status of a BNPL session
   * @param {string} sessionId - Provider's session ID
   * @returns {Promise<{approved: boolean, declined: boolean, pending: boolean}>}
   */
  async checkStatus(sessionId) {
    throw new Error('checkStatus must be implemented by provider');
  }

  /**
   * Cancel/void a BNPL session
   * @param {string} sessionId - Provider's session ID
   * @returns {Promise<boolean>}
   */
  async cancelSession(sessionId) {
    throw new Error('cancelSession must be implemented by provider');
  }
}

module.exports = BNPLProvider;
