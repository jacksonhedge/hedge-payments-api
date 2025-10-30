const Joi = require('joi');

/**
 * Payment Validation Schemas
 */

const createPaymentSchema = Joi.object({
  amount: Joi.number().positive().required().description('Payment amount'),
  currency: Joi.string()
    .valid('USD', 'EUR', 'GBP', 'BTC', 'ETH', 'USDC', 'USDT')
    .default('USD')
    .description('Payment currency'),
  customerEmail: Joi.string().email().required().description('Customer email'),
  customerName: Joi.string().min(2).max(100).description('Customer name'),
  description: Joi.string().max(500).description('Payment description'),
  metadata: Joi.object().description('Additional metadata'),
  successUrl: Joi.string().uri().description('Success redirect URL'),
  cancelUrl: Joi.string().uri().description('Cancel redirect URL'),
  webhookUrl: Joi.string().uri().description('Webhook notification URL'),
});

const getPaymentSchema = Joi.object({
  paymentId: Joi.string().required().description('Payment ID'),
});

const cancelPaymentSchema = Joi.object({
  paymentId: Joi.string().required().description('Payment ID'),
  reason: Joi.string().max(500).description('Cancellation reason'),
});

const refundPaymentSchema = Joi.object({
  paymentId: Joi.string().required().description('Payment ID'),
  amount: Joi.number().positive().description('Refund amount (partial or full)'),
  reason: Joi.string().max(500).required().description('Refund reason'),
});

module.exports = {
  createPaymentSchema,
  getPaymentSchema,
  cancelPaymentSchema,
  refundPaymentSchema,
};
