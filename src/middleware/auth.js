const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { AuthenticationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * JWT Authentication Middleware
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

module.exports = {
  authenticate,
  optionalAuth,
};
