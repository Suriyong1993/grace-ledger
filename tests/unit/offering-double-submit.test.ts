// @vitest-environment jsdom
/**
 * Double-submit guards on the offering write paths.
 *
 * Each of these handlers renders its button disabled while isSubmitting is
 * true, but that only takes effect on the next redraw. Two clicks landing in
 * the same tick both got past it, which for postOfferingToLedger meant two
 * ledger postings for one offering.
 *
 * Verified as a real defect before fixing: this suite failed (2 calls) against
 * the pre-fix code.
 */
import { describe, it, expect, vi } from "vitest";
import { OfferingPage } from "../../src/pages/OfferingPage";
import { Money } from "../../src/lib/money";
import type { OfferingSession } from "../../src/lib/offering/types";

const session = (over: Partial<OfferingSession> = {}): OfferingSession => ({
  id: "session-1",
  churchId: "church-abc",
  serviceDate: "2026-09-06",
  serviceName: "รอบนมัสการเช้า",
  status: "counting",
  expectedCashAmount: Money.from(1000),
  expectedTransferAmount: Money.zero(),
  expectedQrAmount: Money.zero(),
  expectedTotalAmount: Money.from(1000),
  ...over,
});

/** Resolves slowly so both clicks land while the first call is in flight. */
const slow = (value: unknown) =>
  vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 30));
    return value;
  });

const mount = (state: Record<string, unknown>) => {
  const page: any = new OfferingPage(null as any, "church-abc", "u-1");
  Object.assign(page, {
    isLoading: false,
    mode: "detail",
    profiles: [],
    cashCountState: {
      counter1Id: "counter-a",
      counter2Id: "counter-b",
      denominations: { b1000: 1, b500: 0, b100: 0, b50: 0, b20: 0, coins: Money.zero() },
    },
    ...state,
  });
  page.loadInitialData = vi.fn().mockResolvedValue(undefined);

  const root = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(root);
  const paint = () => {
    root.innerHTML = page.renderHtml();
    page.attachEventListeners(root, paint);
  };
  paint();
  return { page, root };
};

const clickTwice = async (root: HTMLElement, selector: string) => {
  const btn = root.querySelector<HTMLButtonElement>(selector);
  expect(btn, `${selector} must be rendered for this test to mean anything`).not.toBeNull();
  btn!.click();
  btn!.click();
  await new Promise((r) => setTimeout(r, 120));
};

describe("offering writes are not submitted twice by a double click", () => {
  it("records a cash count once", async () => {
    const { page, root } = mount({
      detailTab: "count",
      selectedSession: session(),
    });
    const recordCashCount = slow({
      success: true,
      data: {
        sessionId: "session-1",
        totalCash: Money.from(1000),
        varianceAmount: Money.zero(),
        varianceStatus: "zero_match",
        status: "counted",
      },
    });
    page.offeringService.recordCashCount = recordCashCount;

    await clickTwice(root, "#btn-save-cash-count");

    expect(recordCashCount).toHaveBeenCalledTimes(1);
  });

  it("posts to the ledger once — a duplicate here would double the offering", async () => {
    const { page, root } = mount({
      detailTab: "resolution",
      selectedSession: session({
        status: "confirmed",
        countedCashAmount: Money.from(1000),
        cashVarianceAmount: Money.zero(),
        varianceStatus: "zero_match",
      }),
      selectedCashAccountId: "acct-cash",
    });
    const postOfferingToLedger = slow({
      success: true,
      data: { sessionId: "session-1", transactionId: "txn-1", status: "posted" },
    });
    page.offeringService.postOfferingToLedger = postOfferingToLedger;

    const btn = root.querySelector<HTMLButtonElement>("#btn-post-to-ledger");
    if (!btn) {
      // The posting affordance depends on session shape; assert the guard
      // directly rather than silently passing on a missing button.
      page.isSubmitting = true;
      await page.handlePostToLedger(() => {});
      expect(postOfferingToLedger).not.toHaveBeenCalled();
      return;
    }
    await clickTwice(root, "#btn-post-to-ledger");
    expect(postOfferingToLedger).toHaveBeenCalledTimes(1);
  });

  it("ignores a second call to any write handler while one is in flight", async () => {
    const { page } = mount({ detailTab: "count", selectedSession: session() });

    const handlers = [
      "handleSaveCashCount",
      "handlePostToLedger",
      "handleSaveVarianceExplanation",
      "handleVarianceRecount",
      "handleConfirmSession",
      "handleStartCounting",
      "handleSaveDraft",
    ];

    for (const name of handlers) {
      const spy = vi.fn();
      Object.assign(page.offeringService, {
        recordCashCount: spy,
        postOfferingToLedger: spy,
        resolveVariance: spy,
        confirmSession: spy,
        startCashCount: spy,
        createSession: spy,
      });
      // Simulate a request already in flight.
      page.isSubmitting = true;
      await page[name](() => {});
      expect(spy, `${name} ran while another submit was in flight`).not.toHaveBeenCalled();
    }
  });
});
