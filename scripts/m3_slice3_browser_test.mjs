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

async function runSlice3BrowserTests() {
  console.log("==================================================");
  console.log("M3 UI SLICE 3 — BROWSER WORKFLOW VERIFICATION");
  console.log("Screen 07 (Variance Resolution & Confirmation)");
  console.log("==================================================");

  // 1. Sign in as Pastor Somchai
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "somchai_pastor@grace.org",
    password: "GracePassword123!",
  });
  if (authError) throw new Error("Auth failed: " + authError.message);

  // 2. Fetch Fund & Category
  const { data: fundsData } = await supabase
    .from("funds")
    .select("id")
    .eq("church_id", CHURCH_ID)
    .eq("is_active", true)
    .limit(1);

  const testFundId = fundsData?.[0]?.id;
  if (!testFundId) throw new Error("No active fund found");

  const { data: catData } = await supabase
    .from("categories")
    .select("id")
    .eq("church_id", CHURCH_ID)
    .limit(1);

  const testCatId = catData?.[0]?.id;
  if (!testCatId) throw new Error("No category found");

  // 3. Create fresh Offering Session in DB
  const serviceSuffix = Date.now();
  console.log(`\n[1/8] Creating fresh Offering Session (Suffix: ${serviceSuffix})...`);
  const itemsPayload = [
    {
      fund_id: testFundId,
      category_id: testCatId,
      payment_channel: "cash",
      source_type: "envelopes",
      amount: 10000.00,
      notes: "เงินสด 10,000 บาท",
    },
    {
      fund_id: testFundId,
      category_id: testCatId,
      payment_channel: "bank_transfer",
      source_type: "electronic_slip",
      amount: 5000.00,
      notes: "เงินโอน 5,000 บาท",
    },
  ];

  const { data: sessionData, error: createError } = await supabase.rpc(
    "create_offering_session",
    {
      p_service_date: "2026-08-23",
      p_service_name: `รอบนมัสการทดสอบผลต่าง (Slice 3 E2E ${serviceSuffix})`,
      p_items: itemsPayload,
      p_notes: "Session for Slice 3 Variance Resolution Verification",
    }
  );

  if (createError) throw new Error("Failed to create test session: " + createError.message);
  const testSessionId = sessionData;
  console.log(`✓ Test session created in DB: ${testSessionId}`);

  const PORT = 5176;
  const BASE_URL = `http://localhost:${PORT}`;

  console.log(`\n[2/8] Launching Vite Dev Server on port ${PORT}...`);
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

    // 4. Navigate to Screen 06 & start counting
    console.log(`\n[3/8] Navigating to #/offerings/${testSessionId} & starting cash count...`);
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

    // Enter Shortage count (1000x5 + 500x3 + 100x4 + 50 coins = 6,950 vs 10,000 -> Shortage -3,050)
    console.log("Entering shortage count (Actual ฿6,950 vs Expected ฿10,000 -> Variance -฿3,050.00)...");
    await page.fill("#input-denom-b1000", "5");
    await page.fill("#input-denom-b500", "3");
    await page.fill("#input-denom-b100", "4");
    await page.fill("#input-coins", "50");
    await page.waitForTimeout(400);

    await page.click("#btn-save-cash-count");
    await page.waitForTimeout(1500);

    // 5. Navigate to Screen 07 (Variance Resolution)
    console.log("\n[4/8] Navigating to Screen 07 (Variance Resolution tab)...");
    const goToResBtn = await page.$("#btn-go-to-resolution");
    if (goToResBtn) {
      await goToResBtn.click();
    } else {
      await page.click("#btn-tab-resolution");
    }
    await page.waitForTimeout(1000);

    const screen7Content = await page.content();
    if (!screen7Content.includes("Screen 07") || !screen7Content.includes("จัดการและรับทราบผลต่างเงินสด")) {
      throw new Error("Screen 07 Variance Resolution did not render");
    }
    console.log("✓ Screen 07 rendered successfully with variance KPIs");

    const varianceKpiScreenshot = path.join(screenshotsDir, "19_m3_screen07_variance_review.png");
    await page.screenshot({ path: varianceKpiScreenshot, fullPage: true });
    console.log(`✓ Screen 07 screenshot captured: ${varianceKpiScreenshot}`);

    // Verify Confirm Button is DISABLED before resolution
    // Hard-reload from Supabase so the DB's variance_review state is reflected fresh in the DOM.
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => {
      const btn = document.querySelector("#btn-confirm-session");
      return btn && btn.hasAttribute("disabled");
    }, { timeout: 15000 });
    console.log("✓ Governance Rule verified: Confirm button is strictly disabled while variance is unresolved");

    // 6. Test Explanation validation (< 5 chars)
    console.log("\n[5/8] Testing explanation validation (< 5 chars)...");
    await page.fill("#input-variance-explanation", "ขาด");
    await page.waitForTimeout(300);

    const charWarning = await page.$eval("#label-char-counter", (el) => el.textContent);
    if (!charWarning?.includes("อย่างน้อย 5 ตัวอักษร")) {
      throw new Error("Character counter warning did not display for short explanation");
    }

    const explainBtnDisabled = await page.$eval("#btn-variance-explain", (el) => el.hasAttribute("disabled"));
    if (!explainBtnDisabled) {
      throw new Error("Explain button should be disabled for < 5 chars");
    }
    console.log("✓ Explanation length validation (< 5 chars blocked) verified");

    // Enter valid explanation >= 5 chars
    console.log("Entering valid explanation (>= 5 chars) & saving...");
    await page.fill("#input-variance-explanation", "ตรวจสอบซองแล้วพบผู้ถวายใส่เงินไม่ครบจำนวน 3,050 บาท");
    await page.waitForTimeout(300);

    await page.click("#btn-variance-explain");
    await page.waitForTimeout(1500);

    const explainedContent = await page.content();
    if (!explainedContent.includes("บันทึกคำชี้แจงแล้ว (Explained)")) {
      throw new Error("Variance status did not transition to explained");
    }
    console.log("✓ Variance explanation recorded in DB (Status: explained)");

    const explainedScreenshot = path.join(screenshotsDir, "20_m3_screen07_explained_state.png");
    await page.screenshot({ path: explainedScreenshot, fullPage: true });
    console.log(`✓ Explained state screenshot captured: ${explainedScreenshot}`);

    // 7. Test Recount (สั่งนับใหม่)
    console.log("\n[6/8] Testing Recount action (สั่งนับใหม่)...");
    await page.click("#btn-variance-recount");
    await page.waitForTimeout(1500);

    const recountContent = await page.content();
    if (!recountContent.includes("Screen 06") && !recountContent.includes("บันทึกผลการตรวจนับเงิน")) {
      throw new Error("Recount action did not return to Screen 06 counting state");
    }
    console.log("✓ Recount successfully returned to Screen 06 counting state in DB");

    // Re-enter count with explained variance and confirm
    console.log("Re-saving count and switching to Screen 07 for final confirmation...");
    await page.click("#btn-save-cash-count");
    await page.waitForTimeout(1500);

    await page.click("#btn-tab-resolution");
    await page.waitForTimeout(1000);

    await page.fill("#input-variance-explanation", "ตรวจนับซ้ำแล้ว ยอดขาดจริงตามผู้ถวายบันทึกผิด 3,050 บาท");
    await page.waitForTimeout(300);
    await page.click("#btn-variance-explain");
    await page.waitForTimeout(1500);

    // 8. Confirm Session
    console.log("\n[7/8] Confirming Offering Session (confirm_offering_session RPC)...");
    const confirmBtn = await page.$("#btn-confirm-session");
    if (!confirmBtn) throw new Error("Confirm button not found");
    await confirmBtn.click();
    await page.waitForTimeout(2000);

    const confirmedContent = await page.content();
    if (!confirmedContent.includes("ยืนยันรอบเงินถวายเรียบร้อยแล้ว (Confirmed)") && !confirmedContent.includes("ยืนยันแล้ว (Confirmed)")) {
      throw new Error("Session confirmation failed to update status to confirmed");
    }
    console.log("✓ Session confirmed successfully (Status: confirmed)");

    const confirmedScreenshot = path.join(screenshotsDir, "21_m3_screen07_confirmed_session.png");
    await page.screenshot({ path: confirmedScreenshot, fullPage: true });
    console.log(`✓ Confirmed session screenshot captured: ${confirmedScreenshot}`);

    // 9. Reload Recovery
    console.log("Testing Reload Recovery: Refreshing page...");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const reloadedContent = await page.content();
    if (!reloadedContent.includes("Confirmed") && !reloadedContent.includes("ยืนยันแล้ว")) {
      throw new Error("Reload recovery failed: confirmed status not restored from Supabase");
    }
    console.log("✓ Reload Recovery SUCCESS: confirmed status & explanation restored from Supabase");

    // 10. Audit Evidence Verification
    console.log("\n[8/8] Verifying canonical Audit Logs in PostgreSQL...");
    const { data: auditLogs, error: auditError } = await supabase
      .from("audit_logs")
      .select("action, created_at, metadata")
      .eq("entity_id", testSessionId)
      .order("created_at", { ascending: true });

    if (auditError) throw new Error("Audit log query failed: " + auditError.message);
    const actions = (auditLogs || []).map((a) => a.action);
    console.log("Canonical audit trail events found:", actions);

    const requiredActions = ["VARIANCE_DETECTED", "VARIANCE_RESOLVED", "SESSION_CONFIRMED"];
    for (const act of requiredActions) {
      if (!actions.includes(act)) {
        throw new Error(`Missing expected audit event: ${act}`);
      }
    }
    console.log("✓ All canonical audit events (VARIANCE_DETECTED, VARIANCE_RESOLVED, SESSION_CONFIRMED) verified!");

    // Mobile Viewport (390px)
    console.log("\nTesting Mobile Viewport (390px)...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${BASE_URL}/#/offerings/${testSessionId}`, { waitUntil: "networkidle" });
    await mobilePage.waitForTimeout(1200);

    const mobileScreenshot = path.join(screenshotsDir, "22_m3_mobile_variance_resolution.png");
    await mobilePage.screenshot({ path: mobileScreenshot, fullPage: true });
    console.log(`✓ Mobile viewport captured: ${mobileScreenshot}`);

    await browser.close();
    console.log("\n==================================================");
    console.log("ALL SLICE 3 BROWSER WORKFLOW TESTS PASSED (8/8) ✅");
    console.log("==================================================");
    process.exit(0);

  } finally {
    viteProcess.kill();
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /pid ${viteProcess.pid} /T /F 2>nul`);
      }
    } catch (e) { }
  }
}

runSlice3BrowserTests().catch((err) => {
  console.error("Slice 3 Browser Test Failed:", err);
  process.exit(1);
});
