import { describe, it, expect, vi } from "vitest";
import { FundsService } from "../../src/lib/funds/funds-service";

describe("FundsService — Unit Tests", () => {
  it("lists funds scoped to church_id and active only", async () => {
    const query: any = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "fund-1",
            church_id: "church-1",
            name: "General",
            description: null,
            target_amount: null,
            current_balance: "1000.00",
            is_active: true,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        error: null,
      }),
    };
    const mockSupabase: any = {
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(query) }),
    };
    const service = new FundsService(mockSupabase);

    const result = await service.listFunds("church-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].currentBalance.toFixed(2)).toBe("1000.00");
    }
    expect(mockSupabase.from).toHaveBeenCalledWith("funds");
    expect(query.eq).toHaveBeenCalledWith("church_id", "church-1");
    expect(query.eq).toHaveBeenCalledWith("is_active", true);
  });

  it("rejects a transfer of zero or negative amount without calling the RPC", async () => {
    const mockSupabase: any = { rpc: vi.fn() };
    const service = new FundsService(mockSupabase);

    const result = await service.transferFunds({
      churchId: "church-1",
      fromFundId: "fund-1",
      toFundId: "fund-2",
      amount: "0",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_AMOUNT");
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it("calls transfer_funds RPC with a formatted 2-decimal amount", async () => {
    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({ data: "transfer-1", error: null }),
    };
    const service = new FundsService(mockSupabase);

    const result = await service.transferFunds({
      churchId: "church-1",
      fromFundId: "fund-1",
      toFundId: "fund-2",
      amount: 500,
      note: "ค่าไฟเดือนนี้",
    });

    expect(result.ok).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith("transfer_funds", {
      p_church_id: "church-1",
      p_from_fund_id: "fund-1",
      p_to_fund_id: "fund-2",
      p_amount: "500.00",
      p_note: "ค่าไฟเดือนนี้",
    });
  });

  it("maps insufficient-funds RPC error to Thai message", async () => {
    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Insufficient Funds: Source fund balance (฿100.00) is less than requested transfer (฿500.00)." },
      }),
    };
    const service = new FundsService(mockSupabase);

    const result = await service.transferFunds({
      churchId: "church-1",
      fromFundId: "fund-1",
      toFundId: "fund-2",
      amount: 500,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INSUFFICIENT_FUNDS");
      expect(result.error.message).toContain("ไม่เพียงพอ");
    }
  });
});
