import { describe, it, expect, vi, beforeEach } from "vitest";
import { OfferingService } from "../../src/lib/offering/offering-service";

describe("OfferingService (Service Layer & RPC Integration)", () => {
  let mockSupabase: any;
  let service: OfferingService;

  beforeEach(() => {
    mockSupabase = {
      rpc: vi.fn(),
      from: vi.fn(),
    };
    service = new OfferingService(mockSupabase);
  });

  describe("Error Mapping", () => {
    it("maps DUAL_COUNTER_VIOLATION to user-friendly error", () => {
      const err = OfferingService.mapDatabaseError({
        message: "DUAL_COUNTER_VIOLATION: Counter 1 and Counter 2 must be different users",
        code: "P0001",
      });
      expect(err.code).toBe("DUAL_COUNTER_VIOLATION");
      expect(err.message).toContain("ผู้ตรวจนับคนที่ 1 และคนที่ 2 ต้องเป็นคนละคนกัน");
    });

    it("maps CANNOT_CONFIRM_UNRESOLVED_VARIANCE to user-friendly error", () => {
      const err = OfferingService.mapDatabaseError({
        message: "CANNOT_CONFIRM_UNRESOLVED_VARIANCE: Cash variance of -50 must be resolved or explained",
        code: "P0001",
      });
      expect(err.code).toBe("UNRESOLVED_VARIANCE");
      expect(err.message).toContain("ไม่สามารถยืนยันยอดถวายได้เนื่องจากมีผลต่างเงินสด");
    });

    it("maps INVALID_STATE_TRANSITION and flags isStaleState", () => {
      const err = OfferingService.mapDatabaseError({
        message: "INVALID_STATE_TRANSITION: Cannot transition from draft to posted",
        code: "P0001",
      });
      expect(err.code).toBe("INVALID_STATE_TRANSITION");
      expect(err.isStaleState).toBe(true);
    });

    it("maps MISSING_BANK_ACCOUNT", () => {
      const err = OfferingService.mapDatabaseError({
        message: "MISSING_BANK_ACCOUNT: Non-cash offerings require a bank account",
        code: "P0001",
      });
      expect(err.code).toBe("MISSING_BANK_ACCOUNT");
      expect(err.message).toContain("กรุณาระบุบัญชีธนาคาร");
    });

    // Regression test for M3 Domain Final Audit — Medium Finding (FIXED)
    // DB raises: 'MANDATORY_REASON: Revision reason must be at least 5 characters'
    // The old mapper checked for 'MANDATORY_REVISION_REASON' which never matched.
    it("maps MANDATORY_REASON (exact DB prefix) to Thai revision reason error", () => {
      const err = OfferingService.mapDatabaseError({
        message: "MANDATORY_REASON: Revision reason must be at least 5 characters",
        code: "P0001",
      });
      expect(err.code).toBe("MANDATORY_REVISION_REASON");
      expect(err.message).toContain("กรุณาระบุเหตุผลในการแก้ไขยอดถวาย");
      expect(err.message).toContain("5 ตัวอักษร");
    });

    it("does NOT map unknown errors to revision reason (old wrong prefix guard)", () => {
      const err = OfferingService.mapDatabaseError({
        message: "SOME_OTHER_ERROR: unrelated message",
        code: "P0001",
      });
      // Must fall through to generic error, not the revision reason handler
      expect(err.code).not.toBe("MANDATORY_REVISION_REASON");
    });
  });

  describe("createSession", () => {
    it("calls create_offering_session RPC with serialized items and returns sessionId", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: "session-uuid-1",
        error: null,
      });

      const res = await service.createSession({
        serviceDate: "2026-08-19",
        serviceName: "Sunday Service",
        items: [
          {
            fundId: "fund-1",
            paymentChannel: "cash",
            amount: "10000.00",
          },
          {
            fundId: "fund-2",
            paymentChannel: "bank_transfer",
            amount: "3000.00",
          },
        ],
        notes: "Morning service",
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith("create_offering_session", {
        p_service_date: "2026-08-19",
        p_service_name: "Sunday Service",
        p_items: [
          {
            fund_id: "fund-1",
            category_id: null,
            payment_channel: "cash",
            source_type: "envelopes",
            amount: 10000,
            donor_name: null,
            notes: null,
          },
          {
            fund_id: "fund-2",
            category_id: null,
            payment_channel: "bank_transfer",
            source_type: "envelopes",
            amount: 3000,
            donor_name: null,
            notes: null,
          },
        ],
        p_notes: "Morning service",
      });

      expect(res.success).toBe(true);
      expect(res.data?.sessionId).toBe("session-uuid-1");
    });

    it("fails early if items list is empty", async () => {
      const res = await service.createSession({
        serviceDate: "2026-08-19",
        serviceName: "Sunday Service",
        items: [],
      });
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe("VALIDATION_ERROR");
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe("startCashCount", () => {
    it("validates dual counters and calls start_cash_count RPC", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { status: "counting" },
        error: null,
      });

      const res = await service.startCashCount("session-1", "user-1", "user-2");
      expect(res.success).toBe(true);
      expect(res.data?.status).toBe("counting");
      expect(mockSupabase.rpc).toHaveBeenCalledWith("start_cash_count", {
        p_session_id: "session-1",
        p_counter1_id: "user-1",
        p_counter2_id: "user-2",
      });
    });

    it("rejects identical counter IDs before calling RPC", async () => {
      const res = await service.startCashCount("session-1", "user-1", "user-1");
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe("VALIDATION_ERROR");
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe("recordCashCount", () => {
    it("calls record_cash_count RPC and parses return amounts into Money instances", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: {
          counted_cash: 9950,
          cash_variance: -50,
          variance_status: "variance_detected",
          status: "variance_review",
        },
        error: null,
      });

      const res = await service.recordCashCount({
        sessionId: "session-1",
        counter1Id: "user-1",
        counter2Id: "user-2",
        denominations: {
          b1000: 9,
          b500: 1,
          b100: 4,
          b50: 1,
          b20: 0,
          coins: "0.00",
        },
      });

      expect(res.success).toBe(true);
      expect(res.data?.totalCash.toString()).toBe("9950.00");
      expect(res.data?.varianceAmount.toString()).toBe("-50.00");
      expect(res.data?.varianceStatus).toBe("variance_detected");
      expect(res.data?.status).toBe("variance_review");
    });
  });

  describe("resolveVariance", () => {
    it("calls resolve_offering_variance with recount", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { action: "recount", status: "counting" },
        error: null,
      });

      const res = await service.resolveVariance({
        sessionId: "session-1",
        action: "recount",
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe("counting");
    });

    it("validates explanation length when action is explain", async () => {
      const res = await service.resolveVariance({
        sessionId: "session-1",
        action: "explain",
        explanation: "err", // only 3 chars
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe("VALIDATION_ERROR");
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe("reviseExpectedAmount", () => {
    it("validates reason length and calls revise_offering_expected_amount RPC", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: {
          expected_cash: 10000,
          expected_total: 18450,
          cash_variance: 0,
          status: "counted",
        },
        error: null,
      });

      const res = await service.reviseExpectedAmount({
        sessionId: "session-1",
        newItems: [
          { fundId: "f1", paymentChannel: "cash", amount: 10000 },
        ],
        revisionReason: "แก้ไขยอดที่คีย์ผิดให้ถูกต้อง",
      });

      expect(res.success).toBe(true);
      expect(res.data?.expectedCash.toString()).toBe("10000.00");
      expect(res.data?.varianceAmount.toString()).toBe("0.00");
    });
  });

  describe("confirmSession", () => {
    it("calls confirm_offering_session RPC", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { status: "confirmed" },
        error: null,
      });

      const res = await service.confirmSession("session-1");
      expect(res.success).toBe(true);
      expect(res.data?.status).toBe("confirmed");
    });
  });

  describe("postOfferingToLedger", () => {
    it("calls post_offering_to_ledger RPC and returns idempotency result", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: {
          transaction_id: "tx-uuid-1",
          already_posted: false,
        },
        error: null,
      });

      const res = await service.postOfferingToLedger({
        sessionId: "session-1",
        cashAccountId: "cash-acc-1",
        bankAccountId: "bank-acc-1",
      });

      expect(res.success).toBe(true);
      expect(res.data?.transactionId).toBe("tx-uuid-1");
      expect(res.data?.alreadyPosted).toBe(false);
      expect(res.data?.status).toBe("posted");
    });
  });

  describe("getSession & listSessions", () => {
    it("parses database rows, items, cash counts, and revisions into strongly typed Money models", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: "session-1",
          church_id: "church-1",
          service_date: "2026-08-19",
          service_name: "Sunday Morning",
          status: "confirmed",
          expected_cash_amount: 10000,
          expected_transfer_amount: 3000,
          expected_qr_amount: 5450,
          expected_total_amount: 18450,
          counted_cash_amount: 10000,
          cash_variance_amount: 0,
          variance_status: "zero_match",
          items: [
            {
              id: "item-1",
              fund_id: "fund-1",
              payment_channel: "cash",
              source_type: "envelopes",
              amount: 10000,
              funds: { name: "General Fund" },
            },
          ],
          cash_counts: [
            {
              id: "count-1",
              b1000: 10,
              b500: 0,
              b100: 0,
              b50: 0,
              b20: 0,
              coins: 0,
              total_cash_counted: 10000,
              counted_by_1: "u1",
              counted_by_2: "u2",
              p1: { full_name: "John Counter" },
              p2: { full_name: "Jane Counter" },
            },
          ],
          revisions: [],
        },
        error: null,
      });

      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const res = await service.getSession("session-1");

      expect(res.success).toBe(true);
      expect(res.data?.expectedTotalAmount.toString()).toBe("18450.00");
      expect(res.data?.items?.[0].amount.toString()).toBe("10000.00");
      expect(res.data?.cashCount?.countedBy1Name).toBe("John Counter");
      expect(res.data?.cashCount?.totalCashCounted.toString()).toBe("10000.00");
    });

    it("requests joined profile names for both cash counters, not just raw IDs", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: "session-1", items: [], cash_counts: [], revisions: [] },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      await service.getSession("session-1");

      const selectQuery = mockSelect.mock.calls[0][0] as string;
      expect(selectQuery).toContain("p1:profiles!offering_cash_counts_counted_by_1_fkey");
      expect(selectQuery).toContain("p2:profiles!offering_cash_counts_counted_by_2_fkey");
    });

    it("falls back to raw counter ID only when no profile joins, no legacy name column", async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: "session-1",
          items: [],
          cash_counts: [
            {
              id: "count-1",
              counted_by_1: "raw-uuid-1",
              counted_by_2: "raw-uuid-2",
              total_cash_counted: 0,
            },
          ],
          revisions: [],
        },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const res = await service.getSession("session-1");

      // Documents current fallback behavior when profile is genuinely unavailable
      // (e.g. deleted profile row). Real production reads should hit the p1/p2 branch.
      expect(res.data?.cashCount?.countedBy1Name).toBe("raw-uuid-1");
      expect(res.data?.cashCount?.countedBy2Name).toBe("raw-uuid-2");
    });
  });
});
