-- Atomic Internal Transfer Function
-- This function executes internal network transfers in a single atomic transaction
-- Ensures balance consistency with double-entry accounting

CREATE OR REPLACE FUNCTION execute_internal_transfer(
  p_from_wallet_id UUID,
  p_to_wallet_id UUID,
  p_amount DECIMAL(20, 2),
  p_currency TEXT DEFAULT 'USD',
  p_fee DECIMAL(20, 2) DEFAULT 0,
  p_memo TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_transaction_id UUID;
  v_from_balance DECIMAL(20, 2);
  v_to_balance DECIMAL(20, 2);
  v_from_user_id UUID;
  v_to_user_id UUID;
  v_total_required DECIMAL(20, 2);
BEGIN
  -- Calculate total required
  v_total_required := p_amount + p_fee;

  -- Get user IDs
  SELECT user_id INTO v_from_user_id FROM wallets WHERE id = p_from_wallet_id;
  SELECT user_id INTO v_to_user_id FROM wallets WHERE id = p_to_wallet_id;

  -- Validate sender has sufficient balance
  SELECT available_balance INTO v_from_balance
  FROM wallet_balances
  WHERE wallet_id = p_from_wallet_id AND currency = p_currency
  FOR UPDATE; -- Lock the row

  IF v_from_balance IS NULL THEN
    RAISE EXCEPTION 'Sender wallet balance not found';
  END IF;

  IF v_from_balance < v_total_required THEN
    RAISE EXCEPTION 'Insufficient balance. Required: %, Available: %', v_total_required, v_from_balance;
  END IF;

  -- Lock recipient balance row
  SELECT available_balance INTO v_to_balance
  FROM wallet_balances
  WHERE wallet_id = p_to_wallet_id AND currency = p_currency
  FOR UPDATE;

  IF v_to_balance IS NULL THEN
    RAISE EXCEPTION 'Recipient wallet balance not found';
  END IF;

  -- Generate transaction ID
  v_transaction_id := uuid_generate_v4();

  -- Update sender balance (debit amount + fee)
  UPDATE wallet_balances
  SET
    available_balance = available_balance - v_total_required,
    updated_at = NOW()
  WHERE wallet_id = p_from_wallet_id AND currency = p_currency;

  -- Update recipient balance (credit amount only, not fee)
  UPDATE wallet_balances
  SET
    available_balance = available_balance + p_amount,
    updated_at = NOW()
  WHERE wallet_id = p_to_wallet_id AND currency = p_currency;

  -- Insert transaction record
  INSERT INTO transactions (
    id,
    from_wallet_id,
    to_wallet_id,
    from_user_id,
    to_user_id,
    amount,
    currency,
    type,
    status,
    fee,
    cost,
    profit,
    fee_percentage,
    memo,
    settled_at
  ) VALUES (
    v_transaction_id,
    p_from_wallet_id,
    p_to_wallet_id,
    v_from_user_id,
    v_to_user_id,
    p_amount,
    p_currency,
    'internal_transfer',
    'completed',
    p_fee,
    0, -- Internal transfers cost $0!
    p_fee, -- 100% profit margin!
    CASE WHEN p_amount > 0 THEN p_fee / p_amount ELSE 0 END,
    p_memo,
    NOW()
  );

  -- Insert ledger entries (double-entry accounting)

  -- Debit entry (sender)
  INSERT INTO ledger_entries (
    transaction_id,
    wallet_id,
    entry_type,
    amount,
    currency,
    balance_after,
    description
  ) VALUES (
    v_transaction_id,
    p_from_wallet_id,
    'debit',
    v_total_required,
    p_currency,
    v_from_balance - v_total_required,
    CONCAT('Internal transfer to wallet ', p_to_wallet_id)
  );

  -- Credit entry (recipient)
  INSERT INTO ledger_entries (
    transaction_id,
    wallet_id,
    entry_type,
    amount,
    currency,
    balance_after,
    description
  ) VALUES (
    v_transaction_id,
    p_to_wallet_id,
    'credit',
    p_amount,
    p_currency,
    v_to_balance + p_amount,
    CONCAT('Internal transfer from wallet ', p_from_wallet_id)
  );

  -- Return transaction details
  RETURN json_build_object(
    'id', v_transaction_id,
    'from_wallet_id', p_from_wallet_id,
    'to_wallet_id', p_to_wallet_id,
    'from_user_id', v_from_user_id,
    'to_user_id', v_to_user_id,
    'amount', p_amount,
    'currency', p_currency,
    'fee', p_fee,
    'cost', 0,
    'profit', p_fee,
    'type', 'internal_transfer',
    'status', 'completed',
    'memo', p_memo,
    'settled_at', NOW(),
    'created_at', NOW()
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback happens automatically
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION execute_internal_transfer IS 'Atomically execute an internal network transfer with zero cost and 100% profit margin';

-- ============================================
-- Daily Analytics Aggregation Function
-- ============================================

CREATE OR REPLACE FUNCTION aggregate_daily_analytics(p_date DATE)
RETURNS VOID AS $$
DECLARE
  v_total_volume DECIMAL(20, 2);
  v_internal_volume DECIMAL(20, 2);
  v_external_volume DECIMAL(20, 2);
  v_total_txn INTEGER;
  v_internal_txn INTEGER;
  v_external_txn INTEGER;
  v_total_revenue DECIMAL(20, 2);
  v_total_cost DECIMAL(20, 2);
  v_total_profit DECIMAL(20, 2);
BEGIN
  -- Calculate volumes
  SELECT
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(CASE WHEN type = 'internal_transfer' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'external_payment' THEN amount ELSE 0 END), 0)
  INTO v_total_volume, v_internal_volume, v_external_volume
  FROM transactions
  WHERE DATE(created_at) = p_date AND status = 'completed';

  -- Calculate transaction counts
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE type = 'internal_transfer'),
    COUNT(*) FILTER (WHERE type = 'external_payment')
  INTO v_total_txn, v_internal_txn, v_external_txn
  FROM transactions
  WHERE DATE(created_at) = p_date AND status = 'completed';

  -- Calculate economics
  SELECT
    COALESCE(SUM(fee), 0),
    COALESCE(SUM(cost), 0),
    COALESCE(SUM(profit), 0)
  INTO v_total_revenue, v_total_cost, v_total_profit
  FROM transactions
  WHERE DATE(created_at) = p_date AND status = 'completed';

  -- Insert or update analytics
  INSERT INTO network_analytics (
    date,
    total_volume,
    internal_volume,
    external_volume,
    total_transactions,
    internal_transactions,
    external_transactions,
    total_revenue,
    total_cost,
    total_profit,
    network_percentage,
    avg_transaction_size,
    profit_margin
  ) VALUES (
    p_date,
    v_total_volume,
    v_internal_volume,
    v_external_volume,
    v_total_txn,
    v_internal_txn,
    v_external_txn,
    v_total_revenue,
    v_total_cost,
    v_total_profit,
    CASE WHEN v_total_volume > 0 THEN (v_internal_volume / v_total_volume * 100) ELSE 0 END,
    CASE WHEN v_total_txn > 0 THEN (v_total_volume / v_total_txn) ELSE 0 END,
    CASE WHEN v_total_revenue > 0 THEN (v_total_profit / v_total_revenue * 100) ELSE 0 END
  )
  ON CONFLICT (date) DO UPDATE SET
    total_volume = EXCLUDED.total_volume,
    internal_volume = EXCLUDED.internal_volume,
    external_volume = EXCLUDED.external_volume,
    total_transactions = EXCLUDED.total_transactions,
    internal_transactions = EXCLUDED.internal_transactions,
    external_transactions = EXCLUDED.external_transactions,
    total_revenue = EXCLUDED.total_revenue,
    total_cost = EXCLUDED.total_cost,
    total_profit = EXCLUDED.total_profit,
    network_percentage = EXCLUDED.network_percentage,
    avg_transaction_size = EXCLUDED.avg_transaction_size,
    profit_margin = EXCLUDED.profit_margin;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION aggregate_daily_analytics IS 'Aggregate daily network metrics to track network effect growth';
