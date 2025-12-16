/**
 * Provider Session Repository for CoverPay
 *
 * Handles database operations for individual provider sessions
 * within an orchestration (fractured payment flow).
 */
const { supabase } = require('./supabase');

class ProviderSessionRepository {
  /**
   * Create a provider session
   */
  async createSession({
    orchestrationSessionId,
    provider,
    amount,
    sequenceOrder,
    redirectUrl,
    clientSecret,
    providerSessionId,
    expiresAt
  }) {
    const { data, error } = await supabase
      .from('provider_sessions')
      .insert({
        orchestration_session_id: orchestrationSessionId,
        provider,
        amount,
        sequence_order: sequenceOrder,
        redirect_url: redirectUrl,
        client_secret: clientSecret,
        provider_session_id: providerSessionId,
        expires_at: expiresAt,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('[DB] Failed to create provider session:', error);
      throw error;
    }

    return this._mapToResponse(data);
  }

  /**
   * Create multiple provider sessions at once
   */
  async createSessions(sessions) {
    const insertData = sessions.map(s => ({
      orchestration_session_id: s.orchestrationSessionId,
      provider: s.provider,
      amount: s.amount,
      sequence_order: s.sequenceOrder,
      redirect_url: s.redirectUrl,
      client_secret: s.clientSecret,
      provider_session_id: s.providerSessionId,
      expires_at: s.expiresAt,
      status: 'pending'
    }));

    const { data, error } = await supabase
      .from('provider_sessions')
      .insert(insertData)
      .select();

    if (error) {
      console.error('[DB] Failed to create provider sessions:', error);
      throw error;
    }

    return data.map(d => this._mapToResponse(d));
  }

  /**
   * Get provider session by ID
   */
  async getSession(sessionId) {
    const { data, error } = await supabase
      .from('provider_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[DB] Failed to get provider session:', error);
      throw error;
    }

    return this._mapToResponse(data);
  }

  /**
   * Find provider session by provider's session ID
   */
  async findByProviderSessionId(providerSessionId) {
    const { data, error } = await supabase
      .from('provider_sessions')
      .select('*, user_orchestration_sessions(*)')
      .eq('provider_session_id', providerSessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[DB] Failed to find provider session:', error);
      throw error;
    }

    return this._mapToResponse(data);
  }

  /**
   * Get all sessions for an orchestration
   */
  async getSessionsByOrchestration(orchestrationSessionId) {
    const { data, error } = await supabase
      .from('provider_sessions')
      .select('*')
      .eq('orchestration_session_id', orchestrationSessionId)
      .order('sequence_order', { ascending: true });

    if (error) {
      console.error('[DB] Failed to get provider sessions:', error);
      throw error;
    }

    return data.map(d => this._mapToResponse(d));
  }

  /**
   * Get current (active) provider session for orchestration
   */
  async getCurrentSession(orchestrationSessionId) {
    const { data, error } = await supabase
      .from('provider_sessions')
      .select('*')
      .eq('orchestration_session_id', orchestrationSessionId)
      .in('status', ['redirecting', 'in_progress', 'webhook_pending'])
      .order('sequence_order', { ascending: true })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[DB] Failed to get current provider session:', error);
      throw error;
    }

