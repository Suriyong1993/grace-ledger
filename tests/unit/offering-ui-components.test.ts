import { describe, it, expect } from "vitest";
import { Money } from "../../src/lib/money";
import { router } from "../../src/router";
import {
  renderOfferingSessionListHtml,
  renderOfferingStatusBadge,
} from "../../src/components/offering/OfferingSessionList";
import {
  renderOfferingEntryFormHtml,
  FundOption,
  OfferingEntryFormState,
} from "../../src/components/offering/OfferingEntryForm";
import { renderOfferingReviewSheetHtml } from "../../src/components/offering/OfferingReviewSheet";
import { OfferingSession } from "../../src/lib/offering/types";

describe("M3 UI Components — Slice 1", () => {
  const mockFunds: FundOption[] = [
    { id: "fund-1", name: "กองทุนทั่วไป", currentBalance: "150000.00" },
    { id: "fund-2", name: "กองทุนพันธกิจพิเศษ", currentBalance: "50000.00" },
    { id: "fund-3", name: "กองทุนสร้างพระวิหาร", currentBalance: "100000.00" },
  ];

  describe("Router — Offering Routes", () => {
    it("should match /offerings list route", () => {
      const match = router.matchRoute("/offerings");
      expect(match.pattern).toBe("/offerings");
      expect(match.path).toBe("/offerings");
    });

    it("should match /offerings/new entry route", () => {
      const match = router.matchRoute("/offerings/new");
      expect(match.pattern).toBe("/offerings/new");
      expect(match.path).toBe("/offerings/new");
    });

    it("should match /offerings/:id detail route with param", () => {
      const match = router.matchRoute("/offerings/session-123-abc");
      expect(match.pattern).toBe("/offerings/:id");
      expect(match.params.id).toBe("session-123-abc");
    });
  });

  describe("OfferingSessionList Component", () => {
    it("should render empty state when no sessions exist", () => {
      const html = renderOfferingSessionListHtml({
        sessions: [],
        isLoading: false,
        errorMessage: null,
      });

      expect(html).toContain("ยังไม่มีรายการบันทึกเงินถวาย");
      expect(html).toContain("btn-create-offering");
      expect(html).toContain("+ บันทึกเงินถวาย");
    });

    it("should render table with status badges and channel amounts", () => {
      const mockSessions: OfferingSession[] = [
        {
          id: "session-1",
          churchId: "church-1",
          serviceDate: "2026-08-23",
          serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
          status: "draft",
          expectedCashAmount: Money.from("10000.00"),
          expectedTransferAmount: Money.from("5000.00"),
          expectedQrAmount: Money.from("3450.00"),
          expectedTotalAmount: Money.from("18450.00"),
        },
        {
          id: "session-2",
          churchId: "church-1",
          serviceDate: "2026-08-16",
          serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
          status: "confirmed",
          expectedCashAmount: Money.from("12000.00"),
          expectedTransferAmount: Money.from("8000.00"),
          expectedQrAmount: Money.from("1300.00"),
          expectedTotalAmount: Money.from("21300.00"),
        },
      ];

      const html = renderOfferingSessionListHtml({
        sessions: mockSessions,
        isLoading: false,
        errorMessage: null,
      });

      expect(html).toContain("รอบนมัสการวันอาทิตย์ (เช้า)");
      expect(html).toContain("ร่าง");
      expect(html).toContain("ยืนยันแล้ว");
      expect(html).toContain("18,450.00");
      expect(html).toContain("21,300.00");
      expect(html).toContain("เปิดต่อ");
      expect(html).toContain("ดูรายละเอียด");
    });

    it("should render correct status badge markup for each lifecycle status", () => {
      expect(renderOfferingStatusBadge("draft")).toContain("ร่าง");
      expect(renderOfferingStatusBadge("counting")).toContain("กำลังนับเงิน");
      expect(renderOfferingStatusBadge("counted")).toContain("นับเงินแล้ว");
      expect(renderOfferingStatusBadge("variance_review")).toContain("ตรวจสอบผลต่าง");
      expect(renderOfferingStatusBadge("confirmed")).toContain("ยืนยันแล้ว");
      expect(renderOfferingStatusBadge("posted")).toContain("ลงบัญชีแล้ว");
      expect(renderOfferingStatusBadge("voided")).toContain("ยกเลิก");
    });
  });

  describe("OfferingEntryForm Component (Screen 04)", () => {
    it("should render channel input fields and allocation rows", () => {
      const state: OfferingEntryFormState = {
        serviceDate: "2026-08-23",
        serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
        rawAmounts: { cash: "", transfer: "", qr: "" },
      channels: {
          cash: Money.from("10000.00"),
          transfer: Money.from("5000.00"),
          qr: Money.from("3450.00"),
        },
        allocations: [
          {
            id: "row-1",
            fundId: "fund-1",
            channel: "cash",
            sourceType: "envelopes",
            amount: Money.from("10000.00"),
            donorName: "ทั่วไป",
          },
          {
            id: "row-2",
            fundId: "fund-2",
            channel: "bank_transfer",
            sourceType: "electronic_slip",
            amount: Money.from("5000.00"),
          },
          {
            id: "row-3",
            fundId: "fund-3",
            channel: "qr_code",
            sourceType: "electronic_slip",
            amount: Money.from("3450.00"),
          },
        ],
        notes: "ซองถวายครบถ้วน",
      };

      const html = renderOfferingEntryFormHtml({
        funds: mockFunds,
        state,
      });

      expect(html).toContain("ยอดรวมตามช่องทาง");
      expect(html).toContain("18,450.00");
      expect(html).toContain("กองทุนทั่วไป");
      expect(html).toContain("กองทุนพันธกิจพิเศษ");
      expect(html).toContain("กองทุนสร้างพระวิหาร");
      expect(html).toContain("ยอดจัดสรรถูกต้องตรงตามช่องทางทั้งหมด");
      expect(html).toContain("btn-proceed-review");
    });

    it("should warn when allocation sum does not match expected channel amount", () => {
      const state: OfferingEntryFormState = {
        serviceDate: "2026-08-23",
        serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
        rawAmounts: { cash: "", transfer: "", qr: "" },
      channels: {
          cash: Money.from("10000.00"),
          transfer: Money.zero(),
          qr: Money.zero(),
        },
        allocations: [
          {
            id: "row-1",
            fundId: "fund-1",
            channel: "cash",
            sourceType: "envelopes",
            amount: Money.from("9950.00"), // missing 50 THB
          },
        ],
      };

      const html = renderOfferingEntryFormHtml({
        funds: mockFunds,
        state,
      });

      expect(html).toContain("ยอดจัดสรรกองทุนยังไม่ตรงกับยอดตามช่องทาง");
      expect(html).toContain("ต่าง");
    });
  });

  describe("OfferingReviewSheet Component (Screen 05)", () => {
    it("should render channel breakdown cards, fund summary, and action buttons", () => {
      const state: OfferingEntryFormState = {
        serviceDate: "2026-08-23",
        serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
        rawAmounts: { cash: "", transfer: "", qr: "" },
      channels: {
          cash: Money.from("10000.00"),
          transfer: Money.from("5000.00"),
          qr: Money.from("3450.00"),
        },
        allocations: [
          {
            id: "row-1",
            fundId: "fund-1",
            channel: "cash",
            sourceType: "envelopes",
            amount: Money.from("10000.00"),
            donorName: "ทั่วไป",
          },
          {
            id: "row-2",
            fundId: "fund-2",
            channel: "bank_transfer",
            sourceType: "electronic_slip",
            amount: Money.from("5000.00"),
          },
          {
            id: "row-3",
            fundId: "fund-3",
            channel: "qr_code",
            sourceType: "electronic_slip",
            amount: Money.from("3450.00"),
          },
        ],
        notes: "ทดสอบการบันทึก",
      };

      const html = renderOfferingReviewSheetHtml({
        funds: mockFunds,
        state,
        creatorName: "อาจารย์สรรเสริญ ดวงจิตร",
      });

      expect(html).toContain("ตรวจทานรายการเงินถวาย");
      expect(html).toContain("อาจารย์สรรเสริญ ดวงจิตร");
      expect(html).toContain("10,000.00");
      expect(html).toContain("5,000.00");
      expect(html).toContain("3,450.00");
      expect(html).toContain("18,450.00");
      expect(html).toContain("ตารางการจัดสรรเข้ากองทุน");
      expect(html).toContain("btn-back-to-edit");
      expect(html).toContain("btn-confirm-save-draft");
      expect(html).toContain("ยืนยันและบันทึกร่าง");
    });
  });
});

describe("Offering entry form — amount typing (raw-text binding)", () => {
  const state: OfferingEntryFormState = {
    serviceDate: "2026-09-02",
    serviceName: "รอบเช้า",
    channels: { cash: Money.from("5"), transfer: Money.zero(), qr: Money.zero() },
    rawAmounts: { cash: "5.", transfer: "", qr: "" },
    allocations: [
      { id: "r1", fundId: "fund-1", channel: "cash", sourceType: "envelopes", amount: Money.from("5"), rawAmount: "5.", donorName: "" },
    ],
  };

  it("binds the raw typed text back into the amount inputs — a trailing decimal dot survives re-render", () => {
    const html = renderOfferingEntryFormHtml({ funds: [], state });
    expect(html).toContain('id="input-expected-cash"');
    expect(html).toContain('value="5."');
    expect(html).toMatch(/input-row-amount[^>]*value="5."/);
  });

  it("falls back to the parsed Money value when no raw text exists yet", () => {
    const html = renderOfferingEntryFormHtml({
      funds: [],
      state: {
        ...state,
        rawAmounts: { cash: "", transfer: "", qr: "" },
        allocations: [{ ...state.allocations[0], rawAmount: undefined }],
      },
    });
    expect(html).toContain('value="5"');
  });
});
