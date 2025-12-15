const express = require('express');
const router = express.Router();
const coverpayController = require('../controllers/coverpayController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  checkoutSchema,
  getTransactionSchema,
  analyticsQuerySchema,
  providerStatsQuerySchema,
  webhookSchema
} = require('../validators/coverpayValidators');

/**
 * CoverPay BNPL Routes
 * Intelligent routing across 6 BNPL providers:
 * Klarna, Affirm, Afterpay, Sezzle, Zip, PayPal
 */

/**
 * @route   GET /api/coverpay/health
 * @desc    Health check for CoverPay service
 * @access  Public
 */
router.get('/health', coverpayController.healthCheck);

/**
 * @route   POST /api/coverpay/checkout
 * @desc    Process BNPL checkout with intelligent routing
 * @access  Private
 *
 * Strategies:
 * - waterfall: Try providers sequentially until approval
 * - split: Divide payment across 2 providers
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
 * @access  Private
 */
router.get(
  '/transactions',
  authenticate,
  coverpayController.getTransactions
);

/**
 * @route   GET /api/coverpay/transactions/:transactionId
 * @desc    Get transaction details and attempts
 * @access  Private
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
 * @access  Private
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
 * @access  Private
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
 *
 * Supported providers: klarna, affirm, afterpay, sezzle, zip, paypal
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
    // Add provider to body for unified processing
    req.body.provider = req.params.provider;
    next();
  },
  coverpayController.handleWebhook
);

module.exports = router;
