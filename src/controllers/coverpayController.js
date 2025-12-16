const { createCoverPayFromEnv } = require('../modules/coverpay');
const { transactionRepository, checkConnection } = require('../modules/coverpay/db');
const logger = require('../utils/logger');

/**
 * CoverPay BNPL Controller
 * Handles BNPL checkout orchestration across 6 providers
 */

// Initialize CoverPay instance (lazy loaded)
let coverPayInstance = null;

function getCoverPay() {
  if (!coverPayInstance) {
    coverPayInstance = createCoverPayFromEnv();
  }
  return coverPayInstance;
}

/**
 * Process BNPL checkout
 * Routes through Klarna, Affirm, Afterpay, Sezzle, Zip, PayPal
 */
exports.processCheckout = async (req, res, next) => {
  try {
    const {
      amount,
      currency,
      strategy,
      fracturedOptions,
      merchantOrderId,
      customer,
      merchant,
      items,
      metadata
    } = req.body;

    logger.info('Processing CoverPay checkout', {
      amount,
      strategy,
      merchantOrderId,
      customerEmail: customer.email,
      fractured: strategy === 'fractured' || strategy === 'maximize'
    });

    const coverpay = getCoverPay();

    const result = await coverpay.processCheckout({
      amount,
      customer,
      merchant: {
        ...merchant,
        items,
        metadata
      },
      strategy,
      merchantOrderId,
      fracturedOptions
    });

    if (result.success) {
      logger.info('CoverPay checkout approved', {
        transactionId: result.transactionId,
        provider: result.provider,
        strategy: result.strategy,
        fractured: result.fractured,
        providersUsed: result.providersUsed
      });

      res.status(200).json({
        success: true,
        data: {
          transactionId: result.transactionId,
          provider: result.provider,
          sessionId: result.sessionId,
          redirectUrl: result.redirectUrl,
          strategy: result.strategy,
          split: result.split || false,
          fractured: result.fractured || false,
          sessions: result.sessions,
          // Fractured strategy fields
          totalApproved: result.totalApproved,
          targetAmount: result.targetAmount,
          coveragePercent: result.coveragePercent,
          providersUsed: result.providersUsed,
          attempts: result.attempts?.length || 1
        }
      });
    } else if (result.partiallyCovered) {
      // Partial approval - fractured got some but not all
      logger.warn('CoverPay checkout partially approved', {
        transactionId: result.transactionId,
        totalApproved: result.totalApproved,
        targetAmount: result.targetAmount,
        coveragePercent: result.coveragePercent
      });

      res.status(206).json({
        success: false,
        partial: true,
        error: 'BNPL_PARTIAL',
        message: result.message,
        data: {
          transactionId: result.transactionId,
          sessions: result.sessions,
          totalApproved: result.totalApproved,
          targetAmount: result.targetAmount,
          remainingAmount: result.remainingAmount,
          coveragePercent: result.coveragePercent,
          providersUsed: result.providersUsed,
          attempts: result.attempts
        }
      });
    } else {
      logger.warn('CoverPay checkout declined by all providers', {
        attempts: result.attempts?.length
      });

      res.status(422).json({
        success: false,
        error: 'BNPL_DECLINED',
        message: result.message,
        data: {
          transactionId: result.transactionId,
          attempts: result.attempts
        }
      });
    }
  } catch (error) {
    logger.error('CoverPay checkout error', { error: error.message });
    next(error);
  }
};

/**
 * Get transaction status and details
 */
