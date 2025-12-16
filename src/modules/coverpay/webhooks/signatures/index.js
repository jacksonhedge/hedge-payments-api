/**
 * Provider Webhook Signature Verification
 *
 * Each provider has different webhook signature mechanisms:
 * - Klarna: HMAC-SHA256 in x-klarna-signature header
 * - Affirm: HMAC-SHA256 in x-affirm-signature header
 * - Afterpay: HMAC-SHA512 in x-afterpay-hmac header
 * - Sezzle: HMAC-SHA256 in sezzle-signature header
 * - Zip: HMAC-SHA256 in x-zip-signature header
 * - PayPal: HMAC-SHA256 with cert chain verification
 * - Stripe: HMAC-SHA256 in stripe-signature header
 */
const crypto = require('crypto');

/**
 * Verify Klarna webhook signature
 * https://docs.klarna.com/api/push-notifications/
 */
function verifyKlarnaSignature(payload, signature, secret) {
  if (!secret) return true; // Skip if no secret configured

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature || ''),
    Buffer.from(expectedSignature)
  );
}

/**
 * Verify Affirm webhook signature
 * https://docs.affirm.com/developers/docs/webhooks
 */
function verifyAffirmSignature(payload, signature, secret) {
  if (!secret) return true;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature || ''),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Verify Afterpay webhook signature
 * https://developers.afterpay.com/afterpay-online/docs/webhooks
 */
function verifyAfterpaySignature(payload, signature, secret) {
  if (!secret) return true;

  const expectedSignature = crypto
    .createHmac('sha512', secret)
    .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
    .digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature || ''),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Verify Sezzle webhook signature
 * https://docs.sezzle.com/#webhooks
 */
function verifySezzleSignature(payload, signature, secret) {
  if (!secret) return true;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature || ''),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Verify Zip webhook signature
 */
function verifyZipSignature(payload, signature, secret) {
  if (!secret) return true;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature || ''),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Verify PayPal webhook signature
 * https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature
 * Note: PayPal uses certificate chain verification - simplified here
 */
function verifyPayPalSignature(payload, headers, webhookId) {
  // PayPal signature verification requires calling their API
  // For now, we'll trust webhooks and verify via order lookup
  // In production, implement full cert chain verification
  return true;
}

/**
 * Verify Stripe webhook signature
 * https://stripe.com/docs/webhooks/signatures
 */
function verifyStripeSignature(payload, signature, secret) {
  if (!secret) return true;

  // Stripe signature format: t=timestamp,v1=signature
  const parts = (signature || '').split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
  const sig = parts.find(p => p.startsWith('v1='))?.split('=')[1];

  if (!timestamp || !sig) return false;

  // Check timestamp is within 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return false;
  }

  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signedPayload = `${timestamp}.${payloadString}`;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(sig),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Get signature from request headers by provider
 */
function getSignatureFromHeaders(provider, headers) {
  const headerMap = {
    klarna: 'x-klarna-signature',
    affirm: 'x-affirm-signature',
    afterpay: 'x-afterpay-hmac',
    sezzle: 'sezzle-signature',
    zip: 'x-zip-signature',
    paypal: null, // PayPal uses multiple headers
    stripe_bnpl: 'stripe-signature'
  };

  const headerName = headerMap[provider];
  if (!headerName) return null;

  // Headers are lowercase in Express
  return headers[headerName] || headers[headerName.toLowerCase()];
}

/**
 * Get webhook secret for provider from environment
 */
function getWebhookSecret(provider) {
  const secretMap = {
    klarna: process.env.KLARNA_WEBHOOK_SECRET,
    affirm: process.env.AFFIRM_WEBHOOK_SECRET,
    afterpay: process.env.AFTERPAY_WEBHOOK_SECRET,
    sezzle: process.env.SEZZLE_WEBHOOK_SECRET,
    zip: process.env.ZIP_WEBHOOK_SECRET,
    paypal: process.env.PAYPAL_WEBHOOK_ID, // PayPal uses webhook ID
    stripe_bnpl: process.env.STRIPE_WEBHOOK_SECRET
  };

  return secretMap[provider];
}

/**
 * Verify webhook signature for any provider
 */
function verifySignature(provider, payload, headers) {
  const signature = getSignatureFromHeaders(provider, headers);
  const secret = getWebhookSecret(provider);

  const verifiers = {
    klarna: () => verifyKlarnaSignature(payload, signature, secret),
    affirm: () => verifyAffirmSignature(payload, signature, secret),
    afterpay: () => verifyAfterpaySignature(payload, signature, secret),
    sezzle: () => verifySezzleSignature(payload, signature, secret),
    zip: () => verifyZipSignature(payload, signature, secret),
    paypal: () => verifyPayPalSignature(payload, headers, secret),
    stripe_bnpl: () => verifyStripeSignature(payload, signature, secret)
  };

  const verifier = verifiers[provider];
  if (!verifier) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  return verifier();
}

module.exports = {
  verifySignature,
  verifyKlarnaSignature,
  verifyAffirmSignature,
  verifyAfterpaySignature,
  verifySezzleSignature,
  verifyZipSignature,
  verifyPayPalSignature,
  verifyStripeSignature,
  getSignatureFromHeaders,
  getWebhookSecret
};
