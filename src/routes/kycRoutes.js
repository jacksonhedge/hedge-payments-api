const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kycController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  initiateKYCSchema,
  submitDocumentsSchema,
  getKYCStatusSchema,
} = require('../validators/kycValidators');

/**
 * @route   POST /api/kyc/initiate
 * @desc    Initiate KYC verification
 * @access  Private
 */
router.post('/initiate', authenticate, validate(initiateKYCSchema), kycController.initiateKYC);

/**
 * @route   GET /api/kyc/status/:userId
 * @desc    Get KYC status
 * @access  Private
 */
router.get('/status/:userId', authenticate, validate(getKYCStatusSchema, 'params'), kycController.getKYCStatus);

/**
 * @route   POST /api/kyc/:userId/documents
 * @desc    Submit KYC documents
 * @access  Private
 */
router.post('/:userId/documents', authenticate, validate(submitDocumentsSchema), kycController.submitDocuments);

/**
 * @route   PUT /api/kyc/:userId
 * @desc    Update KYC information
 * @access  Private
 */
router.put('/:userId', authenticate, kycController.updateKYC);

/**
 * @route   GET /api/kyc/requirements
 * @desc    Get KYC requirements by country
 * @access  Private
 */
router.get('/requirements', authenticate, kycController.getKYCRequirements);

module.exports = router;
