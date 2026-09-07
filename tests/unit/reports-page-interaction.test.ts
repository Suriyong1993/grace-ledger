// @vitest-environment jsdom
/**
 * Reports — period selection as page-level interaction.
 *
 * Period selection used to be fused to loadData(), so the selected tab could
 * not change without Supabase. selectPeriod() separates the two: choosing a
 * period is synchronous page state, fetching its data is a network concern.
 * These tests exercise the first without mocking the second.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ReportsPage } from "../../src/pages/ReportsPage";

describe("ReportsPage — period selection", () => {
  let page: any;
  let root: HTMLElement;
  let paint: () => void;

  beforeEach(() => {
    page = new ReportsPage(null as any, "church-abc");
    // Land on a rendered report rather than the loading skeleton; loadData is
    // stubbed because this suite is about selection, not fetching.
    Object.assign(page, { isLoading: false, errorMessage: null });
    page.loadData = vi.fn().mockResolvedValue(undefined);

    root = document.createElement("div");
    document.body.innerHTML = "";
    document.body.appendChild(root);
    paint = () => {
      root.innerHTML = page.renderHtml();
      page.attachEventListeners(root, paint);
    };
    paint();
  });

  it("renders a tab per period", () => {
    expect(root.querySelectorAll(".gl-tab").length).toBeGreaterThan(1);
  });

  it("clicking a period tab marks it active in the rendered output", async () => {
    const target = root.querySelector<HTMLButtonElement>(
      '[data-period="2026-03"]',
    )!;
    target.click();
    await Promise.resolve();

    expect(page.getSelectedPeriod()).toBe("2026-03");
    // The assertion that matters: the DOM reflects it.
    const active = root.querySelector<HTMLElement>('[data-period="2026-03"]')!;
    expect(active.className).toContain("is-active");
  });

  it("requests the data for the newly selected period", async () => {
    root.querySelector<HTMLButtonElement>('[data-period="2026-year"]')!.click();
    await Promise.resolve();

    expect(page.loadData).toHaveBeenCalled();
    expect(page.getSelectedPeriod()).toBe("2026-year");
  });

  it("selectPeriod shows the loading state immediately, before data arrives", () => {
    page.selectPeriod("2026-05");

    expect(page.getSelectedPeriod()).toBe("2026-05");
    expect(page.renderHtml()).toContain("กำลังโหลดข้อมูลรายงาน");
  });

  it("selectPeriod clears a previous error so it is not shown against new data", () => {
    Object.assign(page, { errorMessage: "โหลดไม่สำเร็จ", isLoading: false });
    expect(page.renderHtml()).toContain("โหลดไม่สำเร็จ");

    page.selectPeriod("2026-02");

    expect(page.renderHtml()).not.toContain("โหลดไม่สำเร็จ");
  });

  it("tabs stay clickable across redraws", async () => {
    root.querySelector<HTMLButtonElement>('[data-period="2026-02"]')!.click();
    await Promise.resolve();
    Object.assign(page, { isLoading: false });
    paint();

    root.querySelector<HTMLButtonElement>('[data-period="2026-06"]')!.click();
    await Promise.resolve();

    expect(page.getSelectedPeriod()).toBe("2026-06");
  });
});

describe("ReportsPage — error state", () => {
  it("offers a retry control when loading failed", () => {
    const page: any = new ReportsPage(null as any, "church-abc");
    Object.assign(page, { isLoading: false, errorMessage: "เชื่อมต่อไม่ได้" });

    const html = page.renderHtml();
    expect(html).toContain("retry-reports-btn");
    expect(html).toContain("เชื่อมต่อไม่ได้");
  });

  it("retry re-requests the data", async () => {
    const page: any = new ReportsPage(null as any, "church-abc");
    Object.assign(page, { isLoading: false, errorMessage: "เชื่อมต่อไม่ได้" });
    page.loadData = vi.fn().mockResolvedValue(undefined);

    const root = document.createElement("div");
    root.innerHTML = page.renderHtml();
    page.attachEventListeners(root, () => {});

    root.querySelector<HTMLButtonElement>("#retry-reports-btn")!.click();
    await Promise.resolve();

    expect(page.loadData).toHaveBeenCalled();
  });
});
