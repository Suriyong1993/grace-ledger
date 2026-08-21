import { describe, it, expect } from "vitest";
import { VarianceEngine } from "../../src/lib/offering/variance-engine";

describe("VarianceEngine (Channel Segregation & Variance Analysis)", () => {
  it("segregates totals by payment channel correctly", () => {
    const items = [
      { paymentChannel: "cash" as const, amount: "10000.00" },
      { paymentChannel: "bank_transfer" as const, amount: "3000.00" },
      { paymentChannel: "qr_code" as const, amount: "5450.00" },
      { paymentChannel: "cash" as const, amount: "2500.00" },
      { paymentChannel: "other" as const, amount: "100.00" },
    ];

    const result = VarianceEngine.calculateChannelTotals(items);

    expect(result.cashTotal.toString()).toBe("12500.00");
    expect(result.transferTotal.toString()).toBe("3000.00");
    expect(result.qrTotal.toString()).toBe("5450.00");
    expect(result.otherTotal.toString()).toBe("100.00");
    expect(result.grandTotal.toString()).toBe("21050.00");
  });

  it("calculates zero variance when expected cash matches counted cash", () => {
    const res = VarianceEngine.calculateCashVariance("10000.00", "10000.00");
    expect(res.varianceAmount.toString()).toBe("0.00");
    expect(res.isZeroMatch).toBe(true);
    expect(res.isShortage).toBe(false);
    expect(res.isSurplus).toBe(false);
    expect(res.varianceStatus).toBe("zero_match");
    expect(res.percentage).toBe(0);
  });

  it("calculates cash shortage (negative variance) correctly", () => {
    // Expected: 10,000, Actual: 9,950 -> Variance: -50 (-0.5%)
    const res = VarianceEngine.calculateCashVariance("10000.00", "9950.00");
    expect(res.varianceAmount.toString()).toBe("-50.00");
    expect(res.isZeroMatch).toBe(false);
    expect(res.isShortage).toBe(true);
    expect(res.isSurplus).toBe(false);
    expect(res.varianceStatus).toBe("variance_detected");
    expect(res.percentage).toBe(-0.5);
  });

  it("calculates cash surplus (positive variance) correctly", () => {
    // Expected: 8,000, Actual: 8,200 -> Variance: +200 (+2.5%)
    const res = VarianceEngine.calculateCashVariance("8000.00", "8200.00");
    expect(res.varianceAmount.toString()).toBe("200.00");
    expect(res.isZeroMatch).toBe(false);
    expect(res.isShortage).toBe(false);
    expect(res.isSurplus).toBe(true);
    expect(res.varianceStatus).toBe("variance_detected");
    expect(res.percentage).toBe(2.5);
  });

  it("evaluates confirmation readiness based on variance clearance", () => {
    // Zero variance -> allowed without explanation
    expect(
      VarianceEngine.isVarianceAcceptableForConfirmation("0.00", "zero_match").canConfirm
    ).toBe(true);

    // Non-zero variance with status 'variance_detected' -> blocked
    const unreviewed = VarianceEngine.isVarianceAcceptableForConfirmation(
      "-50.00",
      "variance_detected",
      null
    );
    expect(unreviewed.canConfirm).toBe(false);
    expect(unreviewed.reason).toContain("ยังไม่ได้รับการอธิบาย");

    // Non-zero variance with short explanation (< 5 chars) -> blocked
    const shortReason = VarianceEngine.isVarianceAcceptableForConfirmation(
      "-50.00",
      "explained",
      "fix"
    );
    expect(shortReason.canConfirm).toBe(false);
    expect(shortReason.reason).toContain("อย่างน้อย 5 ตัวอักษร");

    // Non-zero variance with valid explanation >= 5 chars and status 'explained' -> allowed
    const valid = VarianceEngine.isVarianceAcceptableForConfirmation(
      "-50.00",
      "explained",
      "พบซองที่ 12 เงินสดขาด 50 บาท ผู้ถวายยืนยันแล้ว"
    );
    expect(valid.canConfirm).toBe(true);
  });
});
