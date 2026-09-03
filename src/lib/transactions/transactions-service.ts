import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Database } from "../supabase/types";
import { Money } from "../money";
import { UserRole, assertPermission, can } from "../rbac";

export const TransactionSplitSchema = z.object({
  fund_id: z.string().uuid("รหัสกองทุนต้องเป็น UUID ที่ถูกต้อง"),
  amount: z.union([z.string(), z.number()]).refine(
    (val) => {
      try {
        const m = Money.from(val);
        return m.isPositive() && !m.isZero();
      } catch {
        return false;
      }
    },
    { message: "จำนวนเงินใน split ต้องมากกว่า 0.00 บาท" },
  ),
  notes: z.string().optional(),
});

export const CreateDraftTransactionSchema = z.object({
  church_id: z.string().uuid("รหัสคริสตจักรต้องเป็น UUID"),
  created_by: z.string().uuid("รหัสผู้สร้างรายการต้องเป็น UUID"),
  description: z.string().min(1, "กรุณาระบุรายละเอียดรายการ"),
  direction: z.enum(["income", "expense"], {
    errorMap: () => ({ message: "กรุณาระบุประเภทรายการ (รายรับ/รายจ่าย)" }),
  }),
  transaction_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD"),
  category_id: z.string().uuid("รหัสหมวดหมู่ต้องเป็น UUID"),
  account_id: z.string().uuid("รหัสบัญชีต้องเป็น UUID"),
  amount: z.union([z.string(), z.number()]).refine(
    (val) => {
      try {
        const m = Money.from(val);
        return m.isPositive() && !m.isZero();
      } catch {
        return false;
      }
    },
    { message: "ยอดรวมรายการต้องมากกว่า 0.00 บาท" },
  ),
  splits: z
    .array(TransactionSplitSchema)
    .min(1, "ต้องระบุสัดส่วนกองทุนอย่างน้อย 1 รายการ"),
});

export const UpdateDraftTransactionSchema = z.object({
  description: z.string().min(1).optional(),
  transaction_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  category_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
  amount: z
    .union([z.string(), z.number()])
    .refine((val) => {
      try {
        const m = Money.from(val);
        return m.isPositive() && !m.isZero();
      } catch {
        return false;
      }
    })
    .optional(),
  splits: z.array(TransactionSplitSchema).min(1).optional(),
});

export const ReasonSchema = z
  .string()
  .trim()
  .min(5, "เหตุผลต้องมีความยาวอย่างน้อย 5 ตัวอักษร");

export type CreateDraftTransactionInput = z.infer<
  typeof CreateDraftTransactionSchema
>;
export type UpdateDraftTransactionInput = z.infer<
  typeof UpdateDraftTransactionSchema
>;
export type TransactionSplitInput = z.infer<typeof TransactionSplitSchema>;

export interface TransactionFilterOptions {
  status?:
    | "draft"
    | "pending_approval"
    | "approved"
    | "posted"
    | "rejected"
    | "voided";
  startDate?: string;
  endDate?: string;
  fundId?: string;
  limit?: number;
  offset?: number;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export class TransactionsService {
  constructor(
    private supabase: SupabaseClient<Database>,
    private currentRole?: UserRole,
  ) {}

  /**
   * Helper to assert client-side role for UX fast-fail (Server RLS/RPC remains final boundary)
   */
  private checkRole(
    action: "create" | "read" | "update" | "delete" | "approve",
  ) {
    if (this.currentRole) {
      if (action === "approve") {
        if (
          !can(this.currentRole, "approve", "transactions") &&
          !can(this.currentRole, "approve", "approvals")
        ) {
          throw new Error(
            `Access Denied: Role "${this.currentRole}" is not authorized to approve transactions.`,
          );
        }
        return;
      }
      assertPermission(this.currentRole, action, "transactions");
    }
  }

  /**
   * Create a new transaction in 'draft' status with split validation
   */
  public async createDraftTransaction(
    input: CreateDraftTransactionInput,
  ): Promise<ServiceResult<{ transaction_id: string }>> {
    try {
      this.checkRole("create");
      const parsed = CreateDraftTransactionSchema.parse(input);

      // Verify split sum parity mathematically before insertion
      const totalAmount = Money.from(parsed.amount);
      let splitSum = Money.zero();
      for (const sp of parsed.splits) {
        splitSum = splitSum.add(Money.from(sp.amount));
      }

      if (!splitSum.equals(totalAmount)) {
        return {
          success: false,
          error: `ยอดรวม Split (${splitSum.format()}) ไม่ตรงกับยอดรวมรายการ (${totalAmount.format()})`,
          code: "SPLIT_SUM_MISMATCH",
        };
      }

      // Insert transaction header
      // NOTE: category_id lives on transaction_splits, not on transactions — the
      // header row has no category_id column in the deployed schema.
      const { data: txn, error: txnError } = await (
        this.supabase.from("transactions") as any
      )
        .insert({
          church_id: parsed.church_id,
          created_by: parsed.created_by,
          description: parsed.description,
          direction: parsed.direction,
          transaction_date: parsed.transaction_date,
          account_id: parsed.account_id,
          amount: totalAmount.toFixed(2),
          status: "draft",
        })
        .select("id")
        .single();

      if (txnError) {
        return { success: false, error: txnError.message, code: txnError.code };
      }

      // Insert transaction splits — category_id applied per split, matching the real schema
      const splitsToInsert = parsed.splits.map((s) => ({
        transaction_id: txn.id,
        church_id: parsed.church_id,
        fund_id: s.fund_id,
        category_id: parsed.category_id,
        amount: Money.from(s.amount).toFixed(2),
        note: s.notes || null,
      }));

      const { error: splitsError } = await (
        this.supabase.from("transaction_splits") as any
      ).insert(splitsToInsert);

      if (splitsError) {
        return {
          success: false,
          error: splitsError.message,
          code: splitsError.code,
        };
      }

      return { success: true, data: { transaction_id: txn.id } };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "เกิดข้อผิดพลาดในการสร้างรายการ Draft",
      };
    }
  }

