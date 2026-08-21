import { TransactionStatus, WorkflowActor } from "./types";
import { SplitEngine, SplitInput } from "./split-engine";
import { MoneyInput } from "../money";

export interface StateTransitionResult {
  allowed: boolean;
  fromStatus: TransactionStatus;
  toStatus: TransactionStatus;
  reason?: string;
}

export class TransactionLifecycle {
  /**
   * Check if a transaction status transition is permitted
   */
  public static canTransition(
    currentStatus: TransactionStatus,
    targetStatus: TransactionStatus,
    actor: WorkflowActor,
    transaction: { createdBy: string; churchId: string; amount: MoneyInput; splits?: SplitInput[] },
    options?: { rejectionReason?: string; voidReason?: string }
  ): StateTransitionResult {
    // 1. Church boundary check
    if (actor.churchId !== transaction.churchId) {
      return {
        allowed: false,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        reason: "Unauthorized: Actor belongs to a different church."
      };
    }

    // 2. Draft -> Pending Approval (Submission)
    if (currentStatus === "draft" && targetStatus === "pending_approval") {
      const isAuthorized =
        actor.roles.some((r) => ["super_admin", "pastor", "treasurer", "finance_staff"].includes(r)) ||
        actor.userId === transaction.createdBy;

      if (!isAuthorized) {
        return {
          allowed: false,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          reason: "Unauthorized: Only finance staff or creator can submit transaction for approval."
        };
      }

      if (transaction.splits) {
        const parity = SplitEngine.validateParity(transaction.amount, transaction.splits);
        if (!parity.isValid) {
          return {
            allowed: false,
            fromStatus: currentStatus,
            toStatus: targetStatus,
            reason: parity.error || "Split sum does not match transaction amount."
          };
        }
      }

      return { allowed: true, fromStatus: currentStatus, toStatus: targetStatus };
    }

    // 3. Pending Approval -> Approved (Approval)
    if (currentStatus === "pending_approval" && targetStatus === "approved") {
      const isApprover = actor.roles.some((r) =>
        ["super_admin", "pastor", "treasurer", "approver"].includes(r)
      );

      if (!isApprover) {
        return {
          allowed: false,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          reason: "Unauthorized: Actor does not hold approver permissions."
        };
      }

      // TWO-PERSON RULE (Segregation of Duties)
      if (actor.userId === transaction.createdBy) {
        return {
          allowed: false,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          reason: "Segregation of Duties Violation: Creator cannot approve their own transaction."
        };
      }

      return { allowed: true, fromStatus: currentStatus, toStatus: targetStatus };
    }

    // 4. Pending Approval -> Draft (Request Revision)
    if (currentStatus === "pending_approval" && targetStatus === "draft") {
      const isApprover = actor.roles.some((r) =>
        ["super_admin", "pastor", "treasurer", "approver"].includes(r)
      );

      if (!isApprover) {
        return {
          allowed: false,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          reason: "Unauthorized: Only approvers can request revisions on transactions."
        };
      }

      if (!options?.rejectionReason || options.rejectionReason.trim().length < 5) {
        return {
          allowed: false,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          reason: "Invalid Revision: Revision note must be at least 5 characters."
        };
      }

      return { allowed: true, fromStatus: currentStatus, toStatus: targetStatus };
    }

    // 5. Pending Approval -> Rejected (Terminal Rejection)
    if (currentStatus === "pending_approval" && targetStatus === "rejected") {
      const isApprover = actor.roles.some((r) =>
        ["super_admin", "pastor", "treasurer", "approver"].includes(r)
      );

      if (!isApprover) {
        return {
          allowed: false,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          reason: "Unauthorized: Only approvers can reject transactions."
        };
      }

      if (!options?.rejectionReason || options.rejectionReason.trim().length < 5) {
        return {
          allowed: false,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          reason: "Invalid Rejection: Rejection reason must be at least 5 characters."
        };
      }

      return { allowed: true, fromStatus: currentStatus, toStatus: targetStatus };
    }

    // 6. Approved -> Posted (Posting)
    if (currentStatus === "approved" && targetStatus === "posted") {
      const isTreasurer = actor.roles.some((r) =>
        ["super_admin", "pastor", "treasurer"].includes(r)
      );

      if (!isTreasurer) {
        return {
          allowed: false,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          reason: "Unauthorized: Only treasurers or administrators may post transactions."
        };
      }

      return { allowed: true, fromStatus: currentStatus, toStatus: targetStatus };
    }

    // 6. Draft -> Posted (Direct Post by Treasurer)
    if (currentStatus === "draft" && targetStatus === "posted") {
      const isTreasurer = actor.roles.some((r) =>
        ["super_admin", "pastor", "treasurer"].includes(r)
      );

      if (!isTreasurer) {
        return {
          allowed: false,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          reason: "Unauthorized: Only treasurers may directly post transactions."
        };
      }

      if (transaction.splits) {
        const parity = SplitEngine.validateParity(transaction.amount, transaction.splits);
        if (!parity.isValid) {
          return {
            allowed: false,
            fromStatus: currentStatus,
            toStatus: targetStatus,
            reason: parity.error || "Split sum does not match transaction amount."
          };
        }
      }

      return { allowed: true, fromStatus: currentStatus, toStatus: targetStatus };
    }

    // 7. Posted -> Voided (Voiding & Reversal)
    if (currentStatus === "posted" && targetStatus === "voided") {
      const isTreasurer = actor.roles.some((r) =>
        ["super_admin", "pastor", "treasurer"].includes(r)
      );

      if (!isTreasurer) {
        return {
          allowed: false,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          reason: "Unauthorized: Only treasurers may void transactions."
        };
      }

      if (!options?.voidReason || options.voidReason.trim().length < 5) {
        return {
          allowed: false,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          reason: "Invalid Void: A specific justification reason (minimum 5 characters) is required."
        };
      }

      return { allowed: true, fromStatus: currentStatus, toStatus: targetStatus };
    }

    // All other transitions are forbidden by state machine invariants
    return {
      allowed: false,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      reason: `Invalid State Transition: Cannot transition transaction from "${currentStatus}" to "${targetStatus}".`
    };
  }
}
