/**
 * CoverPay Orchestrator
 * Intelligent BNPL routing with waterfall and split strategies
 */
const transactionRepository = require('./db/transactionRepository');

class CoverPayOrchestrator {
  constructor(providers = [], options = {}) {
    this.providers = providers;
    this.enableLogging = options.enableLogging !== false; // Default: true
    this.merchantId = options.merchantId || 'default';
  }

  /**
   * Main entry point - process a BNPL checkout
   * @param {number} amount - Amount in cents
   * @param {object} customer - Customer info
   * @param {object} merchant - Merchant config
   * @param {string} strategy - 'waterfall' or 'split'
   * @param {string} merchantOrderId - Optional order reference
   */
  async processCheckout({ amount, customer, merchant, strategy = 'waterfall', merchantOrderId }) {
    let transaction = null;

    // Create transaction record
    if (this.enableLogging) {
      try {
        transaction = await transactionRepository.createTransaction({
          merchantId: this.merchantId,
          merchantOrderId: merchantOrderId || `order_${Date.now()}`,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          customerName: customer.name || `${customer.firstName} ${customer.lastName}`,
          amount,
          currency: 'USD',
          strategy,
          metadata: { merchant }
        });
        console.log(`[DB] Created transaction ${transaction.id}`);
      } catch (error) {
        console.error('[DB] Failed to create transaction:', error.message);
        // Continue without logging - don't block the checkout
      }
    }

    let result;
    if (strategy === 'waterfall') {
      result = await this.waterfallStrategy(amount, customer, merchant, transaction);
    } else if (strategy === 'split') {
      result = await this.splitStrategy(amount, customer, merchant, transaction);
    } else {
      throw new Error(`Unknown strategy: ${strategy}`);
    }

    // Add transaction ID to result
    if (transaction) {
      result.transactionId = transaction.id;
    }

    return result;
  }

  /**
   * WATERFALL: Try providers sequentially until one approves
   */
  async waterfallStrategy(amount, customer, merchant, transaction) {
    const attempts = [];
    let attemptOrder = 0;

    for (const provider of this.providers) {
      attemptOrder++;
      const startTime = Date.now();

      try {
        console.log(`[WATERFALL] Trying ${provider.name} for $${amount / 100}...`);

        const session = await provider.createSession(amount, customer, merchant);
        const responseTimeMs = Date.now() - startTime;

        // Log successful attempt
        if (this.enableLogging && transaction) {
          try {
            await transactionRepository.logAttempt({
              transactionId: transaction.id,
              provider: provider.name,
              amount,
              attemptOrder,
              status: 'approved',
              providerSessionId: session.sessionId,
              providerRedirectUrl: session.redirectUrl,
              responseTimeMs,
              providerResponse: session
            });
          } catch (error) {
            console.error('[DB] Failed to log attempt:', error.message);
          }
        }

        attempts.push({
          provider: provider.name,
          status: 'approved',
          amount,
          responseTimeMs
        });

        console.log(`[WATERFALL] ✅ ${provider.name} APPROVED`);

        // Update transaction status
        if (this.enableLogging && transaction) {
          try {
            await transactionRepository.updateTransaction(transaction.id, {
              status: 'approved',
              finalProvider: provider.name,
              redirectUrl: session.redirectUrl
            });
          } catch (error) {
            console.error('[DB] Failed to update transaction:', error.message);
          }
        }

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
        const responseTimeMs = Date.now() - startTime;

        // Log declined attempt
        if (this.enableLogging && transaction) {
          try {
            await transactionRepository.logAttempt({
              transactionId: transaction.id,
              provider: provider.name,
              amount,
              attemptOrder,
              status: 'declined',
              errorMessage: error.message,
              errorCode: error.code,
              responseTimeMs,
              providerResponse: error.details || {}
            });
          } catch (dbError) {
            console.error('[DB] Failed to log attempt:', dbError.message);
          }
        }

        // DECLINED - log and try next provider
        console.log(`[WATERFALL] ❌ ${provider.name} DECLINED: ${error.message}`);

        attempts.push({
          provider: provider.name,
          status: 'declined',
          reason: error.message,
          responseTimeMs
        });

        continue;
      }
    }

    // ALL PROVIDERS DECLINED
    console.log('[WATERFALL] 🚫 All providers declined');

    // Update transaction as declined
    if (this.enableLogging && transaction) {
      try {
        await transactionRepository.updateTransaction(transaction.id, {
          status: 'declined'
        });
      } catch (error) {
        console.error('[DB] Failed to update transaction:', error.message);
      }
    }

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
  async splitStrategy(amount, customer, merchant, transaction) {
    if (this.providers.length < 2) {
      console.log('[SPLIT] Not enough providers, falling back to waterfall');
      return this.waterfallStrategy(amount, customer, merchant, transaction);
    }

    const splitAmount = Math.floor(amount / 2);
    const provider1 = this.providers[0];
    const provider2 = this.providers[1];

    console.log(`[SPLIT] Trying ${provider1.name} ($${splitAmount/100}) + ${provider2.name} ($${splitAmount/100})`);

    const startTime = Date.now();

    try {
      // Try both providers in parallel
      const [session1, session2] = await Promise.all([
        provider1.createSession(splitAmount, customer, merchant),
        provider2.createSession(splitAmount, customer, merchant)
      ]);

      const responseTimeMs = Date.now() - startTime;

      console.log(`[SPLIT] ✅ Both approved!`);

      // Log both successful attempts
      if (this.enableLogging && transaction) {
        try {
          await Promise.all([
            transactionRepository.logAttempt({
              transactionId: transaction.id,
              provider: provider1.name,
              amount: splitAmount,
              attemptOrder: 1,
              status: 'approved',
              providerSessionId: session1.sessionId,
              providerRedirectUrl: session1.redirectUrl,
              responseTimeMs,
              providerResponse: session1
            }),
            transactionRepository.logAttempt({
              transactionId: transaction.id,
              provider: provider2.name,
              amount: splitAmount,
              attemptOrder: 2,
              status: 'approved',
              providerSessionId: session2.sessionId,
              providerRedirectUrl: session2.redirectUrl,
              responseTimeMs,
              providerResponse: session2
            })
          ]);

          // Update transaction
          await transactionRepository.updateTransaction(transaction.id, {
            status: 'approved',
            isSplit: true,
            finalProvider: `${provider1.name}+${provider2.name}`
          });
        } catch (error) {
          console.error('[DB] Failed to log split attempts:', error.message);
        }
      }

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
      return this.waterfallStrategy(amount, customer, merchant, transaction);
    }
  }

  /**
   * Get analytics for this merchant
   */
  async getAnalytics(options = {}) {
    return transactionRepository.getAnalytics(this.merchantId, options);
  }

  /**
   * Get provider performance stats
   */
  async getProviderStats(days = 30) {
    return transactionRepository.getProviderStats(this.merchantId, days);
  }
}

module.exports = CoverPayOrchestrator;
