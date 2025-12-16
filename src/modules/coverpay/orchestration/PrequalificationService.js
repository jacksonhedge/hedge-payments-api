/**
 * PrequalificationService (B2B Model)
 *
 * Checks user eligibility across all BNPL providers BEFORE checkout.
 * Returns total BNPL capacity so user knows how much they can spend.
 *
 * Features:
 * - Parallel eligibility checks across all providers
 * - Caching with 15-min TTL (eligible) / 5-min TTL (declined)
 * - Returns aggregated capacity and per-provider limits
 * - Merchant-scoped caching for B2B isolation
 */
const { prequalificationRepository } = require('../db');

class PrequalificationService {
  constructor(providers = []) {
    this.providers = providers;
  }

  /**
   * Check eligibility across all providers
   *
   * @param {object} options - Check options
   * @param {string} options.merchantId - Required merchant ID
   * @param {object} options.customer - Customer info (email, phone, name, address)
   * @param {number} options.amount - Optional specific amount to check
   * @param {boolean} options.forceRefresh - Bypass cache
   * @returns {object} Eligibility result with total capacity and per-provider limits
   */
  async checkEligibility({ merchantId, customer, amount = null, forceRefresh = false }) {
    if (!merchantId) {
      throw new Error('merchantId is required for prequalification');
    }

    const userHash = prequalificationRepository.generateUserHash(
      customer.email,
      customer.phone
    );

    // Check cache first (merchant-scoped)
    if (!forceRefresh) {
      const cached = await prequalificationRepository.getCached(merchantId, userHash);
      if (cached) {
        console.log(`[Prequal] Cache HIT for ${customer.email} (merchant: ${merchantId})`);
        return {
          ...cached,
          cacheHit: true
        };
      }
    }

    console.log(`[Prequal] Checking eligibility for ${customer.email} across ${this.providers.length} providers...`);

    // Check all providers in parallel
    const startTime = Date.now();
    const eligibilityResults = await Promise.all(
      this.providers.map(provider => this._checkProvider(provider, customer, amount))
    );

    const responseTimeMs = Date.now() - startTime;
    console.log(`[Prequal] Completed in ${responseTimeMs}ms`);

    // Build eligibility map
    const eligibility = {};
    const eligibleProviders = [];
    let totalCapacity = 0;

    eligibilityResults.forEach(result => {
      eligibility[result.provider] = {
        eligible: result.eligible,
        limit: result.limit || 0,
        min: result.minAmount || 0,
        max: result.maxAmount || 0,
        reason: result.reason || null
      };

      if (result.eligible) {
        eligibleProviders.push(result.provider);
        totalCapacity += result.limit || 0;
      }
    });

    // Save to cache (merchant-scoped)
    const cached = await prequalificationRepository.saveCache({
      merchantId,
      customerId: customer.userId || customer.customerId || null,
      userHash,
      eligibility,
      totalBnplCapacity: totalCapacity,
      eligibleProviders,
      amountRequested: amount,
      metadata: { responseTimeMs }
    });

    // Build response
    const response = {
      totalBnplCapacity: totalCapacity,
      eligibleProviders: eligibleProviders.map(name => ({
        provider: name,
        eligible: true,
        maxAmount: eligibility[name].limit,
        ...eligibility[name]
      })),
      ineligibleProviders: Object.entries(eligibility)
        .filter(([_, data]) => !data.eligible)
        .map(([name, data]) => ({
          provider: name,
          eligible: false,
          reason: data.reason
        })),
      expiresAt: cached.expiresAt,
      cacheHit: false,
      responseTimeMs
    };

    console.log(`[Prequal] Total BNPL capacity: $${totalCapacity / 100} across ${eligibleProviders.length} providers`);

    return response;
  }

