/**
 * Affirm BNPL Provider
 * Mock implementation for Phase 1
 */
const BNPLProvider = require('./base');

class AffirmProvider extends BNPLProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'affirm';
    this.approvalThreshold = config.approvalThreshold || 50000; // Approves under $500
  }

  async createSession(amount, customer, merchant) {
    // MOCK: Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 150));

    // MOCK: Decline if amount > threshold
    if (amount > this.approvalThreshold) {
      throw new Error('Risk assessment failed');
    }

    // MOCK: Approved
    return {
      sessionId: `affirm_session_${Date.now()}`,
      redirectUrl: `https://pay.affirm.com/mock/${Date.now()}`,
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

module.exports = AffirmProvider;