  /**
   * Update an existing draft transaction
   */
  public async updateDraftTransaction(
    transactionId: string,
    input: UpdateDraftTransactionInput,
  ): Promise<ServiceResult<{ transaction_id: string }>> {
    try {
      this.checkRole("update");
      const parsed = UpdateDraftTransactionSchema.parse(input);

      // Verify transaction is currently draft
      const { data: existing, error: fetchError } = await (
        this.supabase.from("transactions") as any
      )
        .select("id, status, amount, church_id")
        .eq("id", transactionId)
        .single();

      if (fetchError || !existing) {
        return {
          success: false,
          error: "ไม่พบรายการธุรกรรม",
          code: "NOT_FOUND",
        };
      }

      if (existing.status !== "draft") {
        return {
          success: false,
          error: `ไม่อนุญาตให้แก้ไขรายการที่อยู่ในสถานะ ${existing.status}`,
          code: "IMMUTABLE_LEDGER_VIOLATION",
        };
      }

      // category_id lives on transaction_splits, not on transactions — handled below,
      // either by stamping it onto replacement splits or updating existing splits directly.
      const updatePayload: Record<string, any> = {};
      if (parsed.description) updatePayload.description = parsed.description;
      if (parsed.transaction_date)
        updatePayload.transaction_date = parsed.transaction_date;
      if (parsed.account_id) updatePayload.account_id = parsed.account_id;
      if (parsed.amount)
        updatePayload.amount = Money.from(parsed.amount).toFixed(2);

      if (Object.keys(updatePayload).length > 0) {
        const { error: updateError } = await (
          this.supabase.from("transactions") as any
        )
          .update(updatePayload)
          .eq("id", transactionId);

        if (updateError) {
          return {
            success: false,
            error: updateError.message,
            code: updateError.code,
          };
        }
      }

      // Replace splits if provided
      if (parsed.splits && parsed.splits.length > 0) {
        const targetAmount = parsed.amount
          ? Money.from(parsed.amount)
          : Money.from(existing.amount);
        let splitSum = Money.zero();
        for (const sp of parsed.splits) {
          splitSum = splitSum.add(Money.from(sp.amount));
        }

        if (!splitSum.equals(targetAmount)) {
          return {
            success: false,
            error: `ยอดรวม Split (${splitSum.format()}) ไม่ตรงกับยอดรวมรายการ (${targetAmount.format()})`,
            code: "SPLIT_SUM_MISMATCH",
          };
        }

        // Preserve the existing category when splits are replaced without an explicit change
        let categoryForSplits = parsed.category_id;
        if (!categoryForSplits) {
          const { data: currentSplit } = await (
            this.supabase.from("transaction_splits") as any
          )
            .select("category_id")
            .eq("transaction_id", transactionId)
            .limit(1)
            .maybeSingle();
          categoryForSplits = currentSplit?.category_id;
        }

        // Delete old splits
        await (this.supabase.from("transaction_splits") as any)
          .delete()
          .eq("transaction_id", transactionId);

        // Insert new splits
        const splitsToInsert = parsed.splits.map((s) => ({
          transaction_id: transactionId,
          church_id: existing.church_id,
          fund_id: s.fund_id,
          category_id: categoryForSplits || null,
          amount: Money.from(s.amount).toFixed(2),
          note: s.notes || null,
        }));

        const { error: insertSplitsError } = await (
          this.supabase.from("transaction_splits") as any
        ).insert(splitsToInsert);

        if (insertSplitsError) {
          return {
            success: false,
            error: insertSplitsError.message,
            code: insertSplitsError.code,
          };
        }
      } else if (parsed.category_id) {
        // Category changed but splits weren't replaced — update category on existing splits.
        const { error: categoryUpdateError } = await (
          this.supabase.from("transaction_splits") as any
        )
          .update({ category_id: parsed.category_id })
          .eq("transaction_id", transactionId);

        if (categoryUpdateError) {
          return {
            success: false,
            error: categoryUpdateError.message,
            code: categoryUpdateError.code,
          };
        }
      }

      return { success: true, data: { transaction_id: transactionId } };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "เกิดข้อผิดพลาดในการแก้ไขรายการ",
      };
    }
  }

  /**
   * Submit draft transaction for approval (Calls submit_transaction RPC)
   */
  public async submitTransaction(
    transactionId: string,
  ): Promise<ServiceResult<{ status: string }>> {
    try {
      this.checkRole("create");
      const { data, error } = await (this.supabase.rpc as any)(
        "submit_transaction",
        {
          p_transaction_id: transactionId,
        },
      );

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data as any };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "เกิดข้อผิดพลาดในการส่งขออนุมัติรายการ",
      };
    }
  }

  /**
   * Approve transaction (Calls approve_transaction RPC with Two-Person Rule)
   */
  public async approveTransaction(
    transactionId: string,
    notes?: string,
  ): Promise<ServiceResult<{ status: string }>> {
    try {
      this.checkRole("approve");
      const { data, error } = await (this.supabase.rpc as any)(
        "approve_transaction",
        {
          p_transaction_id: transactionId,
          p_note: notes || null,
        },
      );

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data as any };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "เกิดข้อผิดพลาดในการอนุมัติรายการ",
      };
    }
  }

  /**
   * Request transaction revision back to draft (Calls request_transaction_revision RPC)
   */
  public async requestRevision(
    transactionId: string,
    reason: string,
  ): Promise<ServiceResult<{ status: string }>> {
    try {
      this.checkRole("approve");
      const validReason = ReasonSchema.parse(reason);
      const { data, error } = await (this.supabase.rpc as any)(
        "request_transaction_revision",
        {
          p_transaction_id: transactionId,
          p_revision_note: validReason,
        },
      );

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data as any };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "เกิดข้อผิดพลาดในการส่งกลับแก้ไข",
      };
    }
  }

  /**
   * Permanently reject transaction (Calls reject_transaction_terminal RPC)
   */
  public async rejectTransactionTerminal(
    transactionId: string,
    reason: string,
  ): Promise<ServiceResult<{ status: string }>> {
    try {
      this.checkRole("approve");
      const validReason = ReasonSchema.parse(reason);
      const { data, error } = await (this.supabase.rpc as any)(
        "reject_transaction_terminal",
        {
          p_transaction_id: transactionId,
          p_rejection_reason: validReason,
        },
      );

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data as any };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "เกิดข้อผิดพลาดในการปฏิเสธรายการ",
      };
    }
  }

  /**
   * Post approved transaction to financial ledger (Calls post_transaction RPC)
   */
  public async postTransaction(
    transactionId: string,
  ): Promise<ServiceResult<{ status: string }>> {
    try {
      this.checkRole("update");
      const { data, error } = await (this.supabase.rpc as any)(
        "post_transaction",
        {
          p_transaction_id: transactionId,
        },
      );

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data as any };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "เกิดข้อผิดพลาดในการโพสต์รายการลงบัญชี",
      };
    }
  }

  /**
   * Void posted transaction and create reversing mirror entry (Calls void_transaction RPC)
   */
  public async voidTransaction(
    transactionId: string,
    reason: string,
  ): Promise<ServiceResult<{ status: string; reversal_id?: string }>> {
    try {
      this.checkRole("update");
      const validReason = ReasonSchema.parse(reason);
      const { data, error } = await (this.supabase.rpc as any)(
        "void_transaction",
        {
          p_transaction_id: transactionId,
          p_reason: validReason,
        },
      );

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data as any };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "เกิดข้อผิดพลาดในการยกเลิกรายการ (Void)",
      };
    }
  }

  /**
   * Query transactions with filters
   */
  public async getTransactions(
    churchId: string,
    filters?: TransactionFilterOptions,
  ): Promise<ServiceResult<any[]>> {
    try {
      this.checkRole("read");
      let query = (this.supabase.from("transactions") as any)
        .select(
          `
          id,
          church_id,
          description,
          transaction_date,
          status,
          amount,
          reversal_of_id,
          created_at,
          account_id,
          accounts(id, name),
          transaction_splits(id, fund_id, amount, note, category_id, categories(id, name), funds(id, name))
        `,
        )
        .eq("church_id", churchId)
        .order("transaction_date", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.startDate) {
        query = query.gte("transaction_date", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("transaction_date", filters.endDate);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data || [] };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "เกิดข้อผิดพลาดในการดึงรายการธุรกรรม",
      };
    }
  }

  /**
   * Get transaction audit trail
   */
  public async getTransactionAuditTrail(
    transactionId: string,
  ): Promise<ServiceResult<any[]>> {
    try {
      const { data, error } = await (this.supabase.from("audit_logs") as any)
        .select(
          "id, action, category, before_state, after_state, metadata, created_at, actor_id",
        )
        .eq("entity_id", transactionId)
        .order("created_at", { ascending: true });

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data || [] };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "เกิดข้อผิดพลาดในการดึง Audit Trail",
      };
    }
  }
}
