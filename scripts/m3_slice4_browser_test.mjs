import { chromium } from "playwright";
import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import http from "http";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://jeklcfpqmytdmwczxqlx.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impla2xjZnBxbXl0ZG13Y3p4cWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NzY0NDUsImV4cCI6MjEwMjU1MjQ0NX0.ZSM88SkzsWhqsD7x8gpyTSguKB2oG51lZqKLGHQETHA";

const supabase = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);
const CHURCH_ID = "66666666-6666-6666-6666-111111111111";

const screenshotsDir = path.resolve("docs/screenshots");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function waitForServer(url, timeoutMs = 25000) {
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
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`Server at ${url} failed to respond within ${timeoutMs}ms`);
}

async function runSlice4BrowserTests() {
  console.log("==================================================");
  console.log("M3 UI SLICE 4 — POST TO FINANCIAL LEDGER E2E");
  console.log("End-to-End Vertical Slice Verification");
  console.log("==================================================");

  // 1. Sign in as Pastor Somchai
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "somchai_pastor@grace.org",
    password: "GracePassword123!",
  });
  if (authError) throw new Error("Auth failed: " + authError.message);

  // 2. Fetch Funds, Categories, and Accounts
  const { data: fundsData } = await supabase
    .from("funds")
    .select("id, name, current_balance")
    .eq("church_id", CHURCH_ID)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (!fundsData || fundsData.length < 2) throw new Error("Need at least 2 active funds for split verification");
  const fund1 = fundsData[0];
  const fund2 = fundsData[1];

  const { data: catData } = await supabase
    .from("categories")
    .select("id")
    .eq("church_id", CHURCH_ID)
    .limit(1);
  const testCatId = catData?.[0]?.id;

  const { data: accountsData } = await supabase
    .from("accounts")
    .select("id, name, account_number, type, current_balance")
    .eq("church_id", CHURCH_ID)
    .eq("is_active", true);

  const cashAccount = accountsData?.find((a) => a.type === "cash_drawer" || a.type === "cash") || accountsData?.[0];
  const bankAccount = accountsData?.find((a) => a.type === "bank") || accountsData?.[1];
  if (!cashAccount || !bankAccount) throw new Error("Need cash and bank accounts");

  const initialCashBalance = parseFloat(cashAccount.current_balance || "0");
  const initialBankBalance = parseFloat(bankAccount.current_balance || "0");
  const initialFund1Balance = parseFloat(fund1.current_balance || "0");
  const initialFund2Balance = parseFloat(fund2.current_balance || "0");

  console.log("Initial Balances before posting:");
  console.log(`- Cash Drawer (${cashAccount.name}): ฿${initialCashBalance.toFixed(2)}`);
  console.log(`- Operating Bank (${bankAccount.name}): ฿${initialBankBalance.toFixed(2)}`);
  console.log(`- Fund 1 (${fund1.name}): ฿${initialFund1Balance.toFixed(2)}`);
  console.log(`- Fund 2 (${fund2.name}): ฿${initialFund2Balance.toFixed(2)}`);

  // 3. Create Multi-Channel Session in DB
  const serviceSuffix = Date.now();
  console.log(`\n[1/7] Creating multi-channel session (Suffix: ${serviceSuffix})...`);
  const itemsPayload = [
    {
      fund_id: fund1.id,
      category_id: testCatId,
      payment_channel: "cash",
      source_type: "envelopes",
      amount: 10000.00,
      notes: "เงินสดสิบลด (Fund 1)",
    },
    {
      fund_id: fund1.id,
      category_id: testCatId,
      payment_channel: "bank_transfer",
      source_type: "electronic_slip",
      amount: 5000.00,
      notes: "เงินโอนธนาคาร (Fund 1)",
    },
    {
      fund_id: fund2.id,
      category_id: testCatId,
      payment_channel: "qr_code",
      source_type: "electronic_slip",
      amount: 3450.00,
      notes: "เงินถวาย QR พันธกิจ (Fund 2)",
    },
  ];

  const { data: sessionData, error: createError } = await supabase.rpc(
    "create_offering_session",
    {
      p_service_date: "2026-08-23",
      p_service_name: `รอบนมัสการโพสต์บัญชี (Slice 4 E2E ${serviceSuffix})`,
      p_items: itemsPayload,
      p_notes: "Offering Session for Full Ledger Posting E2E Verification",
    }
  );

  if (createError) throw new Error("Failed to create offering session: " + createError.message);
  const testSessionId = sessionData;
  console.log(`✓ Session created in DB: ${testSessionId}`);

  const PORT = 5177;
  const BASE_URL = `http://localhost:${PORT}`;

  console.log(`\n[2/7] Launching Vite Dev Server on port ${PORT}...`);
  const viteProcess = spawn("npx", ["vite", "--port", String(PORT), "--host", "127.0.0.1"], {
    shell: true,
    stdio: "pipe",
    cwd: process.cwd(),
  });

  try {
    await waitForServer(BASE_URL, 25000);
    console.log(`✓ Dev server active at ${BASE_URL}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    // 4. Navigate & Count Cash (Zero match: 1,000x10 = 10,000)
    console.log(`\n[3/7] Navigating to Screen 06 & performing dual-custody cash count...`);
    await page.goto(`${BASE_URL}/#/offerings/${testSessionId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const c1Select = await page.$("#select-counter-1");
    const c2Select = await page.$("#select-counter-2");
    const firstVal = await c1Select?.$eval("option:nth-child(2)", (el) => el.value);
    const secondVal = await c2Select?.$eval("option:nth-child(3)", (el) => el.value);
    if (firstVal && secondVal) {
      await page.selectOption("#select-counter-1", firstVal);
      await page.selectOption("#select-counter-2", secondVal);
      await page.waitForTimeout(300);
    }

    const startBtn = await page.$("#btn-start-counting");
    if (startBtn) {
      await startBtn.click();
      await page.waitForTimeout(1000);
    }

    await page.fill("#input-denom-b1000", "10");
    await page.waitForTimeout(400);

    await page.click("#btn-save-cash-count");
    await page.waitForTimeout(1500);

    // 5. Navigate to Screen 07 & Confirm Session
    console.log("\n[4/7] Navigating to Screen 07 & Confirming Session...");
    const goToResBtn = await page.$("#btn-go-to-resolution");
    if (goToResBtn) {
      await goToResBtn.click();
    } else {
      await page.click("#btn-tab-resolution");
    }
    await page.waitForTimeout(1000);

    // Confirm Session
    const confirmBtn = await page.$("#btn-confirm-session");
    if (!confirmBtn) throw new Error("Confirm button not found for zero match session");
    await confirmBtn.click();
    await page.waitForTimeout(2000);

    const confirmedContent = await page.content();
    if (!confirmedContent.includes("พร้อมบันทึกบัญชี (Ready to Post)") && !confirmedContent.includes("การบันทึกลงสมุดบัญชีแยกประเภท")) {
      throw new Error("Screen 08 Post to Ledger section did not appear after confirmation");
    }
    console.log("✓ Session confirmed: Screen 08 Post to Ledger section is active!");

    const postPreviewScreenshot = path.join(screenshotsDir, "23_m3_post_to_ledger_preview.png");
    await page.screenshot({ path: postPreviewScreenshot, fullPage: true });
    console.log(`✓ Post to ledger preview screenshot captured: ${postPreviewScreenshot}`);

    // 6. Execute Post to Ledger from UI
    console.log("\n[5/7] Selecting accounts & clicking 'Post to Ledger'...");
    const cashSelect = await page.$("#select-posting-cash-account");
    if (cashSelect) {
      await page.selectOption("#select-posting-cash-account", cashAccount.id);
    }
    const bankSelect = await page.$("#select-posting-bank-account");
    if (bankSelect) {
      await page.selectOption("#select-posting-bank-account", bankAccount.id);
    }
    await page.waitForTimeout(400);

    await page.click("#btn-post-to-ledger");
    await page.waitForTimeout(2500);

    const postedContent = await page.content();
    if (!postedContent.includes("บันทึกบัญชีสำเร็จ (Posted)") && !postedContent.includes("badge-posted-tx")) {
      throw new Error("UI failed to reflect posted state after Post to Ledger RPC");
    }
    console.log("✓ UI successfully transitioned to Posted state with Transaction Badge!");

    const postedScreenshot = path.join(screenshotsDir, "24_m3_post_to_ledger_success.png");
    await page.screenshot({ path: postedScreenshot, fullPage: true });
    console.log(`✓ Posted success screenshot captured: ${postedScreenshot}`);

    // 7. Verify Financial Reconciliation in Supabase PostgreSQL 17
    console.log("\n[6/7] Reconciling Financial Invariants in PostgreSQL 17...");

    // 7a. Session status and transaction link
    const { data: updatedSession } = await supabase
      .from("offering_sessions")
      .select("status, financial_transaction_id, posted_at, posted_by")
      .eq("id", testSessionId)
      .single();

    if (updatedSession?.status !== "posted" || !updatedSession?.financial_transaction_id) {
      throw new Error("Session in DB not in posted status or missing financial_transaction_id");
    }
    const txId = updatedSession.financial_transaction_id;
    console.log(`✓ DB Offering Session verified: status = 'posted', transaction_id = ${txId}`);

    // 7b. Transaction record
    const { data: txRecord } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", txId)
      .single();

    const expectedTotal = 18450.00;
    if (parseFloat(txRecord?.amount) !== expectedTotal || txRecord?.status !== "posted" || txRecord?.direction !== "income") {
      throw new Error(`Financial transaction mismatch: expected ${expectedTotal}, got ${txRecord?.amount}, status: ${txRecord?.status}`);
    }
    console.log(`✓ Financial Transaction verified: amount = ฿${txRecord.amount}, direction = ${txRecord.direction}, status = ${txRecord.status}`);

    // 7c. Transaction Splits
    const { data: splits } = await supabase
      .from("transaction_splits")
      .select("*")
      .eq("transaction_id", txId);

    const splitSum = (splits || []).reduce((acc, s) => acc + parseFloat(s.amount), 0);
    if (Math.abs(splitSum - expectedTotal) > 0.001) {
      throw new Error(`Split sum mismatch: expected ${expectedTotal}, got ${splitSum}`);
    }
    console.log(`✓ Transaction Splits verified: sum of ${splits?.length} splits = ฿${splitSum.toFixed(2)} (Invariants preserved)`);

    // 7d. Account Balances
    const { data: refreshedAccounts } = await supabase
      .from("accounts")
      .select("id, type, current_balance")
      .in("id", [cashAccount.id, bankAccount.id]);

    const newCash = parseFloat(refreshedAccounts?.find((a) => a.id === cashAccount.id)?.current_balance || "0");
    const newBank = parseFloat(refreshedAccounts?.find((a) => a.id === bankAccount.id)?.current_balance || "0");

    const cashDelta = newCash - initialCashBalance;
    const bankDelta = newBank - initialBankBalance;

    if (Math.abs(cashDelta - 10000.00) > 0.01) {
      throw new Error(`Cash Drawer balance delta incorrect: expected +10,000, got +${cashDelta}`);
    }
    if (Math.abs(bankDelta - 8450.00) > 0.01) {
      throw new Error(`Bank Account balance delta incorrect: expected +8,450, got +${bankDelta}`);
    }
    console.log(`✓ Asset Accounts verified: Cash Drawer +฿${cashDelta.toFixed(2)}, Operating Bank +฿${bankDelta.toFixed(2)}`);

    // 7e. Fund Balances
    const { data: refreshedFunds } = await supabase
      .from("funds")
      .select("id, current_balance")
      .in("id", [fund1.id, fund2.id]);

    const newFund1 = parseFloat(refreshedFunds?.find((f) => f.id === fund1.id)?.current_balance || "0");
    const newFund2 = parseFloat(refreshedFunds?.find((f) => f.id === fund2.id)?.current_balance || "0");

    const fund1Delta = newFund1 - initialFund1Balance;
    const fund2Delta = newFund2 - initialFund2Balance;

    if (Math.abs(fund1Delta - 15000.00) > 0.01) {
      throw new Error(`Fund 1 balance delta incorrect: expected +15,000 (10k cash + 5k transfer), got +${fund1Delta}`);
    }
    if (Math.abs(fund2Delta - 3450.00) > 0.01) {
      throw new Error(`Fund 2 balance delta incorrect: expected +3,450 (3.45k qr), got +${fund2Delta}`);
    }
    console.log(`✓ Fund Balances verified: Fund 1 +฿${fund1Delta.toFixed(2)}, Fund 2 +฿${fund2Delta.toFixed(2)}`);

    // 7f. Idempotency Check (Calling RPC second time)
    console.log("\n[7/7] Verifying Idempotency & Canonical Audit Logs...");
    const { data: secondPostResult, error: secondPostError } = await supabase.rpc(
      "post_offering_to_ledger",
      {
        p_session_id: testSessionId,
        p_cash_account_id: cashAccount.id,
        p_bank_account_id: bankAccount.id,
      }
    );

    if (secondPostError) throw new Error("Idempotency RPC call failed: " + secondPostError.message);
    if (!secondPostResult?.already_posted || secondPostResult?.transaction_id !== txId) {
      throw new Error("Idempotency failed: second post did not return existing transaction ID safely");
    }
    console.log(`✓ Idempotency verified: repeated post call safely returned canonical transaction ${secondPostResult.transaction_id} with already_posted = true`);

    // 7g. Audit logs check
    const { data: auditEvents } = await supabase
      .from("audit_logs")
      .select("action, created_at, metadata")
      .eq("entity_id", testSessionId)
      .eq("action", "OFFERING_POSTED");

    if (!auditEvents || auditEvents.length === 0) {
      throw new Error("Missing OFFERING_POSTED audit event");
    }
    console.log(`✓ Canonical OFFERING_POSTED audit event verified in PostgreSQL!`);

    // 8. Reload Recovery
    console.log("Testing Browser Reload Recovery...");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const reloadedContent = await page.content();
    if (!reloadedContent.includes("Posted") || !reloadedContent.includes("badge-posted-tx")) {
      throw new Error("Reload recovery failed: posted status not restored after page refresh");
    }
    console.log("✓ Reload Recovery SUCCESS: Posted state & TX badge restored from Supabase");

    // 9. Mobile Viewport (390px)
    console.log("Testing Mobile Viewport (390px)...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${BASE_URL}/#/offerings/${testSessionId}`, { waitUntil: "networkidle" });
    await mobilePage.waitForTimeout(1200);

    const mobileScreenshot = path.join(screenshotsDir, "25_m3_mobile_posted_state.png");
    await mobilePage.screenshot({ path: mobileScreenshot, fullPage: true });
    console.log(`✓ Mobile viewport captured: ${mobileScreenshot}`);

    await browser.close();
    console.log("\n==================================================");
    console.log("ALL SLICE 4 BROWSER & DB POSTING TESTS PASSED (7/7) ✅");
    console.log("==================================================");
    process.exit(0);

  } finally {
    viteProcess.kill();
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /pid ${viteProcess.pid} /T /F 2>nul`);
      }
    } catch (e) {}
  }
}

runSlice4BrowserTests().catch((err) => {
  console.error("Slice 4 Browser Test Failed:", err);
  process.exit(1);
});
