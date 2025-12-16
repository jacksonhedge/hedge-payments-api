/**
 * Merchant Controller
 *
 * Handles merchant onboarding, account management, and API key operations.
 * This is the B2B interface for businesses signing up to use Hedge Payments.
 */

const merchantRepository = require('../modules/coverpay/db/merchantRepository');
const { validationResult } = require('express-validator');

/**
 * POST /api/merchants/register
 * Self-service merchant registration
 */
async function registerMerchant(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        details: errors.array()
      });
    }

    const {
      businessName,
      email,
      website,
      products = ['coverpay'], // Default to CoverPay
      webhookUrl,
      metadata = {}
    } = req.body;

    // Generate slug from business name
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if slug already exists
    const existing = await merchantRepository.getBySlug(slug);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'merchant_exists',
        message: 'A merchant with this name already exists'
      });
    }

    // Create the merchant
    const merchant = await merchantRepository.create({
      name: businessName,
      slug,
      email,
      environment: 'sandbox', // Start in sandbox
      webhookUrl,
      coverpayEnabled: products.includes('coverpay'),
      coinflowEnabled: products.includes('coinflow'),
      metadata: {
        ...metadata,
        website,
        registrationSource: 'api',
        registeredAt: new Date().toISOString()
      }
    });

    console.log(`[Merchant] New merchant registered: ${merchant.name} (${merchant.slug})`);

    res.status(201).json({
      success: true,
      message: 'Merchant account created successfully',
      data: {
        merchantId: merchant.id,
        name: merchant.name,
        slug: merchant.slug,
        environment: merchant.environment,
        apiKey: merchant.apiKey,
        apiSecret: merchant.apiSecret, // Only returned on registration
        webhookSecret: merchant.webhookSecret,
        products: {
          coverpay: merchant.coverpayEnabled,
          coinflow: merchant.coinflowEnabled
        },
        nextSteps: [
          'Save your API credentials securely - the secret won\'t be shown again',
          'Integrate using our SDK or API documentation',
          'Test in sandbox mode before going live',
          'Contact support to enable production access'
        ],
        documentation: 'https://docs.hedgepayments.com'
      }
    });
  } catch (error) {
    console.error('[Merchant] Registration failed:', error);
    res.status(500).json({
      success: false,
      error: 'registration_failed',
      message: error.message
    });
  }
}

/**
 * GET /api/merchants/me
 * Get current merchant profile (requires API key auth)
 */
async function getMerchantProfile(req, res) {
  try {
    const merchant = req.merchant;

    res.json({
      success: true,
      data: {
        id: merchant.id,
        name: merchant.name,
        slug: merchant.slug,
        email: merchant.email,
        environment: merchant.environment,
        webhookUrl: merchant.webhookUrl,
        products: {
          coverpay: merchant.coverpayEnabled,
          coinflow: merchant.coinflowEnabled
        },
        status: merchant.status,
        createdAt: merchant.createdAt
      }
    });
  } catch (error) {
    console.error('[Merchant] Failed to get profile:', error);
    res.status(500).json({
      success: false,
      error: 'fetch_failed',
      message: error.message
    });
  }
}

/**
 * PATCH /api/merchants/me
 * Update merchant settings (requires API key auth)
 */
async function updateMerchantProfile(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        details: errors.array()
      });
    }

    const merchantId = req.merchant.id;
    const allowedUpdates = ['webhookUrl', 'email', 'metadata'];

    // Filter to only allowed fields
    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'no_updates',
        message: 'No valid fields to update'
      });
    }

    const merchant = await merchantRepository.update(merchantId, updates);

    res.json({
      success: true,
      message: 'Merchant profile updated',
      data: {
        id: merchant.id,
        name: merchant.name,
        webhookUrl: merchant.webhookUrl,
        email: merchant.email,
        updatedAt: merchant.updatedAt
      }
    });
  } catch (error) {
    console.error('[Merchant] Failed to update profile:', error);
    res.status(500).json({
      success: false,
      error: 'update_failed',
      message: error.message
    });
  }
}

