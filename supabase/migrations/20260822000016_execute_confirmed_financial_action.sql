-- =====================================================================
-- Migration 016: Atomic Server-Side Financial Action Execution Orchestrator
-- Guarantees Atomic Transaction Boundary across:
-- Confirmation Validation + Idempotency + Financial Mutation + Audit + Confirmation Consumption
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
  
  -- Transfer variables
  v_from_fund_id UUID;
  v_to_fund_id UUID;
  v_amount NUMERIC(14,2);
  v_reason TEXT;
  v_from_fund funds%ROWTYPE;
  v_to_fund funds%ROWTYPE;
  v_transfer_txn_id UUID;
  
  -- Post / Void variables
  v_txn_id UUID;
  v_txn transactions%ROWTYPE;
  v_account accounts%ROWTYPE;
  v_split_sum NUMERIC(14,2);
  v_reversal_id UUID;
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
    INSERT INTO idempotency_keys (
      church_id, user_id, idempotency_key, payload_hash, status, started_at
    ) VALUES (
      p_church_id, v_user_id, p_idempotency_key, trim(p_expected_payload_hash), 'started', now()
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

    -- Lock funds in deterministic order to prevent deadlock
    IF v_from_fund_id < v_to_fund_id THEN
      SELECT * INTO v_from_fund FROM funds WHERE id = v_from_fund_id AND church_id = p_church_id FOR UPDATE;
      SELECT * INTO v_to_fund FROM funds WHERE id = v_to_fund_id AND church_id = p_church_id FOR UPDATE;
    ELSE
      SELECT * INTO v_to_fund FROM funds WHERE id = v_to_fund_id AND church_id = p_church_id FOR UPDATE;
      SELECT * INTO v_from_fund FROM funds WHERE id = v_from_fund_id AND church_id = p_church_id FOR UPDATE;
    END IF;

    IF v_from_fund.id IS NULL OR v_to_fund.id IS NULL THEN
      RAISE EXCEPTION 'Fund Not Found: Source or destination fund does not belong to church' USING ERRCODE = 'P0002';
    END IF;

    -- Financial Invariant: Non-negative balance check
    IF v_from_fund.current_balance < v_amount THEN
      RAISE EXCEPTION 'Insufficient Funds: Source fund balance (฿%) is less than transfer amount (฿%)',
        v_from_fund.current_balance, v_amount USING ERRCODE = '23514';
    END IF;

    -- Apply Fund Balance Mutations
    UPDATE funds SET current_balance = current_balance - v_amount, updated_at = now() WHERE id = v_from_fund_id;
    UPDATE funds SET current_balance = current_balance + v_amount, updated_at = now() WHERE id = v_to_fund_id;

    -- Create Transfer Transaction Record
    INSERT INTO transactions (
      church_id, amount, direction, status, description, created_by, approved_by, approved_at, posted_at, updated_at
    ) VALUES (
      p_church_id, v_amount, 'transfer', 'posted', COALESCE(v_reason, 'โอนเงินระหว่างกองทุน'),
      v_user_id, v_user_id, now(), now(), now()
    ) RETURNING id INTO v_transfer_txn_id;

    -- Create Debit and Credit Splits
    INSERT INTO transaction_splits (transaction_id, fund_id, amount, description)
    VALUES 
      (v_transfer_txn_id, v_from_fund_id, -v_amount, 'โอนออกจาก ' || v_from_fund.name),
      (v_transfer_txn_id, v_to_fund_id, v_amount, 'โอนเข้า ' || v_to_fund.name);

    v_resource_id := v_transfer_txn_id;

  ELSIF v_conf.action = 'post_transaction' THEN
    v_txn_id := (v_conf.normalized_parameters->>'transaction_id')::UUID;

    -- Lock and revalidate transaction
    SELECT * INTO v_txn FROM transactions WHERE id = v_txn_id AND church_id = p_church_id FOR UPDATE;
    IF v_txn.id IS NULL THEN
      RAISE EXCEPTION 'Transaction Not Found: %', v_txn_id USING ERRCODE = 'P0002';
    END IF;

    IF v_txn.status NOT IN ('approved', 'draft') THEN
      RAISE EXCEPTION 'Invalid State Transition: Only approved or draft transactions can be posted (current: %)', v_txn.status USING ERRCODE = '22023';
    END IF;

    -- Split Parity Invariant Check
    SELECT COALESCE(SUM(amount), 0) INTO v_split_sum FROM transaction_splits WHERE transaction_id = v_txn_id;
    IF v_split_sum <> v_txn.amount THEN
      RAISE EXCEPTION 'Integrity Error: Split sum (฿%) does not match transaction amount (฿%)', v_split_sum, v_txn.amount USING ERRCODE = '23514';
    END IF;

    -- Lock Account
    SELECT * INTO v_account FROM accounts WHERE id = v_txn.account_id AND church_id = p_church_id FOR UPDATE;
    IF v_account.id IS NULL THEN
      RAISE EXCEPTION 'Account Not Found: Transaction account does not belong to church' USING ERRCODE = 'P0002';
    END IF;

    -- Mutate Account & Funds
    IF v_txn.direction = 'income' THEN
      UPDATE accounts SET current_balance = current_balance + v_txn.amount, updated_at = now() WHERE id = v_txn.account_id;
      UPDATE funds f SET current_balance = f.current_balance + s.split_sum, updated_at = now()
      FROM (SELECT fund_id, SUM(amount) AS split_sum FROM transaction_splits WHERE transaction_id = v_txn_id GROUP BY fund_id) s
      WHERE f.id = s.fund_id;
    ELSIF v_txn.direction = 'expense' THEN
      UPDATE accounts SET current_balance = current_balance - v_txn.amount, updated_at = now() WHERE id = v_txn.account_id;
      UPDATE funds f SET current_balance = f.current_balance - s.split_sum, updated_at = now()
      FROM (SELECT fund_id, SUM(amount) AS split_sum FROM transaction_splits WHERE transaction_id = v_txn_id GROUP BY fund_id) s
      WHERE f.id = s.fund_id;
    END IF;

    -- Update Transaction Status
    UPDATE transactions SET status = 'posted', posted_at = now(), updated_at = now() WHERE id = v_txn_id;
    v_resource_id := v_txn_id;

  ELSIF v_conf.action = 'void_transaction' THEN
    v_txn_id := (v_conf.normalized_parameters->>'transaction_id')::UUID;
    v_void_reason := v_conf.normalized_parameters->>'void_reason';

    -- Lock and revalidate transaction
    SELECT * INTO v_txn FROM transactions WHERE id = v_txn_id AND church_id = p_church_id FOR UPDATE;
    IF v_txn.id IS NULL THEN
      RAISE EXCEPTION 'Transaction Not Found: %', v_txn_id USING ERRCODE = 'P0002';
    END IF;

    IF v_txn.status <> 'posted' THEN
      RAISE EXCEPTION 'Invalid State Transition: Only posted transactions can be voided (current: %)', v_txn.status USING ERRCODE = '22023';
    END IF;

    -- Mark transaction as voided
    UPDATE transactions SET status = 'voided', updated_at = now() WHERE id = v_txn_id;

    -- Create Reversal Mirror Transaction
    INSERT INTO transactions (
      church_id, account_id, category_id, amount,
      direction, status, description, created_by, approved_by, approved_at, posted_at, updated_at
    ) VALUES (
      p_church_id, v_txn.account_id, v_txn.category_id, v_txn.amount,
      CASE WHEN v_txn.direction = 'income' THEN 'expense' ELSE 'income' END,
      'posted',
      'REVERSAL (VOID): ' || COALESCE(v_txn.description, '') || ' | เหตุผล: ' || COALESCE(v_void_reason, 'ไม่ระบุ'),
      v_user_id, v_user_id, now(), now(), now()
    ) RETURNING id INTO v_reversal_id;

    -- Mirror Splits Reversal
    INSERT INTO transaction_splits (transaction_id, fund_id, amount, description)
    SELECT v_reversal_id, fund_id, -amount, 'REVERSAL: ' || COALESCE(description, '')
    FROM transaction_splits
    WHERE transaction_id = v_txn_id;

    -- Reverse Account and Fund Balances
    IF v_txn.direction = 'income' THEN
      UPDATE accounts SET current_balance = current_balance - v_txn.amount, updated_at = now() WHERE id = v_txn.account_id;
      UPDATE funds f SET current_balance = f.current_balance - s.split_sum, updated_at = now()
      FROM (SELECT fund_id, SUM(amount) AS split_sum FROM transaction_splits WHERE transaction_id = v_txn_id GROUP BY fund_id) s
      WHERE f.id = s.fund_id;
    ELSIF v_txn.direction = 'expense' THEN
      UPDATE accounts SET current_balance = current_balance + v_txn.amount, updated_at = now() WHERE id = v_txn.account_id;
      UPDATE funds f SET current_balance = f.current_balance + s.split_sum, updated_at = now()
      FROM (SELECT fund_id, SUM(amount) AS split_sum FROM transaction_splits WHERE transaction_id = v_txn_id GROUP BY fund_id) s
      WHERE f.id = s.fund_id;
    END IF;

    v_resource_id := v_txn_id;

  ELSE
    RAISE EXCEPTION 'Unsupported Financial Action: %', v_conf.action USING ERRCODE = '22023';
  END IF;

  -- 9. Insert Dual-Actor Audit Log
  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    p_church_id, 'FINANCIAL_EXECUTION', v_user_id, 'EXECUTE_' || upper(v_conf.action), 'financial_action', v_resource_id,
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

  -- 12. Complete Idempotency Record
  UPDATE idempotency_keys
  SET status = 'completed', resource_id = v_resource_id, response_body = v_result, completed_at = now()
  WHERE church_id = p_church_id AND user_id = v_user_id AND idempotency_key = p_idempotency_key;

  RETURN v_result;
END;
$$;
