import { describe, it, expect } from "vitest";
import { Money } from "../../src/lib/money";
import { OfferingSession } from "../../src/lib/offering/types";
import {
  ProfileOption,
  CashCountFormState,
  renderCashCountViewHtml,
} from "../../src/components/offering/CashCountView";
import { DenominationEngine } from "../../src/lib/offering/denomination-engine";
import { VarianceEngine } from "../../src/lib/offering/variance-engine";

describe("M3 UI Components — Slice 2", () => {
  const mockProfiles: ProfileOption[] = [
    { id: "user-1", fullName: "คุณสมศรี เหรัญญิก", email: "somsri@grace.org" },
    { id: "user-2", fullName: "คุณมานะ กรรมการ", email: "mana@grace.org" },
    { id: "user-3", fullName: "ศจ.สมชาย ศิษยาภิบาล", email: "somchai@grace.org" },
  ];

  const baseSession: OfferingSession = {
    id: "session-test-001",
    churchId: "church-test",
    serviceDate: "2026-08-23",
    serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
    status: "counting",
    expectedCashAmount: Money.from("10000.00"),
    expectedTransferAmount: Money.from("5000.00"),
    expectedQrAmount: Money.from("3450.00"),
    expectedTotalAmount: Money.from("18450.00"),
    counter1Id: "user-1",
    counter2Id: "user-2",
  };

  describe("Denomination & Variance Engine Integration", () => {
    it("should calculate exact actual cash from bill and coin inputs without float drift", () => {
      // 5 * 1000 = 5000
      // 3 * 500  = 1500
      // 4 * 100  = 400
      // Coins    = 50
      // Total    = 6950
      const denomResult = DenominationEngine.calculateTotal({
        b1000: 5,
        b500: 3,
        b100: 4,
        b50: 0,
        b20: 0,
        coins: "50.00",
      });

      expect(denomResult.grandTotal.toString()).toBe("6950.00");
      expect(denomResult.breakdown.b1000.total.toString()).toBe("5000.00");
      expect(denomResult.breakdown.b500.total.toString()).toBe("1500.00");
      expect(denomResult.breakdown.b100.total.toString()).toBe("400.00");
    });

    it("should calculate exact variance strictly against physical expected cash", () => {
      const expectedCash = Money.from("7000.00");
      const actualCash = Money.from("6950.00");

      const variance = VarianceEngine.calculateCashVariance(expectedCash, actualCash);
      expect(variance.varianceAmount.toString()).toBe("-50.00");
      expect(variance.isShortage).toBe(true);
      expect(variance.isZeroMatch).toBe(false);
    });

    it("should recognize zero match when actual cash equals expected cash", () => {
      const expectedCash = Money.from("10000.00");
      const actualCash = Money.from("10000.00");

      const variance = VarianceEngine.calculateCashVariance(expectedCash, actualCash);
      expect(variance.varianceAmount.toString()).toBe("0.00");
      expect(variance.isZeroMatch).toBe(true);
    });
  });

  describe("CashCountView Component (Screen 06)", () => {
    it("should render expected cash summary separated from transfer and QR", () => {
      const state: CashCountFormState = {
        counter1Id: "user-1",
        counter2Id: "user-2",
        denominations: {
          b1000: 10,
          b500: 0,
          b100: 0,
          b50: 0,
          b20: 0,
          coins: Money.zero(),
        },
      };

      const html = renderCashCountViewHtml({
        session: baseSession,
        profiles: mockProfiles,
        state,
      });

      expect(html).toContain("คาดว่าจะมี");
      expect(html).toContain("10,000.00");
      expect(html).toContain("5,000.00");
      expect(html).toContain("3,450.00");
      expect(html).toContain("18,450.00");
    });

    it("should warn and block when counter 1 and counter 2 are the same person", () => {
      const state: CashCountFormState = {
        counter1Id: "user-1",
        counter2Id: "user-1", // SAME PERSON
        denominations: {
          b1000: 10,
          b500: 0,
          b100: 0,
          b50: 0,
          b20: 0,
          coins: Money.zero(),
        },
      };

      const html = renderCashCountViewHtml({
        session: baseSession,
        profiles: mockProfiles,
        state,
      });

      expect(html).toContain("ผู้ตรวจนับคนที่ 1 และคนที่ 2 ต้องเป็นคนละคนกันตามหลักการควบคุมภายใน");
      expect(html).toContain('disabled');
    });

    it("should render zero match state when counted total equals expected cash", () => {
      const state: CashCountFormState = {
        counter1Id: "user-1",
        counter2Id: "user-2",
        denominations: {
          b1000: 10, // 10,000.00
          b500: 0,
          b100: 0,
          b50: 0,
          b20: 0,
          coins: Money.zero(),
        },
      };

      const html = renderCashCountViewHtml({
        session: baseSession,
        profiles: mockProfiles,
        state,
      });

      expect(html).toContain("ยอดเงินสดตรวจนับตรงสมบูรณ์");
      expect(html).toContain("btn-save-cash-count");
      expect(html).toContain("บันทึกผลการตรวจนับเงิน");
    });

    it("should render shortage variance when counted cash is less than expected", () => {
      const state: CashCountFormState = {
        counter1Id: "user-1",
        counter2Id: "user-2",
        denominations: {
          b1000: 9, // 9,000.00
          b500: 0,
          b100: 0,
          b50: 0,
          b20: 0,
          coins: Money.zero(),
        },
      };

      const html = renderCashCountViewHtml({
        session: baseSession,
        profiles: mockProfiles,
        state,
      });

      expect(html).toContain("ยอดเงินสดตรวจนับขาด");
      expect(html).toContain("−฿1,000.00");
    });
  });
});
