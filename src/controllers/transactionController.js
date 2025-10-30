const coinflowService = require('../services/coinflowService');
const logger = require('../utils/logger');

/**
 * Transaction Controller
 * Handles transaction history and details
 */

/**
 * Get all transactions
 */
exports.getTransactions = async (req, res, next) => {
  try {
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      currency: req.query.currency,
      minAmount: req.query.minAmount,
      maxAmount: req.query.maxAmount,
    };

    logger.info('Fetching transactions:', {
      userId: req.user.userId,
      ...filters,
    });

    const transactions = await coinflowService.getTransactions(filters);

    res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single transaction details
 */
exports.getTransaction = async (req, res, next) => {
  try {
    const { transactionId } = req.params;

    logger.info('Fetching transaction:', { transactionId });

    const transaction = await coinflowService.getTransaction(transactionId);

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get transaction statistics
 */
exports.getTransactionStats = async (req, res, next) => {
  try {
    const { startDate, endDate, currency } = req.query;

    logger.info('Fetching transaction stats:', {
      userId: req.user.userId,
      startDate,
      endDate,
      currency,
    });

    // TODO: Implement statistics calculation
    const stats = {
      totalTransactions: 0,
      totalVolume: 0,
      successRate: 0,
      averageAmount: 0,
      currency: currency || 'USD',
      period: {
        startDate,
        endDate,
      },
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export transactions
 */
exports.exportTransactions = async (req, res, next) => {
  try {
    const { format = 'csv', startDate, endDate } = req.query;

    logger.info('Exporting transactions:', {
      userId: req.user.userId,
      format,
      startDate,
      endDate,
    });

    // TODO: Implement export functionality
    // For now, return mock response
    res.status(200).json({
      success: true,
      message: 'Export generation started',
      data: {
        format,
        status: 'processing',
        estimatedTime: '2-5 minutes',
      },
    });
  } catch (error) {
    next(error);
  }
};
