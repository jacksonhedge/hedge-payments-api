const express = require('express');
const router = express.Router();
const userOrchestrationController = require('../controllers/userOrchestrationController');
const {
  authenticateMerchant,
  authenticateUserAndMerchant,
  requireCoverpay
} = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  prequalifySchema,
  startOrchestrationSchema,
  sessionIdSchema,
  providerWebhookSchema
} = require('../validators/userOrchestrationValidators');

/**
 * User Orchestration Routes (B2B API)
 *
 * Handles BNPL pre-qualification and fractured checkout flows.
 * All endpoints require merchant API key authentication.
 *
 * Authentication:
 * - X-API-Key: pk_test_xxx or pk_live_xxx (required)
 * - Authorization: Bearer <jwt> (optional, for user context)
 */

// ==========================================
// PRE-QUALIFICATION ENDPOINTS
// ==========================================

/**
 * @route   POST /api/coverpay/prequalify
 * @desc    Check user eligibility across all BNPL providers
 * @access  Merchant + CoverPay enabled
 *
 * Headers:
 *   X-API-Key: pk_test_bankroll_xxx
 *
 * Returns total BNPL capacity (sum of all provider limits)
 * Results are cached for 15 minutes (eligible) or 5 minutes (declined)
 */
router.post(
  '/prequalify',
  authenticateMerchant,
  requireCoverpay,
  validate(prequalifySchema),
  userOrchestrationController.prequalify
);

/**
 * @route   GET /api/coverpay/prequalify/:customerId
 * @desc    Get cached prequalification for customer
 * @access  Merchant + CoverPay enabled
 */
router.get(
  '/prequalify/:customerId',
  authenticateMerchant,
  requireCoverpay,
  userOrchestrationController.getCachedPrequalification
);

// ==========================================
// ORCHESTRATION SESSION ENDPOINTS
// ==========================================

/**
 * @route   POST /api/coverpay/orchestration/start
 * @desc    Start a fractured checkout orchestration
 * @access  Merchant + CoverPay enabled
 *
 * Creates provider sessions for fractured payment.
 * Returns first provider's redirect URL.
 */
router.post(
  '/orchestration/start',
  authenticateMerchant,
  requireCoverpay,
  validate(startOrchestrationSchema),
  userOrchestrationController.startOrchestration
);

/**
 * @route   GET /api/coverpay/orchestration/:sessionId
 * @desc    Get orchestration session status (polling endpoint)
 * @access  Merchant + CoverPay enabled
 *
 * iOS/client polls this endpoint to track checkout progress.
 */
router.get(
  '/orchestration/:sessionId',
  authenticateMerchant,
  requireCoverpay,
  validate(sessionIdSchema, 'params'),
  userOrchestrationController.getSessionStatus
);

/**
 * @route   POST /api/coverpay/orchestration/:sessionId/next
 * @desc    Advance to next provider in sequence
 * @access  Merchant + CoverPay enabled
 */
router.post(
  '/orchestration/:sessionId/next',
  authenticateMerchant,
  requireCoverpay,
  validate(sessionIdSchema, 'params'),
  userOrchestrationController.advanceToNextProvider
);

/**
 * @route   POST /api/coverpay/orchestration/:sessionId/returned
 * @desc    Mark that user returned from provider redirect
 * @access  Merchant + CoverPay enabled
 *
 * Called when user returns to app from provider checkout.
 * Moves session to awaiting_webhook state.
 */
router.post(
  '/orchestration/:sessionId/returned',
  authenticateMerchant,
  requireCoverpay,
  validate(sessionIdSchema, 'params'),
  userOrchestrationController.markProviderReturned
);

/**
 * @route   POST /api/coverpay/orchestration/:sessionId/skip
 * @desc    Skip current provider and move to next
 * @access  Merchant + CoverPay enabled
 */
router.post(
  '/orchestration/:sessionId/skip',
  authenticateMerchant,
  requireCoverpay,
  validate(sessionIdSchema, 'params'),
  userOrchestrationController.skipProvider
);

/**
 * @route   POST /api/coverpay/orchestration/:sessionId/cancel
 * @desc    Cancel orchestration session
 * @access  Merchant + CoverPay enabled
 */
router.post(
  '/orchestration/:sessionId/cancel',
  authenticateMerchant,
  requireCoverpay,
  validate(sessionIdSchema, 'params'),
  userOrchestrationController.cancelOrchestration
);

// ==========================================
// WEBHOOK ENDPOINTS (Public)
// ==========================================

/**
 * @route   POST /api/coverpay/webhook/:provider
 * @desc    Handle provider webhooks
 * @access  Public (verified by provider signature)
 *
 * Providers: klarna, affirm, afterpay, sezzle, zip, paypal, stripe_bnpl
 *
 * Note: Webhook signature verification happens in controller
 */
router.post(
  '/webhook/:provider',
  validate(providerWebhookSchema, 'params'),
  userOrchestrationController.handleProviderWebhook
);

module.exports = router;
