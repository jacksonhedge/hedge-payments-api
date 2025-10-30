const coinflowService = require('../services/coinflowService');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Payment Controller
 * Handles all payment-related operations
 */

/**
 * Create a new payment
 */
exports.createPayment = async (req, res, next) => {
  try {
    const paymentData = {
      ...req.body,
      paymentId: uuidv4(),
      createdAt: new Date().toISOString(),
      userId: req.user.userId,
    };

    logger.info('Creating payment:', { paymentId: paymentData.paymentId });

    const result = await coinflowService.createPayment(paymentData);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment details
 */
exports.getPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    logger.info('Fetching payment:', { paymentId });

    const payment = await coinflowService.getPayment(paymentId);

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a payment
 */
exports.cancelPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const { reason } = req.body;

    logger.info('Cancelling payment:', { paymentId, reason });

    const result = await coinflowService.cancelPayment(paymentId);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Payment cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refund a payment
 */
exports.refundPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    logger.info('Refunding payment:', { paymentId, amount, reason });

    const result = await coinflowService.refundPayment(paymentId, amount, reason);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Payment refunded successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle webhook notifications
 */
exports.handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-coinflow-signature'];
    const payload = req.body;

    logger.info('Received webhook:', { event: payload.event });

    // Verify webhook signature
    const isValid = coinflowService.verifyWebhookSignature(payload, signature);

    if (!isValid) {
      logger.error('Invalid webhook signature');
      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
      });
    }

    // Process webhook event
    // TODO: Implement webhook event processing logic

    res.status(200).json({
      success: true,
      message: 'Webhook received',
    });
  } catch (error) {
    next(error);
  }
};
