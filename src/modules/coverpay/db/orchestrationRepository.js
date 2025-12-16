/**
 * Orchestration Repository for CoverPay (B2B Model)
 *
 * Handles database operations for user orchestration sessions.
 * Tracks multi-provider checkout journeys (fractured payments).
 *
 * All operations are scoped to a merchant_id for B2B isolation.
 */
const { supabase } = require('./supabase');

class OrchestrationRepository {
  /**
   * Create a new orchestration session
   * @param {string} merchantId - Required merchant ID
   */
  async createSession({
    merchantId,
    externalId,
    customerId,
    customerEmail,
    customerPhone,
    deviceId,
    strategy = 'fractured',
    totalAmount,
    targetAmount,
    totalProviders,
    expiresAt,
    returnScheme,
    returnUrl,
    cancelUrl,
    apnsToken,
    fcmToken,
    customerData = {},
    merchantData = {},
    metadata = {}
  }) {
    if (!merchantId) {
      throw new Error('merchantId is required');
    }

    const { data, error } = await supabase
      .from('user_orchestration_sessions')
      .insert({
        merchant_id: merchantId,
        external_id: externalId,
        customer_id: customerId,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        device_id: deviceId,
        strategy,
        total_amount: totalAmount,
        target_amount: targetAmount,
        total_providers: totalProviders,
        expires_at: expiresAt,
        return_scheme: returnScheme,
        return_url: returnUrl,
        cancel_url: cancelUrl,
        apns_token: apnsToken,
        fcm_token: fcmToken,
        customer_data: customerData,
        merchant_data: merchantData,
        metadata,
        status: 'initiated'
      })
      .select()
      .single();

    if (error) {
      console.error('[DB] Failed to create orchestration session:', error);
      throw error;
    }

    return this._mapToResponse(data);
  }

  /**
   * Get orchestration session by ID
   * @param {string} sessionId - Session UUID
   * @param {string} merchantId - Optional merchant ID for scoped access
   */
  async getSession(sessionId, merchantId = null) {
    let query = supabase
      .from('user_orchestration_sessions')
      .select('*, provider_sessions(*)')
      .eq('id', sessionId);

    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('[DB] Failed to get orchestration session:', error);
      throw error;
    }

