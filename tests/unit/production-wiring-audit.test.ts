/**
 * Production wiring audit.
 *
 * The /transactions route shipped for a long time rendering fine and doing
 * nothing, because main.ts never called its attachEventListeners and a
 * comment asserted that data-action attributes made the call unnecessary.
 * Nothing failed: the page had the method, the harness worked, the tests
 * passed.
 *
 * These assertions read main.ts as text on purpose. Every other test in the
 * suite exercises a page in isolation and so cannot see whether production
 * actually reaches it. This is the check that would have caught that bug.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MAIN = readFileSync(resolve(__dirname, "../../src/main.ts"), "utf8");
const attachBlock = MAIN.slice(MAIN.indexOf("this.attachShellPanels(this.rootElement);"));

/** Routes that own an interactive page and must be attached in production. */
const INTERACTIVE_ROUTES = [
  { route: "/approvals", page: "approvalsPage" },
  { route: "/offerings", page: "offeringPage" },
  { route: "/transactions", page: "transactionsPage" },
  { route: "/funds", page: "fundsPage" },
  { route: "/members", page: "membersPage" },
  { route: "/reports", page: "reportsPage" },
  { route: "/profile", page: "profilePage" },
];

describe("production wiring — every interactive route attaches its listeners", () => {
  it.each(INTERACTIVE_ROUTES)(
    "$route calls $page.attachEventListeners from main.ts",
    ({ route, page }) => {
      expect(
        attachBlock.includes(`this.${page}?.attachEventListeners(`),
        `${route} renders ${page} but main.ts never attaches its listeners, ` +
          `so every control on it will be inert in production`,
      ).toBe(true);
      expect(attachBlock).toContain(route);
    },
  );

  it("re-renders through the router so listeners are rebound after each redraw", () => {
    // innerHTML replacement destroys every listener; the rerender callback
    // must route back through render() rather than patching in place.
    const callbacks = attachBlock.match(/attachEventListeners\(\s*this\.rootElement,\s*\(\)\s*=>\s*\n?\s*this\.render\(\)/g);
    expect(callbacks?.length ?? 0).toBeGreaterThanOrEqual(
      INTERACTIVE_ROUTES.length,
    );
  });

  it("does not claim data-action attributes remove the need to attach", () => {
    // The exact comment that justified the dead /transactions route.
    expect(MAIN).not.toMatch(/No attachEventListeners needed/i);
  });

  it("wires the retry controls before the popover guard can return early", () => {
    const fn = MAIN.slice(
      MAIN.indexOf("private attachShellPanels"),
      MAIN.indexOf("public async render"),
    );
    const retryIndex = fn.indexOf("dash-attention-retry");
    const guardIndex = fn.indexOf("if (popovers.length === 0) return;");

    expect(retryIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeGreaterThan(-1);
    // Both popovers are permission/viewport conditional, so the guard fires
    // for restricted roles — the retry must already be bound by then.
    expect(retryIndex).toBeLessThan(guardIndex);
  });

  it("attaches listeners only after the shell HTML is written", () => {
    // Attaching before the innerHTML assignment binds to discarded nodes.
    const writeIndex = MAIN.indexOf("this.rootElement.innerHTML = appShellHtml");
    const firstAttach = MAIN.indexOf(
      "attachEventListeners",
      MAIN.indexOf("const appShellHtml = renderAppShellHtml"),
    );
    expect(writeIndex).toBeGreaterThan(-1);
    expect(firstAttach).toBeGreaterThan(writeIndex);
  });
});

describe("production wiring — pages expose what main.ts calls", () => {
  it.each(INTERACTIVE_ROUTES)(
    "$page's class actually defines attachEventListeners",
    ({ page }) => {
      const file = page.replace("Page", "");
      const name = file.charAt(0).toUpperCase() + file.slice(1) + "Page";
      const src = readFileSync(
        resolve(__dirname, `../../src/pages/${name}.ts`),
        "utf8",
      );
      expect(src).toMatch(/public\s+attachEventListeners\s*\(/);
    },
  );
});
