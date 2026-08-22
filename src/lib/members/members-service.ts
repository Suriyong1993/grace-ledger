import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Database } from "../supabase/types";
import { Money } from "../money";
import { UserRole, assertPermission } from "../rbac";

export const CreateMemberSchema = z.object({
  church_id: z.string().uuid("รหัสคริสตจักรต้องเป็น UUID"),
  full_name: z.string().trim().min(1, "กรุณาระบุชื่อ-นามสกุลสมาชิก"),
  email: z.string().email("รูปแบบอีเมลไม่ถูกต้อง").optional().or(z.literal("")),
  phone_number: z.string().optional().or(z.literal("")),
});

export const UpdateMemberSchema = z.object({
  full_name: z.string().trim().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone_number: z.string().optional().or(z.literal("")),
  is_active: z.boolean().optional(),
});

export const GivingHistoryRequestSchema = z.object({
  member_id: z.string().uuid("รหัสสมาชิกต้องเป็น UUID"),
  reason: z.string().trim().min(5, "ต้องระบุเหตุผลในการเข้าถึงข้อมูลการถวายอย่างน้อย 5 ตัวอักษร"),
});

export type CreateMemberInput = z.infer<typeof CreateMemberSchema>;
export type UpdateMemberInput = z.infer<typeof UpdateMemberSchema>;
export type GivingHistoryRequestInput = z.infer<typeof GivingHistoryRequestSchema>;

export interface MemberModel {
  id: string;
  church_id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  is_active: boolean;
  created_at: string;
}

export interface GivingHistoryRecord {
  id: string;
  amount: Money;
  giving_type: string;
  giving_date: string;
  notes: string | null;
}

export interface CertificateData {
  member_id: string;
  member_name: string;
  tax_year: number;
  total_giving: Money;
  tithe_count: number;
  records_count: number;
  generated_at: string;
  reason: string;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export class MembersService {
  private static lookupTimestamps: Map<string, number[]> = new Map();

  constructor(
    private supabase: SupabaseClient<Database>,
    private currentRole?: UserRole
  ) {}

  private checkRole(action: "create" | "read" | "update" | "delete" | "export", resource: "members" | "member_giving") {
    if (this.currentRole) {
      assertPermission(this.currentRole, action, resource);
    }
  }

  /**
   * Rate limiting and enumeration defense for sensitive giving data
   */
  private checkRateLimit(actorId: string): boolean {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequestsPerMinute = 15;

    const timestamps = MembersService.lookupTimestamps.get(actorId) || [];
    const recent = timestamps.filter((t) => now - t < windowMs);

    if (recent.length >= maxRequestsPerMinute) {
      return false;
    }

    recent.push(now);
    MembersService.lookupTimestamps.set(actorId, recent);
    return true;
  }

  /**
   * Get member directory for a church
   */
  public async getMembers(churchId: string): Promise<ServiceResult<MemberModel[]>> {
    try {
      this.checkRole("read", "members");
      const { data, error } = await (this.supabase
        .from("members") as any)
        .select("id, church_id, full_name, email, phone_number, is_active, created_at")
        .eq("church_id", churchId)
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data || [] };
    } catch (err: any) {
      return { success: false, error: err.message || "เกิดข้อผิดพลาดในการดึงข้อมูลสมาชิก" };
    }
  }

