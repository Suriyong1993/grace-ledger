import { describe, it, expect } from "vitest";
import { MembersService } from "../../src/lib/members/members-service";

describe("MembersService — Comprehensive Unit Tests", () => {
  const dummyChurchId = "00000000-0000-0000-0000-000000000001";
  const dummyMemberId = "00000000-0000-0000-0000-000000000010";

  describe("1. Member Directory & CRUD", () => {
    it("retrieves member directory for an authorized church", async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: dummyMemberId,
                        church_id: dummyChurchId,
                        full_name: "สมชาย รักพระเจ้า",
                        email: "somchai@test.com",
                        phone_number: "081-234-5678",
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

      const service = new MembersService(mockSupabase, "pastor");
      const result = await service.getMembers(dummyChurchId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].full_name).toBe("สมชาย รักพระเจ้า");
    });

    it("creates a new member profile and validates email format", async () => {
      let insertedPayload: any = null;
      const mockSupabase = {
        from: () => ({
          insert: (payload: any) => {
            insertedPayload = payload;
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: "new-member-uuid" }, error: null }),
              }),
            };
          },
        }),
      } as any;

      const service = new MembersService(mockSupabase, "finance_staff");
      const result = await service.createMember({
        church_id: dummyChurchId,
        full_name: "มานะ อดทน",
        email: "mana@grace.org",
        phone_number: "089-999-8888",
      });

      expect(result.success).toBe(true);
      expect(result.data?.member_id).toBe("new-member-uuid");
      expect(insertedPayload.full_name).toBe("มานะ อดทน");
    });

    it("rejects member creation with invalid email syntax", async () => {
      const mockSupabase = {} as any;
      const service = new MembersService(mockSupabase, "finance_staff");

      const result = await service.createMember({
        church_id: dummyChurchId,
        full_name: "ชื่อทดสอบ",
        email: "not-an-email",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("รูปแบบอีเมลไม่ถูกต้อง");
    });

    it("updates existing member profile", async () => {
      let updatedPayload: any = null;
      const mockSupabase = {
        from: () => ({
          update: (payload: any) => {
            updatedPayload = payload;
            return { eq: () => Promise.resolve({ error: null }) };
          },
        }),
      } as any;

      const service = new MembersService(mockSupabase, "treasurer");
      const result = await service.updateMember(dummyMemberId, {
        full_name: "สมชาย รักพระเจ้า (แก้ไข)",
        phone_number: "082-000-1111",
      });

      expect(result.success).toBe(true);
      expect(updatedPayload.full_name).toBe("สมชาย รักพระเจ้า (แก้ไข)");
    });
  });

  describe("2. Sensitive Giving History Access (Privacy by Design & RPC Guard)", () => {
    it("calls get_member_giving_history RPC when pastor provides valid reason (>= 5 chars)", async () => {
      let rpcArgs: any = null;
      const mockSupabase = {
        auth: {
          getUser: () => Promise.resolve({ data: { user: { id: "pastor-uuid-1" } }, error: null }),
        },
        rpc: (fn: string, args: any) => {
          if (fn === "get_member_giving_history") {
            rpcArgs = args;
            return Promise.resolve({
              data: [{ id: "g-1", amount: "5000.00", giving_type: "tithe", giving_date: "2026-08-01", notes: null }],
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      } as any;

      const service = new MembersService(mockSupabase, "pastor");
      const result = await service.getMemberGivingHistory({
        member_id: dummyMemberId,
        reason: "ตรวจสอบข้อมูลการถวายเพื่อการอภิบาล",
      });

      expect(result.success).toBe(true);
      expect(rpcArgs.p_member_id).toBe(dummyMemberId);
      expect(rpcArgs.p_reason).toBe("ตรวจสอบข้อมูลการถวายเพื่อการอภิบาล");
      expect(result.data?.[0].amount.format()).toBe("฿5,000.00");
    });

    it("DENIES giving history access if justification reason is shorter than 5 characters", async () => {
      const mockSupabase = {} as any;
      const service = new MembersService(mockSupabase, "pastor");

      const result = await service.getMemberGivingHistory({
        member_id: dummyMemberId,
        reason: "ดู", // < 5 chars
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("อย่างน้อย 5 ตัวอักษร");
    });

    it("DENIES giving history access to unauthorized roles (finance_staff, member, counter)", async () => {
      const mockSupabase = {} as any;

      const serviceStaff = new MembersService(mockSupabase, "finance_staff");
      const serviceMember = new MembersService(mockSupabase, "member");
      const serviceCounter = new MembersService(mockSupabase, "counter");

      const resStaff = await serviceStaff.getMemberGivingHistory({ member_id: dummyMemberId, reason: "ตรวจสอบ" });
      const resMember = await serviceMember.getMemberGivingHistory({ member_id: dummyMemberId, reason: "ตรวจสอบ" });
      const resCounter = await serviceCounter.getMemberGivingHistory({ member_id: dummyMemberId, reason: "ตรวจสอบ" });

      expect(resStaff.success).toBe(false);
      expect(resStaff.error).toContain("Access Denied");
      expect(resMember.success).toBe(false);
      expect(resMember.error).toContain("Access Denied");
      expect(resCounter.success).toBe(false);
      expect(resCounter.error).toContain("Access Denied");
    });

    it("triggers rate limiter when rapid sequential giving requests exceed threshold (Enumeration Defense)", async () => {
      const mockSupabase = {
        auth: {
          getUser: () => Promise.resolve({ data: { user: { id: "enum-attacker-id" } }, error: null }),
        },
        rpc: () => Promise.resolve({ data: [], error: null }),
      } as any;

      const service = new MembersService(mockSupabase, "pastor");

      // Execute 15 allowed requests
      for (let i = 0; i < 15; i++) {
        await service.getMemberGivingHistory({ member_id: dummyMemberId, reason: "ตรวจสอบประจำปี" });
      }

      // 16th request in same minute window must be rate-limited
      const resRateLimited = await service.getMemberGivingHistory({
        member_id: dummyMemberId,
        reason: "ตรวจสอบประจำปี",
      });

      expect(resRateLimited.success).toBe(false);
      expect(resRateLimited.code).toBe("RATE_LIMIT_EXCEEDED");
    });
  });

  describe("3. Giving Certificate Generation", () => {
    it("calculates server-side giving certificate data accurately for tax year", async () => {
      const mockGivingHistory = [
        { id: "g-1", amount: "10000.00", giving_type: "tithe", giving_date: "2026-02-14", notes: null },
        { id: "g-2", amount: "15000.00", giving_type: "tithe", giving_date: "2026-05-20", notes: null },
        { id: "g-3", amount: "5000.00", giving_type: "special", giving_date: "2026-08-10", notes: "ถวายค่าย" },
        { id: "g-4", amount: "12000.00", giving_type: "tithe", giving_date: "2025-12-25", notes: "ปีก่อน" }, // 2025 excluded
      ];

      const mockSupabase = {
        auth: {
          getUser: () => Promise.resolve({ data: { user: { id: "cert-generator-pastor" } }, error: null }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: dummyMemberId, full_name: "วนิดา เกียรติสกุล" },
                  error: null,
                }),
            }),
          }),
        }),
        rpc: (fn: string) => {
          if (fn === "get_member_giving_history") {
            return Promise.resolve({ data: mockGivingHistory, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      } as any;

      const service = new MembersService(mockSupabase, "pastor");
      const result = await service.getGivingCertificateData(dummyMemberId, 2026, "ออกหนังสือรับรองภาษี");

      expect(result.success).toBe(true);
      expect(result.data?.member_name).toBe("วนิดา เกียรติสกุล");
      expect(result.data?.tax_year).toBe(2026);
      expect(result.data?.total_giving.format()).toBe("฿30,000.00");
      expect(result.data?.tithe_count).toBe(2);
      expect(result.data?.records_count).toBe(3);
    });

    it("returns error when member profile is not found", async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: { message: "Not found", code: "PGRST116" } }),
            }),
          }),
        }),
      } as any;

      const service = new MembersService(mockSupabase, "pastor");
      const result = await service.getGivingCertificateData(dummyMemberId, 2026, "ออกหนังสือรับรอง");

      expect(result.success).toBe(false);
      expect(result.code).toBe("MEMBER_NOT_FOUND");
    });
  });
});
