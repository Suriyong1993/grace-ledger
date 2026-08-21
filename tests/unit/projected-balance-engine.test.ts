import { describe, it, expect } from "vitest";
import { Money } from "../../src/lib/money";
import { ProjectedBalanceEngine } from "../../src/lib/transactions/projected-balance-engine";

describe("ProjectedBalanceEngine — Canonical Projected Fund Balance", () => {
  const generalFund = {
    id: "fund-general-01",
    name: "กองทุนทั่วไป",
    currentBalance: Money.from("50000.00"),
  };

  const youthFund = {
    id: "fund-youth-02",
    name: "กองทุนเยาวชน",
    currentBalance: Money.from("12010.00"),
  };

  const buildingFund = {
    id: "fund-building-03",
    name: "กองทุนสร้างพระวิหาร",
    currentBalance: Money.from("100000.00"),
  };

  it("calculates positive delta for Income transaction", () => {
    const incomeTxn = {
      direction: "income" as const,
      amount: Money.from("20000.00"),
      splits: [{ fundId: generalFund.id, amount: Money.from("20000.00") }],
    };

    const result = ProjectedBalanceEngine.calculateProjectedFundBalance(
      generalFund,
      incomeTxn,
      []
    );

    expect(result.currentPostedBalance.toString()).toBe("50000.00");
    expect(result.evaluatingTransactionImpact.toString()).toBe("20000.00");
    expect(result.projectedBalance.toString()).toBe("70000.00");
    expect(result.isDeficit).toBe(false);
  });

  it("calculates negative delta for Expense transaction", () => {
    const expenseTxn = {
      direction: "expense" as const,
      amount: Money.from("8500.00"),
      splits: [{ fundId: youthFund.id, amount: Money.from("8500.00") }],
    };

    const result = ProjectedBalanceEngine.calculateProjectedFundBalance(
      youthFund,
      expenseTxn,
      []
    );

    expect(result.currentPostedBalance.toString()).toBe("12010.00");
    expect(result.evaluatingTransactionImpact.toString()).toBe("-8500.00");
    expect(result.projectedBalance.toString()).toBe("3510.00");
    expect(result.isDeficit).toBe(false);
  });

  it("calculates Deficit (Overdraft) correctly when expense exceeds balance", () => {
    const bigExpenseTxn = {
      direction: "expense" as const,
      amount: Money.from("15000.00"),
      splits: [{ fundId: youthFund.id, amount: Money.from("15000.00") }],
    };

    const result = ProjectedBalanceEngine.calculateProjectedFundBalance(
      youthFund,
      bigExpenseTxn,
      []
    );

    expect(result.projectedBalance.toString()).toBe("-2990.00");
    expect(result.isDeficit).toBe(true);
    expect(result.deficitAmount?.toString()).toBe("2990.00");
  });

  it("handles Transfer In (+) and Transfer Out (-) with zero double-counting", () => {
    const transferTxn = {
      direction: "transfer" as const,
      amount: Money.from("15000.00"),
      sourceFundId: generalFund.id,
      destFundId: youthFund.id,
    };

    // Calculate on Source Fund (General Fund)
    const sourceResult = ProjectedBalanceEngine.calculateProjectedFundBalance(
      generalFund,
      transferTxn,
      []
    );
    expect(sourceResult.evaluatingTransactionImpact.toString()).toBe("-15000.00");
    expect(sourceResult.projectedBalance.toString()).toBe("35000.00");

    // Calculate on Dest Fund (Youth Fund)
    const destResult = ProjectedBalanceEngine.calculateProjectedFundBalance(
      youthFund,
      transferTxn,
      []
    );
    expect(destResult.evaluatingTransactionImpact.toString()).toBe("15000.00");
    expect(destResult.projectedBalance.toString()).toBe("27010.00");

    // Calculate on Unrelated Fund (Building Fund)
    const unrelatedResult = ProjectedBalanceEngine.calculateProjectedFundBalance(
      buildingFund,
      transferTxn,
      []
    );
    expect(unrelatedResult.evaluatingTransactionImpact.toString()).toBe("0.00");
    expect(unrelatedResult.projectedBalance.toString()).toBe("100000.00");
  });

  it("handles Multi-split transaction isolating only the relevant fund", () => {
    const multiSplitExpense = {
      direction: "expense" as const,
      amount: Money.from("10000.00"),
      splits: [
        { fundId: generalFund.id, amount: Money.from("6000.00") },
        { fundId: youthFund.id, amount: Money.from("4000.00") },
      ],
    };

    const generalResult = ProjectedBalanceEngine.calculateProjectedFundBalance(
      generalFund,
      multiSplitExpense,
      []
    );
    expect(generalResult.evaluatingTransactionImpact.toString()).toBe("-6000.00");
    expect(generalResult.projectedBalance.toString()).toBe("44000.00");

    const youthResult = ProjectedBalanceEngine.calculateProjectedFundBalance(
      youthFund,
      multiSplitExpense,
      []
    );
    expect(youthResult.evaluatingTransactionImpact.toString()).toBe("-4000.00");
    expect(youthResult.projectedBalance.toString()).toBe("8010.00");
  });

  it("nets cumulative approved unposted transactions accurately", () => {
    const approvedUnposted = [
      {
        direction: "expense" as const,
        amount: Money.from("5000.00"),
        splits: [{ fundId: generalFund.id, amount: Money.from("5000.00") }],
      },
      {
        direction: "expense" as const,
        amount: Money.from("3000.00"),
        splits: [{ fundId: generalFund.id, amount: Money.from("3000.00") }],
      },
      {
        direction: "income" as const,
        amount: Money.from("2000.00"),
        splits: [{ fundId: generalFund.id, amount: Money.from("2000.00") }],
      },
    ];

    const evaluatingTxn = {
      direction: "expense" as const,
      amount: Money.from("4000.00"),
      splits: [{ fundId: generalFund.id, amount: Money.from("4000.00") }],
    };

    // Current: 50,000
    // Net approved: -5,000 - 3,000 + 2,000 = -6,000
    // Evaluating: -4,000
    // Projected: 50,000 - 6,000 - 4,000 = 40,000
    const result = ProjectedBalanceEngine.calculateProjectedFundBalance(
      generalFund,
      evaluatingTxn,
      approvedUnposted
    );

    expect(result.currentPostedBalance.toString()).toBe("50000.00");
    expect(result.approvedUnpostedImpact.toString()).toBe("-6000.00");
    expect(result.evaluatingTransactionImpact.toString()).toBe("-4000.00");
    expect(result.projectedBalance.toString()).toBe("40000.00");
    expect(result.isDeficit).toBe(false);
  });
});
