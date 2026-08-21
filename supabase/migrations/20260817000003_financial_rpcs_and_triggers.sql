-- ==============================================================================
-- Grace Ledger — Migration 003: Financial Safety RPCs & Audit Triggers
-- Author: Principal Engineer
-- Target: PostgreSQL 16 / Supabase
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FINANCIAL DOMAIN RPC: ATOMIC FUND TRANSFERS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION transfer_funds(
  p_church_id UUID,
  p_from_fund_id UUID,
  p_to_fund_id UUID,
  p_amount NUMERIC(14,2),
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transfer_id UUID;
  v_from_balance NUMERIC(14,2);
  v_to_fund_exists BOOLEAN;
  v_from_fund_church UUID;
  v_to_fund_church UUID;
BEGIN
  -- 1. Authorization check
  IF NOT has_church_access(p_church_id, 'treasurer') THEN
    RAISE EXCEPTION 'Unauthorized: Only treasurers or administrators may transfer funds.';
  END IF;

  -- 2. Domain validations
  IF p_from_fund_id = p_to_fund_id THEN
    RAISE EXCEPTION 'Invalid Transfer: Source fund and destination fund must be different.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid Transfer: Transfer amount must be strictly greater than zero.';
  END IF;

  -- 3. Verify both funds belong to the specified church and acquire row locks
  SELECT church_id, current_balance 
  INTO v_from_fund_church, v_from_balance 
  FROM funds 
  WHERE id = p_from_fund_id AND is_active = true 
  FOR UPDATE;

  IF v_from_fund_church IS NULL OR v_from_fund_church <> p_church_id THEN
    RAISE EXCEPTION 'Invalid Transfer: Source fund does not exist or does not belong to church.';
  END IF;

  SELECT church_id INTO v_to_fund_church 
  FROM funds 
  WHERE id = p_to_fund_id AND is_active = true 
  FOR UPDATE;

  IF v_to_fund_church IS NULL OR v_to_fund_church <> p_church_id THEN
    RAISE EXCEPTION 'Invalid Transfer: Destination fund does not exist or does not belong to church.';
  END IF;

  -- 4. Check available balance in source fund
  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient Funds: Source fund balance (฿%) is less than requested transfer (฿%).', v_from_balance, p_amount;
  END IF;

  -- 5. Insert atomic transfer record
  INSERT INTO fund_transfers (
    church_id, from_fund_id, to_fund_id, amount, note, status, created_by
  ) VALUES (
    p_church_id, p_from_fund_id, p_to_fund_id, p_amount, p_note, 'completed', auth.uid()
  ) RETURNING id INTO v_transfer_id;

  -- 6. Update fund balances (Debit source, Credit destination)
  UPDATE funds SET current_balance = current_balance - p_amount, updated_at = now() WHERE id = p_from_fund_id;
  UPDATE funds SET current_balance = current_balance + p_amount, updated_at = now() WHERE id = p_to_fund_id;

  -- 7. Record immutable financial audit log entry
  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    p_church_id, 'FINANCIAL', auth.uid(), 'FUND_TRANSFER', 'fund_transfers', v_transfer_id,
    jsonb_build_object(
      'from_fund_id', p_from_fund_id,
      'to_fund_id', p_to_fund_id,
      'amount', p_amount,
      'net_church_impact', 0.00,
      'note', p_note
    )
  );

  RETURN v_transfer_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. FINANCIAL DOMAIN RPC: VOID & REVERSAL
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION void_transaction(
  p_transaction_id UUID,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_orig transactions%ROWTYPE;
  v_reversal_id UUID;
  v_account_balance NUMERIC(14,2);
BEGIN
  -- 1. Fetch and lock original transaction
  SELECT * INTO v_orig FROM transactions WHERE id = p_transaction_id FOR UPDATE;

  IF v_orig.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  IF NOT has_church_access(v_orig.church_id, 'treasurer') THEN
    RAISE EXCEPTION 'Unauthorized: Only treasurers or administrators may void transactions.';
  END IF;

  IF v_orig.status = 'voided' THEN
    RAISE EXCEPTION 'Transaction is already voided.';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Invalid Void: A specific justification reason (minimum 5 characters) is required.';
  END IF;

  -- 2. Mark original transaction as voided (NEVER DELETED)
  UPDATE transactions 
  SET status = 'voided', updated_at = now() 
  WHERE id = p_transaction_id;

  -- 3. Create balancing reversal entry
  INSERT INTO transactions (
    church_id, account_id, amount, direction, status,
    description, reference_number, posted_at, created_by, approved_by,
    is_reversal, reversal_of_id, metadata
  ) VALUES (
    v_orig.church_id,
    v_orig.account_id,
    v_orig.amount,
    CASE WHEN v_orig.direction = 'income' THEN 'expense'::transaction_direction_enum ELSE 'income'::transaction_direction_enum END,
    'posted',
    'Reversal of TX-' || SUBSTRING(v_orig.id::TEXT FROM 1 FOR 8) || ': ' || trim(p_reason),
    'REV-' || COALESCE(v_orig.reference_number, SUBSTRING(v_orig.id::TEXT FROM 1 FOR 8)),
    now(),
    auth.uid(),
    auth.uid(),
    true,
    v_orig.id,
    jsonb_build_object('void_reason', trim(p_reason), 'voided_by', auth.uid())
  ) RETURNING id INTO v_reversal_id;

  -- 4. Copy splits to reversal entry
  INSERT INTO transaction_splits (
    transaction_id, church_id, fund_id, category_id, amount, note
  )
  SELECT 
    v_reversal_id, church_id, fund_id, category_id, amount, 
    'Reversal split for TX-' || SUBSTRING(v_orig.id::TEXT FROM 1 FOR 8)
  FROM transaction_splits
  WHERE transaction_id = v_orig.id;

  -- 5. Record FINANCIAL audit log
  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_orig.church_id, 'FINANCIAL', auth.uid(), 'VOID_TRANSACTION', 'transactions', p_transaction_id,
    jsonb_build_object(
      'reversal_transaction_id', v_reversal_id,
      'original_amount', v_orig.amount,
      'original_direction', v_orig.direction,
      'reason', trim(p_reason)
    )
  );

  RETURN v_reversal_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. CONFIDENTIAL RPC: SENSITIVE MEMBER GIVING ACCESS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_member_giving_history(
  p_member_id UUID,
  p_reason TEXT
)
RETURNS SETOF member_giving_records
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_church_id UUID;
  v_member_name TEXT;
