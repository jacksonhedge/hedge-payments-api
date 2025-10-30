const Joi = require('joi');

/**
 * Transaction Validation Schemas
 */

const getTransactionsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).description('Page number'),
  limit: Joi.number().integer().min(1).max(100).default(20).description('Items per page'),
  startDate: Joi.date().iso().description('Start date filter'),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).description('End date filter'),
  status: Joi.string()
    .valid('pending', 'completed', 'failed', 'cancelled', 'refunded')
    .description('Transaction status filter'),
  currency: Joi.string()
    .valid('USD', 'EUR', 'GBP', 'BTC', 'ETH', 'USDC', 'USDT')
    .description('Currency filter'),
  minAmount: Joi.number().positive().description('Minimum amount filter'),
  maxAmount: Joi.number().positive().min(Joi.ref('minAmount')).description('Maximum amount filter'),
});

const getTransactionSchema = Joi.object({
  transactionId: Joi.string().required().description('Transaction ID'),
});

module.exports = {
  getTransactionsSchema,
  getTransactionSchema,
};
