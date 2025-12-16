/**
 * CoverPay User Orchestration Module
 *
 * Manages multi-provider BNPL checkout flows (fractured payments).
 *
 * Components:
 * - OrchestrationService: Main service for session management
 * - PrequalificationService: Pre-checkout eligibility checks
 * - OrchestrationStateMachine: State transitions and validation
 */
const OrchestrationService = require('./OrchestrationService');
const PrequalificationService = require('./PrequalificationService');
const {
  OrchestrationStateMachine,
  stateMachine,
  VALID_TRANSITIONS,
  TERMINAL_STATES,
  ACTIVE_STATES
} = require('./OrchestrationStateMachine');

module.exports = {
  OrchestrationService,
  PrequalificationService,
  OrchestrationStateMachine,
  stateMachine,
  VALID_TRANSITIONS,
  TERMINAL_STATES,
  ACTIVE_STATES
};
