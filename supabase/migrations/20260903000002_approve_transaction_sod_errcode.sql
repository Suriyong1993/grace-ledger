-- ==============================================================================
-- Grace Ledger — Migration: Explicit SQLSTATEs for approve_transaction()
-- Target: PostgreSQL 17 / Supabase
-- Description:
--   approve_transaction() raised every error path with a bare RAISE EXCEPTION,
--   which defaults to SQLSTATE P0001 for all of them. The client
--   (src/lib/transactions/approvals-service.ts) checks error.code === 'P0001'
--   to flag isStaleState and error.code === 'P0003' to flag
--   isTwoPersonViolation — with every path defaulting to P0001, isStaleState
--   was incorrectly true for "Transaction not found", "Unauthorized", and
--   "Integrity Error" too, not just the actual state-conflict path. Message-
--   substring matching was the only thing actually working.
--   This gives each error path its own SQLSTATE so the code checks are
--   accurate: P0001 stays on the state-conflict raise (already correct by
--   default, now explicit), P0003 goes on Segregation-of-Duties, and the
--   remaining paths get distinct GL0xx codes so they no longer collide.
--   No message text or control flow changes.
-- ==============================================================================

CREATE OR REPLACE FUNCTION approve_transaction(
  p_transaction_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_txn transactions%ROWTYPE;
  v_split_sum NUMERIC(14,2);
BEGIN
  -- 1. Fetch and lock transaction
  SELECT * INTO v_txn FROM transactions WHERE id = p_transaction_id FOR UPDATE;

  IF v_txn.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id
      USING ERRCODE = 'GL001';
  END IF;

  -- 2. Authorize caller (Must have approver role)
  IF NOT has_church_access(v_txn.church_id, 'approver') THEN
    RAISE EXCEPTION 'Unauthorized: Only designated approvers or pastors may approve transactions.'
      USING ERRCODE = 'GL002';
  END IF;

  -- 3. Verify state
  IF v_txn.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Invalid State Transition: Transaction is not pending approval (current status: %).', v_txn.status
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Enforce Two-Person Rule (Segregation of Duties)
  IF auth.uid() = v_txn.created_by THEN
    RAISE EXCEPTION 'Segregation of Duties Violation: Creator cannot approve their own transaction (user: %).', auth.uid()
      USING ERRCODE = 'P0003';
  END IF;

  -- 5. Verify split sum parity
  SELECT COALESCE(SUM(amount), 0) INTO v_split_sum
  FROM transaction_splits
  WHERE transaction_id = p_transaction_id;

  IF v_split_sum <> v_txn.amount THEN
    RAISE EXCEPTION 'Integrity Error: Split sum (฿%) does not match transaction amount (฿%).', v_split_sum, v_txn.amount
      USING ERRCODE = 'GL004';
  END IF;

  -- 6. Transition to approved
  UPDATE transactions
  SET
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now(),
    updated_at = now()
  WHERE id = p_transaction_id;

  -- 7. Record APPROVAL audit log
  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_txn.church_id, 'APPROVAL', auth.uid(), 'APPROVE_TRANSACTION', 'transactions', p_transaction_id,
    jsonb_build_object(
      'amount', v_txn.amount,
      'approved_by', auth.uid(),
      'created_by', v_txn.created_by,
      'note', p_note,
      'approved_at', now()
    )
  );

  RETURN p_transaction_id;
END;
$$;
