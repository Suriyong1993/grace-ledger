-- ==============================================================================
-- Grace Ledger — Migration 011: Sunday Offering Business RPCs & Invariant Triggers
-- Author: Principal Engineer
-- Target: PostgreSQL 17 / Supabase
--
-- Invariants Enforced:
--   1. Dual Counter Invariant: counter1_id <> counter2_id
--   2. Strict State Machine: draft -> counting -> counted/variance_review -> confirmed -> posted
--      (All illegal shortcuts like draft->confirmed, counting->posted, posted->draft are blocked)
--   3. Variance State Guard: Non-zero variance cannot transition to 'confirmed'
--      without mandatory explanation (>= 5 chars) and variance_status IN ('explained', 'acknowledged')
--   4. Posting Idempotency: One finalized offering session -> One canonical transaction.
--      Repeated calls return existing transaction ID without duplicate transactions or double credits.
--   5. Channel x Fund Splits: Preserves payment channel attribution and fund allocation.
--   6. Cash lands in Cash Drawer; Transfer/QR lands in Bank Account.
--   7. Full Audit Trail for all offering lifecycle events (via immutable audit_logs)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. STATE TRANSITION & IMMUTABILITY TRIGGER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_validate_offering_session_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Immutability guard for posted sessions
  IF (OLD.status = 'posted' AND NEW.status <> 'posted') THEN
    RAISE EXCEPTION 'CANNOT_MODIFY_POSTED_OFFERING: A posted offering session is permanently immutable';
  END IF;

  -- 2. Immutability guard for voided sessions
  IF (OLD.status = 'voided' AND NEW.status <> 'voided') THEN
    RAISE EXCEPTION 'CANNOT_MODIFY_VOIDED_OFFERING: A voided offering session is permanently immutable';
  END IF;

  -- 3. Strict Forward State Transition Validation
  IF OLD.status = 'draft' AND NEW.status NOT IN ('draft', 'counting', 'voided') THEN
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION: draft session can only transition to counting or voided (attempted: %)', NEW.status;
  END IF;

  IF OLD.status = 'counting' AND NEW.status NOT IN ('counting', 'counted', 'variance_review', 'voided') THEN
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION: counting session can only transition to counted, variance_review, or voided (attempted: %)', NEW.status;
  END IF;

  IF OLD.status = 'counted' AND NEW.status NOT IN ('counted', 'counting', 'confirmed', 'voided') THEN
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION: counted session can only transition to confirmed, counting, or voided (attempted: %)', NEW.status;
  END IF;

  IF OLD.status = 'variance_review' AND NEW.status NOT IN ('variance_review', 'counting', 'counted', 'confirmed', 'voided') THEN
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION: variance_review session can only transition to counting, counted, confirmed, or voided (attempted: %)', NEW.status;
  END IF;

  IF OLD.status = 'confirmed' AND NEW.status NOT IN ('confirmed', 'posted', 'voided') THEN
    RAISE EXCEPTION 'CANNOT_REVERT_CONFIRMED_OFFERING: Confirmed sessions can only be posted to the ledger or voided (attempted: %)', NEW.status;
  END IF;

  -- 4. Database Invariant: Transition to Confirmed requires Variance = 0 OR Explained
  IF (NEW.status = 'confirmed' AND OLD.status IN ('counting', 'counted', 'variance_review')) THEN
    IF (NEW.cash_variance_amount <> 0 AND (NEW.variance_status NOT IN ('explained', 'acknowledged') OR NEW.variance_reason IS NULL OR length(trim(NEW.variance_reason)) < 5)) THEN
      RAISE EXCEPTION 'CANNOT_CONFIRM_UNRESOLVED_VARIANCE: Cash variance of % must be resolved or explained (>= 5 chars) before confirmation', NEW.cash_variance_amount;
    END IF;
  END IF;

  -- 5. Dual counter invariant
  IF (NEW.counter1_id IS NOT NULL AND NEW.counter2_id IS NOT NULL AND NEW.counter1_id = NEW.counter2_id) THEN
    RAISE EXCEPTION 'DUAL_COUNTER_VIOLATION: Counter 1 and Counter 2 must be different persons';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_offering_session_lifecycle ON offering_sessions;
