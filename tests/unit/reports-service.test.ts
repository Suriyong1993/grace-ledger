import { describe, it, expect } from "vitest";
import { ReportsService } from "../../src/lib/reports/reports-service";

describe("ReportsService — Comprehensive Unit Tests", () => {
  const dummyChurchId = "00000000-0000-0000-0000-000000000001";

  describe("1. Statement of Financial Position (Posted Ledger Aggregation)", () => {
    it("aggregates strictly from posted transactions and calculates surplus/deficit with Money", async () => {
      const mockPostedTransactions = [
        {
          id: "tx-1",
          amount: "50000.00",
          direction: "income",
          description: "เงินถวายทั่วไปวันอาทิตย์",
          transaction_date: "2026-08-01",
          status: "posted",
          category_id: "cat-1",
          categories: { id: "cat-1", name: "ถวายทั่วไป" },
          transaction_splits: [{ amount: "50000.00", fund_id: "f-1", funds: { id: "f-1", name: "กองทุนทั่วไป" } }],
        },
        {
          id: "tx-2",
          amount: "12500.50",
          direction: "expense",
          description: "ค่าไฟฟ้าและน้ำประปา",
          transaction_date: "2026-08-05",
          status: "posted",
          category_id: "cat-2",
          categories: { id: "cat-2", name: "สาธารณูปโภค" },
          transaction_splits: [{ amount: "12500.50", fund_id: "f-1", funds: { id: "f-1", name: "กองทุนทั่วไป" } }],
        },
      ];

      const mockSupabase = {
        from: (table: string) => {
          if (table === "transactions") {
            return {
              select: () => ({
                eq: (col1: string, val1: string) => ({
                  eq: (col2: string, val2: string) => {
                    // Must query church_id and status='posted'
                    expect(col1).toBe("church_id");
                    expect(val1).toBe(dummyChurchId);
                    expect(col2).toBe("status");
                    expect(val2).toBe("posted");
                    return {
                      gte: () => ({
                        lte: () => Promise.resolve({ data: mockPostedTransactions, error: null }),
                      }),
                    };
                  },
                }),
              }),
            };
          }
          return {};
        },
      } as any;

      const service = new ReportsService(mockSupabase, "treasurer");
      const result = await service.getStatementOfFinancialPosition(dummyChurchId, "2026-08-01", "2026-08-31");

      expect(result.success).toBe(true);
      expect(result.data?.total_income.format()).toBe("฿50,000.00");
      expect(result.data?.total_expense.format()).toBe("฿12,500.50");
      expect(result.data?.net_surplus_deficit.format()).toBe("฿37,499.50");
      expect(result.data?.posted_transactions_count).toBe(2);
      expect(result.data?.categories_summary).toHaveLength(2);
      expect(result.data?.funds_allocation).toHaveLength(1);
    });

    it("propagates database error cleanly when financial query fails", async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  lte: () => Promise.resolve({ data: null, error: { message: "Database timeout", code: "504" } }),
                }),
              }),
            }),
          }),
        }),
      } as any;

      const service = new ReportsService(mockSupabase, "treasurer");
      const result = await service.getStatementOfFinancialPosition(dummyChurchId, "2026-08-01", "2026-08-31");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database timeout");
    });
  });

  describe("2. Fund Balances Summary & Budget Variance", () => {
    it("computes fund balance variances against target budget without division-by-zero", async () => {
      const mockFunds = [
        { id: "f-1", name: "กองทุนทั่วไป", current_balance: "150000.00", target_budget: "200000.00", is_active: true },
        { id: "f-2", name: "กองทุนไร้งบ", current_balance: "25000.00", target_budget: "0.00", is_active: true }, // Target 0
      ];

      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockFunds, error: null }),
            }),
          }),
        }),
      } as any;

      const service = new ReportsService(mockSupabase, "pastor");
      const result = await service.getFundBalancesSummary(dummyChurchId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].budget_variance_percentage).toBe(75); // 150000 / 200000 = 75%
      expect(result.data?.[1].budget_variance_percentage).toBe(0); // 0 safely handled
    });
  });

  describe("3. Executive Financial Summary & Data Provenance", () => {
    it("generates executive summary with strict provenance metadata and zero mock data", async () => {
      const mockFunds = [
        { id: "f-1", name: "กองทุนทั่วไป", current_balance: "100000.00", target_budget: "150000.00", is_active: true },
        { id: "f-2", name: "กองทุนพันธกิจ", current_balance: "50000.00", target_budget: "80000.00", is_active: true },
      ];

      const mockSupabase = {
        from: (table: string) => {
          if (table === "funds") {
            return {
              select: () => ({
                eq: () => ({
                  order: () => Promise.resolve({ data: mockFunds, error: null }),
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
                      lte: () => Promise.resolve({ data: [], error: null }),
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        },
      } as any;

      const service = new ReportsService(mockSupabase, "pastor");
      const result = await service.getExecutiveFinancialSummary(dummyChurchId, "2026-08");

      expect(result.success).toBe(true);
      expect(result.data?.total_ledger_balance.format()).toBe("฿150,000.00");
      expect(result.data?.total_funds_count).toBe(2);
      expect(result.data?.provenance.data_source).toBe("POSTGRESQL_POSTED_LEDGER");
      expect(result.data?.provenance.period).toBe("2026-08");
      expect(result.data?.provenance.excluded_states).toEqual(["draft", "pending_approval", "rejected", "voided"]);
    });

    it("handles clean empty dataset reporting 0.00 without error", async () => {
      const mockSupabase = {
        from: (table: string) => {
          if (table === "funds") {
            return {
              select: () => ({
                eq: () => ({
                  order: () => Promise.resolve({ data: [], error: null }),
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
                      lte: () => Promise.resolve({ data: [], error: null }),
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        },
      } as any;

      const service = new ReportsService(mockSupabase, "pastor");
      const result = await service.getExecutiveFinancialSummary(dummyChurchId, "2026-08");

      expect(result.success).toBe(true);
      expect(result.data?.total_ledger_balance.format()).toBe("฿0.00");
      expect(result.data?.total_funds_count).toBe(0);
      expect(result.data?.monthly_income.format()).toBe("฿0.00");
    });
  });
});
