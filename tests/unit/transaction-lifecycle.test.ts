import { describe, it, expect } from "vitest";
import { TransactionLifecycle } from "@/lib/transactions/lifecycle";
import { WorkflowActor } from "@/lib/transactions/types";

describe("M2 Transaction Lifecycle & Two-Person Rule Unit Tests", () => {
  const CHURCH_ID = "church-1111-1111-1111";
  const OTHER_CHURCH_ID = "church-2222-2222-2222";
  const CREATOR_ID = "user-creator-111";
  const APPROVER_ID = "user-approver-222";
  const TREASURER_ID = "user-treasurer-333";
  const MEMBER_ID = "user-member-444";

  const creatorActor: WorkflowActor = {
    userId: CREATOR_ID,
    churchId: CHURCH_ID,
    roles: ["finance_staff"],
  };

  const approverActor: WorkflowActor = {
    userId: APPROVER_ID,
    churchId: CHURCH_ID,
    roles: ["approver"],
  };

  const treasurerActor: WorkflowActor = {
    userId: TREASURER_ID,
    churchId: CHURCH_ID,
    roles: ["treasurer"],
  };

  const memberActor: WorkflowActor = {
    userId: MEMBER_ID,
    churchId: CHURCH_ID,
    roles: ["member"],
  };

  const otherChurchActor: WorkflowActor = {
    userId: "user-other-church",
    churchId: OTHER_CHURCH_ID,
    roles: ["treasurer"],
  };

  const baseTxn = {
    createdBy: CREATOR_ID,
    churchId: CHURCH_ID,
    amount: "5000.00",
    splits: [
      { fundId: "fund-1", amount: "3000.00" },
      { fundId: "fund-2", amount: "2000.00" },
    ],
  };

  describe("Draft -> Pending Approval (Submission)", () => {
    it("allows creator or finance staff to submit valid draft with split parity", () => {
      const res = TransactionLifecycle.canTransition("draft", "pending_approval", creatorActor, baseTxn);
      expect(res.allowed).toBe(true);
    });

    it("rejects submission if split parity does not match transaction amount", () => {
      const invalidTxn = {
        ...baseTxn,
        splits: [{ fundId: "fund-1", amount: "3000.00" }], // 3000 vs 5000
      };
      const res = TransactionLifecycle.canTransition("draft", "pending_approval", creatorActor, invalidTxn);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("Under-allocated");
    });

    it("rejects submission if actor is unauthorized member", () => {
      const res = TransactionLifecycle.canTransition("draft", "pending_approval", memberActor, {
        ...baseTxn,
        createdBy: "different-user",
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("Unauthorized");
    });
  });

  describe("Pending Approval -> Approved (Two-Person Rule)", () => {
    it("allows designated approver (who is not creator) to approve", () => {
      const res = TransactionLifecycle.canTransition("pending_approval", "approved", approverActor, baseTxn);
      expect(res.allowed).toBe(true);
    });

    it("STRICTLY BLOCKS creator from approving their own transaction (Two-Person Rule)", () => {
      const creatorWithApproverRole: WorkflowActor = {
        userId: CREATOR_ID,
        churchId: CHURCH_ID,
        roles: ["finance_staff", "approver"],
      };
      const res = TransactionLifecycle.canTransition("pending_approval", "approved", creatorWithApproverRole, baseTxn);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("Segregation of Duties Violation");
    });

    it("rejects approval by non-approver member", () => {
      const res = TransactionLifecycle.canTransition("pending_approval", "approved", memberActor, baseTxn);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("Unauthorized");
    });
  });

  describe("Pending Approval -> Draft (Request Revision)", () => {
    it("allows approver to request revision when valid note is provided", () => {
      const res = TransactionLifecycle.canTransition(
        "pending_approval",
        "draft",
        approverActor,
        baseTxn,
        { rejectionReason: "Incorrect category assigned to second split." }
      );
      expect(res.allowed).toBe(true);
    });

    it("rejects revision action if note is missing or too short (< 5 chars)", () => {
      const res = TransactionLifecycle.canTransition(
        "pending_approval",
        "draft",
        approverActor,
        baseTxn,
        { rejectionReason: "No" }
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("Revision note must be at least 5 characters");
    });
  });

  describe("Pending Approval -> Rejected (Terminal Rejection)", () => {
    it("allows approver to terminally reject transaction when valid reason is provided", () => {
      const res = TransactionLifecycle.canTransition(
        "pending_approval",
        "rejected",
        approverActor,
        baseTxn,
        { rejectionReason: "Expenditure not approved by finance committee." }
      );
      expect(res.allowed).toBe(true);
    });

    it("rejects terminal rejection if reason is missing or too short (< 5 chars)", () => {
      const res = TransactionLifecycle.canTransition(
        "pending_approval",
        "rejected",
        approverActor,
        baseTxn,
        { rejectionReason: "Bad" }
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("Rejection reason must be at least 5 characters");
    });

    it("blocks any transition from rejected status (immutable terminal state)", () => {
      const transitions: ("draft" | "pending_approval" | "approved" | "posted" | "voided")[] = [
        "draft",
        "pending_approval",
        "approved",
        "posted",
        "voided",
      ];
      for (const target of transitions) {
        const res = TransactionLifecycle.canTransition("rejected", target, treasurerActor, baseTxn);
        expect(res.allowed).toBe(false);
        expect(res.reason).toContain("Invalid State Transition");
      }
    });
  });

  describe("Approved -> Posted (Posting)", () => {
    it("allows treasurer to post approved transaction to ledger", () => {
      const res = TransactionLifecycle.canTransition("approved", "posted", treasurerActor, baseTxn);
      expect(res.allowed).toBe(true);
    });

    it("rejects posting by non-treasurer approver or staff", () => {
      const res = TransactionLifecycle.canTransition("approved", "posted", approverActor, baseTxn);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("Unauthorized");
    });
  });

  describe("Posted -> Voided (Reversal)", () => {
    it("allows treasurer to void posted transaction with valid reason", () => {
      const res = TransactionLifecycle.canTransition(
        "posted",
        "voided",
        treasurerActor,
        baseTxn,
        { voidReason: "Duplicate entry created by mistake on Sunday." }
      );
      expect(res.allowed).toBe(true);
    });

    it("rejects voiding if justification reason is too short", () => {
      const res = TransactionLifecycle.canTransition(
        "posted",
        "voided",
        treasurerActor,
        baseTxn,
        { voidReason: "err" }
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("minimum 5 characters");
    });
  });

  describe("Cross-Church Isolation", () => {
    it("strictly blocks actions from actors belonging to a different church", () => {
      const res = TransactionLifecycle.canTransition("draft", "pending_approval", otherChurchActor, baseTxn);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("different church");
    });
  });
});
