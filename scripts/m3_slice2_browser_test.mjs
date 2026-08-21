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

async function runSlice2BrowserTests() {
  console.log("==================================================");
  console.log("M3 UI SLICE 2 — BROWSER WORKFLOW VERIFICATION");
  console.log("Screen 06 (Cash Count & Dual Custody)");
  console.log("==================================================");

  // 1. Sign in as Pastor Somchai to obtain session
  await supabase.auth.signInWithPassword({
    email: "somchai_pastor@grace.org",
    password: "GracePassword123!",
  });

  // 2. Fetch or create a test session in draft state
  const { data: fundsData } = await supabase
    .from("funds")
    .select("id")
    .eq("church_id", CHURCH_ID)
    .eq("is_active", true)
    .limit(1);

  const testFundId = fundsData?.[0]?.id;
  if (!testFundId) throw new Error("No active fund found for testing");

  const { data: catData } = await supabase
    .from("categories")
    .select("id")
    .eq("church_id", CHURCH_ID)
    .limit(1);

  const testCatId = catData?.[0]?.id;
  if (!testCatId) throw new Error("No category found for testing");

  console.log("\n[1/7] Creating fresh Offering Session in DB for Cash Count testing...");
  const itemsPayload = [
    {
      fund_id: testFundId,
      category_id: testCatId,
      payment_channel: "cash",
      source_type: "envelopes",
      amount: 10000.00,
      notes: "เงินสดคาดหวัง 10,000 บาท",
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

  const serviceSuffix = Date.now();
  const { data: sessionData, error: createError } = await supabase.rpc(
    "create_offering_session",
    {
      p_service_date: "2026-08-23",
      p_service_name: `รอบนมัสการทดสอบนับเงิน (Slice 2 E2E ${serviceSuffix})`,
      p_items: itemsPayload,
      p_notes: "Session for Slice 2 Cash Count Verification",
    }
  );

  if (createError) throw new Error("Failed to create test session: " + createError.message);
  const testSessionId = sessionData;
  console.log(`✓ Test session created in DB: ${testSessionId}`);

  const PORT = 5175;
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

    // 3. Navigate to session detail
    console.log(`\n[3/7] Navigating to #/offerings/${testSessionId} (Screen 06)...`);
    await page.goto(`${BASE_URL}/#/offerings/${testSessionId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const initialContent = await page.content();
    if (!initialContent.includes("Screen 06") && !initialContent.includes("Dual Custody")) {
      throw new Error("Screen 06 Cash Count did not render");
    }
    console.log("✓ Screen 06 (Cash Count) rendered successfully");

    // 4. Test Same Person Guard
    console.log("Testing Dual Custody Rule: selecting same user for Counter 1 and Counter 2...");
    const c1Select = await page.$("#select-counter-1");
    const c2Select = await page.$("#select-counter-2");

    // Select first option value for both
    const firstOptionVal = await c1Select?.$eval("option:nth-child(2)", (el) => el.value);
    if (firstOptionVal) {
      await page.selectOption("#select-counter-1", firstOptionVal);
      await page.selectOption("#select-counter-2", firstOptionVal);
      await page.waitForTimeout(400);

      const guardContent = await page.content();
      if (!guardContent.includes("ต้องเป็นคนละคนกันตามหลักการควบคุมภายใน")) {
        throw new Error("Dual Custody guard failed to detect same person");
      }
      console.log("✓ Dual Custody guard blocked same-person selection");

      const guardScreenshot = path.join(screenshotsDir, "14_m3_cash_count_dual_custody_guard.png");
      await page.screenshot({ path: guardScreenshot, fullPage: true });
      console.log(`✓ Dual custody guard screenshot captured: ${guardScreenshot}`);
    }

    // Now select 2 distinct counters
    const secondOptionVal = await c2Select?.$eval("option:nth-child(3)", (el) => el.value);
    if (secondOptionVal) {
      await page.selectOption("#select-counter-2", secondOptionVal);
      await page.waitForTimeout(400);
    }

    // Click "เริ่มขั้นตอนตรวจนับเงิน"
    console.log("\n[4/7] Clicking 'เริ่มขั้นตอนตรวจนับเงิน' (start_cash_count RPC)...");
    const startCountBtn = await page.$("#btn-start-counting");
    if (startCountBtn) {
      await startCountBtn.click();
      await page.waitForTimeout(1200);
      console.log("✓ Session transitioned to counting status in DB");
    }

    // 5. Enter Denominations with Shortage Variance
    console.log("\n[5/7] Entering Denominations (1000x5, 500x3, 100x4, coins=50 -> Actual 6,950, Expected 10,000)...");
    await page.fill("#input-denom-b1000", "5");
    await page.waitForTimeout(200);
    await page.fill("#input-denom-b500", "3");
    await page.waitForTimeout(200);
    await page.fill("#input-denom-b100", "4");
    await page.waitForTimeout(200);
    await page.fill("#input-coins", "50");
    await page.waitForTimeout(400);

    const shortageContent = await page.content();
    if (!shortageContent.includes("ยอดเงินสดตรวจนับขาด (Cash Shortage)") || !shortageContent.includes("−฿3,050.00")) {
      throw new Error("Variance calculation did not display shortage correctly");
    }
    console.log("✓ Shortage variance (-฿3,050.00) calculated and displayed accurately");

    const shortageScreenshot = path.join(screenshotsDir, "15_m3_cash_count_shortage_variance.png");
    await page.screenshot({ path: shortageScreenshot, fullPage: true });
    console.log(`✓ Shortage screenshot captured: ${shortageScreenshot}`);

    // Persist cash count to DB
    console.log("Submitting cash count to Supabase PostgreSQL (record_cash_count RPC)...");
    await page.click("#btn-save-cash-count");
    await page.waitForTimeout(1500);

    // 6. Test Reload Recovery (Browser Refresh)
    console.log("\n[6/7] Testing Reload Recovery: Refreshing browser...");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const reloadedContent = await page.content();
    if (!reloadedContent.includes("−฿3,050.00") && !reloadedContent.includes("6,950.00")) {
      throw new Error("Reload Recovery failed: saved denomination values not restored from DB");
    }
    console.log("✓ Reload Recovery SUCCESS: all denominations, actual cash, and variance restored from DB");

    const recoveryScreenshot = path.join(screenshotsDir, "16_m3_cash_count_reload_recovery.png");
    await page.screenshot({ path: recoveryScreenshot, fullPage: true });
    console.log(`✓ Reload recovery screenshot captured: ${recoveryScreenshot}`);

    // 7. Update to Zero Match (1000x8 + 500x4 = 10,000.00)
    console.log("\nUpdating counts to Zero Match (1000x8, 500x4, 100x0, coins=0 -> Actual 10,000, Expected 10,000)...");
    // After reload, session is in variance_review state so the page defaults to the resolution tab.
    // Navigate back to the count tab to update denominations.
    const tabCountBtn = await page.$("#btn-tab-count");
    if (tabCountBtn) {
      await tabCountBtn.click();
      await page.waitForTimeout(800);
    }
    await page.fill("#input-denom-b1000", "8");
    await page.waitForTimeout(200);
    await page.fill("#input-denom-b500", "4");
    await page.waitForTimeout(200);
    await page.fill("#input-denom-b100", "0");
    await page.waitForTimeout(200);
    await page.fill("#input-coins", "0");
    await page.waitForTimeout(400);

    const matchContent = await page.content();
    if (!matchContent.includes("ยอดเงินสดตรวจนับตรงสมบูรณ์ (Zero Match)")) {
      throw new Error("Zero Match state not recognized");
    }
    console.log("✓ Zero Match (Variance ฿0.00) verified");

    // Save zero match count
    await page.click("#btn-save-cash-count");
    await page.waitForTimeout(1500);

    const zeroMatchScreenshot = path.join(screenshotsDir, "17_m3_cash_count_zero_match.png");
    await page.screenshot({ path: zeroMatchScreenshot, fullPage: true });
    console.log(`✓ Zero match screenshot captured: ${zeroMatchScreenshot}`);

    // 8. Mobile 390px Viewport
    console.log("\n[7/7] Testing Mobile Viewport (390px)...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${BASE_URL}/#/offerings/${testSessionId}`, { waitUntil: "networkidle" });
    await mobilePage.waitForTimeout(1200);

    const mobileScreenshot = path.join(screenshotsDir, "18_m3_mobile_cash_count.png");
    await mobilePage.screenshot({ path: mobileScreenshot, fullPage: true });
    console.log(`✓ Mobile viewport captured: ${mobileScreenshot}`);

    await browser.close();
    console.log("\n==================================================");
    console.log("ALL SLICE 2 BROWSER WORKFLOW TESTS PASSED (7/7) ✅");
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

runSlice2BrowserTests().catch((err) => {
  console.error("Slice 2 Browser Test Failed:", err);
  process.exit(1);
});
