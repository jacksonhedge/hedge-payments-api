const coinflowService = require('../services/coinflowService');
const logger = require('../utils/logger');

/**
 * KYC Controller
 * Handles KYC verification operations
 */

/**
 * Initiate KYC verification
 */
exports.initiateKYC = async (req, res, next) => {
  try {
    const kycData = {
      ...req.body,
      initiatedAt: new Date().toISOString(),
      initiatedBy: req.user.userId,
    };

    logger.info('Initiating KYC:', { userId: kycData.userId });

    const result = await coinflowService.initiateKYC(kycData);

    res.status(201).json({
      success: true,
      data: result,
      message: 'KYC verification initiated',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get KYC status
 */
exports.getKYCStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;

    logger.info('Fetching KYC status:', { userId });

    const status = await coinflowService.getKYCStatus(userId);

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit KYC documents
 */
exports.submitDocuments = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { documents } = req.body;

    logger.info('Submitting KYC documents:', {
      userId,
      documentCount: documents.length,
    });

    const result = await coinflowService.submitKYCDocuments(userId, documents);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Documents submitted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update KYC information
 */
exports.updateKYC = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    logger.info('Updating KYC information:', { userId });

    // TODO: Implement KYC update with Coinflow
    const result = {
      userId,
      status: 'updated',
      updatedAt: new Date().toISOString(),
    };

    res.status(200).json({
      success: true,
      data: result,
      message: 'KYC information updated',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get KYC requirements
 */
exports.getKYCRequirements = async (req, res, next) => {
  try {
    const { country } = req.query;

    logger.info('Fetching KYC requirements:', { country });

    // TODO: Implement requirements logic based on country
    const requirements = {
      country: country || 'US',
      requiredDocuments: [
        {
          type: 'passport',
          description: 'Valid passport',
          required: true,
        },
        {
          type: 'proof_of_address',
          description: 'Utility bill or bank statement (last 3 months)',
          required: true,
        },
      ],
      minimumAge: 18,
      additionalInfo: 'Additional verification may be required for high-value transactions',
    };

    res.status(200).json({
      success: true,
      data: requirements,
    });
  } catch (error) {
    next(error);
  }
};
