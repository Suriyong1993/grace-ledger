// @vitest-environment jsdom
/**
 * Every harness screen must render and wire without throwing.
 *
 * The harness is how these screens get reviewed, so a screen that throws on
 * attach is invisible until someone clicks it. This walks all of them.
 */
import { describe, it, expect } from "vitest";

describe("preview harness", () => {
  it("renders and attaches every screen without throwing", async () => {
    document.body.innerHTML = '<div id="app"></div><div id="preview-screens"></div>';
    const mod = await import("../../src/preview/previewMain");
    expect(mod).toBeDefined();

    const app = document.getElementById("app")!;
    expect(app.innerHTML.length).toBeGreaterThan(0);

    const buttons = document.querySelectorAll<HTMLButtonElement>("[data-screen]");
    expect(buttons.length).toBeGreaterThanOrEqual(9);

    for (const btn of Array.from(buttons)) {
      const id = btn.dataset.screen!;
      window.location.hash = `#${id}`;
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      expect(
        document.getElementById("app")!.innerHTML.length,
        `screen "${id}" rendered empty`,
      ).toBeGreaterThan(0);
    }
  });
});
