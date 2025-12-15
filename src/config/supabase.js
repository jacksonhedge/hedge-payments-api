const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Service role key for backend

if (!supabaseUrl || !supabaseServiceKey) {
  logger.warn('Supabase credentials not found in environment');
}

// Create Supabase client
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false // Backend doesn't need session persistence
      }
    })
  : null;

if (supabase) {
  logger.info('Supabase client initialized');
} else {
  logger.warn('Supabase client not initialized - check environment variables');
}

/**
 * Database query helpers
 */
class Database {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get user by identifier (email, phone, username)
   */
  async getUserByIdentifier(identifier) {
    if (!this.client) throw new Error('Supabase not initialized');

    // Try email
    if (this.isEmail(identifier)) {
      const { data, error } = await this.client
        .from('users')
        .select('*, wallets(*)')
        .eq('email', identifier)
        .single();

      if (!error && data) return data;
    }

    // Try phone
    if (this.isPhone(identifier)) {
      const cleaned = identifier.replace(/\D/g, '');
      const { data, error } = await this.client
        .from('users')
        .select('*, wallets(*)')
        .or(`phone.eq.${identifier},phone.eq.+${cleaned}`)
        .single();

      if (!error && data) return data;
    }

    // Try username
    const cleanUsername = identifier.replace('@', '');
    const { data, error } = await this.client
      .from('users')
      .select('*, wallets(*)')
      .eq('username', cleanUsername)
      .single();

    return error ? null : data;
  }

  /**
   * Get merchant by domain or ID
   */
  async getMerchantByDomain(domain) {
    if (!this.client) throw new Error('Supabase not initialized');

    const { data, error } = await this.client
      .from('merchants')
      .select('*, users!inner(*), wallets!inner(*)')
      .eq('domain', domain)
      .eq('uses_hedge_payments', true)
      .single();

    return error ? null : data;
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(walletId, currency = 'USD') {
    if (!this.client) throw new Error('Supabase not initialized');

    const { data, error } = await this.client
      .from('wallet_balances')
      .select('*')
      .eq('wallet_id', walletId)
      .eq('currency', currency)
      .single();

    if (error) throw error;
    return data?.available_balance || 0;
  }

  /**
   * Execute internal transfer (atomic)
   */
  async executeInternalTransfer({ fromWalletId, toWalletId, amount, currency, fee, memo }) {
    if (!this.client) throw new Error('Supabase not initialized');

    // Use Supabase RPC for atomic transaction
    const { data, error } = await this.client.rpc('execute_internal_transfer', {
      p_from_wallet_id: fromWalletId,
      p_to_wallet_id: toWalletId,
      p_amount: amount,
      p_currency: currency,
      p_fee: fee,
      p_memo: memo
    });

    if (error) throw error;
    return data;
  }

  /**
   * Get user transactions
   */
  async getUserTransactions(userId, limit = 100) {
    if (!this.client) throw new Error('Supabase not initialized');

    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get network merchants
   */
  async getNetworkMerchants({ city, category, limit = 50 }) {
    if (!this.client) throw new Error('Supabase not initialized');

    let query = this.client
      .from('merchants')
      .select('*')
      .eq('uses_hedge_payments', true)
      .eq('is_active', true);

    if (city) {
      query = query.eq('city', city);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query
      .order('bankroll_users_count', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get network analytics
   */
  async getNetworkAnalytics(days = 30) {
    if (!this.client) throw new Error('Supabase not initialized');

    const { data, error } = await this.client
      .from('network_analytics')
      .select('*')
      .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Validation helpers
  isEmail(str) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  }

  isPhone(str) {
    const cleaned = str.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  }
}

// Create database helper instance
const db = supabase ? new Database(supabase) : null;

module.exports = {
  supabase,
  db
};
