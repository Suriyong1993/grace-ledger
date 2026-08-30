-- =====================================================================
-- Migration 023: Fix transfer_funds deadlock ordering + least-privilege
-- EXECUTE grants on the financial RPC chain
-- ---------------------------------------------------------------------
-- Found in review of migration 022 (execute_confirmed_financial_action
-- schema-drift fix):
--
-- 1. DEADLOCK ORDERING REGRESSION
--    transfer_funds locked p_from_fund_id then p_to_fund_id in parameter
--    order. Two concurrent transfers in opposite directions (A->B and
--    B->A) can deadlock: each holds the lock the other wants. Postgres
--    aborts one with deadlock_detected rather than corrupting data, but
--    both callers now see spurious failures under concurrent load.
--    Fix: lock funds in ascending-UUID order regardless of transfer
--    direction, so both callers always request locks in the same order.
--
-- 2. MISSING LEAST-PRIVILEGE EXECUTE GRANTS
--    execute_confirmed_financial_action, transfer_funds, post_transaction
--    and void_transaction were never REVOKEd from the default PUBLIC
--    EXECUTE grant PostgreSQL gives every new function, so `anon` could
--    call these financial RPCs directly over PostgREST. Each function
--    fails closed on its own auth.uid()/treasurer check, so this was not
--    exploitable, but it is inconsistent with this codebase's own
--    least-privilege pattern (see the PIN-credential migration, 020). Fix: REVOKE
--    ALL FROM PUBLIC/anon, GRANT EXECUTE only to authenticated and
--    service_role -- identical effective access for legitimate callers,
--    anon access removed.
--
-- No financial invariant, RLS policy, or authorization logic changes.
-- =====================================================================

