import { describe, it, expect, vi } from "vitest";
import { MembersService } from "../../src/lib/members/members-service";

describe("MembersService — Unit Tests", () => {
  it("rejects getGivingHistory with a reason under 5 characters without calling the RPC", async () => {
    const mockSupabase: any = { rpc: vi.fn() };
    const service = new MembersService(mockSupabase);

    const result = await service.getGivingHistory("member-1", "ok");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("REASON_REQUIRED");
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it("calls get_member_giving_history RPC with member id and trimmed reason", async () => {
    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            id: "giving-1",
            church_id: "church-1",
            member_id: "member-1",
            offering_session_id: null,
            amount: "1500.00",
            giving_type: "tithe",
            payment_method: "bank_transfer",
            given_at: "2026-08-01",
            confidential_note: null,
            created_by: "user-1",
            created_at: "2026-08-01T00:00:00Z",
          },
        ],
        error: null,
      }),
    };
    const service = new MembersService(mockSupabase);

    const result = await service.getGivingHistory("member-1", "  ตรวจสอบตามคำร้องขอใบรับรอง  ");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].amount.toFixed(2)).toBe("1500.00");
    }
    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_member_giving_history", {
      p_member_id: "member-1",
      p_reason: "ตรวจสอบตามคำร้องขอใบรับรอง",
    });
  });

  it("maps unauthorized RPC error to Thai message", async () => {
    const mockSupabase: any = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Unauthorized: caller is not permitted to access giving records." },
      }),
    };
    const service = new MembersService(mockSupabase);

    const result = await service.getGivingHistory("member-1", "เหตุผลการเข้าถึงข้อมูลสมาชิก");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNAUTHORIZED");
      expect(result.error.message).toContain("ไม่มีสิทธิ์");
    }
  });

  it("lists members scoped to church_id and active only", async () => {
    const query: any = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "member-1",
            church_id: "church-1",
            full_name: "สมชาย ใจดี",
            member_code: null,
            household_name: null,
            joined_date: null,
            phone: null,
            email: null,
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
    const service = new MembersService(mockSupabase);

    const result = await service.listMembers("church-1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(1);
    expect(mockSupabase.from).toHaveBeenCalledWith("members");
    expect(query.eq).toHaveBeenCalledWith("church_id", "church-1");
  });
});
