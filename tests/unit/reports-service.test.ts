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
          transaction_splits: [{ amount: "50000.00", fund_id: "f-1", category_id: "cat-1", categories: { id: "cat-1", name: "ถวายทั่วไป" }, funds: { id: "f-1", name: "กองทุนทั่วไป" } }],
        },
        {
          id: "tx-2",
          amount: "12500.50",
          direction: "expense",
          description: "ค่าไฟฟ้าและน้ำประปา",
          transaction_date: "2026-08-05",
          status: "posted",
          transaction_splits: [{ amount: "12500.50", fund_id: "f-1", category_id: "cat-2", categories: { id: "cat-2", name: "สาธารณูปโภค" }, funds: { id: "f-1", name: "กองทุนทั่วไป" } }],
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
      // Regression: category resolved from transaction_splits.category_id, not transactions.category_id.
      const catNames = result.data?.categories_summary.map((c) => c.category_name);
      expect(catNames).toContain("ถวายทั่วไป");
      expect(catNames).toContain("สาธารณูปโภค");
    });

    it("reports a backdated transaction in its effective month (transaction_date), not the entry month (created_at) — regression", async () => {
      // transaction_date = 2026-07-31 (when the money actually moved)
      // created_at        = 2026-08-01 (when someone typed it into the system)
      // posted_at         = 2026-08-01 (when it was posted to the GL)
      const backdatedTxn = {
        id: "tx-backdated",
        amount: "9000.00",
        direction: "income",
        description: "เงินถวายสิ้นเดือนกรกฎาคม บันทึกย้อนหลัง",
        transaction_date: "2026-07-31",
        created_at: "2026-08-01T09:00:00Z",
        posted_at: "2026-08-01T09:05:00Z",
        status: "posted",
        transaction_splits: [{ amount: "9000.00", fund_id: "f-1", funds: { id: "f-1", name: "กองทุนทั่วไป" } }],
      };

      // Simulates real Postgres behavior: filters strictly by the queried column
      // (transaction_date), never by created_at or posted_at.
      const makeMockSupabase = (rows: any[]) => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: (col: string, val: string) => {
                  expect(col).toBe("transaction_date");
                  return {
                    lte: (col2: string, val2: string) => {
                      expect(col2).toBe("transaction_date");
                      const filtered = rows.filter((r) => r.transaction_date >= val && r.transaction_date <= val2);
                      return Promise.resolve({ data: filtered, error: null });
                    },
                  };
                },
              }),
            }),
          }),
        }),
      }) as any;

      const service = new ReportsService(makeMockSupabase([backdatedTxn]), "treasurer");

      // Queried as July → must be included (proves transaction_date drives the period, not created_at/posted_at)
      const julyResult = await service.getStatementOfFinancialPosition(dummyChurchId, "2026-07-01", "2026-07-31");
      expect(julyResult.success).toBe(true);
      expect(julyResult.data?.posted_transactions_count).toBe(1);
      expect(julyResult.data?.total_income.format()).toBe("฿9,000.00");

      // Queried as August → must be excluded, even though created_at/posted_at fall in August
      const augustResult = await service.getStatementOfFinancialPosition(dummyChurchId, "2026-08-01", "2026-08-31");
      expect(augustResult.success).toBe(true);
      expect(augustResult.data?.posted_transactions_count).toBe(0);
      expect(augustResult.data?.total_income.format()).toBe("฿0.00");
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
        { id: "f-1", name: "กองทุนทั่วไป", current_balance: "150000.00", target_amount: "200000.00", is_active: true },
        { id: "f-2", name: "กองทุนไร้งบ", current_balance: "25000.00", target_amount: "0.00", is_active: true }, // Target 0
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
        { id: "f-1", name: "กองทุนทั่วไป", current_balance: "100000.00", target_amount: "150000.00", is_active: true },
        { id: "f-2", name: "กองทุนพันธกิจ", current_balance: "50000.00", target_amount: "80000.00", is_active: true },
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

  describe("4. Direction typing comes from the ledger, not the description", () => {
    // Chainable stub that records the filters applied and resolves to `rows`.
    function makeSupabase(rows: any[]) {
      const b: any = {};
      for (const m of ["select", "eq", "gte", "lte", "order"]) {
        b[m] = () => b;
      }
      b.then = (resolve: any) => resolve({ data: rows, error: null });
      return { from: () => b } as any;
    }

    it("classifies by the direction column even when the Thai description reads the other way", async () => {
      // "ค่าเช่าที่ได้รับ" contains "ค่า", which the old substring rule treated
      // as an expense. The ledger says income, and the ledger wins.
      const rows = [
        {
          id: "tx-rent-received",
          amount: "30000.00",
          direction: "income",
          description: "ค่าเช่าที่ได้รับจากผู้เช่าอาคาร",
          transaction_date: "2026-08-04",
          status: "posted",
          transaction_splits: [{ amount: "30000.00", fund_id: "f-1", category_id: "cat-1", categories: { id: "cat-1", name: "รายได้ค่าเช่า" }, funds: { id: "f-1", name: "กองทุนทั่วไป" } }],
        },
      ];

      const service = new ReportsService(makeSupabase(rows), "treasurer");
      const res = await service.getStatementOfFinancialPosition(dummyChurchId, "2026-08-01", "2026-08-31");

      expect(res.data?.total_income.format()).toBe("฿30,000.00");
      expect(res.data?.total_expense.format()).toBe("฿0.00");
      expect(res.data?.categories_summary[0].type).toBe("income");
    });

    it("excludes posted fund transfers from income and from expense", async () => {
      // execute_confirmed_financial_action writes transfers as posted rows with
      // direction='transfer'. They move money between funds; they are not money
      // the church earned or spent.
      const rows = [
        {
          id: "tx-income",
          amount: "40000.00",
          direction: "income",
          description: "เงินถวายวันอาทิตย์",
          transaction_date: "2026-08-02",
          status: "posted",
          transaction_splits: [{ amount: "40000.00", fund_id: "f-1", category_id: "cat-1", categories: { id: "cat-1", name: "ถวายทั่วไป" }, funds: { id: "f-1", name: "กองทุนทั่วไป" } }],
        },
        {
          id: "tx-transfer",
          amount: "25000.00",
          direction: "transfer",
          description: "โอนเงินระหว่างกองทุน",
          transaction_date: "2026-08-06",
          status: "posted",
          transaction_splits: [{ amount: "25000.00", fund_id: "f-2", category_id: null, categories: null, funds: { id: "f-2", name: "กองทุนพันธกิจ" } }],
        },
      ];

      const service = new ReportsService(makeSupabase(rows), "treasurer");
      const res = await service.getStatementOfFinancialPosition(dummyChurchId, "2026-08-01", "2026-08-31");

      expect(res.data?.total_income.format()).toBe("฿40,000.00");
      expect(res.data?.total_expense.format()).toBe("฿0.00");
      expect(res.data?.net_surplus_deficit.format()).toBe("฿40,000.00");
      // The transfer is still a posted transaction, it just has no income or
      // expense bucket — and no category, since CategorySummary.type cannot
      // honestly describe it.
      expect(res.data?.posted_transactions_count).toBe(2);
      expect(res.data?.categories_summary).toHaveLength(1);
      expect(res.data?.categories_summary.every((c) => c.type === "income" || c.type === "expense")).toBe(true);
    });
  });

  describe("5. Executive summary month window", () => {
    /** Records the date range the statement query is given. */
    function makeSupabase(range: { start?: string; end?: string }) {
      const build = () => {
        const b: any = {};
        b.select = () => b;
        b.eq = () => b;
        b.order = () => b;
        b.gte = (_c: string, v: string) => {
          range.start = v;
          return b;
        };
        b.lte = (_c: string, v: string) => {
          range.end = v;
          return b;
        };
        b.then = (resolve: any) => resolve({ data: [], error: null });
        return b;
      };
      return { from: () => build() } as any;
    }

    it("ends February on the 28th instead of asking Postgres for the 31st", async () => {
      const range: { start?: string; end?: string } = {};
      const service = new ReportsService(makeSupabase(range), "treasurer");
      const res = await service.getExecutiveFinancialSummary(dummyChurchId, "2026-02");

      expect(res.success).toBe(true);
      expect(range.start).toBe("2026-02-01");
      expect(range.end).toBe("2026-02-28");
      // Regression: the old window was `${month}-31`, a date that does not exist.
      expect(range.end).not.toBe("2026-02-31");
    });

    it("ends a 30-day month on the 30th and a 31-day month on the 31st", async () => {
      const apr: { start?: string; end?: string } = {};
      await new ReportsService(makeSupabase(apr), "treasurer").getExecutiveFinancialSummary(dummyChurchId, "2026-04");
      expect(apr.end).toBe("2026-04-30");

      const aug: { start?: string; end?: string } = {};
      await new ReportsService(makeSupabase(aug), "treasurer").getExecutiveFinancialSummary(dummyChurchId, "2026-08");
      expect(aug.end).toBe("2026-08-31");
    });

    it("reports a malformed period as an error rather than a total over a wrong window", async () => {
      const range: { start?: string; end?: string } = {};
      const service = new ReportsService(makeSupabase(range), "treasurer");
      const res = await service.getExecutiveFinancialSummary(dummyChurchId, "2026-2");

      expect(res.success).toBe(false);
      expect(range.start).toBeUndefined();
    });
  });
});
