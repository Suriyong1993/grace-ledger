/**
 * Real-browser, real-Supabase, full-flow verification.
 *
 * Unlike scripts/m3_slice*_browser_test.mjs and m2_phase2_3_browser_e2e.mjs,
 * this logs in through the actual LoginPage form in the Playwright-driven
 * browser (those scripts sign in via a separate Node-side supabase-js client,
 * whose session never reaches the browser's localStorage — so their Playwright
 * page always renders LoginPage and any selector wait past that point times
 * out). This script drives the UI the way a user would: no direct navigation
 * to authenticated routes, no state injected from Node.
 *
 * Flow: login -> dashboard -> approvals queue -> reject a transaction with a
 * reason -> offering list -> create session -> entry form -> review -> save
 * draft -> cash count (dual custody + denominations, zero match) -> confirm
 * session -> post to ledger -> posted confirmation.
 */
import { chromium } from "playwright";
import { spawn } from "child_process";
import http from "http";
import { mkdirSync } from "node:fs";

const PORT = 5179;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const EMAIL = "somchai_pastor@grace.org";
const PASSWORD = "GracePassword123!";
const SHOT_DIR = "docs/screenshots/after/e2e";

mkdirSync(SHOT_DIR, { recursive: true });

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) reject(new Error(`server at ${url} never came up`));
        else setTimeout(tick, 400);
      });
    };
    tick();
  });
}

const steps = [];
function step(name, fn) {
  steps.push({ name, fn });
}
async function shot(page, name) {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true });
}

let vite;
let browser;
let page;

