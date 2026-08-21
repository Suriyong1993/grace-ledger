import { Money, MoneyInput } from "../money";
import { SplitParityResult } from "./types";

export interface SplitInput {
  fundId: string;
  categoryId?: string | null;
  amount: MoneyInput;
  note?: string | null;
}

export class SplitEngine {
  /**
   * Calculate total sum of given splits
   */
  public static calculateSum(splits: SplitInput[]): Money {
    return splits.reduce((acc, split) => {
      const splitMoney = Money.from(split.amount);
      if (splitMoney.isNegative() || splitMoney.isZero()) {
        throw new Error(`Invalid split amount: ${splitMoney.toAmountString()}. Split amounts must be strictly positive.`);
      }
      return acc.add(splitMoney);
    }, Money.zero());
  }

  /**
   * Calculate remaining unallocated amount for a transaction
   */
  public static calculateRemaining(
    transactionAmount: MoneyInput,
    splits: SplitInput[]
  ): Money {
    const total = Money.from(transactionAmount);
    if (total.isNegative() || total.isZero()) {
      throw new Error(`Invalid transaction amount: ${total.toAmountString()}. Amount must be strictly positive.`);
    }
    const allocated = this.calculateSum(splits);
    return total.subtract(allocated);
  }

  /**
   * Validate split parity against transaction amount
   * Rule: SUM(splits) === transaction.amount exactly
   */
  public static validateParity(
    transactionAmount: MoneyInput,
    splits: SplitInput[]
  ): SplitParityResult {
    const total = Money.from(transactionAmount);
    
    if (total.isNegative() || total.isZero()) {
      return {
        isValid: false,
        transactionAmount: total,
        allocatedSum: Money.zero(),
        remainingUnallocated: total,
        difference: total,
        error: "Transaction amount must be strictly greater than zero."
      };
    }

    if (splits.length === 0) {
      return {
        isValid: false,
        transactionAmount: total,
        allocatedSum: Money.zero(),
        remainingUnallocated: total,
        difference: total,
        error: "Transaction must have at least one split."
      };
    }

    // Check for missing fundId or invalid amounts
    for (let i = 0; i < splits.length; i++) {
      const s = splits[i];
      if (!s.fundId || s.fundId.trim() === "") {
        return {
          isValid: false,
          transactionAmount: total,
          allocatedSum: Money.zero(),
          remainingUnallocated: total,
          difference: total,
          error: `Split #${i + 1} is missing a required fund_id.`
        };
      }
      const sMoney = Money.from(s.amount);
      if (sMoney.isNegative() || sMoney.isZero()) {
        return {
          isValid: false,
          transactionAmount: total,
          allocatedSum: Money.zero(),
          remainingUnallocated: total,
          difference: total,
          error: `Split #${i + 1} has non-positive amount (${sMoney.toAmountString()}).`
        };
      }
    }

    const allocatedSum = this.calculateSum(splits);
    const difference = total.subtract(allocatedSum);

    if (difference.isZero()) {
      return {
        isValid: true,
        transactionAmount: total,
        allocatedSum,
        remainingUnallocated: Money.zero(),
        difference: Money.zero()
      };
    }

    if (difference.isPositive()) {
      return {
        isValid: false,
        transactionAmount: total,
        allocatedSum,
        remainingUnallocated: difference,
        difference,
        error: `Under-allocated: Split sum (${allocatedSum.toAmountString()}) is less than transaction amount (${total.toAmountString()}) by ฿${difference.toAmountString()}.`
      };
    }

    return {
      isValid: false,
      transactionAmount: total,
      allocatedSum,
      remainingUnallocated: difference,
      difference: difference.abs(),
      error: `Over-allocated: Split sum (${allocatedSum.toAmountString()}) exceeds transaction amount (${total.toAmountString()}) by ฿${difference.abs().toAmountString()}.`
    };
  }

  /**
   * Distribute total transaction amount evenly across N funds
   * Handles satang rounding remainder distribution so sum matches total exactly
   */
  public static distributeEvenly(
    totalAmount: MoneyInput,
    fundIds: string[]
  ): Array<{ fundId: string; amount: Money }> {
    if (fundIds.length === 0) {
      throw new Error("Must provide at least one fund ID.");
    }
    const total = Money.from(totalAmount);
    if (total.isNegative() || total.isZero()) {
      throw new Error("Total amount must be strictly positive.");
    }

    const totalSatang = total.toSatang();
    const count = fundIds.length;
    const baseSatang = Math.floor(totalSatang / count);
    const remainderSatang = totalSatang % count;

    return fundIds.map((fundId, index) => {
      // Distribute the 1-satang remainders to the first N splits
      const satang = index < remainderSatang ? baseSatang + 1 : baseSatang;
      return {
        fundId,
        amount: Money.fromSatang(satang)
      };
    });
  }

  /**
   * Distribute total transaction amount by percentage ratios
   * Adjusts last split for rounding difference so sum equals total exactly
   */
  public static distributeByPercentages(
    totalAmount: MoneyInput,
    allocations: Array<{ fundId: string; percentage: number }>
  ): Array<{ fundId: string; amount: Money }> {
    if (allocations.length === 0) {
      throw new Error("Must provide at least one allocation.");
    }
    const total = Money.from(totalAmount);
    const totalSatang = total.toSatang();

    const sumPercentage = allocations.reduce((acc, a) => acc + a.percentage, 0);
    if (Math.abs(sumPercentage - 100) > 0.0001) {
      throw new Error(`Total percentage must equal 100%: received ${sumPercentage}%`);
    }

    let allocatedSatang = 0;
    const result: Array<{ fundId: string; amount: Money }> = [];

    for (let i = 0; i < allocations.length; i++) {
      const isLast = i === allocations.length - 1;
      const { fundId, percentage } = allocations[i];

      if (isLast) {
        // Last split gets the exact remaining satang
        const satang = totalSatang - allocatedSatang;
        result.push({ fundId, amount: Money.fromSatang(satang) });
      } else {
        const satang = Math.round((totalSatang * percentage) / 100);
        allocatedSatang += satang;
        result.push({ fundId, amount: Money.fromSatang(satang) });
      }
    }

    return result;
  }
}
