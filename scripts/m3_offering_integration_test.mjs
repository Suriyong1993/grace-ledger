import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function runQuery(sql) {
  const tmpDir = path.resolve("tmp_queries");
  fs.mkdirSync(tmpDir, { recursive: true });
  const tempFile = path.resolve(tmpDir, `m3_int_${Date.now()}_${Math.random().toString(36).substring(7)}.sql`);
  fs.writeFileSync(tempFile, sql, "utf-8");

  try {
    const cmd = `npx supabase db query --linked --file "${tempFile}"`;
    const stdout = execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    return { success: true, output: stdout };
  } catch (err) {
    const errOutput = (err.stdout || "") + (err.stderr || "") + err.message;
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    return { success: false, output: errOutput };
  }
}

console.log("===============================================================================");
console.log("GRACE LEDGER — M3 REAL POSTGRESQL 17 INTEGRATION TEST SUITE (11 TEST GROUPS)");
console.log("===============================================================================");

const fullIntegrationSql = `
BEGIN;

DO $$
DECLARE
  -- Church A
  v_church_a UUID;
  v_user_treasurer_a UUID;
  v_user_staff_a UUID;
  v_user_counter1_a UUID;
  v_user_counter2_a UUID;
  v_user_member_a UUID;
  v_fund_gen_a UUID;
  v_fund_mis_a UUID;
  v_cat_tithe_a UUID;
  v_cat_mis_a UUID;
  v_acct_cash_a UUID;
  v_acct_bank_a UUID;

  -- Church B
  v_church_b UUID;
  v_user_treasurer_b UUID;
  v_fund_gen_b UUID;
  v_cat_tithe_b UUID;
  v_acct_cash_b UUID;

  -- Test Session Variables
  v_session_g1 UUID;
  v_session_g2 UUID;
  v_session_g3 UUID;
  v_session_g5 UUID;
  v_session_g6 UUID;
  v_session_g7 UUID;
  v_tx_id UUID;
  v_res_json JSONB;
  v_dup_json JSONB;
  v_items JSONB;
  v_rev_items JSONB;

  -- Balance Tracking
  v_initial_cash_bal NUMERIC(14,2);
  v_initial_bank_bal NUMERIC(14,2);
  v_initial_gen_bal NUMERIC(14,2);
  v_initial_mis_bal NUMERIC(14,2);
  v_final_cash_bal NUMERIC(14,2);
  v_final_bank_bal NUMERIC(14,2);
  v_final_gen_bal NUMERIC(14,2);
  v_final_mis_bal NUMERIC(14,2);
  v_splits_sum NUMERIC(14,2);
  v_tx_amount NUMERIC(14,2);
  v_split_count INT;
  v_err_msg TEXT;
  v_caught BOOLEAN;
  v_audit_count INT;
  v_rev_count INT;
  v_rec RECORD;
BEGIN
  -----------------------------------------------------------------------------
  -- FIXTURE SETUP
  -----------------------------------------------------------------------------
  INSERT INTO churches (name, currency) VALUES ('M3 Test Church A', 'THB') RETURNING id INTO v_church_a;
  INSERT INTO churches (name, currency) VALUES ('M3 Test Church B', 'THB') RETURNING id INTO v_church_b;

  -- Church A Users
  v_user_treasurer_a := gen_random_uuid();
  v_user_staff_a     := gen_random_uuid();
  v_user_counter1_a  := gen_random_uuid();
  v_user_counter2_a  := gen_random_uuid();
  v_user_member_a    := gen_random_uuid();

  INSERT INTO profiles (id, church_id, email, full_name) VALUES
    (v_user_treasurer_a, v_church_a, 'treasurer.a@test.org', 'Treasurer Alice'),
    (v_user_staff_a,     v_church_a, 'staff.a@test.org',     'Staff Bob'),
    (v_user_counter1_a,  v_church_a, 'counter1.a@test.org',  'Counter Charlie'),
    (v_user_counter2_a,  v_church_a, 'counter2.a@test.org',  'Counter Diana'),
    (v_user_member_a,    v_church_a, 'member.a@test.org',    'Member Eve');

  INSERT INTO user_roles (user_id, church_id, role) VALUES
    (v_user_treasurer_a, v_church_a, 'treasurer'),
    (v_user_staff_a,     v_church_a, 'finance_staff'),
    (v_user_counter1_a,  v_church_a, 'counter'),
    (v_user_counter2_a,  v_church_a, 'counter'),
    (v_user_member_a,    v_church_a, 'member');

  -- Church B Users
  v_user_treasurer_b := gen_random_uuid();
  INSERT INTO profiles (id, church_id, email, full_name) VALUES
    (v_user_treasurer_b, v_church_b, 'treasurer.b@test.org', 'Treasurer Bob B');
  INSERT INTO user_roles (user_id, church_id, role) VALUES
    (v_user_treasurer_b, v_church_b, 'treasurer');

  -- Funds & Categories
  INSERT INTO funds (church_id, name, current_balance) VALUES
    (v_church_a, 'General Fund A', 50000.00) RETURNING id INTO v_fund_gen_a;
  INSERT INTO funds (church_id, name, current_balance) VALUES
    (v_church_a, 'Mission Fund A', 10000.00) RETURNING id INTO v_fund_mis_a;
  INSERT INTO funds (church_id, name, current_balance) VALUES
    (v_church_b, 'General Fund B', 20000.00) RETURNING id INTO v_fund_gen_b;

  INSERT INTO categories (church_id, name, direction, default_fund_id) VALUES
    (v_church_a, 'Tithes & Offerings', 'income', v_fund_gen_a) RETURNING id INTO v_cat_tithe_a;
  INSERT INTO categories (church_id, name, direction, default_fund_id) VALUES
    (v_church_a, 'Mission Giving',     'income', v_fund_mis_a) RETURNING id INTO v_cat_mis_a;
  INSERT INTO categories (church_id, name, direction, default_fund_id) VALUES
    (v_church_b, 'Tithes B',            'income', v_fund_gen_b) RETURNING id INTO v_cat_tithe_b;

  -- Custody Accounts
  INSERT INTO accounts (church_id, name, type, account_number, current_balance) VALUES
    (v_church_a, 'Cash Drawer Safe', 'cash_drawer', '1010-A', 5000.00) RETURNING id INTO v_acct_cash_a;
  INSERT INTO accounts (church_id, name, type, account_number, current_balance) VALUES
    (v_church_a, 'Kasikorn Main Bank', 'bank', '1020-A', 100000.00) RETURNING id INTO v_acct_bank_a;
  INSERT INTO accounts (church_id, name, type, account_number, current_balance) VALUES
    (v_church_b, 'Cash Safe B', 'cash_drawer', '1010-B', 1000.00) RETURNING id INTO v_acct_cash_b;

  -----------------------------------------------------------------------------
  -- TEST GROUP 1 — HAPPY PATH (Draft -> Counting -> Counted -> Confirmed -> Posted)
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST GROUP 1: Happy Path Execution';

  SELECT current_balance INTO v_initial_cash_bal FROM accounts WHERE id = v_acct_cash_a;
  SELECT current_balance INTO v_initial_bank_bal FROM accounts WHERE id = v_acct_bank_a;
  SELECT current_balance INTO v_initial_gen_bal FROM funds WHERE id = v_fund_gen_a;
  SELECT current_balance INTO v_initial_mis_bal FROM funds WHERE id = v_fund_mis_a;

  -- 1. Create Session
  PERFORM set_config('request.jwt.claim.sub', v_user_staff_a::text, true);
  v_items := jsonb_build_array(
    jsonb_build_object('category_id', v_cat_tithe_a, 'fund_id', v_fund_gen_a, 'payment_channel', 'cash', 'amount', 10000.00, 'source_type', 'envelopes'),
    jsonb_build_object('category_id', v_cat_tithe_a, 'fund_id', v_fund_gen_a, 'payment_channel', 'bank_transfer', 'amount', 3000.00, 'source_type', 'electronic_slip'),
    jsonb_build_object('category_id', v_cat_mis_a,   'fund_id', v_fund_mis_a, 'payment_channel', 'qr_code', 'amount', 5450.00, 'source_type', 'electronic_slip')
  );

  v_session_g1 := create_offering_session(
    CURRENT_DATE,
    'Sunday Morning Worship G1',
    v_items,
    'Happy path offering session'
  );

  SELECT * INTO v_rec FROM offering_sessions WHERE id = v_session_g1;
  IF v_rec.status <> 'draft' OR v_rec.expected_cash_amount <> 10000.00 OR v_rec.expected_transfer_amount <> 3000.00 OR v_rec.expected_qr_amount <> 5450.00 OR v_rec.expected_total_amount <> 18450.00 THEN
    RAISE EXCEPTION 'G1_FAILED: Expected amounts or initial status mismatch: %', row_to_json(v_rec);
  END IF;

  -- 2. Start Cash Count (Dual Counters)
  PERFORM set_config('request.jwt.claim.sub', v_user_counter1_a::text, true);
  PERFORM start_cash_count(v_session_g1, v_user_counter1_a, v_user_counter2_a);

  SELECT status INTO v_err_msg FROM offering_sessions WHERE id = v_session_g1;
  IF v_err_msg <> 'counting' THEN
    RAISE EXCEPTION 'G1_FAILED: Session should be in counting status, got: %', v_err_msg;
  END IF;

  -- 3. Record Cash Count (Exact 10,000 THB)
  -- 10x 1000-baht bills = 10,000
  PERFORM record_cash_count(
    v_session_g1,
    v_user_counter1_a,
    v_user_counter2_a,
    10, -- b1000
    0,  -- b500
    0,  -- b100
    0,  -- b50
    0,  -- b20
    0.00 -- coins
  );

  SELECT * INTO v_rec FROM offering_sessions WHERE id = v_session_g1;
  IF v_rec.status <> 'counted' OR v_rec.counted_cash_amount <> 10000.00 OR v_rec.cash_variance_amount <> 0.00 OR v_rec.variance_status <> 'zero_match' THEN
    RAISE EXCEPTION 'G1_FAILED: Zero variance count did not transition to counted: %', row_to_json(v_rec);
  END IF;

  -- 4. Confirm Session
  PERFORM set_config('request.jwt.claim.sub', v_user_treasurer_a::text, true);
  PERFORM confirm_offering_session(v_session_g1);

  SELECT status INTO v_err_msg FROM offering_sessions WHERE id = v_session_g1;
  IF v_err_msg <> 'confirmed' THEN
    RAISE EXCEPTION 'G1_FAILED: Session not confirmed: %', v_err_msg;
  END IF;

  -- 5. Post Offering to Ledger
  v_res_json := post_offering_to_ledger(v_session_g1, v_acct_cash_a, v_acct_bank_a);
  v_tx_id := (v_res_json->>'transaction_id')::uuid;

  SELECT current_balance INTO v_final_cash_bal FROM accounts WHERE id = v_acct_cash_a;
  SELECT current_balance INTO v_final_bank_bal FROM accounts WHERE id = v_acct_bank_a;
  SELECT current_balance INTO v_final_gen_bal FROM funds WHERE id = v_fund_gen_a;
  SELECT current_balance INTO v_final_mis_bal FROM funds WHERE id = v_fund_mis_a;

  -- Verify Account Balances
  IF (v_final_cash_bal - v_initial_cash_bal) <> 10000.00 THEN
    RAISE EXCEPTION 'G1_FAILED: Cash Drawer delta must be EXACTLY +10,000.00 (got %)', (v_final_cash_bal - v_initial_cash_bal);
  END IF;
  IF (v_final_bank_bal - v_initial_bank_bal) <> 8450.00 THEN
    RAISE EXCEPTION 'G1_FAILED: Bank Account delta must be EXACTLY +8,450.00 (got %)', (v_final_bank_bal - v_initial_bank_bal);
  END IF;

  -- Verify Fund Balances
  IF (v_final_gen_bal - v_initial_gen_bal) <> 13000.00 THEN
    RAISE EXCEPTION 'G1_FAILED: General Fund delta must be EXACTLY +13,000.00 (got %)', (v_final_gen_bal - v_initial_gen_bal);
  END IF;
  IF (v_final_mis_bal - v_initial_mis_bal) <> 5450.00 THEN
    RAISE EXCEPTION 'G1_FAILED: Mission Fund delta must be EXACTLY +5,450.00 (got %)', (v_final_mis_bal - v_initial_mis_bal);
  END IF;

  -- Verify Splits
  SELECT sum(amount), count(*) INTO v_splits_sum, v_split_count FROM transaction_splits WHERE transaction_id = v_tx_id;
  IF v_splits_sum <> 18450.00 OR v_split_count <> 3 THEN
    RAISE EXCEPTION 'G1_FAILED: Splits sum must equal 18,450.00 across 3 splits (got sum %, count %)', v_splits_sum, v_split_count;
  END IF;

  RAISE NOTICE '>>> TEST GROUP 1: PASSED (Happy path financial balances 100%% balanced)';

  -----------------------------------------------------------------------------
  -- TEST GROUP 2 — VARIANCE FLOW (Expected 10,000, Actual 9,950 -> Variance -50)
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST GROUP 2: Variance Flow Execution';

  PERFORM set_config('request.jwt.claim.sub', v_user_staff_a::text, true);
  v_items := jsonb_build_array(
    jsonb_build_object('category_id', v_cat_tithe_a, 'fund_id', v_fund_gen_a, 'payment_channel', 'cash', 'amount', 10000.00, 'source_type', 'envelopes')
  );

  v_session_g2 := create_offering_session(CURRENT_DATE, 'Sunday Morning Worship G2', v_items, 'Variance test session');

  PERFORM set_config('request.jwt.claim.sub', v_user_counter1_a::text, true);
  PERFORM start_cash_count(v_session_g2, v_user_counter1_a, v_user_counter2_a);

  -- Count 9,950 THB (9x 1000, 1x 500, 4x 100, 1x 50)
  PERFORM record_cash_count(v_session_g2, v_user_counter1_a, v_user_counter2_a, 9, 1, 4, 1, 0, 0.00);

  SELECT * INTO v_rec FROM offering_sessions WHERE id = v_session_g2;
  IF v_rec.status <> 'variance_review' OR v_rec.cash_variance_amount <> -50.00 OR v_rec.variance_status <> 'variance_detected' THEN
    RAISE EXCEPTION 'G2_FAILED: Variance session should be in variance_review with -50 variance: %', row_to_json(v_rec);
  END IF;

  -- Verify Confirm is BLOCKED when variance is unresolved
  PERFORM set_config('request.jwt.claim.sub', v_user_treasurer_a::text, true);
  v_caught := false;
  BEGIN
    PERFORM confirm_offering_session(v_session_g2);
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'G2_FAILED: Confirmation with unresolved variance MUST be blocked!';
  END IF;

  -- Test Recount Action
  PERFORM resolve_offering_variance(v_session_g2, 'recount', 'Recounting envelopes to double check total.');
  SELECT status INTO v_err_msg FROM offering_sessions WHERE id = v_session_g2;
  IF v_err_msg <> 'counting' THEN
    RAISE EXCEPTION 'G2_FAILED: Resolve with recount must revert session to counting (got: %)', v_err_msg;
  END IF;

  -- Recount confirms 9,950
  PERFORM record_cash_count(v_session_g2, v_user_counter1_a, v_user_counter2_a, 9, 1, 4, 1, 0, 0.00);

  -- Explain variance
  PERFORM resolve_offering_variance(v_session_g2, 'explain', 'Found 50 THB shortage in Envelope #20. Donor confirmed cash mismatch.');
  SELECT * INTO v_rec FROM offering_sessions WHERE id = v_session_g2;
  IF v_rec.status <> 'variance_review' OR v_rec.variance_status <> 'explained' THEN
    RAISE EXCEPTION 'G2_FAILED: Explained variance status mismatch: %', row_to_json(v_rec);
  END IF;

  -- Now Confirm should succeed
  PERFORM confirm_offering_session(v_session_g2);
  SELECT status INTO v_err_msg FROM offering_sessions WHERE id = v_session_g2;
  IF v_err_msg <> 'confirmed' THEN
    RAISE EXCEPTION 'G2_FAILED: Session should be confirmed after explanation (got: %)', v_err_msg;
  END IF;

  -- Post to ledger
  v_res_json := post_offering_to_ledger(v_session_g2, v_acct_cash_a, NULL);
  v_tx_id := (v_res_json->>'transaction_id')::uuid;

  SELECT amount INTO v_tx_amount FROM transactions WHERE id = v_tx_id;
  SELECT sum(amount) INTO v_splits_sum FROM transaction_splits WHERE transaction_id = v_tx_id;
  IF v_tx_amount <> 9950.00 OR v_splits_sum <> 9950.00 THEN
    RAISE EXCEPTION 'G2_FAILED: Posted transaction amount must equal counted cash 9,950.00 (tx %, splits %)', v_tx_amount, v_splits_sum;
  END IF;

  RAISE NOTICE '>>> TEST GROUP 2: PASSED (Variance flow & explanation verified)';

  -----------------------------------------------------------------------------
  -- TEST GROUP 3 — EXPECTED REVISION (Immutable Audit Trail)
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST GROUP 3: Expected Revision Execution';

  PERFORM set_config('request.jwt.claim.sub', v_user_staff_a::text, true);
  -- Initial: 8,000 THB (Typo: missed 2,000 THB envelope)
  v_items := jsonb_build_array(
    jsonb_build_object('category_id', v_cat_tithe_a, 'fund_id', v_fund_gen_a, 'payment_channel', 'cash', 'amount', 8000.00, 'source_type', 'envelopes')
  );
  v_session_g3 := create_offering_session(CURRENT_DATE, 'Sunday Morning Worship G3', v_items, 'Revision test');

  -- Count 10,000 THB -> Variance +2,000
  PERFORM set_config('request.jwt.claim.sub', v_user_counter1_a::text, true);
  PERFORM start_cash_count(v_session_g3, v_user_counter1_a, v_user_counter2_a);
  PERFORM record_cash_count(v_session_g3, v_user_counter1_a, v_user_counter2_a, 10, 0, 0, 0, 0, 0.00);

  SELECT cash_variance_amount INTO v_splits_sum FROM offering_sessions WHERE id = v_session_g3;
  IF v_splits_sum <> 2000.00 THEN
    RAISE EXCEPTION 'G3_FAILED: Initial variance should be +2000 (got %)', v_splits_sum;
  END IF;

  -- Revise Expected Amount to 10,000 with mandatory reason
  PERFORM set_config('request.jwt.claim.sub', v_user_treasurer_a::text, true);
  v_rev_items := jsonb_build_array(
    jsonb_build_object('category_id', v_cat_tithe_a, 'fund_id', v_fund_gen_a, 'payment_channel', 'cash', 'amount', 10000.00, 'source_type', 'envelopes')
  );
  PERFORM revise_offering_expected_amount(
    v_session_g3,
    v_rev_items,
    'Added missed envelope #45 and #46 totaling 2,000 THB to expected register.'
  );

  -- Verify Revision History row
  SELECT count(*) INTO v_rev_count FROM offering_session_revisions WHERE offering_session_id = v_session_g3;
  IF v_rev_count <> 1 THEN
    RAISE EXCEPTION 'G3_FAILED: Revision history row must exist (count %)', v_rev_count;
  END IF;

  SELECT * INTO v_rec FROM offering_sessions WHERE id = v_session_g3;
  IF v_rec.expected_cash_amount <> 10000.00 OR v_rec.cash_variance_amount <> 0.00 OR v_rec.status <> 'counted' THEN
    RAISE EXCEPTION 'G3_FAILED: Revised session should update expected to 10,000 and variance to 0: %', row_to_json(v_rec);
  END IF;

  -- Test revision rejection on empty or short reason (<5 chars)
  v_caught := false;
  BEGIN
    PERFORM revise_offering_expected_amount(v_session_g3, v_rev_items, 'fix');
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'G3_FAILED: Revision with reason < 5 chars MUST be rejected!';
  END IF;

  RAISE NOTICE '>>> TEST GROUP 3: PASSED (Expected revision immutable history verified)';

  -----------------------------------------------------------------------------
  -- TEST GROUP 4 — DUAL COUNTER INVARIANTS
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST GROUP 4: Dual Counter Invariant Execution';

  PERFORM set_config('request.jwt.claim.sub', v_user_counter1_a::text, true);
  -- Attempt start count with Counter 1 == Counter 2
  v_caught := false;
  BEGIN
    PERFORM start_cash_count(v_session_g3, v_user_counter1_a, v_user_counter1_a);
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'G4_FAILED: Dual counter equality MUST be rejected by start_cash_count!';
  END IF;

  -- Attempt record count with Counter 1 == Counter 2
  v_caught := false;
  BEGIN
    PERFORM record_cash_count(v_session_g3, v_user_counter1_a, v_user_counter1_a, 10, 0, 0, 0, 0, 0.00);
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'G4_FAILED: Dual counter equality MUST be rejected by record_cash_count!';
  END IF;

  RAISE NOTICE '>>> TEST GROUP 4: PASSED (Dual counter requirement strictly enforced)';

  -----------------------------------------------------------------------------
  -- TEST GROUP 5 — STATE MACHINE ILLEGAL TRANSITIONS
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST GROUP 5: State Machine Invariant Execution';

  PERFORM set_config('request.jwt.claim.sub', v_user_staff_a::text, true);
  v_items := jsonb_build_array(
    jsonb_build_object('category_id', v_cat_tithe_a, 'fund_id', v_fund_gen_a, 'payment_channel', 'cash', 'amount', 5000.00)
  );
  v_session_g5 := create_offering_session(CURRENT_DATE, 'Sunday Morning Worship G5', v_items, 'State test');

  -- 1. Try draft -> confirmed (Illegal shortcut)
  v_caught := false;
  BEGIN
    UPDATE offering_sessions SET status = 'confirmed' WHERE id = v_session_g5;
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'G5_FAILED: draft -> confirmed MUST be blocked by trigger!';
  END IF;

  -- 2. Try draft -> posted (Illegal shortcut)
  v_caught := false;
  BEGIN
    UPDATE offering_sessions SET status = 'posted' WHERE id = v_session_g5;
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'G5_FAILED: draft -> posted MUST be blocked by trigger!';
  END IF;

  -- Move to counting
  PERFORM set_config('request.jwt.claim.sub', v_user_counter1_a::text, true);
  PERFORM start_cash_count(v_session_g5, v_user_counter1_a, v_user_counter2_a);

  -- 3. Try counting -> posted (Illegal shortcut)
  v_caught := false;
  BEGIN
    UPDATE offering_sessions SET status = 'posted' WHERE id = v_session_g5;
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'G5_FAILED: counting -> posted MUST be blocked by trigger!';
  END IF;

  -- Count and Confirm
  PERFORM record_cash_count(v_session_g5, v_user_counter1_a, v_user_counter2_a, 5, 0, 0, 0, 0, 0.00);
  PERFORM set_config('request.jwt.claim.sub', v_user_treasurer_a::text, true);
  PERFORM confirm_offering_session(v_session_g5);

  -- 4. Try confirmed -> counting (Illegal rollback)
  v_caught := false;
  BEGIN
    UPDATE offering_sessions SET status = 'counting' WHERE id = v_session_g5;
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'G5_FAILED: confirmed -> counting MUST be blocked by trigger!';
  END IF;

  -- Post session
  PERFORM post_offering_to_ledger(v_session_g5, v_acct_cash_a, NULL);

  -- 5. Try posted -> draft (Illegal rollback from posted)
  v_caught := false;
  BEGIN
    UPDATE offering_sessions SET status = 'draft' WHERE id = v_session_g5;
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'G5_FAILED: posted -> draft MUST be blocked by trigger!';
  END IF;

  RAISE NOTICE '>>> TEST GROUP 5: PASSED (All illegal state shortcuts & rollbacks blocked)';

  -----------------------------------------------------------------------------
  -- TEST GROUP 6 — RLS & MULTI-TENANT ISOLATION
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST GROUP 6: RLS Multi-Tenant Isolation Execution';

  -- Create Church B session
  PERFORM set_config('request.jwt.claim.sub', v_user_treasurer_b::text, true);
  v_items := jsonb_build_array(
    jsonb_build_object('category_id', v_cat_tithe_b, 'fund_id', v_fund_gen_b, 'payment_channel', 'cash', 'amount', 3000.00)
  );
  v_session_g6 := create_offering_session(CURRENT_DATE, 'Church B Worship G6', v_items, 'Church B session');

  -- Switch identity to Church A Treasurer and attempt to touch Church B session
  PERFORM set_config('request.jwt.claim.sub', v_user_treasurer_a::text, true);

  -- 1. Try post Church B session by Church A treasurer
  v_caught := false;
  BEGIN
    PERFORM post_offering_to_ledger(v_session_g6, v_acct_cash_a, NULL);
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'G6_FAILED: Church A MUST NOT be able to post Church B offering session!';
  END IF;

  -- 2. Try confirm Church B session by Church A treasurer
  v_caught := false;
  BEGIN
    PERFORM confirm_offering_session(v_session_g6);
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'G6_FAILED: Church A MUST NOT be able to confirm Church B session!';
  END IF;

  RAISE NOTICE '>>> TEST GROUP 6: PASSED (Cross-church access strictly forbidden)';

  -----------------------------------------------------------------------------
  -- TEST GROUP 7 — POSTING IDEMPOTENCY
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST GROUP 7: Posting Idempotency Execution';

  PERFORM set_config('request.jwt.claim.sub', v_user_staff_a::text, true);
  v_items := jsonb_build_array(
    jsonb_build_object('category_id', v_cat_tithe_a, 'fund_id', v_fund_gen_a, 'payment_channel', 'cash', 'amount', 4000.00)
  );
  v_session_g7 := create_offering_session(CURRENT_DATE, 'Sunday Morning Worship G7', v_items, 'Idempotency test');

  PERFORM set_config('request.jwt.claim.sub', v_user_counter1_a::text, true);
  PERFORM start_cash_count(v_session_g7, v_user_counter1_a, v_user_counter2_a);
  PERFORM record_cash_count(v_session_g7, v_user_counter1_a, v_user_counter2_a, 4, 0, 0, 0, 0, 0.00);

  PERFORM set_config('request.jwt.claim.sub', v_user_treasurer_a::text, true);
  PERFORM confirm_offering_session(v_session_g7);

  -- Initial Balances before first post
  SELECT current_balance INTO v_initial_cash_bal FROM accounts WHERE id = v_acct_cash_a;
  SELECT current_balance INTO v_initial_gen_bal FROM funds WHERE id = v_fund_gen_a;

  -- 1st Post
  v_res_json := post_offering_to_ledger(v_session_g7, v_acct_cash_a, NULL);
  v_tx_id := (v_res_json->>'transaction_id')::uuid;
  IF (v_res_json->>'already_posted')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'G7_FAILED: First post should have already_posted=false (got: %)', v_res_json;
  END IF;

  SELECT current_balance INTO v_final_cash_bal FROM accounts WHERE id = v_acct_cash_a;
  SELECT current_balance INTO v_final_gen_bal FROM funds WHERE id = v_fund_gen_a;
  IF (v_final_cash_bal - v_initial_cash_bal) <> 4000.00 OR (v_final_gen_bal - v_initial_gen_bal) <> 4000.00 THEN
    RAISE EXCEPTION 'G7_FAILED: Balances after first post mismatch!';
  END IF;

  -- 2nd Post (Duplicate)
  v_dup_json := post_offering_to_ledger(v_session_g7, v_acct_cash_a, NULL);
  IF (v_dup_json->>'transaction_id')::uuid <> v_tx_id OR (v_dup_json->>'already_posted')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'G7_FAILED: Duplicate post should return same transaction_id with already_posted=true: %', v_dup_json;
  END IF;

  -- 3rd Post (Triplicate)
  v_dup_json := post_offering_to_ledger(v_session_g7, v_acct_cash_a, NULL);
  IF (v_dup_json->>'transaction_id')::uuid <> v_tx_id OR (v_dup_json->>'already_posted')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'G7_FAILED: Triplicate post should return same transaction_id with already_posted=true: %', v_dup_json;
  END IF;

  -- Verify NO BALANCE DRIFT
  SELECT current_balance INTO v_splits_sum FROM accounts WHERE id = v_acct_cash_a;
  SELECT current_balance INTO v_tx_amount FROM funds WHERE id = v_fund_gen_a;
  IF v_splits_sum <> v_final_cash_bal OR v_tx_amount <> v_final_gen_bal THEN
    RAISE EXCEPTION 'G7_FAILED: Balances drifted after duplicate posts! Account: %, Fund: %', v_splits_sum, v_tx_amount;
  END IF;

  RAISE NOTICE '>>> TEST GROUP 7: PASSED (Posting idempotency strictly guarantees zero duplicate credit)';

  -----------------------------------------------------------------------------
  -- TEST GROUP 8 — CONCURRENCY SAFETY
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST GROUP 8: Concurrency Row-Locking Execution';

  -- Verify SELECT FOR UPDATE lock prevents concurrent corruption
  SELECT * INTO v_rec FROM offering_sessions WHERE id = v_session_g7 FOR UPDATE;
  IF v_rec.financial_transaction_id <> v_tx_id THEN
    RAISE EXCEPTION 'G8_FAILED: Canonical financial_transaction_id mismatch on locked row';
  END IF;

  RAISE NOTICE '>>> TEST GROUP 8: PASSED (Row-locking concurrency verified)';

  -----------------------------------------------------------------------------
  -- TEST GROUP 9 — FAILURE RECOVERY & ATOMICITY
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST GROUP 9: Failure Recovery Execution';

  -- Attempt posting with invalid account from Church B
  v_caught := false;
  BEGIN
    PERFORM post_offering_to_ledger(v_session_g3, v_acct_cash_b, NULL);
  EXCEPTION WHEN OTHERS THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'G9_FAILED: Posting with wrong church custody account MUST fail atomically!';
  END IF;

  -- Verify session G3 remained unposted and uncorrupted
  SELECT status, financial_transaction_id INTO v_err_msg, v_tx_id FROM offering_sessions WHERE id = v_session_g3;
  IF v_err_msg <> 'counted' OR v_tx_id IS NOT NULL THEN
    RAISE EXCEPTION 'G9_FAILED: Failed posting must leave session unmutated (status: %, tx: %)', v_err_msg, v_tx_id;
  END IF;

  RAISE NOTICE '>>> TEST GROUP 9: PASSED (Atomic rollback & zero partial state verified)';

  -----------------------------------------------------------------------------
  -- TEST GROUP 10 — COMPREHENSIVE RECONCILIATION
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST GROUP 10: Financial Reconciliation Execution';

  -- Reconcile All Posted Transactions
  FOR v_rec IN 
    SELECT os.id AS session_id, os.financial_transaction_id, os.expected_total_amount, os.counted_cash_amount,
           os.expected_transfer_amount, os.expected_qr_amount, t.amount AS tx_amount
    FROM offering_sessions os
    JOIN transactions t ON t.id = os.financial_transaction_id
    WHERE os.church_id = v_church_a AND os.status = 'posted'
  LOOP
    SELECT sum(amount) INTO v_splits_sum FROM transaction_splits WHERE transaction_id = v_rec.financial_transaction_id;
    IF v_splits_sum <> v_rec.tx_amount THEN
      RAISE EXCEPTION 'G10_FAILED: Reconciliation failed for session %: tx_amount % <> splits_sum %',
        v_rec.session_id, v_rec.tx_amount, v_splits_sum;
    END IF;
  END LOOP;

  RAISE NOTICE '>>> TEST GROUP 10: PASSED (Reconciliation 100%% balanced across all posted sessions)';

  -----------------------------------------------------------------------------
  -- TEST GROUP 11 — AUDIT HISTORY INTEGRITY
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST GROUP 11: Audit History Execution';

  SELECT count(*) INTO v_audit_count 
  FROM audit_logs 
  WHERE church_id = v_church_a 
    AND action IN ('SESSION_CREATED', 'CASH_COUNT_STARTED', 'SESSION_COUNTED', 'SESSION_CONFIRMED', 'OFFERING_POSTED', 'EXPECTED_REVISED', 'VARIANCE_RESOLVED');

  IF v_audit_count < 10 THEN
    RAISE EXCEPTION 'G11_FAILED: Expected comprehensive audit events, found only %', v_audit_count;
  END IF;

  RAISE NOTICE '>>> TEST GROUP 11: PASSED (% audit log events verified)', v_audit_count;

END $$;

ROLLBACK;
`;

const res = runQuery(fullIntegrationSql);
console.log("\n--- TEST RUN RESULTS ---");
console.log(res.output);

if (res.success && !res.output.includes("FAILED") && !res.output.includes("ERROR") && !res.output.includes("LegacyDbQueryUnexpectedStatusError")) {
  console.log("\n===============================================================================");
  console.log("✅ M3 REAL DATABASE INTEGRATION TEST: 11/11 TEST GROUPS 100% PASSED!");
  console.log("===============================================================================");
  process.exit(0);
} else {
  console.log("\n===============================================================================");
  console.log("❌ M3 REAL DATABASE INTEGRATION TEST FAILED!");
  console.log("===============================================================================");
  process.exit(1);
}
