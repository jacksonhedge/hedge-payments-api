const Joi = require('joi');

/**
 * Authentication Validation Schemas
 */

const loginSchema = Joi.object({
  email: Joi.string().email().required().description('User email'),
  password: Joi.string().min(8).required().description('User password'),
  merchantId: Joi.string().required().description('Merchant ID'),
});

const refreshTokenSchema = Joi.object({
  token: Joi.string().required().description('Refresh token'),
});

const generateApiKeySchema = Joi.object({
  name: Joi.string().min(3).max(50).required().description('API key name'),
  permissions: Joi.array()
    .items(Joi.string().valid('read', 'write', 'admin'))
    .default(['read'])
    .description('API key permissions'),
});

module.exports = {
  loginSchema,
  refreshTokenSchema,
  generateApiKeySchema,
};
