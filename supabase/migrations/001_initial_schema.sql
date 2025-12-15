-- Hedge Payments / Bankroll Database Schema
-- Supabase Migration v001
-- Network-aware payment system with internal ledger transfers

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  username TEXT UNIQUE,
  display_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('consumer', 'merchant')),

  -- KYC/Verification
  kyc_status TEXT DEFAULT 'unverified' CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'rejected')),
  kyc_verified_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_type ON users(type);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);

-- ============================================
-- MERCHANTS TABLE
-- ============================================
CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Business Info
  business_name TEXT NOT NULL,
  domain TEXT UNIQUE,
  category TEXT,
  description TEXT,
  logo_url TEXT,

  -- Integration Status
  uses_hedge_payments BOOLEAN DEFAULT true,
  accepts_bankroll BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,

  -- Location
  address JSONB,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'US',

  -- Metrics
  bankroll_users_count INTEGER DEFAULT 0,
  total_transaction_volume DECIMAL(20, 2) DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_merchants_user_id ON merchants(user_id);
CREATE INDEX idx_merchants_domain ON merchants(domain);
CREATE INDEX idx_merchants_city ON merchants(city);
CREATE INDEX idx_merchants_uses_hedge ON merchants(uses_hedge_payments);

-- ============================================
-- WALLETS TABLE
-- ============================================
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Wallet Type
  type TEXT NOT NULL CHECK (type IN ('consumer', 'merchant', 'platform')),

  -- Solana Integration (for crypto settlements)
  solana_address TEXT UNIQUE,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_frozen BOOLEAN DEFAULT false,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_type ON wallets(type);
CREATE INDEX idx_wallets_solana ON wallets(solana_address);

-- ============================================
-- WALLET BALANCES TABLE
-- ============================================
CREATE TABLE wallet_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,

  -- Currency
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'USDC', 'EUR', 'GBP')),

  -- Balances
  available_balance DECIMAL(20, 2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  pending_balance DECIMAL(20, 2) NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  reserved_balance DECIMAL(20, 2) NOT NULL DEFAULT 0 CHECK (reserved_balance >= 0),

  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one balance per wallet per currency
  UNIQUE(wallet_id, currency)
);

-- Indexes
CREATE INDEX idx_wallet_balances_wallet_id ON wallet_balances(wallet_id);
CREATE INDEX idx_wallet_balances_currency ON wallet_balances(currency);

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Parties
  from_wallet_id UUID REFERENCES wallets(id),
  to_wallet_id UUID REFERENCES wallets(id),
  from_user_id UUID REFERENCES users(id),
  to_user_id UUID REFERENCES users(id),

  -- Transaction Details
  amount DECIMAL(20, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Type & Status
  type TEXT NOT NULL CHECK (type IN (
    'internal_transfer',
    'external_payment',
    'deposit',
    'withdrawal',
    'refund',
    'chargeback'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled',
    'refunded'
  )),

  -- Economics (THIS IS THE KEY!)
  fee DECIMAL(20, 2) NOT NULL DEFAULT 0,
  cost DECIMAL(20, 2) NOT NULL DEFAULT 0,
  profit DECIMAL(20, 2) NOT NULL DEFAULT 0,
  fee_percentage DECIMAL(5, 4),

  -- External References
  external_reference TEXT, -- CoinFlow transaction ID
  payment_method TEXT, -- 'card', 'ach', 'usdc', etc.

  -- Metadata
  memo TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Computed column for total cost to sender
  total_amount DECIMAL(20, 2) GENERATED ALWAYS AS (amount + fee) STORED
);