CREATE OR REPLACE FUNCTION transfer_funds(
  p_church_id UUID,
  p_from_fund_id UUID,
  p_to_fund_id UUID,
  p_amount NUMERIC(14,2),
  p_note TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transfer_id UUID;
  v_from_balance NUMERIC(14,2);
  v_from_fund_church UUID;
  v_to_fund_church UUID;
  v_payload_hash TEXT;
  v_existing RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not authenticated.' USING ERRCODE = '28000';
  END IF;

  -- 1. Authorization check
  IF NOT has_church_access(p_church_id, 'treasurer') THEN
    RAISE EXCEPTION 'Unauthorized: Only treasurers or administrators may transfer funds.' USING ERRCODE = '42501';
  END IF;

  -- 2. Domain validations
  IF p_from_fund_id = p_to_fund_id THEN
    RAISE EXCEPTION 'Invalid Transfer: Source fund and destination fund must be different.' USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid Transfer: Transfer amount must be strictly greater than zero.' USING ERRCODE = '22023';
  END IF;

  -- 3. Idempotency handling within single transaction
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    v_payload_hash := md5(p_church_id::text || ':' || p_from_fund_id::text || ':' || p_to_fund_id::text || ':' || p_amount::text || ':' || coalesce(p_note, ''));

    SELECT * INTO v_existing
    FROM idempotency_keys
    WHERE church_id = p_church_id AND user_id = v_user_id AND idempotency_key = trim(p_idempotency_key)
    FOR UPDATE;

    IF FOUND THEN
      IF v_existing.payload_hash <> v_payload_hash THEN
        RAISE EXCEPTION 'Idempotency Conflict: Same idempotency key used with different parameters' USING ERRCODE = 'P0001';
      END IF;

      IF v_existing.status = 'completed' THEN
        -- Return already completed transfer_id directly
        RETURN v_existing.resource_id;
      END IF;
    END IF;
  END IF;

  -- 4. Verify funds and acquire row locks in ASCENDING UUID ORDER --
  --    independent of which fund is source/destination -- so two
  --    concurrent opposite-direction transfers (A->B and B->A) always
  --    request their locks in the same global order and cannot deadlock.
  IF p_from_fund_id < p_to_fund_id THEN
    SELECT church_id, current_balance INTO v_from_fund_church, v_from_balance
    FROM funds WHERE id = p_from_fund_id AND is_active = true FOR UPDATE;

    SELECT church_id INTO v_to_fund_church
    FROM funds WHERE id = p_to_fund_id AND is_active = true FOR UPDATE;
  ELSE
    SELECT church_id INTO v_to_fund_church
    FROM funds WHERE id = p_to_fund_id AND is_active = true FOR UPDATE;

    SELECT church_id, current_balance INTO v_from_fund_church, v_from_balance
    FROM funds WHERE id = p_from_fund_id AND is_active = true FOR UPDATE;
  END IF;

  IF v_from_fund_church IS NULL OR v_from_fund_church <> p_church_id THEN
    RAISE EXCEPTION 'Invalid Transfer: Source fund does not exist or does not belong to church.' USING ERRCODE = '22023';
  END IF;

  IF v_to_fund_church IS NULL OR v_to_fund_church <> p_church_id THEN
    RAISE EXCEPTION 'Invalid Transfer: Destination fund does not exist or does not belong to church.' USING ERRCODE = '22023';
  END IF;

  -- 5. Check available balance
  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient Funds: Source fund balance (฿%) is less than requested transfer (฿%).', v_from_balance, p_amount USING ERRCODE = '22023';
  END IF;

  -- 6. Insert transfer record
  INSERT INTO fund_transfers (
    church_id, from_fund_id, to_fund_id, amount, note, status, created_by
  ) VALUES (
    p_church_id, p_from_fund_id, p_to_fund_id, p_amount, p_note, 'completed', v_user_id
  ) RETURNING id INTO v_transfer_id;

  -- 7. Update fund balances atomically
  UPDATE funds SET current_balance = current_balance - p_amount, updated_at = now() WHERE id = p_from_fund_id;
  UPDATE funds SET current_balance = current_balance + p_amount, updated_at = now() WHERE id = p_to_fund_id;

  -- 8. Record audit log entry
  INSERT INTO audit_logs (
    church_id, actor_id, action, category, entity_type, entity_id, before_state, after_state, metadata
  ) VALUES (
    p_church_id,
    v_user_id,
    'FUND_TRANSFER',
    'FINANCIAL',
    'fund_transfers',
    v_transfer_id,
    jsonb_build_object('from_fund_balance', v_from_balance),
    jsonb_build_object('from_fund_balance', v_from_balance - p_amount),
    jsonb_build_object('amount', p_amount, 'from_fund_id', p_from_fund_id, 'to_fund_id', p_to_fund_id, 'idempotency_key', p_idempotency_key)
  );

  -- 9. Persist completed idempotency record if key provided
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    INSERT INTO idempotency_keys (
      church_id, user_id, idempotency_key, operation, payload_hash, status, resource_id, response_body
    ) VALUES (
      p_church_id, v_user_id, trim(p_idempotency_key), 'transfer_funds', v_payload_hash, 'completed', v_transfer_id, jsonb_build_object('transfer_id', v_transfer_id)
    );
  END IF;

  RETURN v_transfer_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- Least-privilege EXECUTE grants on the financial RPC chain
-- Every function below already fails closed on its own auth.uid()/
-- has_church_access() check; these grants only remove the default PUBLIC
-- (and therefore anon) EXECUTE privilege PostgreSQL assigns on CREATE
-- FUNCTION, matching the pattern already established for the PIN-credential RPCs.
-- ------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION transfer_funds(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION transfer_funds(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION transfer_funds(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_funds(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION post_transaction(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION post_transaction(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION post_transaction(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION post_transaction(UUID) TO service_role;

REVOKE ALL ON FUNCTION void_transaction(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION void_transaction(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION void_transaction(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION void_transaction(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION execute_confirmed_financial_action(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION execute_confirmed_financial_action(UUID, UUID, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION execute_confirmed_financial_action(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_confirmed_financial_action(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
