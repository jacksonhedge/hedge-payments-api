const express = require('express');
const router = express.Router();
const balanceController = require('../controllers/balanceController');
const { authenticate } = require('../middleware/auth');
const Joi = require('joi');
const validate = require('../middleware/validate');

// Validation schemas
const getBalanceSchema = Joi.object({
  currency: Joi.string().valid('USD', 'EUR', 'GBP', 'BTC', 'ETH', 'USDC', 'USDT').default('USD'),
});

const balanceHistorySchema = Joi.object({
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')),
  currency: Joi.string().valid('USD', 'EUR', 'GBP', 'BTC', 'ETH', 'USDC', 'USDT').default('USD'),
});

const createPayoutSchema = Joi.object({
  amount: Joi.number().positive().required(),
  currency: Joi.string().valid('USD', 'EUR', 'GBP', 'BTC', 'ETH', 'USDC', 'USDT').default('USD'),
  destination: Joi.string().required(),
  destinationType: Joi.string().valid('bank_account', 'crypto_wallet', 'paypal').required(),
  description: Joi.string().max(500),
});

/**
 * @route   GET /api/balance
 * @desc    Get account balance
 * @access  Private
 */
router.get('/', authenticate, validate(getBalanceSchema, 'query'), balanceController.getBalance);

/**
 * @route   GET /api/balance/history
 * @desc    Get balance history
 * @access  Private
 */
router.get('/history', authenticate, validate(balanceHistorySchema, 'query'), balanceController.getBalanceHistory);

/**
 * @route   POST /api/balance/payout
 * @desc    Create a payout
 * @access  Private
 */
router.post('/payout', authenticate, validate(createPayoutSchema), balanceController.createPayout);

/**
 * @route   GET /api/balance/payouts
 * @desc    Get all payouts
 * @access  Private
 */
router.get('/payouts', authenticate, balanceController.getPayouts);

/**
 * @route   GET /api/balance/payouts/:payoutId
 * @desc    Get payout details
 * @access  Private
 */
router.get('/payouts/:payoutId', authenticate, balanceController.getPayout);

module.exports = router;
