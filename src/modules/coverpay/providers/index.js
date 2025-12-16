/**
 * BNPL Provider Registry
 *
 * All available BNPL providers for CoverPay orchestration:
 * - Klarna: https://docs.klarna.com/api/payments/
 * - Affirm: https://docs.affirm.com/payments/docs/direct-api-overview
 * - Afterpay: https://developers.afterpay.com/afterpay-online/docs/create-order
 * - Sezzle: https://docs.sezzle.com/docs/api/intro
 * - Zip: https://docs.us.zip.co/docs/custom-integration-guide
 * - PayPal: https://developer.paypal.com/docs/checkout/pay-later/us/
 * - Stripe BNPL: https://stripe.com/docs/payments/buy-now-pay-later (fallback)
 */
const BNPLProvider = require('./base');
const KlarnaProvider = require('./klarna');
const AffirmProvider = require('./affirm');
const AfterpayProvider = require('./afterpay');
const SezzleProvider = require('./sezzle');
const ZipProvider = require('./zip');
const PayPalProvider = require('./paypal');
const StripeBNPLProvider = require('./stripe-bnpl');

module.exports = {
  BNPLProvider,
  KlarnaProvider,
  AffirmProvider,
  AfterpayProvider,
  SezzleProvider,
  ZipProvider,
  PayPalProvider,
  StripeBNPLProvider
};
