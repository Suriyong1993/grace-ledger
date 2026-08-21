import { describe, it, expect } from "vitest";
import { Money } from "../../src/lib/money";
import { OfferingSession } from "../../src/lib/offering/types";
import { renderVarianceResolutionViewHtml } from "../../src/components/offering/VarianceResolutionView";

/**
 * Guards the confirmation gate on the Variance Resolution screen.
 *
 * `confirm_offering_session` (migration 20260819000011) refuses to confirm a
 * session whose `cash_variance_amount <> 0` unless `variance_status` is
 * 'explained' or 'acknowledged' AND `variance_reason` is at least 5 characters.
 * The screen must gate on exactly that rule, using the stored variance as the
 * authority — otherwise it offers an action the database will reject, or
 * reports a match where there is none.
 */
describe("Variance Resolution — confirmation guard", () => {
  const base: OfferingSession = {
    id: "session-guard",
    churchId: "church-1",
    serviceDate: "2026-08-23",
    serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
    status: "variance_review",
    expectedCashAmount: Money.from("10000.00"),
    expectedTransferAmount: Money.from("5000.00"),
    expectedQrAmount: Money.from("3450.00"),
    expectedTotalAmount: Money.from("18450.00"),
    countedCashAmount: Money.from("9950.00"),
    cashVarianceAmount: Money.from("-50.00"),
    varianceStatus: "variance_detected",
    counter1Id: "user-1",
    counter2Id: "user-2",
  };

  /** The confirm button is present but non-actionable. */
  function confirmIsDisabled(html: string): boolean {
    const match = html.match(/id="btn-confirm-session"[^>]*>/);
    if (!match) return false;
    return match[0].includes("disabled");
  }

  it("blocks confirmation while a non-zero variance has no saved explanation", () => {
    const html = renderVarianceResolutionViewHtml({ session: base, explanation: "" });

    expect(confirmIsDisabled(html)).toBe(true);
    expect(html).toContain("−฿50.00");
  });

  it("keeps confirmation blocked when the explanation is typed but not yet saved", () => {
    // The RPC gates on the persisted variance_reason, so an unsaved draft must
    // not unlock the button.
    const html = renderVarianceResolutionViewHtml({
      session: base,
      explanation: "ซองหนึ่งเขียนยอดเกินจริง 50 บาท",
    });

    expect(confirmIsDisabled(html)).toBe(true);
  });

  it("allows confirmation once the explanation is persisted on the session", () => {
    const html = renderVarianceResolutionViewHtml({
      session: {
        ...base,
        varianceStatus: "explained",
        varianceReason: "ซองหนึ่งเขียนยอดเกินจริง 50 บาท",
      },
      explanation: "ซองหนึ่งเขียนยอดเกินจริง 50 บาท",
    });

    expect(confirmIsDisabled(html)).toBe(false);
  });

  it("rejects a persisted explanation shorter than the RPC minimum", () => {
    const html = renderVarianceResolutionViewHtml({
      session: { ...base, varianceStatus: "explained", varianceReason: "ผิด" },
      explanation: "ผิด",
    });

    expect(confirmIsDisabled(html)).toBe(true);
  });

  it("allows confirmation for a genuine zero match with no explanation", () => {
    const html = renderVarianceResolutionViewHtml({
      session: {
        ...base,
        countedCashAmount: Money.from("10000.00"),
        cashVarianceAmount: Money.zero(),
        varianceStatus: "zero_match",
      },
      explanation: "",
    });

    expect(confirmIsDisabled(html)).toBe(false);
    expect(html).toContain("ยอดตรวจนับเงินสดตรงกับยอดบันทึกสมบูรณ์");
  });

  it("does not report a match when a stale zero_match status contradicts the stored variance", () => {
    // The defect: `variance_status` said zero_match while the stored variance
    // was a real shortage. The screen showed a green match and an enabled
    // confirm button for a session the RPC would refuse.
    const html = renderVarianceResolutionViewHtml({
      session: { ...base, varianceStatus: "zero_match", cashVarianceAmount: Money.from("-50.00") },
      explanation: "",
    });

    expect(html).not.toContain("ยอดตรวจนับเงินสดตรงกับยอดบันทึกสมบูรณ์");
    expect(confirmIsDisabled(html)).toBe(true);
  });

  it("flags a stored variance that disagrees with the recomputed one instead of picking a side", () => {
    // expected 10,000 − counted 9,950 = −50, but the session carries −999.
    const html = renderVarianceResolutionViewHtml({
      session: { ...base, cashVarianceAmount: Money.from("-999.00") },
      explanation: "",
    });

    expect(html).toContain("ยอดผลต่างในระบบไม่ตรงกับยอดที่คำนวณจากการนับ");
    expect(confirmIsDisabled(html)).toBe(true);
  });

  it("does not invent a zero count when the session has no cash count at all", () => {
    // Previously `countedCash` fell back to Money.zero(), manufacturing a
    // full-expected shortage out of missing data.
    const html = renderVarianceResolutionViewHtml({
      session: {
        ...base,
        status: "counting",
        countedCashAmount: null,
        cashVarianceAmount: null,
        varianceStatus: null,
        cashCount: null,
      },
      explanation: "",
    });

    expect(html).toContain("ยังไม่มีผลการตรวจนับเงินสด");
    expect(html).not.toContain("−฿10,000.00");
    expect(confirmIsDisabled(html)).toBe(true);
  });

  it("prefers the recorded cash count over the denormalised session column", () => {
    const html = renderVarianceResolutionViewHtml({
      session: {
        ...base,
        countedCashAmount: Money.from("1.00"),
        cashCount: {
          offeringSessionId: "session-guard",
          b1000: 9, b500: 1, b100: 4, b50: 0, b20: 0,
          coins: Money.from("50.00"),
          totalCashCounted: Money.from("9950.00"),
          countedBy1: "user-1",
          countedBy2: "user-2",
        },
      },
      explanation: "",
    });

    expect(html).toContain("฿9,950.00");
  });
});
