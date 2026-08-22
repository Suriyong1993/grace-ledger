import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../supabase/types";
import { Money } from "../money";
import { Member, GivingRecord, MemberServiceError, MemberServiceResult } from "./types";

/**
 * Service Layer for Members and Giving History.
 * Giving history is Highly Confidential: `member_giving_records` blocks direct
 * SELECT via RLS (USING (false)) — the only path is get_member_giving_history,
 * which requires an explicit p_reason and is fully audited server-side.
 *
 * `members` isn't in the generated Database type yet (added after the last
 * `supabase gen types` run) — cast the same way offering-service.ts does for
 * offering_* tables until types are regenerated.
 */
export class MembersService {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  public static mapDatabaseError(err: any): MemberServiceError {
    const rawMessage = err?.message || String(err || "");

    if (rawMessage.includes("Unauthorized") || rawMessage.includes("not authorized")) {
      return { code: "UNAUTHORIZED", message: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้", details: rawMessage };
    }
    if (rawMessage.includes("Member not found") || rawMessage.includes("does not exist")) {
      return { code: "MEMBER_NOT_FOUND", message: "ไม่พบสมาชิกที่ระบุ", details: rawMessage };
    }
    return { code: "UNKNOWN_ERROR", message: "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง", details: rawMessage };
  }

  private mapMemberRow(row: any): Member {
    return {
      id: row.id,
      churchId: row.church_id,
      fullName: row.full_name,
      memberCode: row.member_code ?? null,
      householdName: row.household_name ?? null,
      joinedDate: row.joined_date ?? null,
      phone: row.phone ?? null,
      email: row.email ?? null,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public async listMembers(churchId: string): Promise<MemberServiceResult<Member[]>> {
    try {
      const { data, error } = await (this.supabase.from as any)("members")
        .select("*")
        .eq("church_id", churchId)
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (error) throw error;
      return { ok: true, data: (data || []).map((row: any) => this.mapMemberRow(row)) };
    } catch (err: any) {
      return { ok: false, error: MembersService.mapDatabaseError(err) };
    }
  }

  public async getMember(memberId: string): Promise<MemberServiceResult<Member>> {
    try {
      const { data, error } = await (this.supabase.from as any)("members")
        .select("*")
        .eq("id", memberId)
        .single();

      if (error) throw error;
      if (!data) {
        return { ok: false, error: { code: "MEMBER_NOT_FOUND", message: "ไม่พบสมาชิกที่ระบุ" } };
      }
      return { ok: true, data: this.mapMemberRow(data) };
    } catch (err: any) {
      return { ok: false, error: MembersService.mapDatabaseError(err) };
    }
  }

  /**
   * Giving history is sensitive: requires an explicit, non-empty access reason,
   * which the RPC records in the audit trail alongside the requester's identity.
   */
  public async getGivingHistory(
    memberId: string,
    reason: string
  ): Promise<MemberServiceResult<GivingRecord[]>> {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 5) {
      return {
        ok: false,
        error: { code: "REASON_REQUIRED", message: "กรุณาระบุเหตุผลในการเข้าถึงข้อมูล อย่างน้อย 5 ตัวอักษร" },
      };
    }

    try {
      const { data, error } = await (this.supabase.rpc as any)("get_member_giving_history", {
        p_member_id: memberId,
        p_reason: trimmedReason,
      });

      if (error) throw error;
      return {
        ok: true,
        data: ((data || []) as any[]).map((row: any) => ({
          id: row.id,
          churchId: row.church_id,
          memberId: row.member_id,
          offeringSessionId: row.offering_session_id,
          amount: Money.from(row.amount),
          givingType: row.giving_type,
          paymentMethod: row.payment_method,
          givenAt: row.given_at,
          confidentialNote: row.confidential_note,
          createdBy: row.created_by,
          createdAt: row.created_at,
        })),
      };
    } catch (err: any) {
      return { ok: false, error: MembersService.mapDatabaseError(err) };
    }
  }
}
