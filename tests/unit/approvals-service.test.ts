import { describe, it, expect, vi } from "vitest";
import { ApprovalsService } from "../../src/lib/transactions/approvals-service";

describe("ApprovalsService — Unit Tests", () => {
  it("rejects revision note with less than 5 characters without making RPC call", async () => {
    const mockSupabase: any = {
      rpc: vi.fn(),
    };
    const service = new ApprovalsService(mockSupabase);

    const result = await service.requestRevision({
      transactionId: "txn-123",
      revisionNote: "no",
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(result.error?.message).toContain("5 ตัวอักษร");
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it("calls request_transaction_revision RPC on valid requestRevision input", async () => {
    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: "txn-123",
        error: null,
      }),
    };
    const service = new ApprovalsService(mockSupabase);

    const result = await service.requestRevision({
      transactionId: "txn-123",
      revisionNote: "กรุณาแนบใบเสร็จตัวจริงเพิ่มเติม",
    });

    expect(result.success).toBe(true);
    expect(result.data?.transactionId).toBe("txn-123");
    expect(mockSupabase.rpc).toHaveBeenCalledWith("request_transaction_revision", {
      p_transaction_id: "txn-123",
      p_revision_note: "กรุณาแนบใบเสร็จตัวจริงเพิ่มเติม",
    });
  });

  it("calls reject_transaction_terminal RPC on valid rejectTransactionTerminal input", async () => {
    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: "txn-123",
        error: null,
      }),
    };
    const service = new ApprovalsService(mockSupabase);

    const result = await service.rejectTransactionTerminal({
      transactionId: "txn-123",
      rejectionReason: "ไม่อยู่ในงบประมาณประจำปีของคริสตจักร",
    });

    expect(result.success).toBe(true);
    expect(result.data?.transactionId).toBe("txn-123");
    expect(mockSupabase.rpc).toHaveBeenCalledWith("reject_transaction_terminal", {
      p_transaction_id: "txn-123",
      p_rejection_reason: "ไม่อยู่ในงบประมาณประจำปีของคริสตจักร",
    });
  });

  it("rejects rejection reason with less than 5 characters without making RPC call", async () => {
    const mockSupabase: any = {
      rpc: vi.fn(),
    };
    const service = new ApprovalsService(mockSupabase);

    const result = await service.rejectTransactionTerminal({
      transactionId: "txn-123",
      rejectionReason: "no",
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(result.error?.message).toContain("5 ตัวอักษร");
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it("handles Segregation of Duties error from RPC correctly", async () => {
    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "P0003",
          message: "Segregation of Duties Violation: Creator cannot approve their own transaction",
        },
      }),
    };
    const service = new ApprovalsService(mockSupabase);

    const result = await service.approveTransaction({
      transactionId: "txn-123",
    });

    expect(result.success).toBe(false);
    expect(result.error?.isTwoPersonViolation).toBe(true);
    expect(result.error?.isStaleState).toBe(false);
  });

  it("handles Concurrency / Stale State conflict from RPC correctly", async () => {
    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "P0001",
          message: "Invalid State Transition: Transaction is not pending approval (current status: approved).",
        },
      }),
    };
    const service = new ApprovalsService(mockSupabase);

    const result = await service.approveTransaction({
      transactionId: "txn-123",
    });

    expect(result.success).toBe(false);
    expect(result.error?.isStaleState).toBe(true);
  });

  it("maps pending approval queue items correctly including isCreator flag", async () => {
    const mockSupabase: any = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "txn-1",
                    church_id: "church-1",
                    account_id: "acc-1",
                    amount: "8500.00",
                    direction: "expense",
                    status: "pending_approval",
                    description: "ซื้ออุปกรณ์ค่ายเยาวชน",
                    reference_number: "EXP-0248",
                    created_by: "user-creator",
                    created_at: "2026-08-18T10:00:00Z",
                    metadata: { has_receipt: true },
                    accounts: { name: "ธนาคารกรุงเทพ" },
                    profiles: { full_name: "นรินทร์ สมหวัง" },
                    transaction_splits: [
                      {
                        id: "split-1",
                        church_id: "church-1",
                        fund_id: "fund-1",
                        amount: "8500.00",
                        funds: { name: "กองทุนเยาวชน", current_balance: "12010.00" },
                      },
                    ],
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    const service = new ApprovalsService(mockSupabase);

    // Case 1: Current user is the creator
    const resCreator = await service.getPendingApprovals("church-1", "user-creator");
    expect(resCreator.success).toBe(true);
    expect(resCreator.data?.[0].isCreator).toBe(true);
    expect(resCreator.data?.[0].creatorInitials).toBe("นส");
    expect(resCreator.data?.[0].hasReceipt).toBe(true);

    // Case 2: Current user is someone else
    const resOther = await service.getPendingApprovals("church-1", "user-pastor");
    expect(resOther.success).toBe(true);
    expect(resOther.data?.[0].isCreator).toBe(false);
  });
});
