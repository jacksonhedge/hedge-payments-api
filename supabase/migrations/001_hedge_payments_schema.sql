-- ============================================
-- HEDGE PAYMENTS - B2B Payment Platform Schema
-- ============================================
-- Supabase Migration v001
--
-- Products:
-- - CoverPay: BNPL orchestration across multiple providers
-- - CoinFlow: White-labeled crypto payment processing
--
-- First client: Bankroll

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- MERCHANTS TABLE
-- ============================================
-- B2B clients using Hedge Payments (e.g., Bankroll)
CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Basic info
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,              -- URL-friendly identifier (e.g., 'bankroll')
  email TEXT NOT NULL,

  -- API credentials
  api_key TEXT UNIQUE NOT NULL,           -- Public API key (pk_live_xxx or pk_test_xxx)
  api_secret TEXT NOT NULL,               -- Secret API key (sk_live_xxx or sk_test_xxx)

  -- Environment
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),

  -- Webhook configuration
  webhook_url TEXT,
  webhook_secret TEXT,                    -- For signing webhook payloads

  -- Products enabled
  coverpay_enabled BOOLEAN DEFAULT true,
  coinflow_enabled BOOLEAN DEFAULT false,

  -- CoverPay settings
  coverpay_providers TEXT[] DEFAULT ARRAY['klarna', 'affirm', 'afterpay', 'sezzle', 'zip', 'paypal', 'stripe_bnpl'],
  coverpay_default_strategy TEXT DEFAULT 'fractured',
  coverpay_min_amount INTEGER DEFAULT 1000,       -- Minimum amount in cents ($10)
  coverpay_max_amount INTEGER DEFAULT 500000,     -- Maximum amount in cents ($5,000)

  -- Billing (future)
  billing_email TEXT,
  stripe_customer_id TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for merchants
CREATE INDEX idx_merchants_api_key ON merchants(api_key);
CREATE INDEX idx_merchants_slug ON merchants(slug);
CREATE INDEX idx_merchants_status ON merchants(status);

-- ============================================
-- USER ORCHESTRATION SESSIONS TABLE
-- ============================================
-- Tracks a checkout journey across multiple BNPL providers (fractured payments)
CREATE TABLE user_orchestration_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Merchant reference
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- External reference (merchant's order/transaction ID)
  external_id TEXT,

  -- Customer identification (from merchant)
  customer_id TEXT,                       -- Merchant's user ID
  customer_email TEXT,
  customer_phone TEXT,
  device_id TEXT,                         -- Device identifier for push notifications

  -- Session state machine
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN (
    'initiated',              -- Session created, not started
    'in_progress',            -- User actively completing providers
    'provider_redirect',      -- User redirected to a provider
    'awaiting_webhook',       -- Waiting for provider confirmation
    'next_provider',          -- Moving to next provider in sequence
    'all_completed',          -- All providers completed successfully
    'partial_completed',      -- Some providers completed, some failed/skipped
    'failed',                 -- Session failed
    'expired',                -- Session timed out
    'cancelled'               -- User cancelled
  )),

  -- Strategy info
  strategy TEXT NOT NULL DEFAULT 'fractured',
  total_amount INTEGER NOT NULL,          -- Total amount in cents
  target_amount INTEGER NOT NULL,         -- Amount we're trying to cover
  approved_amount INTEGER DEFAULT 0,      -- Amount successfully approved

  -- Provider tracking
  total_providers INTEGER NOT NULL,       -- Number of providers to complete
  completed_providers INTEGER DEFAULT 0,
  current_provider_index INTEGER DEFAULT 0,

  -- Session expiration (default 30 minutes)
  expires_at TIMESTAMPTZ NOT NULL,

  -- Return URLs (merchant-provided)
  return_url TEXT,
  cancel_url TEXT,
  return_scheme TEXT,                     -- Mobile deep link scheme (e.g., 'bankroll://')

  -- Push notification token
  apns_token TEXT,                        -- Apple Push Notification Service token
  fcm_token TEXT,                         -- Firebase Cloud Messaging token

  -- Metadata
  customer_data JSONB DEFAULT '{}',       -- Full customer info for providers
  merchant_data JSONB DEFAULT '{}',       -- Merchant config (order description, etc.)
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes for orchestration sessions
CREATE INDEX idx_orch_sessions_merchant ON user_orchestration_sessions(merchant_id);
CREATE INDEX idx_orch_sessions_external ON user_orchestration_sessions(merchant_id, external_id);
CREATE INDEX idx_orch_sessions_customer ON user_orchestration_sessions(merchant_id, customer_id);
CREATE INDEX idx_orch_sessions_status ON user_orchestration_sessions(status);
CREATE INDEX idx_orch_sessions_expires ON user_orchestration_sessions(expires_at);
CREATE INDEX idx_orch_sessions_created ON user_orchestration_sessions(created_at DESC);