    return this._mapToResponse(data);
  }

  /**
   * Get next pending provider session
   */
  async getNextPendingSession(orchestrationSessionId) {
    const { data, error } = await supabase
      .from('provider_sessions')
      .select('*')
      .eq('orchestration_session_id', orchestrationSessionId)
      .eq('status', 'pending')
      .order('sequence_order', { ascending: true })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[DB] Failed to get next pending session:', error);
      throw error;
    }

    return this._mapToResponse(data);
  }

  /**
   * Update provider session
   */
  async updateSession(sessionId, updates) {
    const mappedData = this._mapToDbFields(updates);
    mappedData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('provider_sessions')
      .update(mappedData)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('[DB] Failed to update provider session:', error);
      throw error;
    }

    return this._mapToResponse(data);
  }

  /**
   * Update session status
   */
  async updateStatus(sessionId, newStatus, additionalUpdates = {}) {
    const validTransitions = {
      'pending': ['redirecting', 'skipped', 'cancelled'],
      'redirecting': ['in_progress', 'webhook_pending', 'cancelled', 'expired', 'error'],
      'in_progress': ['webhook_pending', 'approved', 'declined', 'cancelled', 'expired', 'error'],
      'webhook_pending': ['approved', 'declined', 'expired', 'error'],
      'approved': [],
      'declined': [],
      'expired': [],
      'cancelled': [],
      'skipped': [],
      'error': []
    };

    // Get current status
    const { data: current, error: getError } = await supabase
      .from('provider_sessions')
      .select('status')
      .eq('id', sessionId)
      .single();

    if (getError) throw getError;

    // Validate transition
    const allowed = validTransitions[current.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid provider status transition: ${current.status} -> ${newStatus}`);
    }

    const updates = {
      status: newStatus,
      ...additionalUpdates
    };

    return this.updateSession(sessionId, updates);
  }

  /**
   * Mark session as redirecting
   */
  async markRedirecting(sessionId) {
    return this.updateSession(sessionId, {
      status: 'redirecting',
      redirectInitiatedAt: new Date().toISOString()
    });
  }

  /**
   * Mark session as in progress (user on provider site)
   */
  async markInProgress(sessionId) {
    return this.updateSession(sessionId, {
      status: 'in_progress'
    });
  }

  /**
   * Mark session as webhook pending (user returned, awaiting confirmation)
   */
  async markWebhookPending(sessionId) {
    return this.updateSession(sessionId, {
      status: 'webhook_pending',
      redirectCompletedAt: new Date().toISOString()
    });
  }

  /**
   * Mark session as approved (webhook confirmed)
   */
  async markApproved(sessionId, providerResponse = {}) {
    return this.updateSession(sessionId, {
      status: 'approved',
      webhookReceivedAt: new Date().toISOString(),
      providerResponse
    });
  }

  /**
   * Mark session as declined
   */
  async markDeclined(sessionId, errorMessage, errorCode, providerResponse = {}) {
    return this.updateSession(sessionId, {
      status: 'declined',
      webhookReceivedAt: new Date().toISOString(),
      errorMessage,
      errorCode,
      providerResponse
    });
  }

  /**
   * Mark session as skipped
   */
  async markSkipped(sessionId) {
    return this.updateSession(sessionId, {
      status: 'skipped'
    });
  }

  /**
   * Get summary stats for orchestration's provider sessions
   */
  async getSessionStats(orchestrationSessionId) {
    const { data, error } = await supabase
      .from('provider_sessions')
      .select('status, amount')
      .eq('orchestration_session_id', orchestrationSessionId);

    if (error) throw error;

    const stats = {
      total: data.length,
      pending: 0,
      approved: 0,
      declined: 0,
      skipped: 0,
      other: 0,
      approvedAmount: 0,
      totalAmount: 0
    };

    data.forEach(s => {
      stats.totalAmount += s.amount;
      if (s.status === 'pending') stats.pending++;
      else if (s.status === 'approved') {
        stats.approved++;
        stats.approvedAmount += s.amount;
      }
      else if (s.status === 'declined') stats.declined++;
      else if (s.status === 'skipped') stats.skipped++;
      else stats.other++;
    });

    return stats;
  }

  /**
   * Map database fields to response format
   */
  _mapToResponse(data) {
    if (!data) return null;

    return {
      id: data.id,
      orchestrationSessionId: data.orchestration_session_id,
      provider: data.provider,
      providerSessionId: data.provider_session_id,
      amount: data.amount,
      sequenceOrder: data.sequence_order,
      status: data.status,
      redirectUrl: data.redirect_url,
      clientSecret: data.client_secret,
      providerResponse: data.provider_response,
      redirectInitiatedAt: data.redirect_initiated_at,
      redirectCompletedAt: data.redirect_completed_at,
      webhookReceivedAt: data.webhook_received_at,
      errorMessage: data.error_message,
      errorCode: data.error_code,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  /**
   * Map camelCase to snake_case for database
   */
  _mapToDbFields(data) {
    const fieldMap = {
      orchestrationSessionId: 'orchestration_session_id',
      providerSessionId: 'provider_session_id',
      sequenceOrder: 'sequence_order',
      redirectUrl: 'redirect_url',
      clientSecret: 'client_secret',
      providerResponse: 'provider_response',
      redirectInitiatedAt: 'redirect_initiated_at',
      redirectCompletedAt: 'redirect_completed_at',
      webhookReceivedAt: 'webhook_received_at',
      errorMessage: 'error_message',
      errorCode: 'error_code',
      expiresAt: 'expires_at'
    };

    const mapped = {};
    for (const [key, value] of Object.entries(data)) {
      const dbKey = fieldMap[key] || key;
      mapped[dbKey] = value;
    }

    return mapped;
  }
}

module.exports = new ProviderSessionRepository();