/**
 * POST /api/merchants/me/rotate-keys
 * Rotate API keys (requires API key + secret auth)
 */
async function rotateApiKeys(req, res) {
  try {
    const merchantId = req.merchant.id;

    const merchant = await merchantRepository.rotateApiKeys(merchantId);

    console.log(`[Merchant] API keys rotated for: ${merchant.slug}`);

    res.json({
      success: true,
      message: 'API keys rotated successfully',
      data: {
        apiKey: merchant.apiKey,
        apiSecret: merchant.apiSecret,
        warning: 'Your old API keys are now invalid. Update your integration immediately.'
      }
    });
  } catch (error) {
    console.error('[Merchant] Failed to rotate keys:', error);
    res.status(500).json({
      success: false,
      error: 'rotation_failed',
      message: error.message
    });
  }
}

/**
 * GET /api/merchants/me/stats
 * Get merchant usage statistics (requires API key auth)
 */
async function getMerchantStats(req, res) {
  try {
    const merchantId = req.merchant.id;

    // Get orchestration stats if available
    let orchestrationStats = null;
    try {
      const orchestrationRepository = require('../modules/coverpay/db/orchestrationRepository');
      orchestrationStats = await orchestrationRepository.getMerchantStats(merchantId);
    } catch (e) {
      // Stats not available
    }

    // Get prequalification stats if available
    let prequalStats = null;
    try {
      const prequalRepository = require('../modules/coverpay/db/prequalificationRepository');
      const prequals = await prequalRepository.getMerchantPrequalifications(merchantId, { limit: 1000 });
      prequalStats = {
        totalPrequalifications: prequals.total,
        last30Days: prequals.prequalifications.filter(p => {
          const date = new Date(p.createdAt);
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          return date > thirtyDaysAgo;
        }).length
      };
    } catch (e) {
      // Stats not available
    }

    res.json({
      success: true,
      data: {
        merchantId,
        environment: req.merchant.environment,
        orchestration: orchestrationStats || { message: 'No orchestration data yet' },
        prequalification: prequalStats || { message: 'No prequalification data yet' },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Merchant] Failed to get stats:', error);
    res.status(500).json({
      success: false,
      error: 'stats_failed',
      message: error.message
    });
  }
}

/**
 * POST /api/merchants/me/request-production
 * Request production access (requires API key auth)
 */
async function requestProductionAccess(req, res) {
  try {
    const merchant = req.merchant;

    if (merchant.environment === 'production') {
      return res.status(400).json({
        success: false,
        error: 'already_production',
        message: 'Merchant is already in production mode'
      });
    }

    const { businessDetails, complianceInfo } = req.body;

    // In a real implementation, this would:
    // 1. Create a review request in an admin dashboard
    // 2. Send notification to Hedge Payments team
    // 3. Trigger compliance checks

    console.log(`[Merchant] Production access requested: ${merchant.slug}`);

    // Update metadata with request
    await merchantRepository.update(merchant.id, {
      metadata: {
        ...merchant.metadata,
        productionRequested: true,
        productionRequestedAt: new Date().toISOString(),
        businessDetails,
        complianceInfo
      }
    });

    res.json({
      success: true,
      message: 'Production access request submitted',
      data: {
        status: 'pending_review',
        estimatedReviewTime: '1-2 business days',
        nextSteps: [
          'Our team will review your application',
          'You may be contacted for additional information',
          'Once approved, your account will be upgraded to production'
        ]
      }
    });
  } catch (error) {
    console.error('[Merchant] Failed to request production:', error);
    res.status(500).json({
      success: false,
      error: 'request_failed',
      message: error.message
    });
  }
}

module.exports = {
  registerMerchant,
  getMerchantProfile,
  updateMerchantProfile,
  rotateApiKeys,
  getMerchantStats,
  requestProductionAccess
};
