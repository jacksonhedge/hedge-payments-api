/**
 * CoverPay - Intelligent BNPL Orchestration Layer
 *
 * Increases BNPL approval rates by routing across multiple providers
 * using waterfall or split payment strategies.
 */
const CoverPayOrchestrator = require('./orchestrator');
const { KlarnaProvider, AffirmProvider } = require('./providers');

/**
 * Initialize CoverPay with configured providers
 * @param {object} config - Provider configuration
 * @returns {CoverPayOrchestrator}
 */
function createCoverPay(config = {}) {
  const providers = [];

  if (config.klarna?.enabled) {
    providers.push(new KlarnaProvider(config.klarna));
  }

  if (config.affirm?.enabled) {
    providers.push(new AffirmProvider(config.affirm));
  }

  return new CoverPayOrchestrator(providers);
}

module.exports = {
  createCoverPay,
  CoverPayOrchestrator,
  KlarnaProvider,
  AffirmProvider
};
