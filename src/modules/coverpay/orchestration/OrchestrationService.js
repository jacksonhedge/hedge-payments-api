/**
 * OrchestrationService
 *
 * Main service for managing user orchestration sessions.
 * Handles the complete lifecycle of fractured BNPL checkouts.
 *
 * Flow:
 * 1. User starts checkout with amount
 * 2. System creates orchestration session with provider sessions
 * 3. User is redirected to first provider
 * 4. On return, system waits for webhook
 * 5. On webhook, advance to next provider or complete
 * 6. Repeat until all providers done or target met
 */
const { orchestrationRepository, providerSessionRepository, transactionRepository } = require('../db');
const { stateMachine } = require('./OrchestrationStateMachine');
const PrequalificationService = require('./PrequalificationService');

// Session expiration time (30 minutes)
const SESSION_EXPIRY_MS = 30 * 60 * 1000;

// Provider session expiry (15 minutes)
const PROVIDER_SESSION_EXPIRY_MS = 15 * 60 * 1000;

class OrchestrationService {
  constructor(providers = [], options = {}) {
    this.providers = providers;
    this.prequalService = new PrequalificationService(providers);
    this.eventBus = options.eventBus || null;
    this.enableLogging = options.enableLogging !== false;
    this.merchantId = options.merchantId || 'default';

    // Bind event handlers if eventBus provided
    if (this.eventBus) {
      stateMachine.eventBus = this.eventBus;
    }
  }

  /**
   * Pre-qualify user for BNPL
   */
  async prequalify(customer, amount = null, forceRefresh = false) {
    return this.prequalService.checkEligibility(customer, amount, forceRefresh);
  }

  /**
   * Start a new orchestration session
   */
  async startOrchestration({
    amount,
    customer,
    merchant,
    strategy = 'fractured',
    deviceId,
    apnsToken,
    returnScheme,
    fracturedOptions = {}
  }) {
    const startTime = Date.now();
    this._log(`Starting ${strategy} orchestration for $${amount / 100}`);

    // 1. Create the underlying BNPL transaction
    let transaction = null;
    try {
      transaction = await transactionRepository.createTransaction({
        merchantId: this.merchantId,
        merchantOrderId: merchant.orderId || `order_${Date.now()}`,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        customerName: customer.name || `${customer.firstName} ${customer.lastName}`,
        amount,
        currency: 'USD',
        strategy,
        metadata: { merchant }
      });
    } catch (error) {
      this._log(`Failed to create transaction: ${error.message}`, 'error');
    }

    // 2. Get fractured split from existing orchestrator
    const orchestrator = this._getOrchestrator();
    const fracturedResult = await orchestrator.processCheckout({
      amount,
      customer,
      merchant,
      strategy: 'fractured',
      fracturedOptions: {
        ...fracturedOptions,
        tryFullFirst: fracturedOptions.tryFullFirst !== false
      }
    });

    if (!fracturedResult.success && !fracturedResult.partiallyCovered && fracturedResult.sessions?.length === 0) {
      throw new Error('No providers approved any amount');
    }

    // 3. Create orchestration session
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS).toISOString();
    const session = await orchestrationRepository.createSession({
      transactionId: transaction?.id,
      userId: customer.userId || null,
      deviceId,
      strategy,
      totalAmount: amount,
      targetAmount: amount,
      totalProviders: fracturedResult.sessions?.length || 0,
      expiresAt,
      returnScheme,
      successUrl: merchant.returnUrl,
      cancelUrl: merchant.cancelUrl,
      apnsToken,
      customerData: customer,
      merchantData: merchant
    });

    // 4. Create provider sessions from fractured result
    if (fracturedResult.sessions?.length > 0) {
      const providerSessions = await providerSessionRepository.createSessions(
        fracturedResult.sessions.map((s, index) => ({
          orchestrationSessionId: session.id,
          provider: s.provider,
          amount: s.amount,
          sequenceOrder: index + 1,
          redirectUrl: s.redirectUrl,
          providerSessionId: s.sessionId,
          expiresAt: new Date(Date.now() + PROVIDER_SESSION_EXPIRY_MS).toISOString()
        }))
      );

      session.providerSessions = providerSessions;
    }

    // 5. Update session to in_progress and set current provider
    const updatedSession = await orchestrationRepository.updateSession(session.id, {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      currentProviderIndex: 1
    });

