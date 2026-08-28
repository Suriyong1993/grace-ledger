import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Database } from "../supabase/types";
import { Money } from "../money";
import { UserRole, assertPermission } from "../rbac";

export const CreateFundSchema = z.object({
  church_id: z.string().uuid("รหัสคริสตจักรต้องเป็น UUID"),
  name: z.string().trim().min(1, "ชื่อกองทุนต้องไม่เป็นค่าว่าง"),
  description: z.string().optional(),
  target_amount: z
    .union([z.string(), z.number()])
    .optional()
    .refine(
      (val) => {
        if (val === undefined || val === null) return true;
        try {
          const m = Money.from(val);
          return m.isPositive() || m.isZero();
        } catch {
          return false;
        }
      },
      { message: "เป้าหมายงบประมาณต้องไม่ติดลบ" }
    ),
});

export const UpdateFundSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  target_amount: z
    .union([z.string(), z.number()])
    .optional()
    .refine(
      (val) => {
        if (val === undefined || val === null) return true;
        try {
          const m = Money.from(val);
          return m.isPositive() || m.isZero();
        } catch {
          return false;
        }
      },
      { message: "เป้าหมายงบประมาณต้องไม่ติดลบ" }
    ),
  is_active: z.boolean().optional(),
});

export const TransferFundsSchema = z
  .object({
    church_id: z.string().uuid("รหัสคริสตจักรต้องเป็น UUID"),
    from_fund_id: z.string().uuid("รหัสกองทุนต้นทางต้องเป็น UUID"),
    to_fund_id: z.string().uuid("รหัสกองทุนปลายทางต้องเป็น UUID"),
    amount: z.union([z.string(), z.number()]).refine(
      (val) => {
        try {
          const m = Money.from(val);
          return m.isPositive() && !m.isZero();
        } catch {
          return false;
        }
      },
      { message: "จำนวนเงินที่โอนต้องมากกว่า 0.00 บาท" }
    ),
    notes: z.string().trim().min(5, "เหตุผลการโอนต้องมีความยาวอย่างน้อย 5 ตัวอักษร"),
    idempotency_key: z.string().optional(),
  })
  .refine((data) => data.from_fund_id !== data.to_fund_id, {
    message: "กองทุนต้นทางและกองทุนปลายทางต้องไม่เป็นกองทุนเดียวกัน",
    path: ["to_fund_id"],
  });

export type CreateFundInput = z.infer<typeof CreateFundSchema>;
export type UpdateFundInput = z.infer<typeof UpdateFundSchema>;
export type TransferFundsInput = z.infer<typeof TransferFundsSchema>;

export interface FundModel {
  id: string;
  church_id: string;
  name: string;
  description: string | null;
  current_balance: Money;
  target_amount: Money;
  is_active: boolean;
  created_at: string;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export class FundsService {
  constructor(
    private supabase: SupabaseClient<Database>,
    private currentRole?: UserRole
  ) {}

  private checkRole(action: "create" | "read" | "update" | "delete" | "approve") {
    if (this.currentRole) {
      assertPermission(this.currentRole, action, "funds");
    }
  }

  /**
   * Get all active funds for a church
   */
  public async getFunds(churchId: string): Promise<ServiceResult<FundModel[]>> {
    try {
      this.checkRole("read");
      const { data, error } = await (this.supabase
        .from("funds") as any)
        .select("id, church_id, name, description, current_balance, target_amount, is_active, created_at")
        .eq("church_id", churchId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      const funds: FundModel[] = ((data as any[]) || []).map((f: any) => ({
        id: f.id,
        church_id: f.church_id,
        name: f.name,
        description: f.description,
        current_balance: f.current_balance ? Money.from(f.current_balance) : Money.zero(),
        target_amount: f.target_amount ? Money.from(f.target_amount) : Money.zero(),
        is_active: f.is_active,
        created_at: f.created_at,
      }));

      return { success: true, data: funds };
    } catch (err: any) {
      return { success: false, error: err.message || "เกิดข้อผิดพลาดในการดึงข้อมูลกองทุน" };
    }
  }

  /**
   * Create a new fund
   */
  public async createFund(input: CreateFundInput): Promise<ServiceResult<{ fund_id: string }>> {
    try {
      this.checkRole("create");
      const parsed = CreateFundSchema.parse(input);

      const targetPlain = parsed.target_amount
        ? Money.from(parsed.target_amount).toFixed(2)
        : "0.00";

      const { data, error } = await (this.supabase
        .from("funds") as any)
        .insert({
          church_id: parsed.church_id,
          name: parsed.name,
          description: parsed.description || null,
          current_balance: "0.00",
          target_amount: targetPlain,
          is_active: true,
        })
        .select("id")
        .single();

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: { fund_id: data.id } };
    } catch (err: any) {
      return { success: false, error: err.message || "เกิดข้อผิดพลาดในการสร้างกองทุน" };
    }
  }

  /**
   * Update fund details
   */
  public async updateFund(
    fundId: string,
    input: UpdateFundInput
  ): Promise<ServiceResult<{ fund_id: string }>> {
    try {
      this.checkRole("update");
      const parsed = UpdateFundSchema.parse(input);

      const payload: Record<string, any> = {};
      if (parsed.name) payload.name = parsed.name;
      if (parsed.description !== undefined) payload.description = parsed.description;
      if (parsed.target_amount !== undefined) {
        payload.target_amount = Money.from(parsed.target_amount).toFixed(2);
      }
      if (parsed.is_active !== undefined) payload.is_active = parsed.is_active;

      const { error } = await (this.supabase
        .from("funds") as any)
        .update(payload)
        .eq("id", fundId);

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: { fund_id: fundId } };
    } catch (err: any) {
      return { success: false, error: err.message || "เกิดข้อผิดพลาดในการแก้ไขกองทุน" };
    }
  }

  /**
   * Atomic inter-fund transfer (Calls transfer_funds RPC with native single-transaction idempotency)
   */
  public async transferFunds(
    input: TransferFundsInput
  ): Promise<ServiceResult<{ transfer_id: string }>> {
    try {
      if (this.currentRole) {
        assertPermission(this.currentRole, "create", "fund_transfers");
      }
      const parsed = TransferFundsSchema.parse(input);
      const amountPlain = Money.from(parsed.amount).toFixed(2);

      const { data, error } = await (this.supabase.rpc as any)("transfer_funds", {
        p_church_id: parsed.church_id,
        p_from_fund_id: parsed.from_fund_id,
        p_to_fund_id: parsed.to_fund_id,
        p_amount: amountPlain,
        p_note: parsed.notes,
        p_idempotency_key: parsed.idempotency_key || null,
      });

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: { transfer_id: data as any } };
    } catch (err: any) {
      return { success: false, error: err.message || "เกิดข้อผิดพลาดในการโอนเงินระหว่างกองทุน" };
    }
  }
}
