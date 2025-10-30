const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createPaymentSchema,
  getPaymentSchema,
  cancelPaymentSchema,
  refundPaymentSchema,
} = require('../validators/paymentValidators');

/**
 * @route   POST /api/payments
 * @desc    Create a new payment
 * @access  Private
 */
router.post('/', authenticate, validate(createPaymentSchema), paymentController.createPayment);

/**
 * @route   GET /api/payments/:paymentId
 * @desc    Get payment details
 * @access  Private
 */
router.get('/:paymentId', authenticate, validate(getPaymentSchema, 'params'), paymentController.getPayment);

/**
 * @route   POST /api/payments/:paymentId/cancel
 * @desc    Cancel a payment
 * @access  Private
 */
router.post(
  '/:paymentId/cancel',
  authenticate,
  validate(cancelPaymentSchema, 'params'),
  paymentController.cancelPayment
);

/**
 * @route   POST /api/payments/:paymentId/refund
 * @desc    Refund a payment
 * @access  Private
 */
router.post(
  '/:paymentId/refund',
  authenticate,
  validate(refundPaymentSchema),
  paymentController.refundPayment
);

/**
 * @route   POST /api/payments/webhook
 * @desc    Handle webhook notifications
 * @access  Public (but verified)
 */
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