exports.getTransaction = async (req, res, next) => {
  try {
    const { transactionId } = req.params;

    logger.info('Fetching CoverPay transaction', { transactionId });

    const transaction = await transactionRepository.getTransaction(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'TRANSACTION_NOT_FOUND',
        message: 'Transaction not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: transaction.id,
        merchantOrderId: transaction.merchant_order_id,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        strategy: transaction.strategy,
        finalProvider: transaction.final_provider,
        isSplit: transaction.is_split,
        redirectUrl: transaction.redirect_url,
        customerEmail: transaction.customer_email,
        createdAt: transaction.created_at,
        updatedAt: transaction.updated_at,
        completedAt: transaction.completed_at,
        attempts: transaction.bnpl_attempts?.map(a => ({
          id: a.id,
          provider: a.provider,
          status: a.status,
          amount: a.amount,
          responseTimeMs: a.response_time_ms,
          errorMessage: a.error_message,
          attemptedAt: a.attempted_at
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching transaction', { error: error.message });
    next(error);
  }
};

/**
 * Get merchant transactions list
 */
exports.getTransactions = async (req, res, next) => {
  try {
    const merchantId = req.user?.merchantId || 'default';
    const { limit = 50, offset = 0, status } = req.query;

    logger.info('Fetching merchant transactions', { merchantId, limit, offset, status });

    const result = await transactionRepository.getTransactionsByMerchant(merchantId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      status
    });

    res.status(200).json({
      success: true,
      data: {
        transactions: result.transactions.map(t => ({
          id: t.id,
          merchantOrderId: t.merchant_order_id,
          status: t.status,
          amount: t.amount,
          currency: t.currency,
          finalProvider: t.final_provider,
          customerEmail: t.customer_email,
          createdAt: t.created_at
        })),
        total: result.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error('Error fetching transactions', { error: error.message });
    next(error);
  }
};

/**
 * Get analytics/stats for merchant
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    const merchantId = req.user?.merchantId || 'default';
    const { startDate, endDate, provider } = req.query;

    logger.info('Fetching CoverPay analytics', { merchantId, startDate, endDate });

    const stats = await transactionRepository.getAnalytics(merchantId, {
      startDate,
      endDate,
      provider
    });

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalTransactions: stats.totalTransactions,
          approved: stats.approved,
          declined: stats.declined,
          pending: stats.pending,
          failed: stats.failed,
          approvalRate: stats.approvalRate,
          totalVolume: stats.totalVolume,
          approvedVolume: stats.approvedVolume,
          splitPayments: stats.splitPayments
        },
        byProvider: stats.byProvider
      }
    });
  } catch (error) {
    logger.error('Error fetching analytics', { error: error.message });
    next(error);
  }
};

/**
 * Get provider performance stats
 */
exports.getProviderStats = async (req, res, next) => {
  try {
    const merchantId = req.user?.merchantId || 'default';
    const { days = 30 } = req.query;

    logger.info('Fetching provider stats', { merchantId, days });

    const stats = await transactionRepository.getProviderStats(merchantId, parseInt(days));

    res.status(200).json({
      success: true,
      data: {
        period: `Last ${days} days`,
        providers: stats
      }
    });
  } catch (error) {
    logger.error('Error fetching provider stats', { error: error.message });
    next(error);
  }
};

/**
 * Handle provider webhooks
 */
exports.handleWebhook = async (req, res, next) => {
  try {
    const { provider, event, transactionId, sessionId, status, data } = req.body;

    logger.info('Received CoverPay webhook', { provider, event, transactionId });

    // Find the transaction by session ID if transactionId not provided
    let transaction;
    if (transactionId) {
      transaction = await transactionRepository.getTransaction(transactionId);
    }

    // Process based on event type
    switch (event) {
      case 'checkout.completed':
      case 'order.approved':
      case 'payment.captured':
        if (transaction) {
          await transactionRepository.updateTransaction(transaction.id, {
            status: 'approved',
            completedAt: new Date().toISOString(),
            metadata: { ...transaction.metadata, webhookData: data }
          });
        }
        break;

      case 'checkout.cancelled':
      case 'order.cancelled':
        if (transaction) {
          await transactionRepository.updateTransaction(transaction.id, {
            status: 'cancelled'
          });
        }
        break;

      case 'checkout.failed':
      case 'order.declined':
      case 'payment.failed':
        if (transaction) {
          await transactionRepository.updateTransaction(transaction.id, {
            status: 'failed',
            metadata: { ...transaction.metadata, failureReason: data?.reason }
          });
        }
        break;

      default:
        logger.info('Unhandled webhook event', { provider, event });
    }

    res.status(200).json({
      success: true,
      message: 'Webhook processed'
    });
  } catch (error) {
    logger.error('Webhook processing error', { error: error.message });
    // Return 200 to prevent retries for processing errors
    res.status(200).json({
      success: false,
      message: 'Webhook received but processing failed'
    });
  }
};

/**
 * Health check for CoverPay service
 */
exports.healthCheck = async (req, res) => {
  try {
    const dbConnection = await checkConnection();
    const coverpay = getCoverPay();

    res.status(200).json({
      success: true,
      data: {
        service: 'CoverPay BNPL Orchestration',
        status: 'operational',
        database: dbConnection.connected ? 'connected' : 'disconnected',
        providers: coverpay.providers.map(p => p.name),
        providerCount: coverpay.providers.length
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      data: {
        service: 'CoverPay BNPL Orchestration',
        status: 'degraded',
        error: error.message
      }
    });
  }
};
