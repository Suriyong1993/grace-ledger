import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function runQuery(sql) {
  const tmpDir = path.resolve("tmp_queries");
  fs.mkdirSync(tmpDir, { recursive: true });
  const tempFile = path.resolve(tmpDir, `audit_${Date.now()}_${Math.random().toString(36).substring(7)}.sql`);
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

console.log("===============================================================");
console.log("M3 FINAL PRE-APPLY AUDIT: 18-DIMENSION VERIFICATION (POSTGRES 17)");
console.log("===============================================================");

const mig010 = fs.readFileSync("supabase/migrations/20260819000010_offering_core_schema_repair.sql", "utf-8");
const mig011 = fs.readFileSync("supabase/migrations/20260819000011_offering_rpcs_and_triggers.sql", "utf-8");
const mig012 = fs.readFileSync("supabase/migrations/20260819000012_offering_rls_policies.sql", "utf-8");

const comprehensiveAuditSql = `
BEGIN;

-- Apply Migrations 010, 011, 012 in dry-run transaction
${mig010}
${mig011}
${mig012}

DO $$
DECLARE
  v_church_a UUID;
  v_church_b UUID;
  v_user_treasurer UUID;
  v_user_staff UUID;
  v_user_counter1 UUID;
  v_user_counter2 UUID;
  v_user_member UUID;
  v_user_church_b UUID;
  v_fund_general UUID;
  v_fund_mission UUID;
  v_cat_tithe UUID;
  v_cat_mission UUID;
  v_acct_cash UUID;
  v_acct_bank UUID;
  v_session_id UUID;
  v_tx_id UUID;
  v_post_result JSONB;
  v_dup_result JSONB;
  v_items JSONB;
  v_new_items JSONB;
  v_cash_bal_before NUMERIC(14,2);
  v_bank_bal_before NUMERIC(14,2);
  v_gen_fund_before NUMERIC(14,2);
  v_mis_fund_before NUMERIC(14,2);
  v_cash_bal_after NUMERIC(14,2);
  v_bank_bal_after NUMERIC(14,2);
  v_gen_fund_after NUMERIC(14,2);
  v_mis_fund_after NUMERIC(14,2);
  v_tx_count INT;
  v_splits_sum NUMERIC(14,2);
  v_err_caught BOOLEAN := FALSE;
BEGIN
  RAISE NOTICE '>>> SETUP TEST FIXTURES <<<';
  
  -- Create Church A & Church B
  INSERT INTO churches (id, name) VALUES 
    (gen_random_uuid(), 'Audit Church A') RETURNING id INTO v_church_a;
  INSERT INTO churches (id, name) VALUES 
    (gen_random_uuid(), 'Audit Church B') RETURNING id INTO v_church_b;

  -- Create Users
  v_user_treasurer := gen_random_uuid();
  v_user_staff := gen_random_uuid();
  v_user_counter1 := gen_random_uuid();
  v_user_counter2 := gen_random_uuid();
  v_user_member := gen_random_uuid();
  v_user_church_b := gen_random_uuid();

  INSERT INTO profiles (id, church_id, email, full_name) VALUES
    (v_user_treasurer, v_church_a, 'treasurer@audit.a', 'Treasurer A'),
    (v_user_staff, v_church_a, 'staff@audit.a', 'Staff A'),
    (v_user_counter1, v_church_a, 'counter1@audit.a', 'Counter 1 A'),
    (v_user_counter2, v_church_a, 'counter2@audit.a', 'Counter 2 A'),
    (v_user_member, v_church_a, 'member@audit.a', 'Member A'),
    (v_user_church_b, v_church_b, 'treasurer@audit.b', 'Treasurer B');

  INSERT INTO user_roles (user_id, church_id, role) VALUES
    (v_user_treasurer, v_church_a, 'treasurer'),
    (v_user_staff, v_church_a, 'finance_staff'),
    (v_user_counter1, v_church_a, 'counter'),
    (v_user_counter2, v_church_a, 'counter'),
    (v_user_member, v_church_a, 'member'),
    (v_user_church_b, v_church_b, 'treasurer');

  -- Create Funds & Categories
  INSERT INTO funds (id, church_id, name, current_balance) VALUES
    (gen_random_uuid(), v_church_a, 'General Fund', 50000.00) RETURNING id INTO v_fund_general;
  INSERT INTO funds (id, church_id, name, current_balance) VALUES
    (gen_random_uuid(), v_church_a, 'Mission Fund', 10000.00) RETURNING id INTO v_fund_mission;

  INSERT INTO categories (id, church_id, name, direction) VALUES
    (gen_random_uuid(), v_church_a, 'General Tithe', 'income') RETURNING id INTO v_cat_tithe;
  INSERT INTO categories (id, church_id, name, direction) VALUES
    (gen_random_uuid(), v_church_a, 'Mission Offering', 'income') RETURNING id INTO v_cat_mission;

  -- Create Accounts
  INSERT INTO accounts (id, church_id, name, type, current_balance) VALUES
    (gen_random_uuid(), v_church_a, 'Cash Drawer Main', 'cash_drawer', 2000.00) RETURNING id INTO v_acct_cash;
  INSERT INTO accounts (id, church_id, name, type, current_balance) VALUES
    (gen_random_uuid(), v_church_a, 'Kasikorn Bank Main', 'bank', 100000.00) RETURNING id INTO v_acct_bank;

  SELECT current_balance INTO v_cash_bal_before FROM accounts WHERE id = v_acct_cash;
  SELECT current_balance INTO v_bank_bal_before FROM accounts WHERE id = v_acct_bank;
  SELECT current_balance INTO v_gen_fund_before FROM funds WHERE id = v_fund_general;
  SELECT current_balance INTO v_mis_fund_before FROM funds WHERE id = v_fund_mission;

  -- --------------------------------------------------------------------------
  -- TEST 1: Dual Counter Invariant (counter1 == counter2 must FAIL)
  -- --------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST 1: Dual Counter Invariant <<<';
  
  -- Authenticate as treasurer
  EXECUTE format('SET LOCAL request.jwt.claim.sub = %L', v_user_treasurer::text);

  v_items := jsonb_build_array(
    jsonb_build_object('fund_id', v_fund_general, 'category_id', v_cat_tithe, 'payment_channel', 'cash', 'amount', 10000.00, 'notes', 'Cash tithe'),
    jsonb_build_object('fund_id', v_fund_general, 'category_id', v_cat_tithe, 'payment_channel', 'bank_transfer', 'amount', 3000.00, 'notes', 'Transfer tithe'),
    jsonb_build_object('fund_id', v_fund_mission, 'category_id', v_cat_mission, 'payment_channel', 'qr_code', 'amount', 5450.00, 'notes', 'QR Mission')
  );

  v_session_id := create_offering_session('2026-08-23'::date, 'Sunday Morning Service', v_items, 'Pre-apply audit session');
  
  -- Attempt start_cash_count with same counter
  v_err_caught := FALSE;
  BEGIN
    PERFORM start_cash_count(v_session_id, v_user_counter1, v_user_counter1);
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'AUDIT FAILED: start_cash_count allowed same counter for counter1 and counter2';
  END IF;

  -- Start cash count with 2 distinct counters (PASS)
  PERFORM start_cash_count(v_session_id, v_user_counter1, v_user_counter2);

  -- --------------------------------------------------------------------------
  -- TEST 2: State Machine Shortcuts Guard
  -- --------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST 2: State Machine Shortcuts Guard <<<';
  
  -- Attempt illegal jump: counting -> posted (must FAIL)
  v_err_caught := FALSE;
  BEGIN
    UPDATE offering_sessions SET status = 'posted' WHERE id = v_session_id;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'AUDIT FAILED: trigger allowed illegal jump counting -> posted';
  END IF;

  -- Attempt illegal jump: counting -> confirmed (must FAIL)
  v_err_caught := FALSE;
  BEGIN
    UPDATE offering_sessions SET status = 'confirmed' WHERE id = v_session_id;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'AUDIT FAILED: trigger allowed illegal jump counting -> confirmed';
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 3: Cash Count & Variance Guard
  -- --------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST 3: Cash Count & Variance Guard <<<';
  
  -- Count with shortage: Expected Cash = 10,000; Actual = 9,800 (Variance = -200)
  -- 9 x 1000 + 1 x 500 + 3 x 100 = 9800
  PERFORM record_cash_count(v_session_id, v_user_counter1, v_user_counter2, 9, 1, 3, 0, 0, 0.00);

  -- Attempt confirm without explanation (must FAIL)
  v_err_caught := FALSE;
  BEGIN
    PERFORM confirm_offering_session(v_session_id);
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'AUDIT FAILED: confirm_offering_session allowed confirmation with unexplained variance';
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 4: Revision Immutability Trail
  -- --------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST 4: Revision Immutability Trail <<<';
  
  -- Correct expected cash to match actual envelopes (10 x 1000 = 10,000 cash)
  v_new_items := jsonb_build_array(
    jsonb_build_object('fund_id', v_fund_general, 'category_id', v_cat_tithe, 'payment_channel', 'cash', 'amount', 10000.00, 'notes', 'Cash tithe 10k'),
    jsonb_build_object('fund_id', v_fund_general, 'category_id', v_cat_tithe, 'payment_channel', 'bank_transfer', 'amount', 3000.00, 'notes', 'Transfer 3k'),
    jsonb_build_object('fund_id', v_fund_mission, 'category_id', v_cat_mission, 'payment_channel', 'qr_code', 'amount', 5450.00, 'notes', 'QR 5.45k')
  );

  PERFORM revise_offering_expected_amount(v_session_id, v_new_items, 'Re-verified envelope tally matches 10,000 cash');
  
  -- Verify revision table has record
  IF NOT EXISTS (SELECT 1 FROM offering_session_revisions WHERE offering_session_id = v_session_id AND revision_number = 1) THEN
    RAISE EXCEPTION 'AUDIT FAILED: offering_session_revisions record missing';
  END IF;

  -- Re-count physical cash to 10,000 (10 x 1000)
  PERFORM record_cash_count(v_session_id, v_user_counter1, v_user_counter2, 10, 0, 0, 0, 0, 0.00);

  -- Confirm offering session (Variance = 0, must SUCCEED)
  PERFORM confirm_offering_session(v_session_id);

  -- --------------------------------------------------------------------------
  -- TEST 5: Critical Accounting & Channel x Fund Posting
  -- Example: Cash = 10,000, Transfer = 3,000, QR = 5,450 (Total = 18,450)
  -- --------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST 5: Critical Accounting & Channel x Fund Posting <<<';

  -- Attempt posting with NULL bank account when electronic transfers exist (must FAIL)
  v_err_caught := FALSE;
  BEGIN
    PERFORM post_offering_to_ledger(v_session_id, v_acct_cash, NULL);
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'AUDIT FAILED: post_offering_to_ledger allowed posting electronic offering without bank account';
  END IF;

  -- Post offering to ledger with valid Cash Drawer and Bank Account
  v_post_result := post_offering_to_ledger(v_session_id, v_acct_cash, v_acct_bank);
  v_tx_id := (v_post_result->>'transaction_id')::UUID;

  -- Check Account Balances:
  SELECT current_balance INTO v_cash_bal_after FROM accounts WHERE id = v_acct_cash;
  SELECT current_balance INTO v_bank_bal_after FROM accounts WHERE id = v_acct_bank;

  IF v_cash_bal_after <> (v_cash_bal_before + 10000.00) THEN
    RAISE EXCEPTION 'ACCOUNTING FAILED: Cash Drawer balance incorrect! Expected +10,000, got diff %', (v_cash_bal_after - v_cash_bal_before);
  END IF;

  IF v_bank_bal_after <> (v_bank_bal_before + 8450.00) THEN
    RAISE EXCEPTION 'ACCOUNTING FAILED: Bank balance incorrect! Expected +8,450 (3000 transfer + 5450 QR), got diff %', (v_bank_bal_after - v_bank_bal_before);
  END IF;

  -- Check Fund Balances:
  SELECT current_balance INTO v_gen_fund_after FROM funds WHERE id = v_fund_general;
  SELECT current_balance INTO v_mis_fund_after FROM funds WHERE id = v_fund_mission;

  IF v_gen_fund_after <> (v_gen_fund_before + 13000.00) THEN
    RAISE EXCEPTION 'FUND BALANCING FAILED: General Fund incorrect! Expected +13,000 (10k cash + 3k transfer), got diff %', (v_gen_fund_after - v_gen_fund_before);
  END IF;

  IF v_mis_fund_after <> (v_mis_fund_before + 5450.00) THEN
    RAISE EXCEPTION 'FUND BALANCING FAILED: Mission Fund incorrect! Expected +5,450 (QR mission), got diff %', (v_mis_fund_after - v_mis_fund_before);
  END IF;

  -- Check Transaction & Splits:
  SELECT count(*) INTO v_tx_count FROM transactions WHERE id = v_tx_id;
  IF v_tx_count <> 1 THEN
    RAISE EXCEPTION 'TRANSACTION CREATION FAILED: Canonical transaction count <> 1';
  END IF;

  SELECT sum(amount) INTO v_splits_sum FROM transaction_splits WHERE transaction_id = v_tx_id;
  IF v_splits_sum <> 18450.00 THEN
    RAISE EXCEPTION 'SPLIT BALANCING FAILED: Transaction splits sum % <> 18,450.00', v_splits_sum;
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 6: Posting Idempotency Guard (Double-Posting Check)
  -- --------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST 6: Posting Idempotency Guard <<<';

  -- Call post_offering_to_ledger again
  v_dup_result := post_offering_to_ledger(v_session_id, v_acct_cash, v_acct_bank);
  
  IF (v_dup_result->>'already_posted')::BOOLEAN <> TRUE THEN
    RAISE EXCEPTION 'IDEMPOTENCY FAILED: Repeated post did not return already_posted: true';
  END IF;

  IF (v_dup_result->>'transaction_id')::UUID <> v_tx_id THEN
    RAISE EXCEPTION 'IDEMPOTENCY FAILED: Returned different transaction ID % <> %', (v_dup_result->>'transaction_id'), v_tx_id;
  END IF;

  -- Verify Account Balances DID NOT CHANGE on repeated call
  IF (SELECT current_balance FROM accounts WHERE id = v_acct_cash) <> v_cash_bal_after THEN
    RAISE EXCEPTION 'IDEMPOTENCY FAILED: Cash Drawer credited twice!';
  END IF;

  IF (SELECT current_balance FROM accounts WHERE id = v_acct_bank) <> v_bank_bal_after THEN
    RAISE EXCEPTION 'IDEMPOTENCY FAILED: Bank Account credited twice!';
  END IF;

  -- Verify Immutability of Posted Session (Cannot revert to draft/counting)
  v_err_caught := FALSE;
  BEGIN
    UPDATE offering_sessions SET status = 'draft' WHERE id = v_session_id;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'IMMUTABILITY FAILED: Posted session status was modified!';
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 7: Cross-Church Isolation & RLS Security
  -- --------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST 7: Cross-Church Isolation & RLS Security <<<';

  -- Authenticate as Church B Treasurer
  EXECUTE format('SET LOCAL request.jwt.claim.sub = %L', v_user_church_b::text);

  -- Church B attempting to revise Church A session (must FAIL)
  v_err_caught := FALSE;
  BEGIN
    PERFORM revise_offering_expected_amount(v_session_id, v_new_items, 'Malicious revision from Church B');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'SECURITY FAILED: Church B was able to revise Church A offering session!';
  END IF;

  -- Church B attempting to post Church A session (must FAIL)
  v_err_caught := FALSE;
  BEGIN
    PERFORM post_offering_to_ledger(v_session_id, v_acct_cash, v_acct_bank);
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'SECURITY FAILED: Church B was able to post Church A offering session!';
  END IF;

  RAISE NOTICE '>>> ALL 18 AUDIT DIMENSIONS VERIFIED WITH ZERO ERRORS <<<';
END $$;

SELECT '18_DIMENSIONS_AUDIT_PASSED' AS final_audit_status;

ROLLBACK;
`;

console.log("Executing Comprehensive 18-Dimension Pre-Apply Audit on PostgreSQL 17...");
const res = runQuery(comprehensiveAuditSql);

console.log("\n--- AUDIT RUN OUTPUT ---");
console.log(res.output);

if (res.success && res.output.includes("18_DIMENSIONS_AUDIT_PASSED")) {
  console.log("\n===============================================================");
  console.log("✅ PRE-APPLY AUDIT 100% PASSED ACROSS ALL 18 AUDIT DIMENSIONS!");
  console.log("===============================================================");
} else {
  console.error("\n❌ PRE-APPLY AUDIT FAILED!");
  process.exit(1);
}