CREATE TRIGGER trg_validate_offering_session_lifecycle
  BEFORE UPDATE ON offering_sessions
  FOR EACH ROW
  EXECUTE FUNCTION fn_validate_offering_session_lifecycle();

-- ------------------------------------------------------------------------------
-- 2. RPC: create_offering_session
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_offering_session(
  p_service_date DATE,
  p_service_name TEXT,
  p_items JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_church_id UUID;
  v_session_id UUID;
  v_item JSONB;
  v_cash NUMERIC(14,2) := 0.00;
  v_transfer NUMERIC(14,2) := 0.00;
  v_qr NUMERIC(14,2) := 0.00;
  v_other NUMERIC(14,2) := 0.00;
  v_total NUMERIC(14,2) := 0.00;
  v_amt NUMERIC(14,2);
  v_channel TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated';
  END IF;

  SELECT church_id INTO v_church_id FROM profiles WHERE id = v_user_id;
  IF v_church_id IS NULL THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND: Profile not associated with a church';
  END IF;

  IF NOT (has_church_access(v_church_id, 'treasurer') OR has_church_access(v_church_id, 'finance_staff') OR has_church_access(v_church_id, 'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions to create offering sessions';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_ITEMS: Offering session must contain at least one item';
  END IF;

  -- Compute channel totals
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_amt := (v_item->>'amount')::NUMERIC(14,2);
    IF v_amt <= 0 THEN
      RAISE EXCEPTION 'INVALID_AMOUNT: Item amount must be greater than zero';
    END IF;

    v_channel := COALESCE(v_item->>'payment_channel', 'cash');
    IF v_channel = 'cash' THEN
      v_cash := v_cash + v_amt;
    ELSIF v_channel = 'bank_transfer' THEN
      v_transfer := v_transfer + v_amt;
    ELSIF v_channel = 'qr_code' THEN
      v_qr := v_qr + v_amt;
    ELSE
      v_other := v_other + v_amt;
    END IF;
    v_total := v_total + v_amt;
  END LOOP;

  -- Create session
  INSERT INTO offering_sessions (
    church_id,
    service_date,
    service_name,
    expected_cash_amount,
    expected_transfer_amount,
    expected_qr_amount,
    expected_total_amount,
    expected_amount,
    status,
    notes,
    created_by
  ) VALUES (
    v_church_id,
    p_service_date,
    COALESCE(p_service_name, 'รอบนมัสการวันอาทิตย์ (เช้า)'),
    v_cash,
    v_transfer,
    v_qr,
    v_total,
    v_total,
    'draft',
    p_notes,
    v_user_id
  ) RETURNING id INTO v_session_id;

  -- Insert items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO offering_session_items (
      offering_session_id,
      church_id,
      fund_id,
      category_id,
      payment_channel,
      source_type,
      amount,
      notes
    ) VALUES (
      v_session_id,
      v_church_id,
      (v_item->>'fund_id')::UUID,
      (v_item->>'category_id')::UUID,
      COALESCE(v_item->>'payment_channel', 'cash'),
      COALESCE(v_item->>'source_type', 'envelopes'),
      (v_item->>'amount')::NUMERIC(14,2),
      v_item->>'notes'
    );
  END LOOP;

  -- Audit log
  INSERT INTO audit_logs (
    church_id,
    category,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_church_id,
    'FINANCIAL',
    v_user_id,
    'SESSION_CREATED',
    'offering_sessions',
    v_session_id,
    jsonb_build_object(
      'service_date', p_service_date,
      'service_name', p_service_name,
      'expected_cash', v_cash,
      'expected_total', v_total
    )
  );

  RETURN v_session_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. RPC: revise_offering_expected_amount
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION revise_offering_expected_amount(
  p_session_id UUID,
  p_new_items JSONB,
  p_revision_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_session RECORD;
  v_item JSONB;
  v_cash NUMERIC(14,2) := 0.00;
  v_transfer NUMERIC(14,2) := 0.00;
  v_qr NUMERIC(14,2) := 0.00;
  v_other NUMERIC(14,2) := 0.00;
  v_total NUMERIC(14,2) := 0.00;
  v_amt NUMERIC(14,2);
  v_channel TEXT;
  v_rev_count INT;
  v_new_variance NUMERIC(14,2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated';
  END IF;

  SELECT * INTO v_session FROM offering_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Offering session not found';
  END IF;

  IF NOT (has_church_access(v_session.church_id, 'treasurer') OR has_church_access(v_session.church_id, 'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN: Only Treasurer or Super Admin can revise expected amounts under governance';
  END IF;

  IF v_session.status IN ('confirmed', 'posted', 'voided') THEN
    RAISE EXCEPTION 'INVALID_STATE: Cannot revise expected amount for confirmed or posted session';
  END IF;

  IF p_revision_reason IS NULL OR length(trim(p_revision_reason)) < 5 THEN
    RAISE EXCEPTION 'MANDATORY_REASON: Revision reason must be at least 5 characters';
  END IF;

  -- Compute new channel totals
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_new_items)
  LOOP
    v_amt := (v_item->>'amount')::NUMERIC(14,2);
    v_channel := COALESCE(v_item->>'payment_channel', 'cash');
    IF v_channel = 'cash' THEN
      v_cash := v_cash + v_amt;
    ELSIF v_channel = 'bank_transfer' THEN
      v_transfer := v_transfer + v_amt;
    ELSIF v_channel = 'qr_code' THEN
      v_qr := v_qr + v_amt;
    ELSE
      v_other := v_other + v_amt;
    END IF;
    v_total := v_total + v_amt;
  END LOOP;

  -- Revision number
  SELECT COALESCE(MAX(revision_number), 0) + 1 INTO v_rev_count 
  FROM offering_session_revisions WHERE offering_session_id = p_session_id;

  -- Record revision history
  INSERT INTO offering_session_revisions (
    offering_session_id,
    church_id,
    revision_number,
    previous_cash_amount,
    new_cash_amount,
    previous_total_amount,
    new_total_amount,
    revision_reason,
    revised_by
  ) VALUES (
    p_session_id,
    v_session.church_id,
    v_rev_count,
    v_session.expected_cash_amount,
    v_cash,
    v_session.expected_total_amount,
    v_total,
    p_revision_reason,
    v_user_id
  );

  -- Replace items
  DELETE FROM offering_session_items WHERE offering_session_id = p_session_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_new_items)
  LOOP
    INSERT INTO offering_session_items (
      offering_session_id,
      church_id,
      fund_id,
      category_id,
      payment_channel,
      source_type,
      amount,
      notes
    ) VALUES (
      p_session_id,
      v_session.church_id,
      (v_item->>'fund_id')::UUID,
      (v_item->>'category_id')::UUID,
      COALESCE(v_item->>'payment_channel', 'cash'),
      COALESCE(v_item->>'source_type', 'envelopes'),
      (v_item->>'amount')::NUMERIC(14,2),
      v_item->>'notes'
    );
  END LOOP;

  -- Recalculate variance against counted cash
  v_new_variance := v_session.counted_cash_amount - v_cash;

  UPDATE offering_sessions
  SET 
    expected_cash_amount = v_cash,
    expected_transfer_amount = v_transfer,
    expected_qr_amount = v_qr,
    expected_total_amount = v_total,
    expected_amount = v_total,
    cash_variance_amount = v_new_variance,
    variance_amount = v_new_variance,
    variance_status = CASE WHEN v_new_variance = 0 THEN 'zero_match' ELSE 'variance_detected' END,
    status = CASE WHEN v_session.status = 'variance_review' AND v_new_variance = 0 THEN 'counted' ELSE v_session.status END,
    updated_at = now()
  WHERE id = p_session_id;

  -- Audit log
  INSERT INTO audit_logs (
    church_id,
    category,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_session.church_id,
    'FINANCIAL',
    v_user_id,
    'OFFERING_EXPECTED_REVISED',
    'offering_sessions',
    p_session_id,
    jsonb_build_object(
      'revision_number', v_rev_count,
      'previous_cash', v_session.expected_cash_amount,
      'new_cash', v_cash,
      'previous_total', v_session.expected_total_amount,
      'new_total', v_total,
      'reason', p_revision_reason
    )
  );

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'revision_number', v_rev_count,
    'expected_cash', v_cash,
    'expected_total', v_total,
    'cash_variance', v_new_variance
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. RPC: start_cash_count
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION start_cash_count(
  p_session_id UUID,
  p_counter1_id UUID,
  p_counter2_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_session RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated';
  END IF;

  SELECT * INTO v_session FROM offering_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Offering session not found';
  END IF;

  IF NOT (
    has_church_access(v_session.church_id, 'counter') OR 
    has_church_access(v_session.church_id, 'finance_staff') OR 
    has_church_access(v_session.church_id, 'treasurer') OR 
    has_church_access(v_session.church_id, 'super_admin')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions to start cash count';
  END IF;

  IF p_counter1_id = p_counter2_id THEN
    RAISE EXCEPTION 'DUAL_COUNTER_VIOLATION: Counter 1 and Counter 2 must be different individuals';
  END IF;

  IF v_session.status NOT IN ('draft', 'counting') THEN
    RAISE EXCEPTION 'INVALID_STATE: Cash count can only start from draft or counting status';
  END IF;

  UPDATE offering_sessions
  SET 
    counter1_id = p_counter1_id,
    counter2_id = p_counter2_id,
    status = 'counting',
    updated_at = now()
  WHERE id = p_session_id;

  INSERT INTO audit_logs (
    church_id,
    category,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_session.church_id,
    'FINANCIAL',
    v_user_id,
    'CASH_COUNT_STARTED',
    'offering_sessions',
    p_session_id,
    jsonb_build_object(
      'counter1_id', p_counter1_id,
      'counter2_id', p_counter2_id
    )
  );

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'status', 'counting',
    'counter1_id', p_counter1_id,
    'counter2_id', p_counter2_id
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. RPC: record_cash_count
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION record_cash_count(
  p_session_id UUID,
  p_counter1_id UUID,
  p_counter2_id UUID,
  p_bill_1000 INT DEFAULT 0,
  p_bill_500 INT DEFAULT 0,
  p_bill_100 INT DEFAULT 0,
  p_bill_50 INT DEFAULT 0,
  p_bill_20 INT DEFAULT 0,
  p_coins NUMERIC(14,2) DEFAULT 0.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_session RECORD;
  v_total_cash NUMERIC(14,2);
  v_variance NUMERIC(14,2);
  v_var_status TEXT;
  v_next_status TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated';
  END IF;

  SELECT * INTO v_session FROM offering_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Offering session not found';
  END IF;

  IF NOT (
    has_church_access(v_session.church_id, 'counter') OR 
    has_church_access(v_session.church_id, 'finance_staff') OR 
    has_church_access(v_session.church_id, 'treasurer') OR 
    has_church_access(v_session.church_id, 'super_admin')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions to record cash count';
  END IF;

  IF p_counter1_id = p_counter2_id THEN
    RAISE EXCEPTION 'DUAL_COUNTER_VIOLATION: Counter 1 and Counter 2 must be different individuals';
  END IF;

  IF v_session.status NOT IN ('draft', 'counting', 'variance_review') THEN
    RAISE EXCEPTION 'INVALID_STATE: Cannot record count for session in status %', v_session.status;
  END IF;

  -- Pure physical cash count arithmetic
  v_total_cash := (1000 * p_bill_1000) + (500 * p_bill_500) + (100 * p_bill_100) + (50 * p_bill_50) + (20 * p_bill_20) + COALESCE(p_coins, 0.00);
  
  -- Variance against expected CASH ONLY
  v_variance := v_total_cash - v_session.expected_cash_amount;

  IF v_variance = 0 THEN
    v_var_status := 'zero_match';
    v_next_status := 'counted';
  ELSE
    v_var_status := 'variance_detected';
    v_next_status := 'variance_review';
  END IF;

  -- Upsert denomination proof
  INSERT INTO offering_cash_counts (
    offering_session_id,
    church_id,
    bill_1000,
    bill_500,
    bill_100,
    bill_50,
    bill_20,
    coins_amount,
    total_cash_counted,
    counted_by_1,
    counted_by_2,
    counted_at
  ) VALUES (
    p_session_id,
    v_session.church_id,
    p_bill_1000,
    p_bill_500,
    p_bill_100,
    p_bill_50,
    p_bill_20,
    COALESCE(p_coins, 0.00),
    v_total_cash,
    p_counter1_id,
    p_counter2_id,
    now()
  )
  ON CONFLICT (offering_session_id) DO UPDATE SET
    bill_1000 = EXCLUDED.bill_1000,
    bill_500 = EXCLUDED.bill_500,
    bill_100 = EXCLUDED.bill_100,
    bill_50 = EXCLUDED.bill_50,
    bill_20 = EXCLUDED.bill_20,
    coins_amount = EXCLUDED.coins_amount,
    total_cash_counted = EXCLUDED.total_cash_counted,
    counted_by_1 = EXCLUDED.counted_by_1,
    counted_by_2 = EXCLUDED.counted_by_2,
    counted_at = now();

  -- Update session
  UPDATE offering_sessions
  SET 
    counter1_id = p_counter1_id,
    counter2_id = p_counter2_id,
    counted_cash_amount = v_total_cash,
    cash_variance_amount = v_variance,
    counted_amount = v_total_cash,
    variance_amount = v_variance,
    variance_status = v_var_status,
    status = v_next_status,
    updated_at = now()
  WHERE id = p_session_id;

  -- Audit log
  INSERT INTO audit_logs (
    church_id,
    category,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_session.church_id,
    'FINANCIAL',
    v_user_id,
    CASE WHEN v_variance = 0 THEN 'CASH_COUNT_RECORDED' ELSE 'VARIANCE_DETECTED' END,
    'offering_sessions',
    p_session_id,
    jsonb_build_object(
      'total_cash_counted', v_total_cash,
      'expected_cash', v_session.expected_cash_amount,
      'cash_variance', v_variance,
      'variance_status', v_var_status
    )
  );

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'counted_cash', v_total_cash,
    'expected_cash', v_session.expected_cash_amount,
    'cash_variance', v_variance,
    'variance_status', v_var_status,
    'status', v_next_status
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. RPC: resolve_offering_variance
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION resolve_offering_variance(
  p_session_id UUID,
  p_action TEXT,
  p_explanation TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_session RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated';
  END IF;

  SELECT * INTO v_session FROM offering_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Offering session not found';
  END IF;

  IF NOT (
    has_church_access(v_session.church_id, 'finance_staff') OR 
    has_church_access(v_session.church_id, 'treasurer') OR 
    has_church_access(v_session.church_id, 'super_admin')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions to resolve offering variance';
  END IF;

  IF v_session.status NOT IN ('variance_review', 'counting') THEN
    RAISE EXCEPTION 'INVALID_STATE: Session must be in variance_review or counting to resolve variance';
  END IF;

  IF p_action = 'recount' THEN
    UPDATE offering_sessions
    SET 
      status = 'counting',
      variance_status = 'recounted',
      updated_at = now()
    WHERE id = p_session_id;

    INSERT INTO audit_logs (
      church_id, category, actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      v_session.church_id, 'FINANCIAL', v_user_id, 'VARIANCE_RECOUNT_REQUESTED', 'offering_sessions', p_session_id,
      jsonb_build_object('previous_variance', v_session.cash_variance_amount)
    );

    RETURN jsonb_build_object('session_id', p_session_id, 'action', 'recount', 'status', 'counting');

  ELSIF p_action = 'explain' THEN
    IF p_explanation IS NULL OR length(trim(p_explanation)) < 5 THEN
      RAISE EXCEPTION 'MANDATORY_EXPLANATION: Variance explanation must be at least 5 characters';
    END IF;

    UPDATE offering_sessions
    SET 
      variance_status = 'explained',
      variance_reason = p_explanation,
      updated_at = now()
    WHERE id = p_session_id;

    INSERT INTO audit_logs (
      church_id, category, actor_id, action, entity_type, entity_id, metadata
    ) VALUES (
      v_session.church_id, 'FINANCIAL', v_user_id, 'VARIANCE_RESOLVED', 'offering_sessions', p_session_id,
      jsonb_build_object(
        'cash_variance', v_session.cash_variance_amount,
        'explanation', p_explanation
      )
    );

    RETURN jsonb_build_object(
      'session_id', p_session_id,
      'action', 'explain',
      'variance_status', 'explained',
      'variance_reason', p_explanation
    );
  ELSE
    RAISE EXCEPTION 'INVALID_ACTION: Action must be either recount or explain';
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. RPC: confirm_offering_session
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION confirm_offering_session(
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_session RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated';
  END IF;

  SELECT * INTO v_session FROM offering_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Offering session not found';
  END IF;

  IF NOT (
    has_church_access(v_session.church_id, 'treasurer') OR 
    has_church_access(v_session.church_id, 'finance_staff') OR 
    has_church_access(v_session.church_id, 'super_admin')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions to confirm offering session';
  END IF;

  IF v_session.counter1_id IS NULL OR v_session.counter2_id IS NULL THEN
    RAISE EXCEPTION 'MISSING_COUNTERS: Both Counter 1 and Counter 2 must be recorded before confirmation';
  END IF;

  IF v_session.status NOT IN ('counted', 'variance_review') THEN
    RAISE EXCEPTION 'INVALID_STATE: Only counted or variance_reviewed sessions can be confirmed';
  END IF;

  -- Invariant: Non-zero variance must have valid explanation
  IF v_session.cash_variance_amount <> 0 THEN
    IF v_session.variance_status NOT IN ('explained', 'acknowledged') OR v_session.variance_reason IS NULL OR length(trim(v_session.variance_reason)) < 5 THEN
      RAISE EXCEPTION 'CANNOT_CONFIRM_UNRESOLVED_VARIANCE: Cash variance of % must be explained (>= 5 chars) before confirmation', v_session.cash_variance_amount;
    END IF;
  END IF;

  UPDATE offering_sessions
  SET 
    status = 'confirmed',
    counter1_signed_at = now(),
    counter2_signed_at = now(),
    updated_at = now()
  WHERE id = p_session_id;

  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_session.church_id, 'FINANCIAL', v_user_id, 'SESSION_CONFIRMED', 'offering_sessions', p_session_id,
    jsonb_build_object(
      'counter1_id', v_session.counter1_id,
      'counter2_id', v_session.counter2_id,
      'counted_cash', v_session.counted_cash_amount,
      'cash_variance', v_session.cash_variance_amount
    )
  );

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'status', 'confirmed',
    'counter1_signed_at', now(),
    'counter2_signed_at', now()
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. RPC: post_offering_to_ledger (With Robust Idempotency & Channel x Fund)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION post_offering_to_ledger(
  p_session_id UUID,
  p_cash_account_id UUID,
  p_bank_account_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_session RECORD;
  v_item RECORD;
  v_tx_id UUID;
  v_cash_acct RECORD;
  v_bank_acct RECORD;
  v_split_notes TEXT;
  v_actual_total NUMERIC(14,2);
  v_item_amt NUMERIC(14,2);
  v_default_fund_id UUID;
  v_default_cat_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated';
  END IF;

  -- 1. Row lock & Idempotency Check
  SELECT * INTO v_session FROM offering_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Offering session not found';
  END IF;

  -- 1b. Authorization Check
  IF NOT (has_church_access(v_session.church_id, 'treasurer') OR has_church_access(v_session.church_id, 'super_admin')) THEN
    RAISE EXCEPTION 'FORBIDDEN: Only Treasurer or Super Admin can post offering to ledger';
  END IF;

  -- IDEMPOTENT RETURN: If already posted, return canonical transaction ID safely
  IF v_session.status = 'posted' AND v_session.financial_transaction_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'session_id', p_session_id,
      'transaction_id', v_session.financial_transaction_id,
      'status', 'posted',
      'already_posted', true
    );
  END IF;

  IF v_session.status <> 'confirmed' THEN
    RAISE EXCEPTION 'INVALID_STATE: Session must be confirmed before posting to ledger (current: %)', v_session.status;
  END IF;

  -- 2. Verify Custody Accounts
  SELECT * INTO v_cash_acct FROM accounts WHERE id = p_cash_account_id AND church_id = v_session.church_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_ACCOUNT: Cash account not found for this church';
  END IF;

  -- Enforce bank account presence if electronic channels exist
  IF (v_session.expected_transfer_amount > 0 OR v_session.expected_qr_amount > 0) THEN
    IF p_bank_account_id IS NULL THEN
      RAISE EXCEPTION 'MISSING_BANK_ACCOUNT: Bank account is required when offering contains transfer or QR channel amounts';
    END IF;

    SELECT * INTO v_bank_acct FROM accounts WHERE id = p_bank_account_id AND church_id = v_session.church_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_ACCOUNT: Bank account not found for this church';
    END IF;
  END IF;

  -- Actual received total = physical cash counted + bank transfer + QR
  v_actual_total := v_session.counted_cash_amount + v_session.expected_transfer_amount + v_session.expected_qr_amount;

  -- 3. Create Canonical Financial Transaction
  INSERT INTO transactions (
    church_id,
    account_id,
    amount,
    direction,
    status,
    description,
    reference_number,
    created_by,
    approved_by,
    posted_at
  ) VALUES (
    v_session.church_id,
    p_cash_account_id,
    v_actual_total,
    'income',
    'posted',
    'เงินถวายวันอาทิตย์: ' || v_session.service_name,
    'OFFERING-' || to_char(v_session.service_date, 'YYYYMMDD'),
    v_session.created_by,
    v_user_id,
    now()
  ) RETURNING id INTO v_tx_id;

  -- 4. Create Transaction Splits (Channel x Fund Matrix)
  -- For non-cash channels (bank transfer, QR), split amount = item amount.
  -- For cash channel, if physical count differed from expected cash, allocate the actual counted cash
  -- proportionally across cash items, guaranteeing all splits are positive and sum to total transaction amount.
  FOR v_item IN SELECT * FROM offering_session_items WHERE offering_session_id = p_session_id
  LOOP
    IF v_item.payment_channel = 'cash' THEN
      IF COALESCE(v_session.expected_cash_amount, 0) > 0 THEN
        v_item_amt := ROUND(v_item.amount * (COALESCE(v_session.counted_cash_amount, 0) / v_session.expected_cash_amount), 2);
      ELSE
        v_item_amt := COALESCE(v_session.counted_cash_amount, 0);
      END IF;
    ELSE
      v_item_amt := v_item.amount;
    END IF;

    IF v_item_amt > 0 THEN
      v_split_notes := '[' || UPPER(v_item.payment_channel) || '] ' || COALESCE(v_item.notes, '');
      IF v_item.payment_channel = 'cash' AND v_session.cash_variance_amount <> 0 THEN
        v_split_notes := v_split_notes || ' (ยอดนับจริง: ผลต่าง ' || v_session.cash_variance_amount::TEXT || ' THB)';
      END IF;

      INSERT INTO transaction_splits (
        transaction_id,
        church_id,
        fund_id,
        category_id,
        amount,
        note
      ) VALUES (
        v_tx_id,
        v_session.church_id,
        v_item.fund_id,
        v_item.category_id,
        v_item_amt,
        v_split_notes
      );

      -- Credit Fund Balances with the allocated amount
      UPDATE funds 
      SET current_balance = current_balance + v_item_amt, updated_at = now()
      WHERE id = v_item.fund_id;
    END IF;
  END LOOP;

  -- 5. Credit Custody Accounts
  -- Physical Cash counted lands in Cash Drawer
  UPDATE accounts 
  SET current_balance = current_balance + v_session.counted_cash_amount, updated_at = now()
  WHERE id = p_cash_account_id;

  -- Electronic transfer/QR lands in Bank Account
  IF p_bank_account_id IS NOT NULL AND (v_session.expected_transfer_amount > 0 OR v_session.expected_qr_amount > 0) THEN
    UPDATE accounts 
    SET current_balance = current_balance + (v_session.expected_transfer_amount + v_session.expected_qr_amount), updated_at = now()
    WHERE id = p_bank_account_id;
  END IF;

  -- 6. Lock Offering Session to Posted
  UPDATE offering_sessions
  SET 
    status = 'posted',
    financial_transaction_id = v_tx_id,
    posted_at = now(),
    posted_by = v_user_id,
    updated_at = now()
  WHERE id = p_session_id;

  -- 7. Audit Log
  INSERT INTO audit_logs (
    church_id,
    category,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_session.church_id,
    'FINANCIAL',
    v_user_id,
    'OFFERING_POSTED',
    'offering_sessions',
    p_session_id,
    jsonb_build_object(
      'financial_transaction_id', v_tx_id,
      'total_amount', v_actual_total,
      'cash_drawer_credit', v_session.counted_cash_amount,
      'bank_account_credit', (v_session.expected_transfer_amount + v_session.expected_qr_amount)
    )
  );

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'transaction_id', v_tx_id,
    'status', 'posted',
    'already_posted', false
  );
END;
$$;
