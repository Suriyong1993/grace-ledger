/**
 * Visual audit — screenshots every screen at three viewports using a real
 * Chromium, and reports measured layout defects rather than impressions.
 *
 * Chromium comes from the @sparticuz/chromium npm package (the Playwright CDN
 * and the Debian mirrors are both outside this sandbox's egress allowlist,
 * but the npm registry is not). Its shared libraries ship in the same package
 * and are extracted alongside it; CHROMIUM_PATH / CHROMIUM_LIBS point at both.
 *
 * Pages are captured through the dev preview harness (preview.html), which
 * renders each screen with fixed mock data. That keeps the shots deterministic
 * and works without a reachable Supabase.
 *
 * Overflow is measured in the page (scrollWidth vs clientWidth) instead of
 * being eyeballed, so a regression fails loudly rather than needing someone
 * to notice it in an image.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:5500";
const EXEC = process.env.CHROMIUM_PATH || "/tmp/chromium";
const LIBS = process.env.CHROMIUM_LIBS || "/tmp/gllibs/lib";
const OUT = process.env.OUT_DIR || join(process.cwd(), "docs/screenshots/visual-audit");

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 812 },
];

const SCREENS = [
  "dashboard", "transactions", "approvals", "offerings",
  "offering-detail", "funds", "members", "reports", "dashboard-empty",
];

const run = async () => {
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: EXEC,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    env: { ...process.env, LD_LIBRARY_PATH: LIBS },
  });

  const findings = [];
  const consoleErrors = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      // Touch viewports resolve `pointer: coarse`, which is what decides the
      // touch-target rules — capturing mobile with a mouse pointer would
      // silently test the wrong stylesheet branch.
      hasTouch: vp.name !== "desktop",
      isMobile: vp.name === "mobile",
    });
    const page = await ctx.newPage();

    page.on("console", (m) => {
      const t = m.text();
      // Font CDN and the Vite HMR socket are environment noise here, not app defects.
      if (m.type() !== "error") return;
      if (/fonts\.googleapis|ERR_CONNECTION_CLOSED|WebSocket|vite/i.test(t)) return;
      consoleErrors.push(`[${vp.name}] ${t.slice(0, 200)}`);
    });
    page.on("pageerror", (e) => {
      if (/WebSocket/i.test(e.message)) return;
      consoleErrors.push(`[${vp.name}] PAGEERROR ${e.message.slice(0, 200)}`);
    });

    for (const screen of SCREENS) {
      await page.goto(`${BASE}/preview.html#${screen}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      // The harness renders synchronously on hashchange; this settles fonts
      // and any entry animation before the shot.
      await page.waitForTimeout(700);

      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const overflowing = [];
        for (const el of Array.from(document.querySelectorAll("*"))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.right > doc.clientWidth + 1) {
            const cls = typeof el.className === "string" ? el.className : "";
            overflowing.push(
              `${el.tagName.toLowerCase()}${cls ? "." + cls.trim().split(/\s+/).slice(0, 2).join(".") : ""} right=${Math.round(r.right)}`,
            );
          }
        }

        // Interactive controls smaller than the 44px guidance.
        const small = [];
        const sel = 'button, a[href], input, select, textarea, [role="tab"], [role="button"]';
        for (const el of Array.from(document.querySelectorAll(sel))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const style = getComputedStyle(el);
          if (style.visibility === "hidden" || style.display === "none") continue;
          if (r.height < 44 - 0.5) {
            const label = (el.textContent || "").trim().slice(0, 24) || el.getAttribute("aria-label") || el.tagName;
            const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] : "";
            small.push(`${label} [${cls}] ${Math.round(r.width)}x${Math.round(r.height)}`);
          }
        }

        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
          overflowing: [...new Set(overflowing)].slice(0, 8),
          smallTargets: [...new Set(small)].slice(0, 12),
          h1Count: document.querySelectorAll("h1").length,
        };
      });

      await page.screenshot({
        path: join(OUT, `${screen}-${vp.name}.png`),
        fullPage: true,
      });

      findings.push({ screen, viewport: vp.name, ...metrics });
    }
    await ctx.close();
  }

  await browser.close();

  writeFileSync(
    join(OUT, "findings.json"),
    JSON.stringify({ findings, consoleErrors }, null, 2),
  );

  // Console summary: only what needs a human decision.
  console.log("=== HORIZONTAL OVERFLOW ===");
  const ov = findings.filter((f) => f.horizontalOverflow);
  if (!ov.length) console.log("  none at any viewport");
  for (const f of ov) {
    console.log(`  ${f.screen} @${f.viewport}: ${f.scrollWidth}>${f.clientWidth}`);
    f.overflowing.forEach((o) => console.log(`      ${o}`));
  }

  console.log("\n=== TOUCH TARGETS UNDER 44px (mobile) ===");
  const sm = findings.filter((f) => f.viewport === "mobile" && f.smallTargets.length);
  if (!sm.length) console.log("  none");
  for (const f of sm) {
    console.log(`  ${f.screen}:`);
    f.smallTargets.forEach((s) => console.log(`      ${s}`));
  }

  console.log("\n=== CONSOLE ERRORS (app only) ===");
  console.log(consoleErrors.length ? consoleErrors.slice(0, 12).map((e) => "  " + e).join("\n") : "  none");

  console.log(`\nScreenshots: ${OUT}`);
};

run().catch((e) => {
  console.error("visual audit failed:", e.message);
  process.exit(1);
});
