/**
 * Merchant Routes
 *
 * B2B API routes for merchant onboarding and account management.
 *
 * Public Routes (no auth):
 *   POST /api/merchants/register - Self-service registration
 *
 * Authenticated Routes (API key required):
 *   GET  /api/merchants/me - Get merchant profile
 *   PATCH /api/merchants/me - Update merchant settings
 *   GET  /api/merchants/me/stats - Get usage statistics
 *   POST /api/merchants/me/request-production - Request production access
 *
 * Sensitive Routes (API key + secret required):
 *   POST /api/merchants/me/rotate-keys - Rotate API credentials
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const merchantController = require('../controllers/merchantController');
const { authenticateMerchant, authenticateMerchantSecret } = require('../middleware/auth');

// =============================================================================
// VALIDATION RULES
// =============================================================================

const registerValidation = [
  body('businessName')
    .trim()
    .notEmpty()
    .withMessage('Business name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Business name must be 2-100 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('website')
    .optional()
    .trim()
    .isURL()
    .withMessage('Invalid website URL'),

  body('products')
    .optional()
    .isArray()
    .withMessage('Products must be an array')
    .custom((value) => {
      const validProducts = ['coverpay', 'coinflow'];
      for (const product of value) {
        if (!validProducts.includes(product)) {
          throw new Error(`Invalid product: ${product}. Valid products: ${validProducts.join(', ')}`);
        }
      }
      return true;
    }),

  body('webhookUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Invalid webhook URL'),

  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

const updateValidation = [
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('webhookUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Invalid webhook URL'),

  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

const productionRequestValidation = [
  body('businessDetails')
    .optional()
    .isObject()
    .withMessage('Business details must be an object'),

  body('complianceInfo')
    .optional()
    .isObject()
    .withMessage('Compliance info must be an object')
];

// =============================================================================
// PUBLIC ROUTES (No Authentication)
// =============================================================================

/**
 * @route   POST /api/merchants/register
 * @desc    Register a new merchant account
 * @access  Public
 *
 * @body    {string} businessName - Company name
 * @body    {string} email - Contact email
 * @body    {string} [website] - Company website
 * @body    {string[]} [products] - Products to enable: ['coverpay', 'coinflow']
 * @body    {string} [webhookUrl] - Webhook endpoint URL
 * @body    {object} [metadata] - Additional metadata
 *
 * @returns {object} Merchant credentials (API key, secret, webhook secret)
 */
router.post('/register', registerValidation, merchantController.registerMerchant);

// =============================================================================
// AUTHENTICATED ROUTES (API Key Required)
// =============================================================================

/**
 * @route   GET /api/merchants/me
 * @desc    Get current merchant profile
 * @access  Private (API Key)
 * @header  X-API-Key: pk_test_xxx or pk_live_xxx
 */
router.get('/me', authenticateMerchant, merchantController.getMerchantProfile);

/**
 * @route   PATCH /api/merchants/me
 * @desc    Update merchant settings
 * @access  Private (API Key)
 * @header  X-API-Key: pk_test_xxx or pk_live_xxx
 *
 * @body    {string} [email] - New contact email
 * @body    {string} [webhookUrl] - New webhook URL
 * @body    {object} [metadata] - Updated metadata
 */
router.patch('/me', authenticateMerchant, updateValidation, merchantController.updateMerchantProfile);

/**
 * @route   GET /api/merchants/me/stats
 * @desc    Get merchant usage statistics
 * @access  Private (API Key)
 * @header  X-API-Key: pk_test_xxx or pk_live_xxx
 */
router.get('/me/stats', authenticateMerchant, merchantController.getMerchantStats);

/**
 * @route   POST /api/merchants/me/request-production
 * @desc    Request production access
 * @access  Private (API Key)
 * @header  X-API-Key: pk_test_xxx or pk_live_xxx
 *
 * @body    {object} [businessDetails] - Additional business information
 * @body    {object} [complianceInfo] - Compliance documentation
 */
router.post(
  '/me/request-production',
  authenticateMerchant,
  productionRequestValidation,
  merchantController.requestProductionAccess
);

// =============================================================================
// SENSITIVE ROUTES (API Key + Secret Required)
// =============================================================================

/**
 * @route   POST /api/merchants/me/rotate-keys
 * @desc    Rotate API credentials
 * @access  Private (API Key + Secret)
 * @header  X-API-Key: pk_test_xxx or pk_live_xxx
 * @header  X-API-Secret: sk_test_xxx or sk_live_xxx
 *
 * @returns {object} New API credentials (old keys immediately invalidated)
 */
router.post('/me/rotate-keys', authenticateMerchantSecret, merchantController.rotateApiKeys);

module.exports = router;
