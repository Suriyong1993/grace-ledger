/**
 * Grace Ledger v2 — Income Domain Service
 *
 * Encapsulates all income business rules:
 * - Self-approval prevention
 * - Already-approved detection
 * - Cannot-delete-approved enforcement
 * - Storage cleanup on delete
 * - Journal entry creation on approval
 * - Audit logging for every mutation
 *
 * Route handlers become thin wrappers calling this service.
 * Business rules exist in ONE place, not duplicated across routes.
 */

import { getAdminClient } from "@/server/infrastructure/supabase";
import { JournalService } from "@/server/domain/journal";
import { Money } from "@/server/domain/money";
import { AuditService } from "./audit.service";
import { AttachmentService } from "./attachment.service";
import { ApiError } from "@/server/api/middleware";
import type { Session } from "@/server/auth/session";

export class IncomeService {
  /** List all incomes for a church */
  static async list(churchId: string) {
    const admin = getAdminClient();
    const { data, error } = await (admin.from("incomes") as any)
      .select("*")
      .eq("church_id", churchId)
      .order("date", { ascending: false })
      .limit(500);

    if (error) throw new ApiError(500, "DB_ERROR", error.message);
    return data ?? [];
  }

  /** Get a single income record */
  static async getById(churchId: string, incomeId: string) {
    const admin = getAdminClient();
    const { data, error } = await (admin.from("incomes") as any)
      .select("*")
      .eq("id", incomeId)
      .eq("church_id", churchId)
      .single();

    if (error || !data) return null;
    return data;
  }

  /** Create a new income record */
  static async create(
    input: Record<string, unknown>,
    session: Session,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const admin = getAdminClient();
    const { data, error } = await (admin.from("incomes") as any)
      .insert({
        church_id: session.churchId,
        date: input.date,
        category_id: input.categoryId,
        amount: input.amount,
        fund_id: input.fundId,
        description: (input.description as string) ?? "",
        attachment_name: input.attachmentName ?? null,
        attachment_data_url: input.attachmentDataUrl ?? null,
        attachment_storage_path: input.attachmentStoragePath ?? null,
        attachment_type: input.attachmentType ?? null,
        attachment_size: input.attachmentSize ?? null,
        created_by: session.userId,
        status: (input.status as string) ?? "pending",
      })
      .select()
      .single();

    if (error) throw new ApiError(500, "DB_ERROR", error.message);

    await AuditService.logCreate(
      session.churchId,
      "income",
      (data as any).id,
      session.userId,
      session.name,
      {
        amount: input.amount,
        date: input.date,
        description: input.description,
      } as Record<string, unknown>,
      ipAddress,
      userAgent,
    );

    return data;
  }

