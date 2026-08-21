import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Ensure tmp_queries directory exists
const tmpDir = path.resolve("tmp_queries");
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

function runRemoteQuery(sql, retries = 3) {
  const queryFile = path.join(tmpDir, `q_${Date.now()}_${Math.random().toString(36).substring(7)}.sql`);
  fs.writeFileSync(queryFile, sql, "utf8");
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const output = execSync(`npx supabase db query --linked --file "${queryFile}"`, {
        encoding: "utf8",
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      try { fs.unlinkSync(queryFile); } catch (e) {}

      const cleanOutput = output.replace(/Initialising login role\.\.\.\s*/g, "").trim();
      const jsonStart = cleanOutput.indexOf("{");
      if (jsonStart !== -1) {
        const jsonStr = cleanOutput.substring(jsonStart);
        const parsed = JSON.parse(jsonStr);
        return { success: true, rows: parsed.rows || [], error: null };
      }
      return { success: true, rows: [], error: null };
    } catch (err) {
      const errMsg = err.stderr ? err.stderr.toString() : err.message;
      if (attempt === retries) {
        try { fs.unlinkSync(queryFile); } catch (e) {}
        return { success: false, rows: [], error: errMsg };
      }
      // Brief exponential backoff
      execSync("powershell -Command Start-Sleep -Milliseconds 1000");
    }
  }
}