  /**
   * Check eligibility with a specific provider
   */
  async _checkProvider(provider, customer, amount) {
    try {
      // Check if provider has a prequalify method
      if (typeof provider.prequalify === 'function') {
        const result = await provider.prequalify(customer, amount);
        return {
          provider: provider.name,
          eligible: result.eligible,
          limit: result.limit || result.approvedAmount,
          minAmount: result.minAmount || provider.minAmount,
          maxAmount: result.maxAmount || provider.maxAmount,
          reason: result.reason
        };
      }

      // Fallback: Use provider's min/max amounts and assume eligible
      // Most providers don't have a true prequalification API
      // We use amount limits as proxy for eligibility
      const limit = this._getProviderLimit(provider, customer);

      return {
        provider: provider.name,
        eligible: limit > 0,
        limit,
        minAmount: provider.minAmount || 3500,  // Default $35 min
        maxAmount: provider.maxAmount || 200000, // Default $2000 max
        reason: limit > 0 ? null : 'Provider not available'
      };

    } catch (error) {
      console.log(`[Prequal] ${provider.name} check failed: ${error.message}`);
      return {
        provider: provider.name,
        eligible: false,
        limit: 0,
        reason: error.message
      };
    }
  }

  /**
   * Get estimated limit for a provider based on known limits
   */
  _getProviderLimit(provider, customer) {
    // Provider-specific known limits (conservative estimates)
    const providerLimits = {
      'klarna': 100000,       // $1000 - varies by user
      'affirm': 200000,       // $2000 - can go up to $17,500
      'afterpay': 200000,     // $2000 - standard limit
      'sezzle': 250000,       // $2500 - varies
      'zip': 150000,          // $1500 - varies
      'paypal': 150000,       // $1500 - Pay in 4 limit
      'stripe_bnpl': 200000   // $2000 - varies by method
    };

    // If provider is in mock mode, use approval threshold
    if (provider.mockMode && provider.approvalThreshold) {
      return provider.approvalThreshold;
    }

    return providerLimits[provider.name] || provider.maxAmount || 100000;
  }

  /**
   * Get cached eligibility (for quick lookups)
   *
   * @param {object} options - Lookup options
   * @param {string} options.merchantId - Required merchant ID
   * @param {string} options.customerId - Customer ID (optional)
   * @param {string} options.email - Customer email (optional)
   * @param {string} options.phone - Customer phone (optional)
   */
  async getCachedEligibility({ merchantId, customerId, email, phone }) {
    if (!merchantId) {
      throw new Error('merchantId is required');
    }

    // Try by customerId first
    if (customerId) {
      return prequalificationRepository.getCachedByCustomerId(merchantId, customerId);
    }

    // Fall back to userHash
    if (email || phone) {
      const userHash = prequalificationRepository.generateUserHash(email, phone);
      return prequalificationRepository.getCached(merchantId, userHash);
    }

    return null;
  }

  /**
   * Invalidate cache for a user
   *
   * @param {string} merchantId - Required merchant ID
   * @param {object} customer - Customer info with email and phone
   */
  async invalidateCache(merchantId, customer) {
    if (!merchantId) {
      throw new Error('merchantId is required');
    }

    const userHash = prequalificationRepository.generateUserHash(
      customer.email,
      customer.phone
    );
    return prequalificationRepository.invalidateCache(merchantId, userHash);
  }

  /**
   * Get providers that can handle a specific amount
   */
  getProvidersForAmount(eligibility, amount) {
    return eligibility.eligibleProviders.filter(p =>
      p.min <= amount && p.max >= amount
    );
  }

  /**
   * Calculate optimal fractured split for an amount
   * Returns recommended provider distribution
   */
  calculateFracturedSplit(eligibility, targetAmount) {
    const providers = eligibility.eligibleProviders
      .sort((a, b) => b.limit - a.limit); // Sort by limit descending

    const split = [];
    let remaining = targetAmount;

    for (const provider of providers) {
      if (remaining <= 0) break;

      // Use up to provider's limit
      const amount = Math.min(remaining, provider.limit);

      // Ensure amount is within provider's min/max
      if (amount >= provider.min && amount <= provider.max) {
        split.push({
          provider: provider.provider,
          amount,
          percentOfTotal: Math.round((amount / targetAmount) * 100)
        });
        remaining -= amount;
      }
    }

    return {
      canCover: remaining <= 0,
      targetAmount,
      coveredAmount: targetAmount - remaining,
      remainingAmount: remaining,
      coveragePercent: Math.round(((targetAmount - remaining) / targetAmount) * 100),
      split,
      providersNeeded: split.length
    };
  }
}

module.exports = PrequalificationService;
