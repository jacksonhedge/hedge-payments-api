const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { AuthenticationError } = require('../utils/errors');
const logger = require('../utils/logger');
const merchantRepository = require('../modules/coverpay/db/merchantRepository');

/**
 * JWT Authentication Middleware (for end users)
 */
const authenticate = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    // Extract token
    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new AuthenticationError('Invalid token format');
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Add user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      merchantId: decoded.merchantId,
    };

    logger.debug('User authenticated:', { userId: decoded.userId });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new AuthenticationError('Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      next(new AuthenticationError('Token expired'));
    } else {
      next(error);
    }
  }
};

/**
 * Optional Authentication - doesn't fail if no token
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, config.jwt.secret);

      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        merchantId: decoded.merchantId,
      };
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Merchant API Key Authentication
 * Validates X-API-Key header against merchant database
 * Use for all CoverPay/CoinFlow API endpoints
 */
const authenticateMerchant = async (req, res, next) => {
  try {
    // Check for API key in X-API-Key header (preferred) or Authorization header
    const apiKey = req.headers['x-api-key'] || extractBearerToken(req.headers.authorization);

    if (!apiKey) {
      throw new AuthenticationError('API key required. Provide X-API-Key header.');
    }

    // Validate API key format
    if (!apiKey.startsWith('pk_test_') && !apiKey.startsWith('pk_live_')) {
      throw new AuthenticationError('Invalid API key format. Use pk_test_* or pk_live_* keys.');
    }

    // Look up merchant by API key
    const merchant = await merchantRepository.getByApiKey(apiKey);

    if (!merchant) {
      throw new AuthenticationError('Invalid API key');
    }

    if (merchant.status !== 'active') {
      throw new AuthenticationError(`Merchant account is ${merchant.status}`);
    }

    // Check environment match (test keys only work in sandbox)
    const isTestKey = apiKey.startsWith('pk_test_');
    if (!isTestKey && merchant.environment !== 'production') {
      throw new AuthenticationError('Live keys cannot be used in sandbox mode');
    }

    // Add merchant context to request
    req.merchant = {
      id: merchant.id,
      name: merchant.name,
      slug: merchant.slug,
      environment: merchant.environment,
      isTestMode: isTestKey,
      coverpayEnabled: merchant.coverpayEnabled,
      coinflowEnabled: merchant.coinflowEnabled,
    };

    logger.debug('Merchant authenticated:', { merchantId: merchant.id, slug: merchant.slug });

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Merchant Secret Key Authentication
 * Requires both API key and secret for sensitive operations
 * Use for webhook configuration, key rotation, etc.
 */
const authenticateMerchantSecret = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const apiSecret = req.headers['x-api-secret'];

    if (!apiKey || !apiSecret) {
      throw new AuthenticationError('Both X-API-Key and X-API-Secret headers required');
    }

    // Verify both keys match
    const result = await merchantRepository.verifyApiSecret(apiKey, apiSecret);

    if (!result.valid) {
      const messages = {
        merchant_not_found: 'Invalid API key',
        invalid_secret: 'Invalid API secret',
        merchant_inactive: `Merchant account is ${result.status}`,
      };
      throw new AuthenticationError(messages[result.reason] || 'Authentication failed');
    }

    // Get full merchant data
    const merchant = await merchantRepository.getById(result.merchantId);

    req.merchant = {
      id: merchant.id,
      name: merchant.name,
      slug: merchant.slug,
      environment: merchant.environment,
      isTestMode: apiKey.startsWith('sk_test_'),
      coverpayEnabled: merchant.coverpayEnabled,
      coinflowEnabled: merchant.coinflowEnabled,
    };

    logger.debug('Merchant secret authenticated:', { merchantId: merchant.id });

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Require CoverPay product to be enabled
 * Use after authenticateMerchant middleware
 */
const requireCoverpay = (req, res, next) => {
  if (!req.merchant) {
    return next(new AuthenticationError('Merchant authentication required'));
  }

  if (!req.merchant.coverpayEnabled) {
    return next(new AuthenticationError('CoverPay is not enabled for this merchant'));
  }

  next();
};

/**
 * Require CoinFlow product to be enabled
 * Use after authenticateMerchant middleware
 */
const requireCoinflow = (req, res, next) => {
  if (!req.merchant) {
    return next(new AuthenticationError('Merchant authentication required'));
  }

  if (!req.merchant.coinflowEnabled) {
    return next(new AuthenticationError('CoinFlow is not enabled for this merchant'));
  }

  next();
};

/**
 * Combined auth: JWT for user + API key for merchant
 * Used when both user and merchant context are needed
 */
const authenticateUserAndMerchant = async (req, res, next) => {
  try {
    // First authenticate merchant
    await new Promise((resolve, reject) => {
      authenticateMerchant(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Then authenticate user (optional - may be guest checkout)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, config.jwt.secret);
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
        };
      } catch (jwtError) {
        // User auth is optional for guest checkout
        logger.debug('JWT auth failed, continuing as guest:', jwtError.message);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to extract token from Bearer authorization
 */
const extractBearerToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.split(' ')[1];
};

module.exports = {
  // User authentication
  authenticate,
  optionalAuth,

  // Merchant (B2B) authentication
  authenticateMerchant,
  authenticateMerchantSecret,
  requireCoverpay,
  requireCoinflow,
  authenticateUserAndMerchant,
};
