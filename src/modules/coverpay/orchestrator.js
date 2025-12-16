/**
 * CoverPay Orchestrator
 * Intelligent BNPL routing with waterfall, split, and fractured strategies
 *
 * Strategies:
 * - waterfall: Try providers sequentially until one approves full amount
 * - split: Divide payment evenly across 2 providers
 * - fractured: MAXIMIZE approval by splitting across multiple providers
 *              e.g., $1000 = $200 Klarna + $200 Affirm + $200 Afterpay + $200 Sezzle + $200 PayPal
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
   * @param {string} strategy - 'waterfall', 'split', or 'fractured'
   * @param {string} merchantOrderId - Optional order reference
   * @param {object} fracturedOptions - Options for fractured strategy
   */
  async processCheckout({ amount, customer, merchant, strategy = 'waterfall', merchantOrderId, fracturedOptions = {} }) {
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
    } else if (strategy === 'fractured' || strategy === 'maximize') {
      result = await this.fracturedStrategy(amount, customer, merchant, transaction, fracturedOptions);
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
   * FRACTURED: Maximize approval by splitting across multiple providers
   *
   * This is the "squeeze every dollar" strategy:
   * 1. First tries waterfall (full amount from single provider)
   * 2. If declined, tries each provider with decreasing amounts
   * 3. Accumulates approvals until target amount is reached
   * 4. Returns multiple sessions for user to complete
   *
   * Example: $1000 purchase
   * - Klarna approves $200
   * - Affirm approves $250
   * - Afterpay approves $200
   * - Sezzle approves $200
   * - PayPal approves $150
   * = Total: $1000 across 5 providers ✅
   */
  async fracturedStrategy(amount, customer, merchant, transaction, options = {}) {
    const {
      minChunkSize = 3500,        // Minimum $35 per provider (most providers' min)
      maxProviders = 6,           // Max providers to use
      startingChunkPercent = 50,  // Start by trying 50% of remaining
      tryFullFirst = true         // Try full amount first before fracturing
    } = options;

    console.log(`[FRACTURED] 💎 Starting fractured strategy for $${amount / 100}`);
    console.log(`[FRACTURED] Available providers: ${this.providers.map(p => p.name).join(', ')}`);

    // Track results
    const approvedSessions = [];
    const attempts = [];
    let remainingAmount = amount;
    let attemptOrder = 0;

    // Step 1: Try full amount first (waterfall style)
    if (tryFullFirst) {
      console.log(`[FRACTURED] Phase 1: Trying full amount $${amount / 100} with each provider...`);

      for (const provider of this.providers) {
        if (remainingAmount <= 0) break;

        attemptOrder++;
        const startTime = Date.now();

        try {
          console.log(`[FRACTURED] Trying ${provider.name} for full $${amount / 100}...`);

          const session = await provider.createSession(amount, customer, merchant);
          const responseTimeMs = Date.now() - startTime;

          // Full amount approved by single provider!
          console.log(`[FRACTURED] ✅ ${provider.name} approved FULL amount!`);

          attempts.push({
            provider: provider.name,
            status: 'approved',
            amount: amount,
            responseTimeMs,
            phase: 'full'
          });

          // Log to DB
          if (this.enableLogging && transaction) {
            try {
              await transactionRepository.logAttempt({
                transactionId: transaction.id,
                provider: provider.name,
                amount: amount,
                attemptOrder,
                status: 'approved',
                providerSessionId: session.sessionId,
                providerRedirectUrl: session.redirectUrl,
                responseTimeMs,
                providerResponse: session
              });

              await transactionRepository.updateTransaction(transaction.id, {
                status: 'approved',
                finalProvider: provider.name
              });
            } catch (e) {
              console.error('[DB] Failed to log:', e.message);
            }
          }

          // Return single provider result
          return {
            success: true,
            fractured: false,
            strategy: 'fractured',
            provider: provider.name,
            sessionId: session.sessionId,
            redirectUrl: session.redirectUrl,
            amount: amount,
            sessions: [{
              provider: provider.name,
              sessionId: session.sessionId,
              redirectUrl: session.redirectUrl,
              amount: amount,
              order: 1
            }],
            totalApproved: amount,
            attempts
          };

        } catch (error) {
          const responseTimeMs = Date.now() - startTime;
          console.log(`[FRACTURED] ❌ ${provider.name} declined full amount: ${error.message}`);

          attempts.push({
            provider: provider.name,
            status: 'declined',
            amount: amount,
            reason: error.message,
            responseTimeMs,
            phase: 'full'
          });

          // Log decline
          if (this.enableLogging && transaction) {
            try {
              await transactionRepository.logAttempt({
                transactionId: transaction.id,
                provider: provider.name,
                amount: amount,
                attemptOrder,
                status: 'declined',
                errorMessage: error.message,
                responseTimeMs
              });
            } catch (e) {}
          }

          continue;
        }
      }

      console.log(`[FRACTURED] Phase 1 complete: No provider approved full amount`);
    }

    // Step 2: Fractured approach - try smaller amounts
    console.log(`[FRACTURED] Phase 2: Fracturing $${amount / 100} across providers...`);

    // Reset for fractured attempts
    const usedProviders = new Set();
    remainingAmount = amount;

    for (const provider of this.providers) {
      // Stop if we've covered the full amount
      if (remainingAmount <= 0) {
        console.log(`[FRACTURED] ✅ Full amount covered!`);
        break;
      }

      // Stop if we've used max providers
      if (approvedSessions.length >= maxProviders) {
        console.log(`[FRACTURED] Max providers (${maxProviders}) reached`);
        break;
      }

      // Skip if already used this provider
      if (usedProviders.has(provider.name)) continue;

      // Calculate chunk size - start with percentage of remaining, then decrease
      let chunkSizes = this._calculateChunkSizes(remainingAmount, startingChunkPercent, minChunkSize);

      // Try different chunk sizes for this provider
      for (const chunkAmount of chunkSizes) {
        if (chunkAmount < minChunkSize) continue;
        if (chunkAmount > remainingAmount) continue;

        attemptOrder++;
        const startTime = Date.now();

        try {
          console.log(`[FRACTURED] Trying ${provider.name} for $${chunkAmount / 100}...`);

          const session = await provider.createSession(chunkAmount, customer, merchant);
          const responseTimeMs = Date.now() - startTime;

          // Success!
          console.log(`[FRACTURED] ✅ ${provider.name} approved $${chunkAmount / 100}`);

          usedProviders.add(provider.name);
          remainingAmount -= chunkAmount;

          approvedSessions.push({
            provider: provider.name,
            sessionId: session.sessionId,
            redirectUrl: session.redirectUrl,
            amount: chunkAmount,
            order: approvedSessions.length + 1
          });

          attempts.push({
            provider: provider.name,
            status: 'approved',
            amount: chunkAmount,
            responseTimeMs,
            phase: 'fractured'
          });

          // Log to DB
          if (this.enableLogging && transaction) {
            try {
              await transactionRepository.logAttempt({
                transactionId: transaction.id,
                provider: provider.name,
                amount: chunkAmount,
                attemptOrder,
                status: 'approved',
                providerSessionId: session.sessionId,
                providerRedirectUrl: session.redirectUrl,
                responseTimeMs,
                providerResponse: session
              });
            } catch (e) {}
          }

          // Move to next provider
          break;

        } catch (error) {
          const responseTimeMs = Date.now() - startTime;
          console.log(`[FRACTURED] ❌ ${provider.name} declined $${chunkAmount / 100}: ${error.message}`);

          attempts.push({
            provider: provider.name,
            status: 'declined',
            amount: chunkAmount,
            reason: error.message,
            responseTimeMs,
            phase: 'fractured'
          });

          // Log decline
          if (this.enableLogging && transaction) {
            try {
              await transactionRepository.logAttempt({
                transactionId: transaction.id,
                provider: provider.name,
                amount: chunkAmount,
                attemptOrder,
                status: 'declined',
                errorMessage: error.message,
                responseTimeMs
              });
            } catch (e) {}
          }

          // Try smaller amount with same provider
          continue;
        }
      }
    }

    // Calculate results
    const totalApproved = approvedSessions.reduce((sum, s) => sum + s.amount, 0);
    const coveragePercent = Math.round((totalApproved / amount) * 100);

    console.log(`[FRACTURED] 📊 Results: $${totalApproved / 100} of $${amount / 100} (${coveragePercent}%)`);
    console.log(`[FRACTURED] Sessions: ${approvedSessions.length} providers`);

    // Update transaction
    if (this.enableLogging && transaction) {
      try {
        const providerList = approvedSessions.map(s => s.provider).join('+');
        await transactionRepository.updateTransaction(transaction.id, {
          status: totalApproved >= amount ? 'approved' : 'partial',
          isSplit: approvedSessions.length > 1,
          finalProvider: providerList
        });
      } catch (e) {}
    }

    // Return result
    if (approvedSessions.length === 0) {
      return {
        success: false,
        fractured: true,
        strategy: 'fractured',
        message: 'No BNPL providers approved any amount',
        totalApproved: 0,
        targetAmount: amount,
        sessions: [],
        attempts
      };
    }

    const isFullyCovered = totalApproved >= amount;

    return {
      success: isFullyCovered,
      fractured: true,
      partiallyCovered: !isFullyCovered && totalApproved > 0,
      strategy: 'fractured',
      sessions: approvedSessions,
      totalApproved,
      targetAmount: amount,
      remainingAmount: Math.max(0, amount - totalApproved),
      coveragePercent,
      providersUsed: approvedSessions.length,
      message: isFullyCovered
        ? `Full amount covered across ${approvedSessions.length} providers`
        : `Partial approval: $${totalApproved / 100} of $${amount / 100} (${coveragePercent}%)`,
      attempts
    };
  }

  /**
   * Calculate chunk sizes to try for fractured strategy
   */
  _calculateChunkSizes(remaining, startPercent, minChunk) {
    const chunks = [];

    // Try 50%, 33%, 25%, 20%, min
    const percentages = [startPercent, 33, 25, 20, 15];

    for (const pct of percentages) {
      const chunk = Math.floor(remaining * (pct / 100));
      if (chunk >= minChunk && !chunks.includes(chunk)) {
        chunks.push(chunk);
      }
    }

    // Always include minimum chunk
    if (minChunk <= remaining && !chunks.includes(minChunk)) {
      chunks.push(minChunk);
    }

    // Sort descending (try larger amounts first)
    return chunks.sort((a, b) => b - a);
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
