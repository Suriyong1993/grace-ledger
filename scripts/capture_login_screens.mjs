import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ARTIFACT_DIR = "C:/Users/Administrator/.gemini/antigravity/brain/4db218c9-363c-4da2-9271-bf90ff6ccb5c";
const LOCAL_SCREENSHOTS_DIR = "docs/screenshots/login";

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
fs.mkdirSync(LOCAL_SCREENSHOTS_DIR, { recursive: true });

async function main() {
  console.log("Launching Chromium to capture live login screens...");
  const browser = await chromium.launch({ headless: true });

  // 1. DESKTOP RUN
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    deviceScaleFactor: 2,
  });
  const desktopPage = await desktopContext.newPage();

  console.log("Navigating to http://localhost:5173/ (Desktop)...");
  await desktopPage.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await desktopPage.waitForTimeout(1000);

  // Screen 1: Profile Selection Desktop
  console.log("Capturing Screen 1: Profile Selection (Desktop)...");
  const p1Desktop = path.join(ARTIFACT_DIR, "screen1_profile_select_desktop.png");
  await desktopPage.screenshot({ path: p1Desktop, fullPage: false });
  await desktopPage.screenshot({ path: path.join(LOCAL_SCREENSHOTS_DIR, "screen1_profile_select_desktop.png") });

  // Click on Profile Card to navigate to Screen 2
  console.log("Clicking on Profile card...");
  const profileCard = desktopPage.locator("[data-profile-id]").first();
  await profileCard.click();
  await desktopPage.waitForTimeout(500);

  // Screen 2: PIN Number Pad Desktop
  console.log("Capturing Screen 2: PIN Number Pad (Desktop)...");
  const p2Desktop = path.join(ARTIFACT_DIR, "screen2_pin_pad_desktop.png");
  await desktopPage.screenshot({ path: p2Desktop, fullPage: false });
  await desktopPage.screenshot({ path: path.join(LOCAL_SCREENSHOTS_DIR, "screen2_pin_pad_desktop.png") });

  // Input 4 digits: 1, 2, 3, 4
  console.log("Entering digits 1, 2, 3, 4...");
  await desktopPage.locator('[data-pin-key="1"]').click();
  await desktopPage.waitForTimeout(100);
  await desktopPage.locator('[data-pin-key="2"]').click();
  await desktopPage.waitForTimeout(100);
  await desktopPage.locator('[data-pin-key="3"]').click();
  await desktopPage.waitForTimeout(100);
  await desktopPage.locator('[data-pin-key="4"]').click();
  await desktopPage.waitForTimeout(300);

  // Screen 2: PIN Dots Partially Filled
  console.log("Capturing Screen 2: PIN Dots Filled...");
  const p2Filled = path.join(ARTIFACT_DIR, "screen2_pin_dots_filled.png");
  await desktopPage.screenshot({ path: p2Filled, fullPage: false });

  // Click Clear "ล้าง"
  console.log("Testing Clear button...");
  await desktopPage.locator('[data-pin-action="clear"]').click();
  await desktopPage.waitForTimeout(200);

  // Enter invalid PIN 6 digits: 1, 2, 3, 4, 5, 6
  console.log("Entering invalid 6-digit PIN 123456 to trigger validation status...");
  await desktopPage.locator('[data-pin-key="1"]').click();
  await desktopPage.locator('[data-pin-key="2"]').click();
  await desktopPage.locator('[data-pin-key="3"]').click();
  await desktopPage.locator('[data-pin-key="4"]').click();
  await desktopPage.locator('[data-pin-key="5"]').click();
  await desktopPage.locator('[data-pin-key="6"]').click();
  await desktopPage.waitForTimeout(1200);

  // Screen 2: Invalid PIN Error State
  console.log("Capturing Screen 2: Invalid PIN Error State...");
  const p2Error = path.join(ARTIFACT_DIR, "screen2_pin_invalid_error.png");
  await desktopPage.screenshot({ path: p2Error, fullPage: false });

  await desktopContext.close();

  // 2. MOBILE RUN (iPhone 14 / 390x844)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();

  console.log("Navigating to http://localhost:5173/ (Mobile)...");
  await mobilePage.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(1000);

  // Screen 1: Profile Selection Mobile
  console.log("Capturing Screen 1: Profile Selection (Mobile)...");
  const p1Mobile = path.join(ARTIFACT_DIR, "screen1_profile_select_mobile.png");
  await mobilePage.screenshot({ path: p1Mobile, fullPage: false });
  await mobilePage.screenshot({ path: path.join(LOCAL_SCREENSHOTS_DIR, "screen1_profile_select_mobile.png") });

  // Click on Profile Card on Mobile
  await mobilePage.locator("[data-profile-id]").first().click();
  await mobilePage.waitForTimeout(500);

  // Screen 2: PIN Number Pad Mobile
  console.log("Capturing Screen 2: PIN Number Pad (Mobile)...");
  const p2Mobile = path.join(ARTIFACT_DIR, "screen2_pin_pad_mobile.png");
  await mobilePage.screenshot({ path: p2Mobile, fullPage: false });
  await mobilePage.screenshot({ path: path.join(LOCAL_SCREENSHOTS_DIR, "screen2_pin_pad_mobile.png") });

  await mobileContext.close();
  await browser.close();

  console.log("All screenshots captured successfully!");
}

main().catch(console.error);
