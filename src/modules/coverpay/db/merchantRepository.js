/**
 * Merchant Repository for Hedge Payments
 *
 * Handles database operations for B2B merchant accounts.
 * Merchants are businesses using Hedge Payments APIs (e.g., Bankroll).
 */
const { supabase } = require('./supabase');
const crypto = require('crypto');

class MerchantRepository {
  /**
   * Get merchant by API key (used for authentication)
   * @param {string} apiKey - The public API key (pk_live_xxx or pk_test_xxx)
   */
  async getByApiKey(apiKey) {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('api_key', apiKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('[DB] Failed to get merchant by API key:', error);
      throw error;
    }

    return this._mapToResponse(data, false); // Don't include secret
  }

  /**
   * Get merchant by ID
   */
  async getById(merchantId) {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', merchantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[DB] Failed to get merchant:', error);
      throw error;
    }

    return this._mapToResponse(data, false);
  }

  /**
   * Get merchant by slug
   */
  async getBySlug(slug) {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[DB] Failed to get merchant by slug:', error);
      throw error;
    }

    return this._mapToResponse(data, false);
  }

  /**
   * Verify API key and secret combination
   * Used for sensitive operations requiring secret key
   */
  async verifyApiSecret(apiKey, apiSecret) {
    const { data, error } = await supabase
      .from('merchants')
      .select('id, api_key, api_secret, status')
      .eq('api_key', apiKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return { valid: false, reason: 'merchant_not_found' };
      throw error;
    }

    if (data.api_secret !== apiSecret) {
      return { valid: false, reason: 'invalid_secret' };
    }

    if (data.status !== 'active') {
      return { valid: false, reason: 'merchant_inactive', status: data.status };
    }

    return { valid: true, merchantId: data.id };
  }

  /**
   * Create a new merchant
   */
  async create({
    name,
    slug,
    email,
    environment = 'sandbox',
    webhookUrl,
    coverpayEnabled = true,
    coinflowEnabled = false,
    metadata = {}
  }) {
    // Generate API keys
    const prefix = environment === 'production' ? 'live' : 'test';
    const apiKey = `pk_${prefix}_${slug}_${this._generateRandomKey(16)}`;
    const apiSecret = `sk_${prefix}_${slug}_${this._generateRandomKey(24)}`;
    const webhookSecret = `whsec_${this._generateRandomKey(32)}`;

    const { data, error } = await supabase
      .from('merchants')
      .insert({
        name,
        slug,
        email,
        api_key: apiKey,
        api_secret: apiSecret,
        environment,
        webhook_url: webhookUrl,
        webhook_secret: webhookSecret,
        coverpay_enabled: coverpayEnabled,
        coinflow_enabled: coinflowEnabled,
        status: 'active',
        metadata
      })
      .select()
      .single();

    if (error) {
      console.error('[DB] Failed to create merchant:', error);
      throw error;
    }

    // Return full data including secrets (only on create)
    return this._mapToResponse(data, true);
  }

  /**
   * Update merchant settings
   */
  async update(merchantId, updates) {
    const mappedData = this._mapToDbFields(updates);
    mappedData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('merchants')
      .update(mappedData)
      .eq('id', merchantId)
      .select()
      .single();

    if (error) {
      console.error('[DB] Failed to update merchant:', error);
      throw error;
    }

    return this._mapToResponse(data, false);
  }

  /**
   * Rotate API keys for a merchant
   */
  async rotateApiKeys(merchantId) {
    const merchant = await this.getById(merchantId);
    if (!merchant) {
      throw new Error('Merchant not found');
    }

    const prefix = merchant.environment === 'production' ? 'live' : 'test';
    const newApiKey = `pk_${prefix}_${merchant.slug}_${this._generateRandomKey(16)}`;
    const newApiSecret = `sk_${prefix}_${merchant.slug}_${this._generateRandomKey(24)}`;

    const { data, error } = await supabase
      .from('merchants')
      .update({
        api_key: newApiKey,
        api_secret: newApiSecret,
        updated_at: new Date().toISOString()
      })
      .eq('id', merchantId)
      .select()
      .single();

    if (error) {
      console.error('[DB] Failed to rotate API keys:', error);
      throw error;
    }

    return this._mapToResponse(data, true); // Include secrets after rotation
  }

  /**
   * Get all merchants (admin)
   */
  async getAll(options = {}) {
    const { limit = 100, offset = 0, status } = options;

    let query = supabase
      .from('merchants')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[DB] Failed to get merchants:', error);
      throw error;
    }

    return {
      merchants: data.map(d => this._mapToResponse(d, false)),
      total: count
    };
  }

  /**
   * Check if merchant has product enabled
   */
  async hasProductEnabled(merchantId, product) {
    const { data, error } = await supabase
      .from('merchants')
      .select('coverpay_enabled, coinflow_enabled, status')
      .eq('id', merchantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return false;
      throw error;
    }

    if (data.status !== 'active') return false;

    if (product === 'coverpay') return data.coverpay_enabled;
    if (product === 'coinflow') return data.coinflow_enabled;

    return false;
  }

  /**
   * Get merchant CoverPay settings
   */
  async getCoverpaySettings(merchantId) {
    const { data, error } = await supabase
      .from('merchants')
      .select('coverpay_providers, coverpay_default_strategy, coverpay_min_amount, coverpay_max_amount')
      .eq('id', merchantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return {
      providers: data.coverpay_providers,
      defaultStrategy: data.coverpay_default_strategy,
      minAmount: data.coverpay_min_amount,
      maxAmount: data.coverpay_max_amount
    };
  }

  /**
   * Generate random key for API credentials
   */
  _generateRandomKey(length) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Map database fields to response format
   */
  _mapToResponse(data, includeSecrets = false) {
    if (!data) return null;

    const response = {
      id: data.id,
      name: data.name,
      slug: data.slug,
      email: data.email,
      apiKey: data.api_key,
      environment: data.environment,
      webhookUrl: data.webhook_url,
      coverpayEnabled: data.coverpay_enabled,
      coinflowEnabled: data.coinflow_enabled,
      coverpayProviders: data.coverpay_providers,
      coverpayDefaultStrategy: data.coverpay_default_strategy,
      coverpayMinAmount: data.coverpay_min_amount,
      coverpayMaxAmount: data.coverpay_max_amount,
      status: data.status,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };

    // Only include secrets when explicitly requested
    if (includeSecrets) {
      response.apiSecret = data.api_secret;
      response.webhookSecret = data.webhook_secret;
    }

    return response;
  }

  /**
   * Map camelCase to snake_case for database
   */
  _mapToDbFields(data) {
    const fieldMap = {
      webhookUrl: 'webhook_url',
      webhookSecret: 'webhook_secret',
      coverpayEnabled: 'coverpay_enabled',
      coinflowEnabled: 'coinflow_enabled',
      coverpayProviders: 'coverpay_providers',
      coverpayDefaultStrategy: 'coverpay_default_strategy',
      coverpayMinAmount: 'coverpay_min_amount',
      coverpayMaxAmount: 'coverpay_max_amount',
      billingEmail: 'billing_email',
      stripeCustomerId: 'stripe_customer_id'
    };

    const mapped = {};
    for (const [key, value] of Object.entries(data)) {
      const dbKey = fieldMap[key] || key;
      mapped[dbKey] = value;
    }

    return mapped;
  }
}

module.exports = new MerchantRepository();