-- Indexes
CREATE INDEX idx_transactions_from_wallet ON transactions(from_wallet_id);
CREATE INDEX idx_transactions_to_wallet ON transactions(to_wallet_id);
CREATE INDEX idx_transactions_from_user ON transactions(from_user_id);
CREATE INDEX idx_transactions_to_user ON transactions(to_user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX idx_transactions_settled ON transactions(settled_at DESC) WHERE settled_at IS NOT NULL;
CREATE INDEX idx_transactions_external_ref ON transactions(external_reference) WHERE external_reference IS NOT NULL;

-- ============================================
-- LEDGER ENTRIES (Double-Entry Accounting)
-- ============================================
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,

  -- Entry Details
  entry_type TEXT NOT NULL CHECK (entry_type IN ('credit', 'debit')),
  amount DECIMAL(20, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Balance After Entry
  balance_after DECIMAL(20, 2) NOT NULL,

  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ledger_transaction_id ON ledger_entries(transaction_id);
CREATE INDEX idx_ledger_wallet_id ON ledger_entries(wallet_id);
CREATE INDEX idx_ledger_created ON ledger_entries(created_at DESC);

-- ============================================
-- PAYMENT METHODS TABLE
-- ============================================
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Method Type
  type TEXT NOT NULL CHECK (type IN (
    'card',
    'bank_account',
    'paypal',
    'venmo',
    'crypto_wallet'
  )),

  -- Status
  is_verified BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Details (encrypted/tokenized)
  token TEXT, -- Payment processor token (Stripe, CoinFlow, etc.)
  last_four TEXT, -- Last 4 digits for display

  -- Card specific
  card_brand TEXT, -- visa, mastercard, amex
  exp_month INTEGER,
  exp_year INTEGER,

  -- Bank account specific
  bank_name TEXT,
  account_type TEXT, -- checking, savings

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_type ON payment_methods(type);

-- ============================================
-- NETWORK ANALYTICS TABLE
-- ============================================
CREATE TABLE network_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,

  -- Volume Metrics
  total_volume DECIMAL(20, 2) DEFAULT 0,
  internal_volume DECIMAL(20, 2) DEFAULT 0,
  external_volume DECIMAL(20, 2) DEFAULT 0,

  -- Transaction Counts
  total_transactions INTEGER DEFAULT 0,
  internal_transactions INTEGER DEFAULT 0,
  external_transactions INTEGER DEFAULT 0,

  -- Revenue Metrics
  total_revenue DECIMAL(20, 2) DEFAULT 0,
  total_cost DECIMAL(20, 2) DEFAULT 0,
  total_profit DECIMAL(20, 2) DEFAULT 0,

  -- Network Health
  network_percentage DECIMAL(5, 2), -- % of transactions that are internal
  avg_transaction_size DECIMAL(20, 2),
  profit_margin DECIMAL(5, 2),

  -- User Metrics
  active_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  active_merchants INTEGER DEFAULT 0,
  new_merchants INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(date)
);

-- Index
CREATE INDEX idx_network_analytics_date ON network_analytics(date DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_merchants_updated_at
  BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_wallet_balances_updated_at
  BEFORE UPDATE ON wallet_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- VIEWS
-- ============================================

-- User Wallet Summary View
CREATE VIEW user_wallet_summary AS
SELECT
  u.id as user_id,
  u.email,
  u.username,
  u.display_name,
  w.id as wallet_id,
  w.type as wallet_type,
  wb.currency,
  wb.available_balance,
  wb.pending_balance,
  wb.reserved_balance,
  (wb.available_balance + wb.pending_balance + wb.reserved_balance) as total_balance
FROM users u
LEFT JOIN wallets w ON w.user_id = u.id
LEFT JOIN wallet_balances wb ON wb.wallet_id = w.id;

-- Transaction Summary View (with profit analysis)
CREATE VIEW transaction_summary AS
SELECT
  t.id,
  t.type,
  t.status,
  t.amount,
  t.fee,
  t.cost,
  t.profit,
  CASE
    WHEN t.cost > 0 THEN (t.profit / t.cost * 100)
    ELSE 100 -- Internal transfers have infinite ROI!
  END as profit_margin_percentage,
  fu.username as from_username,
  tu.username as to_username,
  t.created_at,
  t.settled_at
FROM transactions t
LEFT JOIN users fu ON fu.id = t.from_user_id
LEFT JOIN users tu ON tu.id = t.to_user_id;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all user-facing tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY users_select_own ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY users_update_own ON users
  FOR UPDATE USING (auth.uid() = id);

-- Wallets: users can only see their own
CREATE POLICY wallets_select_own ON wallets
  FOR SELECT USING (auth.uid() = user_id);

-- Wallet Balances: users can only see their own
CREATE POLICY wallet_balances_select_own ON wallet_balances
  FOR SELECT USING (
    wallet_id IN (
      SELECT id FROM wallets WHERE user_id = auth.uid()
    )
  );

-- Transactions: users can see transactions they're involved in
CREATE POLICY transactions_select_involved ON transactions
  FOR SELECT USING (
    auth.uid() = from_user_id OR auth.uid() = to_user_id
  );

-- Payment Methods: users can only see their own
CREATE POLICY payment_methods_select_own ON payment_methods
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- SEED DATA (Development Only)
-- ============================================

-- Platform wallet (for fees, reserves, etc.)
INSERT INTO users (id, email, display_name, type, kyc_status)
VALUES ('00000000-0000-0000-0000-000000000000', 'platform@hedgepayments.com', 'Hedge Payments Platform', 'merchant', 'verified');

INSERT INTO wallets (id, user_id, type)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'platform');

INSERT INTO wallet_balances (wallet_id, currency, available_balance)
VALUES ('00000000-0000-0000-0000-000000000001', 'USD', 0);

COMMENT ON TABLE transactions IS 'All payment transactions. Internal transfers have cost=0, external have cost>0';
COMMENT ON COLUMN transactions.profit IS 'Revenue minus cost. Internal transfers have 100% margin!';
COMMENT ON TABLE network_analytics IS 'Daily aggregated metrics to track network effect growth';
