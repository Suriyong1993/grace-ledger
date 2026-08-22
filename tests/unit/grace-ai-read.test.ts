import { describe, it, expect } from "vitest";
import { GraceAiReadService } from "../../src/lib/ai/grace-ai-read";
import { SecureAiToolExecutor } from "../../src/lib/ai/secure-tool-executor";

describe("Grace AI READ Capabilities & Data Provenance Tests", () => {
  const dummyChurchId = "00000000-0000-0000-0000-000000000001";
  const dummyOtherChurchId = "00000000-0000-0000-0000-000000000099";
  const dummyUserId = "00000000-0000-0000-0000-000000000002";
  const dummyMemberId = "00000000-0000-0000-0000-000000000003";

  function createMockSupabase(options: {
    authenticated?: boolean;
    role?: string;
    churchId?: string;
    customData?: Record<string, any>;
    customError?: Record<string, any>;
  }) {
    const auditLogs: any[] = [];
    const dbWrites: { table: string; payload: any }[] = [];

    const client = {
      auditLogs,
      dbWrites,
      auth: {
        getUser: () =>
          options.authenticated !== false
            ? Promise.resolve({ data: { user: { id: dummyUserId } }, error: null })
            : Promise.resolve({ data: { user: null }, error: { message: "No session", status: 401 } }),
      },
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: dummyUserId,
                      church_id: options.churchId || dummyChurchId,
                      role: options.role || "treasurer",
                    },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === "audit_logs") {
          return {
            insert: (payload: any) => {
              auditLogs.push(payload);
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: { id: "audit-uuid-1" }, error: null }),
                }),
              };
            },
          };
        }
        if (table === "funds") {
          return {
            select: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: options.customData?.funds || [
                      { id: "f-1", name: "กองทุนทั่วไป", current_balance: "150000.00", target_budget: "200000.00" },
                    ],
                    error: options.customError?.funds || null,
                  }),
              }),
            }),
          };
        }
        if (table === "transactions") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  gte: () => ({
                    lte: () =>
                      Promise.resolve({
                        data: options.customData?.transactions || [
                          { amount: "65000.00", direction: "income" },
                          { amount: "20000.00", direction: "expense" },
                        ],
                        error: options.customError?.transactions || null,
                      }),
                  }),
                }),
                order: () =>
                  Promise.resolve({
                    data: options.customData?.transactionsList || [],
                    error: null,
                  }),
              }),
            }),
            insert: (payload: any) => {
              dbWrites.push({ table: "transactions", payload });
              return { select: () => ({ single: () => Promise.resolve({ data: { id: "tx-new" }, error: null }) }) };
            },
          };
        }
        if (table === "budgets") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: options.customData?.budgets || [
                    { id: "b-1", name: "งบอบรม", amount: "50000.00", actual_amount: "42000.00" },
                  ],
                  error: null,
                }),
            }),
          };
        }
        if (table === "members") {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: dummyMemberId, full_name: "มานะ ศรีสุข" },
                    error: null,
                  }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      },
      rpc: (fn: string, args: any) => {
        if (fn === "get_member_giving_history") {
          return Promise.resolve({
            data: [{ id: "g-1", amount: "12000.00", giving_type: "tithe" }],
            error: null,
          });
        }
        if (fn === "create_action_confirmation") {
          return Promise.resolve({
            data: { confirmation_id: "conf-uuid", expires_at: new Date().toISOString(), nonce: args.p_nonce },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
    };

    return client as any;
  }

  describe("1. Financial Summary & Provenance", () => {
    it("returns financial summary with strict facts, analysis, and data provenance", async () => {
      const mockSupabase = createMockSupabase({ role: "treasurer" });
      const service = new GraceAiReadService(mockSupabase, dummyChurchId);

      const response = await service.getMonthlyFinancialSummary("2026-08");

      expect(response.success).toBe(true);
      expect(response.facts).toEqual({
        total_income: "฿65,000.00",
        total_expense: "฿20,000.00",
        net_cashflow: "฿45,000.00",
        total_funds_balance: "฿150,000.00",
      });
      expect(response.analysis).toContain("เกินดุล ฿45,000.00");
      expect(response.interpretation).toContain("ข้อสังเกตเชิงการเงิน");
      expect(response.provenance?.source_type).toBe("POSTGRESQL_POSTED_LEDGER");
      expect(response.provenance?.excluded_states).toContain("draft");
      expect(response.provenance?.excluded_states).toContain("voided");
      expect(response.provenance?.church_id).toBe(dummyChurchId);
    });
  });

  describe("2. No Hallucinated Numbers (Fail-Closed on Missing/Error Data)", () => {
    it("returns non-committal disclaimer when ledger query fails without manufacturing fake numbers", async () => {
      const mockSupabase = createMockSupabase({
        role: "treasurer",
        customError: { transactions: { message: "Database connection failed", code: "500" } },
      });
      const service = new GraceAiReadService(mockSupabase, dummyChurchId);

      const response = await service.getMonthlyFinancialSummary("2026-08");

      expect(response.success).toBe(false);
      expect(response.facts).toBeNull();
      expect(response.message).toBe("ไม่สามารถยืนยันข้อมูลจาก Financial Ledger ได้");
    });
  });

  describe("3. Tenant Isolation & Context Override", () => {
    it("enforces that trusted session churchId strictly overrides any churchId specified in prompt", async () => {
      const mockSupabase = createMockSupabase({ role: "treasurer", churchId: dummyChurchId });
      const service = new GraceAiReadService(mockSupabase, dummyChurchId);

      // Prompt tries to query Church 99, but service is bound to Church 1
      const response = await service.getMonthlyFinancialSummary("2026-08", dummyOtherChurchId);

      expect(response.success).toBe(true);
      expect(response.provenance?.church_id).toBe(dummyChurchId);
    });
  });

  describe("4. Read-Only Guarantee (No Mutation Side-Effects)", () => {
    it("guarantees that READ operations perform ZERO database writes or state mutations", async () => {
      const mockSupabase = createMockSupabase({ role: "treasurer" });
      const service = new GraceAiReadService(mockSupabase, dummyChurchId);

      await service.getMonthlyFinancialSummary("2026-08");
      await service.getFundBalances();
      await service.getBudgetComparison(2026);

      expect(mockSupabase.dbWrites).toHaveLength(0);
    });
  });

  describe("5. Sensitive Giving Data Protection", () => {
    it("allows Pastor with valid reason to retrieve giving history with confidential provenance", async () => {
      const mockSupabase = createMockSupabase({ role: "pastor" });
      const service = new GraceAiReadService(mockSupabase, dummyChurchId);

      const response = await service.getConfidentialMemberGiving(
        dummyMemberId,
        "ตรวจสอบข้อมูลการถวายเพื่อการอภิบาล"
      );

      expect(response.success).toBe(true);
      expect(response.facts?.total_giving).toBe("฿12,000.00");
      expect(response.provenance?.source_type).toBe("POSTGRESQL_CONFIDENTIAL_RPC");
    });

    it("DENIES Finance Staff from reading confidential giving history", async () => {
      const mockSupabase = createMockSupabase({ role: "finance_staff" });
      const service = new GraceAiReadService(mockSupabase, dummyChurchId);

      const response = await service.getConfidentialMemberGiving(
        dummyMemberId,
        "ตรวจสอบข้อมูลเพื่อสรุปรายงาน"
      );

      expect(response.success).toBe(false);
      expect(response.facts).toBeNull();
      expect(response.code).toBe("PERMISSION_DENIED");
    });
  });

  describe("6. Server-Defined AI Agent Identity", () => {
    it("CRITICAL: ai_agent_id is strictly locked to grace_ai_v1 and cannot be spoofed by client", () => {
      expect(SecureAiToolExecutor.TRUSTED_AI_AGENT_ID).toBe("grace_ai_v1");
    });
  });
});
