const express = require('express');
const router = express.Router();
const coverpayController = require('../controllers/coverpayController');
const userOrchestrationController = require('../controllers/userOrchestrationController');
const {
  authenticate,
  authenticateMerchant,
  requireCoverpay
} = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  checkoutSchema,
  getTransactionSchema,
  analyticsQuerySchema,
  providerStatsQuerySchema,
  webhookSchema
} = require('../validators/coverpayValidators');
const {
  prequalifySchema,
  startOrchestrationSchema,
  sessionIdSchema,
  providerWebhookSchema
} = require('../validators/userOrchestrationValidators');

/**
 * CoverPay BNPL Routes (B2B API)
 * Intelligent routing across 7 BNPL providers:
 * Klarna, Affirm, Afterpay, Sezzle, Zip, PayPal, Stripe BNPL (fallback)
 *
 * Authentication:
 * - Orchestration endpoints use merchant API key (X-API-Key header)
 * - Legacy endpoints still use JWT for backwards compatibility
 */

/**
 * @route   GET /api/coverpay/health
 * @desc    Health check for CoverPay service
 * @access  Public
 */
router.get('/health', coverpayController.healthCheck);

// ==========================================
// LEGACY ENDPOINTS (JWT Auth - backwards compatible)
// ==========================================

/**
 * @route   POST /api/coverpay/checkout
 * @desc    Process BNPL checkout with intelligent routing
 * @access  Private (JWT)
 *
 * Strategies:
 * - waterfall: Try providers sequentially until approval
 * - split: Divide payment evenly across 2 providers
 * - fractured: MAXIMIZE approval by splitting across multiple providers
 */
router.post(
  '/checkout',
  authenticate,
  validate(checkoutSchema),
  coverpayController.processCheckout
);

/**
 * @route   GET /api/coverpay/transactions
 * @desc    Get list of transactions for merchant
 * @access  Private (JWT)
 */
router.get(
  '/transactions',
  authenticate,
  coverpayController.getTransactions
);

/**
 * @route   GET /api/coverpay/transactions/:transactionId
 * @desc    Get transaction details and attempts
 * @access  Private (JWT)
 */
router.get(
  '/transactions/:transactionId',
  authenticate,
  validate(getTransactionSchema, 'params'),
  coverpayController.getTransaction
);

/**
 * @route   GET /api/coverpay/analytics
 * @desc    Get approval rates and volume analytics
 * @access  Private (JWT)
 */
router.get(
  '/analytics',
  authenticate,
  validate(analyticsQuerySchema, 'query'),
  coverpayController.getAnalytics
);

/**
 * @route   GET /api/coverpay/providers/stats
 * @desc    Get provider performance statistics
 * @access  Private (JWT)
 */
router.get(
  '/providers/stats',
  authenticate,
  validate(providerStatsQuerySchema, 'query'),
  coverpayController.getProviderStats
);

/**
 * @route   POST /api/coverpay/webhook
 * @desc    Handle webhooks from BNPL providers
 * @access  Public (verified by provider signature)
 */
router.post(
  '/webhook',
  validate(webhookSchema),
  coverpayController.handleWebhook
);

/**
 * @route   POST /api/coverpay/webhook/:provider
 * @desc    Handle provider-specific webhooks
 * @access  Public (verified by provider signature)
 */
router.post(
  '/webhook/:provider',
  (req, res, next) => {
    req.body.provider = req.params.provider;
    next();
  },
  coverpayController.handleWebhook
);

// ==========================================
// USER ORCHESTRATION ROUTES (B2B API Key Auth)
// ==========================================

/**
 * @route   POST /api/coverpay/prequalify
 * @desc    Check user eligibility across all BNPL providers
 * @access  Merchant API Key + CoverPay enabled
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
 * @access  Merchant API Key + CoverPay enabled
 */
router.get(
  '/prequalify/:customerId',
  authenticateMerchant,
  requireCoverpay,
  userOrchestrationController.getCachedPrequalification
);

/**
 * @route   POST /api/coverpay/orchestration/start
 * @desc    Start a fractured checkout orchestration
 * @access  Merchant API Key + CoverPay enabled
 *
 * Creates provider sessions for fractured payment flow.
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
 * @access  Merchant API Key + CoverPay enabled
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
 * @access  Merchant API Key + CoverPay enabled
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
 * @access  Merchant API Key + CoverPay enabled
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
 * @access  Merchant API Key + CoverPay enabled
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
 * @access  Merchant API Key + CoverPay enabled
 */
router.post(
  '/orchestration/:sessionId/cancel',
  authenticateMerchant,
  requireCoverpay,
  validate(sessionIdSchema, 'params'),
  userOrchestrationController.cancelOrchestration
);

/**
 * @route   POST /api/coverpay/orchestration/webhook/:provider
 * @desc    Handle orchestration-specific provider webhooks
 * @access  Public (verified by provider signature)
 */
router.post(
  '/orchestration/webhook/:provider',
  validate(providerWebhookSchema, 'params'),
  userOrchestrationController.handleProviderWebhook
);

module.exports = router;
