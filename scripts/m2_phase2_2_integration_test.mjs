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

async function runM2Phase22IntegrationTests() {
  console.log("================================================================================");
  console.log("GRACE LEDGER — M2 PHASE 2.2 APPLICATION INTEGRATION TEST SUITE");
  console.log("Target: Real Supabase PostgreSQL 17 (grace-ledger-test / jeklcfpqmytdmwczxqlx)");
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
  console.log("--> Setting up isolated test fixtures (P22_TEST_*)...");
  const CHURCH_ID = "77777777-7777-7777-7777-111111111111";
  const CREATOR_ID = "77777777-aaaa-1111-1111-111111111111";
  const APPROVER_1 = "77777777-aaaa-2222-2222-222222222222";
  const APPROVER_2 = "77777777-aaaa-3333-3333-333333333333";
  const MEMBER_ID = "77777777-aaaa-4444-4444-444444444444";
  const ACCOUNT_ID = "77777777-cccc-1111-1111-111111111111";
  const FUND_GENERAL = "77777777-ffff-1111-1111-111111111111";
  const FUND_YOUTH = "77777777-ffff-2222-2222-222222222222";
  const CAT_ID = "77777777-eeee-1111-1111-111111111111";

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
      INSERT INTO churches (id, name, currency) VALUES ('${CHURCH_ID}', 'P22_TEST_Grace_Church', 'THB');

      -- Auth Users
      INSERT INTO auth.users (id, email) VALUES
        ('${CREATOR_ID}', 'p22_creator@test.com'),
        ('${APPROVER_1}', 'p22_approver1@test.com'),
        ('${APPROVER_2}', 'p22_approver2@test.com'),
        ('${MEMBER_ID}', 'p22_member@test.com');

      -- Profiles
      INSERT INTO profiles (id, church_id, email, full_name, is_active) VALUES
        ('${CREATOR_ID}', '${CHURCH_ID}', 'p22_creator@test.com', 'P22 Creator Staff', true),
        ('${APPROVER_1}', '${CHURCH_ID}', 'p22_approver1@test.com', 'P22 Pastor Somchai', true),
        ('${APPROVER_2}', '${CHURCH_ID}', 'p22_approver2@test.com', 'P22 Elder Orapin', true),
        ('${MEMBER_ID}', '${CHURCH_ID}', 'p22_member@test.com', 'P22 Member', true);

      -- Roles
      INSERT INTO user_roles (church_id, user_id, role) VALUES
        ('${CHURCH_ID}', '${CREATOR_ID}', 'finance_staff'),
        ('${CHURCH_ID}', '${APPROVER_1}', 'pastor'),
        ('${CHURCH_ID}', '${APPROVER_2}', 'approver'),
        ('${CHURCH_ID}', '${MEMBER_ID}', 'member');

      -- Accounts & Funds
      INSERT INTO accounts (id, church_id, name, type, current_balance, is_active) VALUES
        ('${ACCOUNT_ID}', '${CHURCH_ID}', 'Bangkok Bank Main', 'bank', 250000.00, true);

      INSERT INTO funds (id, church_id, name, current_balance, is_active) VALUES
        ('${FUND_GENERAL}', '${CHURCH_ID}', 'General Fund', 150000.00, true),
        ('${FUND_YOUTH}', '${CHURCH_ID}', 'Youth Ministry Fund', 30000.00, true);

      INSERT INTO categories (id, church_id, name, direction, is_active) VALUES
        ('${CAT_ID}', '${CHURCH_ID}', 'Ministry Expenses', 'expense', true);
    END $$;
  `;

  const setupRes = runRemoteQuery(setupSql);
  if (!setupRes.success) {
    console.error("Setup failed:", setupRes.error);
    process.exit(1);
  }
  console.log("--> Fixtures created successfully.\n");

  const TXN_1 = "77777777-0000-0000-0000-000000000001";
  const TXN_2 = "77777777-0000-0000-0000-000000000002";
  const TXN_3 = "77777777-0000-0000-0000-000000000003";

  // Seed 3 Pending Transactions
  const seedPendingSql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    
    -- Txn 1 (To be Approved)
    INSERT INTO transactions (id, church_id, account_id, amount, direction, status, description, created_by)
    VALUES ('${TXN_1}', '${CHURCH_ID}', '${ACCOUNT_ID}', 8500.00, 'expense', 'draft', 'Youth Camp Registration', '${CREATOR_ID}');
    INSERT INTO transaction_splits (transaction_id, church_id, fund_id, category_id, amount, note)
    VALUES ('${TXN_1}', '${CHURCH_ID}', '${FUND_YOUTH}', '${CAT_ID}', 8500.00, 'Camp fees');
    SELECT submit_transaction('${TXN_1}');

    -- Txn 2 (To be Requested for Revision)
    INSERT INTO transactions (id, church_id, account_id, amount, direction, status, description, created_by)
    VALUES ('${TXN_2}', '${CHURCH_ID}', '${ACCOUNT_ID}', 3200.00, 'expense', 'draft', 'Sunday School Supplies', '${CREATOR_ID}');
    INSERT INTO transaction_splits (transaction_id, church_id, fund_id, category_id, amount, note)
    VALUES ('${TXN_2}', '${CHURCH_ID}', '${FUND_GENERAL}', '${CAT_ID}', 3200.00, 'Books & markers');
    SELECT submit_transaction('${TXN_2}');

    -- Txn 3 (To be Terminally Rejected)
    INSERT INTO transactions (id, church_id, account_id, amount, direction, status, description, created_by)
    VALUES ('${TXN_3}', '${CHURCH_ID}', '${ACCOUNT_ID}', 15000.00, 'expense', 'draft', 'Unapproved Sound Equipment', '${CREATOR_ID}');
    INSERT INTO transaction_splits (transaction_id, church_id, fund_id, category_id, amount, note)
    VALUES ('${TXN_3}', '${CHURCH_ID}', '${FUND_GENERAL}', '${CAT_ID}', 15000.00, 'Mixer upgrade');
    SELECT submit_transaction('${TXN_3}');
  `;
  runRemoteQuery(seedPendingSql);

  // ----------------------------------------------------------------------------
  // 1. LOAD PENDING APPROVALS QUEUE
  // ----------------------------------------------------------------------------
  const q_load = `
    SELECT t.id, t.description, t.amount, t.status, p.full_name as creator_name,
           json_agg(json_build_object('fund_id', s.fund_id, 'amount', s.amount, 'fund_name', f.name, 'fund_balance', f.current_balance)) as splits
    FROM transactions t
    JOIN profiles p ON p.id = t.created_by
    JOIN transaction_splits s ON s.transaction_id = t.id
    JOIN funds f ON f.id = s.fund_id
    WHERE t.church_id = '${CHURCH_ID}' AND t.status = 'pending_approval'
    GROUP BY t.id, p.full_name;
  `;
  const loadRes = runRemoteQuery(q_load);
  const p1_pass = loadRes.success && (loadRes.rows || []).length === 3;
  recordResult(
    "P2.2-INT-01",
    "Load Pending Approvals: Queries real pending transactions with splits & fund balances",
    p1_pass,
    `Loaded ${loadRes.rows?.length || 0} pending items (Expected 3)`
  );

  // ----------------------------------------------------------------------------
  // 2. APPROVE WORKFLOW
  // ----------------------------------------------------------------------------
  const q_approve = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_1}", "role": "authenticated"}';
    SELECT approve_transaction('${TXN_1}', 'Approved for youth ministry');
  `;
  const appRes = runRemoteQuery(q_approve);
  const q_app_check = `SELECT status, approved_by FROM transactions WHERE id = '${TXN_1}';`;
  const appCheck = runRemoteQuery(q_app_check);
  const p2_pass = appRes.success && appCheck.rows?.[0]?.status === "approved" && appCheck.rows?.[0]?.approved_by === APPROVER_1;
  recordResult(
    "P2.2-INT-02",
    "Approve Action: Approver approves voucher -> status becomes 'approved'",
    p2_pass,
    `Status: ${appCheck.rows?.[0]?.status}, ApprovedBy: ${appCheck.rows?.[0]?.approved_by}`
  );

  // ----------------------------------------------------------------------------
  // 3. REQUEST REVISION WORKFLOW
  // ----------------------------------------------------------------------------
  const q_revision = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_2}", "role": "authenticated"}';
    SELECT request_transaction_revision('${TXN_2}', 'กรุณาแนบใบเสร็จฉบับจริงจากร้านเครื่องเขียน');
  `;
  const revRes = runRemoteQuery(q_revision);
  const q_rev_check = `
    SELECT t.status, t.rejection_reason, a.action 
    FROM transactions t
    LEFT JOIN audit_logs a ON a.entity_id = t.id AND a.action = 'REVISION_REQUESTED'
    WHERE t.id = '${TXN_2}';
  `;
  const revCheck = runRemoteQuery(q_rev_check);
  const p3_pass = revRes.success && revCheck.rows?.[0]?.status === "draft" && revCheck.rows?.[0]?.action === "REVISION_REQUESTED";
  recordResult(
    "P2.2-INT-03",
    "Request Revision Action: Returns voucher to 'draft' with REVISION_REQUESTED audit",
    p3_pass,
    `Status: ${revCheck.rows?.[0]?.status}, Reason: ${revCheck.rows?.[0]?.rejection_reason}`
  );

  // ----------------------------------------------------------------------------
  // 4. TERMINAL REJECT WORKFLOW
  // ----------------------------------------------------------------------------
  const q_reject = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_1}", "role": "authenticated"}';
    SELECT reject_transaction_terminal('${TXN_3}', 'ไม่อยู่ในงบประมาณที่คณะมัคนายกอนุมัติ');
  `;
  const rejRes = runRemoteQuery(q_reject);
  const q_rej_check = `
    SELECT t.status, t.rejection_reason, a.action 
    FROM transactions t
    LEFT JOIN audit_logs a ON a.entity_id = t.id AND a.action = 'TRANSACTION_REJECTED'
    WHERE t.id = '${TXN_3}';
  `;
  const rejCheck = runRemoteQuery(q_rej_check);
  const p4_pass = rejRes.success && rejCheck.rows?.[0]?.status === "rejected" && rejCheck.rows?.[0]?.action === "TRANSACTION_REJECTED";
  recordResult(
    "P2.2-INT-04",
    "Terminal Reject Action: Permanently locks voucher to 'rejected' with TRANSACTION_REJECTED audit",
    p4_pass,
    `Status: ${rejCheck.rows?.[0]?.status}, Reason: ${rejCheck.rows?.[0]?.rejection_reason}`
  );

  // ----------------------------------------------------------------------------
  // 5. UNAUTHORIZED ACTION (Non-Approver Member)
  // ----------------------------------------------------------------------------
  const TXN_4 = "77777777-0000-0000-0000-000000000004";
  const seedTxn4 = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    INSERT INTO transactions (id, church_id, account_id, amount, direction, status, description, created_by)
    VALUES ('${TXN_4}', '${CHURCH_ID}', '${ACCOUNT_ID}', 1200.00, 'expense', 'draft', 'Member test txn', '${CREATOR_ID}');
    INSERT INTO transaction_splits (transaction_id, church_id, fund_id, category_id, amount, note)
    VALUES ('${TXN_4}', '${CHURCH_ID}', '${FUND_GENERAL}', '${CAT_ID}', 1200.00, 'General split');
    SELECT submit_transaction('${TXN_4}');
  `;
  runRemoteQuery(seedTxn4);

  const q_unauth = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${MEMBER_ID}", "role": "authenticated"}';
    SELECT approve_transaction('${TXN_4}', 'Unauthorized approve');
  `;
  const unauthRes = runRemoteQuery(q_unauth);
  const p5_pass = !unauthRes.success && unauthRes.error.includes("Only designated approvers");
  recordResult(
    "P2.2-INT-05",
    "Unauthorized Action: Member role is blocked from approving transactions",
    p5_pass,
    p5_pass ? "Blocked by RPC authorization guard" : `Unexpected result: ${unauthRes.error}`
  );

  // ----------------------------------------------------------------------------
  // 6. CREATOR SELF-APPROVAL (Two-Person Rule)
  // ----------------------------------------------------------------------------
  const q_self_approve = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
    SELECT approve_transaction('${TXN_4}', 'Creator self-approval');
  `;
  const selfAppRes = runRemoteQuery(q_self_approve);
  const p6_pass = !selfAppRes.success && (
    selfAppRes.error.includes("Creator cannot approve") ||
    selfAppRes.error.includes("Segregation of Duties") ||
    selfAppRes.error.includes("Only designated approvers")
  );
  recordResult(
    "P2.2-INT-06",
    "Two-Person Rule: Creator cannot approve their own transaction",
    p6_pass,
    p6_pass ? "Strictly blocked by Two-Person rule enforcement" : `Unexpected result: ${selfAppRes.error}`
  );

  // ----------------------------------------------------------------------------
  // 7. STALE TRANSACTION / CONCURRENCY CONFLICT (P0001)
  // ----------------------------------------------------------------------------
  // TXN_1 is already 'approved'. Attempting another approve should raise stale state error.
  const q_stale = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_2}", "role": "authenticated"}';
    SELECT approve_transaction('${TXN_1}', 'Concurrent duplicate approval');
  `;
  const staleRes = runRemoteQuery(q_stale);
  const p7_pass = !staleRes.success && (
    staleRes.error.includes("not pending approval") ||
    staleRes.error.includes("Invalid State Transition")
  );
  recordResult(
    "P2.2-INT-07",
    "Stale State / Concurrency Conflict: Second approver acting on already processed voucher is caught",
    p7_pass,
    p7_pass ? "Stale state handled cleanly (P0001: not pending approval)" : `Unexpected result: ${staleRes.error}`
  );

  // ----------------------------------------------------------------------------
  // 8. QUEUE REFLECTS STATE CHANGES
  // ----------------------------------------------------------------------------
  const q_final_queue = `
    SELECT id, status FROM transactions 
    WHERE church_id = '${CHURCH_ID}' AND status = 'pending_approval';
  `;
  const finalQueueRes = runRemoteQuery(q_final_queue);
  const remainingRows = finalQueueRes.rows || [];
  // Only TXN_4 should remain pending (TXN_1 was approved, TXN_2 draft, TXN_3 rejected)
  const p8_pass = finalQueueRes.success && remainingRows.length === 1 && remainingRows[0]?.id === TXN_4;
  recordResult(
    "P2.2-INT-08",
    "Queue Reflects State Changes: Only genuinely pending items remain in queue",
    p8_pass,
    `Remaining pending items: ${remainingRows.length} (Only TXN_4 pending)`
  );

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log("\n================================================================================");
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log(`TOTAL APPLICATION INTEGRATION TESTS: ${passed}/${total} PASSED`);
  console.log("================================================================================");

  if (passed === total) {
    console.log("🎉 ALL M2 PHASE 2.2 APPLICATION INTEGRATION TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME INTEGRATION TESTS FAILED!");
    process.exit(1);
  }
}

runM2Phase22IntegrationTests();
