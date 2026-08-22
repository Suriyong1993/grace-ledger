import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../supabase/types";
import { Money } from "../money";
import { Fund, FundTransferInput, FundServiceError, FundServiceResult } from "./types";

/**
 * Service Layer for Funds.
 * Reads go through RLS-scoped SELECT (has_church_access enforces tenant isolation).
 * Mutations always go through transfer_funds — no client-side balance writes.
 */
export class FundsService {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  public static mapDatabaseError(err: any): FundServiceError {
    const rawMessage = err?.message || String(err || "");

    if (rawMessage.includes("Unauthorized")) {
      return { code: "UNAUTHORIZED", message: "คุณไม่มีสิทธิ์โอนเงินระหว่างกองทุน", details: rawMessage };
    }
    if (rawMessage.includes("Source fund and destination fund must be different")) {
      return { code: "SAME_FUND", message: "กองทุนต้นทางและปลายทางต้องไม่ใช่กองทุนเดียวกัน", details: rawMessage };
    }
    if (rawMessage.includes("Transfer amount must be strictly greater than zero")) {
      return { code: "INVALID_AMOUNT", message: "จำนวนเงินโอนต้องมากกว่าศูนย์", details: rawMessage };
    }
    if (rawMessage.includes("does not exist or does not belong to church")) {
      return { code: "FUND_NOT_FOUND", message: "ไม่พบกองทุนที่ระบุในโบสถ์นี้", details: rawMessage };
    }
    if (rawMessage.includes("Insufficient Funds")) {
      return { code: "INSUFFICIENT_FUNDS", message: "ยอดเงินคงเหลือในกองทุนต้นทางไม่เพียงพอ", details: rawMessage };
    }
    return { code: "UNKNOWN_ERROR", message: "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง", details: rawMessage };
  }

  private mapRow(row: Database["public"]["Tables"]["funds"]["Row"]): Fund {
    return {
      id: row.id,
      churchId: row.church_id,
      name: row.name,
      description: row.description,
      targetAmount: row.target_amount !== null ? Money.from(row.target_amount) : null,
      currentBalance: Money.from(row.current_balance),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public async listFunds(churchId: string): Promise<FundServiceResult<Fund[]>> {
    try {
      const { data, error } = await this.supabase
        .from("funds")
        .select("*")
        .eq("church_id", churchId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return { ok: true, data: (data || []).map((row) => this.mapRow(row)) };
    } catch (err: any) {
      return { ok: false, error: FundsService.mapDatabaseError(err) };
    }
  }

  public async getFund(fundId: string): Promise<FundServiceResult<Fund>> {
    try {
      const { data, error } = await this.supabase
        .from("funds")
        .select("*")
        .eq("id", fundId)
        .single();

      if (error) throw error;
      if (!data) {
        return { ok: false, error: { code: "FUND_NOT_FOUND", message: "ไม่พบกองทุนที่ระบุ" } };
      }
      return { ok: true, data: this.mapRow(data) };
    } catch (err: any) {
      return { ok: false, error: FundsService.mapDatabaseError(err) };
    }
  }

  /**
   * Transfers between funds. Server-side transfer_funds RPC owns authorization,
   * row locking, balance validation, and the immutable audit entry — this method
   * only shapes input/output.
   */
  public async transferFunds(input: FundTransferInput): Promise<FundServiceResult<string>> {
    try {
      const amount = Money.from(input.amount);
      if (!amount.isPositive()) {
        return {
          ok: false,
          error: { code: "INVALID_AMOUNT", message: "จำนวนเงินโอนต้องมากกว่าศูนย์" },
        };
      }

      const { data, error } = await (this.supabase.rpc as any)("transfer_funds", {
        p_church_id: input.churchId,
        p_from_fund_id: input.fromFundId,
        p_to_fund_id: input.toFundId,
        p_amount: amount.toFixed(2),
        p_note: input.note ?? null,
      });

      if (error) throw error;
      return { ok: true, data: data as string };
    } catch (err: any) {
      return { ok: false, error: FundsService.mapDatabaseError(err) };
    }
  }
}
