-- ==============================================================================
-- Grace Ledger — Migration 006: Governance Semantics & Terminal Rejection
-- Author: Principal System & Financial Architect
-- Target: PostgreSQL 17 / Supabase
-- Description:
--   1. Implements request_transaction_revision() (pending_approval -> draft)
--   2. Implements reject_transaction_terminal() (pending_approval -> rejected)
--   3. Hardens lifecycle trigger & void RPC against invalid operations on rejected transactions
--   4. Preserves distinct audit events: REVISION_REQUESTED vs TRANSACTION_REJECTED
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. STATE TRANSITION & IMMUTABILITY TRIGGER HARDENING
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_validate_transaction_split_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_split_total NUMERIC(14,2);
  v_split_count INTEGER;
BEGIN
  -- 1. Lock down rejected & voided transactions completely
  IF (TG_OP = 'UPDATE' AND OLD.status = 'rejected') THEN
    RAISE EXCEPTION 'Immutable Ledger: Rejected transactions are permanently locked and cannot be modified.';
  END IF;

  IF (TG_OP = 'DELETE' AND OLD.status IN ('rejected', 'voided', 'posted', 'approved', 'pending_approval')) THEN
    RAISE EXCEPTION 'Immutable Ledger: Transactions in state % cannot be deleted.', OLD.status;
  END IF;

  -- 2. Validate split sum parity on transition from draft to any advanced state
  IF (TG_OP = 'UPDATE' AND NEW.status IN ('pending_approval', 'approved', 'posted') AND OLD.status = 'draft') THEN
    SELECT COALESCE(SUM(amount), 0), COUNT(*) 
    INTO v_split_total, v_split_count
    FROM transaction_splits 
    WHERE transaction_id = NEW.id;

    IF v_split_count = 0 THEN
      RAISE EXCEPTION 'Transaction split validation failed: Transaction must have at least one split.';
    END IF;

    IF v_split_total <> NEW.amount THEN
      RAISE EXCEPTION 'Transaction split validation failed: Sum of splits (฿%) does not match transaction amount (฿%).', v_split_total, NEW.amount;
    END IF;
  END IF;

  -- 3. Protect non-draft transactions from direct modification of core financial fields
  IF (TG_OP = 'UPDATE' AND OLD.status IN ('pending_approval', 'approved', 'posted', 'voided', 'rejected')) THEN
    -- Allow revision request (pending_approval -> draft) or terminal reject (pending_approval -> rejected) or approve (pending_approval -> approved)
    IF NOT (OLD.status = 'pending_approval' AND NEW.status IN ('draft', 'rejected', 'approved')) THEN
      IF (NEW.amount <> OLD.amount OR NEW.account_id <> OLD.account_id OR NEW.direction <> OLD.direction) THEN
        RAISE EXCEPTION 'Immutable Ledger: Financial attributes of % transactions cannot be modified directly.', OLD.status;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. RPC: REQUEST TRANSACTION REVISION (pending_approval -> draft)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION request_transaction_revision(
  p_transaction_id UUID,
  p_revision_note TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_txn transactions%ROWTYPE;
BEGIN
  -- 1. Fetch and lock transaction
  SELECT * INTO v_txn FROM transactions WHERE id = p_transaction_id FOR UPDATE;

  IF v_txn.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  -- 2. Authorize caller (Must have approver role)
  IF NOT has_church_access(v_txn.church_id, 'approver') THEN
    RAISE EXCEPTION 'Unauthorized: Only designated approvers may request revisions on transactions.';
  END IF;

  -- 3. Verify state
  IF v_txn.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Invalid State Transition: Only transactions pending approval can be returned for revision (current status: %).', v_txn.status;
  END IF;

  -- 4. Validate revision note (minimum 5 characters mandatory)
  IF p_revision_note IS NULL OR length(trim(p_revision_note)) < 5 THEN
    RAISE EXCEPTION 'Invalid Revision: A specific revision note (minimum 5 characters) is mandatory.';
  END IF;

  -- 5. Revert status to draft with revision details
  UPDATE transactions
  SET 
    status = 'draft',
    rejected_by = auth.uid(),
    rejected_at = now(),
    rejection_reason = trim(p_revision_note),
    updated_at = now()
  WHERE id = p_transaction_id;

  -- 6. Record distinct REVISION_REQUESTED audit log
  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_txn.church_id, 'APPROVAL', auth.uid(), 'REVISION_REQUESTED', 'transactions', p_transaction_id,
    jsonb_build_object(
      'amount', v_txn.amount,
      'revision_note', trim(p_revision_note),
      'requested_by', auth.uid(),
      'requested_at', now(),
      'previous_status', 'pending_approval'
    )
  );

  RETURN p_transaction_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. RPC: REJECT TRANSACTION TERMINAL (pending_approval -> rejected)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION reject_transaction_terminal(
  p_transaction_id UUID,
  p_rejection_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_txn transactions%ROWTYPE;
BEGIN
  -- 1. Fetch and lock transaction
  SELECT * INTO v_txn FROM transactions WHERE id = p_transaction_id FOR UPDATE;

  IF v_txn.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  -- 2. Authorize caller (Must have approver role)
  IF NOT has_church_access(v_txn.church_id, 'approver') THEN
    RAISE EXCEPTION 'Unauthorized: Only designated approvers may reject transactions.';
  END IF;

  -- 3. Verify state
  IF v_txn.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Invalid State Transition: Only transactions pending approval can be rejected (current status: %).', v_txn.status;
  END IF;

  -- 4. Validate rejection reason (minimum 5 characters mandatory)
  IF p_rejection_reason IS NULL OR length(trim(p_rejection_reason)) < 5 THEN
    RAISE EXCEPTION 'Invalid Rejection: A specific rejection reason (minimum 5 characters) is mandatory.';
  END IF;

  -- 5. Set status to terminal rejected with rejection details
  UPDATE transactions
  SET 
    status = 'rejected',
    rejected_by = auth.uid(),
    rejected_at = now(),
    rejection_reason = trim(p_rejection_reason),
    updated_at = now()
  WHERE id = p_transaction_id;

  -- 6. Record distinct TRANSACTION_REJECTED audit log
  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_txn.church_id, 'APPROVAL', auth.uid(), 'TRANSACTION_REJECTED', 'transactions', p_transaction_id,
    jsonb_build_object(
      'amount', v_txn.amount,
      'rejection_reason', trim(p_rejection_reason),
      'rejected_by', auth.uid(),
      'rejected_at', now(),
      'previous_status', 'pending_approval',
      'terminal', true
    )
  );

  RETURN p_transaction_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. RPC: UPDATE LEGACY reject_transaction TO POINT TO TERMINAL REJECT
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION reject_transaction(
  p_transaction_id UUID,
  p_rejection_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN reject_transaction_terminal(p_transaction_id, p_rejection_reason);
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. RPC: HARDEN void_transaction AGAINST NON-POSTED TRANSACTIONS
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

  -- 2. Verify caller has treasurer or admin role
  IF NOT has_church_access(v_orig.church_id, 'treasurer') THEN
    RAISE EXCEPTION 'Unauthorized: Only treasurers or administrators may void transactions.';
  END IF;

  -- 3. Strict State Check: Only posted transactions can be voided and reversed
  IF v_orig.status <> 'posted' THEN
    RAISE EXCEPTION 'Invalid State Transition: Only posted transactions can be voided and reversed (current status: %).', v_orig.status;
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Invalid Void: A specific justification reason (minimum 5 characters) is required.';
  END IF;

  -- 4. Mark original transaction as voided (NEVER DELETED)
  UPDATE transactions 
  SET status = 'voided', updated_at = now() 
  WHERE id = p_transaction_id;

  -- 5. Insert reversing mirror transaction
  INSERT INTO transactions (
    church_id, account_id, amount, direction, status, description,
    posted_at, created_by, is_reversal, reversal_of_id, metadata
  ) VALUES (
    v_orig.church_id,
    v_orig.account_id,
    v_orig.amount,
    v_orig.direction,
    'voided',
    'REVERSAL: ' || v_orig.description,
    now(),
    auth.uid(),
    true,
    v_orig.id,
    jsonb_build_object('void_reason', trim(p_reason), 'voided_at', now(), 'voided_by', auth.uid())
  ) RETURNING id INTO v_reversal_id;

  -- 6. Insert reversing splits
  INSERT INTO transaction_splits (
    transaction_id, church_id, fund_id, category_id, amount, note
  )
  SELECT 
    v_reversal_id, church_id, fund_id, category_id, amount, 'REVERSAL: ' || COALESCE(note, '')
  FROM transaction_splits
  WHERE transaction_id = p_transaction_id;

  -- 7. Reverse Account Balance
  IF v_orig.direction = 'income' THEN
    UPDATE accounts SET current_balance = current_balance - v_orig.amount, updated_at = now() WHERE id = v_orig.account_id;
  ELSIF v_orig.direction = 'expense' THEN
    UPDATE accounts SET current_balance = current_balance + v_orig.amount, updated_at = now() WHERE id = v_orig.account_id;
  END IF;

  -- 8. Reverse Fund Balances
  IF v_orig.direction = 'income' THEN
    UPDATE funds f
    SET current_balance = f.current_balance - s.split_amount, updated_at = now()
    FROM (
      SELECT fund_id, SUM(amount) AS split_amount 
      FROM transaction_splits 
      WHERE transaction_id = p_transaction_id 
      GROUP BY fund_id
    ) s
    WHERE f.id = s.fund_id;
  ELSIF v_orig.direction = 'expense' THEN
    UPDATE funds f
    SET current_balance = f.current_balance + s.split_amount, updated_at = now()
    FROM (
      SELECT fund_id, SUM(amount) AS split_amount 
      FROM transaction_splits 
      WHERE transaction_id = p_transaction_id 
      GROUP BY fund_id
    ) s
    WHERE f.id = s.fund_id;
  END IF;

  -- 9. Record immutable audit log
  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_orig.church_id, 'FINANCIAL', auth.uid(), 'VOID_TRANSACTION', 'transactions', p_transaction_id,
    jsonb_build_object(
      'original_transaction_id', p_transaction_id,
      'reversal_transaction_id', v_reversal_id,
      'amount', v_orig.amount,
      'reason', trim(p_reason)
    )
  );

  RETURN v_reversal_id;
END;
$$;
