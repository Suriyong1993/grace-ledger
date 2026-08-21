import { Money, MoneyInput } from "../money";
import { DenominationCalculationResult } from "./types";

/**
 * Denomination Engine for Physical Cash Counts
 * Uses strict integer satang and Money arithmetic without floating-point errors.
 */
export class DenominationEngine {
  public static readonly VALID_BILL_DENOMINATIONS = [1000, 500, 100, 50, 20] as const;

  /**
   * Calculates total value for a specific bill denomination and count.
   */
  public static calculateBillAmount(
    denomination: 1000 | 500 | 100 | 50 | 20,
    count: number
  ): Money {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`Invalid bill count for ฿${denomination}: ${count}. Count must be a non-negative integer.`);
    }
    // denomination * count in Baht -> convert to exact Satang
    const satang = Math.round(denomination * 100) * count;
    return Money.fromSatang(satang);
  }

  /**
   * Calculates full breakdown and grand total from bill counts and coin amount.
   */
  public static calculateTotal(denominations: {
    b1000?: number;
    b500?: number;
    b100?: number;
    b50?: number;
    b20?: number;
    coins?: MoneyInput;
  }): DenominationCalculationResult {
    const c1000 = Math.max(0, Math.floor(denominations.b1000 ?? 0));
    const c500  = Math.max(0, Math.floor(denominations.b500 ?? 0));
    const c100  = Math.max(0, Math.floor(denominations.b100 ?? 0));
    const c50   = Math.max(0, Math.floor(denominations.b50 ?? 0));
    const c20   = Math.max(0, Math.floor(denominations.b20 ?? 0));
    
    const coinMoney = denominations.coins ? Money.from(denominations.coins) : Money.zero();
    if (coinMoney.isNegative()) {
      throw new Error("Coin amount cannot be negative.");
    }

    const t1000 = this.calculateBillAmount(1000, c1000);
    const t500  = this.calculateBillAmount(500, c500);
    const t100  = this.calculateBillAmount(100, c100);
    const t50   = this.calculateBillAmount(50, c50);
    const t20   = this.calculateBillAmount(20, c20);

    const billTotal = t1000.add(t500).add(t100).add(t50).add(t20);
    const grandTotal = billTotal.add(coinMoney);

    return {
      billTotal,
      coinTotal: coinMoney,
      grandTotal,
      breakdown: {
        b1000: { denomination: 1000, count: c1000, total: t1000 },
        b500:  { denomination: 500,  count: c500,  total: t500 },
        b100:  { denomination: 100,  count: c100,  total: t100 },
        b50:   { denomination: 50,   count: c50,   total: t50 },
        b20:   { denomination: 20,   count: c20,   total: t20 },
        coins: { total: coinMoney },
      },
    };
  }

  /**
   * Validates denomination inputs before submitting.
   */
  public static validate(denominations: {
    b1000?: any;
    b500?: any;
    b100?: any;
    b50?: any;
    b20?: any;
    coins?: any;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    const checkInt = (val: any, label: string) => {
      if (val === undefined || val === null || val === "") return;
      const num = Number(val);
      if (isNaN(num) || !Number.isInteger(num) || num < 0) {
        errors.push(`จำนวนธนบัตร ${label} ต้องเป็นจำนวนเต็มที่ไม่ติดลบ`);
      }
    };

    checkInt(denominations.b1000, "1,000 บาท");
    checkInt(denominations.b500, "500 บาท");
    checkInt(denominations.b100, "100 บาท");
    checkInt(denominations.b50, "50 บาท");
    checkInt(denominations.b20, "20 บาท");

    if (denominations.coins !== undefined && denominations.coins !== null && denominations.coins !== "") {
      try {
        const m = Money.from(denominations.coins);
        if (m.isNegative()) {
          errors.push("จำนวนเหรียญรวมต้องไม่ติดลบ");
        }
      } catch (err: any) {
        errors.push("ยอดเงินเหรียญไม่ถูกต้อง: " + err.message);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
