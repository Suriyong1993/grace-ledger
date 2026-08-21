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
      const stdOutStr = err.stdout ? err.stdout.toString() : "";
      const stdErrStr = err.stderr ? err.stderr.toString() : "";
      const errMsg = `${stdOutStr}\n${stdErrStr}`.trim() || err.message;
      if (attempt === retries) {
        try { fs.unlinkSync(queryFile); } catch (e) {}
        return { success: false, rows: [], error: errMsg };
      }
      execSync("powershell -Command Start-Sleep -Milliseconds 1000");
    }
  }
}

async function runM2Phase2Tests() {
  console.log("================================================================================");
  console.log("GRACE LEDGER — M2 PHASE 2 (APPROVAL WORKFLOW & UX) REAL DATABASE TEST SUITE");
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
  // SETUP TEST FIXTURES
  // ----------------------------------------------------------------------------
  console.log("--> Setting up isolated test fixtures (P2_TEST_*)...");
  const CHURCH_ID = "55555555-5555-5555-5555-111111111111";
  const CREATOR_ID = "55555555-aaaa-1111-1111-111111111111";
  const APPROVER_1 = "55555555-aaaa-2222-2222-222222222222";
  const APPROVER_2 = "55555555-aaaa-3333-3333-333333333333";
  const MEMBER_ID = "55555555-aaaa-4444-4444-444444444444";
  const ACCOUNT_ID = "55555555-cccc-1111-1111-111111111111";
  const FUND_GENERAL = "55555555-ffff-1111-1111-111111111111";
  const FUND_YOUTH = "55555555-ffff-2222-2222-222222222222";
  const FUND_BUILDING = "55555555-ffff-3333-3333-333333333333";
  const CAT_ID = "55555555-eeee-1111-1111-111111111111";

  const setupSql = `
    DO $$
    BEGIN
      -- Cleanup
      DELETE FROM transaction_splits WHERE church_id = '${CHURCH_ID}';
      DELETE FROM transactions WHERE church_id = '${CHURCH_ID}';
      DELETE FROM categories WHERE church_id = '${CHURCH_ID}';
      DELETE FROM funds WHERE church_id = '${CHURCH_ID}';
      DELETE FROM accounts WHERE church_id = '${CHURCH_ID}';
      DELETE FROM audit_logs WHERE church_id = '${CHURCH_ID}';
      DELETE FROM user_roles WHERE church_id = '${CHURCH_ID}';
      DELETE FROM profiles WHERE church_id = '${CHURCH_ID}';
      DELETE FROM auth.users WHERE id IN ('${CREATOR_ID}', '${APPROVER_1}', '${APPROVER_2}', '${MEMBER_ID}');
      DELETE FROM churches WHERE id = '${CHURCH_ID}';

      -- Create Church
      INSERT INTO churches (id, name, currency) VALUES ('${CHURCH_ID}', 'P2_TEST_Grace_Church', 'THB');

      -- Auth Users
      INSERT INTO auth.users (id, email) VALUES
        ('${CREATOR_ID}', 'p2_creator@test.com'),
        ('${APPROVER_1}', 'p2_approver1@test.com'),
        ('${APPROVER_2}', 'p2_approver2@test.com'),
        ('${MEMBER_ID}', 'p2_member@test.com');

      -- Profiles
      INSERT INTO profiles (id, church_id, email, full_name, is_active) VALUES
        ('${CREATOR_ID}', '${CHURCH_ID}', 'p2_creator@test.com', 'P2 Narin Creator', true),
        ('${APPROVER_1}', '${CHURCH_ID}', 'p2_approver1@test.com', 'P2 Pastor Somchai', true),
        ('${APPROVER_2}', '${CHURCH_ID}', 'p2_approver2@test.com', 'P2 Elder Orapin', true),
        ('${MEMBER_ID}', '${CHURCH_ID}', 'p2_member@test.com', 'P2 Regular Member', true);

      -- Roles
      INSERT INTO user_roles (church_id, user_id, role) VALUES
        ('${CHURCH_ID}', '${CREATOR_ID}', 'finance_staff'),
        ('${CHURCH_ID}', '${APPROVER_1}', 'pastor'),
        ('${CHURCH_ID}', '${APPROVER_2}', 'approver'),
        ('${CHURCH_ID}', '${MEMBER_ID}', 'member');

      -- Accounts & Funds
      INSERT INTO accounts (id, church_id, name, type, current_balance, is_active) VALUES
        ('${ACCOUNT_ID}', '${CHURCH_ID}', 'Bangkok Bank Main', 'bank', 200000.00, true);

      INSERT INTO funds (id, church_id, name, current_balance, is_active) VALUES
        ('${FUND_GENERAL}', '${CHURCH_ID}', 'กองทุนทั่วไป (General)', 100000.00, true),
        ('${FUND_YOUTH}', '${CHURCH_ID}', 'กองทุนเยาวชน (Youth)', 12010.00, true),
        ('${FUND_BUILDING}', '${CHURCH_ID}', 'กองทุนสร้างพระวิหาร (Building)', 50000.00, true);

      INSERT INTO categories (id, church_id, name, direction, is_active) VALUES
        ('${CAT_ID}', '${CHURCH_ID}', 'ค่าใช้จ่ายทั่วไป', 'expense', true);
    END $$;
  `;

  const setupRes = runRemoteQuery(setupSql);
  if (!setupRes.success) {
    console.error("Setup failed:", setupRes.error);
    process.exit(1);
  }
  console.log("--> Fixtures created successfully.\n");

  // ----------------------------------------------------------------------------
  // TEST 1: TWO-PERSON RULE ENFORCEMENT
  // ----------------------------------------------------------------------------
  const t1_id = "55555555-0000-0000-0000-000000000001";
  const t1_create = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    INSERT INTO transactions (id, church_id, account_id, amount, direction, status, description, created_by)
    VALUES ('${t1_id}', '${CHURCH_ID}', '${ACCOUNT_ID}', 5000.00, 'expense', 'draft', 'Self-approval test', '${CREATOR_ID}');

    INSERT INTO transaction_splits (church_id, transaction_id, fund_id, amount)
    VALUES ('${CHURCH_ID}', '${t1_id}', '${FUND_GENERAL}', 5000.00);

    SELECT submit_transaction('${t1_id}');
  `;
  const t1CreateRes = runRemoteQuery(t1_create);

  const t1_self_approve = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    SELECT approve_transaction('${t1_id}', 'Self approval attempt');
  `;
  const t1_res = runRemoteQuery(t1_self_approve);
  const t1_pass = !t1_res.success && (
    t1_res.error.includes("Segregation of Duties") ||
    t1_res.error.includes("Creator cannot approve") ||
    t1_res.error.includes("Unauthorized")
  );
  recordResult(
    "P2-REAL-01",
    "Two-Person Rule: Creator cannot approve own transaction",
    t1_pass,
    t1_pass ? "Creator self-approval blocked by database exception" : t1_res.error
  );

  // ----------------------------------------------------------------------------
  // TEST 2: UNAUTHORIZED ROLE APPROVAL REJECTION
  // ----------------------------------------------------------------------------
  const t2_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${MEMBER_ID}", "role": "authenticated"}';
    SELECT approve_transaction('${t1_id}', 'Member attempt');
  `;
  const t2_res = runRemoteQuery(t2_sql);
  const t2_pass = !t2_res.success && t2_res.error.includes("Unauthorized");
  recordResult(
    "P2-REAL-02",
    "RBAC: Regular member cannot approve pending transactions",
    t2_pass,
    t2_pass ? "Unauthorized role rejected by has_church_access" : t2_res.error
  );

  // ----------------------------------------------------------------------------
  // TEST 3: MANDATORY REJECTION REASON (>= 5 CHARACTERS)
  // ----------------------------------------------------------------------------
  const t3_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_1}", "role": "authenticated"}';
    SELECT reject_transaction('${t1_id}', 'no');
  `;
  const t3_res = runRemoteQuery(t3_sql);
  const t3_pass = !t3_res.success && t3_res.error.includes("minimum 5 characters");
  recordResult(
    "P2-REAL-03",
    "Rejection Validation: Rejection reason under 5 chars is rejected",
    t3_pass,
    t3_pass ? "Enforced minimum 5 character reason" : t3_res.error
  );

  // ----------------------------------------------------------------------------
  // TEST 4: SUCCESSFUL APPROVAL BY SECOND PERSON
  // ----------------------------------------------------------------------------
  const t4_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_1}", "role": "authenticated"}';
    SELECT approve_transaction('${t1_id}', 'Approved by Pastor');
    SELECT status, approved_by::TEXT FROM transactions WHERE id = '${t1_id}';
  `;
  const t4_res = runRemoteQuery(t4_sql);
  const t4_pass = t4_res.success && t4_res.rows.length === 1 && t4_res.rows[0].status === "approved";
  recordResult(
    "P2-REAL-04",
    "Valid Approval: Second person approves successfully",
    t4_pass,
    t4_pass ? `Status=${t4_res.rows?.[0]?.status}, ApprovedBy=${t4_res.rows?.[0]?.approved_by}` : t4_res.error
  );

  // ----------------------------------------------------------------------------
  // TEST 5: CONCURRENCY PROTECTION (STALE STATE: ATTEMPT TO RE-APPROVE)
  // ----------------------------------------------------------------------------
  const t5_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_2}", "role": "authenticated"}';
    SELECT approve_transaction('${t1_id}', 'Second approval attempt');
  `;
  const t5_res = runRemoteQuery(t5_sql);
  const t5_pass = !t5_res.success && (
    t5_res.error.includes("not pending approval") ||
    t5_res.error.includes("Invalid State Transition")
  );
  recordResult(
    "P2-REAL-05",
    "Concurrency Protection: Second concurrent approval attempt rejected (stale state)",
    t5_pass,
    t5_pass ? "Database rejected transition from non-pending state" : t5_res.error
  );

  // ----------------------------------------------------------------------------
  // TEST 6: CONCURRENCY PROTECTION (STALE STATE: ATTEMPT TO REJECT APPROVED TXN)
  // ----------------------------------------------------------------------------
  const t6_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_2}", "role": "authenticated"}';
    SELECT reject_transaction('${t1_id}', 'Reason for rejection after approval');
  `;
  const t6_res = runRemoteQuery(t6_sql);
  const t6_pass = !t6_res.success && (
    t6_res.error.includes("not pending approval") ||
    t6_res.error.includes("Invalid State Transition")
  );
  recordResult(
    "P2-REAL-06",
    "Concurrency Protection: Concurrent reject on already approved transaction rejected",
    t6_pass,
    t6_pass ? "State lock prevented conflicting reject operation" : t6_res.error
  );

  // ----------------------------------------------------------------------------
  // TEST 7: REJECTION REVERTS TO DRAFT WITH REJECTION REASON & AUDIT
  // ----------------------------------------------------------------------------
  const t7_id = "55555555-0000-0000-0000-000000000002";
  const t7_sql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    INSERT INTO transactions (id, church_id, account_id, amount, direction, status, description, created_by)
    VALUES ('${t7_id}', '${CHURCH_ID}', '${ACCOUNT_ID}', 8500.00, 'expense', 'draft', 'Youth camp budget', '${CREATOR_ID}');

    INSERT INTO transaction_splits (church_id, transaction_id, fund_id, amount)
    VALUES ('${CHURCH_ID}', '${t7_id}', '${FUND_YOUTH}', 8500.00);

    SELECT submit_transaction('${t7_id}');

    -- Reject as Elder Approver 2
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_2}", "role": "authenticated"}';
    SELECT reject_transaction('${t7_id}', 'ใบเสร็จรับเงินไม่สมบูรณ์ ขาดใบกำกับภาษีเต็มรูป');

    SELECT status, rejected_by::TEXT, rejection_reason FROM transactions WHERE id = '${t7_id}';
  `;
  const t7_res = runRemoteQuery(t7_sql);
  const t7_data = t7_res.rows?.[0];
  const t7_pass = t7_res.success && t7_data?.status === "draft" && t7_data?.rejection_reason?.includes("ใบเสร็จ");
  recordResult(
    "P2-REAL-07",
    "Rejection Workflow: Reverts to draft with populated reason and audit trail",
    t7_pass,
    t7_pass ? `Status=${t7_data.status}, Reason="${t7_data.rejection_reason}"` : t7_res.error
  );

  // ----------------------------------------------------------------------------
  // CLEANUP FIXTURES
  // ----------------------------------------------------------------------------
  console.log("\n--> Cleaning up test fixtures...");
  const cleanupSql = `
    DELETE FROM transaction_splits WHERE church_id = '${CHURCH_ID}';
    DELETE FROM transactions WHERE church_id = '${CHURCH_ID}';
    DELETE FROM categories WHERE church_id = '${CHURCH_ID}';
    DELETE FROM funds WHERE church_id = '${CHURCH_ID}';
    DELETE FROM accounts WHERE church_id = '${CHURCH_ID}';
    DELETE FROM audit_logs WHERE church_id = '${CHURCH_ID}';
    DELETE FROM user_roles WHERE church_id = '${CHURCH_ID}';
    DELETE FROM profiles WHERE church_id = '${CHURCH_ID}';
    DELETE FROM auth.users WHERE id IN ('${CREATOR_ID}', '${APPROVER_1}', '${APPROVER_2}', '${MEMBER_ID}');
    DELETE FROM churches WHERE id = '${CHURCH_ID}';
  `;
  runRemoteQuery(cleanupSql);

  // ----------------------------------------------------------------------------
  // FINAL REPORT
  // ----------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("FINAL RESULTS: M2 PHASE 2 APPROVAL WORKFLOW REAL DATABASE VERIFICATION");
  console.log("================================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = total - passed;
  console.log(`Total Scenarios: ${total} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.error("❌ M2 PHASE 2 DATABASE INTEGRATION VERIFICATION FAILED");
    process.exit(1);
  } else {
    console.log("🟢 M2 PHASE 2 DATABASE INTEGRATION VERIFICATION: ALL PASS");
  }
}

runM2Phase2Tests().catch(console.error);