BEGIN
  -- 1. Resolve member and church
  SELECT church_id, full_name INTO v_church_id, v_member_name 
  FROM members 
  WHERE id = p_member_id;

  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'Member not found.';
  END IF;

  -- 2. Validate strict authorization (Pastor, Head Treasurer, or Admin only)
  IF NOT has_church_access(v_church_id, 'pastor') THEN
    RAISE EXCEPTION 'Access Denied: Only Pastors or designated Finance Leaders may view confidential member giving records.';
  END IF;

  -- 3. Validate access justification reason
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Access Denied: A valid justification reason (minimum 5 characters) is mandatory to access confidential records.';
  END IF;

  -- 4. Mandatory ACCESS audit logging
  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_church_id, 'ACCESS', auth.uid(), 'VIEW_MEMBER_GIVING', 'members', p_member_id,
    jsonb_build_object(
      'member_id', p_member_id,
      'member_name', v_member_name,
      'access_reason', trim(p_reason),
      'accessed_at', now()
    )
  );

  -- 5. Return confidential records
  RETURN QUERY 
  SELECT * 
  FROM member_giving_records 
  WHERE member_id = p_member_id 
  ORDER BY given_at DESC, created_at DESC;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. STATE TRANSITION & SPLIT VALIDATION TRIGGER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_validate_transaction_split_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_split_total NUMERIC(14,2);
BEGIN
  -- Triggered on UPDATE of transaction status
  IF (TG_OP = 'UPDATE' AND NEW.status IN ('pending_approval', 'posted') AND OLD.status = 'draft') THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_split_total 
    FROM transaction_splits 
    WHERE transaction_id = NEW.id;

    IF v_split_total <> NEW.amount THEN
      RAISE EXCEPTION 'Transaction split validation failed: Sum of splits (฿%) does not match transaction amount (฿%).', v_split_total, NEW.amount;
    END IF;
  END IF;

  -- Protect posted / voided transactions from direct manual editing
  IF (TG_OP = 'UPDATE' AND OLD.status IN ('posted', 'voided') AND NEW.status = OLD.status AND NEW.amount <> OLD.amount) THEN
    RAISE EXCEPTION 'Immutable Ledger: Posted or voided transactions cannot be directly modified. Use void_transaction() instead.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_transaction_status ON transactions;
CREATE TRIGGER trg_validate_transaction_status
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION fn_validate_transaction_split_lifecycle();

-- ------------------------------------------------------------------------------
-- 5. CHANGE DATA CAPTURE (CDC) AUDIT TRIGGER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_audit_log_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_church_id UUID;
  v_entity_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_church_id := OLD.church_id;
    v_entity_id := OLD.id;
  ELSE
    v_church_id := NEW.church_id;
    v_entity_id := NEW.id;
  END IF;

  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id,
    before_state, after_state
  ) VALUES (
    v_church_id,
    'DATA_CHANGE',
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    v_entity_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach CDC triggers to core ledger tables
DROP TRIGGER IF EXISTS trg_audit_transactions ON transactions;
CREATE TRIGGER trg_audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log_change();

DROP TRIGGER IF EXISTS trg_audit_transaction_splits ON transaction_splits;
CREATE TRIGGER trg_audit_transaction_splits
  AFTER INSERT OR UPDATE OR DELETE ON transaction_splits
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log_change();

DROP TRIGGER IF EXISTS trg_audit_fund_transfers ON fund_transfers;
CREATE TRIGGER trg_audit_fund_transfers
  AFTER INSERT OR UPDATE OR DELETE ON fund_transfers
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log_change();

DROP TRIGGER IF EXISTS trg_audit_funds ON funds;
CREATE TRIGGER trg_audit_funds
  AFTER INSERT OR UPDATE OR DELETE ON funds
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log_change();

DROP TRIGGER IF EXISTS trg_audit_accounts ON accounts;
CREATE TRIGGER trg_audit_accounts
  AFTER INSERT OR UPDATE OR DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log_change();

DROP TRIGGER IF EXISTS trg_audit_offering_sessions ON offering_sessions;
CREATE TRIGGER trg_audit_offering_sessions
  AFTER INSERT OR UPDATE OR DELETE ON offering_sessions
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log_change();