-- ============================================
-- PROVIDER SESSIONS TABLE
-- ============================================
-- Individual provider session within an orchestration
CREATE TABLE provider_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Parent reference
  orchestration_session_id UUID NOT NULL REFERENCES user_orchestration_sessions(id) ON DELETE CASCADE,

  -- Provider details
  provider TEXT NOT NULL,                 -- klarna, affirm, afterpay, sezzle, zip, paypal, stripe_bnpl
  provider_session_id TEXT,               -- Provider's session/checkout ID

  -- Amount for this provider
  amount INTEGER NOT NULL,                -- Amount in cents for this provider

  -- Sequence order (1, 2, 3, etc.)
  sequence_order INTEGER NOT NULL,

  -- State machine for individual provider
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',               -- Not yet started
    'redirecting',           -- User being redirected
    'in_progress',           -- User on provider site
    'webhook_pending',       -- Redirect complete, awaiting webhook
    'approved',              -- Provider approved
    'declined',              -- Provider declined
    'expired',               -- Session expired
    'cancelled',             -- User cancelled
    'skipped',               -- User/system skipped this provider
    'error'                  -- Error occurred
  )),

  -- URLs
  redirect_url TEXT,

  -- Provider response data
  provider_response JSONB DEFAULT '{}',
  client_secret TEXT,                     -- For Stripe-based providers

  -- Timing
  redirect_initiated_at TIMESTAMPTZ,
  redirect_completed_at TIMESTAMPTZ,
  webhook_received_at TIMESTAMPTZ,

  -- Error info
  error_message TEXT,
  error_code TEXT,

  -- Expiration (provider-specific, usually 10-15 minutes)
  expires_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for provider sessions
CREATE INDEX idx_provider_sessions_orch ON provider_sessions(orchestration_session_id);
CREATE INDEX idx_provider_sessions_provider ON provider_sessions(provider);
CREATE INDEX idx_provider_sessions_status ON provider_sessions(status);
CREATE INDEX idx_provider_sessions_provider_sid ON provider_sessions(provider_session_id);
CREATE INDEX idx_provider_sessions_sequence ON provider_sessions(orchestration_session_id, sequence_order);

-- ============================================
-- PRE-QUALIFICATION CACHE TABLE
-- ============================================
-- Caches user eligibility across all BNPL providers
CREATE TABLE prequalification_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Merchant reference
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- User identification (hash of email+phone for privacy)
  user_hash TEXT NOT NULL,                -- SHA256 hash of email+phone
  customer_id TEXT,                       -- Merchant's customer ID (optional)

  -- Cached eligibility per provider
  eligibility JSONB NOT NULL DEFAULT '{}',
  -- Format: {
  --   "klarna": {"eligible": true, "limit": 50000, "min": 3500, "max": 50000, "reason": null},
  --   "affirm": {"eligible": true, "limit": 100000, "min": 5000, "max": 100000, "reason": null},
  --   "afterpay": {"eligible": false, "limit": 0, "reason": "risk_assessment"},
  --   ...
  -- }

  -- Aggregated totals
  total_bnpl_capacity INTEGER DEFAULT 0,      -- Sum of all provider limits
  eligible_provider_count INTEGER DEFAULT 0,
  eligible_providers TEXT[] DEFAULT '{}',     -- Array of eligible provider names

  -- Cache timing
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Request context for better caching
  amount_requested INTEGER,               -- Amount they were checking for

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Unique per merchant + user
  UNIQUE(merchant_id, user_hash)
);

-- Indexes for prequalification cache
CREATE INDEX idx_prequal_merchant ON prequalification_cache(merchant_id);
CREATE INDEX idx_prequal_hash ON prequalification_cache(merchant_id, user_hash);
CREATE INDEX idx_prequal_expires ON prequalification_cache(expires_at);

-- ============================================
-- WEBHOOK EVENTS LOG TABLE
-- ============================================
-- Audit log for all incoming provider webhooks
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Merchant reference (if identifiable)
  merchant_id UUID REFERENCES merchants(id),

  -- Provider info
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,

  -- Reference IDs
  provider_session_id TEXT,
  orchestration_session_id UUID REFERENCES user_orchestration_sessions(id),

  -- Raw webhook data
  raw_payload JSONB NOT NULL,
  headers JSONB,

  -- Processing status
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  processing_time_ms INTEGER,

  -- Signature verification
  signature_valid BOOLEAN,

  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for webhook events