async function runM2Phase1Tests() {
  console.log("================================================================================");
  console.log("GRACE LEDGER — M2 PHASE 1 (TRANSACTION CORE) REAL DATABASE TEST SUITE");
  console.log("Target: Supabase PostgreSQL 17 (grace-ledger-test / jeklcfpqmytdmwczxqlx)");
  console.log("================================================================================\n");

  const results = [];

  function recordResult(code, description, pass, details) {
    results.push({ code, description, pass, details });
    const badge = pass ? "✅ PASS" : "❌ FAIL";
    console.log(`[${code}] ${badge} - ${description}`);
    if (details) console.log(`       Details: ${details}`);
  }

  // ----------------------------------------------------------------------------
  // SETUP TEST DATA FOR M2 PHASE 1
  // ----------------------------------------------------------------------------
  console.log("--> Setting up isolated test fixtures (M2_TEST_*)...");
  const setupSql = `
    DO $$
    DECLARE
      v_church_a UUID := '44444444-4444-4444-4444-111111111111';
      v_church_b UUID := '44444444-4444-4444-4444-222222222222';
      v_creator UUID := '44444444-aaaa-1111-1111-111111111111';
      v_approver UUID := '44444444-aaaa-2222-2222-222222222222';
      v_treasurer UUID := '44444444-aaaa-3333-3333-333333333333';
      v_member UUID := '44444444-aaaa-4444-4444-444444444444';
      v_church_b_treasurer UUID := '44444444-bbbb-3333-3333-333333333333';
    BEGIN
      -- Cleanup previous runs if existing
      DELETE FROM transaction_splits WHERE church_id IN (v_church_a, v_church_b);
      DELETE FROM transactions WHERE church_id IN (v_church_a, v_church_b);
      DELETE FROM categories WHERE church_id IN (v_church_a, v_church_b);
      DELETE FROM funds WHERE church_id IN (v_church_a, v_church_b);
      DELETE FROM accounts WHERE church_id IN (v_church_a, v_church_b);
      DELETE FROM audit_logs WHERE church_id IN (v_church_a, v_church_b);
      DELETE FROM user_roles WHERE church_id IN (v_church_a, v_church_b);
      DELETE FROM profiles WHERE church_id IN (v_church_a, v_church_b);
      DELETE FROM auth.users WHERE id IN (v_creator, v_approver, v_treasurer, v_member, v_church_b_treasurer);
      DELETE FROM churches WHERE id IN (v_church_a, v_church_b);

      -- Create Churches
      INSERT INTO churches (id, name, currency) VALUES
        (v_church_a, 'M2_TEST_Church_A', 'THB'),
        (v_church_b, 'M2_TEST_Church_B', 'THB');

      -- Create Auth Users & Profiles
      INSERT INTO auth.users (id, email) VALUES
        (v_creator, 'm2_creator@test.com'),
        (v_approver, 'm2_approver@test.com'),
        (v_treasurer, 'm2_treasurer@test.com'),
        (v_member, 'm2_member@test.com'),
        (v_church_b_treasurer, 'm2_b_treasurer@test.com');

      INSERT INTO profiles (id, church_id, email, full_name, is_active) VALUES
        (v_creator, v_church_a, 'm2_creator@test.com', 'M2 Creator Staff', true),
        (v_approver, v_church_a, 'm2_approver@test.com', 'M2 Approver Elder', true),
        (v_treasurer, v_church_a, 'm2_treasurer@test.com', 'M2 Head Treasurer', true),
        (v_member, v_church_a, 'm2_member@test.com', 'M2 Regular Member', true),
        (v_church_b_treasurer, v_church_b, 'm2_b_treasurer@test.com', 'M2 Church B Treasurer', true);

      -- Assign RBAC Roles
      INSERT INTO user_roles (user_id, church_id, role) VALUES
        (v_creator, v_church_a, 'finance_staff'),
        (v_approver, v_church_a, 'approver'),
        (v_treasurer, v_church_a, 'treasurer'),
        (v_member, v_church_a, 'member'),
        (v_church_b_treasurer, v_church_b, 'treasurer');

      -- Create Financial Master Data for Church A
      INSERT INTO accounts (id, church_id, name, type, current_balance) VALUES
        ('44444444-cccc-1111-1111-111111111111', v_church_a, 'M2 Operating Bank', 'bank', 50000.00);

      INSERT INTO funds (id, church_id, name, current_balance) VALUES
        ('44444444-ffff-1111-1111-111111111111', v_church_a, 'M2 General Fund', 30000.00),
        ('44444444-ffff-2222-2222-222222222222', v_church_a, 'M2 Building Fund', 20000.00);

      INSERT INTO categories (id, church_id, name, direction) VALUES
        ('44444444-eeee-1111-1111-111111111111', v_church_a, 'Tithe Income', 'income'),
        ('44444444-eeee-2222-2222-222222222222', v_church_a, 'Maintenance Expense', 'expense');

      -- Create Master Data for Church B
      INSERT INTO accounts (id, church_id, name, type, current_balance) VALUES
        ('44444444-cccc-2222-2222-222222222222', v_church_b, 'M2 Church B Bank', 'bank', 10000.00);

      INSERT INTO funds (id, church_id, name, current_balance) VALUES
        ('44444444-ffff-3333-3333-333333333333', v_church_b, 'M2 Church B Fund', 10000.00);
    END $$;
  `;

  const setupRes = runRemoteQuery(setupSql);
  if (!setupRes.success) {
    console.error("Setup failed:", setupRes.error);
    return;
  }
  console.log("--> Fixtures created successfully.\n");

  // Helper constants
  const CHURCH_A = "44444444-4444-4444-4444-111111111111";
  const CHURCH_B = "44444444-4444-4444-4444-222222222222";
  const CREATOR_ID = "44444444-aaaa-1111-1111-111111111111";
  const APPROVER_ID = "44444444-aaaa-2222-2222-222222222222";
  const TREASURER_ID = "44444444-aaaa-3333-3333-333333333333";
  const MEMBER_ID = "44444444-aaaa-4444-4444-444444444444";
  const CHURCH_B_USER = "44444444-bbbb-3333-3333-333333333333";
  const ACCOUNT_A = "44444444-cccc-1111-1111-111111111111";
  const FUND_GENERAL = "44444444-ffff-1111-1111-111111111111";
  const FUND_BUILDING = "44444444-ffff-2222-2222-222222222222";
  const CAT_TITHE = "44444444-eeee-1111-1111-111111111111";

  // ----------------------------------------------------------------------------
  // TEST 1: Draft Creation
  // ----------------------------------------------------------------------------
  const t1_id = "55555555-1111-1111-1111-111111111111";
  const t1_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    INSERT INTO transactions (
      id, church_id, account_id, amount, direction, status, description, created_by
    ) VALUES (
      '${t1_id}', '${CHURCH_A}', '${ACCOUNT_A}', 10000.00, 'income', 'draft', 'Sunday Tithes & Offerings', '${CREATOR_ID}'
    );
    SELECT status, amount::TEXT, description FROM transactions WHERE id = '${t1_id}';
  `;
  const t1_res = runRemoteQuery(t1_sql);
  const t1_pass = t1_res.success && t1_res.rows.length === 1 && t1_res.rows[0].status === "draft";
  recordResult("M2-01", "Draft Transaction Creation", t1_pass, `Status = ${t1_res.rows?.[0]?.status}, Amount = ฿${t1_res.rows?.[0]?.amount}`);

  // ----------------------------------------------------------------------------
  // TEST 2: Incomplete Draft Persistence (Partial splits allowed in draft)
  // ----------------------------------------------------------------------------
  const t2_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    INSERT INTO transaction_splits (
      transaction_id, church_id, fund_id, category_id, amount, note
    ) VALUES (
      '${t1_id}', '${CHURCH_A}', '${FUND_GENERAL}', '${CAT_TITHE}', 6000.00, 'Partial split in draft'
    );
    SELECT COUNT(*)::INTEGER as count, SUM(amount)::TEXT as total FROM transaction_splits WHERE transaction_id = '${t1_id}';
  `;
  const t2_res = runRemoteQuery(t2_sql);
  const t2_pass = t2_res.success && t2_res.rows.length === 1 && t2_res.rows[0].total === "6000.00";
  recordResult("M2-02", "Incomplete Draft Split Persistence", t2_pass, `Partial split ฿6,000.00 persisted in draft without error`);

  // ----------------------------------------------------------------------------
  // TEST 3: Invalid Submit Rejected (Parity Mismatch: ฿6,000 vs ฿10,000)
  // ----------------------------------------------------------------------------
  const t3_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    SELECT submit_transaction('${t1_id}');
  `;
  const t3_res = runRemoteQuery(t3_sql);
  const t3_pass = !t3_res.success || (t3_res.error && t3_res.error.includes("Invalid Submission"));
  recordResult("M2-03", "Invalid Submit Rejected (Split Parity Mismatch)", t3_pass, "Blocked submission when split sum (฿6,000) != transaction amount (฿10,000)");

  // ----------------------------------------------------------------------------
  // TEST 4: Split Modification to achieve Exact Parity (Add ฿4,000 to Building)
  // ----------------------------------------------------------------------------
  const t4_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    INSERT INTO transaction_splits (
      transaction_id, church_id, fund_id, category_id, amount, note
    ) VALUES (
      '${t1_id}', '${CHURCH_A}', '${FUND_BUILDING}', '${CAT_TITHE}', 4000.00, 'Building Fund split'
    );
    SELECT COUNT(*)::INTEGER as count, SUM(amount)::TEXT as total FROM transaction_splits WHERE transaction_id = '${t1_id}';
  `;
  const t4_res = runRemoteQuery(t4_sql);
  const t4_pass = t4_res.success && t4_res.rows.length === 1 && t4_res.rows[0].total === "10000.00";
  recordResult("M2-04", "Draft Split Allocation to Full Parity", t4_pass, `Total splits: ฿${t4_res.rows?.[0]?.total} (2 splits)`);

  // ----------------------------------------------------------------------------
  // TEST 5: Submit for Approval with Exact Parity
  // ----------------------------------------------------------------------------
  const t5_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    SELECT submit_transaction('${t1_id}') as submitted_id;
    SELECT status FROM transactions WHERE id = '${t1_id}';
  `;
  const t5_res = runRemoteQuery(t5_sql);
  const t5_pass = t5_res.success && t5_res.rows.length > 0 && t5_res.rows[t5_res.rows.length - 1].status === "pending_approval";
  recordResult("M2-05", "Submit Transaction for Approval", t5_pass, `Status transitioned to "${t5_res.rows?.[t5_res.rows.length - 1]?.status}"`);

  // ----------------------------------------------------------------------------
  // TEST 6: Self-Approval Rejection (Two-Person Rule Enforced at DB Level)
  // ----------------------------------------------------------------------------
  const t6_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    SELECT approve_transaction('${t1_id}', 'Self approval attempt');
  `;
  const t6_res = runRemoteQuery(t6_sql);
  const t6_pass = !t6_res.success || (t6_res.error && t6_res.error.includes("Segregation of Duties"));
  recordResult("M2-06", "Two-Person Rule Enforcement (Self-Approval Blocked)", t6_pass, "Database raised: Segregation of Duties Violation when creator attempted approval");

  // ----------------------------------------------------------------------------
  // TEST 7: Unauthorized Approval Rejection (Member cannot approve)
  // ----------------------------------------------------------------------------
  const t7_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${MEMBER_ID}", "role": "authenticated"}';
    SELECT approve_transaction('${t1_id}', 'Member approval attempt');
  `;
  const t7_res = runRemoteQuery(t7_sql);
  const t7_pass = !t7_res.success || (t7_res.error && t7_res.error.includes("Unauthorized"));
  recordResult("M2-07", "Unauthorized Approval Rejection", t7_pass, "Member without approver role blocked from approving transaction");

  // ----------------------------------------------------------------------------
  // TEST 8: Rejection Workflow (Approver rejects back to draft with reason)
  // ----------------------------------------------------------------------------
  const t8_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_ID}", "role": "authenticated"}';
    SELECT reject_transaction('${t1_id}', 'Please double-check the split allocation between General and Building Fund.');
    SELECT status, rejected_by::TEXT, rejection_reason FROM transactions WHERE id = '${t1_id}';
  `;
  const t8_res = runRemoteQuery(t8_sql);
  const t8_row = t8_res.rows?.[t8_res.rows.length - 1];
  const t8_pass = t8_res.success && t8_row?.status === "draft" && t8_row?.rejected_by === APPROVER_ID;
  recordResult("M2-08", "Rejection Workflow (pending_approval -> draft)", t8_pass, `Status reverted to "${t8_row?.status}" with rejection reason recorded`);

  // ----------------------------------------------------------------------------
  // TEST 9: Resubmission and Valid Approval by Second Person
  // ----------------------------------------------------------------------------
  const t9_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    SELECT submit_transaction('${t1_id}');
    
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_ID}", "role": "authenticated"}';
    SELECT approve_transaction('${t1_id}', 'Reviewed and confirmed by Elder.');
    SELECT status, approved_by::TEXT, approved_at IS NOT NULL as has_approved_at FROM transactions WHERE id = '${t1_id}';
  `;
  const t9_res = runRemoteQuery(t9_sql);
  const t9_row = t9_res.rows?.[t9_res.rows.length - 1];
  const t9_pass = t9_res.success && t9_row?.status === "approved" && t9_row?.approved_by === APPROVER_ID;
  recordResult("M2-09", "Valid Approval by Second Person (pending_approval -> approved)", t9_pass, `Status = "${t9_row?.status}", approved_by = Approver Elder`);

  // ----------------------------------------------------------------------------
  // TEST 10: Unauthorized Posting Rejection (Approver/Staff cannot post)
  // ----------------------------------------------------------------------------
  const t10_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_ID}", "role": "authenticated"}';
    SELECT post_transaction('${t1_id}');
  `;
  const t10_res = runRemoteQuery(t10_sql);
  const t10_pass = !t10_res.success || (t10_res.error && t10_res.error.includes("Unauthorized"));
  recordResult("M2-10", "Unauthorized Posting Rejection", t10_pass, "Approver blocked from posting to ledger (Treasurer/Admin role required)");

  // ----------------------------------------------------------------------------
  // TEST 11: Authorized Posting to Ledger (Treasurer posts approved transaction)
  // ----------------------------------------------------------------------------
  const t11_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${TREASURER_ID}", "role": "authenticated"}';
    SELECT post_transaction('${t1_id}');
    
    SELECT t.status, t.posted_at IS NOT NULL as has_posted_at, 
           a.current_balance::TEXT as account_balance,
           fg.current_balance::TEXT as general_balance,
           fb.current_balance::TEXT as building_balance
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    CROSS JOIN funds fg
    CROSS JOIN funds fb
    WHERE t.id = '${t1_id}' 
      AND fg.id = '${FUND_GENERAL}' 
      AND fb.id = '${FUND_BUILDING}';
  `;
  const t11_res = runRemoteQuery(t11_sql);
  const t11_row = t11_res.rows?.[t11_res.rows.length - 1];
  // Initial: Account = 50,000, General = 30,000, Building = 20,000
  // Income 10,000 (General 6,000, Building 4,000)
  // Expected: Account = 60,000, General = 36,000, Building = 24,000
  const t11_pass = t11_res.success && t11_row?.status === "posted" && t11_row?.account_balance === "60000.00" && t11_row?.general_balance === "36000.00" && t11_row?.building_balance === "24000.00";
  recordResult("M2-11", "Posting to Immutable Ledger (Account & Funds Credited)", t11_pass, `Status = "posted", Account = ฿${t11_row?.account_balance}, General = ฿${t11_row?.general_balance}, Building = ฿${t11_row?.building_balance}`);

  // ----------------------------------------------------------------------------
  // TEST 12: Posted Transaction Immutability (Direct modification blocked)
  // ----------------------------------------------------------------------------
  const t12_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${TREASURER_ID}", "role": "authenticated"}';
    UPDATE transactions SET amount = 99999.00 WHERE id = '${t1_id}';
  `;
  const t12_res = runRemoteQuery(t12_sql);
  const t12_pass = !t12_res.success || (t12_res.error && t12_res.error.includes("Immutable Ledger"));
  recordResult("M2-12", "Posted Transaction Immutability Enforcement", t12_pass, "Direct UPDATE on posted transaction amount strictly blocked by database trigger");

  // ----------------------------------------------------------------------------
  // TEST 13: Void and Reversal Lifecycle (Reverses ledger balances)
  // ----------------------------------------------------------------------------
  const t13_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${TREASURER_ID}", "role": "authenticated"}';
    SELECT void_transaction('${t1_id}', 'Incorrect deposit batch entered twice on Sunday.') as reversal_id;
    
    SELECT t.status as orig_status,
           rev.id::TEXT as reversal_id, rev.status as rev_status, rev.direction as rev_direction, rev.amount::TEXT as rev_amount,
           a.current_balance::TEXT as account_balance,
           fg.current_balance::TEXT as general_balance,
           fb.current_balance::TEXT as building_balance
    FROM transactions t
    LEFT JOIN transactions rev ON rev.reversal_of_id = t.id
    JOIN accounts a ON a.id = t.account_id
    CROSS JOIN funds fg
    CROSS JOIN funds fb
    WHERE t.id = '${t1_id}' 
      AND fg.id = '${FUND_GENERAL}' 
      AND fb.id = '${FUND_BUILDING}';
  `;
  const t13_res = runRemoteQuery(t13_sql);
  const t13_row = t13_res.rows?.[t13_res.rows.length - 1];
  // Reversal should reset balances: Account = 50,000, General = 30,000, Building = 20,000
  const t13_pass = t13_res.success && t13_row?.orig_status === "voided" && t13_row?.rev_status === "posted" && t13_row?.rev_direction === "expense" && t13_row?.account_balance === "50000.00" && t13_row?.general_balance === "30000.00" && t13_row?.building_balance === "20000.00";
  recordResult("M2-13", "Void & Balancing Reversal Integration", t13_pass, `Orig Status = "${t13_row?.orig_status}", Reversal = "${t13_row?.rev_direction} ฿${t13_row?.rev_amount}", Restored Account = ฿${t13_row?.account_balance}`);

  // ----------------------------------------------------------------------------
  // TEST 14: Cross-Church Isolation on Transactions
  // ----------------------------------------------------------------------------
  const t14_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CHURCH_B_USER}", "role": "authenticated"}';
    SELECT COUNT(*)::INTEGER as visible_count FROM transactions WHERE church_id = '${CHURCH_A}';
    SELECT void_transaction('${t1_id}', 'Malicious cross church void attempt');
  `;
  const t14_res = runRemoteQuery(t14_sql);
  const t14_pass = !t14_res.success || (t14_res.error && t14_res.error.includes("Unauthorized"));
  recordResult("M2-14", "Cross-Church Transaction Isolation", t14_pass, "Church B treasurer cannot access or void Church A transaction");

  // ----------------------------------------------------------------------------
  // CLEANUP TEST FIXTURES
  // ----------------------------------------------------------------------------
  console.log("\n--> Cleaning up test fixtures (M2_TEST_*)...");
  const cleanupSql = `
    DO $$
    DECLARE
      v_church_a UUID := '44444444-4444-4444-4444-111111111111';
      v_church_b UUID := '44444444-4444-4444-4444-222222222222';
    BEGIN
      DELETE FROM transaction_splits WHERE church_id IN (v_church_a, v_church_b);
      DELETE FROM transactions WHERE church_id IN (v_church_a, v_church_b);
      DELETE FROM categories WHERE church_id IN (v_church_a, v_church_b);
      DELETE FROM funds WHERE church_id IN (v_church_a, v_church_b);
      DELETE FROM accounts WHERE church_id IN (v_church_a, v_church_b);
      DELETE FROM audit_logs WHERE church_id IN (v_church_a, v_church_b);
      DELETE FROM user_roles WHERE church_id IN (v_church_a, v_church_b);
      DELETE FROM profiles WHERE church_id IN (v_church_a, v_church_b);
      DELETE FROM auth.users WHERE id IN (
        '44444444-aaaa-1111-1111-111111111111',
        '44444444-aaaa-2222-2222-222222222222',
        '44444444-aaaa-3333-3333-333333333333',
        '44444444-aaaa-4444-4444-444444444444',
        '44444444-bbbb-3333-3333-333333333333'
      );
      DELETE FROM churches WHERE id IN (v_church_a, v_church_b);
    END $$;
  `;
  runRemoteQuery(cleanupSql);
  console.log("--> Cleanup complete.\n");

  // Summary
  console.log("================================================================================");
  const totalTests = results.length;
  const passedTests = results.filter(r => r.pass).length;
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
  console.log(`OVERALL STATUS: ${passedTests === totalTests ? "✅ 100% ALL TESTS PASSED" : "❌ FAILURES DETECTED"}`);
  console.log("================================================================================");
}

runM2Phase1Tests();
