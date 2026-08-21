import { Money, MoneyInput } from "../money";
import { OfferingSessionStatus, OfferingSession } from "./types";
import { VarianceEngine } from "./variance-engine";

/**
 * State Transition Graph for Sunday Offering Sessions:
 *
 * draft
 *   └──> counting
 *   └──> voided
 *
 * counting
 *   └──> counted (when variance == 0)
 *   └──> variance_review (when variance != 0)
 *   └──> voided
 *
 * counted
 *   └──> confirmed
 *   └──> counting (recount)
 *   └──> voided
 *
 * variance_review
 *   └──> counting (recount)
 *   └──> counted (recount/revision resolved to 0)
 *   └──> confirmed (when explained)
 *   └──> voided
 *
 * confirmed
 *   └──> posted (financial ledger posting)
 *   └──> voided
 *
 * posted / voided
 *   └──> [Terminal Immutable States]
 */
export const ALLOWED_OFFERING_TRANSITIONS: Record<
  OfferingSessionStatus,
  OfferingSessionStatus[]
> = {
  draft: ["counting", "voided"],
  counting: ["counted", "variance_review", "voided"],
  counted: ["confirmed", "counting", "voided"],
  variance_review: ["counting", "counted", "confirmed", "voided"],
  confirmed: ["posted", "voided"],
  posted: [],
  voided: [],
};

export class OfferingLifecycle {
  /**
   * Checks if a transition between two statuses is structurally allowed.
   */
  public static canTransition(
    from: OfferingSessionStatus,
    to: OfferingSessionStatus
  ): boolean {
    if (from === to) return true;
    const allowed = ALLOWED_OFFERING_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Validates dual counters requirement.
   * Counter 1 and Counter 2 must both be present and distinct.
   */
  public static validateDualCounters(
    counter1Id?: string | null,
    counter2Id?: string | null
  ): { isValid: boolean; error?: string } {
    if (!counter1Id || !counter1Id.trim()) {
      return { isValid: false, error: "กรุณาระบุผู้ตรวจนับคนที่ 1" };
    }
    if (!counter2Id || !counter2Id.trim()) {
      return { isValid: false, error: "กรุณาระบุผู้ตรวจนับคนที่ 2" };
    }
    if (counter1Id.trim() === counter2Id.trim()) {
      return {
        isValid: false,
        error: "ผู้ตรวจนับคนที่ 1 และคนที่ 2 ต้องเป็นคนละคนกัน (Dual-counter principle)",
      };
    }
    return { isValid: true };
  }

  /**
   * Validates revision input before submitting to the database.
   */
  public static validateRevisionInput(
    reason: string,
    previousAmount: MoneyInput,
    newAmount: MoneyInput
  ): { isValid: boolean; error?: string } {
    if (!reason || reason.trim().length < 5) {
      return {
        isValid: false,
        error: "กรุณาระบุเหตุผลในการแก้ไขยอดถวายที่คาดหวังอย่างน้อย 5 ตัวอักษร",
      };
    }

    const p = Money.from(previousAmount);
    const n = Money.from(newAmount);

    if (p.isNegative() || n.isNegative()) {
      return {
        isValid: false,
        error: "ยอดถวายต้องไม่ติดลบ",
      };
    }

    return { isValid: true };
  }

  /**
   * Deep domain-level transition validator verifying invariants.
   */
  public static validateTransition(
    session: OfferingSession,
    nextStatus: OfferingSessionStatus,
    context?: {
      counter1Id?: string | null;
      counter2Id?: string | null;
      explanationReason?: string | null;
      cashAccountId?: string | null;
      bankAccountId?: string | null;
    }
  ): { isValid: boolean; error?: string } {
    // 1. Immutability
    if (session.status === "posted") {
      return {
        isValid: false,
        error: "เซสชันยอดถวายนี้ถูกบันทึกลงสมุดบัญชีแล้ว (Posted) และไม่สามารถเปลี่ยนแปลงได้",
      };
    }
    if (session.status === "voided") {
      return {
        isValid: false,
        error: "เซสชันยอดถวายนี้ถูกยกเลิกแล้ว (Voided) และไม่สามารถเปลี่ยนแปลงได้",
      };
    }

    // 2. Structural transition check
    if (!this.canTransition(session.status, nextStatus)) {
      return {
        isValid: false,
        error: `ไม่สามารถเปลี่ยนสถานะจาก "${session.status}" ไปเป็น "${nextStatus}" ได้`,
      };
    }

    // 3. Counting start check
    if (nextStatus === "counting" && session.status === "draft") {
      const dualCheck = this.validateDualCounters(
        context?.counter1Id ?? session.counter1Id,
        context?.counter2Id ?? session.counter2Id
      );
      if (!dualCheck.isValid) {
        return dualCheck;
      }
    }

    // 4. Confirmation checks
    if (nextStatus === "confirmed") {
      // Must have dual counters
      const dualCheck = this.validateDualCounters(session.counter1Id, session.counter2Id);
      if (!dualCheck.isValid) {
        return dualCheck;
      }

      // Must have zero variance OR valid explanation
      if (session.cashVarianceAmount && !session.cashVarianceAmount.isZero()) {
        const varianceCheck = VarianceEngine.isVarianceAcceptableForConfirmation(
          session.cashVarianceAmount,
          session.varianceStatus,
          context?.explanationReason ?? session.varianceReason
        );
        if (!varianceCheck.canConfirm) {
          return { isValid: false, error: varianceCheck.reason };
        }
      }
    }

    // 5. Posting checks
    if (nextStatus === "posted") {
      if (session.status !== "confirmed") {
        return {
          isValid: false,
          error: "เซสชันต้องได้รับการยืนยัน (Confirmed) ก่อนบันทึกลงสมุดบัญชี",
        };
      }
      if (!context?.cashAccountId) {
        return {
          isValid: false,
          error: "กรุณาระบุบัญชี Cash Drawer สำหรับรับเงินสด",
        };
      }
      const hasElectronic =
        (session.expectedTransferAmount && session.expectedTransferAmount.isPositive()) ||
        (session.expectedQrAmount && session.expectedQrAmount.isPositive());

      if (hasElectronic && !context?.bankAccountId) {
        return {
          isValid: false,
          error: "กรุณาระบุบัญชีธนาคารสำหรับยอดเงินโอนและ QR Code",
        };
      }
    }

    return { isValid: true };
  }
}