CREATE INDEX idx_webhook_merchant ON webhook_events(merchant_id);
CREATE INDEX idx_webhook_provider ON webhook_events(provider);
CREATE INDEX idx_webhook_session ON webhook_events(provider_session_id);
CREATE INDEX idx_webhook_orch ON webhook_events(orchestration_session_id);
CREATE INDEX idx_webhook_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_received ON webhook_events(received_at DESC);

-- ============================================
-- TRANSACTIONS TABLE (for billing/analytics)
-- ============================================
-- Record of completed transactions for billing and analytics
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  orchestration_session_id UUID REFERENCES user_orchestration_sessions(id),

  -- External reference
  external_id TEXT,                       -- Merchant's order ID

  -- Transaction details
  amount INTEGER NOT NULL,                -- Total amount in cents
  currency TEXT DEFAULT 'USD',

  -- Status
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'partial', 'failed', 'refunded')),

  -- Breakdown by provider
  provider_breakdown JSONB DEFAULT '{}',
  -- Format: {
  --   "klarna": {"amount": 20000, "status": "approved"},
  --   "affirm": {"amount": 20000, "status": "approved"},
  --   ...
  -- }

  -- Fees (for billing)
  fee_amount INTEGER DEFAULT 0,           -- Hedge Payments fee in cents
  fee_percent NUMERIC(5,4) DEFAULT 0,     -- Fee percentage charged

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for transactions
CREATE INDEX idx_transactions_merchant ON transactions(merchant_id);
CREATE INDEX idx_transactions_external ON transactions(merchant_id, external_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_merchants_updated_at
  BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_orch_sessions_updated_at
  BEFORE UPDATE ON user_orchestration_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_provider_sessions_updated_at
  BEFORE UPDATE ON provider_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to generate API keys
CREATE OR REPLACE FUNCTION generate_api_key(prefix TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN prefix || '_' || encode(gen_random_bytes(24), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Function to calculate orchestration progress
CREATE OR REPLACE FUNCTION get_orchestration_progress(session_id UUID)
RETURNS TABLE (
  total_amount INTEGER,
  approved_amount INTEGER,
  remaining_amount INTEGER,
  coverage_percent INTEGER,
  completed_count INTEGER,
  total_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    os.total_amount,
    COALESCE(SUM(ps.amount) FILTER (WHERE ps.status = 'approved'), 0)::INTEGER as approved_amount,
    (os.total_amount - COALESCE(SUM(ps.amount) FILTER (WHERE ps.status = 'approved'), 0))::INTEGER as remaining_amount,
    CASE
      WHEN os.total_amount > 0 THEN
        (COALESCE(SUM(ps.amount) FILTER (WHERE ps.status = 'approved'), 0) * 100 / os.total_amount)::INTEGER
      ELSE 0
    END as coverage_percent,
    COUNT(*) FILTER (WHERE ps.status = 'approved')::INTEGER as completed_count,
    os.total_providers
  FROM user_orchestration_sessions os
  LEFT JOIN provider_sessions ps ON ps.orchestration_session_id = os.id
  WHERE os.id = session_id
  GROUP BY os.id, os.total_amount, os.total_providers;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_orchestration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prequalification_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for API server)
CREATE POLICY "Service role full access to merchants"
  ON merchants FOR ALL
  USING (true);

CREATE POLICY "Service role full access to orchestration"
  ON user_orchestration_sessions FOR ALL
  USING (true);

CREATE POLICY "Service role full access to provider sessions"
  ON provider_sessions FOR ALL
  USING (true);

CREATE POLICY "Service role full access to prequalification"
  ON prequalification_cache FOR ALL
  USING (true);

CREATE POLICY "Service role full access to webhooks"
  ON webhook_events FOR ALL
  USING (true);

CREATE POLICY "Service role full access to transactions"
  ON transactions FOR ALL
  USING (true);

-- ============================================
-- SEED DATA: Create Bankroll as first merchant
-- ============================================

INSERT INTO merchants (
  name,
  slug,
  email,
  api_key,
  api_secret,
  environment,
  coverpay_enabled,
  coinflow_enabled,
  status
) VALUES (
  'Bankroll',
  'bankroll',
  'support@bankroll.app',
  'pk_test_bankroll_' || encode(gen_random_bytes(16), 'hex'),
  'sk_test_bankroll_' || encode(gen_random_bytes(24), 'hex'),
  'sandbox',
  true,
  true,
  'active'
);
