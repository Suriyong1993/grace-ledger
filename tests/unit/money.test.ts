import { describe, it, expect } from "vitest";
import { Money, sumMoney, validateSplitSum } from "@/lib/money.js";

describe("Money Domain Precision & Invariants", () => {
  it("prevents floating-point rounding errors (0.1 + 0.2 === 0.30)", () => {
    const m1 = Money.from("0.10");
    const m2 = Money.from("0.20");
    const result = m1.add(m2);

    expect(result.toFixed()).toBe("0.30");
    expect(result.toSatang()).toBe(30);
  });

  it("handles complex decimal sums with exact Satang precision", () => {
    const m1 = Money.from("128450.75");
    const m2 = Money.from("18450.25");
    const m3 = Money.from("4280.00");

    const total = m1.add(m2).subtract(m3);
    expect(total.toFixed()).toBe("142621.00");
    expect(total.toSatang()).toBe(14262100);
  });

  it("converts between integer Satang and Baht without loss", () => {
    const m = Money.fromSatang(1845000); // ฿18,450.00
    expect(m.toFixed()).toBe("18450.00");
    expect(m.format()).toBe("฿18,450.00");
  });

  it("formats Thai Baht correctly with symbols and signs", () => {
    const income = Money.from("18450.00");
    const expense = Money.from("-4280.00");
    const zero = Money.zero();

    expect(income.format({ showSign: true })).toBe("+฿18,450.00");
    expect(expense.format()).toBe("−฿4,280.00");
    expect(zero.format()).toBe("฿0.00");
  });

  it("accurately sums multiple splits and verifies exact match", () => {
    const total = Money.from("10000.00");
    const splits = [
      Money.from("6000.00"),
      Money.from("2500.50"),
      Money.from("1499.50"),
    ];

    expect(sumMoney(splits).equals(total)).toBe(true);
    expect(validateSplitSum(total, splits)).toBe(true);
  });

  it("rejects mismatched split totals", () => {
    const total = Money.from("10000.00");
    const splits = [
      Money.from("6000.00"),
      Money.from("3999.99"), // 1 satang short
    ];

    expect(validateSplitSum(total, splits)).toBe(false);
  });

  it("rejects invalid money inputs", () => {
    expect(() => Money.from("invalid")).toThrow(/Failed to parse money/);
    expect(() => Money.fromSatang(10.5)).toThrow(/integer/);
    expect(() => Money.from("100").divide(0)).toThrow(/zero/);
  });
});
