import { describe, it, expect } from "vitest";
import { OfferingLifecycle } from "../../src/lib/offering/lifecycle";
import { OfferingSession } from "../../src/lib/offering/types";
import { Money } from "../../src/lib/money";

describe("OfferingLifecycle (State Transitions & Invariants)", () => {
  const createMockSession = (overrides?: Partial<OfferingSession>): OfferingSession => ({
    id: "session-123",
    churchId: "church-1",
    serviceDate: "2026-08-19",
    serviceName: "Sunday Worship",
    status: "draft",
    expectedCashAmount: Money.from("10000.00"),
    expectedTransferAmount: Money.from("3000.00"),
    expectedQrAmount: Money.from("5450.00"),
    expectedTotalAmount: Money.from("18450.00"),
    counter1Id: "user-1",
    counter2Id: "user-2",
    ...overrides,
  });

  describe("Structural State Transitions", () => {
    it("allows valid forward transitions", () => {
      expect(OfferingLifecycle.canTransition("draft", "counting")).toBe(true);
      expect(OfferingLifecycle.canTransition("counting", "counted")).toBe(true);
      expect(OfferingLifecycle.canTransition("counting", "variance_review")).toBe(true);
      expect(OfferingLifecycle.canTransition("counted", "confirmed")).toBe(true);
      expect(OfferingLifecycle.canTransition("variance_review", "confirmed")).toBe(true);
      expect(OfferingLifecycle.canTransition("variance_review", "counting")).toBe(true);
      expect(OfferingLifecycle.canTransition("confirmed", "posted")).toBe(true);
    });

    it("blocks illegal forward shortcuts", () => {
      expect(OfferingLifecycle.canTransition("draft", "confirmed")).toBe(false);
      expect(OfferingLifecycle.canTransition("draft", "posted")).toBe(false);
      expect(OfferingLifecycle.canTransition("counting", "posted")).toBe(false);
      expect(OfferingLifecycle.canTransition("counted", "posted")).toBe(false);
    });

    it("blocks illegal backwards rollbacks", () => {
      expect(OfferingLifecycle.canTransition("posted", "draft")).toBe(false);
      expect(OfferingLifecycle.canTransition("posted", "confirmed")).toBe(false);
      expect(OfferingLifecycle.canTransition("confirmed", "counting")).toBe(false);
      expect(OfferingLifecycle.canTransition("voided", "draft")).toBe(false);
    });
  });

  describe("Dual Counter Invariant", () => {
    it("validates distinct non-empty counters", () => {
      const res = OfferingLifecycle.validateDualCounters("user-1", "user-2");
      expect(res.isValid).toBe(true);
    });

    it("rejects equal counters (self-counting)", () => {
      const res = OfferingLifecycle.validateDualCounters("user-1", "user-1");
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("คนละคนกัน");
    });

    it("rejects missing counters", () => {
      expect(OfferingLifecycle.validateDualCounters("", "user-2").isValid).toBe(false);
      expect(OfferingLifecycle.validateDualCounters("user-1", undefined).isValid).toBe(false);
    });
  });

  describe("Revision Validation", () => {
    it("accepts valid revisions with reason >= 5 characters", () => {
      const res = OfferingLifecycle.validateRevisionInput(
        "เพิ่มซองถวายตกหล่น 2 ซอง",
        "8000.00",
        "10000.00"
      );
      expect(res.isValid).toBe(true);
    });

    it("rejects short or empty reasons", () => {
      const res = OfferingLifecycle.validateRevisionInput("แก้", "8000.00", "10000.00");
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("อย่างน้อย 5 ตัวอักษร");
    });

    it("rejects negative new amounts", () => {
      const res = OfferingLifecycle.validateRevisionInput(
        "ปรับยอดย้อนหลัง",
        "8000.00",
        "-500.00"
      );
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("ไม่ติดลบ");
    });
  });

  describe("Deep Transition Validation", () => {
    it("validates draft -> counting requires dual counters", () => {
      const session = createMockSession({ status: "draft", counter1Id: null, counter2Id: null });
      const res = OfferingLifecycle.validateTransition(session, "counting", {
        counter1Id: "c1",
        counter2Id: "c1", // same counter
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("คนละคนกัน");
    });

    it("blocks confirmed transition if cash variance is unreviewed", () => {
      const session = createMockSession({
        status: "variance_review",
        cashVarianceAmount: Money.from("-50.00"),
        varianceStatus: "variance_detected",
      });
      const res = OfferingLifecycle.validateTransition(session, "confirmed");
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("ยังไม่ได้รับการอธิบาย");
    });

    it("allows confirmed transition when cash variance is properly explained", () => {
      const session = createMockSession({
        status: "variance_review",
        cashVarianceAmount: Money.from("-50.00"),
        varianceStatus: "explained",
        varianceReason: "พบเงินสดขาด 50 บาทในซองที่ 12",
      });
      const res = OfferingLifecycle.validateTransition(session, "confirmed");
      expect(res.isValid).toBe(true);
    });

    it("validates posted transition requires cash account and bank account if transfer exists", () => {
      const session = createMockSession({ status: "confirmed" });

      // Missing cash account
      expect(
        OfferingLifecycle.validateTransition(session, "posted", {
          cashAccountId: null,
          bankAccountId: "bank-1",
        }).isValid
      ).toBe(false);

      // Missing bank account when expectedTransferAmount > 0
      expect(
        OfferingLifecycle.validateTransition(session, "posted", {
          cashAccountId: "cash-1",
          bankAccountId: null,
        }).isValid
      ).toBe(false);

      // All accounts supplied
      expect(
        OfferingLifecycle.validateTransition(session, "posted", {
          cashAccountId: "cash-1",
          bankAccountId: "bank-1",
        }).isValid
      ).toBe(true);
    });
  });
});
