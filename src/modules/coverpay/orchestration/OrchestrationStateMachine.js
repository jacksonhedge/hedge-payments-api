/**
 * OrchestrationStateMachine
 *
 * Manages state transitions for user orchestration sessions.
 * Ensures valid transitions and emits events for each change.
 *
 * Session States:
 * - initiated: Session created, not started
 * - in_progress: User actively completing providers
 * - provider_redirect: User redirected to a provider
 * - awaiting_webhook: Waiting for provider confirmation
 * - next_provider: Moving to next provider in sequence
 * - all_completed: All providers completed successfully
 * - partial_completed: Some providers completed, some failed/skipped
 * - failed: Session failed
 * - expired: Session timed out
 * - cancelled: User cancelled
 */

// Valid state transitions
const VALID_TRANSITIONS = {
  'initiated': ['in_progress', 'cancelled', 'expired'],
  'in_progress': ['provider_redirect', 'all_completed', 'partial_completed', 'failed', 'cancelled', 'expired'],
  'provider_redirect': ['awaiting_webhook', 'in_progress', 'next_provider', 'cancelled', 'expired'],
  'awaiting_webhook': ['next_provider', 'all_completed', 'partial_completed', 'failed', 'cancelled', 'expired'],
  'next_provider': ['in_progress', 'provider_redirect', 'all_completed', 'partial_completed', 'cancelled', 'expired'],
  // Terminal states - no transitions allowed
  'all_completed': [],
  'partial_completed': [],
  'failed': [],
  'expired': [],
  'cancelled': []
};

// Terminal states
const TERMINAL_STATES = ['all_completed', 'partial_completed', 'failed', 'expired', 'cancelled'];

// Active states (session is being worked on)
const ACTIVE_STATES = ['initiated', 'in_progress', 'provider_redirect', 'awaiting_webhook', 'next_provider'];

class OrchestrationStateMachine {
  constructor(eventBus = null) {
    this.eventBus = eventBus;
  }

  /**
   * Check if a transition is valid
   */
  isValidTransition(fromState, toState) {
    const allowed = VALID_TRANSITIONS[fromState] || [];
    return allowed.includes(toState);
  }

  /**
   * Get allowed transitions from a state
   */
  getAllowedTransitions(state) {
    return VALID_TRANSITIONS[state] || [];
  }

  /**
   * Check if state is terminal
   */
  isTerminalState(state) {
    return TERMINAL_STATES.includes(state);
  }

  /**
   * Check if state is active
   */
  isActiveState(state) {
    return ACTIVE_STATES.includes(state);
  }

  /**
   * Validate and prepare a transition
   * Throws if transition is invalid
   */
  validateTransition(session, toState) {
    const fromState = session.status;

    if (!this.isValidTransition(fromState, toState)) {
      throw new Error(
        `Invalid orchestration state transition: ${fromState} -> ${toState}. ` +
        `Allowed: [${this.getAllowedTransitions(fromState).join(', ')}]`
      );
    }

    return {
      fromState,
      toState,
      isTerminal: this.isTerminalState(toState),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Emit state change event
   */
  async emitStateChange(session, fromState, toState, metadata = {}) {
    if (!this.eventBus) return;

    await this.eventBus.emit('orchestration:state_changed', {
      sessionId: session.id,
      transactionId: session.transactionId,
      userId: session.userId,
      fromState,
      toState,
      isTerminal: this.isTerminalState(toState),
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  /**
   * Determine next state based on provider results
   */
  determineNextState(session, providerStats) {
    const { total, approved, pending, declined } = providerStats;

    // All providers completed
    if (pending === 0) {
      if (approved > 0 && session.approvedAmount >= session.targetAmount) {
        return 'all_completed';
      } else if (approved > 0) {
        return 'partial_completed';
      } else {
        return 'failed';
      }
    }

    // More providers to process
    return 'next_provider';
  }

  /**
   * Check if session should expire
   */
  shouldExpire(session) {
    if (this.isTerminalState(session.status)) return false;
    if (!session.expiresAt) return false;

    return new Date(session.expiresAt) < new Date();
  }

  /**
   * Get next action for client based on current state
   */
  getNextAction(session) {
    switch (session.status) {
      case 'initiated':
        return {
          type: 'start_checkout',
          message: 'Ready to start checkout flow'
        };

      case 'in_progress':
        const currentProvider = session.currentProvider || session.providerSessions?.[0];
        if (currentProvider) {
          return {
            type: 'redirect',
            provider: currentProvider.provider,
            redirectUrl: currentProvider.redirectUrl,
            amount: currentProvider.amount,
            message: `Complete checkout with ${currentProvider.provider}`
          };
        }
        return { type: 'wait', message: 'Processing...' };

      case 'provider_redirect':
        return {
          type: 'await_return',
          message: 'Waiting for user to complete provider checkout'
        };

      case 'awaiting_webhook':
        return {
          type: 'await_confirmation',
          message: 'Waiting for provider confirmation'
        };

      case 'next_provider':
        return {
          type: 'advance',
          message: 'Ready to proceed to next provider'
        };

      case 'all_completed':
        return {
          type: 'complete',
          success: true,
          message: 'All payments completed successfully',
          approvedAmount: session.approvedAmount
        };

      case 'partial_completed':
        return {
          type: 'partial',
          success: false,
          message: `Partial approval: $${(session.approvedAmount / 100).toFixed(2)} of $${(session.targetAmount / 100).toFixed(2)}`,
          approvedAmount: session.approvedAmount,
          remainingAmount: session.targetAmount - session.approvedAmount,
          options: ['accept_partial', 'resume', 'cancel']
        };

      case 'failed':
        return {
          type: 'failed',
          success: false,
          message: 'No providers approved the payment'
        };

      case 'expired':
        return {
          type: 'expired',
          success: false,
          message: 'Session expired',
          approvedAmount: session.approvedAmount
        };

      case 'cancelled':
        return {
          type: 'cancelled',
          success: false,
          message: 'Session was cancelled'
        };

      default:
        return {
          type: 'unknown',
          message: `Unknown state: ${session.status}`
        };
    }
  }

  /**
   * Calculate progress percentage
   */
  calculateProgress(session) {
    if (!session.totalProviders || session.totalProviders === 0) return 0;

    const completed = session.completedProviders || 0;
    return Math.round((completed / session.totalProviders) * 100);
  }

  /**
   * Calculate coverage percentage
   */
  calculateCoverage(session) {
    if (!session.targetAmount || session.targetAmount === 0) return 0;

    const approved = session.approvedAmount || 0;
    return Math.round((approved / session.targetAmount) * 100);
  }
}

// Export singleton instance and class
const stateMachine = new OrchestrationStateMachine();

module.exports = {
  OrchestrationStateMachine,
  stateMachine,
  VALID_TRANSITIONS,
  TERMINAL_STATES,
  ACTIVE_STATES
};
