/**
 * Unit tests for OfferingPage — uncounted-session hint banner.
 *
 * The detail view's overview tab shows a hint notice telling the user to
 * go count cash when a session is still "draft"/"counting" (not yet
 * counted), and hides it once counting has moved past that point.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { OfferingPage } from "../../src/pages/OfferingPage";
import { Money } from "../../src/lib/money";
import type {
  OfferingSession,
  OfferingSessionStatus,
} from "../../src/lib/offering/types";

const dummySupabase = {} as any;

const makeSession = (
  status: OfferingSessionStatus,
  overrides: Partial<OfferingSession> = {},
): OfferingSession => ({
  id: "session-001",
  churchId: "church-abc",
  serviceDate: "2026-09-06",
  serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
  status,
  expectedCashAmount: Money.from(1000),
  expectedTransferAmount: Money.zero(),
  expectedQrAmount: Money.zero(),
  expectedTotalAmount: Money.from(1000),
  ...overrides,
});

const HINT_TEXT = "รอบนี้ยังไม่ได้ตรวจนับเงินสด";

describe("OfferingPage — uncounted session hint", () => {
  let page: OfferingPage;

  beforeEach(() => {
    page = new OfferingPage(dummySupabase, "church-abc", "user-1");
    (page as any).isLoading = false;
    (page as any).mode = "detail";
    (page as any).detailTab = "overview";
  });

  it.each<OfferingSessionStatus>(["draft", "counting"])(
    'shows the hint on the overview tab when status is "%s"',
    (status) => {
      (page as any).selectedSession = makeSession(status);
      const html = page.renderHtml();
      expect(html).toContain(HINT_TEXT);
    },
  );

  it.each<OfferingSessionStatus>([
    "counted",
    "variance_review",
    "confirmed",
    "posted",
    "voided",
  ])('hides the hint on the overview tab once status is "%s"', (status) => {
    (page as any).selectedSession = makeSession(status);
    const html = page.renderHtml();
    expect(html).not.toContain(HINT_TEXT);
  });

  it("does not show the hint outside the overview tab even when uncounted", () => {
    (page as any).selectedSession = makeSession("draft");
    (page as any).detailTab = "count";
    const html = page.renderHtml();
    expect(html).not.toContain(HINT_TEXT);
  });
});
