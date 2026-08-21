import { describe, it, expect } from "vitest";
import { Money } from "../../src/lib/money";
import { OfferingSession } from "../../src/lib/offering/types";
import { renderVarianceResolutionViewHtml } from "../../src/components/offering/VarianceResolutionView";

describe("M3 UI Components — Slice 3", () => {
  const baseSession: OfferingSession = {
    id: "session-test-002",
    churchId: "church-test",
    serviceDate: "2026-08-23",
    serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
    status: "variance_review",
    expectedCashAmount: Money.from("10000.00"),
    expectedTransferAmount: Money.from("5000.00"),
    expectedQrAmount: Money.from("3450.00"),
    expectedTotalAmount: Money.from("18450.00"),
    countedCashAmount: Money.from("6950.00"),
    cashVarianceAmount: Money.from("-3050.00"),
    varianceStatus: "variance_detected",
    counter1Id: "user-1",
    counter2Id: "user-2",
  };

  it("should render variance analysis grid with expected, actual, and difference", () => {
    const html = renderVarianceResolutionViewHtml({
      session: baseSession,
      explanation: "",
    });

    expect(html).toContain("ผลต่างเงินสด");
    expect(html).toContain("จัดการและรับทราบผลต่างเงินสด");
    expect(html).toContain("10,000.00");
    expect(html).toContain("6,950.00");
    expect(html).toContain("−฿3,050.00");
    expect(html).toContain("ผลต่างเงินสดขาด");
  });

  it("should provide recount and explanation options for non-zero variance", () => {
    const html = renderVarianceResolutionViewHtml({
      session: baseSession,
      explanation: "",
    });

    expect(html).toContain("btn-variance-recount");
    expect(html).toContain("สั่งนับใหม่");
    expect(html).toContain("input-variance-explanation");
    expect(html).toContain("btn-variance-explain");
  });

  it("should disable explain button when explanation is shorter than 5 characters", () => {
    const html = renderVarianceResolutionViewHtml({
      session: baseSession,
      explanation: "สั้น", // 4 chars
    });

    expect(html).toContain("กรุณากรอกอย่างน้อย 5 ตัวอักษร");
    expect(html).toContain('id="btn-variance-explain"');
    expect(html).toContain('disabled');
  });

  it("should enable explain button when explanation has 5 or more characters", () => {
    const html = renderVarianceResolutionViewHtml({
      session: baseSession,
      explanation: "นับซองแล้วเงินไม่ครบตามยอดหน้าซอง",
    });

    expect(html).toContain("ความยาวคำชี้แจงถูกต้อง");
    expect(html).not.toContain('id="btn-variance-explain"\n                style="[^"]*"\n                disabled');
  });

  it("should block confirm session when variance is unresolved", () => {
    const html = renderVarianceResolutionViewHtml({
      session: {
        ...baseSession,
        varianceStatus: "variance_detected",
      },
      explanation: "",
    });

    expect(html).toContain('id="btn-confirm-session"');
    expect(html).toContain('disabled');
    // The hint now states the specific blocking reason, produced by
    // VarianceEngine.isVarianceAcceptableForConfirmation — the same rule
    // confirm_offering_session enforces.
    expect(html).toContain("ที่ยังไม่ได้รับการอธิบาย กรุณาระบุคำอธิบายก่อนยืนยัน");
  });

  it("should allow confirm session when variance has been explained", () => {
    const html = renderVarianceResolutionViewHtml({
      session: {
        ...baseSession,
        varianceStatus: "explained",
        varianceReason: "ตรวจสอบซองแล้วพบผู้ถวายใส่เงินไม่ครบ",
      },
      explanation: "ตรวจสอบซองแล้วพบผู้ถวายใส่เงินไม่ครบ",
    });

    expect(html).toContain("● บันทึกคำชี้แจงแล้ว");
    expect(html).toContain("ยืนยันความถูกต้องรอบเงินถวาย");
    expect(html).not.toContain('id="btn-confirm-session"\n            style="[^"]*"\n            disabled');
  });

  it("should allow direct confirm when variance is zero (Zero Match)", () => {
    const zeroMatchSession: OfferingSession = {
      ...baseSession,
      status: "counted",
      countedCashAmount: Money.from("10000.00"),
      cashVarianceAmount: Money.zero(),
      varianceStatus: "zero_match",
    };

    const html = renderVarianceResolutionViewHtml({
      session: zeroMatchSession,
      explanation: "",
    });

    expect(html).toContain("ยอดตรวจนับเงินสดตรงกับยอดบันทึกสมบูรณ์");
    expect(html).toContain("ยืนยันความถูกต้องรอบเงินถวาย");
  });

  it("should render locked state when session is already confirmed", () => {
    const confirmedSession: OfferingSession = {
      ...baseSession,
      status: "confirmed",
      varianceStatus: "explained",
      varianceReason: "มีคำชี้แจงแล้ว",
    };

    const html = renderVarianceResolutionViewHtml({
      session: confirmedSession,
      explanation: "มีคำชี้แจงแล้ว",
    });

    expect(html).toContain("● ยืนยันแล้ว");
    expect(html).toContain("การบันทึกลงสมุดบัญชีแยกประเภท");
    expect(html).toContain("พร้อมบันทึกบัญชี");
  });
});
