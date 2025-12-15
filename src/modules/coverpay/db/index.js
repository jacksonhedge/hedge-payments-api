/**
 * CoverPay Database Module
 *
 * Exports database utilities for transaction logging and analytics.
 */
const { supabase, checkConnection, SUPABASE_URL } = require('./supabase');
const transactionRepository = require('./transactionRepository');

module.exports = {
  supabase,
  checkConnection,
  SUPABASE_URL,
  transactionRepository
};