    return this._mapToResponse(data);
  }

  /**
   * Get orchestration session by external ID (merchant's order ID)
   */
  async getSessionByExternalId(merchantId, externalId) {
    const { data, error } = await supabase
      .from('user_orchestration_sessions')
      .select('*, provider_sessions(*)')
      .eq('merchant_id', merchantId)
      .eq('external_id', externalId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[DB] Failed to get orchestration session:', error);
      throw error;
    }

    return this._mapToResponse(data);
  }

  /**
   * Update orchestration session
   */
  async updateSession(sessionId, updates, merchantId = null) {
    const mappedData = this._mapToDbFields(updates);
    mappedData.updated_at = new Date().toISOString();

    let query = supabase
      .from('user_orchestration_sessions')
      .update(mappedData)
      .eq('id', sessionId);

    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    }

    const { data, error } = await query
      .select('*, provider_sessions(*)')
      .single();

    if (error) {
      console.error('[DB] Failed to update orchestration session:', error);
      throw error;
    }

    return this._mapToResponse(data);
  }

  /**
   * Update session status with state machine validation
   */
  async updateStatus(sessionId, newStatus, additionalUpdates = {}, merchantId = null) {
    const validTransitions = {
      'initiated': ['in_progress', 'cancelled', 'expired'],
      'in_progress': ['provider_redirect', 'all_completed', 'partial_completed', 'failed', 'cancelled', 'expired'],
      'provider_redirect': ['awaiting_webhook', 'in_progress', 'next_provider', 'cancelled', 'expired'],
      'awaiting_webhook': ['next_provider', 'all_completed', 'partial_completed', 'failed', 'cancelled', 'expired'],
      'next_provider': ['in_progress', 'provider_redirect', 'all_completed', 'partial_completed', 'cancelled', 'expired'],
      'all_completed': [],
      'partial_completed': [],
      'failed': [],
      'expired': [],
      'cancelled': []
    };

    // Get current status
    let query = supabase
      .from('user_orchestration_sessions')
      .select('status')
      .eq('id', sessionId);

    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    }

    const { data: current, error: getError } = await query.single();

    if (getError) throw getError;

    // Validate transition
    const allowed = validTransitions[current.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid status transition: ${current.status} -> ${newStatus}`);
    }

    // Update
    const updates = {
      status: newStatus,
      ...additionalUpdates
    };

    // Set timestamps for terminal states
    if (['all_completed', 'partial_completed', 'failed', 'cancelled'].includes(newStatus)) {
      updates.completedAt = new Date().toISOString();
    }

    return this.updateSession(sessionId, updates, merchantId);
  }

  /**
   * Get sessions by customer ID for a merchant
   */
  async getSessionsByCustomer(merchantId, customerId, options = {}) {
    const { limit = 20, offset = 0, status } = options;

    let query = supabase
      .from('user_orchestration_sessions')
      .select('*, provider_sessions(*)', { count: 'exact' })
      .eq('merchant_id', merchantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[DB] Failed to get customer sessions:', error);
      throw error;
    }

    return {
      sessions: data.map(s => this._mapToResponse(s)),
      total: count
    };
  }

  /**
   * Get all sessions for a merchant (admin view)
   */
  async getSessionsByMerchant(merchantId, options = {}) {
    const { limit = 50, offset = 0, status, fromDate, toDate } = options;

    let query = supabase
      .from('user_orchestration_sessions')
      .select('*, provider_sessions(*)', { count: 'exact' })
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }
    if (toDate) {
      query = query.lte('created_at', toDate);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[DB] Failed to get merchant sessions:', error);
      throw error;
    }

    return {
      sessions: data.map(s => this._mapToResponse(s)),
      total: count
    };
  }

  /**
   * Get active sessions that should be expired (for background job)
   */
  async getExpiredSessions() {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('user_orchestration_sessions')
      .select('id, merchant_id, status, expires_at')
      .in('status', ['initiated', 'in_progress', 'provider_redirect', 'awaiting_webhook', 'next_provider'])
      .lt('expires_at', now);

    if (error) {
      console.error('[DB] Failed to get expired sessions:', error);
      throw error;
    }

    return data;
  }

  /**
   * Mark sessions as expired
   */
  async expireSessions(sessionIds) {
    const { data, error } = await supabase
      .from('user_orchestration_sessions')
      .update({
        status: 'expired',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .in('id', sessionIds)
      .select();

    if (error) {
      console.error('[DB] Failed to expire sessions:', error);
      throw error;
    }

    return data;
  }

  /**
   * Calculate and update approved amount from provider sessions
   */
  async recalculateApprovedAmount(sessionId) {
    // Get all approved provider sessions
    const { data: providers, error } = await supabase
      .from('provider_sessions')
      .select('amount')
      .eq('orchestration_session_id', sessionId)
      .eq('status', 'approved');

    if (error) throw error;

    const approvedAmount = providers.reduce((sum, p) => sum + p.amount, 0);
    const completedProviders = providers.length;

    return this.updateSession(sessionId, {
      approvedAmount,
      completedProviders
    });
  }

  /**
   * Get orchestration stats for a merchant
   */
  async getMerchantStats(merchantId, days = 30) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const { data, error } = await supabase
      .from('user_orchestration_sessions')
      .select('status, total_amount, approved_amount')
      .eq('merchant_id', merchantId)
      .gte('created_at', fromDate.toISOString());

    if (error) {
      console.error('[DB] Failed to get merchant stats:', error);
      throw error;
    }

    const stats = {
      totalSessions: data.length,
      completed: data.filter(s => s.status === 'all_completed').length,
      partialCompleted: data.filter(s => s.status === 'partial_completed').length,
      failed: data.filter(s => ['failed', 'expired', 'cancelled'].includes(s.status)).length,
      totalVolume: data.reduce((sum, s) => sum + (s.total_amount || 0), 0),
      approvedVolume: data.reduce((sum, s) => sum + (s.approved_amount || 0), 0)
    };

    stats.successRate = stats.totalSessions > 0
      ? ((stats.completed + stats.partialCompleted) / stats.totalSessions * 100).toFixed(1)
      : 0;

    return stats;
  }

  /**
   * Map database fields to response format
   */
  _mapToResponse(data) {
    if (!data) return null;

    const mapped = {
      id: data.id,
      sessionId: data.id, // Alias for iOS compatibility
      merchantId: data.merchant_id,
      externalId: data.external_id,
      transactionId: data.external_id, // Alias for backwards compatibility
      customerId: data.customer_id,
      customerEmail: data.customer_email,
      customerPhone: data.customer_phone,
      deviceId: data.device_id,
      status: data.status,
      strategy: data.strategy,
      totalAmount: data.total_amount,
      targetAmount: data.target_amount,
      approvedAmount: data.approved_amount || 0,
      remainingAmount: (data.target_amount || data.total_amount) - (data.approved_amount || 0),
      totalProviders: data.total_providers,
      completedProviders: data.completed_providers || 0,
      currentProviderIndex: data.current_provider_index || 0,
      expiresAt: data.expires_at,
      returnScheme: data.return_scheme,
      returnUrl: data.return_url,
      cancelUrl: data.cancel_url,
      apnsToken: data.apns_token,
      fcmToken: data.fcm_token,
      customerData: data.customer_data,
      merchantData: data.merchant_data,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      startedAt: data.started_at,
      completedAt: data.completed_at
    };

    // Calculate progress and coverage
    mapped.progress = mapped.totalProviders > 0
      ? mapped.completedProviders / mapped.totalProviders
      : 0;
    mapped.coverage = mapped.totalAmount > 0
      ? mapped.approvedAmount / mapped.totalAmount
      : 0;

    // Include provider sessions if joined
    if (data.provider_sessions) {
      mapped.providerSessions = data.provider_sessions
        .sort((a, b) => a.sequence_order - b.sequence_order)
        .map(ps => ({
          id: ps.id,
          provider: ps.provider,
          providerSessionId: ps.provider_session_id,
          amount: ps.amount,
          sequenceOrder: ps.sequence_order,
          status: ps.status,
          redirectUrl: ps.redirect_url,
          clientSecret: ps.client_secret,
          providerResponse: ps.provider_response,
          redirectInitiatedAt: ps.redirect_initiated_at,
          redirectCompletedAt: ps.redirect_completed_at,
          webhookReceivedAt: ps.webhook_received_at,
          errorMessage: ps.error_message,
          errorCode: ps.error_code,
          expiresAt: ps.expires_at,
          createdAt: ps.created_at,
          updatedAt: ps.updated_at
        }));

      // Add current provider reference
      const currentIndex = data.current_provider_index || 0;
      mapped.currentProvider = mapped.providerSessions.find(
        ps => ps.sequenceOrder === currentIndex
      ) || mapped.providerSessions[0];
    }

    // Determine next action based on status
    mapped.nextAction = this._determineNextAction(mapped);

    return mapped;
  }

  /**
   * Determine the next action for the session
   */
  _determineNextAction(session) {
    if (!session) return null;

    switch (session.status) {
      case 'initiated':
      case 'in_progress':
        if (session.currentProvider?.redirectUrl) {
          return {
            action: 'redirect',
            provider: session.currentProvider.provider,
            url: session.currentProvider.redirectUrl,
            message: `Continue with ${session.currentProvider.provider}`
          };
        }
        return { action: 'poll', message: 'Preparing provider checkout...' };

      case 'provider_redirect':
        return { action: 'await_redirect', message: 'Complete checkout with provider' };

      case 'awaiting_webhook':
        return { action: 'poll', message: 'Waiting for confirmation...' };

      case 'next_provider':
        if (session.currentProvider?.redirectUrl) {
          return {
            action: 'redirect',
            provider: session.currentProvider.provider,
            url: session.currentProvider.redirectUrl,
            message: `Continue with ${session.currentProvider.provider}`
          };
        }
        return { action: 'advance', message: 'Ready for next provider' };

      case 'all_completed':
        return { action: 'complete', message: 'All payments approved!' };

      case 'partial_completed':
        return {
          action: 'complete',
          message: `Partial payment: ${session.approvedAmount / 100} of ${session.totalAmount / 100} approved`
        };

      case 'failed':
      case 'expired':
      case 'cancelled':
        return { action: 'failed', message: `Session ${session.status}` };

      default:
        return { action: 'poll', message: 'Checking status...' };
    }
  }

  /**
   * Map camelCase to snake_case for database
   */
  _mapToDbFields(data) {
    const fieldMap = {
      merchantId: 'merchant_id',
      externalId: 'external_id',
      transactionId: 'external_id', // Backwards compatibility
      customerId: 'customer_id',
      customerEmail: 'customer_email',
      customerPhone: 'customer_phone',
      deviceId: 'device_id',
      totalAmount: 'total_amount',
      targetAmount: 'target_amount',
      approvedAmount: 'approved_amount',
      totalProviders: 'total_providers',
      completedProviders: 'completed_providers',
      currentProviderIndex: 'current_provider_index',
      expiresAt: 'expires_at',
      returnScheme: 'return_scheme',
      returnUrl: 'return_url',
      cancelUrl: 'cancel_url',
      apnsToken: 'apns_token',
      fcmToken: 'fcm_token',
      customerData: 'customer_data',
      merchantData: 'merchant_data',
      startedAt: 'started_at',
      completedAt: 'completed_at'
    };

    const mapped = {};
    for (const [key, value] of Object.entries(data)) {
      const dbKey = fieldMap[key] || key;
      mapped[dbKey] = value;
    }

    return mapped;
  }
}

module.exports = new OrchestrationRepository();
