import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../supabase/types";
import { SecureAiToolExecutor } from "./secure-tool-executor";
import { Money } from "../money";

/**
 * =====================================================================
 * GRACE AI DRAFT SERVICE
 * =====================================================================
 * Invariants:
 * 1. AI can only generate uncommitted DRAFT records (status = 'draft').
 * 2. ZERO financial ledger impact: Drafts do NOT alter posted balances, accounts, or reports.
 * 3. Enforces Split Parity: SUM(splits) MUST equal total transaction amount.
 * 4. Dispatches strictly through SecureAiToolExecutor (NO Direct DB bypass).
 * 5. Prompt injection strings in descriptions/notes are treated strictly as data.
 * =====================================================================
 */

export interface CreateDraftTransactionInput {
  description: string;
  transaction_date: string;
  category_id: string;
  account_id: string;
  amount: string | number;
  splits: Array<{
    fund_id: string;
    amount: string | number;
    notes?: string;
  }>;
}

export interface CreateDraftTransferInput {
  from_fund_id: string;
  to_fund_id: string;
  amount: string | number;
  notes: string;
}

export interface GraceAiDraftResponse<T = any> {
  success: boolean;
  data: T | null;
  message: string;
  financial_impact: "ZERO_UNCOMMITTED_DRAFT" | "NONE";
  denial_reason?: string;
  code?: string;
}

export class GraceAiDraftService {
  private executor: SecureAiToolExecutor;

  /**
   * @param supabase Authenticated Supabase client
   * @param trustedChurchId Church ID derived strictly from trusted server session
   */
  constructor(
    supabase: SupabaseClient<Database>,
    private trustedChurchId: string
  ) {
    this.executor = new SecureAiToolExecutor(supabase);
  }

  /**
   * 1. Create Draft Transaction (Uncommitted, split parity checked)
   */
  public async createDraftTransaction(
    input: CreateDraftTransactionInput
  ): Promise<GraceAiDraftResponse<{
    draft_transaction_id: string;
    status: "draft";
    description: string;
    amount: string;
  }>> {
    // 1. Validate Split Parity mathematically prior to dispatch
    const totalAmount = Money.from(input.amount);
    let splitSum = Money.zero();
    for (const s of input.splits) {
      splitSum = splitSum.add(Money.from(s.amount));
    }

    if (!splitSum.equals(totalAmount)) {
      return {
        success: false,
        data: null,
        message: `ยอดรวม Split (${splitSum.format()}) ไม่ตรงกับยอดรวมรายการ (${totalAmount.format()})`,
        financial_impact: "NONE",
        code: "SPLIT_SUM_MISMATCH",
        denial_reason: "Split parity mismatch: SUM(splits) != total amount",
      };
    }

    // 2. Dispatch through SecureAiToolExecutor
    const result = await this.executor.executeTool({
      toolName: "create_draft_transaction",
      parameters: {
        ...input,
        church_id: this.trustedChurchId,
      },
      context: { churchId: this.trustedChurchId },
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        data: null,
        message: result.error || "ไม่สามารถสร้างแบบร่างรายการได้",
        financial_impact: "NONE",
        denial_reason: result.denial_reason || result.error,
        code: result.code,
      };
    }

    return {
      success: true,
      data: {
        draft_transaction_id: result.data.draft_transaction_id,
        status: "draft",
        description: input.description,
        amount: totalAmount.format(),
      },
      message: "สร้างแบบร่างรายการสำเร็จ (นี่เป็นเพียงร่างรายการ ยังไม่มีการบันทึกหรือหักยอดเงินในบัญชี)",
      financial_impact: "ZERO_UNCOMMITTED_DRAFT",
    };
  }

  /**
   * 2. Create Draft Transfer (Uncommitted transfer proposal)
   */
  public async createDraftTransfer(
    input: CreateDraftTransferInput
  ): Promise<GraceAiDraftResponse<{
    draft_summary: string;
    from_fund_id: string;
    to_fund_id: string;
    amount: string;
  }>> {
    // Validate same fund transfer early
    if (input.from_fund_id === input.to_fund_id) {
      return {
        success: false,
        data: null,
        message: "กองทุนต้นทางและปลายทางต้องไม่เป็นกองทุนเดียวกัน",
        financial_impact: "NONE",
        code: "SAME_FUND_TRANSFER_PROHIBITED",
        denial_reason: "Source and destination funds must be distinct",
      };
    }

    const result = await this.executor.executeTool({
      toolName: "create_transfer_draft",
      parameters: {
        ...input,
        church_id: this.trustedChurchId,
      },
      context: { churchId: this.trustedChurchId },
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        data: null,
        message: result.error || "ไม่สามารถจัดเตรียมร่างการโอนเงินได้",
        financial_impact: "NONE",
        denial_reason: result.denial_reason || result.error,
        code: result.code,
      };
    }

    return {
      success: true,
      data: {
        draft_summary: result.data.draft_summary,
        from_fund_id: result.data.from_fund_id,
        to_fund_id: result.data.to_fund_id,
        amount: Money.from(result.data.amount).format(),
      },
      message: "จัดเตรียมร่างข้อเสนอการโอนเงินสำเร็จ (นี่เป็นเพียงร่างข้อเสนอ ยังไม่มีการโอนเงินจริง)",
      financial_impact: "ZERO_UNCOMMITTED_DRAFT",
    };
  }
}