  /**
   * Create a new member
   */
  public async createMember(input: CreateMemberInput): Promise<ServiceResult<{ member_id: string }>> {
    try {
      this.checkRole("create", "members");
      const parsed = CreateMemberSchema.parse(input);

      const { data, error } = await (this.supabase
        .from("members") as any)
        .insert({
          church_id: parsed.church_id,
          full_name: parsed.full_name,
          email: parsed.email || null,
          phone_number: parsed.phone_number || null,
          is_active: true,
        })
        .select("id")
        .single();

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: { member_id: data.id } };
    } catch (err: any) {
      return { success: false, error: err.message || "เกิดข้อผิดพลาดในการสร้างสมาชิก" };
    }
  }

  /**
   * Update member profile
   */
  public async updateMember(
    memberId: string,
    input: UpdateMemberInput
  ): Promise<ServiceResult<{ member_id: string }>> {
    try {
      this.checkRole("update", "members");
      const parsed = UpdateMemberSchema.parse(input);

      const payload: Record<string, any> = {};
      if (parsed.full_name) payload.full_name = parsed.full_name;
      if (parsed.email !== undefined) payload.email = parsed.email || null;
      if (parsed.phone_number !== undefined) payload.phone_number = parsed.phone_number || null;
      if (parsed.is_active !== undefined) payload.is_active = parsed.is_active;

      const { error } = await (this.supabase
        .from("members") as any)
        .update(payload)
        .eq("id", memberId);

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: { member_id: memberId } };
    } catch (err: any) {
      return { success: false, error: err.message || "เกิดข้อผิดพลาดในการแก้ไขสมาชิก" };
    }
  }

  /**
   * Securely retrieve confidential member giving history via RPC with mandatory justification reason
   */
  public async getMemberGivingHistory(
    input: GivingHistoryRequestInput
  ): Promise<ServiceResult<GivingHistoryRecord[]>> {
    try {
      this.checkRole("read", "member_giving");
      const parsed = GivingHistoryRequestSchema.parse(input);

      // Enumeration defense check
      const currentUserId = (await this.supabase.auth.getUser()).data.user?.id || "anonymous";
      if (!this.checkRateLimit(currentUserId)) {
        return {
          success: false,
          error: "Rate Limit Exceeded: คุณเรียกดูข้อมูลประวัติการถวายบ่อยเกินไป กรุณารอ 1 นาที",
          code: "RATE_LIMIT_EXCEEDED",
        };
      }

      const { data, error } = await (this.supabase.rpc as any)("get_member_giving_history", {
        p_member_id: parsed.member_id,
        p_reason: parsed.reason,
      });

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      const rawRecords = (data as any[]) || [];
      const records: GivingHistoryRecord[] = rawRecords.map((r: any) => ({
        id: r.id,
        amount: Money.from(r.amount),
        giving_type: r.giving_type || "general",
        giving_date: r.giving_date,
        notes: r.notes || null,
      }));

      return { success: true, data: records };
    } catch (err: any) {
      return { success: false, error: err.message || "เกิดข้อผิดพลาดในการดึงประวัติการถวาย" };
    }
  }

  /**
   * Server-side verified Giving Certificate Data calculation
   */
  public async getGivingCertificateData(
    memberId: string,
    taxYear: number,
    reason: string
  ): Promise<ServiceResult<CertificateData>> {
    try {
      // 1. Fetch member details
      const { data: member, error: memberError } = await (this.supabase
        .from("members") as any)
        .select("id, full_name")
        .eq("id", memberId)
        .single();

      if (memberError || !member) {
        return { success: false, error: "ไม่พบข้อมูลสมาชิก", code: "MEMBER_NOT_FOUND" };
      }

      // 2. Fetch giving history via secure RPC
      const historyRes = await this.getMemberGivingHistory({ member_id: memberId, reason });
      if (!historyRes.success || !historyRes.data) {
        return { success: false, error: historyRes.error || "ไม่สามารถดึงข้อมูลประวัติการถวายได้" };
      }

      // 3. Filter for specified tax year and aggregate
      const yearStart = `${taxYear}-01-01`;
      const yearEnd = `${taxYear}-12-31`;

      let totalGiving = Money.zero();
      let titheCount = 0;
      let recordsCount = 0;

      for (const record of historyRes.data) {
        if (record.giving_date >= yearStart && record.giving_date <= yearEnd) {
          totalGiving = totalGiving.add(record.amount);
          recordsCount++;
          if (record.giving_type === "tithe" || record.giving_type === "สิบลด") {
            titheCount++;
          }
        }
      }

      return {
        success: true,
        data: {
          member_id: member.id,
          member_name: member.full_name,
          tax_year: taxYear,
          total_giving: totalGiving,
          tithe_count: titheCount,
          records_count: recordsCount,
          generated_at: new Date().toISOString(),
          reason,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message || "เกิดข้อผิดพลาดในการสร้างข้อมูลหนังสือรับรอง" };
    }
  }
}
