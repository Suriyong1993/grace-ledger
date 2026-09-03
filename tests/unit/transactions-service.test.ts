import { describe, it, expect } from "vitest";
import { TransactionsService } from "../../src/lib/transactions/transactions-service";

describe("TransactionsService — Comprehensive Unit Tests", () => {
  const dummyChurchId = "00000000-0000-0000-0000-000000000001";
  const dummyFundId = "00000000-0000-0000-0000-000000000002";
  const dummyFund2Id = "00000000-0000-0000-0000-000000000003";
  const dummyAccountId = "00000000-0000-0000-0000-000000000004";
  const dummyCategoryId = "00000000-0000-0000-0000-000000000005";

  describe("1. createDraftTransaction", () => {
    it("creates draft transaction and splits when payload and split parity are valid", async () => {
      let insertedTxn: any = null;
      let insertedSplits: any = null;

      const mockSupabase = {
        from: (table: string) => {
          if (table === "transactions") {
            return {
              insert: (payload: any) => {
                insertedTxn = payload;
                return {
                  select: () => ({
                    single: () =>
                      Promise.resolve({
                        data: { id: "txn-created-123" },
                        error: null,
                      }),
                  }),
                };
              },
            };
          }
          if (table === "transaction_splits") {
            return {
              insert: (payload: any) => {
                insertedSplits = payload;
                return Promise.resolve({ error: null });
              },
            };
          }
          return {};
        },
      } as any;

      const service = new TransactionsService(mockSupabase, "finance_staff");

      const result = await service.createDraftTransaction({
        church_id: dummyChurchId,
        description: "ซื้ออุปกรณ์สำนักงาน",
        direction: "expense",
        transaction_date: "2026-08-21",
        category_id: dummyCategoryId,
        account_id: dummyAccountId,
        amount: "1500.00",
        splits: [
          { fund_id: dummyFundId, amount: "1000.00", notes: "สัดส่วน 1" },
          { fund_id: dummyFund2Id, amount: "500.00", notes: "สัดส่วน 2" },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data?.transaction_id).toBe("txn-created-123");
      expect(insertedTxn.status).toBe("draft");
      expect(insertedTxn.amount).toBe("1500.00");
      // Regression: transaction_date is the effective financial date, stored on the header row.
      expect(insertedTxn.transaction_date).toBe("2026-08-21");
      expect(insertedSplits).toHaveLength(2);
      expect(insertedSplits[0].amount).toBe("1000.00");
      expect(insertedSplits[1].amount).toBe("500.00");
    });

    it("stores category_id on transaction_splits, never on the transactions header row (regression)", async () => {
      let insertedTxn: any = null;
      let insertedSplits: any = null;

      const mockSupabase = {
        from: (table: string) => {
          if (table === "transactions") {
            return {
              insert: (payload: any) => {
                insertedTxn = payload;
                return {
                  select: () => ({
                    single: () =>
                      Promise.resolve({
                        data: { id: "txn-created-456" },
                        error: null,
                      }),
                  }),
                };
              },
            };
          }
          if (table === "transaction_splits") {
            return {
              insert: (payload: any) => {
                insertedSplits = payload;
                return Promise.resolve({ error: null });
              },
            };
          }
          return {};
        },
      } as any;

      const service = new TransactionsService(mockSupabase, "finance_staff");

      const result = await service.createDraftTransaction({
        church_id: dummyChurchId,
        description: "เงินถวายทั่วไป",
        direction: "income",
        transaction_date: "2026-08-23",
        category_id: dummyCategoryId,
        account_id: dummyAccountId,
        amount: "1000.00",
        splits: [
          { fund_id: dummyFundId, amount: "1000.00", notes: "หมายเหตุทดสอบ" },
        ],
      });

      expect(result.success).toBe(true);
      expect(insertedTxn).not.toHaveProperty("category_id");
      expect(insertedSplits[0].category_id).toBe(dummyCategoryId);
      // Regression: DB column is "note" (singular) — the public split input field
      // stays "notes" but must be written to the real column.
      expect(insertedSplits[0].note).toBe("หมายเหตุทดสอบ");
      expect(insertedSplits[0]).not.toHaveProperty("notes");
    });

    it("rejects when split sum does not match total amount (Split Parity Invariant)", async () => {
      const mockSupabase = {} as any;
      const service = new TransactionsService(mockSupabase, "finance_staff");

      const result = await service.createDraftTransaction({
        church_id: dummyChurchId,
        description: "ค่าอาหารค่าย",
        direction: "expense",
        transaction_date: "2026-08-21",
        category_id: dummyCategoryId,
        account_id: dummyAccountId,
        amount: "2000.00",
        splits: [
          { fund_id: dummyFundId, amount: "1800.00" }, // Sum = 1800 != 2000
        ],
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("SPLIT_SUM_MISMATCH");
      expect(result.error).toContain("ไม่ตรงกับยอดรวมรายการ");
    });

    it("rejects negative or zero total amount", async () => {
      const mockSupabase = {} as any;
      const service = new TransactionsService(mockSupabase, "finance_staff");

      const resZero = await service.createDraftTransaction({
        church_id: dummyChurchId,
        description: "ยอดศูนย์",
        direction: "expense",
        transaction_date: "2026-08-21",
        category_id: dummyCategoryId,
        account_id: dummyAccountId,
        amount: "0.00",
        splits: [{ fund_id: dummyFundId, amount: "0.00" }],
      });

      const resNeg = await service.createDraftTransaction({
        church_id: dummyChurchId,
        description: "ยอดติดลบ",
        direction: "expense",
        transaction_date: "2026-08-21",
        category_id: dummyCategoryId,
        account_id: dummyAccountId,
        amount: "-500.00",
        splits: [{ fund_id: dummyFundId, amount: "-500.00" }],
      });

      expect(resZero.success).toBe(false);
      expect(resNeg.success).toBe(false);
    });

    it("rejects invalid UUID formats for church, category, account, or fund", async () => {
      const mockSupabase = {} as any;
      const service = new TransactionsService(mockSupabase, "finance_staff");

      const result = await service.createDraftTransaction({
        church_id: "invalid-church-id",
        description: "ทดสอบ UUID",
        direction: "expense",
        transaction_date: "2026-08-21",
        category_id: dummyCategoryId,
        account_id: dummyAccountId,
        amount: "100.00",
        splits: [{ fund_id: dummyFundId, amount: "100.00" }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("UUID");
    });

    it("rejects unauthorized client action (RBAC fast-fail)", async () => {
      const mockSupabase = {} as any;
      const service = new TransactionsService(mockSupabase, "member");

      const result = await service.createDraftTransaction({
        church_id: dummyChurchId,
        description: "สร้างโดยสมาชิก",
        direction: "expense",
        transaction_date: "2026-08-21",
        category_id: dummyCategoryId,
        account_id: dummyAccountId,
        amount: "500.00",
        splits: [{ fund_id: dummyFundId, amount: "500.00" }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access Denied");
    });
  });

  describe("2. updateDraftTransaction", () => {
    it("updates draft transaction details and replaces splits when status is 'draft'", async () => {
      let updatedPayload: any = null;
      let deletedSplitsTxnId: string | null = null;
      let insertedNewSplits: any = null;

      const mockSupabase = {
        from: (table: string) => {
          if (table === "transactions") {
            return {
              select: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: { id: "txn-1", status: "draft", amount: "1000.00" },
                      error: null,
                    }),
                }),
              }),
              update: (payload: any) => {
                updatedPayload = payload;
                return { eq: () => Promise.resolve({ error: null }) };
              },
            };
          }
          if (table === "transaction_splits") {
            return {
              select: () => ({
                eq: () => ({
                  limit: () => ({
                    maybeSingle: () =>
                      Promise.resolve({ data: null, error: null }),
                  }),
                }),
              }),
              delete: () => ({
                eq: (_col: string, val: string) => {
                  deletedSplitsTxnId = val;
                  return Promise.resolve({ error: null });
                },
              }),
              insert: (payload: any) => {
                insertedNewSplits = payload;
                return Promise.resolve({ error: null });
              },
            };
          }
          return {};
        },
      } as any;

      const service = new TransactionsService(mockSupabase, "finance_staff");

      const result = await service.updateDraftTransaction("txn-1", {
        description: "แก้ไขรายละเอียดค่าเดินทาง",
        amount: "1200.00",
        splits: [
          { fund_id: dummyFundId, amount: "1200.00", notes: "แก้ไขยอด" },
        ],
      });

      expect(result.success).toBe(true);
      expect(updatedPayload).not.toHaveProperty("category_id");
      expect(updatedPayload.description).toBe("แก้ไขรายละเอียดค่าเดินทาง");
      expect(updatedPayload.amount).toBe("1200.00");
      expect(deletedSplitsTxnId).toBe("txn-1");
      expect(insertedNewSplits[0].amount).toBe("1200.00");
      // Regression: updateDraftTransaction must also write "note" (singular), not "notes".
      expect(insertedNewSplits[0].note).toBe("แก้ไขยอด");
      expect(insertedNewSplits[0]).not.toHaveProperty("notes");
    });

    it("updates transaction_date when explicitly provided, and leaves it untouched when omitted (regression)", async () => {
      let updatedPayloadWithDate: any = null;
      const mockSupabaseWithDate = {
        from: (table: string) => {
          if (table === "transactions") {
            return {
              select: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: { id: "txn-2", status: "draft", amount: "1000.00" },
                      error: null,
                    }),
                }),
              }),
              update: (payload: any) => {
                updatedPayloadWithDate = payload;
                return { eq: () => Promise.resolve({ error: null }) };
              },
            };
          }
          return {};
        },
      } as any;

      const serviceWithDate = new TransactionsService(
        mockSupabaseWithDate,
        "finance_staff",
      );
      await serviceWithDate.updateDraftTransaction("txn-2", {
        transaction_date: "2026-07-31",
      });
      expect(updatedPayloadWithDate.transaction_date).toBe("2026-07-31");

      let updatedPayloadNoDate: any = null;
      const mockSupabaseNoDate = {
        from: (table: string) => {
          if (table === "transactions") {
            return {
              select: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: { id: "txn-3", status: "draft", amount: "1000.00" },
                      error: null,
                    }),
                }),
              }),
              update: (payload: any) => {
                updatedPayloadNoDate = payload;
                return { eq: () => Promise.resolve({ error: null }) };
              },
            };
          }
          return {};
        },
      } as any;

      const serviceNoDate = new TransactionsService(
        mockSupabaseNoDate,
        "finance_staff",
      );
      await serviceNoDate.updateDraftTransaction("txn-3", {
        description: "แก้ไขคำอธิบายเท่านั้น",
      });
      expect(updatedPayloadNoDate).not.toHaveProperty("transaction_date");
    });

    it("DENIES update if transaction is in posted status (Immutable Ledger Violation)", async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: "txn-posted",
                    status: "posted",
                    amount: "5000.00",
                  },
                  error: null,
                }),
            }),
          }),
        }),
      } as any;

      const service = new TransactionsService(mockSupabase, "treasurer");

      const result = await service.updateDraftTransaction("txn-posted", {
        description: "พยายามแอบแก้รายการที่โพสต์แล้ว",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("IMMUTABLE_LEDGER_VIOLATION");
      expect(result.error).toContain("ไม่อนุญาตให้แก้ไข");
    });
  });

  describe("3. Lifecycle RPC Operations (Submit, Approve, Revision, Terminal Reject, Post, Void)", () => {
    it("submits draft transaction for approval via submit_transaction RPC", async () => {
      let rpcName = "";
      let rpcArgs: any = null;

      const mockSupabase = {
        rpc: (fn: string, args: any) => {
          rpcName = fn;
          rpcArgs = args;
          return Promise.resolve({
            data: { status: "pending_approval" },
            error: null,
          });
        },
      } as any;

      const service = new TransactionsService(mockSupabase, "finance_staff");
      const result = await service.submitTransaction("txn-100");

      expect(result.success).toBe(true);
      expect(rpcName).toBe("submit_transaction");
      expect(rpcArgs.p_transaction_id).toBe("txn-100");
    });

    it("approves transaction with optional notes via approve_transaction RPC", async () => {
      let rpcName = "";
      let rpcArgs: any = null;

      const mockSupabase = {
        rpc: (fn: string, args: any) => {
          rpcName = fn;
          rpcArgs = args;
          return Promise.resolve({ data: { status: "approved" }, error: null });
        },
      } as any;

      const service = new TransactionsService(mockSupabase, "approver");
      const result = await service.approveTransaction(
        "txn-100",
        "อนุมัติตามระเบียบข้อ 4.2",
      );

      expect(result.success).toBe(true);
      expect(rpcName).toBe("approve_transaction");
      expect(rpcArgs.p_transaction_id).toBe("txn-100");
      expect(rpcArgs.p_note).toBe("อนุมัติตามระเบียบข้อ 4.2");
    });

    it("requests transaction revision with valid reason (>= 5 chars)", async () => {
      let rpcArgs: any = null;
      const mockSupabase = {
        rpc: (fn: string, args: any) => {
          if (fn === "request_transaction_revision") {
            rpcArgs = args;
            return Promise.resolve({ data: { status: "draft" }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      } as any;

      const service = new TransactionsService(mockSupabase, "approver");
      const result = await service.requestRevision(
        "txn-100",
        "กรุณาแนบใบเสร็จฉบับจริง",
      );

      expect(result.success).toBe(true);
      expect(rpcArgs.p_revision_note).toBe("กรุณาแนบใบเสร็จฉบับจริง");
    });

    it("rejects revision request if reason is shorter than 5 characters", async () => {
      const mockSupabase = {} as any;
      const service = new TransactionsService(mockSupabase, "approver");

      const result = await service.requestRevision("txn-100", "แก้");

      expect(result.success).toBe(false);
      expect(result.error).toContain("อย่างน้อย 5 ตัวอักษร");
    });

    it("permanently rejects transaction with terminal reason (>= 5 chars)", async () => {
      let rpcArgs: any = null;
      const mockSupabase = {
        rpc: (fn: string, args: any) => {
          if (fn === "reject_transaction_terminal") {
            rpcArgs = args;
            return Promise.resolve({
              data: { status: "rejected" },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      } as any;

      const service = new TransactionsService(mockSupabase, "approver");
      const result = await service.rejectTransactionTerminal(
        "txn-100",
        "รายการไม่ถูกต้องและไม่ได้รับอนุมัติจากคณะกรรมการ",
      );

      expect(result.success).toBe(true);
      expect(rpcArgs.p_rejection_reason).toBe(
        "รายการไม่ถูกต้องและไม่ได้รับอนุมัติจากคณะกรรมการ",
      );
    });

    it("posts approved transaction to general ledger via post_transaction RPC", async () => {
      let rpcName = "";
      const mockSupabase = {
        rpc: (fn: string) => {
          rpcName = fn;
          return Promise.resolve({ data: { status: "posted" }, error: null });
        },
      } as any;

      const service = new TransactionsService(mockSupabase, "treasurer");
      const result = await service.postTransaction("txn-100");

      expect(result.success).toBe(true);
      expect(rpcName).toBe("post_transaction");
    });

    it("voids posted transaction and creates reversing mirror entry via void_transaction RPC", async () => {
      let rpcArgs: any = null;
      const mockSupabase = {
        rpc: (fn: string, args: any) => {
          if (fn === "void_transaction") {
            rpcArgs = args;
            return Promise.resolve({
              data: { status: "voided", reversal_id: "txn-rev-999" },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      } as any;

      const service = new TransactionsService(mockSupabase, "treasurer");
      const result = await service.voidTransaction(
        "txn-100",
        "บันทึกยอดเงินผิดพลาด ซ้ำซ้อนกับรายการเมื่อวาน",
      );

      expect(result.success).toBe(true);
      expect(rpcArgs.p_reason).toBe(
        "บันทึกยอดเงินผิดพลาด ซ้ำซ้อนกับรายการเมื่อวาน",
      );
    });
  });

  describe("4. Queries and Error Propagation", () => {
    it("handles database error gracefully without throwing unhandled exceptions", async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: null,
                  error: { message: "Database connection failed", code: "500" },
                }),
            }),
          }),
        }),
      } as any;

      const service = new TransactionsService(mockSupabase, "treasurer");
      const result = await service.getTransactions(dummyChurchId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
      expect(result.code).toBe("500");
    });
  });
});
