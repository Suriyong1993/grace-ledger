import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../supabase/types";
import { Money } from "../money";
import {
  PendingApprovalItem,
  ApprovalDecisionInput,
  RevisionDecisionInput,
  TerminalRejectionInput,
  RejectionDecisionInput,
  ApprovalServiceResult,
  ProjectedFundBalanceResult,
  TransactionSplit,
} from "./types";
import { ProjectedBalanceEngine } from "./projected-balance-engine";

export class ApprovalsService {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * Fetches all pending approval transactions for a church, including splits, accounts, and creator info.
   */
  async getPendingApprovals(
    churchId: string,
    currentUserId?: string
  ): Promise<ApprovalServiceResult<PendingApprovalItem[]>> {
    try {
      const { data, error } = await this.supabase
        .from("transactions")
        .select(`
          id,
          church_id,
          account_id,
          amount,
          direction,
          status,
          description,
          reference_number,
          created_by,
          created_at,
          rejection_reason,
          metadata,
          accounts (
            name
          ),
          profiles:created_by (
            full_name
          ),
          transaction_splits (
            id,
            church_id,
            fund_id,
            category_id,
            amount,
            note,
            created_at,
            funds (
              name,
              current_balance
            )
          )
        `)
        .eq("church_id", churchId)
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false });

      if (error) {
        return {
          success: false,
          error: {
            code: error.code || "FETCH_ERROR",
            message: error.message,
          },
        };
      }

      const items: PendingApprovalItem[] = (data || []).map((row: any) => {
        const creatorName = row.profiles?.full_name || "ไม่ระบุชื่อ";
        const initials = creatorName
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .substring(0, 2)
          .toUpperCase();

        const splits: TransactionSplit[] = (row.transaction_splits || []).map(
          (sp: any) => ({
            id: sp.id,
            transactionId: row.id,
            churchId: sp.church_id,
            fundId: sp.fund_id,
            fundName: sp.funds?.name,
            categoryId: sp.category_id,
            amount: Money.from(sp.amount),
            note: sp.note,
            createdAt: sp.created_at,
          })
        );

        const hasReceipt = Boolean(
          row.metadata?.receipt_url ||
            row.metadata?.attachment_url ||
            row.metadata?.has_receipt
        );
        const receiptUrl =
          row.metadata?.receipt_url || row.metadata?.attachment_url || null;

        const isCreator = Boolean(currentUserId && row.created_by === currentUserId);

        return {
          id: row.id,
          churchId: row.church_id,
          accountId: row.account_id,
          accountName: row.accounts?.name || "บัญชีหลัก",
          amount: Money.from(row.amount),
          direction: row.direction,
          status: row.status,
          description: row.description,
          referenceNumber: row.reference_number,
          createdBy: row.created_by,
          creatorName,
          creatorInitials: initials || "GL",
          createdAt: row.created_at,
          hasReceipt,
          receiptUrl,
          splits,
          isCreator,
          rejectionReason: row.rejection_reason,
        };
      });

