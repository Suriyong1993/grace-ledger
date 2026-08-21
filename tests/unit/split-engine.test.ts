import { describe, it, expect } from "vitest";
import { SplitEngine } from "@/lib/transactions/split-engine";
import { Money } from "@/lib/money";

describe("M2 Split Engine Unit Tests", () => {
  const FUND_A = "fund-1111-1111-1111";
  const FUND_B = "fund-2222-2222-2222";
  const FUND_C = "fund-3333-3333-3333";

  it("calculates exact sum for multi-fund splits using Money", () => {
    const splits = [
      { fundId: FUND_A, amount: "1500.50" },
      { fundId: FUND_B, amount: "2500.25" },
      { fundId: FUND_C, amount: "999.25" },
    ];
    const sum = SplitEngine.calculateSum(splits);
    expect(sum.toAmountString()).toBe("5000.00");
  });

  it("calculates remaining unallocated balance correctly", () => {
    const splits = [
      { fundId: FUND_A, amount: "3000.00" },
      { fundId: FUND_B, amount: "1500.00" },
    ];
    const remaining = SplitEngine.calculateRemaining("5000.00", splits);
    expect(remaining.toAmountString()).toBe("500.00");
  });

  it("validates perfect split parity (SUM == amount)", () => {
    const splits = [
      { fundId: FUND_A, amount: "6666.67" },
      { fundId: FUND_B, amount: "3333.33" },
    ];
    const result = SplitEngine.validateParity("10000.00", splits);
    expect(result.isValid).toBe(true);
    expect(result.difference.isZero()).toBe(true);
    expect(result.remainingUnallocated.isZero()).toBe(true);
  });

  it("detects under-allocation with exact difference", () => {
    const splits = [
      { fundId: FUND_A, amount: "6000.00" },
      { fundId: FUND_B, amount: "3000.00" },
    ];
    const result = SplitEngine.validateParity("10000.00", splits);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("Under-allocated");
    expect(result.remainingUnallocated.toAmountString()).toBe("1000.00");
  });

  it("detects over-allocation with exact difference", () => {
    const splits = [
      { fundId: FUND_A, amount: "6000.00" },
      { fundId: FUND_B, amount: "5000.00" },
    ];
    const result = SplitEngine.validateParity("10000.00", splits);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("Over-allocated");
    expect(result.difference.toAmountString()).toBe("1000.00");
  });

  it("rejects splits missing a fundId", () => {
    const splits = [
      { fundId: "", amount: "5000.00" },
    ];
    const result = SplitEngine.validateParity("5000.00", splits);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("missing a required fund_id");
  });

  it("rejects non-positive or negative split amounts", () => {
    const splits = [
      { fundId: FUND_A, amount: "-50.00" },
    ];
    const result = SplitEngine.validateParity("5000.00", splits);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("non-positive amount");
  });

  it("distributes total amount evenly with remainder satang preservation", () => {
    // 100.00 Baht across 3 funds = 33.34 + 33.33 + 33.33 = 100.00 Baht exact
    const distributed = SplitEngine.distributeEvenly("100.00", [FUND_A, FUND_B, FUND_C]);
    expect(distributed).toHaveLength(3);
    expect(distributed[0].amount.toAmountString()).toBe("33.34");
    expect(distributed[1].amount.toAmountString()).toBe("33.33");
    expect(distributed[2].amount.toAmountString()).toBe("33.33");

    const totalAllocated = distributed.reduce((acc, d) => acc.add(d.amount), Money.zero());
    expect(totalAllocated.toAmountString()).toBe("100.00");
  });

  it("distributes by percentage with remainder adjustment", () => {
    // 1000.00 Baht: 70%, 20%, 10%
    const distributed = SplitEngine.distributeByPercentages("1000.00", [
      { fundId: FUND_A, percentage: 70 },
      { fundId: FUND_B, percentage: 20 },
      { fundId: FUND_C, percentage: 10 },
    ]);
    expect(distributed[0].amount.toAmountString()).toBe("700.00");
    expect(distributed[1].amount.toAmountString()).toBe("200.00");
    expect(distributed[2].amount.toAmountString()).toBe("100.00");

    const totalAllocated = distributed.reduce((acc, d) => acc.add(d.amount), Money.zero());
    expect(totalAllocated.toAmountString()).toBe("1000.00");
  });

  it("throws when percentage sum does not equal 100%", () => {
    expect(() =>
      SplitEngine.distributeByPercentages("1000.00", [
        { fundId: FUND_A, percentage: 50 },
        { fundId: FUND_B, percentage: 40 },
      ])
    ).toThrow("Total percentage must equal 100%");
  });
});