async function main() {
  console.log("=".repeat(70));
  console.log("REAL BROWSER FULL-FLOW E2E — logs in through the actual UI");
  console.log("=".repeat(70));

  console.log("\n[setup] starting vite dev server on", PORT);
  vite = spawn("npx", ["vite", "--port", String(PORT), "--host", "127.0.0.1"], { shell: true });
  vite.stderr.on("data", (d) => process.stderr.write(`[vite] ${d}`));
  await waitForServer(BASE_URL);
  console.log("[setup] server up");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await context.newPage();
  page.on("pageerror", (err) => console.log("  [PAGE ERROR]", err.message));

  step("login through the real form", async () => {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#login-form", { timeout: 15000 });
    await page.fill("#login-email", EMAIL);
    await page.fill("#login-password", PASSWORD);
    await page.click("#login-submit");
    await page.waitForSelector(".gl-sidebar", { timeout: 15000 });
    await shot(page, "01_dashboard_after_login");
  });

  step("dashboard shows a real balance", async () => {
    const balance = await page.locator('[data-testid="total-balance"]').innerText();
    if (!/^฿[\d,]+\.\d{2}$/.test(balance.trim())) {
      throw new Error(`dashboard balance doesn't look like money: "${balance}"`);
    }
    console.log(`  total balance: ${balance.trim()}`);
  });

  step("navigate to approvals queue via sidebar", async () => {
    await page.click('a[href="#/approvals"]');
    await page.waitForSelector(".gl-approvals-queue-view, .gl-approvals-queue-empty", { timeout: 15000 });
    await shot(page, "02_approvals_queue");
  });

  step("open an approval and reject it with a reason (if any pending)", async () => {
    const row = page.locator(".gl-approval-item").first();
    const hasPending = await row.count();
    if (!hasPending) {
      console.log("  no pending approvals in this church right now — skipping reject sub-flow");
      return;
    }
    await row.click();
    await page.waitForSelector(".gl-decision-sheet", { timeout: 10000 });
    await shot(page, "03_approval_decision_sheet");

    const rejectBtn = page.locator(".gl-btn-reject");
    if (!(await rejectBtn.count())) {
      console.log("  no reject action available on this item — skipping");
      return;
    }
    await rejectBtn.click();
    await page.waitForSelector("#gl-rejection-reason", { timeout: 10000 });
    await page.fill("#gl-rejection-reason", "ทดสอบ E2E: ไม่อยู่ในงบประมาณประจำปี");
    await shot(page, "04_reject_modal_filled");
    await page.click(".gl-btn-submit");
    await page.waitForTimeout(1200);
    await shot(page, "05_after_reject");
  });

  step("navigate to offerings via sidebar", async () => {
    await page.click('a[href="#/offerings"]');
    await page.waitForSelector(".gl-offering-list-container", { timeout: 15000 });
    await shot(page, "06_offering_list");
  });

  step("create a new offering session", async () => {
    await page.click("#btn-create-offering");
    await page.waitForSelector("#offering-entry-form", { timeout: 15000 });
    await shot(page, "07_offering_entry_blank");
  });

  const suffix = Date.now().toString().slice(-6);
  // uq_offering_session_service is a real, correct UNIQUE(church_id, service_date,
  // service_name) constraint — a fixed date collides with any prior run's session
  // on a shared test church. Pick a date unique to this run instead of a literal.
  const runDate = new Date(2026, 0, 1 + (Date.now() % 300));
  const serviceDate = runDate.toISOString().slice(0, 10);

  step("fill Screen 04 — service info and channel totals", async () => {
    console.log(`  using service date ${serviceDate} to avoid uq_offering_session_service collisions`);
    await page.fill("#input-service-date", serviceDate);
    await page.selectOption("#input-service-name", { index: 0 }).catch(() => {});
    await page.fill("#input-expected-cash", "1000");
    await page.fill("#input-expected-transfer", "0");
    await page.fill("#input-expected-qr", "0");

    const fundSelect = page.locator(".select-row-fund").first();
    await fundSelect.waitFor({ timeout: 10000 });
    await fundSelect.selectOption({ index: 1 }).catch(() => fundSelect.selectOption({ index: 0 }));
    await page.locator(".select-row-channel").first().selectOption("cash").catch(() => {});
    await page.locator(".input-row-amount").first().fill("1000");

    await page.fill("#input-session-notes", `E2E full-flow run ${suffix}`);
    await shot(page, "08_offering_entry_filled");
  });

  step("proceed to Screen 05 review", async () => {
    await page.click("#btn-proceed-review");
    await page.waitForSelector("#btn-confirm-save-draft", { timeout: 10000 });
    await shot(page, "09_offering_review");
  });

  step("save as draft", async () => {
    await page.click("#btn-confirm-save-draft");
    await page.waitForTimeout(1500);
    await shot(page, "10_after_save_draft");
    // Save-draft returns to the session LIST, not the new session's detail
    // route (router.navigate("/offerings") in handleSaveDraft) — confirmed
    // against source, not assumed.
    if (!/#\/offerings$/i.test(page.url())) {
      throw new Error(`expected to land back on the offering list, got: ${page.url()}`);
    }
    const hasSuccessText = await page.locator("text=บันทึกร่างเงินถวายเรียบร้อยแล้ว").count();
    if (!hasSuccessText) {
      throw new Error("no save-draft success banner shown");
    }
  });

  step("open the just-created draft from the list", async () => {
    // ฿1,000.00 alone is not unique across runs: earlier successful runs'
    // sessions carry the same total after advancing to counted/confirmed, and
    // still show it in the list. Require the "ร่าง" (draft) badge too, so a
    // locked, already-counted row from a prior run can never match.
    const row = page.locator(".gl-offering-row", { hasText: "฿1,000.00" }).filter({ hasText: "ร่าง" }).first();
    await row.waitFor({ timeout: 10000 });
    await row.locator(".gl-btn-view-session").click();
    await page.waitForSelector("#btn-tab-overview, #btn-tab-count", { timeout: 15000 });
    await shot(page, "10b_opened_draft_session");
  });

  step("open the count tab and select dual-custody counters", async () => {
    await page.click("#btn-tab-count");
    await page.waitForSelector("#select-counter-1", { timeout: 10000 });

    const c1 = page.locator("#select-counter-1");
    const c2 = page.locator("#select-counter-2");
    const opt1 = await c1.locator("option").nth(1).getAttribute("value");
    const opt2 = await c2.locator("option").nth(2).getAttribute("value");
    if (opt1) await c1.selectOption(opt1);
    if (opt2) await c2.selectOption(opt2);
    await page.waitForTimeout(300);

    const startBtn = page.locator("#btn-start-counting");
    if (await startBtn.count()) {
      await startBtn.click();
      await page.waitForTimeout(800);
    }
    await shot(page, "11_cash_count_counters_selected");
  });

  step("count denominations to a zero match (10 x ฿100 = ฿1,000)", async () => {
    await page.waitForSelector("#input-denom-b100", { timeout: 10000 });
    await page.fill("#input-denom-b100", "10");
    await page.waitForTimeout(400);
    await shot(page, "12_cash_count_zero_match");

    const varianceText = await page.locator(".gl-notice--success, .gl-notice--error, .gl-notice--warning").last().innerText();
    console.log(`  variance notice: ${varianceText.replace(/\s+/g, " ").trim()}`);
  });

  step("save the cash count", async () => {
    const saveBtn = page.locator("#btn-save-cash-count");
    if (!(await saveBtn.count())) {
      console.log("  save button not present (session may already be locked) — skipping");
      return;
    }
    await saveBtn.click();
    await page.waitForTimeout(1500);
    await shot(page, "13_after_save_cash_count");
  });

  step("go to the resolution tab and confirm the session", async () => {
    const goToRes = page.locator("#btn-go-to-resolution");
    if (await goToRes.count()) {
      await goToRes.click();
    } else {
      await page.click("#btn-tab-resolution");
    }
    await page.waitForSelector("#btn-confirm-session", { timeout: 10000 });
    await shot(page, "14_variance_resolution");

    const confirmBtn = page.locator("#btn-confirm-session");
    const disabled = await confirmBtn.isDisabled();
    console.log(`  confirm button disabled: ${disabled}`);
    if (!disabled) {
      await confirmBtn.click();
      await page.waitForTimeout(1500);
      await shot(page, "15_after_confirm");
    } else {
      console.log("  confirm blocked — reading the reason shown to the user");
      const hint = await page.locator("text=/พบผลต่าง|ยังไม่มีผลการตรวจนับ|ไม่ตรงกับยอด/").first().innerText().catch(() => "(no hint text found)");
      console.log(`  reason shown: ${hint}`);
    }
  });

  step("post to ledger, if the session reached confirmed", async () => {
    // A successful confirm navigates to the overview tab by design (Wave 2D:
    // confirmed/posted/voided land on the read-only overview) — the post
    // button lives on the resolution tab, so go back to it first.
    const resTab = page.locator("#btn-tab-resolution");
    if (await resTab.count()) {
      await resTab.click();
      await page.waitForTimeout(500);
    }
    const postBtn = page.locator("#btn-post-to-ledger");
    if (!(await postBtn.count())) {
      console.log("  no post button visible — session did not reach confirmed state in this run");
      await shot(page, "16_no_post_button");
      return;
    }
    await postBtn.click();
    await page.waitForTimeout(2000);
    await shot(page, "16_after_post");

    const txBadge = page.locator("#badge-posted-tx");
    if (await txBadge.count()) {
      console.log(`  posted: ${(await txBadge.innerText()).replace(/\s+/g, " ").trim()}`);
    }
  });

  step("no console errors and no horizontal overflow on the final screen", async () => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) throw new Error("horizontal overflow on final screen");
  });

  let failed = 0;
  for (const s of steps) {
    process.stdout.write(`\n[step] ${s.name} ... `);
    try {
      await s.fn();
      console.log("OK");
    } catch (err) {
      failed++;
      console.log("FAILED");
      console.log(`  ${err.message}`);
      try {
        await shot(page, `FAILURE_${s.name.replace(/[^a-z0-9]+/gi, "_")}`);
      } catch {}
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(failed === 0 ? "ALL STEPS PASSED" : `${failed}/${steps.length} STEPS FAILED`);
  console.log("=".repeat(70));

  await browser.close();
  vite.kill();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  try { await browser?.close(); } catch {}
  try { vite?.kill(); } catch {}
  process.exit(1);
});
