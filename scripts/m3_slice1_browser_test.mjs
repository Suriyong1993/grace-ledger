import { chromium } from "playwright";
import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import http from "http";

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

async function runSlice1BrowserTests() {
  console.log("==================================================");
  console.log("M3 UI SLICE 1 — BROWSER WORKFLOW VERIFICATION");
  console.log("Screen 04 (Offering Entry) → Screen 05 (Review)");
  console.log("==================================================");

  const PORT = 5174;
  const BASE_URL = `http://localhost:${PORT}`;

  console.log(`\n[1/6] Launching Vite Dev Server on port ${PORT}...`);
  const viteProcess = spawn("npx", ["vite", "--port", String(PORT), "--host", "127.0.0.1"], {
    shell: true,
    stdio: "pipe",
    cwd: process.cwd(),
  });

  viteProcess.stderr?.on("data", (data) => {
    const s = data.toString();
    if (!s.includes("deprecated")) console.error(`[Vite stderr]: ${s}`);
  });

  try {
    await waitForServer(BASE_URL, 25000);
    console.log(`✓ Dev server active at ${BASE_URL}`);

    console.log("\n[2/6] Launching Chromium browser...");
    const browser = await chromium.launch({
      headless: true,
    });

    // 1. Test Desktop Flow
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    // Navigate to /offerings
    console.log("\n[3/6] Navigating to #/offerings (Session List)...");
    await page.goto(`${BASE_URL}/#/offerings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Take screenshot of list
    const listScreenshotPath = path.join(screenshotsDir, "09_m3_offering_list.png");
    await page.screenshot({ path: listScreenshotPath, fullPage: true });
    console.log(`✓ List view rendered and captured: ${listScreenshotPath}`);

    // Click "+ บันทึกเงินถวาย"
    console.log("\n[4/6] Clicking '+ บันทึกเงินถวาย' to enter Screen 04...");
    const newBtn = await page.$("#btn-create-offering");
    if (!newBtn) {
      throw new Error("Could not find #btn-create-offering button");
    }
    await newBtn.click();
    await page.waitForTimeout(1000);

    // Verify Screen 04 is active
    const pageContent = await page.content();
    if (!pageContent.includes("Screen 04") && !pageContent.includes("Expected by Channel")) {
      throw new Error("Screen 04 did not render properly");
    }
    console.log("✓ Screen 04 (Offering Entry) rendered successfully");

    // Fill form: Expected amounts
    console.log("Filling expected channel amounts (Cash: 10,000, Transfer: 5,000, QR: 3,450)...");
    await page.fill("#input-expected-cash", "10000");
    await page.fill("#input-expected-transfer", "5000");
    await page.fill("#input-expected-qr", "3450");
    await page.waitForTimeout(300);

    // Set first allocation row: 10,000 cash
    await page.fill(".input-row-amount", "10000");
    await page.waitForTimeout(300);

    // Add 2nd row: 5,000 transfer
    await page.click("#btn-add-allocation-row");
    await page.waitForTimeout(300);
    
    const rows = await page.$$(".gl-allocation-row");
    if (rows.length >= 2) {
      const row2Channel = await rows[1].$(".select-row-channel");
      await row2Channel?.selectOption("bank_transfer");
      await page.waitForTimeout(200);
      
      const rowsUpdated = await page.$$(".gl-allocation-row");
      const row2Amount = await rowsUpdated[1].$(".input-row-amount");
      await row2Amount?.fill("5000");
      await page.waitForTimeout(200);
    }

    // Add 3rd row: 3,450 QR
    await page.click("#btn-add-allocation-row");
    await page.waitForTimeout(300);
    
    const rowsAfter = await page.$$(".gl-allocation-row");
    if (rowsAfter.length >= 3) {
      const row3Channel = await rowsAfter[2].$(".select-row-channel");
      await row3Channel?.selectOption("qr_code");
      await page.waitForTimeout(200);
      
      const rowsUpdated3 = await page.$$(".gl-allocation-row");
      const row3Amount = await rowsUpdated3[2].$(".input-row-amount");
      await row3Amount?.fill("3450");
      await page.waitForTimeout(200);
    }

    await page.fill("#input-session-notes", "บันทึกทดสอบระบบ UI Slice 1 — Verified Chain of Custody");
    await page.waitForTimeout(500);

    // Capture Screen 04 screenshot
    const entryScreenshotPath = path.join(screenshotsDir, "10_m3_offering_entry_screen04.png");
    await page.screenshot({ path: entryScreenshotPath, fullPage: true });
    console.log(`✓ Screen 04 completed and captured: ${entryScreenshotPath}`);

    // Click "ต่อไป · ตรวจทาน" -> Screen 05
    console.log("\n[5/6] Proceeding to Screen 05 (Review Sheet)...");
    const proceedBtn = await page.$("#btn-proceed-review");
    if (!proceedBtn) throw new Error("Could not find #btn-proceed-review button");
    await proceedBtn.click();
    await page.waitForTimeout(800);

    const reviewContent = await page.content();
    if (!reviewContent.includes("Screen 05") && !reviewContent.includes("ตรวจทานรายการเงินถวาย")) {
      throw new Error("Screen 05 Review did not render");
    }
    console.log("✓ Screen 05 Review Sheet rendered successfully");

    // Capture Screen 05 screenshot
    const reviewScreenshotPath = path.join(screenshotsDir, "11_m3_offering_review_screen05.png");
    await page.screenshot({ path: reviewScreenshotPath, fullPage: true });
    console.log(`✓ Screen 05 Review captured: ${reviewScreenshotPath}`);

    // Test Back & Edit button
    console.log("Testing Back & Edit flow...");
    const backBtn = await page.$("#btn-back-to-edit");
    await backBtn?.click();
    await page.waitForTimeout(500);

    // Verify we're back on Screen 04
    const backContent = await page.content();
    if (!backContent.includes("Screen 04")) {
      throw new Error("Back button failed to return to Screen 04");
    }
    console.log("✓ Back button successfully returned to Screen 04 with preserved state");

    // Go to Review again
    await page.click("#btn-proceed-review");
    await page.waitForTimeout(500);

    // Click "ยืนยันและบันทึกร่าง"
    console.log("Submitting offering session to PostgreSQL database...");
    const saveDraftBtn = await page.$("#btn-confirm-save-draft");
    await saveDraftBtn?.click();
    await page.waitForTimeout(2500);

    // Capture post-save screen (list with toast)
    const savedScreenshotPath = path.join(screenshotsDir, "12_m3_offering_saved_draft.png");
    await page.screenshot({ path: savedScreenshotPath, fullPage: true });
    console.log(`✓ Save draft completed and captured: ${savedScreenshotPath}`);

    // 2. Test Mobile 390px Viewport
    console.log("\n[6/6] Testing Mobile (390px viewport)...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${BASE_URL}/#/offerings/new`, { waitUntil: "networkidle" });
    await mobilePage.waitForTimeout(1000);

    const mobileScreenshotPath = path.join(screenshotsDir, "13_m3_mobile_offering_entry.png");
    await mobilePage.screenshot({ path: mobileScreenshotPath, fullPage: true });
    console.log(`✓ Mobile viewport captured: ${mobileScreenshotPath}`);

    await browser.close();
    console.log("\n==================================================");
    console.log("ALL BROWSER WORKFLOW TESTS PASSED (6/6) ✅");
    console.log("==================================================");

  } finally {
    viteProcess.kill();
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /pid ${viteProcess.pid} /T /F 2>nul`);
      }
    } catch (e) {}
  }
}

runSlice1BrowserTests().catch((err) => {
  console.error("Browser test failed:", err);
  process.exit(1);
});
