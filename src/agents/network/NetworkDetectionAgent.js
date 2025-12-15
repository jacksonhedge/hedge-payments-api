const Agent = require('../base/Agent');
const logger = require('../../utils/logger');

/**
 * Network Detection Agent
 *
 * Detects if payment parties are in the Hedge/Bankroll network
 * This is the foundational agent that enables internal vs external routing
 */
class NetworkDetectionAgent extends Agent {
  constructor(config) {
    super({
      name: 'NetworkDetectionAgent',
      type: 'network_detection',
      team: 'NetworkOperations',
      ...config
    });

    // Cache for network lookups (5 minute TTL)
    this.cache = new Map();
    this.cacheTTL = config.cacheTTL || 300000; // 5 minutes

    logger.info('NetworkDetectionAgent initialized');
  }

  /**
   * Perform task - identify if party is in network
   */
  async performTask(task) {
    const { identifier, type } = task.data;

    switch (task.type) {
      case 'identify_party':
        return await this.identifyParty(identifier);

      case 'check_merchant':
        return await this.checkMerchantIntegration(identifier);

      case 'batch_identify':
        return await this.batchIdentify(task.data.identifiers);

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Identify if a party is in the network
   */
  async identifyParty(identifier) {
    // Check cache first
    const cached = this.getCached(identifier);
    if (cached) {
      this.log('debug', 'Network detection - cache hit', { identifier });
      return cached;
    }

    this.log('info', 'Identifying party', { identifier });

    let party = null;

    // Try different identification methods
    if (this.isEmail(identifier)) {
      party = await this.identifyByEmail(identifier);
    } else if (this.isPhone(identifier)) {
      party = await this.identifyByPhone(identifier);
    } else if (this.isUsername(identifier)) {
      party = await this.identifyByUsername(identifier);
    } else if (this.isMerchantId(identifier)) {
      party = await this.identifyByMerchantId(identifier);
    } else if (this.isDomain(identifier)) {
      party = await this.identifyByDomain(identifier);
    } else if (this.isWalletAddress(identifier)) {
      party = await this.identifyByWallet(identifier);
    }

    // Build response
    const result = party ? {
      type: party.type, // 'bankroll_user' | 'hedge_merchant' | 'external'
      id: party.id,
      inNetwork: true,
      walletId: party.walletId,
      displayName: party.displayName,
      verificationStatus: party.kycStatus || 'unverified',
      metadata: {
        createdAt: party.createdAt,
        lastActive: party.lastActive,
        transactionCount: party.transactionCount || 0
      }
    } : {
      type: 'external',
      id: identifier,
      inNetwork: false,
      displayName: identifier
    };

    // Cache the result
    this.setCached(identifier, result);

    // Emit event
    this.emitEvent('network:party_detected', {
      identifier,
      inNetwork: result.inNetwork,
      partyType: result.type
    });

    return result;
  }

  /**
   * Check if merchant has Hedge Payments integration
   */
  async checkMerchantIntegration(domain) {
    const cached = this.getCached(`merchant:${domain}`);
    if (cached) return cached;

    this.log('info', 'Checking merchant integration', { domain });

    // TODO: Replace with actual database query
    // For now, mock with placeholder
    const merchant = await this.queryMerchantByDomain(domain);

    const result = {
      domain,
      integrated: !!merchant,
      merchantId: merchant?.id || null,
      name: merchant?.name || domain,
      acceptsBankroll: merchant?.acceptsBankroll || false,
      metadata: merchant || null
    };

    this.setCached(`merchant:${domain}`, result);

    return result;
  }

  /**
   * Batch identify multiple parties
   */
  async batchIdentify(identifiers) {
    this.log('info', 'Batch identifying parties', { count: identifiers.length });

    const results = await Promise.all(
      identifiers.map(id => this.identifyParty(id))
    );

    const summary = {
      total: results.length,
      inNetwork: results.filter(r => r.inNetwork).length,
      external: results.filter(r => !r.inNetwork).length,
      bankrollUsers: results.filter(r => r.type === 'bankroll_user').length,
      hedgeMerchants: results.filter(r => r.type === 'hedge_merchant').length
    };

    return {
      results,
      summary
    };
  }

  // ============================================
  // Identification Methods (Database Queries)
  // ============================================

  async identifyByEmail(email) {
    // TODO: Actual database query
    // const user = await db('users').where({ email }).first()

    // Mock for now
    return null;
  }

  async identifyByPhone(phone) {
    // TODO: Actual database query
    // const user = await db('users').where({ phone }).first()

    return null;
  }

  async identifyByUsername(username) {
    // TODO: Actual database query
    // Remove @ if present
    const cleanUsername = username.replace('@', '');
    // const user = await db('users').where({ username: cleanUsername }).first()

    return null;
  }

  async identifyByMerchantId(merchantId) {
    // TODO: Actual database query
    // const merchant = await db('merchants').where({ id: merchantId }).first()

    return null;
  }

  async identifyByDomain(domain) {
    // TODO: Actual database query
    // const merchant = await db('merchants').where({ domain }).first()

    return null;
  }

  async identifyByWallet(walletAddress) {
    // TODO: Actual database query
    // const wallet = await db('wallets').where({ address: walletAddress }).first()

    return null;
  }

  async queryMerchantByDomain(domain) {
    // TODO: Actual database query
    // const merchant = await db('merchants')
    //   .where({ domain })
    //   .where({ uses_hedge_payments: true })
    //   .first()

    return null;
  }

  // ============================================
  // Validation Helpers
  // ============================================

  isEmail(str) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  }

  isPhone(str) {
    // Remove formatting
    const cleaned = str.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  }

  isUsername(str) {
    // Starts with @ or alphanumeric
    return /^@?[a-zA-Z0-9_]{3,30}$/.test(str);
  }

  isMerchantId(str) {
    return /^merchant_[a-zA-Z0-9]+$/.test(str);
  }

  isDomain(str) {
    return /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(str);
  }

  isWalletAddress(str) {
    // Solana wallet (32-44 alphanumeric characters)
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(str);
  }

  // ============================================
  // Cache Management
  // ============================================

  getCached(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  setCached(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });

    // Limit cache size
    if (this.cache.size > 10000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  clearCache() {
    this.cache.clear();
    this.log('info', 'Cache cleared');
  }

  // ============================================
  // Network Intelligence
  // ============================================

  /**
   * Suggest if a party should be recruited to network
   */
  async suggestNetworkRecruitment(identifier) {
    const party = await this.identifyParty(identifier);

    if (party.inNetwork) {
      return {
        shouldRecruit: false,
        reason: 'Already in network'
      };
    }

    // TODO: Analyze if this party would be valuable to recruit
    // - High transaction volume with network parties
    // - Frequently transacting with specific user/merchant
    // - etc.

    return {
      shouldRecruit: true,
      reason: 'External party - recruitment opportunity',
      potentialValue: 'unknown'
    };
  }

  /**
   * Get network statistics
   */
  getNetworkStats() {
    // TODO: Query actual database statistics
    return {
      totalBankrollUsers: 0,
      totalHedgeMerchants: 0,
      totalWallets: 0,
      cacheSize: this.cache.size,
      cacheTTL: this.cacheTTL
    };
  }
}

module.exports = NetworkDetectionAgent;
