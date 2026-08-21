import { Money } from "../money";
import { TransactionDirection, ProjectedFundBalanceResult } from "./types";

export interface FundInput {
  id: string;
  name: string;
  currentBalance: string | number | Money;
}

export class ProjectedBalanceEngine {
  /**
   * Computes the signed impact of a single transaction (or split) on a specific fund.
   * Income = Positive (+)
   * Expense = Negative (-)
   * Transfer Out = Negative (-)
   * Transfer In = Positive (+)
   * Unrelated = Zero (0)
   */
  public static calculateTransactionFundDelta(
    fundId: string,
    transaction: {
      direction: TransactionDirection;
      amount: Money;
      splits?: Array<{ fundId: string; amount: Money }>;
      sourceFundId?: string | null;
      destFundId?: string | null;
    }
  ): Money {
    if (transaction.direction === "income") {
      if (transaction.splits && transaction.splits.length > 0) {
        const matchingSplits = transaction.splits.filter((s) => s.fundId === fundId);
        return matchingSplits.reduce((acc, s) => acc.add(s.amount), Money.zero());
      }
      // If no explicit splits, default to matching
      return transaction.amount;
    }

    if (transaction.direction === "expense") {
      if (transaction.splits && transaction.splits.length > 0) {
        const matchingSplits = transaction.splits.filter((s) => s.fundId === fundId);
        const totalMatching = matchingSplits.reduce((acc, s) => acc.add(s.amount), Money.zero());
        return Money.zero().subtract(totalMatching);
      }
      return Money.zero().subtract(transaction.amount);
    }

    if (transaction.direction === "transfer") {
      // Check if this fund is source or destination
      if (transaction.sourceFundId === fundId) {
        return Money.zero().subtract(transaction.amount);
      }
      if (transaction.destFundId === fundId) {
        return transaction.amount;
      }
      // If splits contain from/to info
      if (transaction.splits && transaction.splits.length > 0) {
        let delta = Money.zero();
        for (const s of transaction.splits) {
          if (s.fundId === fundId) {
            delta = delta.add(s.amount);
          }
        }
        return delta;
      }
      return Money.zero();
    }

    return Money.zero();
  }

  /**
   * Calculates the canonical Projected Fund Balance for a given fund:
   * Projected Balance = Current Posted Balance
   *                   + Net impact of relevant approved/unposted transactions
   *                   + Net impact of the transaction currently being evaluated
   */
  public static calculateProjectedFundBalance(
    fund: FundInput,
    evaluatingTransaction: {
      direction: TransactionDirection;
      amount: Money;
      splits?: Array<{ fundId: string; amount: Money }>;
      sourceFundId?: string | null;
      destFundId?: string | null;
    },
    approvedUnpostedTransactions: Array<{
      direction: TransactionDirection;
      amount: Money;
      splits?: Array<{ fundId: string; amount: Money }>;
      sourceFundId?: string | null;
      destFundId?: string | null;
    }> = []
  ): ProjectedFundBalanceResult {
    const currentPostedBalance =
      fund.currentBalance instanceof Money
        ? fund.currentBalance
        : Money.from(fund.currentBalance);

    // 1. Calculate net impact of all approved (unposted) transactions on this fund
    let approvedUnpostedImpact = Money.zero();
    for (const txn of approvedUnpostedTransactions) {
      const delta = this.calculateTransactionFundDelta(fund.id, txn);
      approvedUnpostedImpact = approvedUnpostedImpact.add(delta);
    }

    // 2. Calculate net impact of the evaluating transaction
    const evaluatingImpact = this.calculateTransactionFundDelta(fund.id, evaluatingTransaction);

    // 3. Projected Balance = Current + Approved/Unposted + Evaluating
    const projectedBalance = currentPostedBalance
      .add(approvedUnpostedImpact)
      .add(evaluatingImpact);

    const isDeficit = projectedBalance.isNegative();
    const deficitAmount = isDeficit ? projectedBalance.abs() : undefined;

    return {
      fundId: fund.id,
      fundName: fund.name,
      currentPostedBalance,
      approvedUnpostedImpact,
      evaluatingTransactionImpact: evaluatingImpact,
      projectedBalance,
      isDeficit,
      deficitAmount,
    };
  }
}