    // Get the complete session with provider sessions
    const fullSession = await orchestrationRepository.getSession(session.id);

    const responseTimeMs = Date.now() - startTime;
    this._log(`Orchestration started in ${responseTimeMs}ms - ${fullSession.providerSessions?.length} providers`);

    // Emit event
    if (this.eventBus) {
      await this.eventBus.emit('orchestration:started', {
        sessionId: fullSession.id,
        transactionId: transaction?.id,
        totalAmount: amount,
        providers: fullSession.providerSessions?.map(p => p.provider)
      });
    }

    return {
      ...fullSession,
      nextAction: stateMachine.getNextAction(fullSession)
    };
  }

  /**
   * Get orchestration session status
   */
  async getSessionStatus(sessionId) {
    const session = await orchestrationRepository.getSession(sessionId);

    if (!session) {
      throw new Error('Orchestration session not found');
    }

    // Check for expiration
    if (stateMachine.shouldExpire(session)) {
      await this._expireSession(session);
      return this.getSessionStatus(sessionId);
    }

    // Calculate stats
    const stats = await providerSessionRepository.getSessionStats(sessionId);

    return {
      ...session,
      stats,
      progress: stateMachine.calculateProgress(session),
      coverage: stateMachine.calculateCoverage(session),
      nextAction: stateMachine.getNextAction(session)
    };
  }

  /**
   * Advance to next provider
   */
  async advanceToNextProvider(sessionId) {
    const session = await orchestrationRepository.getSession(sessionId);

    if (!session) {
      throw new Error('Orchestration session not found');
    }

    // Validate we can advance
    if (stateMachine.isTerminalState(session.status)) {
      throw new Error(`Cannot advance - session is in terminal state: ${session.status}`);
    }

    // Get next pending provider
    const nextProvider = await providerSessionRepository.getNextPendingSession(sessionId);

    if (!nextProvider) {
      // No more providers - determine final state
      const stats = await providerSessionRepository.getSessionStats(sessionId);
      const finalState = stateMachine.determineNextState(session, stats);

      await orchestrationRepository.updateStatus(sessionId, finalState, {
        completedAt: new Date().toISOString()
      });

      return this.getSessionStatus(sessionId);
    }

    // Mark next provider as redirecting
    await providerSessionRepository.markRedirecting(nextProvider.id);

    // Update orchestration session
    await orchestrationRepository.updateSession(sessionId, {
      status: 'provider_redirect',
      currentProviderIndex: nextProvider.sequenceOrder
    });

    this._log(`Advanced to provider ${nextProvider.provider} (${nextProvider.sequenceOrder}/${session.totalProviders})`);

    return this.getSessionStatus(sessionId);
  }

  /**
   * Mark current provider as completed (user returned from redirect)
   */
  async markProviderReturned(sessionId, providerSessionId = null) {
    const session = await orchestrationRepository.getSession(sessionId);

    if (!session) {
      throw new Error('Orchestration session not found');
    }

    // Get the provider session
    let providerSession;
    if (providerSessionId) {
      providerSession = await providerSessionRepository.getSession(providerSessionId);
    } else {
      providerSession = await providerSessionRepository.getCurrentSession(sessionId);
    }

    if (!providerSession) {
      throw new Error('No active provider session found');
    }

    // Mark as webhook pending
    await providerSessionRepository.markWebhookPending(providerSession.id);

    // Update orchestration session
    await orchestrationRepository.updateSession(sessionId, {
      status: 'awaiting_webhook'
    });

    this._log(`Provider ${providerSession.provider} marked as webhook pending`);

    return this.getSessionStatus(sessionId);
  }

  /**
   * Process webhook from provider
   */
  async processProviderWebhook(provider, providerSessionId, status, data = {}) {
    this._log(`Processing webhook for ${provider}: ${providerSessionId} -> ${status}`);

    // Find the provider session
    const providerSession = await providerSessionRepository.findByProviderSessionId(providerSessionId);

    if (!providerSession) {
      this._log(`Provider session not found: ${providerSessionId}`, 'warn');
      return null;
    }

    const orchestrationSessionId = providerSession.orchestrationSessionId;

    // Update provider session based on status
    if (status === 'approved' || status === 'completed') {
      await providerSessionRepository.markApproved(providerSession.id, data);
    } else if (status === 'declined' || status === 'failed') {
      await providerSessionRepository.markDeclined(
        providerSession.id,
        data.reason || 'Provider declined',
        data.code,
        data
      );
    } else {
      // Update with whatever status we got
      await providerSessionRepository.updateSession(providerSession.id, {
        status,
        providerResponse: data,
        webhookReceivedAt: new Date().toISOString()
      });
    }

    // Recalculate approved amount
    await orchestrationRepository.recalculateApprovedAmount(orchestrationSessionId);

    // Check if we should advance or complete
    const session = await orchestrationRepository.getSession(orchestrationSessionId);
    const stats = await providerSessionRepository.getSessionStats(orchestrationSessionId);

    if (stats.pending > 0 && session.approvedAmount < session.targetAmount) {
      // More providers to try - move to next_provider state
      await orchestrationRepository.updateSession(orchestrationSessionId, {
        status: 'next_provider'
      });
    } else {
      // Determine final state
      const finalState = stateMachine.determineNextState(session, stats);
      await orchestrationRepository.updateStatus(orchestrationSessionId, finalState, {
        completedAt: new Date().toISOString()
      });
    }

    // Emit event
    if (this.eventBus) {
      await this.eventBus.emit('orchestration:provider_completed', {
        sessionId: orchestrationSessionId,
        provider,
        providerSessionId: providerSession.id,
        status,
        amount: providerSession.amount
      });
    }

    return this.getSessionStatus(orchestrationSessionId);
  }

  /**
   * Skip current provider
   */
  async skipProvider(sessionId, providerSessionId = null) {
    const session = await orchestrationRepository.getSession(sessionId);

    if (!session) {
      throw new Error('Orchestration session not found');
    }

    // Get the provider session to skip
    let providerSession;
    if (providerSessionId) {
      providerSession = await providerSessionRepository.getSession(providerSessionId);
    } else {
      providerSession = await providerSessionRepository.getCurrentSession(sessionId);
    }

    if (providerSession) {
      await providerSessionRepository.markSkipped(providerSession.id);
      this._log(`Skipped provider ${providerSession.provider}`);
    }

    // Advance to next
    return this.advanceToNextProvider(sessionId);
  }

  /**
   * Cancel orchestration session
   */
  async cancelSession(sessionId) {
    const session = await orchestrationRepository.getSession(sessionId);

    if (!session) {
      throw new Error('Orchestration session not found');
    }

    if (stateMachine.isTerminalState(session.status)) {
      throw new Error(`Cannot cancel - session is already in terminal state: ${session.status}`);
    }

    // Cancel all pending provider sessions
    const providerSessions = await providerSessionRepository.getSessionsByOrchestration(sessionId);
    for (const ps of providerSessions) {
      if (['pending', 'redirecting', 'in_progress', 'webhook_pending'].includes(ps.status)) {
        await providerSessionRepository.updateSession(ps.id, { status: 'cancelled' });
      }
    }

    // Update orchestration session
    await orchestrationRepository.updateStatus(sessionId, 'cancelled', {
      completedAt: new Date().toISOString()
    });

    this._log(`Orchestration session ${sessionId} cancelled`);

    // Emit event
    if (this.eventBus) {
      await this.eventBus.emit('orchestration:cancelled', {
        sessionId,
        approvedAmount: session.approvedAmount
      });
    }

    return this.getSessionStatus(sessionId);
  }

  /**
   * Expire a session
   */
  async _expireSession(session) {
    this._log(`Expiring session ${session.id}`);

    await orchestrationRepository.updateStatus(session.id, 'expired', {
      completedAt: new Date().toISOString()
    });

    // Emit event
    if (this.eventBus) {
      await this.eventBus.emit('orchestration:expired', {
        sessionId: session.id,
        approvedAmount: session.approvedAmount
      });
    }
  }

  /**
   * Get the CoverPay orchestrator for creating sessions
   */
  _getOrchestrator() {
    const CoverPayOrchestrator = require('../orchestrator');
    return new CoverPayOrchestrator(this.providers, {
      enableLogging: false,
      merchantId: this.merchantId
    });
  }

  /**
   * Log helper
   */
  _log(message, level = 'info') {
    if (!this.enableLogging) return;
    const prefix = '[Orchestration]';
    if (level === 'error') {
      console.error(`${prefix} ${message}`);
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

module.exports = OrchestrationService;
