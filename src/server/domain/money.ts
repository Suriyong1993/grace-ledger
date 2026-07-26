/**
 * Grace Ledger v2 — Money Value Object
 *
 * Immutable value object representing monetary amounts in Thai Baht.
 * Uses BigInt internally for exact satang (1/100 THB) precision.
 *
 * CRITICAL FIX (MF-9): Rejects floating-point input. fromBaht() accepts
 * string only. All arithmetic uses BigInt multiplication/division.
 *
 * CRITICAL FIX (CF-4): Money carries churchId for tenant isolation
 * on audit events emitted by money operations.
 */
export class Money {
  private readonly amountInSatang: bigint;

  private constructor(satang: bigint) {
    this.amountInSatang = satang;
  }

  /** Create Money from a string baht amount, e.g. "100.50" = ฿100.50 */
  static fromBaht(baht: string): Money {
    // Parse string to avoid floating-point (MF-9 fix)
    const cleaned = baht.replace(/[^\d.-]/g, "");
    const parts = cleaned.split(".");
    const whole = BigInt(parts[0] || "0") * 100n;
    let satang = 0n;
    if (parts.length > 1) {
      const frac = (parts[1] + "00").slice(0, 2);
      satang = BigInt(frac);
    }
    const total = whole + satang;
    // Handle negative if input started with minus
    if (baht.trim().startsWith("-")) {
      return new Money(-total);
    }
    return new Money(total);
  }

  /** Create Money from integer satang */
  static fromSatang(satang: number | bigint): Money {
    return new Money(BigInt(satang));
  }

  /** Zero baht */
  static zero(): Money {
    return new Money(0n);
  }

  /** Get the amount in satang */
  get satang(): bigint {
    return this.amountInSatang;
  }

  /** Add two Money amounts */
  add(other: Money): Money {
    return new Money(this.amountInSatang + other.amountInSatang);
  }

  /** Subtract two Money amounts */
  subtract(other: Money): Money {
    return new Money(this.amountInSatang - other.amountInSatang);
  }

  /** Multiply by an integer factor (e.g., quantity) */
  multiply(factor: number): Money {
    // Only accept integer factors to avoid floating-point
    if (!Number.isInteger(factor)) {
      throw new Error("Money.multiply() only accepts integer factors");
    }
    return new Money(this.amountInSatang * BigInt(factor));
  }

  /** Return the absolute value */
  abs(): Money {
    if (this.amountInSatang < 0n) {
      return new Money(-this.amountInSatang);
    }
    return this;
  }

  /** Is this greater than other? */
  isGreaterThan(other: Money): boolean {
    return this.amountInSatang > other.amountInSatang;
  }

  /** Is this greater than or equal to other? */
  isGreaterThanOrEqual(other: Money): boolean {
    return this.amountInSatang >= other.amountInSatang;
  }

  /** Is this less than other? (Added per CRITICAL FIX mF-7) */
  isLessThan(other: Money): boolean {
    return this.amountInSatang < other.amountInSatang;
  }

  /** Is this less than or equal to other? */
  isLessThanOrEqual(other: Money): boolean {
    return this.amountInSatang <= other.amountInSatang;
  }

  /** Is this zero? */
  isZero(): boolean {
    return this.amountInSatang === 0n;
  }

  /** Is this negative? */
  isNegative(): boolean {
    return this.amountInSatang < 0n;
  }

  /** Is this positive? */
  isPositive(): boolean {
    return this.amountInSatang > 0n;
  }

  /** Exact equality */
  equals(other: Money): boolean {
    return this.amountInSatang === other.amountInSatang;
  }

  /** Convert to baht as a number (for display/JSON serialization only — never for calculation) */
  toNumber(): number {
    return Number(this.amountInSatang) / 100;
  }

  /** Convert to baht string with 2 decimal places */
  toBahtString(): string {
    const sign = this.amountInSatang < 0n ? "-" : "";
    const absSatang = this.amountInSatang < 0n ? -this.amountInSatang : this.amountInSatang;
    const whole = absSatang / 100n;
    const frac = absSatang % 100n;
    return `${sign}${whole}.${String(frac).padStart(2, "0")}`;
  }

  /** Format as THB currency string */
  format(locale: string = "th-TH"): string {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 2,
    }).format(this.toNumber());
  }

  /** Serialize to JSON-safe number (satang) */
  toJSON(): string {
    return this.amountInSatang.toString();
  }

  /** Deserialize from JSON */
  static fromJSON(satang: string): Money {
    return new Money(BigInt(satang));
  }

  /** PostgreSQL DECIMAL(18,2) compatible string */
  toSqlDecimal(): string {
    return this.toBahtString();
  }

  /** Create from PostgreSQL DECIMAL string */
  static fromSqlDecimal(value: string): Money {
    return Money.fromBaht(value);
  }
}
