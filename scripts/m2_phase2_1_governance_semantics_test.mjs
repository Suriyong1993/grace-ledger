import { execSync } from "child_process";
import fs from "fs";
import path from "path";

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

async function runM2Phase21Tests() {
  console.log("================================================================================");
  console.log("GRACE LEDGER — M2 PHASE 2.1 (GOVERNANCE SEMANTICS & TERMINAL REJECT) TEST SUITE");
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
  console.log("--> Setting up isolated test fixtures (P21_TEST_*)...");
  const CHURCH_ID = "66666666-6666-6666-6666-111111111111";
  const CREATOR_ID = "66666666-aaaa-1111-1111-111111111111";
  const APPROVER_1 = "66666666-aaaa-2222-2222-222222222222";
  const APPROVER_2 = "66666666-aaaa-3333-3333-333333333333";
  const TREASURER_ID = "66666666-aaaa-4444-4444-444444444444";
  const ACCOUNT_ID = "66666666-cccc-1111-1111-111111111111";
  const FUND_GENERAL = "66666666-ffff-1111-1111-111111111111";
  const FUND_YOUTH = "66666666-ffff-2222-2222-222222222222";
  const CAT_ID = "66666666-eeee-1111-1111-111111111111";

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
      DELETE FROM auth.users WHERE id IN ('${CREATOR_ID}', '${APPROVER_1}', '${APPROVER_2}', '${TREASURER_ID}');
      DELETE FROM churches WHERE id = '${CHURCH_ID}';

      -- Create Church
      INSERT INTO churches (id, name, currency) VALUES ('${CHURCH_ID}', 'P21_TEST_Grace_Church', 'THB');

      -- Auth Users
      INSERT INTO auth.users (id, email) VALUES
        ('${CREATOR_ID}', 'p21_creator@test.com'),
        ('${APPROVER_1}', 'p21_approver1@test.com'),
        ('${APPROVER_2}', 'p21_approver2@test.com'),
        ('${TREASURER_ID}', 'p21_treasurer@test.com');

      -- Profiles
      INSERT INTO profiles (id, church_id, email, full_name, is_active) VALUES
        ('${CREATOR_ID}', '${CHURCH_ID}', 'p21_creator@test.com', 'P21 Creator', true),
        ('${APPROVER_1}', '${CHURCH_ID}', 'p21_approver1@test.com', 'P21 Approver 1', true),
        ('${APPROVER_2}', '${CHURCH_ID}', 'p21_approver2@test.com', 'P21 Approver 2', true),
        ('${TREASURER_ID}', '${CHURCH_ID}', 'p21_treasurer@test.com', 'P21 Treasurer', true);

      -- Roles
      INSERT INTO user_roles (church_id, user_id, role) VALUES
        ('${CHURCH_ID}', '${CREATOR_ID}', 'finance_staff'),
        ('${CHURCH_ID}', '${APPROVER_1}', 'pastor'),
        ('${CHURCH_ID}', '${APPROVER_2}', 'approver'),
        ('${CHURCH_ID}', '${TREASURER_ID}', 'treasurer');

      -- Accounts & Funds
      INSERT INTO accounts (id, church_id, name, type, current_balance, is_active) VALUES
        ('${ACCOUNT_ID}', '${CHURCH_ID}', 'Bangkok Bank Main', 'bank', 200000.00, true);

      INSERT INTO funds (id, church_id, name, current_balance, is_active) VALUES
        ('${FUND_GENERAL}', '${CHURCH_ID}', 'General Fund', 100000.00, true),
        ('${FUND_YOUTH}', '${CHURCH_ID}', 'Youth Fund', 12010.00, true);

      INSERT INTO categories (id, church_id, name, direction, is_active) VALUES
        ('${CAT_ID}', '${CHURCH_ID}', 'General Expense', 'expense', true);
    END $$;
  `;

  const setupRes = runRemoteQuery(setupSql);
  if (!setupRes.success) {
    console.error("Setup failed:", setupRes.error);
    process.exit(1);
  }
  console.log("--> Fixtures created successfully.\n");

  // Common Voucher ID for P2.1-01 to P2.1-09
  const TXN_A = "66666666-0000-0000-0000-000000000001";

  // ----------------------------------------------------------------------------
  // P2.1-REAL-01: Revision request -> draft
  // ----------------------------------------------------------------------------
  const t1_create = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    INSERT INTO transactions (id, church_id, account_id, amount, direction, status, description, created_by)
    VALUES ('${TXN_A}', '${CHURCH_ID}', '${ACCOUNT_ID}', 5000.00, 'expense', 'draft', 'Youth Camp Equipment', '${CREATOR_ID}');
    INSERT INTO transaction_splits (transaction_id, church_id, fund_id, category_id, amount, note)
    VALUES ('${TXN_A}', '${CHURCH_ID}', '${FUND_YOUTH}', '${CAT_ID}', 5000.00, 'Camp equipment split');
    SELECT submit_transaction('${TXN_A}');
  `;
  runRemoteQuery(t1_create);

  const t1_revision = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_1}", "role": "authenticated"}';
    SELECT request_transaction_revision('${TXN_A}', 'ขอเอกสารใบเสร็จตัวจริงเพิ่มเติม');
  `;
  const t1_res = runRemoteQuery(t1_revision);

  const t1_check = `
    SELECT t.status, t.rejection_reason, t.rejected_by, a.action, a.category, a.metadata
    FROM transactions t
    LEFT JOIN audit_logs a ON a.entity_id = t.id AND a.action = 'REVISION_REQUESTED'
    WHERE t.id = '${TXN_A}';
  `;
  const t1_check_res = runRemoteQuery(t1_check);
  const row1 = t1_check_res.rows?.[0];
  const p1_pass = t1_res.success && row1?.status === "draft" && row1?.rejection_reason === "ขอเอกสารใบเสร็จตัวจริงเพิ่มเติม" && row1?.action === "REVISION_REQUESTED";
  recordResult(
    "P2.1-REAL-01",
    "request_transaction_revision transitions pending_approval -> draft with reason & REVISION_REQUESTED audit",
    p1_pass,
    `Status: ${row1?.status}, Reason: ${row1?.rejection_reason}, Audit Action: ${row1?.action}`
  );

  // ----------------------------------------------------------------------------
  // P2.1-REAL-02: Edit -> resubmit -> pending_approval
  // ----------------------------------------------------------------------------
  const t2_edit_resubmit = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    
    -- Edit draft description and amount
    UPDATE transactions 
    SET description = 'Youth Camp Equipment (Updated)', amount = 5500.00 
    WHERE id = '${TXN_A}';
    
    UPDATE transaction_splits 
    SET amount = 5500.00 
    WHERE transaction_id = '${TXN_A}';
    
    -- Resubmit
    SELECT submit_transaction('${TXN_A}');
  `;
  const t2_res = runRemoteQuery(t2_edit_resubmit);
  const t2_check = `SELECT status, description, amount FROM transactions WHERE id = '${TXN_A}';`;
  const t2_check_res = runRemoteQuery(t2_check);
  const row2 = t2_check_res.rows?.[0];
  const p2_pass = t2_res.success && row2?.status === "pending_approval" && parseFloat(row2?.amount) === 5500.00;
  recordResult(
    "P2.1-REAL-02",
    "Creator can edit returned draft and successfully resubmit to pending_approval",
    p2_pass,
    `Status: ${row2?.status}, Description: ${row2?.description}, Amount: ${row2?.amount}`
  );

  // ----------------------------------------------------------------------------
  // P2.1-REAL-03: Terminal rejection -> rejected
  // ----------------------------------------------------------------------------
  const t3_terminal_reject = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_1}", "role": "authenticated"}';
    SELECT reject_transaction_terminal('${TXN_A}', 'งบประมาณเยาวชนไม่เพียงพอ ไม่อนุมัติโครงการ');
  `;
  const t3_res = runRemoteQuery(t3_terminal_reject);
  const t3_check = `
    SELECT t.status, t.rejection_reason, t.rejected_by, a.action, a.category, a.metadata
    FROM transactions t
    LEFT JOIN audit_logs a ON a.entity_id = t.id AND a.action = 'TRANSACTION_REJECTED'
    WHERE t.id = '${TXN_A}';
  `;
  const t3_check_res = runRemoteQuery(t3_check);
  const row3 = t3_check_res.rows?.[0];
  const p3_pass = t3_res.success && row3?.status === "rejected" && row3?.rejection_reason === "งบประมาณเยาวชนไม่เพียงพอ ไม่อนุมัติโครงการ" && row3?.action === "TRANSACTION_REJECTED";
  recordResult(
    "P2.1-REAL-03",
    "reject_transaction_terminal transitions pending_approval -> rejected with TRANSACTION_REJECTED audit",
    p3_pass,
    `Status: ${row3?.status}, Reason: ${row3?.rejection_reason}, Audit Action: ${row3?.action}`
  );

  // ----------------------------------------------------------------------------
  // P2.1-REAL-04: Direct UPDATE rejected transaction -> blocked
  // ----------------------------------------------------------------------------
  const t4_direct_update = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${TREASURER_ID}", "role": "authenticated"}';
    UPDATE transactions SET description = 'Attempting illegal modification' WHERE id = '${TXN_A}';
  `;
  const t4_res = runRemoteQuery(t4_direct_update);
  const p4_pass = !t4_res.success && (
    t4_res.error.includes("Immutable Ledger") || 
    t4_res.error.includes("permanently locked")
  );
  recordResult(
    "P2.1-REAL-04",
    "Direct SQL UPDATE on rejected transaction is strictly blocked by trigger",
    p4_pass,
    p4_pass ? "Trigger Exception: Immutable Ledger raised as expected" : `Unexpected result: ${t4_res.error}`
  );

  // ----------------------------------------------------------------------------
  // P2.1-REAL-05: submit rejected transaction -> blocked
  // ----------------------------------------------------------------------------
  const t5_submit = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    SELECT submit_transaction('${TXN_A}');
  `;
  const t5_res = runRemoteQuery(t5_submit);
  const p5_pass = !t5_res.success && t5_res.error.includes("Only draft transactions can be submitted");
  recordResult(
    "P2.1-REAL-05",
    "submit_transaction on rejected transaction is strictly blocked",
    p5_pass,
    p5_pass ? "RPC Exception: Invalid State Transition raised as expected" : `Unexpected result: ${t5_res.error}`
  );

  // ----------------------------------------------------------------------------
  // P2.1-REAL-06: approve rejected transaction -> blocked
  // ----------------------------------------------------------------------------
  const t6_approve = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_2}", "role": "authenticated"}';
    SELECT approve_transaction('${TXN_A}', 'Try approve rejected');
  `;
  const t6_res = runRemoteQuery(t6_approve);
  const p6_pass = !t6_res.success && t6_res.error.includes("is not pending approval");
  recordResult(
    "P2.1-REAL-06",
    "approve_transaction on rejected transaction is strictly blocked",
    p6_pass,
    p6_pass ? "RPC Exception: Invalid State Transition raised as expected" : `Unexpected result: ${t6_res.error}`
  );

  // ----------------------------------------------------------------------------
  // P2.1-REAL-07: post rejected transaction -> blocked
  // ----------------------------------------------------------------------------
  const t7_post = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${TREASURER_ID}", "role": "authenticated"}';
    SELECT post_transaction('${TXN_A}');
  `;
  const t7_res = runRemoteQuery(t7_post);
  const p7_pass = !t7_res.success && (
    t7_res.error.includes("Only approved transactions") ||
    t7_res.error.includes("is not approved for posting") ||
    t7_res.error.includes("Invalid State Transition")
  );
  recordResult(
    "P2.1-REAL-07",
    "post_transaction on rejected transaction is strictly blocked",
    p7_pass,
    p7_pass ? "RPC Exception: Invalid State Transition raised as expected" : `Unexpected result: ${t7_res.error}`
  );

  // ----------------------------------------------------------------------------
  // P2.1-REAL-08: request revision on rejected transaction -> blocked
  // ----------------------------------------------------------------------------
  const t8_revision_on_rejected = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_1}", "role": "authenticated"}';
    SELECT request_transaction_revision('${TXN_A}', 'ขอแก้ไขรายการที่ถูกปฏิเสธแล้ว');
  `;
  const t8_res = runRemoteQuery(t8_revision_on_rejected);
  const p8_pass = !t8_res.success && t8_res.error.includes("Only transactions pending approval can be returned for revision");
  recordResult(
    "P2.1-REAL-08",
    "request_transaction_revision on rejected transaction is strictly blocked",
    p8_pass,
    p8_pass ? "RPC Exception: Invalid State Transition raised as expected" : `Unexpected result: ${t8_res.error}`
  );

  // ----------------------------------------------------------------------------
  // P2.1-REAL-09: reject rejected transaction -> blocked
  // ----------------------------------------------------------------------------
  const t9_reject_on_rejected = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_2}", "role": "authenticated"}';
    SELECT reject_transaction_terminal('${TXN_A}', 'ปฏิเสธซ้ำรายการที่ถูกปฏิเสธแล้ว');
  `;
  const t9_res = runRemoteQuery(t9_reject_on_rejected);
  const p9_pass = !t9_res.success && t9_res.error.includes("Only transactions pending approval can be rejected");
  recordResult(
    "P2.1-REAL-09",
    "reject_transaction_terminal on already rejected transaction is strictly blocked",
    p9_pass,
    p9_pass ? "RPC Exception: Invalid State Transition raised as expected" : `Unexpected result: ${t9_res.error}`
  );

  // ----------------------------------------------------------------------------
  // P2.1-REAL-10: audit history preserved across multiple revisions
  // ----------------------------------------------------------------------------
  const TXN_B = "66666666-0000-0000-0000-000000000002";
  const t10_multi_revision = `
    SET LOCAL ROLE authenticated;
    
    -- 1. Create and submit
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    INSERT INTO transactions (id, church_id, account_id, amount, direction, status, description, created_by)
    VALUES ('${TXN_B}', '${CHURCH_ID}', '${ACCOUNT_ID}', 2500.00, 'expense', 'draft', 'Multi-revision test', '${CREATOR_ID}');
    INSERT INTO transaction_splits (transaction_id, church_id, fund_id, category_id, amount, note)
    VALUES ('${TXN_B}', '${CHURCH_ID}', '${FUND_GENERAL}', '${CAT_ID}', 2500.00, 'Split 1');
    SELECT submit_transaction('${TXN_B}');
    
    -- 2. Revision 1 by Approver 1
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_1}", "role": "authenticated"}';
    SELECT request_transaction_revision('${TXN_B}', 'Revision 1: ขอใบเสนอราคา');
    
    -- 3. Resubmit by Creator
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    SELECT submit_transaction('${TXN_B}');
    
    -- 4. Revision 2 by Approver 2
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_2}", "role": "authenticated"}';
    SELECT request_transaction_revision('${TXN_B}', 'Revision 2: ขอสำเนาบัตรผู้เบิก');
    
    -- 5. Resubmit by Creator
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    SELECT submit_transaction('${TXN_B}');
    
    -- 6. Final Terminal Reject by Approver 1
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_1}", "role": "authenticated"}';
    SELECT reject_transaction_terminal('${TXN_B}', 'Final Rejection: เลยกำหนดเวลาจัดกิจกรรม');
  `;
  const t10_res = runRemoteQuery(t10_multi_revision);

  const t10_audit_check = `
    SELECT action, metadata, created_at
    FROM audit_logs
    WHERE entity_id = '${TXN_B}'
    ORDER BY created_at ASC;
  `;
  const t10_audit_res = runRemoteQuery(t10_audit_check);
  const actions = (t10_audit_res.rows || []).map(r => r.action);
  const revReqCount = actions.filter(a => a === "REVISION_REQUESTED").length;
  const submitCount = actions.filter(a => a === "SUBMIT_FOR_APPROVAL").length;
  const rejectCount = actions.filter(a => a === "TRANSACTION_REJECTED").length;
  
  const p10_pass = t10_res.success && revReqCount === 2 && submitCount === 3 && rejectCount === 1;
  recordResult(
    "P2.1-REAL-10",
    "Complete audit history preserved across multiple revisions & terminal rejection",
    p10_pass,
    `Audit Actions: ${actions.join(" -> ")} (Revisions: ${revReqCount}, Submissions: ${submitCount}, Rejects: ${rejectCount})`
  );

  // ----------------------------------------------------------------------------
  // P2.1-REAL-11: void/reversal behavior on rejected transaction matches documented rule
  // ----------------------------------------------------------------------------
  const t11_void = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${TREASURER_ID}", "role": "authenticated"}';
    SELECT void_transaction('${TXN_A}', 'Attempting to void a rejected unposted voucher');
  `;
  const t11_res = runRemoteQuery(t11_void);
  const p11_pass = !t11_res.success && (
    t11_res.error.includes("Only posted transactions can be voided") ||
    t11_res.error.includes("Invalid State Transition")
  );
  recordResult(
    "P2.1-REAL-11",
    "void_transaction on rejected transaction is strictly blocked (only posted vouchers can be voided)",
    p11_pass,
    p11_pass ? "RPC Exception: Only posted transactions can be voided raised as expected" : `Unexpected result: ${t11_res.error}`
  );

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log("\n================================================================================");
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log(`TOTAL REAL DATABASE TESTS: ${passed}/${total} PASSED`);
  console.log("================================================================================");

  if (passed === total) {
    console.log("🎉 ALL M2 PHASE 2.1 REAL POSTGRESQL GOVERNANCE TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME TESTS FAILED!");
    process.exit(1);
  }
}

runM2Phase21Tests();
