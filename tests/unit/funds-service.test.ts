import { describe, it, expect } from "vitest";
import { FundsService } from "../../src/lib/funds/funds-service";

describe("FundsService — Comprehensive Unit Tests", () => {
  const dummyChurchId = "00000000-0000-0000-0000-000000000001";
  const fromFundId = "00000000-0000-0000-0000-000000000002";
  const toFundId = "00000000-0000-0000-0000-000000000003";

  describe("1. getFunds & Error Handling", () => {
    it("retrieves funds and converts amounts to Money objects accurately", async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: fromFundId,
                        church_id: dummyChurchId,
                        name: "กองทุนทั่วไป",
                        description: "พันธกิจทั่วไป",
                        current_balance: "250000.75",
                        target_budget: "300000.00",
                        is_active: true,
                        created_at: "2026-08-21T00:00:00Z",
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      } as any;

      const service = new FundsService(mockSupabase, "treasurer");
      const result = await service.getFunds(dummyChurchId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].current_balance.format()).toBe("฿250,000.75");
      expect(result.data?.[0].target_budget.format()).toBe("฿300,000.00");
    });

    it("propagates database error cleanly when getFunds query fails", async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: null, error: { message: "Connection lost", code: "503" } }),
              }),
            }),
          }),
        }),
      } as any;

      const service = new FundsService(mockSupabase, "treasurer");
      const result = await service.getFunds(dummyChurchId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection lost");
    });
  });

  describe("2. createFund & updateFund", () => {
    it("creates a new fund with valid target budget", async () => {
      let insertedPayload: any = null;
      const mockSupabase = {
        from: () => ({
          insert: (payload: any) => {
            insertedPayload = payload;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: "fund-new-123" }, error: null }),
              }),
            };
          },
        }),
      } as any;

      const service = new FundsService(mockSupabase, "treasurer");
      const result = await service.createFund({
        church_id: dummyChurchId,
        name: "กองทุนเพื่อการศึกษา",
        description: "ทุนการศึกษาบุตรหลาน",
        target_budget: "50000.00",
      });

      expect(result.success).toBe(true);
      expect(result.data?.fund_id).toBe("fund-new-123");
      expect(insertedPayload.name).toBe("กองทุนเพื่อการศึกษา");
      expect(insertedPayload.target_budget).toBe("50000.00");
      expect(insertedPayload.current_balance).toBe("0.00");
    });

    it("rejects fund creation with empty name or negative target budget", async () => {
      const mockSupabase = {} as any;
      const service = new FundsService(mockSupabase, "treasurer");

      const resEmpty = await service.createFund({
        church_id: dummyChurchId,
        name: "",
      });

      const resNeg = await service.createFund({
        church_id: dummyChurchId,
        name: "กองทุนติดลบ",
        target_budget: "-1000.00",
      });

      expect(resEmpty.success).toBe(false);
      expect(resNeg.success).toBe(false);
      expect(resNeg.error).toContain("เป้าหมายงบประมาณต้องไม่ติดลบ");
    });

    it("updates fund properties cleanly", async () => {
      let updatedPayload: any = null;
      const mockSupabase = {
        from: () => ({
          update: (payload: any) => {
            updatedPayload = payload;
            return { eq: () => Promise.resolve({ error: null }) };
          },
        }),
      } as any;

      const service = new FundsService(mockSupabase, "treasurer");
      const result = await service.updateFund(fromFundId, {
        name: "กองทุนทั่วไป (ปรับปรุง)",
        target_budget: "400000.00",
        is_active: true,
      });

      expect(result.success).toBe(true);
      expect(updatedPayload.name).toBe("กองทุนทั่วไป (ปรับปรุง)");
      expect(updatedPayload.target_budget).toBe("400000.00");
    });
  });

  describe("3. transferFunds (Idempotency & Validations)", () => {
    it("calls transfer_funds RPC with exact parameters including idempotency_key", async () => {
      let rpcPayload: any = null;
      const mockSupabase = {
        rpc: (fn: string, args: any) => {
          if (fn === "transfer_funds") {
            rpcPayload = args;
            return Promise.resolve({ data: "transfer-uuid-123", error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      } as any;

      const service = new FundsService(mockSupabase, "treasurer");

      const result = await service.transferFunds({
        church_id: dummyChurchId,
        from_fund_id: fromFundId,
        to_fund_id: toFundId,
        amount: "15000.00",
        notes: "มติกรรมการสมทบพันธกิจ",
        idempotency_key: "transfer_idem_key_001",
      });

      expect(result.success).toBe(true);
      expect(result.data?.transfer_id).toBe("transfer-uuid-123");
      expect(rpcPayload.p_amount).toBe("15000.00");
      expect(rpcPayload.p_note).toBe("มติกรรมการสมทบพันธกิจ");
      expect(rpcPayload.p_idempotency_key).toBe("transfer_idem_key_001");
    });

    it("rejects transfer between the same fund (Source === Destination)", async () => {
      const mockSupabase = {} as any;
      const service = new FundsService(mockSupabase, "treasurer");

      const result = await service.transferFunds({
        church_id: dummyChurchId,
        from_fund_id: fromFundId,
        to_fund_id: fromFundId, // Same fund
        amount: "5000.00",
        notes: "โอนเงินเข้าตัวเอง",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("กองทุนต้นทางและกองทุนปลายทางต้องไม่เป็นกองทุนเดียวกัน");
    });

    it("rejects transfer with zero, negative amount, or short notes (< 5 chars)", async () => {
      const mockSupabase = {} as any;
      const service = new FundsService(mockSupabase, "treasurer");

      const resZero = await service.transferFunds({
        church_id: dummyChurchId,
        from_fund_id: fromFundId,
        to_fund_id: toFundId,
        amount: "0.00",
        notes: "เหตุผลโอนเงิน",
      });

      const resShort = await service.transferFunds({
        church_id: dummyChurchId,
        from_fund_id: fromFundId,
        to_fund_id: toFundId,
        amount: "100.00",
        notes: "โอน", // < 5 chars
      });

      expect(resZero.success).toBe(false);
      expect(resShort.success).toBe(false);
    });

    it("propagates Insufficient Funds exception from RPC", async () => {
      const mockSupabase = {
        rpc: () =>
          Promise.resolve({
            data: null,
            error: { message: "Insufficient Funds: Source fund balance (฿500.00) is less than requested transfer (฿10,000.00)", code: "22023" },
          }),
      } as any;

      const service = new FundsService(mockSupabase, "treasurer");
      const result = await service.transferFunds({
        church_id: dummyChurchId,
        from_fund_id: fromFundId,
        to_fund_id: toFundId,
        amount: "10000.00",
        notes: "โอนเกินยอดคงเหลือ",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Insufficient Funds");
      expect(result.code).toBe("22023");
    });

    it("rejects unauthorized role attempting to transfer funds", async () => {
      const mockSupabase = {} as any;
      const service = new FundsService(mockSupabase, "counter"); // Counter cannot transfer funds

      const result = await service.transferFunds({
        church_id: dummyChurchId,
        from_fund_id: fromFundId,
        to_fund_id: toFundId,
        amount: "500.00",
        notes: "พยายามโอนเงิน",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access Denied");
    });
  });
});
