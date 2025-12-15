/**
 * Transaction Repository for CoverPay
 *
 * Handles all database operations for BNPL transactions and attempts.
 */
const { supabase } = require('./supabase');

class TransactionRepository {
  /**
   * Create a new BNPL transaction
   */
  async createTransaction({
    merchantId,
    merchantOrderId,
    customerEmail,
    customerPhone,
    customerName,
    amount,
    currency = 'USD',
    strategy = 'waterfall',
    metadata = {}
  }) {
    const { data, error } = await supabase
      .from('bnpl_transactions')
      .insert({
        merchant_id: merchantId,
        merchant_order_id: merchantOrderId,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_name: customerName,
        amount,
        currency,
        strategy,
        status: 'pending',
        metadata
      })
      .select()
      .single();

    if (error) {
      console.error('[DB] Failed to create transaction:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update transaction status
   */
  async updateTransaction(transactionId, updates) {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Map camelCase to snake_case
    const mappedData = {};
    const fieldMap = {
      status: 'status',
      finalProvider: 'final_provider',
      isSplit: 'is_split',
      redirectUrl: 'redirect_url',
      completedAt: 'completed_at',
      metadata: 'metadata'
    };

    for (const [key, value] of Object.entries(updateData)) {
      const dbKey = fieldMap[key] || key;
      mappedData[dbKey] = value;
    }

    const { data, error } = await supabase
      .from('bnpl_transactions')
      .update(mappedData)
      .eq('id', transactionId)
      .select()
      .single();

    if (error) {
      console.error('[DB] Failed to update transaction:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId) {
    const { data, error } = await supabase
      .from('bnpl_transactions')
      .select('*, bnpl_attempts(*)')
      .eq('id', transactionId)
      .single();

    if (error) {
      console.error('[DB] Failed to get transaction:', error);
      return null;
    }

    return data;
  }

  /**
   * Get transactions by merchant
   */
  async getTransactionsByMerchant(merchantId, options = {}) {
    const { limit = 50, offset = 0, status } = options;

    let query = supabase
      .from('bnpl_transactions')
      .select('*, bnpl_attempts(*)', { count: 'exact' })
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[DB] Failed to get transactions:', error);
      throw error;
    }

    return { transactions: data, total: count };
  }

  /**
   * Log a provider attempt
   */
  async logAttempt({
    transactionId,
    provider,
    amount,
    attemptOrder,
    status,
    providerSessionId,
    providerRedirectUrl,
    errorMessage,
    errorCode,
    responseTimeMs,
    providerResponse = {}
  }) {
    const { data, error } = await supabase
      .from('bnpl_attempts')
      .insert({
        transaction_id: transactionId,
        provider,
        amount,
        attempt_order: attemptOrder,
        status,
        provider_session_id: providerSessionId,
        provider_redirect_url: providerRedirectUrl,
        error_message: errorMessage,
        error_code: errorCode,
        response_time_ms: responseTimeMs,
        provider_response: providerResponse,
        completed_at: status !== 'attempted' ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (error) {
      console.error('[DB] Failed to log attempt:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update an attempt
   */
  async updateAttempt(attemptId, updates) {
    const { data, error } = await supabase
      .from('bnpl_attempts')
      .update({
        ...updates,
        completed_at: new Date().toISOString()
      })
      .eq('id', attemptId)
      .select()
      .single();

    if (error) {
      console.error('[DB] Failed to update attempt:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get analytics for a merchant
   */
  async getAnalytics(merchantId, options = {}) {
    const { startDate, endDate, provider } = options;

    // Get overall stats
    let query = supabase
      .from('bnpl_transactions')
      .select('status, final_provider, amount, is_split')
      .eq('merchant_id', merchantId);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error('[DB] Failed to get analytics:', error);
      throw error;
    }

    // Calculate stats
    const stats = {
      totalTransactions: transactions.length,
      approved: transactions.filter(t => t.status === 'approved').length,
      declined: transactions.filter(t => t.status === 'declined').length,
      pending: transactions.filter(t => t.status === 'pending').length,
      failed: transactions.filter(t => t.status === 'failed').length,
      approvalRate: 0,
      totalVolume: 0,
      approvedVolume: 0,
      splitPayments: transactions.filter(t => t.is_split).length,
      byProvider: {}
    };

    // Calculate approval rate and volume
    const completed = stats.approved + stats.declined;
    stats.approvalRate = completed > 0
      ? Math.round((stats.approved / completed) * 100 * 100) / 100
      : 0;

    stats.totalVolume = transactions.reduce((sum, t) => sum + t.amount, 0);
    stats.approvedVolume = transactions
      .filter(t => t.status === 'approved')
      .reduce((sum, t) => sum + t.amount, 0);

    // Group by provider
    transactions.forEach(t => {
      if (t.final_provider) {
        if (!stats.byProvider[t.final_provider]) {
          stats.byProvider[t.final_provider] = { approved: 0, total: 0, volume: 0 };
        }
        stats.byProvider[t.final_provider].total++;
        if (t.status === 'approved') {
          stats.byProvider[t.final_provider].approved++;
          stats.byProvider[t.final_provider].volume += t.amount;
        }
      }
    });

    return stats;
  }

  /**
   * Get provider attempt stats (for optimizing waterfall order)
   */
  async getProviderStats(merchantId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('bnpl_attempts')
      .select(`
        provider,
        status,
        amount,
        response_time_ms,
        bnpl_transactions!inner(merchant_id)
      `)
      .eq('bnpl_transactions.merchant_id', merchantId)
      .gte('attempted_at', startDate.toISOString());

    if (error) {
      console.error('[DB] Failed to get provider stats:', error);
      throw error;
    }

    // Aggregate by provider
    const stats = {};
    data.forEach(attempt => {
      if (!stats[attempt.provider]) {
        stats[attempt.provider] = {
          total: 0,
          approved: 0,
          declined: 0,
          errors: 0,
          totalResponseTime: 0,
          volume: 0
        };
      }

      stats[attempt.provider].total++;
      stats[attempt.provider].totalResponseTime += attempt.response_time_ms || 0;

      if (attempt.status === 'approved') {
        stats[attempt.provider].approved++;
        stats[attempt.provider].volume += attempt.amount;
      } else if (attempt.status === 'declined') {
        stats[attempt.provider].declined++;
      } else if (attempt.status === 'error') {
        stats[attempt.provider].errors++;
      }
    });

    // Calculate rates
    const result = {};
    for (const [provider, s] of Object.entries(stats)) {
      result[provider] = {
        totalAttempts: s.total,
        approved: s.approved,
        declined: s.declined,
        errors: s.errors,
        approvalRate: s.total > 0 ? Math.round((s.approved / s.total) * 100 * 100) / 100 : 0,
        avgResponseTimeMs: s.total > 0 ? Math.round(s.totalResponseTime / s.total) : 0,
        approvedVolume: s.volume
      };
    }

    return result;
  }
}

module.exports = new TransactionRepository();
