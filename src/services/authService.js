const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/config');
const logger = require('../utils/logger');
const { AuthenticationError } = require('../utils/errors');

/**
 * Authentication Service
 * Handles JWT generation and user authentication
 */
class AuthService {
  /**
   * Generate JWT token
   */
  generateToken(payload) {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      throw new AuthenticationError('Invalid or expired token');
    }
  }

  /**
   * Hash password
   */
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate API key for merchant
   */
  generateApiKey() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create authentication token for user
   * In production, this would validate against a database
   */
  async authenticate(credentials) {
    const { email, password, merchantId } = credentials;

    // TODO: In production, validate against database
    // For now, we'll create a token with provided credentials
    logger.info('Authenticating user:', { email, merchantId });

    // In production, verify password here
    // const isValid = await this.comparePassword(password, user.passwordHash);
    // if (!isValid) throw new AuthenticationError('Invalid credentials');

    const token = this.generateToken({
      userId: email, // In production, use actual user ID
      email,
      merchantId,
    });

    return {
      token,
      expiresIn: config.jwt.expiresIn,
      tokenType: 'Bearer',
    };
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(oldToken) {
    try {
      const decoded = this.verifyToken(oldToken);

      // Generate new token with same payload
      const newToken = this.generateToken({
        userId: decoded.userId,
        email: decoded.email,
        merchantId: decoded.merchantId,
      });

      return {
        token: newToken,
        expiresIn: config.jwt.expiresIn,
        tokenType: 'Bearer',
      };
    } catch (error) {
      throw new AuthenticationError('Unable to refresh token');
    }
  }
}

module.exports = new AuthService();
