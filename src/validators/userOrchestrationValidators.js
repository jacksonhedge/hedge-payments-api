const Joi = require('joi');

/**
 * User Orchestration Validation Schemas
 */

// Customer schema (reusable)
const customerSchema = Joi.object({
  email: Joi.string().email().required()
    .description('Customer email'),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required()
    .description('Customer phone (E.164 format preferred)'),
  userId: Joi.string().uuid()
    .description('User ID if authenticated'),
  name: Joi.string().max(100)
    .description('Full name'),
  firstName: Joi.string().max(50)
    .description('First name'),
  lastName: Joi.string().max(50)
    .description('Last name'),
  billingAddress: Joi.object({
    street: Joi.string().max(200),
    city: Joi.string().max(100),
    state: Joi.string().max(50),
    postalCode: Joi.string().max(20),
    country: Joi.string().length(2).default('US')
  }).description('Billing address'),
  shippingAddress: Joi.object({
    street: Joi.string().max(200),
    city: Joi.string().max(100),
    state: Joi.string().max(50),
    postalCode: Joi.string().max(20),
    country: Joi.string().length(2).default('US')
  }).description('Shipping address')
}).required();

// Pre-qualification schema
const prequalifySchema = Joi.object({
  customer: customerSchema,
  amount: Joi.number().integer().positive()
    .description('Optional amount to check eligibility for (in cents)'),
  forceRefresh: Joi.boolean().default(false)
    .description('Bypass cache and check providers directly')
});

// Merchant schema for orchestration
const merchantSchema = Joi.object({
  orderId: Joi.string().max(100)
    .description('Your order reference ID'),
  returnUrl: Joi.string().uri().required()
    .description('URL to redirect after provider checkout'),
  cancelUrl: Joi.string().uri().required()
    .description('URL to redirect if user cancels'),
  webhookUrl: Joi.string().uri()
    .description('Webhook URL for status updates'),
  itemDescription: Joi.string().max(500)
    .description('Description of purchase')
}).required();

// Fractured options schema
const fracturedOptionsSchema = Joi.object({
  minChunkSize: Joi.number().integer().min(1000).max(100000).default(3500)
    .description('Minimum amount per provider in cents (default $35)'),
  maxProviders: Joi.number().integer().min(2).max(10).default(6)
    .description('Maximum providers to use'),
  startingChunkPercent: Joi.number().integer().min(10).max(100).default(50)
    .description('Starting percentage of remaining to try'),
  tryFullFirst: Joi.boolean().default(true)
    .description('Try full amount with each provider before fracturing')
});

// Start orchestration schema
const startOrchestrationSchema = Joi.object({
  amount: Joi.number().integer().positive().required()
    .description('Total amount in cents'),
  customer: customerSchema,
  merchant: merchantSchema,
  strategy: Joi.string().valid('fractured', 'maximize').default('fractured')
    .description('Orchestration strategy'),
  deviceId: Joi.string().max(100)
    .description('iOS device identifier for push notifications'),
  apnsToken: Joi.string().max(200)
    .description('Apple Push Notification Service token'),
  returnScheme: Joi.string().max(50)
    .description('iOS URL scheme for deep linking (e.g., "bankroll://")'),
  fracturedOptions: fracturedOptionsSchema
});

// Session ID param schema
const sessionIdSchema = Joi.object({
  sessionId: Joi.string().uuid().required()
    .description('Orchestration session ID')
});

// Provider webhook param schema
const providerWebhookSchema = Joi.object({
  provider: Joi.string()
    .valid('klarna', 'affirm', 'afterpay', 'sezzle', 'zip', 'paypal', 'stripe_bnpl')
    .required()
    .description('BNPL provider name')
});

module.exports = {
  prequalifySchema,
  startOrchestrationSchema,
  sessionIdSchema,
  providerWebhookSchema,
  customerSchema,
  merchantSchema,
  fracturedOptionsSchema
};
