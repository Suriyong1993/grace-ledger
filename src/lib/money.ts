import { Decimal } from "decimal.js";

/**
 * Money input type supporting strings, numbers, Decimal instances, and Money instances
 */
export type MoneyInput = string | number | Decimal | Money;

export interface MoneyFormatOptions {
  locale?: string;
  currency?: string;
  showCurrency?: boolean;
  showSign?: boolean;
}

/**
 * Financial Money Class with Exact Decimal Precision
 * Eliminates floating point inaccuracies (e.g. 0.1 + 0.2 != 0.3)
 */
export class Money {
  private readonly value: Decimal;

  private constructor(val: Decimal) {
    // Quantize to exact 2 decimal places with half-even banker's rounding
    this.value = val.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  }

  /**
   * Factory from string, number, Decimal, or Money
   */
  public static from(input: MoneyInput): Money {
    if (input instanceof Money) {
      return input;
    }
    if (input instanceof Decimal) {
      return new Money(input);
    }
    if (typeof input === "string" || typeof input === "number") {
      try {
        const d = new Decimal(input);
        if (d.isNaN()) {
          throw new Error("Invalid NaN amount");
        }
        return new Money(d);
      } catch (err: any) {
        throw new Error(`Failed to parse money value: "${input}". ${err.message}`);
      }
    }
    throw new Error(`Unsupported money input type: ${typeof input}`);
  }

  /**
   * Factory from integer Satang (1 Baht = 100 Satang)
   */
  public static fromSatang(satang: number): Money {
    if (!Number.isInteger(satang)) {
      throw new Error(`Satang must be an integer: received ${satang}`);
    }
    return new Money(new Decimal(satang).dividedBy(100));
  }

  /**
   * Zero amount
   */
  public static zero(): Money {
    return new Money(new Decimal(0));
  }

  private static toDecimal(other: MoneyInput): Decimal {
    if (other instanceof Money) {
      return other.value;
    }
    if (other instanceof Decimal) {
      return other;
    }
    return new Decimal(other);
  }

  public add(other: MoneyInput): Money {
    return new Money(this.value.plus(Money.toDecimal(other)));
  }

  public subtract(other: MoneyInput): Money {
    return new Money(this.value.minus(Money.toDecimal(other)));
  }

  public multiply(factor: number | string | Decimal): Money {
    return new Money(this.value.times(factor));
  }

  public divide(divisor: number | string | Decimal): Money {
    const d = new Decimal(divisor);
    if (d.isZero()) {
      throw new Error("Division by zero in Money calculation");
    }
    return new Money(this.value.dividedBy(d));
  }

  public equals(other: MoneyInput): boolean {
    return this.value.equals(Money.toDecimal(other));
  }

  public greaterThan(other: MoneyInput): boolean {
    return this.value.greaterThan(Money.toDecimal(other));
  }

  public greaterThanOrEqualTo(other: MoneyInput): boolean {
    return this.value.greaterThanOrEqualTo(Money.toDecimal(other));
  }

  public lessThan(other: MoneyInput): boolean {
    return this.value.lessThan(Money.toDecimal(other));
  }

  public lessThanOrEqualTo(other: MoneyInput): boolean {
    return this.value.lessThanOrEqualTo(Money.toDecimal(other));
  }

  public isZero(): boolean {
    return this.value.isZero();
  }

  public isPositive(): boolean {
    return this.value.isPositive() && !this.value.isZero();
  }

  public isNegative(): boolean {
    return this.value.isNegative() && !this.value.isZero();
  }

  public toSatang(): number {
    return this.value.times(100).toNumber();
  }

  public toFixed(decimals: number = 2): string {
    return this.value.toFixed(decimals);
  }

  public abs(): Money {
    return new Money(this.value.abs());
  }

  public toNumber(): number {
    return this.value.toNumber();
  }

  public toDecimal(): Decimal {
    return new Decimal(this.value);
  }

  public toString(): string {
    return this.toFixed(2);
  }

  public toAmountString(): string {
    return this.toFixed(2);
  }

  public toJSON(): string {
    return this.toFixed(2);
  }

  /**
   * Format for display (e.g. ฿18,450.00)
   */
  public format(options: MoneyFormatOptions = {}): string {
    const {
      currency = "THB",
      showCurrency = true,
      showSign = false,
    } = options;

    const num = this.value.toNumber();
    const formatted = new Intl.NumberFormat("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(num));

    const symbol = currency === "THB" ? "฿" : `${currency} `;
    const sign = this.isNegative() ? "−" : showSign && this.isPositive() ? "+" : "";

    return showCurrency ? `${sign}${symbol}${formatted}` : `${sign}${formatted}`;
  }
}

/**
 * Helper to sum an array of Money inputs
 */
export function sumMoney(items: MoneyInput[]): Money {
  return items.reduce<Money>((acc, item) => acc.add(item), Money.zero());
}

/**
 * Validates that an array of split amounts exactly equals a total
 */
export function validateSplitSum(total: MoneyInput, splits: MoneyInput[]): boolean {
  const totalMoney = Money.from(total);
  const splitSum = sumMoney(splits);
  return totalMoney.equals(splitSum);
}
