/**
 * CoverPay Database Module
 *
 * Exports database utilities for transaction logging, analytics,
 * and user orchestration.
 */
const { supabase, checkConnection, SUPABASE_URL } = require('./supabase');
const transactionRepository = require('./transactionRepository');
const orchestrationRepository = require('./orchestrationRepository');
const providerSessionRepository = require('./providerSessionRepository');
const prequalificationRepository = require('./prequalificationRepository');

module.exports = {
  supabase,
  checkConnection,
  SUPABASE_URL,
  transactionRepository,
  orchestrationRepository,
  providerSessionRepository,
  prequalificationRepository
};
