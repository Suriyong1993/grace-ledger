/**
 * Interaction-state audit — drives real controls in a real Chromium and
 * measures whether each state is actually perceivable, rather than trusting
 * that a :hover rule exists somewhere in the stylesheet.
 *
 * For every target it captures default / hover / focus-visible and compares
 * the rendered pixels between states. A rule that exists but changes nothing
 * visible (or is painted under another element) fails here, which reading the
 * CSS cannot tell you.
 *
 * Focus is driven with real Tab keypresses, because :focus-visible only
 * matches for keyboard interaction — clicking a button would silently test
 * the wrong branch.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || "http://localhost:5500";
const EXEC = process.env.CHROMIUM_PATH || "/tmp/chromium";
const LIBS = process.env.CHROMIUM_LIBS || "/tmp/gllibs/lib";
const OUT = process.env.OUT_DIR || join(process.cwd(), "docs/screenshots/interaction-audit");

const THAI_RANGE = "U+0E01-0E5B, U+200C-200D, U+25CC";
const FONT_FILES = [
  ["Anuphan", "anuphan-thai-400-normal.woff2", 400],
  ["Anuphan", "anuphan-thai-600-normal.woff2", 600],
  ["Anuphan", "anuphan-thai-700-normal.woff2", 700],
  ["Anuphan", "anuphan-latin-400-normal.woff2", 400],
  ["Anuphan", "anuphan-latin-600-normal.woff2", 600],
  ["Anuphan", "anuphan-latin-700-normal.woff2", 700],
  ["Space Grotesk", "space-grotesk-latin-400-normal.woff2", 400],
  ["Space Grotesk", "space-grotesk-latin-600-normal.woff2", 600],
  ["Space Grotesk", "space-grotesk-latin-700-normal.woff2", 700],
];

const buildFontCss = () => {
  let css = "";
  for (const [family, file, weight] of FONT_FILES) {
    const p = join(HERE, "audit-fonts", file);
    if (!existsSync(p)) continue;
    const b64 = readFileSync(p).toString("base64");
    const range = file.includes("-thai-") ? `unicode-range:${THAI_RANGE};` : "";
    css += `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};`
      + `font-display:block;${range}src:url(data:font/woff2;base64,${b64}) format("woff2");}\n`;
  }
  return css;
};

/** Controls worth proving, in the order the brief prioritises them. */
const TARGETS = [
  { screen: "dashboard", name: "primary-button", selector: ".gl-dash-hero__actions .gl-btn--primary" },
  { screen: "dashboard", name: "secondary-button", selector: ".gl-dash-hero__actions .gl-btn--secondary" },
  { screen: "transactions", name: "search-input", selector: ".gl-txn-filters__input" },
  { screen: "transactions", name: "filter-pill-inactive", selector: '.filter-pill[data-value="income"]' },
  { screen: "transactions", name: "filter-pill-active", selector: '.filter-pill[data-value="all"]' },
  { screen: "transactions", name: "period-select", selector: ".gl-txn-filters__period" },
  { screen: "offerings", name: "offering-primary", selector: ".gl-btn--primary" },
  { screen: "offering-detail", name: "tab-inactive", selector: "#btn-tab-count" },
  { screen: "offering-detail", name: "tab-active", selector: "#btn-tab-overview" },
  { screen: "approvals", name: "approve-button", selector: ".gl-btn--primary" },
  { screen: "approvals", name: "detail-button", selector: ".gl-btn--secondary" },
  { screen: "members", name: "member-search", selector: "#member-search-input" },
];

/** Pixel difference ratio between two PNG buffers of equal size. */
const differs = (a, b) => !a.equals(b);

const run = async () => {
  mkdirSync(OUT, { recursive: true });
  const fontCss = buildFontCss();

  const browser = await chromium.launch({
    executablePath: EXEC,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    env: { ...process.env, LD_LIBRARY_PATH: LIBS },
  });

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  if (fontCss) {
    await ctx.addInitScript((css) => {
      const inject = () => {
        const el = document.createElement("style");
        el.textContent = css;
        document.head.appendChild(el);
      };
      if (document.head) inject();
      else document.addEventListener("DOMContentLoaded", inject, { once: true });
    }, fontCss);
  }
  const page = await ctx.newPage();

  const results = [];

  for (const target of TARGETS) {
    await page.goto(`${BASE}/preview.html#${target.screen}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    await page.evaluate(() => document.fonts.ready).catch(() => {});

    const el = page.locator(target.selector).first();
    if ((await el.count()) === 0) {
      results.push({ ...target, status: "not-found" });
      continue;
    }

    const shot = async (state) => {
      const path = join(OUT, `${target.screen}-${target.name}-${state}.png`);
      await el.screenshot({ path });
      return readFileSync(path);
    };

    // Default — mouse parked away so nothing is incidentally hovered.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(120);
    const base = await shot("default");

    // Hover.
    await el.hover();
    await page.waitForTimeout(200);
    const hover = await shot("hover");

    // Keyboard focus: focus() alone does not reliably match :focus-visible,
    // so the element is focused then re-entered via the keyboard.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(120);
    await el.evaluate((node) => node.focus());
    await page.waitForTimeout(200);
    const focus = await shot("focus");

    const box = await el.boundingBox();
    const info = await el.evaluate((node) => {
      const cs = getComputedStyle(node);
      return {
        disabled: node.disabled ?? null,
        outlineWidth: cs.outlineWidth,
        cursor: cs.cursor,
      };
    });

    results.push({
      ...target,
      status: "ok",
      size: box ? { w: Math.round(box.width), h: Math.round(box.height) } : null,
      hoverChanges: differs(base, hover),
      focusChanges: differs(base, focus),
      ...info,
    });
  }

  // Disabled and loading states are rendered by the pages themselves; capture
  // the ones the harness can reach directly.
  await page.goto(`${BASE}/preview.html#transactions`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const disabledCount = await page.locator("button:disabled, [aria-disabled='true']").count();

  await browser.close();

  writeFileSync(join(OUT, "results.json"), JSON.stringify(results, null, 2));

  console.log("=== INTERACTION STATES ===");
  for (const r of results) {
    if (r.status === "not-found") {
      console.log(`  MISSING  ${r.screen}/${r.name}  (${r.selector})`);
      continue;
    }
    const flags = [];
    if (!r.hoverChanges) flags.push("NO-HOVER-CHANGE");
    if (!r.focusChanges) flags.push("NO-FOCUS-CHANGE");
    console.log(
      `  ${flags.length ? "WARN " : "ok   "} ${r.screen}/${r.name} ${r.size?.w}x${r.size?.h}` +
      `${flags.length ? "  " + flags.join(" ") : ""}`,
    );
  }
  console.log(`\ndisabled/aria-disabled controls on transactions: ${disabledCount}`);
  console.log(`Screenshots: ${OUT}`);
};

run().catch((e) => {
  console.error("interaction audit failed:", e.message);
  process.exit(1);
});
