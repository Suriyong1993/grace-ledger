-- =====================================================================
-- Migration 022: Fix execute_confirmed_financial_action schema drift
-- ---------------------------------------------------------------------
-- The original orchestrator (migration 016) was written against columns
-- that do not exist in the real schema, so it could never run. Confirmed
-- on a real PostgreSQL 17 instance (see scripts/verify-schema-drift.mjs):
--
--   ERROR 42703: column "started_at" of relation "idempotency_keys" does not exist
--
-- Defects fixed (all in the single function below):
--   1. L76:  INSERT idempotency_keys used non-existent `started_at`
--            (real table has created_at) and omitted NOT NULL `operation`.
--   2. L308: UPDATE ... SET completed_at = now()  -- column does not exist
--   3. L239: transactions INSERT listed `category_id` (exists only on
--            transaction_splits, not transactions).
--   4. L171/L250: transaction_splits INSERT used `description` -- the real
--            column is `note`.
--   5. L173/L251: inserted negative split amounts, violating
--            chk_split_amount_positive CHECK (amount > 0).
--   6. L163: transfer branch inserted a transactions row without NOT NULL
--            `account_id` (fund transfers are ledgered in fund_transfers).
--   7. L278: audit category 'FINANCIAL_EXECUTION' does not exist in
--            audit_category_enum (DATA_CHANGE/ACCESS/SECURITY/APPROVAL/
--            FINANCIAL) -> would abort the whole transaction at the audit step.
--
-- Approach: the orchestrator keeps full responsibility for authentication,
-- treasurer authorization, idempotency, confirmation binding/validation,
-- nonce + payload-hash anti-tamper, consumption and audit. Each financial
-- mutation is delegated to the canonical SECURITY DEFINER RPCs that already
-- enforce every financial invariant (split-sum parity, amount > 0, positive
-- splits, two-person approval, atomic balance updates). No financial logic is
-- duplicated here, so this cannot drift from the canonical implementation.
--
-- Financial invariants are preserved, never weakened:
--   * split-sum parity  -> enforced by post_transaction / void_transaction
--   * amount > 0 CHECK  -> canonical RPCs only ever write positive splits
--   * two-person rule   -> unchanged (post/void still require approved status;
--                          approval happens outside this RPC)
--   * immutability      -> posted/voided/rejected states unchanged
--   * offering state machine -> untouched
-- =====================================================================

