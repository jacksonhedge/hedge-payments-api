/**
 * Klarna BNPL Provider
 * Mock implementation for Phase 1
 */
const BNPLProvider = require('./base');

class KlarnaProvider extends BNPLProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'klarna';
    this.approvalThreshold = config.approvalThreshold || 20000; // Approves under $200
  }

  async createSession(amount, customer, merchant) {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // MOCK: Decline if amount > threshold
    if (amount > this.approvalThreshold) {
      throw new Error('Amount exceeds credit limit');
    }

    // MOCK: Approved
    return {
      sessionId: `klarna_session_${Date.now()}`,
      redirectUrl: `https://pay.klarna.com/mock/${Date.now()}`,
      status: 'pending'
    };
  }

  async checkStatus(sessionId) {
    return { approved: true, declined: false, pending: false };
  }

  async cancelSession(sessionId) {
    return true;
  }
}

module.exports = KlarnaProvider;
