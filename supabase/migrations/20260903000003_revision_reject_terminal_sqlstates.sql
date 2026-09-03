-- ==============================================================================
-- Grace Ledger — Migration: Explicit SQLSTATEs for revision/terminal-reject RPCs
-- Target: PostgreSQL 17 / Supabase
-- Description:
--   Same fix as 20260903000002_approve_transaction_sod_errcode.sql, applied to
--   request_transaction_revision() and reject_transaction_terminal(). Both
--   raised every error path with a bare RAISE EXCEPTION (implicit P0001), so
--   the client's error.code === 'P0001' isStaleState check was true for
--   "Transaction not found", "Unauthorized", and the note/reason length
--   validation too — not just the actual "not pending approval" conflict.
--   Gives each path its own SQLSTATE, matching the GL0xx / P0001 scheme from
--   the approve_transaction() fix. No message text or control flow changes.
-- ==============================================================================

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
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id
      USING ERRCODE = 'GL001';
  END IF;

  -- 2. Authorize caller (Must have approver role)
  IF NOT has_church_access(v_txn.church_id, 'approver') THEN
    RAISE EXCEPTION 'Unauthorized: Only designated approvers may request revisions on transactions.'
      USING ERRCODE = 'GL002';
  END IF;

  -- 3. Verify state
  IF v_txn.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Invalid State Transition: Only transactions pending approval can be returned for revision (current status: %).', v_txn.status
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Validate revision note (minimum 5 characters mandatory)
  IF p_revision_note IS NULL OR length(trim(p_revision_note)) < 5 THEN
    RAISE EXCEPTION 'Invalid Revision: A specific revision note (minimum 5 characters) is mandatory.'
      USING ERRCODE = 'GL003';
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
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id
      USING ERRCODE = 'GL001';
  END IF;

  -- 2. Authorize caller (Must have approver role)
  IF NOT has_church_access(v_txn.church_id, 'approver') THEN
    RAISE EXCEPTION 'Unauthorized: Only designated approvers may reject transactions.'
      USING ERRCODE = 'GL002';
  END IF;

  -- 3. Verify state
  IF v_txn.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Invalid State Transition: Only transactions pending approval can be rejected (current status: %).', v_txn.status
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Validate rejection reason (minimum 5 characters mandatory)
  IF p_rejection_reason IS NULL OR length(trim(p_rejection_reason)) < 5 THEN
    RAISE EXCEPTION 'Invalid Rejection: A specific rejection reason (minimum 5 characters) is mandatory.'
      USING ERRCODE = 'GL003';
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
