-- CoverPay User Orchestration Schema
-- Supabase Migration v003
-- Tracks user checkout journeys across multiple BNPL providers (fractured payments)

-- ============================================
-- USER ORCHESTRATION SESSIONS TABLE
-- ============================================
-- Tracks a user's complete checkout journey, especially for fractured payments
CREATE TABLE user_orchestration_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Reference to parent transaction
  transaction_id UUID REFERENCES bnpl_transactions(id) ON DELETE CASCADE,

  -- User identification
  user_id UUID REFERENCES users(id),
  device_id TEXT,                    -- iOS device identifier for push notifications

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
  total_amount INTEGER NOT NULL,         -- Total amount in cents
  target_amount INTEGER NOT NULL,        -- Amount we're trying to cover
  approved_amount INTEGER DEFAULT 0,     -- Amount successfully approved

  -- Provider tracking
  total_providers INTEGER NOT NULL,      -- Number of providers to complete
  completed_providers INTEGER DEFAULT 0,
  current_provider_index INTEGER DEFAULT 0,

  -- Session expiration (default 30 minutes)
  expires_at TIMESTAMPTZ NOT NULL,

  -- Deep link configuration for iOS
  return_scheme TEXT,                    -- iOS URL scheme (e.g., 'bankroll://')
  success_url TEXT,
  cancel_url TEXT,

  -- Push notification token
  apns_token TEXT,                       -- Apple Push Notification Service token

  -- Metadata
  customer_data JSONB DEFAULT '{}',      -- Customer info for providers
  merchant_data JSONB DEFAULT '{}',      -- Merchant config
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes for orchestration sessions
CREATE INDEX idx_orch_sessions_transaction ON user_orchestration_sessions(transaction_id);
CREATE INDEX idx_orch_sessions_user ON user_orchestration_sessions(user_id);
CREATE INDEX idx_orch_sessions_status ON user_orchestration_sessions(status);
CREATE INDEX idx_orch_sessions_expires ON user_orchestration_sessions(expires_at);
CREATE INDEX idx_orch_sessions_device ON user_orchestration_sessions(device_id);
CREATE INDEX idx_orch_sessions_created ON user_orchestration_sessions(created_at DESC);

-- ============================================
-- PROVIDER SESSIONS TABLE
-- ============================================
-- Individual provider session within an orchestration
CREATE TABLE provider_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Parent reference
  orchestration_session_id UUID REFERENCES user_orchestration_sessions(id) ON DELETE CASCADE,

  -- Provider details
  provider TEXT NOT NULL,                -- klarna, affirm, afterpay, sezzle, zip, paypal, stripe_bnpl
  provider_session_id TEXT,              -- Provider's session/checkout ID

  -- Amount for this provider
  amount INTEGER NOT NULL,               -- Amount in cents for this provider

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
  client_secret TEXT,                    -- For Stripe-based providers

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

  -- User identification (can be by user_id or hash for anonymous)
  user_id UUID REFERENCES users(id),
  user_hash TEXT,                        -- SHA256 hash of email+phone for anonymous users

  -- Cached eligibility per provider
  eligibility JSONB NOT NULL DEFAULT '{}',
  -- Format: {
  --   "klarna": {"eligible": true, "limit": 50000, "min": 3500, "max": 50000, "reason": null},
  --   "affirm": {"eligible": true, "limit": 100000, "min": 5000, "max": 100000, "reason": null},
  --   "afterpay": {"eligible": false, "limit": 0, "reason": "risk_assessment"},
  --   ...
  -- }

  -- Aggregated totals
  total_bnpl_capacity INTEGER DEFAULT 0,     -- Sum of all provider limits
  eligible_provider_count INTEGER DEFAULT 0,
  eligible_providers TEXT[] DEFAULT '{}',    -- Array of eligible provider names

  -- Cache timing
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Request context for better caching
  amount_requested INTEGER,              -- Amount they were checking for

  -- Metadata
  metadata JSONB DEFAULT '{}',

  UNIQUE(user_hash)
);

-- Indexes for prequalification cache
CREATE INDEX idx_prequal_user ON prequalification_cache(user_id);
CREATE INDEX idx_prequal_hash ON prequalification_cache(user_hash);
CREATE INDEX idx_prequal_expires ON prequalification_cache(expires_at);

-- ============================================
-- WEBHOOK EVENTS LOG TABLE
-- ============================================
-- Audit log for all incoming provider webhooks
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

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

  -- Signature verification
  signature_valid BOOLEAN,

  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for webhook events
CREATE INDEX idx_webhook_provider ON webhook_events(provider);
CREATE INDEX idx_webhook_session ON webhook_events(provider_session_id);
CREATE INDEX idx_webhook_orch ON webhook_events(orchestration_session_id);
CREATE INDEX idx_webhook_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_received ON webhook_events(received_at DESC);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_orchestration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orch_sessions_updated_at
  BEFORE UPDATE ON user_orchestration_sessions
  FOR EACH ROW EXECUTE FUNCTION update_orchestration_updated_at();

CREATE TRIGGER update_provider_sessions_updated_at
  BEFORE UPDATE ON provider_sessions
  FOR EACH ROW EXECUTE FUNCTION update_orchestration_updated_at();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

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

-- Function to advance to next provider
CREATE OR REPLACE FUNCTION advance_orchestration_provider(session_id UUID)
RETURNS provider_sessions AS $$
DECLARE
  current_session user_orchestration_sessions;
  next_provider provider_sessions;
BEGIN
  -- Get current session
  SELECT * INTO current_session FROM user_orchestration_sessions WHERE id = session_id;

  IF current_session IS NULL THEN
    RAISE EXCEPTION 'Orchestration session not found';
  END IF;

  -- Get next pending provider
  SELECT * INTO next_provider
  FROM provider_sessions
  WHERE orchestration_session_id = session_id
    AND status = 'pending'
  ORDER BY sequence_order
  LIMIT 1;

  IF next_provider IS NULL THEN
    -- No more providers, check if we should complete
    UPDATE user_orchestration_sessions
    SET status = CASE
      WHEN approved_amount >= target_amount THEN 'all_completed'
      WHEN approved_amount > 0 THEN 'partial_completed'
      ELSE 'failed'
    END,
    completed_at = NOW()
    WHERE id = session_id;

    RETURN NULL;
  END IF;

  -- Update session to point to next provider
  UPDATE user_orchestration_sessions
  SET current_provider_index = next_provider.sequence_order,
      status = 'in_progress'
  WHERE id = session_id;

  -- Update provider to redirecting
  UPDATE provider_sessions
  SET status = 'redirecting',
      redirect_initiated_at = NOW()
  WHERE id = next_provider.id
  RETURNING * INTO next_provider;

  RETURN next_provider;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE user_orchestration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prequalification_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own orchestration sessions
CREATE POLICY "Users can view own orchestration sessions"
  ON user_orchestration_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only see their own provider sessions (via orchestration)
CREATE POLICY "Users can view own provider sessions"
  ON provider_sessions FOR SELECT
  USING (
    orchestration_session_id IN (
      SELECT id FROM user_orchestration_sessions WHERE user_id = auth.uid()
    )
  );

-- Users can only see their own prequalification cache
CREATE POLICY "Users can view own prequalification"
  ON prequalification_cache FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (for API server)
CREATE POLICY "Service role full access to orchestration"
  ON user_orchestration_sessions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to provider sessions"
  ON provider_sessions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to prequalification"
  ON prequalification_cache FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to webhooks"
  ON webhook_events FOR ALL
  USING (auth.role() = 'service_role');
