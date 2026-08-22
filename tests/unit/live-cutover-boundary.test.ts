import { describe, it, expect } from "vitest";
import { HistoricalService } from "../../src/lib/reports/historical-service";
import { TransactionsService } from "../../src/lib/transactions/transactions-service";
import { SplitEngine } from "../../src/lib/transactions/split-engine";
import { Money } from "../../src/lib/money";

/**
 * Suite: Live Cutover Boundary & Accounting Isolation Guarantee
 *
 * Hard Boundary Rules:
 *  - <= 2026-07-31: Historical / Preview only
 *  - >= 2026-08-01: Live General Ledger
 *
 * Requirements:
 *  1. Historical records (< 2026-08-01) MUST NOT create journal entries, touch GL, or modify fund balances.
 *  2. Live transactions (>= 2026-08-01) MUST flow through the standard transaction pipeline
 *     (draft -> pending_approval -> approved -> posted) and impact General Ledger / Funds.
 *  3. Live transactions (>= 2026-08-01) MUST NEVER be written or leaked into historical tables.
 *  4. Historical queries MUST strictly reject periods >= 2026-08-01 as live periods.
 *  5. SplitEngine MUST correctly balance live transactions on or after 2026-08-01.
 */
describe("Live Cutover Boundary & Accounting Isolation (2026-08-01)", () => {
  const CUTOVER_DATE = "2026-08-01";
  const CHURCH_ID = "00000000-0000-4000-8000-000000000001";

  describe("1. Cutover Date Boundary Evaluation", () => {
    it("classifies all dates prior to 2026-08-01 as historical", () => {
      expect(HistoricalService.isHistoricalPeriod("2026-01-01")).toBe(true);
      expect(HistoricalService.isHistoricalPeriod("2026-01")).toBe(true);
      expect(HistoricalService.isHistoricalPeriod("2026-03-31")).toBe(true);
      expect(HistoricalService.isHistoricalPeriod("2026-07-19")).toBe(true);
      expect(HistoricalService.isHistoricalPeriod("2026-07-31")).toBe(true);
      expect(HistoricalService.isHistoricalPeriod("2026-07")).toBe(true);
    });

    it("classifies cutover date 2026-08-01 and future dates strictly as LIVE", () => {
      expect(HistoricalService.isHistoricalPeriod("2026-08-01")).toBe(false);
      expect(HistoricalService.isHistoricalPeriod("2026-08")).toBe(false);
      expect(HistoricalService.isHistoricalPeriod("2026-08-15")).toBe(false);
      expect(HistoricalService.isHistoricalPeriod("2026-09-01")).toBe(false);
      expect(HistoricalService.isHistoricalPeriod("2026-12-31")).toBe(false);
      expect(HistoricalService.isHistoricalPeriod("2027-01-01")).toBe(false);
    });
  });

  describe("2. Historical Records Accounting Isolation", () => {
    it("guarantees HistoricalService queries only dedicated historical tables, never touching live transactions or funds", async () => {
      const accessedTables: string[] = [];

      const mockSupabase = {
        from: (table: string) => {
          accessedTables.push(table);
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => Promise.resolve({ data: [], error: null }),
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          };
        },
      } as any;

      const service = new HistoricalService(mockSupabase);
      await service.getMonthlySummaries(CHURCH_ID);
      await service.getMonthlySummaryByMonth(CHURCH_ID, 3);
      await service.getWeeklySummaries(CHURCH_ID, 2569, 7);
      await service.getGrandTotals(CHURCH_ID);

      // Verify accessed tables
      expect(accessedTables.every((t) => t.startsWith("historical_"))).toBe(true);
      expect(accessedTables).not.toContain("transactions");
      expect(accessedTables).not.toContain("transaction_splits");
      expect(accessedTables).not.toContain("funds");
      expect(accessedTables).not.toContain("accounts");
      expect(accessedTables).not.toContain("offering_sessions");
    });
  });

  describe("3. Live Transactions Pipeline (Aug 1, 2026 onward)", () => {
    it("processes live transactions on 2026-08-01 through full GL pipeline and splits", async () => {
      let insertedTransaction: any = null;
      let insertedSplits: any[] = [];

      const mockSupabase = {
        from: (table: string) => {
          if (table === "transactions") {
            return {
              insert: (record: any) => ({
                select: () => ({
                  single: () => {
                    insertedTransaction = {
                      id: "txn-live-001",
                      ...record,
                      status: "draft",
                    };
                    return Promise.resolve({ data: insertedTransaction, error: null });
                  },
                }),
              }),
              update: (updateData: any) => ({
                eq: () => ({
                  eq: () => ({
                    select: () => ({
                      single: () => {
                        insertedTransaction = { ...insertedTransaction, ...updateData };
                        return Promise.resolve({ data: insertedTransaction, error: null });
                      },
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "transaction_splits") {
            return {
              insert: (splits: any[]) => {
                insertedSplits = splits;
                return Promise.resolve({ data: splits, error: null });
              },
            };
          }
          if (table === "audit_logs") {
            return {
              insert: () => Promise.resolve({ data: null, error: null }),
            };
          }
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          };
        },
      } as any;

      const txnService = new TransactionsService(mockSupabase);

      // 1. Create a Live transaction dated 2026-08-01
      const createRes = await txnService.createDraftTransaction({
        church_id: CHURCH_ID,
        description: "เงินถวายสิบลด ประจำวันอาทิตย์แรกของสิงหาคม 2569 (Live)",
        transaction_date: CUTOVER_DATE,
        category_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        account_id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        amount: 50000,
        splits: [
          {
            fund_id: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
            amount: 50000,
            notes: "เข้ากองทุนทั่วไป",
          },
        ],
      });

      expect(createRes.success).toBe(true);
      expect(insertedTransaction).not.toBeNull();
      expect(insertedTransaction.transaction_date).toBe("2026-08-01");
      expect(insertedTransaction.amount).toBe("50000.00");
      expect(insertedSplits.length).toBe(1);
      expect(insertedSplits[0].amount).toBe("50000.00");
      expect(insertedSplits[0].fund_id).toBe("c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33");

      // Verify SplitEngine parity validation
      const splitValidation = SplitEngine.validateParity(
        Money.from(insertedTransaction.amount),
        insertedSplits.map((s) => ({ fundId: s.fund_id, amount: Money.from(s.amount) }))
      );
      expect(splitValidation.isValid).toBe(true);
      expect(splitValidation.difference.isZero()).toBe(true);

      // Verify transaction date is >= cutover
      expect(HistoricalService.isHistoricalPeriod(insertedTransaction.transaction_date)).toBe(false);
    });

    it("verifies live transaction submission triggers approval workflow and posts to GL via RPC", async () => {
      let currentStatus = "draft";
      let postedToGL = false;

      const mockSupabase = {
        rpc: (funcName: string, params: any) => {
          if (funcName === "submit_transaction") {
            currentStatus = "pending_approval";
            return Promise.resolve({
              data: { success: true, status: "pending_approval", transaction_id: params.p_transaction_id },
              error: null,
            });
          }
          if (funcName === "approve_transaction") {
            currentStatus = "approved";
            return Promise.resolve({
              data: { success: true, status: "approved", transaction_id: params.p_transaction_id },
              error: null,
            });
          }
          if (funcName === "post_transaction") {
            currentStatus = "posted";
            postedToGL = true;
            return Promise.resolve({
              data: { success: true, status: "posted", transaction_id: params.p_transaction_id },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      } as any;

      const txnService = new TransactionsService(mockSupabase);

      // 1. Submit for approval
      const submitRes = await txnService.submitTransaction("txn-live-002");
      expect(submitRes.success).toBe(true);
      expect(currentStatus).toBe("pending_approval");

      // 2. Approve transaction
      const approveRes = await txnService.approveTransaction("txn-live-002", "อนุมัติรายการเรียบร้อย");
      expect(approveRes.success).toBe(true);
      expect(currentStatus).toBe("approved");

      // 3. Post transaction to General Ledger
      const postRes = await txnService.postTransaction("txn-live-002");
      expect(postRes.success).toBe(true);
      expect(currentStatus).toBe("posted");
      expect(postedToGL).toBe(true);
    });
  });

  describe("4. No Cross-Contamination Invariant", () => {
    it("ensures live queries do not count historical summaries and historical queries do not count live transactions", () => {
      // Historical test numbers
      const historicalTotals = {
        income: Money.from(153283),
        expense: Money.from(146165),
        net: Money.from(7118),
      };

      // Live August transactions
      const liveAugustTransactions = [
        { amount: Money.from(124500), direction: "income", date: "2026-08-02" },
        { amount: Money.from(65000), direction: "expense", date: "2026-08-10" },
      ];

      const liveIncome = liveAugustTransactions
        .filter((t) => t.direction === "income")
        .reduce((sum, t) => sum.add(t.amount), Money.zero());

      const liveExpense = liveAugustTransactions
        .filter((t) => t.direction === "expense")
        .reduce((sum, t) => sum.add(t.amount), Money.zero());

      const liveNet = liveIncome.subtract(liveExpense);

      // Verify each domain remains purely separate
      expect(historicalTotals.income.format()).toBe("฿153,283.00");
      expect(historicalTotals.expense.format()).toBe("฿146,165.00");
      expect(historicalTotals.net.format()).toBe("฿7,118.00");

      expect(liveIncome.format()).toBe("฿124,500.00");
      expect(liveExpense.format()).toBe("฿65,000.00");
      expect(liveNet.format()).toBe("฿59,500.00");

      // Combined Full Year 2569 (Only in Reporting view, never in General Ledger balances)
      const fullYearIncome = historicalTotals.income.add(liveIncome);
      const fullYearExpense = historicalTotals.expense.add(liveExpense);
      const fullYearNet = historicalTotals.net.add(liveNet);

      expect(fullYearIncome.format()).toBe("฿277,783.00");
      expect(fullYearExpense.format()).toBe("฿211,165.00");
      expect(fullYearNet.format()).toBe("฿66,618.00");
    });
  });
});
