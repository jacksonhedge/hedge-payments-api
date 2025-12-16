/**
 * Prequalification Repository for CoverPay (B2B Model)
 *
 * Handles caching of user eligibility across BNPL providers.
 * Caches results to reduce API calls and improve response times.
 *
 * All operations are scoped to a merchant_id for B2B isolation.
 * Cache key is (merchant_id, user_hash) - unique per merchant per user.
 */
const { supabase } = require('./supabase');
const crypto = require('crypto');

// Cache TTLs (in minutes)
const ELIGIBLE_CACHE_TTL = 15;  // 15 minutes for eligible users
const DECLINED_CACHE_TTL = 5;   // 5 minutes for declined users

class PrequalificationRepository {
  /**
   * Get cached prequalification by merchant + user hash
   * @param {string} merchantId - Required merchant ID
   * @param {string} userHash - SHA256 hash of email+phone
   */
  async getCached(merchantId, userHash) {
    if (!merchantId) {
      throw new Error('merchantId is required');
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('prequalification_cache')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('user_hash', userHash)
      .gt('expires_at', now)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('[DB] Failed to get prequalification cache:', error);
      throw error;
    }

    return this._mapToResponse(data);
  }

  /**
   * Get cached prequalification by merchant + customer ID
   */
  async getCachedByCustomerId(merchantId, customerId) {
    if (!merchantId) {
      throw new Error('merchantId is required');
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('prequalification_cache')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('customer_id', customerId)
      .gt('expires_at', now)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[DB] Failed to get prequalification cache:', error);
      throw error;
    }

    return this._mapToResponse(data);
  }

  /**
   * Save prequalification result to cache
   * @param {string} merchantId - Required merchant ID
   */
  async saveCache({
    merchantId,
    customerId,
    userHash,
    eligibility,
    totalBnplCapacity,
    eligibleProviders,
    amountRequested,
    metadata = {}
  }) {
    if (!merchantId) {
      throw new Error('merchantId is required');
    }

    // Calculate expiry based on whether user is eligible anywhere
    const hasEligibility = eligibleProviders.length > 0;
    const ttlMinutes = hasEligibility ? ELIGIBLE_CACHE_TTL : DECLINED_CACHE_TTL;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    // Upsert (update if exists, insert if not)
    // Unique constraint is on (merchant_id, user_hash)
    const { data, error } = await supabase
      .from('prequalification_cache')
      .upsert({
        merchant_id: merchantId,
        customer_id: customerId,
        user_hash: userHash,
        eligibility,
        total_bnpl_capacity: totalBnplCapacity,
        eligible_provider_count: eligibleProviders.length,
        eligible_providers: eligibleProviders,
        amount_requested: amountRequested,
        cached_at: new Date().toISOString(),
        expires_at: expiresAt,
        metadata
      }, {
        onConflict: 'merchant_id,user_hash'
      })
      .select()
      .single();

    if (error) {
      console.error('[DB] Failed to save prequalification cache:', error);
      throw error;
    }

    return this._mapToResponse(data);
  }

  /**
   * Invalidate cache for a specific user in a merchant
   */
  async invalidateCache(merchantId, userHash) {
    if (!merchantId) {
      throw new Error('merchantId is required');
    }

    const { error } = await supabase
      .from('prequalification_cache')
      .delete()
      .eq('merchant_id', merchantId)
      .eq('user_hash', userHash);

    if (error) {
      console.error('[DB] Failed to invalidate cache:', error);
      throw error;
    }

    return true;
  }

  /**
   * Invalidate cache by customer ID
   */
  async invalidateCacheByCustomerId(merchantId, customerId) {
    if (!merchantId) {
      throw new Error('merchantId is required');
    }

    const { error } = await supabase
      .from('prequalification_cache')
      .delete()
      .eq('merchant_id', merchantId)
      .eq('customer_id', customerId);

    if (error) {
      console.error('[DB] Failed to invalidate cache:', error);
      throw error;
    }

    return true;
  }

  /**
   * Clean up expired cache entries (background job)
   */
  async cleanupExpired() {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('prequalification_cache')
      .delete()
      .lt('expires_at', now)
      .select('id');

    if (error) {
      console.error('[DB] Failed to cleanup expired cache:', error);
      throw error;
    }

    return data?.length || 0;
  }

  /**
   * Generate user hash from customer info
   * Used for anonymous/guest users or as cache key
   */
  generateUserHash(email, phone) {
    const normalized = `${(email || '').toLowerCase().trim()}:${(phone || '').replace(/\D/g, '')}`;
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Get cache stats for a merchant
   */
  async getCacheStats(merchantId) {
    const now = new Date().toISOString();

    let query = supabase
      .from('prequalification_cache')
      .select('expires_at, eligible_provider_count, merchant_id');

    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const stats = {
      total: data.length,
      active: 0,
      expired: 0,
      withEligibility: 0,
      withoutEligibility: 0
    };

    data.forEach(entry => {
      if (entry.expires_at > now) {
        stats.active++;
      } else {
        stats.expired++;
      }

      if (entry.eligible_provider_count > 0) {
        stats.withEligibility++;
      } else {
        stats.withoutEligibility++;
      }
    });

    return stats;
  }

  /**
   * Get all prequalifications for a merchant (admin/analytics)
   */
  async getMerchantPrequalifications(merchantId, options = {}) {
    const { limit = 100, offset = 0, eligibleOnly = false } = options;
    const now = new Date().toISOString();

    let query = supabase
      .from('prequalification_cache')
      .select('*', { count: 'exact' })
      .eq('merchant_id', merchantId)
      .gt('expires_at', now)
      .order('cached_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (eligibleOnly) {
      query = query.gt('eligible_provider_count', 0);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[DB] Failed to get merchant prequalifications:', error);
      throw error;
    }

    return {
      prequalifications: data.map(d => this._mapToResponse(d)),
      total: count
    };
  }

  /**
   * Map database fields to response format
   */
  _mapToResponse(data) {
    if (!data) return null;

    // Parse eligibility into structured format for iOS
    const eligibility = data.eligibility || {};
    const eligibleProviders = [];
    const ineligibleProviders = [];

    Object.entries(eligibility).forEach(([provider, info]) => {
      const entry = {
        provider,
        eligible: info.eligible || false,
        maxAmount: info.limit || info.max || 0,
        reason: info.reason || null
      };

      if (entry.eligible) {
        eligibleProviders.push(entry);
      } else {
        ineligibleProviders.push(entry);
      }
    });

    return {
      id: data.id,
      merchantId: data.merchant_id,
      customerId: data.customer_id,
      userHash: data.user_hash,
      eligibility: data.eligibility,
      totalBnplCapacity: data.total_bnpl_capacity,
      eligibleProviderCount: data.eligible_provider_count,
      eligibleProviders,
      ineligibleProviders,
      amountRequested: data.amount_requested,
      cachedAt: data.cached_at,
      expiresAt: data.expires_at,
      cacheHit: true,
      metadata: data.metadata
    };
  }
}

module.exports = new PrequalificationRepository();
