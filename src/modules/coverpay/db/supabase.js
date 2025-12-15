/**
 * Supabase Client for CoverPay
 *
 * Database connection for logging BNPL transactions and attempts.
 * Uses service role for backend operations.
 */
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hrgrqmeaajdmajtbdhla.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyZ3JxbWVhYWpkbWFqdGJkaGxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2ODExNzMsImV4cCI6MjA2MjI1NzE3M30.ErJwCN9trDC0z2o4GaHpiIEiK0ZJIm9ODaX0xep32I4';

// Create Supabase client
// Use service key for full access, fallback to anon key for read-only
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Check if database is connected and tables exist
 */
async function checkConnection() {
  try {
    const { data, error } = await supabase
      .from('bnpl_transactions')
      .select('id')
      .limit(1);

    if (error) throw error;
    return { connected: true, hasServiceKey: !!SUPABASE_SERVICE_KEY };
  } catch (error) {
    console.error('[Supabase] Connection check failed:', error.message);
    return { connected: false, error: error.message };
  }
}

module.exports = {
  supabase,
  checkConnection,
  SUPABASE_URL
};
