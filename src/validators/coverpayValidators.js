const Joi = require('joi');

/**
 * CoverPay BNPL Validation Schemas
 */

const checkoutSchema = Joi.object({
  amount: Joi.number().integer().positive().required()
    .description('Amount in cents'),
  currency: Joi.string().valid('USD').default('USD')
    .description('Currency code'),
  strategy: Joi.string().valid('waterfall', 'split').default('waterfall')
    .description('BNPL routing strategy'),
  merchantOrderId: Joi.string().max(100)
    .description('Your order reference ID'),
  customer: Joi.object({
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    name: Joi.string().max(100),
    firstName: Joi.string().max(50),
    lastName: Joi.string().max(50),
    billingAddress: Joi.object({
      street: Joi.string().max(200),
      city: Joi.string().max(100),
      state: Joi.string().max(50),
      postalCode: Joi.string().max(20),
      country: Joi.string().length(2).default('US')
    }),
    shippingAddress: Joi.object({
      street: Joi.string().max(200),
      city: Joi.string().max(100),
      state: Joi.string().max(50),
      postalCode: Joi.string().max(20),
      country: Joi.string().length(2).default('US')
    })
  }).required().description('Customer information'),
  merchant: Joi.object({
    returnUrl: Joi.string().uri().required(),
    cancelUrl: Joi.string().uri().required(),
    webhookUrl: Joi.string().uri(),
    itemDescription: Joi.string().max(500)
  }).required().description('Merchant configuration'),
  items: Joi.array().items(
    Joi.object({
      name: Joi.string().max(200).required(),
      quantity: Joi.number().integer().positive().required(),
      unitPrice: Joi.number().integer().positive().required(),
      sku: Joi.string().max(100),
      category: Joi.string().max(100)
    })
  ).description('Line items for the order'),
  metadata: Joi.object().description('Additional custom data')
});

const getTransactionSchema = Joi.object({
  transactionId: Joi.string().uuid().required()
    .description('CoverPay transaction ID')
});

const analyticsQuerySchema = Joi.object({
  startDate: Joi.date().iso().description('Start date for analytics'),
  endDate: Joi.date().iso().description('End date for analytics'),
  provider: Joi.string().valid('klarna', 'affirm', 'afterpay', 'sezzle', 'zip', 'paypal')
    .description('Filter by provider')
});

const providerStatsQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30)
    .description('Number of days to look back')
});

const webhookSchema = Joi.object({
  provider: Joi.string().valid('klarna', 'affirm', 'afterpay', 'sezzle', 'zip', 'paypal').required(),
  event: Joi.string().required(),
  transactionId: Joi.string(),
  sessionId: Joi.string(),
  status: Joi.string(),
  data: Joi.object()
}).unknown(true); // Allow additional provider-specific fields

module.exports = {
  checkoutSchema,
  getTransactionSchema,
  analyticsQuerySchema,
  providerStatsQuerySchema,
  webhookSchema
};