CREATE OR REPLACE FUNCTION execute_confirmed_financial_action(
  p_confirmation_id UUID,
  p_church_id UUID,
  p_expected_payload_hash TEXT,
  p_expected_nonce TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_conf RECORD;
  v_idemp RECORD;
  v_resource_id UUID;
  v_result JSONB;
  v_existing UUID;

  -- Transfer variables (validated then delegated to canonical transfer_funds)
  v_from_fund_id UUID;
  v_to_fund_id UUID;
  v_amount NUMERIC(14,2);
  v_reason TEXT;

  -- Post / Void variables
  v_txn_id UUID;
  v_void_reason TEXT;
BEGIN
  -- 1. Authenticate caller from session
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not authenticated' USING ERRCODE = '28000';
  END IF;

  -- 2. Validate Treasurer / Super Admin Access
  IF NOT (has_church_access(p_church_id, 'treasurer') OR current_user_has_role('super_admin')) THEN
    RAISE EXCEPTION 'Access Denied: Only designated treasurers or administrators may execute financial actions' USING ERRCODE = '42501';
  END IF;

  -- 3. Idempotency Check (Check for completed replay first)
  SELECT * INTO v_idemp
  FROM idempotency_keys
  WHERE church_id = p_church_id
    AND user_id = v_user_id
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_idemp.payload_hash <> trim(p_expected_payload_hash) THEN
      RAISE EXCEPTION 'Idempotency Conflict: Re-used idempotency key with different payload' USING ERRCODE = '23505';
    END IF;

    IF v_idemp.status = 'completed' THEN
      RETURN v_idemp.response_body; -- Safe Replay (Bypasses single-use lock on retry)
    END IF;

    IF v_idemp.status = 'started' THEN
      RAISE EXCEPTION 'Idempotency Conflict: Concurrent request is already in progress' USING ERRCODE = '55P03';
    END IF;
  ELSE
    -- Real idempotency_keys columns: church_id, user_id, idempotency_key,
    -- operation (NOT NULL), payload_hash, status, created_at, expires_at.
    INSERT INTO idempotency_keys (
      church_id, user_id, idempotency_key, operation, payload_hash, status
    ) VALUES (
      p_church_id, v_user_id, p_idempotency_key, 'execute_confirmed_financial_action',
      trim(p_expected_payload_hash), 'started'
    );
  END IF;

  -- 4. Acquire Row Lock on Confirmation Record
  SELECT * INTO v_conf
  FROM action_confirmations
  WHERE id = p_confirmation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Confirmation Not Found: Invalid confirmation token' USING ERRCODE = 'P0002';
  END IF;

  -- 5. Validate Confirmation Tenant & User Binding
  IF v_conf.church_id <> p_church_id THEN
    RAISE EXCEPTION 'Cross-Tenant Access Denied: Confirmation token belongs to another church' USING ERRCODE = '42501';
  END IF;

  IF v_conf.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Cross-User Access Denied: Confirmation token belongs to another user' USING ERRCODE = '42501';
  END IF;

  -- 6. Validate Confirmation State & Expiration
  IF v_conf.status = 'consumed' THEN
    RAISE EXCEPTION 'Confirmation Already Consumed: This confirmation token has already been executed' USING ERRCODE = 'P0003';
  END IF;

  IF v_conf.status <> 'pending' THEN
    RAISE EXCEPTION 'Confirmation Inactive: This confirmation token is %', v_conf.status USING ERRCODE = 'P0004';
  END IF;

  IF v_conf.expires_at <= now() THEN
    UPDATE action_confirmations SET status = 'expired' WHERE id = p_confirmation_id;
    RAISE EXCEPTION 'Confirmation Expired: The confirmation token expired at %', v_conf.expires_at USING ERRCODE = 'P0004';
  END IF;

  -- 7. Validate Nonce & Payload Hash (Anti-Tamper)
  IF v_conf.nonce <> trim(p_expected_nonce) THEN
    RAISE EXCEPTION 'Nonce Mismatch: Invalid confirmation security nonce' USING ERRCODE = 'P0005';
  END IF;

  IF v_conf.payload_hash <> trim(p_expected_payload_hash) THEN
    RAISE EXCEPTION 'Payload Hash Mismatch: Action parameters have been altered or tampered' USING ERRCODE = 'P0006';
  END IF;

  -- 8. Execute Financial Mutation by Action Type
  --    Each branch delegates to the canonical SECURITY DEFINER RPC so every
  --    financial invariant is enforced by the single source of truth.
  IF v_conf.action = 'fund_transfer' THEN
    v_from_fund_id := (v_conf.normalized_parameters->>'from_fund_id')::UUID;
    v_to_fund_id := (v_conf.normalized_parameters->>'to_fund_id')::UUID;
    v_amount := (v_conf.normalized_parameters->>'amount')::NUMERIC(14,2);
    v_reason := v_conf.normalized_parameters->>'reason';

    IF v_from_fund_id = v_to_fund_id THEN
      RAISE EXCEPTION 'Invalid Transfer: Source and destination funds must be distinct' USING ERRCODE = '22023';
    END IF;

    IF v_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid Transfer Amount: Amount must be greater than 0' USING ERRCODE = '22023';
    END IF;

    -- Canonical transfer_funds (migration 014) validates fund ownership,
    -- locks rows, checks balance, inserts into fund_transfers (never a
    -- transactions/splits row with negative amounts) and updates balances
    -- atomically. NULL idempotency key keeps this orchestrator's record
    -- authoritative (no double idempotency row).
    v_resource_id := transfer_funds(
      p_church_id, v_from_fund_id, v_to_fund_id, v_amount,
      COALESCE(v_reason, 'โอนเงินระหว่างกองทุน'), NULL
    );

  ELSIF v_conf.action = 'post_transaction' THEN
    v_txn_id := (v_conf.normalized_parameters->>'transaction_id')::UUID;

    -- Tenant isolation pre-check, then delegate to canonical post_transaction
    -- (validates approved/draft status, split-sum parity, account ownership,
    --  applies balance mutations and marks posted).
    SELECT id INTO v_existing FROM transactions WHERE id = v_txn_id AND church_id = p_church_id FOR UPDATE;
    IF v_existing IS NULL THEN
      RAISE EXCEPTION 'Transaction Not Found: %', v_txn_id USING ERRCODE = 'P0002';
    END IF;

    v_resource_id := post_transaction(v_txn_id);

  ELSIF v_conf.action = 'void_transaction' THEN
    v_txn_id := (v_conf.normalized_parameters->>'transaction_id')::UUID;
    v_void_reason := v_conf.normalized_parameters->>'void_reason';

    -- Canonical void_transaction (migration 006) requires status 'posted'
    -- and a reason >= 5 chars, then creates the reversal transaction with
    -- positive split copies, reverses balances and audits. Fail-closed if
    -- the proposal is missing a valid reason.
    IF v_void_reason IS NULL OR length(trim(v_void_reason)) < 5 THEN
      RAISE EXCEPTION 'Invalid Void: A specific justification reason (minimum 5 characters) is required.' USING ERRCODE = '22023';
    END IF;

    SELECT id INTO v_existing FROM transactions WHERE id = v_txn_id AND church_id = p_church_id FOR UPDATE;
    IF v_existing IS NULL THEN
      RAISE EXCEPTION 'Transaction Not Found: %', v_txn_id USING ERRCODE = 'P0002';
    END IF;

    v_resource_id := void_transaction(v_txn_id, trim(v_void_reason));

  ELSE
    RAISE EXCEPTION 'Unsupported Financial Action: %', v_conf.action USING ERRCODE = '22023';
  END IF;

  -- 9. Insert Dual-Actor Audit Log (canonical RPCs already write their own
  --    FINANCIAL audit rows; this row links the confirmed execution to the
  --    confirmation + idempotency record).
  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    p_church_id, 'FINANCIAL', v_user_id, 'EXECUTE_' || upper(v_conf.action), 'financial_action', v_resource_id,
    jsonb_build_object(
      'ai_agent_id', 'grace_ai_v1',
      'confirmation_id', p_confirmation_id,
      'idempotency_key', p_idempotency_key,
      'tool_name', v_conf.tool_name,
      'resource_id', v_resource_id,
      'result', 'SUCCESS',
      'executed_at', now()
    )
  );

  -- 10. Mark Confirmation as Consumed
  UPDATE action_confirmations
  SET status = 'consumed', consumed_at = now(), consumed_by = v_user_id
  WHERE id = p_confirmation_id;

  -- 11. Build Result Payload
  v_result := jsonb_build_object(
    'success', true,
    'code', 'SUCCESS',
    'message', 'ดำเนินการทางการเงินเรียบร้อยแล้วและบันทึกลงบัญชีแยกประเภทสมบูรณ์',
    'action', v_conf.action,
    'resource_id', v_resource_id,
    'is_replay', false,
    'executed_at', now()
  );

  -- 12. Complete Idempotency Record (real columns only: no completed_at)
  UPDATE idempotency_keys
  SET status = 'completed', resource_id = v_resource_id, response_body = v_result
  WHERE church_id = p_church_id AND user_id = v_user_id AND idempotency_key = p_idempotency_key;

  RETURN v_result;
END;
$$;
