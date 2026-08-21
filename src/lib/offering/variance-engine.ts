import { Money, MoneyInput } from "../money";
import {
  OfferingPaymentChannel,
  ChannelTotalsResult,
  CashVarianceResult,
  VarianceStatus,
} from "./types";

/**
 * Variance & Channel Engine for Sunday Offering
 * Performs channel segregation and calculates exact cash variance without floating-point math.
 */
export class VarianceEngine {
  /**
   * Aggregates items by payment channel (cash, bank_transfer, qr_code, other)
   * and computes expected grand total.
   */
  public static calculateChannelTotals(
    items: Array<{ paymentChannel: OfferingPaymentChannel; amount: MoneyInput }>
  ): ChannelTotalsResult {
    let cashTotal = Money.zero();
    let transferTotal = Money.zero();
    let qrTotal = Money.zero();
    let otherTotal = Money.zero();

    for (const item of items) {
      const amount = Money.from(item.amount);
      if (amount.isNegative()) {
        throw new Error("Offering item amount cannot be negative.");
      }

      switch (item.paymentChannel) {
        case "cash":
          cashTotal = cashTotal.add(amount);
          break;
        case "bank_transfer":
          transferTotal = transferTotal.add(amount);
          break;
        case "qr_code":
          qrTotal = qrTotal.add(amount);
          break;
        case "other":
        default:
          otherTotal = otherTotal.add(amount);
          break;
      }
    }

    const grandTotal = cashTotal.add(transferTotal).add(qrTotal).add(otherTotal);

    return {
      cashTotal,
      transferTotal,
      qrTotal,
      otherTotal,
      grandTotal,
    };
  }

  /**
   * Calculates cash variance: counted_cash - expected_cash
   * Note: Variance is calculated STRICTLY against physical cash only (not transfer or QR).
   */
  public static calculateCashVariance(
    expectedCashInput: MoneyInput,
    countedCashInput: MoneyInput
  ): CashVarianceResult {
    const expectedCash = Money.from(expectedCashInput);
    const countedCash = Money.from(countedCashInput);

    if (expectedCash.isNegative() || countedCash.isNegative()) {
      throw new Error("Cash amounts cannot be negative.");
    }

    const varianceAmount = countedCash.subtract(expectedCash);
    const isZeroMatch = varianceAmount.isZero();
    const isShortage = varianceAmount.isNegative();
    const isSurplus = varianceAmount.isPositive();

    let varianceStatus: VarianceStatus;
    if (isZeroMatch) {
      varianceStatus = "zero_match";
    } else {
      varianceStatus = "variance_detected";
    }

    let percentage = 0;
    if (!expectedCash.isZero()) {
      // (variance / expected) * 100
      const dExp = expectedCash.toDecimal();
      const dVar = varianceAmount.toDecimal();
      percentage = dVar.dividedBy(dExp).times(100).toDecimalPlaces(2).toNumber();
    } else if (!countedCash.isZero()) {
      percentage = 100;
    }

    return {
      expectedCash,
      countedCash,
      varianceAmount,
      varianceStatus,
      isZeroMatch,
      isShortage,
      isSurplus,
      percentage,
    };
  }

  /**
   * Evaluates if a session's variance allows confirmation:
   * 1. If variance == 0: can confirm immediately.
   * 2. If variance != 0: can only confirm if variance_status is 'explained' or 'acknowledged'
   *    and explanation reason is at least 5 characters long.
   */
  public static isVarianceAcceptableForConfirmation(
    varianceAmountInput: MoneyInput,
    varianceStatus?: VarianceStatus | null,
    explanationReason?: string | null
  ): { canConfirm: boolean; reason?: string } {
    const varianceAmount = Money.from(varianceAmountInput);

    if (varianceAmount.isZero()) {
      return { canConfirm: true };
    }

    if (!varianceStatus || !["explained", "acknowledged"].includes(varianceStatus)) {
      return {
        canConfirm: false,
        reason: `พบผลต่างเงินสด (${varianceAmount.format({ showSign: true })}) ที่ยังไม่ได้รับการอธิบาย กรุณาระบุคำอธิบายก่อนยืนยัน`,
      };
    }

    if (!explanationReason || explanationReason.trim().length < 5) {
      return {
        canConfirm: false,
        reason: "คำอธิบายผลต่างต้องมีความยาวอย่างน้อย 5 ตัวอักษร",
      };
    }

    return { canConfirm: true };
  }
}
