/**
 * CoverPay - Intelligent BNPL Orchestration Layer
 *
 * Increases BNPL approval rates by routing across multiple providers
 * using waterfall or split payment strategies.
 *
 * Supported Providers (6):
 * - Klarna: https://docs.klarna.com/api/payments/
 * - Affirm: https://docs.affirm.com/payments/docs/direct-api-overview
 * - Afterpay: https://developers.afterpay.com/afterpay-online/docs/create-order
 * - Sezzle: https://docs.sezzle.com/docs/api/intro
 * - Zip: https://docs.us.zip.co/docs/custom-integration-guide
 * - PayPal: https://developer.paypal.com/docs/checkout/pay-later/us/
 */
const CoverPayOrchestrator = require('./orchestrator');
const {
  BNPLProvider,
  KlarnaProvider,
  AffirmProvider,
  AfterpayProvider,
  SezzleProvider,
  ZipProvider,
  PayPalProvider
} = require('./providers');

/**
 * Initialize CoverPay with configured providers
 *
 * @param {object} config - Provider configuration
 * @param {string[]} config.providerOrder - Custom provider priority order
 *   Default: ['klarna', 'affirm', 'afterpay', 'sezzle', 'zip', 'paypal']
 *
 * @param {object} config.klarna - Klarna settings
 * @param {boolean} config.klarna.enabled - Enable Klarna
 * @param {string} config.klarna.apiKey - Klarna API key (or use KLARNA_API_KEY env)
 * @param {string} config.klarna.apiSecret - Klarna API secret (or use KLARNA_API_SECRET env)
 * @param {string} config.klarna.region - Region: 'US', 'EU', 'OC' (default: 'US')
 * @param {string} config.klarna.environment - 'sandbox' or 'production'
 * @param {boolean} config.klarna.mockMode - Force mock mode for testing
 *
 * @param {object} config.affirm - Affirm settings
 * @param {boolean} config.affirm.enabled - Enable Affirm
 * @param {string} config.affirm.publicKey - Affirm public key (or use AFFIRM_PUBLIC_KEY env)
 * @param {string} config.affirm.privateKey - Affirm private key (or use AFFIRM_PRIVATE_KEY env)
 * @param {string} config.affirm.environment - 'sandbox' or 'production'
 * @param {boolean} config.affirm.mockMode - Force mock mode for testing
 *
 * @param {object} config.afterpay - Afterpay settings
 * @param {boolean} config.afterpay.enabled - Enable Afterpay
 * @param {string} config.afterpay.merchantId - Afterpay merchant ID (or use AFTERPAY_MERCHANT_ID env)
 * @param {string} config.afterpay.secretKey - Afterpay secret key (or use AFTERPAY_SECRET_KEY env)
 * @param {string} config.afterpay.region - Region: 'US', 'AU', 'UK', 'EU' (default: 'US')
 * @param {string} config.afterpay.environment - 'sandbox' or 'production'
 * @param {boolean} config.afterpay.mockMode - Force mock mode for testing
 *
 * @param {object} config.sezzle - Sezzle settings
 * @param {boolean} config.sezzle.enabled - Enable Sezzle
 * @param {string} config.sezzle.publicKey - Sezzle public key (or use SEZZLE_PUBLIC_KEY env)
 * @param {string} config.sezzle.privateKey - Sezzle private key (or use SEZZLE_PRIVATE_KEY env)
 * @param {string} config.sezzle.environment - 'sandbox' or 'production'
 * @param {boolean} config.sezzle.mockMode - Force mock mode for testing
 *
 * @param {object} config.zip - Zip settings
 * @param {boolean} config.zip.enabled - Enable Zip
 * @param {string} config.zip.apiKey - Zip API key (or use ZIP_API_KEY env)
 * @param {string} config.zip.apiSecret - Zip API secret (or use ZIP_API_SECRET env)
 * @param {string} config.zip.merchantId - Zip merchant ID (or use ZIP_MERCHANT_ID env)
 * @param {string} config.zip.environment - 'sandbox' or 'production'
 * @param {boolean} config.zip.mockMode - Force mock mode for testing
 *
 * @param {object} config.paypal - PayPal Pay in 4 settings
 * @param {boolean} config.paypal.enabled - Enable PayPal
 * @param {string} config.paypal.clientId - PayPal client ID (or use PAYPAL_CLIENT_ID env)
 * @param {string} config.paypal.clientSecret - PayPal client secret (or use PAYPAL_CLIENT_SECRET env)
 * @param {string} config.paypal.environment - 'sandbox' or 'production'
 * @param {boolean} config.paypal.mockMode - Force mock mode for testing
 *
 * @returns {CoverPayOrchestrator}
 */
function createCoverPay(config = {}) {
  const providers = [];

  // Provider registry - maps name to factory function
  const providerMap = {
    klarna: () => config.klarna?.enabled ? new KlarnaProvider(config.klarna) : null,
    affirm: () => config.affirm?.enabled ? new AffirmProvider(config.affirm) : null,
    afterpay: () => config.afterpay?.enabled ? new AfterpayProvider(config.afterpay) : null,
    sezzle: () => config.sezzle?.enabled ? new SezzleProvider(config.sezzle) : null,
    zip: () => config.zip?.enabled ? new ZipProvider(config.zip) : null,
    paypal: () => config.paypal?.enabled ? new PayPalProvider(config.paypal) : null
  };

  // Default order if not specified (recommended order for best approval rates)
  const defaultOrder = ['klarna', 'affirm', 'afterpay', 'sezzle', 'zip', 'paypal'];
  const order = config.providerOrder || defaultOrder;

  // Add providers in specified order
  for (const providerName of order) {
    const createProvider = providerMap[providerName];
    if (createProvider) {
      const provider = createProvider();
      if (provider) {
        providers.push(provider);
      }
    }
  }

  return new CoverPayOrchestrator(providers);
}

/**
 * Create CoverPay with default configuration from environment variables
 * Enables all providers that have credentials configured
 */
function createCoverPayFromEnv() {
  const mockMode = process.env.COVERPAY_MOCK_MODE === 'true';

  const config = {
    klarna: {
      enabled: !!(process.env.KLARNA_API_KEY || mockMode),
      mockMode
    },
    affirm: {
      enabled: !!(process.env.AFFIRM_PUBLIC_KEY || mockMode),
      mockMode
    },
    afterpay: {
      enabled: !!(process.env.AFTERPAY_MERCHANT_ID || mockMode),
      mockMode
    },
    sezzle: {
      enabled: !!(process.env.SEZZLE_PUBLIC_KEY || mockMode),
      mockMode
    },
    zip: {
      enabled: !!(process.env.ZIP_API_KEY || mockMode),
      mockMode
    },
    paypal: {
      enabled: !!(process.env.PAYPAL_CLIENT_ID || mockMode),
      mockMode
    }
  };

  return createCoverPay(config);
}

module.exports = {
  // Factory functions
  createCoverPay,
  createCoverPayFromEnv,

  // Classes for direct use
  CoverPayOrchestrator,
  BNPLProvider,
  KlarnaProvider,
  AffirmProvider,
  AfterpayProvider,
  SezzleProvider,
  ZipProvider,
  PayPalProvider
};
