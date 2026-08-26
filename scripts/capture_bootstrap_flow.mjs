import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ARTIFACT_DIR = "C:/Users/Administrator/.gemini/antigravity/brain/4db218c9-363c-4da2-9271-bf90ff6ccb5c";

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

async function main() {
  console.log("Launching Chromium to capture Bootstrap & PIN Setup Flow...");
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:5173/...");
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // Screen 1: Profile Selection with Bootstrap Trigger Link
  console.log("Capturing Profile Selection with Bootstrap Trigger...");
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "screen_bootstrap_trigger.png") });

  // Click on "ต้องการตั้งค่าการเข้าใช้งานครั้งแรกหรือไม่"
  console.log("Clicking Bootstrap Trigger button...");
  await page.locator("#login-trigger-bootstrap").click();
  await page.waitForTimeout(400);

  // Screen 2: Bootstrap Request Modal / Dialog
  console.log("Capturing Bootstrap Request Dialog...");
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "screen_bootstrap_modal.png") });

  // Close Bootstrap modal
  await page.locator("#login-cancel-bootstrap").click();
  await page.waitForTimeout(300);

  // Test PIN Setup Component directly via harness in browser
  console.log("Rendering PinSetupPage in browser...");
  await page.evaluate(async () => {
    const { PinSetupPage } = await import("/src/pages/PinSetupPage.ts");
    const { getSupabaseClient } = await import("/src/lib/supabase/client.ts");
    const supabase = getSupabaseClient();

    const root = document.getElementById("app");
    if (!root) return;

    const setupPage = new PinSetupPage(supabase, {
      name: "พณ.ท่านหม่อมราชวงศ์สุริยงค์ บาลเพ็ชร",
      role: "ผู้ดูแลระบบ",
    });

    root.innerHTML = setupPage.renderHtml();
    setupPage.attachEventListeners(root, () => {
      console.log("Setup completed callback triggered");
    });
  });

  await page.waitForTimeout(500);

  // Screen 3: Pin Setup Step 1 (Enter 6-digit PIN)
  console.log("Capturing Pin Setup Step 1...");
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "screen_setup_step1.png") });

  // Enter weak PIN to test heuristic rejection
  console.log("Testing weak PIN heuristic on Step 1 (e.g. 111111)...");
  await page.locator('[data-pin-key="1"]').click();
  await page.locator('[data-pin-key="1"]').click();
  await page.locator('[data-pin-key="1"]').click();
  await page.locator('[data-pin-key="1"]').click();
  await page.locator('[data-pin-key="1"]').click();
  await page.locator('[data-pin-key="1"]').click();
  await page.waitForTimeout(500);

  console.log("Capturing Weak PIN error state...");
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "screen_setup_weak_error.png") });

  // Enter valid PIN on Step 1 (e.g. 8, 4, 9, 2, 0, 1)
  console.log("Entering acceptable PIN on Step 1...");
  await page.locator('[data-pin-key="8"]').click();
  await page.locator('[data-pin-key="4"]').click();
  await page.locator('[data-pin-key="9"]').click();
  await page.locator('[data-pin-key="2"]').click();
  await page.locator('[data-pin-key="0"]').click();
  await page.locator('[data-pin-key="1"]').click();
  await page.waitForTimeout(500);

  // Screen 4: Pin Setup Step 2 (Confirm 6-digit PIN)
  console.log("Capturing Pin Setup Step 2 (Confirm PIN)...");
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "screen_setup_step2.png") });

  // Re-enter 3 digits in confirm step
  await page.locator('[data-pin-key="8"]').click();
  await page.locator('[data-pin-key="4"]').click();
  await page.locator('[data-pin-key="9"]').click();
  await page.waitForTimeout(300);

  console.log("Capturing Pin Setup Step 2 partially filled...");
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "screen_setup_step2_filled.png") });

  await context.close();
  await browser.close();

  console.log("Bootstrap flow screenshots captured successfully!");
}

main().catch(console.error);
