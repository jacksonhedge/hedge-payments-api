const coinflowService = require('../services/coinflowService');
const logger = require('../utils/logger');

/**
 * Balance Controller
 * Handles balance and payout operations
 */

/**
 * Get account balance
 */
exports.getBalance = async (req, res, next) => {
  try {
    const { currency } = req.query;

    logger.info('Fetching balance:', { userId: req.user.userId, currency });

    const balance = await coinflowService.getBalance(currency);

    res.status(200).json({
      success: true,
      data: balance,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get balance history
 */
exports.getBalanceHistory = async (req, res, next) => {
  try {
    const { startDate, endDate, currency } = req.query;

    logger.info('Fetching balance history:', {
      userId: req.user.userId,
      startDate,
      endDate,
      currency,
    });

    // TODO: Implement balance history logic with Coinflow
    // For now, return mock data structure
    const history = {
      currency: currency || 'USD',
      startDate,
      endDate,
      balances: [],
      totalChange: 0,
    };

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a payout
 */
exports.createPayout = async (req, res, next) => {
  try {
    const payoutData = {
      ...req.body,
      userId: req.user.userId,
      createdAt: new Date().toISOString(),
    };

    logger.info('Creating payout:', { userId: req.user.userId, amount: payoutData.amount });

    const result = await coinflowService.createPayout(payoutData);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Payout created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payout details
 */
exports.getPayout = async (req, res, next) => {
  try {
    const { payoutId } = req.params;

    logger.info('Fetching payout:', { payoutId });

    const payout = await coinflowService.getPayout(payoutId);

    res.status(200).json({
      success: true,
      data: payout,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all payouts
 */
exports.getPayouts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    logger.info('Fetching payouts:', { userId: req.user.userId, page, limit, status });

    // TODO: Implement with Coinflow API
    const payouts = {
      data: [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0,
      },
    };

    res.status(200).json({
      success: true,
      data: payouts,
    });
  } catch (error) {
    next(error);
  }
};