      return {
        success: true,
        data: items,
      };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: "UNEXPECTED_ERROR",
          message: err.message || "An unexpected error occurred",
        },
      };
    }
  }

  /**
   * Calculates the projected balances for all funds involved in a transaction.
   */
  async getProjectedBalancesForTransaction(
    churchId: string,
    transaction: {
      direction: any;
      amount: Money;
      splits: Array<{ fundId: string; amount: Money }>;
    }
  ): Promise<ApprovalServiceResult<ProjectedFundBalanceResult[]>> {
    try {
      // 1. Get all unique fund IDs from transaction splits
      const fundIds = Array.from(new Set(transaction.splits.map((s) => s.fundId)));
      if (fundIds.length === 0) {
        return { success: true, data: [] };
      }

      // 2. Fetch current balances for these funds
      const { data: fundsData, error: fundsError } = await this.supabase
        .from("funds")
        .select("id, name, current_balance")
        .in("id", fundIds);

      if (fundsError) {
        return {
          success: false,
          error: { code: fundsError.code, message: fundsError.message },
        };
      }

      // 3. Fetch all other approved (unposted) transactions for this church
      const { data: approvedData, error: approvedError } = await this.supabase
        .from("transactions")
        .select(`
          id,
          direction,
          amount,
          transaction_splits (
            fund_id,
            amount
          )
        `)
        .eq("church_id", churchId)
        .eq("status", "approved");

      if (approvedError) {
        return {
          success: false,
          error: { code: approvedError.code, message: approvedError.message },
        };
      }

      const approvedTransactions = (approvedData || []).map((row: any) => ({
        direction: row.direction,
        amount: Money.from(row.amount),
        splits: (row.transaction_splits || []).map((sp: any) => ({
          fundId: sp.fund_id,
          amount: Money.from(sp.amount),
        })),
      }));

      // 4. Calculate projected balance per fund using ProjectedBalanceEngine
      const results: ProjectedFundBalanceResult[] = (fundsData as any[] || []).map((fund: any) => {
        return ProjectedBalanceEngine.calculateProjectedFundBalance(
          {
            id: fund.id,
            name: fund.name,
            currentBalance: fund.current_balance,
          },
          transaction,
          approvedTransactions
        );
      });

      return {
        success: true,
        data: results,
      };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: "PROJECTION_ERROR",
          message: err.message || "Failed to calculate projected fund balance",
        },
      };
    }
  }

  /**
   * Executes atomic approval of a pending transaction.
   * Handles concurrency conflicts and Segregation of Duties violations gracefully.
   */
  async approveTransaction(
    input: ApprovalDecisionInput
  ): Promise<ApprovalServiceResult<{ transactionId: string }>> {
    try {
      const { data, error } = await (this.supabase.rpc as any)("approve_transaction", {
        p_transaction_id: input.transactionId,
        p_note: input.note || null,
      });

      if (error) {
        const isStale =
          error.message.includes("not pending approval") ||
          error.message.includes("Concurrency Conflict") ||
          error.code === "P0001";
        const isTwoPerson =
          error.message.includes("Creator cannot approve") ||
          error.message.includes("Segregation of Duties") ||
          error.code === "P0003";

        return {
          success: false,
          error: {
            code: error.code || "APPROVE_ERROR",
            message: error.message,
            isStaleState: isStale,
            isTwoPersonViolation: isTwoPerson,
          },
        };
      }

      return {
        success: true,
        data: { transactionId: data as string },
      };
    } catch (err: any) {
      const isStale =
        err.message?.includes("not pending approval") ||
        err.message?.includes("Concurrency Conflict");
      return {
        success: false,
        error: {
          code: "UNEXPECTED_ERROR",
          message: err.message,
          isStaleState: isStale,
        },
      };
    }
  }

  /**
   * Requests revision on a pending transaction (transitions pending_approval -> draft).
   * Allows the creator to edit and resubmit.
   */
  async requestRevision(
    input: RevisionDecisionInput
  ): Promise<ApprovalServiceResult<{ transactionId: string }>> {
    if (!input.revisionNote || input.revisionNote.trim().length < 5) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "กรุณาระบุรายละเอียดที่ต้องการให้แก้ไขอย่างน้อย 5 ตัวอักษร",
        },
      };
    }

    try {
      const { data, error } = await (this.supabase.rpc as any)("request_transaction_revision", {
        p_transaction_id: input.transactionId,
        p_revision_note: input.revisionNote.trim(),
      });

      if (error) {
        const isStale =
          error.message.includes("not pending approval") ||
          error.message.includes("Concurrency Conflict") ||
          error.code === "P0001";

        return {
          success: false,
          error: {
            code: error.code || "REVISION_ERROR",
            message: error.message,
            isStaleState: isStale,
          },
        };
      }

      return {
        success: true,
        data: { transactionId: data as string },
      };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: "UNEXPECTED_ERROR",
          message: err.message,
        },
      };
    }
  }

  /**
   * Permanently and terminally rejects a pending transaction (transitions pending_approval -> rejected).
   * Transaction becomes permanently locked.
   */
  async rejectTransactionTerminal(
    input: TerminalRejectionInput
  ): Promise<ApprovalServiceResult<{ transactionId: string }>> {
    if (!input.rejectionReason || input.rejectionReason.trim().length < 5) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "กรุณาระบุเหตุผลในการปฏิเสธอย่างน้อย 5 ตัวอักษร",
        },
      };
    }

    try {
      const { data, error } = await (this.supabase.rpc as any)("reject_transaction_terminal", {
        p_transaction_id: input.transactionId,
        p_rejection_reason: input.rejectionReason.trim(),
      });

      if (error) {
        const isStale =
          error.message.includes("not pending approval") ||
          error.message.includes("Concurrency Conflict") ||
          error.code === "P0001";

        return {
          success: false,
          error: {
            code: error.code || "REJECT_ERROR",
            message: error.message,
            isStaleState: isStale,
          },
        };
      }

      return {
        success: true,
        data: { transactionId: data as string },
      };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: "UNEXPECTED_ERROR",
          message: err.message,
        },
      };
    }
  }

  /**
   * Legacy wrapper forwarding to rejectTransactionTerminal.
   */
  async rejectTransaction(
    input: RejectionDecisionInput
  ): Promise<ApprovalServiceResult<{ transactionId: string }>> {
    if (input.rejectionType === "revision_requested") {
      return this.requestRevision({
        transactionId: input.transactionId,
        revisionNote: input.rejectionReason,
      });
    }
    return this.rejectTransactionTerminal({
      transactionId: input.transactionId,
      rejectionReason: input.rejectionReason,
    });
  }
}
