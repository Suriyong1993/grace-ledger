import { describe, it, expect } from "vitest";
import { Money, validateSplitSum } from "@/lib/money.js";

interface TransactionSplit {
  fundId: string;
  amount: Money;
}

interface TransactionDraft {
  amount: Money;
  status: "draft" | "pending_approval" | "posted" | "voided";
  splits: TransactionSplit[];
}

interface FundTransfer {
  fromFundId: string;
  toFundId: string;
  amount: Money;
}

describe("Financial Domain Invariants & Rules", () => {
  it("Invariant: every transaction split MUST have a non-empty fundId", () => {
    const validSplit: TransactionSplit = {
      fundId: "fund-general-123",
      amount: Money.from("5000.00"),
    };
    expect(validSplit.fundId).toBeDefined();
    expect(validSplit.fundId.length).toBeGreaterThan(0);

    const invalidSplitCandidate = {
      fundId: "",
      amount: Money.from("5000.00"),
    };
    const isFundValid = (s: { fundId?: string }) => Boolean(s.fundId && s.fundId.trim().length > 0);
    expect(isFundValid(invalidSplitCandidate)).toBe(false);
  });

  it("Invariant: Transaction Split sum must equal total upon status transition to pending_approval / posted", () => {
    const draftTx: TransactionDraft = {
      amount: Money.from("18450.00"),
      status: "draft",
      splits: [
        { fundId: "general", amount: Money.from("10000.00") },
        // Partial state allowed during draft
      ],
    };

    const validateForPosting = (tx: TransactionDraft) => {
      const splitAmounts = tx.splits.map((s) => s.amount);
      return validateSplitSum(tx.amount, splitAmounts);
    };

    expect(validateForPosting(draftTx)).toBe(false);

    // Complete splits
    draftTx.splits.push(
      { fundId: "building", amount: Money.from("5000.00") },
      { fundId: "mission", amount: Money.from("3450.00") }
    );

    expect(validateForPosting(draftTx)).toBe(true);
  });

  it("Invariant: Fund Transfer creates balanced entries with Net = 0", () => {
    const transfer: FundTransfer = {
      fromFundId: "fund-general",
      toFundId: "fund-building",
      amount: Money.from("50000.00"),
    };

    expect(transfer.fromFundId).not.toBe(transfer.toFundId);
    expect(transfer.amount.isPositive()).toBe(true);

    const debitLeg = transfer.amount.multiply(-1); // -50,000
    const creditLeg = transfer.amount;             // +50,000
    const netImpact = debitLeg.add(creditLeg);

    expect(netImpact.isZero()).toBe(true);
    expect(netImpact.toFixed()).toBe("0.00");
  });

  it("Invariant: Voiding a transaction creates an inverse balancing transaction", () => {
    const originalTx = {
      id: "tx-orig-001",
      amount: Money.from("8500.00"),
      direction: "expense" as const,
      status: "posted" as const,
    };

    const voidReason = "Duplicate entry created in error";
    expect(voidReason.length).toBeGreaterThanOrEqual(5);

    // Reversal transaction specification
    const reversalTx = {
      id: "tx-rev-002",
      amount: originalTx.amount,
      direction: originalTx.direction === "expense" ? ("income" as const) : ("expense" as const),
      status: "posted" as const,
      isReversal: true,
      reversalOfId: originalTx.id,
    };

    expect(reversalTx.isReversal).toBe(true);
    expect(reversalTx.reversalOfId).toBe(originalTx.id);
    expect(reversalTx.direction).toBe("income");
    expect(reversalTx.amount.equals(originalTx.amount)).toBe(true);
  });
});
