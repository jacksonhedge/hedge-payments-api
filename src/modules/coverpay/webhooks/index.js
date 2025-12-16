/**
 * CoverPay Webhook Module
 *
 * Centralized webhook handling for all BNPL providers.
 */
const { WebhookProcessor, WebhookError, EVENT_MAPPINGS } = require('./WebhookProcessor');
const signatures = require('./signatures');

module.exports = {
  WebhookProcessor,
  WebhookError,
  EVENT_MAPPINGS,
  signatures,
  verifySignature: signatures.verifySignature
};
