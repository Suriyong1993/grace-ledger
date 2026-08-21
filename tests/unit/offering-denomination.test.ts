import { describe, it, expect } from "vitest";
import { DenominationEngine } from "../../src/lib/offering/denomination-engine";

describe("DenominationEngine (Thai Baht Physical Cash Calculations)", () => {
  it("calculates exact bill amounts for individual denominations", () => {
    expect(DenominationEngine.calculateBillAmount(1000, 10).toString()).toBe("10000.00");
    expect(DenominationEngine.calculateBillAmount(500, 5).toString()).toBe("2500.00");
    expect(DenominationEngine.calculateBillAmount(100, 12).toString()).toBe("1200.00");
    expect(DenominationEngine.calculateBillAmount(50, 7).toString()).toBe("350.00");
    expect(DenominationEngine.calculateBillAmount(20, 15).toString()).toBe("300.00");
  });

  it("calculates zero for 0 counts", () => {
    expect(DenominationEngine.calculateBillAmount(1000, 0).toString()).toBe("0.00");
    expect(DenominationEngine.calculateBillAmount(500, 0).toString()).toBe("0.00");
  });

  it("throws on negative or non-integer counts", () => {
    expect(() => DenominationEngine.calculateBillAmount(1000, -1)).toThrow();
    expect(() => DenominationEngine.calculateBillAmount(1000, 2.5)).toThrow();
  });

  it("calculates grand total and breakdown correctly across all denominations and coins", () => {
    // 10x1000 + 4x500 + 15x100 + 8x50 + 25x20 + 345.50 coins
    // = 10,000 + 2,000 + 1,500 + 400 + 500 + 345.50 = 14,745.50
    const result = DenominationEngine.calculateTotal({
      b1000: 10,
      b500: 4,
      b100: 15,
      b50: 8,
      b20: 25,
      coins: "345.50",
    });

    expect(result.billTotal.toString()).toBe("14400.00");
    expect(result.coinTotal.toString()).toBe("345.50");
    expect(result.grandTotal.toString()).toBe("14745.50");

    expect(result.breakdown.b1000.total.toString()).toBe("10000.00");
    expect(result.breakdown.b500.total.toString()).toBe("2000.00");
    expect(result.breakdown.b100.total.toString()).toBe("1500.00");
    expect(result.breakdown.b50.total.toString()).toBe("400.00");
    expect(result.breakdown.b20.total.toString()).toBe("500.00");
    expect(result.breakdown.coins.total.toString()).toBe("345.50");
  });

  it("handles empty / partial denominations cleanly", () => {
    const result = DenominationEngine.calculateTotal({
      b1000: 5,
    });
    expect(result.grandTotal.toString()).toBe("5000.00");
    expect(result.coinTotal.toString()).toBe("0.00");
  });

  it("validates input data correctly", () => {
    const valid = DenominationEngine.validate({
      b1000: 10,
      b500: 2,
      b100: 0,
      coins: 50.25,
    });
    expect(valid.isValid).toBe(true);
    expect(valid.errors).toHaveLength(0);

    const invalid = DenominationEngine.validate({
      b1000: -2,
      b500: 3.5,
      coins: -10,
    });
    expect(invalid.isValid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThanOrEqual(3);
  });
});
