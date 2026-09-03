import { chromium } from "playwright";
import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import http from "http";
import { createClient } from "@supabase/supabase-js";

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

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode && res.statusCode < 500) resolve(true);
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on("error", reject);
        req.end();
      });
      return true;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Server at ${url} did not respond within ${timeoutMs}ms`);
}

async function runBrowserE2E() {
  console.log("================================================================================");
  console.log("GRACE LEDGER — M2 PHASE 2.3 BROWSER E2E & UX VALIDATION SUITE");
  console.log("Target: Chromium Browser + Vite Dev Server + Live Supabase PostgreSQL 17");
  console.log("================================================================================\n");

  const results = [];
  function recordResult(code, description, pass, details) {
    results.push({ code, description, pass, details });
    const badge = pass ? "✅ PASS" : "❌ FAIL";
    console.log(`[${code}] ${badge} - ${description}`);
    if (details) console.log(`       Details: ${details}`);
  }

  // ----------------------------------------------------------------------------
  // 1. SETUP DATABASE FIXTURES
  // ----------------------------------------------------------------------------
  console.log("--> Setting up isolated test fixtures (P23_TEST_*)...");
  const CHURCH_ID = "66666666-6666-6666-6666-111111111111"; // Standard verified church ID used in main.ts
  const ACCOUNT_ID = "66666666-cccc-1111-1111-111111111111";
  const FUND_GENERAL = "66666666-ffff-1111-1111-111111111111";
  const FUND_BUILDING = "66666666-ffff-2222-2222-222222222222";
  const CAT_ID = "66666666-eeee-1111-1111-111111111111";

  const anonClient = createClient(
    "https://jeklcfpqmytdmwczxqlx.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impla2xjZnBxbXl0ZG13Y3p4cWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NzY0NDUsImV4cCI6MjEwMjU1MjQ0NX0.ZSM88SkzsWhqsD7x8gpyTSguKB2oG51lZqKLGHQETHA"
  );

  const APPROVER_EMAIL = "somchai_pastor@grace.org";
  const CREATOR_EMAIL = "manas_staff@grace.org";
  const PASSWORD = "GracePassword123!";

  const APPROVER_1 = "3aeb81bd-0ae5-49a4-95b1-c7a877e447fc"; // Verified Pastor Somchai
  const CREATOR_ID = "66666666-aaaa-1111-1111-111111111111"; // Verified Staff Manas

  // Confirm email in database
  runRemoteQuery(`
    UPDATE auth.users SET email_confirmed_at = now() WHERE email = '${APPROVER_EMAIL}';
    UPDATE auth.identities SET identity_data = jsonb_set(identity_data, '{email_verified}', 'true'::jsonb) WHERE identity_data->>'email' = '${APPROVER_EMAIL}';
  `);

  const setupSql = `
    DO $$
    BEGIN
      -- Cleanup church test data
      DELETE FROM transaction_splits WHERE church_id = '${CHURCH_ID}';
      DELETE FROM transactions WHERE church_id = '${CHURCH_ID}';
      DELETE FROM categories WHERE church_id = '${CHURCH_ID}';
      DELETE FROM funds WHERE church_id = '${CHURCH_ID}';
      DELETE FROM accounts WHERE church_id = '${CHURCH_ID}';
      DELETE FROM audit_logs WHERE church_id = '${CHURCH_ID}';
      DELETE FROM user_roles WHERE church_id = '${CHURCH_ID}';
      DELETE FROM profiles WHERE church_id = '${CHURCH_ID}';
      DELETE FROM churches WHERE id = '${CHURCH_ID}';

      -- Create Church
      INSERT INTO churches (id, name, currency) VALUES ('${CHURCH_ID}', 'คริสตจักรชีวิตสุขสันต์กาฬสินธุ์', 'THB');

      -- Profiles
      INSERT INTO profiles (id, church_id, email, full_name, is_active) VALUES
        ('${CREATOR_ID}', '${CHURCH_ID}', '${CREATOR_EMAIL}', 'สุดารัตน์ จิณเซ่ง', true),
        ('${APPROVER_1}', '${CHURCH_ID}', '${APPROVER_EMAIL}', 'อาจารย์สรรเสริญ ดวงจิตร', true);

      -- Roles
      INSERT INTO user_roles (church_id, user_id, role) VALUES
        ('${CHURCH_ID}', '${CREATOR_ID}', 'finance_staff'),
        ('${CHURCH_ID}', '${APPROVER_1}', 'pastor');

      -- Accounts & Funds
      INSERT INTO accounts (id, church_id, name, type, current_balance, is_active) VALUES
        ('${ACCOUNT_ID}', '${CHURCH_ID}', 'ธนาคารกรุงเทพ กระแสรายวัน', 'bank', 350000.00, true);

      INSERT INTO funds (id, church_id, name, current_balance, is_active) VALUES
        ('${FUND_GENERAL}', '${CHURCH_ID}', 'กองทุนทั่วไป', 200000.00, true),
        ('${FUND_BUILDING}', '${CHURCH_ID}', 'กองทุนพันธกิจพิเศษ', 50000.00, true);

      INSERT INTO categories (id, church_id, name, direction, is_active) VALUES
        ('${CAT_ID}', '${CHURCH_ID}', 'ค่าใช้จ่ายพันธกิจ', 'expense', true);
    END $$;
  `;

  const setupRes = runRemoteQuery(setupSql);
  if (!setupRes.success) {
    console.error("DB Setup failed:", setupRes.error);
    process.exit(1);
  }
  console.log("--> DB Fixtures created successfully.\n");

  const TXN_E2E_1 = "66666666-0000-0000-0000-000000000001";
  const TXN_E2E_2 = "66666666-0000-0000-0000-000000000002";
  const TXN_E2E_3 = "66666666-0000-0000-0000-000000000003";
  const TXN_E2E_SELF = "66666666-0000-0000-0000-000000000004";

  // Seed pending transactions
  const seedSql = `
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';

    -- Txn 1 (For Approve Journey)
    INSERT INTO transactions (id, church_id, account_id, amount, direction, status, description, created_by, reference_number)
    VALUES ('${TXN_E2E_1}', '${CHURCH_ID}', '${ACCOUNT_ID}', 12500.00, 'expense', 'draft', 'ค่าเช่าสถานที่จัดค่ายเยาวชน', '${CREATOR_ID}', 'VCH-2026-001');
    INSERT INTO transaction_splits (transaction_id, church_id, fund_id, category_id, amount, note)
    VALUES ('${TXN_E2E_1}', '${CHURCH_ID}', '${FUND_BUILDING}', '${CAT_ID}', 12500.00, 'Youth Camp Venue');
    SELECT submit_transaction('${TXN_E2E_1}');

    -- Txn 2 (For Request Revision Journey)
    INSERT INTO transactions (id, church_id, account_id, amount, direction, status, description, created_by, reference_number)
    VALUES ('${TXN_E2E_2}', '${CHURCH_ID}', '${ACCOUNT_ID}', 4200.00, 'expense', 'draft', 'อุปกรณ์สำนักงานและกระดาษ', '${CREATOR_ID}', 'VCH-2026-002');
    INSERT INTO transaction_splits (transaction_id, church_id, fund_id, category_id, amount, note)
    VALUES ('${TXN_E2E_2}', '${CHURCH_ID}', '${FUND_GENERAL}', '${CAT_ID}', 4200.00, 'Office supplies');
    SELECT submit_transaction('${TXN_E2E_2}');

    -- Txn 3 (For Terminal Reject Journey)
    INSERT INTO transactions (id, church_id, account_id, amount, direction, status, description, created_by, reference_number)
    VALUES ('${TXN_E2E_3}', '${CHURCH_ID}', '${ACCOUNT_ID}', 28000.00, 'expense', 'draft', 'จัดซื้อเก้าอี้ห้องประชุมชุดใหม่', '${CREATOR_ID}', 'VCH-2026-003');
    INSERT INTO transaction_splits (transaction_id, church_id, fund_id, category_id, amount, note)
    VALUES ('${TXN_E2E_3}', '${CHURCH_ID}', '${FUND_GENERAL}', '${CAT_ID}', 28000.00, 'Chairs');
    SELECT submit_transaction('${TXN_E2E_3}');

    -- Txn 4 (Created by Pastor Somchai himself to test Two-Person self approval restriction)
    SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_1}", "role": "authenticated"}';
    INSERT INTO transactions (id, church_id, account_id, amount, direction, status, description, created_by, reference_number)
    VALUES ('${TXN_E2E_SELF}', '${CHURCH_ID}', '${ACCOUNT_ID}', 1500.00, 'expense', 'draft', 'ค่าเดินทางเยี่ยมเยียนสมาชิก', '${APPROVER_1}', 'VCH-2026-004');
    INSERT INTO transaction_splits (transaction_id, church_id, fund_id, category_id, amount, note)
    VALUES ('${TXN_E2E_SELF}', '${CHURCH_ID}', '${FUND_GENERAL}', '${CAT_ID}', 1500.00, 'Pastoral visit gas');
    SELECT submit_transaction('${TXN_E2E_SELF}');
  `;
  runRemoteQuery(seedSql);
  console.log("--> Seeded 4 vouchers into pending_approval.\n");

  // ----------------------------------------------------------------------------
  // 2. LAUNCH VITE SERVER
  // ----------------------------------------------------------------------------
  console.log("--> Starting Vite server on http://localhost:5173...");
  const viteProcess = spawn("npx", ["vite", "--port", "5173", "--strictPort"], {
    shell: true,
    stdio: "pipe",
  });

  viteProcess.stderr.on("data", (data) => {
    // console.error(`Vite err: ${data}`);
  });

  try {
    await waitForServer("http://localhost:5173");
    console.log("--> Vite server is LIVE at http://localhost:5173\n");
  } catch (err) {
    console.error("Vite failed to start:", err);
    viteProcess.kill();
    process.exit(1);
  }

  // ----------------------------------------------------------------------------
  // 3. RUN PLAYWRIGHT BROWSER SESSIONS
  // ----------------------------------------------------------------------------
  const browser = await chromium.launch({ headless: true });
  const screenshotsDir = path.resolve("docs/screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    // ==========================================================================
    // TEST 1: DASHBOARD NAVIGATION & ALERT CARD
    // ==========================================================================
    const contextDesktop = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await contextDesktop.newPage();
    page.on("console", (msg) => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));
    page.on("pageerror", (err) => console.error("[Browser Page Error]:", err));
    page.on("response", async (res) => {
      if (res.status() >= 400) {
        let body = "";
        try { body = await res.text(); } catch (e) {}
        console.log(`[HTTP ${res.status()}] ${res.url()} -> ${body}`);
      }
    });

    await page.goto("http://localhost:5173/#/");
    await page.waitForSelector(".gl-dashboard-container");

    const totalText = await page.locator('[data-testid="total-balance"]').innerText();
    const pendingText = await page.locator("text=ต้องการให้คุณตรวจสอบ").isVisible();

    recordResult(
      "P2.3-E2E-01",
      "Dashboard: Renders live ledger balance and pending approval alert card",
      pendingText && totalText.includes("฿"),
      `Balance Displayed: ${totalText}`
    );

    await page.screenshot({ path: path.join(screenshotsDir, "01_dashboard.png") });

    // ==========================================================================
    // TEST 2: QUEUE VIEW & CARD SELECTION
    // ==========================================================================
    // Click "ไปที่คิวอนุมัติ" link on Dashboard
    await page.click("text=ไปที่คิวอนุมัติ");
    await page.waitForSelector(".gl-approvals-queue-view");

    const itemsCount = await page.locator(".gl-approval-item").count();
    recordResult(
      "P2.3-E2E-02",
      "Queue View: Navigates to /approvals and lists all pending vouchers",
      itemsCount === 4,
      `Vouchers in queue: ${itemsCount} (Expected 4)`
    );

    await page.screenshot({ path: path.join(screenshotsDir, "02_queue_view.png") });

    // ==========================================================================
    // TEST 3: E2E JOURNEY 1 — APPROVAL
    // ==========================================================================
    // Open Txn 1: ค่าเช่าสถานที่จัดค่ายเยาวชน
    await page.click(`[data-id="${TXN_E2E_1}"]`);
    await page.waitForSelector(".gl-decision-sheet");

    const heroAmount = await page.locator(".gl-decision-sheet .num-display").first().innerText();
    const approveBtnVisible = await page.locator(".gl-btn-approve").isVisible();

    // Click "อนุมัติคำขอนี้"
    await page.click(".gl-btn-approve");
    await page.waitForSelector("text=อนุมัติรายการเรียบร้อยแล้ว");

    // Verify DB state
    const q_check_app = `SELECT status, approved_by FROM transactions WHERE id = '${TXN_E2E_1}';`;
    const checkAppRes = runRemoteQuery(q_check_app);
    const isDbApproved = checkAppRes.rows?.[0]?.status === "approved" && checkAppRes.rows?.[0]?.approved_by === APPROVER_1;

    recordResult(
      "P2.3-E2E-03",
      "E2E Journey 1 (Approval): Approver approves in browser -> UI shows success -> DB status = approved",
      isDbApproved,
      `Hero Amount: ${heroAmount}, DB Status: ${checkAppRes.rows?.[0]?.status}`
    );

    await page.screenshot({ path: path.join(screenshotsDir, "03_approved_success.png") });

    // ==========================================================================
    // TEST 4: E2E JOURNEY 2 — REQUEST REVISION
    // ==========================================================================
    // Open Txn 2: อุปกรณ์สำนักงานและกระดาษ
    await page.click(`[data-id="${TXN_E2E_2}"]`);
    await page.waitForSelector(".gl-decision-sheet");

    // Click "ขอแก้ไข"
    await page.click(".gl-btn-request-revision");
    await page.waitForSelector(".gl-modal-backdrop");

    // Test validation: enter only 2 chars
    await page.fill("#gl-rejection-reason", "แก");
    const charCountText = await page.locator("#gl-char-count").innerText();
    await page.click(".gl-btn-submit");
    const reasonErrorVisible = await page.locator("#gl-reason-error").isVisible();

    // Now enter valid reason >= 5 chars
    await page.fill("#gl-rejection-reason", "กรุณาแนบใบเสร็จฉบับจริงที่มีตราประทับร้านค้า");
    await page.click(".gl-btn-submit");
    await page.waitForSelector("text=ส่งรายการกลับเพื่อขอให้แก้ไขเรียบร้อยแล้ว");

    // Verify DB state
    const q_check_rev = `
      SELECT t.status, t.rejection_reason, a.action 
      FROM transactions t
      LEFT JOIN audit_logs a ON a.entity_id = t.id AND a.action = 'REVISION_REQUESTED'
      WHERE t.id = '${TXN_E2E_2}';
    `;
    const checkRevRes = runRemoteQuery(q_check_rev);
    const isDbDraft = checkRevRes.rows?.[0]?.status === "draft" && checkRevRes.rows?.[0]?.action === "REVISION_REQUESTED";

    recordResult(
      "P2.3-E2E-04",
      "E2E Journey 2 (Request Revision): Modal validation enforced -> submitted -> DB status = draft + REVISION_REQUESTED audit",
      isDbDraft && reasonErrorVisible,
      `Validation triggered: ${reasonErrorVisible}, DB Status: ${checkRevRes.rows?.[0]?.status}, Reason: ${checkRevRes.rows?.[0]?.rejection_reason}`
    );

    await page.screenshot({ path: path.join(screenshotsDir, "04_revision_requested.png") });

    // ==========================================================================
    // TEST 5: E2E JOURNEY 3 — TERMINAL REJECT
    // ==========================================================================
    // Open Txn 3: จัดซื้อเก้าอี้ห้องประชุมชุดใหม่
    await page.click(`[data-id="${TXN_E2E_3}"]`);
    await page.waitForSelector(".gl-decision-sheet");

    // Click "ปฏิเสธ"
    await page.click(".gl-btn-reject");
    await page.waitForSelector(".gl-modal-backdrop");

    // Enter rejection reason
    await page.fill("#gl-rejection-reason", "รายการนี้ไม่อยู่ในงบประมาณประจำปีที่ได้รับอนุมัติ");
    await page.click(".gl-btn-submit");
    await page.waitForSelector("text=ปฏิเสธคำขอเบิกจ่ายและล็อกรายการถาวรเรียบร้อยแล้ว");

    // Verify DB state
    const q_check_rej = `
      SELECT t.status, t.rejection_reason, a.action 
      FROM transactions t
      LEFT JOIN audit_logs a ON a.entity_id = t.id AND a.action = 'TRANSACTION_REJECTED'
      WHERE t.id = '${TXN_E2E_3}';
    `;
    const checkRejRes = runRemoteQuery(q_check_rej);
    const isDbRejected = checkRejRes.rows?.[0]?.status === "rejected" && checkRejRes.rows?.[0]?.action === "TRANSACTION_REJECTED";

    recordResult(
      "P2.3-E2E-05",
      "E2E Journey 3 (Terminal Reject): Approver confirms rejection -> DB status = rejected + TRANSACTION_REJECTED audit",
      isDbRejected,
      `DB Status: ${checkRejRes.rows?.[0]?.status}, Locked: true, Reason: ${checkRejRes.rows?.[0]?.rejection_reason}`
    );

    await page.screenshot({ path: path.join(screenshotsDir, "05_terminal_rejected.png") });

    // ==========================================================================
    // TEST 6: TWO-PERSON RULE RESTRICTION (Creator Self-Approval Guard)
    // ==========================================================================
    // Open Txn 4: Created by Pastor Somchai himself
    await page.click(`[data-id="${TXN_E2E_SELF}"]`);
    await page.waitForSelector(".gl-decision-sheet");

    const isApproveDisabled = await page.locator(".gl-btn-approve").isDisabled();
    const isTwoPersonWarningVisible = await page.locator("text=หลักการแบ่งแยกหน้าที่").isVisible();

    recordResult(
      "P2.3-E2E-06",
      "Two-Person Rule UI Guard: Approver viewing their own voucher has Approve button disabled with warning banner",
      isApproveDisabled && isTwoPersonWarningVisible,
      `Approve Disabled: ${isApproveDisabled}, Warning Visible: ${isTwoPersonWarningVisible}`
    );

    await page.screenshot({ path: path.join(screenshotsDir, "06_two_person_rule_guard.png") });

    // Close sheet
    await page.click(".gl-sheet-close");

    // ==========================================================================
    // TEST 7: STALE STATE / CONCURRENCY CONFLICT (P0001)
    // ==========================================================================
    // Seed another transaction, approve it directly on DB to make the browser state stale
    const TXN_STALE = "66666666-0000-0000-0000-000000000099";
    const seedStaleSql = `
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claims" = '{"sub": "${CREATOR_ID}", "role": "authenticated"}';
      INSERT INTO transactions (id, church_id, account_id, amount, direction, status, description, created_by, reference_number)
      VALUES ('${TXN_STALE}', '${CHURCH_ID}', '${ACCOUNT_ID}', 500.00, 'expense', 'draft', 'Stale Concurrency Test', '${CREATOR_ID}', 'VCH-2026-099');
      INSERT INTO transaction_splits (transaction_id, church_id, fund_id, category_id, amount, note)
      VALUES ('${TXN_STALE}', '${CHURCH_ID}', '${FUND_GENERAL}', '${CAT_ID}', 500.00, 'Stale test');
      SELECT submit_transaction('${TXN_STALE}');
    `;
    runRemoteQuery(seedStaleSql);

    // Refresh queue so browser loads it
    await page.goto("http://localhost:5173/#/approvals");
    await page.waitForSelector(`[data-id="${TXN_STALE}"]`);

    // Open sheet in browser
    await page.click(`[data-id="${TXN_STALE}"]`);
    await page.waitForSelector(".gl-decision-sheet");

    // Simulate another concurrent approver already approving it in the background
    const bgApproveSql = `
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claims" = '{"sub": "${APPROVER_1}", "role": "authenticated"}';
      SELECT approve_transaction('${TXN_STALE}', 'Concurrent approval from tablet');
    `;
    runRemoteQuery(bgApproveSql);

    // Now user in the browser clicks "อนุมัติคำขอนี้"
    await page.click(".gl-btn-approve");
    await page.waitForSelector("text=รายการนี้ได้รับการพิจารณาแล้ว");

    const staleWarningVisible = await page.locator("text=รายการนี้ได้รับการพิจารณาแล้ว").isVisible();
    recordResult(
      "P2.3-E2E-07",
      "Stale State Protection: Concurrent action on already-approved voucher displays stale banner with refresh CTA",
      staleWarningVisible,
      "Stale warning caught and displayed inline without crash"
    );

    await page.screenshot({ path: path.join(screenshotsDir, "07_stale_state_banner.png") });

    // ==========================================================================
    // TEST 8: RESPONSIVE UX VALIDATION (Mobile Viewport 390x844)
    // ==========================================================================
    const contextMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const pageMobile = await contextMobile.newPage();

    await pageMobile.goto("http://localhost:5173/#/approvals");
    await pageMobile.waitForSelector(".gl-approvals-queue-view");

    // Check horizontal overflow
    const hasHorizontalScroll = await pageMobile.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    await pageMobile.screenshot({ path: path.join(screenshotsDir, "08_mobile_queue.png") });

    recordResult(
      "P2.3-E2E-08",
      "Responsive Mobile UX: Queue view renders without horizontal overflow at 390px",
      !hasHorizontalScroll,
      `Horizontal Overflow: ${hasHorizontalScroll}`
    );

    // ==========================================================================
    // TEST 9: CLIENT BUNDLE SECURITY CHECK
    // ==========================================================================
    const bundleContent = fs.readFileSync("src/lib/supabase/client.ts", "utf8");
    const hasServiceRole = bundleContent.includes("service_role");
    const hasDbPassword = bundleContent.includes("postgres://") || bundleContent.includes("password=");

    recordResult(
      "P2.3-E2E-09",
      "Bundle Security Check: Browser client contains NO service_role or DB credentials",
      !hasServiceRole && !hasDbPassword,
      "Only public anon key is exposed to browser runtime"
    );

    await contextDesktop.close();
    await contextMobile.close();
  } finally {
    await browser.close();
    viteProcess.kill();
  }

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log("\n================================================================================");
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log(`TOTAL BROWSER E2E TESTS: ${passed}/${total} PASSED`);
  console.log("================================================================================");

  if (passed === total) {
    console.log("🎉 ALL M2 PHASE 2.3 BROWSER E2E & UX TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME E2E TESTS FAILED!");
    process.exit(1);
  }
}

runBrowserE2E();