  /**
   * Approve an income record.
   * Business rules enforced:
   * - Cannot self-approve
   * - Cannot approve already-approved record
   * - Creates journal entry for double-entry accounting
   */
  static async approve(incomeId: string, session: Session, ipAddress?: string, userAgent?: string) {
    const admin = getAdminClient();

    const { data: income, error: fetchError } = await (admin.from("incomes") as any)
      .select("*")
      .eq("id", incomeId)
      .eq("church_id", session.churchId)
      .single();

    if (fetchError || !income) {
      throw new ApiError(404, "NOT_FOUND", "Income record not found");
    }

    // ── Business rules ───────────────────────────────────────────
    // Rule 1: Self-approval prevention
    if ((income as any).created_by === session.userId) {
      throw new ApiError(400, "SELF_APPROVAL", "Cannot approve your own income record");
    }

    // Rule 2: Already-approved detection
    if ((income as any).status === "approved") {
      throw new ApiError(400, "ALREADY_APPROVED", "Income is already approved");
    }

    const i = income as any;

    // Create journal entry for double-entry accounting
    const journalEntry = await JournalService.createEntry(
      {
        entryType: "income",
        postingDate: new Date(i.date),
        description: i.description ?? "Income approval",
        fundId: i.fund_id,
        fiscalYear: new Date(i.date).getFullYear(),
        fiscalPeriod: new Date(i.date).getMonth() + 1,
        lines: [
          {
            accountId: i.fund_id,
            lineType: "debit" as const,
            amount: Money.fromBaht(String(i.amount)),
            fundId: i.fund_id,
          },
          {
            accountId: i.category_id,
            lineType: "credit" as const,
            amount: Money.fromBaht(String(i.amount)),
            fundId: i.fund_id,
          },
        ],
      },
      session.churchId,
      session.userId,
    );

    // Auto-submit and approve with dual approval tracking
    await JournalService.submitForApproval(journalEntry.id, session.userId, session.churchId);
    await JournalService.approveEntry(
      journalEntry.id,
      session.userId,
      session.role,
      session.churchId,
    );

    // Update income record status
    const { data: updated, error: updateError } = await (admin.from("incomes") as any)
      .update({
        status: "approved",
        approved_by: session.userId,
        journal_entry_id: journalEntry.id,
      })
      .eq("id", incomeId)
      .eq("church_id", session.churchId)
      .select()
      .single();

    if (updateError) throw new ApiError(500, "DB_ERROR", updateError.message);

    await AuditService.logApproval(
      session.churchId,
      "income",
      incomeId,
      session.userId,
      session.name,
      { status: i.status } as Record<string, unknown>,
      { status: "approved", journalEntryId: journalEntry.id } as Record<string, unknown>,
      ipAddress,
      userAgent,
    );

    return updated;
  }

  /**
   * Reject an income record.
   * Rejection reason must be at least 10 characters (matching JournalService standard).
   */
  static async reject(
    incomeId: string,
    reason: string,
    session: Session,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (!reason || reason.length < 10) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Rejection reason must be at least 10 characters",
      );
    }

    const admin = getAdminClient();

    const { data, error } = await (admin.from("incomes") as any)
      .update({ status: "rejected", rejection_reason: reason })
      .eq("id", incomeId)
      .eq("church_id", session.churchId)
      .select()
      .single();

    if (error || !data) {
      throw new ApiError(404, "NOT_FOUND", "Income record not found");
    }

    await AuditService.logUpdate(
      session.churchId,
      "income",
      incomeId,
      session.userId,
      session.name,
      { status: "pending" } as Record<string, unknown>,
      { status: "rejected", reason } as Record<string, unknown>,
      ipAddress,
      userAgent,
    );

    return data;
  }

  /**
   * Delete an income record.
   * Business rules enforced:
   * - Cannot delete approved income
   * - Clean up storage file if present
   */
  static async delete(incomeId: string, session: Session, ipAddress?: string, userAgent?: string) {
    const admin = getAdminClient();

    const { data: income } = await (admin.from("incomes") as any)
      .select("attachment_storage_path, status")
      .eq("id", incomeId)
      .eq("church_id", session.churchId)
      .single();

    if (!income) {
      throw new ApiError(404, "NOT_FOUND", "Income record not found");
    }

    // Rule 3: Cannot delete approved
    if ((income as any).status === "approved") {
      throw new ApiError(400, "CANNOT_DELETE_APPROVED", "Cannot delete approved income");
    }

    const { error } = await (admin.from("incomes") as any)
      .delete()
      .eq("id", incomeId)
      .eq("church_id", session.churchId);

    if (error) throw new ApiError(500, "DB_ERROR", error.message);

    // Clean up storage file
    const path = (income as any).attachment_storage_path;
    if (path) {
      await AttachmentService.deleteAttachment(path);
    }

    await AuditService.logDelete(
      session.churchId,
      "income",
      incomeId,
      session.userId,
      session.name,
      { id: incomeId } as Record<string, unknown>,
      ipAddress,
      userAgent,
    );

    return { success: true };
  }
}
