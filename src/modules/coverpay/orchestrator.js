/**
 * CoverPay Orchestrator
 * Intelligent BNPL routing with waterfall and split strategies
 */
class CoverPayOrchestrator {
  constructor(providers = []) {
    this.providers = providers;
  }

  /**
   * Main entry point - process a BNPL checkout
   * @param {number} amount - Amount in cents
   * @param {object} customer - Customer info
   * @param {object} merchant - Merchant config
   * @param {string} strategy - 'waterfall' or 'split'
   */
  async processCheckout({ amount, customer, merchant, strategy = 'waterfall' }) {
    if (strategy === 'waterfall') {
      return this.waterfallStrategy(amount, customer, merchant);
    } else if (strategy === 'split') {
      return this.splitStrategy(amount, customer, merchant);
    } else {
      throw new Error(`Unknown strategy: ${strategy}`);
    }
  }

  /**
   * WATERFALL: Try providers sequentially until one approves
   */
  async waterfallStrategy(amount, customer, merchant) {
    const attempts = [];

    for (const provider of this.providers) {
      try {
        console.log(`[WATERFALL] Trying ${provider.name} for $${amount / 100}...`);

        const session = await provider.createSession(amount, customer, merchant);

        attempts.push({
          provider: provider.name,
          status: 'approved',
          amount
        });

        console.log(`[WATERFALL] ✅ ${provider.name} APPROVED`);

        // SUCCESS - return immediately
        return {
          success: true,
          provider: provider.name,
          sessionId: session.sessionId,
          redirectUrl: session.redirectUrl,
          strategy: 'waterfall',
          attempts
        };

      } catch (error) {
        // DECLINED - log and try next provider
        console.log(`[WATERFALL] ❌ ${provider.name} DECLINED: ${error.message}`);

        attempts.push({
          provider: provider.name,
          status: 'declined',
          reason: error.message
        });

        continue;
      }
    }

    // ALL PROVIDERS DECLINED
    console.log('[WATERFALL] 🚫 All providers declined');

    return {
      success: false,
      message: 'No BNPL provider approved this transaction',
      strategy: 'waterfall',
      attempts
    };
  }

  /**
   * SPLIT: Divide payment across 2 providers
   */
  async splitStrategy(amount, customer, merchant) {
    if (this.providers.length < 2) {
      console.log('[SPLIT] Not enough providers, falling back to waterfall');
      return this.waterfallStrategy(amount, customer, merchant);
    }

    const splitAmount = Math.floor(amount / 2);
    const provider1 = this.providers[0];
    const provider2 = this.providers[1];

    console.log(`[SPLIT] Trying ${provider1.name} ($${splitAmount/100}) + ${provider2.name} ($${splitAmount/100})`);

    try {
      // Try both providers in parallel
      const [session1, session2] = await Promise.all([
        provider1.createSession(splitAmount, customer, merchant),
        provider2.createSession(splitAmount, customer, merchant)
      ]);

      console.log(`[SPLIT] ✅ Both approved!`);

      return {
        success: true,
        split: true,
        strategy: 'split',
        sessions: [
          {
            provider: provider1.name,
            sessionId: session1.sessionId,
            redirectUrl: session1.redirectUrl,
            amount: splitAmount,
            order: 1
          },
          {
            provider: provider2.name,
            sessionId: session2.sessionId,
            redirectUrl: session2.redirectUrl,
            amount: splitAmount,
            order: 2
          }
        ],
        totalAmount: amount
      };

    } catch (error) {
      console.log(`[SPLIT] ❌ Split failed: ${error.message}, falling back to waterfall`);
      // If split fails, fallback to waterfall
      return this.waterfallStrategy(amount, customer, merchant);
    }
  }
}

module.exports = CoverPayOrchestrator;
