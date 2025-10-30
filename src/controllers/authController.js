const authService = require('../services/authService');
const logger = require('../utils/logger');

/**
 * Authentication Controller
 * Handles authentication and authorization
 */

/**
 * Login and get JWT token
 */
exports.login = async (req, res, next) => {
  try {
    const credentials = req.body;

    logger.info('User login attempt:', { email: credentials.email });

    const authResult = await authService.authenticate(credentials);

    res.status(200).json({
      success: true,
      data: authResult,
      message: 'Authentication successful',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh JWT token
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    logger.info('Token refresh request');

    const authResult = await authService.refreshToken(token);

    res.status(200).json({
      success: true,
      data: authResult,
      message: 'Token refreshed successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate API key
 */
exports.generateApiKey = async (req, res, next) => {
  try {
    const { name, permissions } = req.body;

    logger.info('Generating API key:', {
      userId: req.user.userId,
      name,
      permissions,
    });

    const apiKey = authService.generateApiKey();

    // TODO: Store API key in database
    const result = {
      apiKey,
      name,
      permissions,
      createdAt: new Date().toISOString(),
      expiresAt: null, // No expiration by default
    };

    res.status(201).json({
      success: true,
      data: result,
      message: 'API key generated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user info
 */
exports.getCurrentUser = async (req, res, next) => {
  try {
    logger.info('Fetching current user:', { userId: req.user.userId });

    // In production, fetch from database
    const user = {
      userId: req.user.userId,
      email: req.user.email,
      merchantId: req.user.merchantId,
    };

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout (invalidate token)
 */
exports.logout = async (req, res, next) => {
  try {
    logger.info('User logout:', { userId: req.user.userId });

    // TODO: Implement token blacklist in production

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};
