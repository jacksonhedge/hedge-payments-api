const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { getTransactionsSchema, getTransactionSchema } = require('../validators/transactionValidators');
const Joi = require('joi');

const exportSchema = Joi.object({
  format: Joi.string().valid('csv', 'json', 'xlsx').default('csv'),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')),
});

/**
 * @route   GET /api/transactions
 * @desc    Get all transactions with filters
 * @access  Private
 */
router.get('/', authenticate, validate(getTransactionsSchema, 'query'), transactionController.getTransactions);

/**
 * @route   GET /api/transactions/:transactionId
 * @desc    Get single transaction details
 * @access  Private
 */
router.get(
  '/:transactionId',
  authenticate,
  validate(getTransactionSchema, 'params'),
  transactionController.getTransaction
);

/**
 * @route   GET /api/transactions/stats
 * @desc    Get transaction statistics
 * @access  Private
 */
router.get('/stats/summary', authenticate, transactionController.getTransactionStats);

/**
 * @route   GET /api/transactions/export
 * @desc    Export transactions
 * @access  Private
 */
router.get('/export/download', authenticate, validate(exportSchema, 'query'), transactionController.exportTransactions);

module.exports = router;
