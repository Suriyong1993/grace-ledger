// @vitest-environment jsdom
/**
 * Offering detail — interaction, not markup.
 *
 * Every assertion here goes User action -> event -> state -> rendered result.
 * Checking `page.detailTab` alone would pass even if the panel never redrew,
 * so each test asserts on what the DOM actually shows after the click.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { OfferingPage } from "../../src/pages/OfferingPage";
import { Money } from "../../src/lib/money";
import type {
  OfferingSession,
  OfferingSessionStatus,
} from "../../src/lib/offering/types";

const makeSession = (
  status: OfferingSessionStatus,
  overrides: Partial<OfferingSession> = {},
): OfferingSession => ({
  id: "session-001",
  churchId: "church-abc",
  serviceDate: "2026-09-06",
  serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
  status,
  expectedCashAmount: Money.from(10000),
  expectedTransferAmount: Money.zero(),
  expectedQrAmount: Money.zero(),
  expectedTotalAmount: Money.from(10000),
  ...overrides,
});

describe("OfferingPage — detail tab interaction", () => {
  let page: any;
  let root: HTMLElement;
  let paint: () => void;

  const setup = (session: OfferingSession) => {
    page = new OfferingPage(null as any, "church-abc", "user-1");
    Object.assign(page, {
      isLoading: false,
      mode: "detail",
      detailTab: "overview",
      selectedSession: session,
      profiles: [],
    });
    root = document.createElement("div");
    document.body.innerHTML = "";
    document.body.appendChild(root);
    paint = () => {
      root.innerHTML = page.renderHtml();
      page.attachEventListeners(root, paint);
    };
    paint();
  };

  beforeEach(() => setup(makeSession("counting")));

  it("starts on the overview tab with that tab selected", () => {
    const overview = root.querySelector("#btn-tab-overview")!;
    expect(overview.getAttribute("aria-selected")).toBe("true");
    expect(root.querySelector("#btn-tab-count")!.getAttribute("aria-selected")).toBe("false");
  });

  it("clicking the count tab swaps the rendered panel, not just state", () => {
    const before = root.querySelector("#gl-detail-panel")!.innerHTML;

    root.querySelector<HTMLButtonElement>("#btn-tab-count")!.click();

    expect(page.detailTab).toBe("count");
    expect(root.querySelector("#btn-tab-count")!.getAttribute("aria-selected")).toBe("true");
    // The panel content must actually differ — this is the assertion that
    // fails if state changes but nothing redraws.
    expect(root.querySelector("#gl-detail-panel")!.innerHTML).not.toBe(before);
  });

  it("keyboard ArrowRight moves between tabs and redraws", () => {
    const overview = root.querySelector<HTMLElement>("#btn-tab-overview")!;
    overview.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );

    expect(page.detailTab).toBe("count");
    expect(root.querySelector("#btn-tab-count")!.getAttribute("aria-selected")).toBe("true");
  });

  it("tabs remain clickable after a redraw (listeners are re-bound)", () => {
    root.querySelector<HTMLButtonElement>("#btn-tab-count")!.click();
    root.querySelector<HTMLButtonElement>("#btn-tab-overview")!.click();
    root.querySelector<HTMLButtonElement>("#btn-tab-count")!.click();

    expect(page.detailTab).toBe("count");
    expect(root.querySelector("#btn-tab-count")!.getAttribute("aria-selected")).toBe("true");
  });

  it("shows the uncounted hint on overview while the session is not counted", () => {
    expect(root.textContent).toContain("รอบนี้ยังไม่ได้ตรวจนับเงินสด");
  });

  it("hides that hint once the session has been counted", () => {
    setup(makeSession("counted"));
    expect(root.textContent).not.toContain("รอบนี้ยังไม่ได้ตรวจนับเงินสด");
  });
});

describe("OfferingPage — list states", () => {
  const build = (fields: Record<string, unknown>) => {
    const page: any = new OfferingPage(null as any, "church-abc", "user-1");
    Object.assign(page, { mode: "list", ...fields });
    return page.renderHtml();
  };

  it("renders a loading state", () => {
    expect(build({ isLoading: true, sessions: [] })).toContain(
      "กำลังโหลดระบบเงินถวาย",
    );
  });

  it("renders an empty state that offers the first action", () => {
    const html = build({ isLoading: false, sessions: [] });
    expect(html).toContain("#/offerings/new");
  });

  it("renders an error state with a retry control", () => {
    const html = build({
      isLoading: false,
      sessions: [],
      errorMessage: "โหลดไม่สำเร็จ",
    });
    expect(html).toContain("gl-btn-retry-sessions");
    expect(html).toContain("โหลดไม่สำเร็จ");
  });
});
