import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../supabase/types";
import { SecureAiToolExecutor } from "./secure-tool-executor";
import { Money } from "../money";

/**
 * =====================================================================
 * GRACE AI READ SERVICE & DATA PROVENANCE ENGINE
 * =====================================================================
 * Invariants:
 * 1. AI interacts exclusively through SecureAiToolExecutor (NO Direct DB bypass).
 * 2. Every financial fact is accompanied by strict Data Provenance metadata.
 * 3. NO hallucinated numbers: missing ledger data returns non-committal disclaimer.
 * 4. Clear separation between "Facts", "Analysis", and "AI Interpretation".
 * 5. Multi-layer privacy enforcement for Sensitive Giving records.
 * 6. Trusted Session Context strictly overrides any tenant ID in prompts.
 * =====================================================================
 */

export interface DataProvenance {
  period: string;
  source_tool: string;
  source_type:
    | "POSTGRESQL_POSTED_LEDGER"
    | "POSTGRESQL_CONFIDENTIAL_RPC"
    | "POSTGRESQL_BUDGET_LEDGER"
    | "POSTGRESQL_AUDIT_LEDGER";
  transaction_status: string;
  included_count?: number;
  excluded_states: readonly string[];
  generated_at: string;
  church_id: string;
}

export interface GraceAiFinancialResponse<T = any> {
  success: boolean;
  facts: T | null;
  analysis: string | null;
  interpretation: string | null;
  provenance: DataProvenance | null;
  message?: string;
  denial_reason?: string;
  code?: string;
}

export class GraceAiReadService {
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
   * 1. Get Monthly Financial Summary with Provenance & Fact/Interpretation Separation
   */
  public async getMonthlyFinancialSummary(
    period: string,
    promptChurchId?: string
  ): Promise<GraceAiFinancialResponse<{
    total_income: string;
    total_expense: string;
    net_cashflow: string;
    total_funds_balance: string;
  }>> {
    // SECURITY: Trusted server church context STRICTLY wins over any prompt/client value
    // If promptChurchId is passed, it is intentionally disregarded in favor of this.trustedChurchId
    const targetChurchId = (promptChurchId && promptChurchId === this.trustedChurchId)
      ? promptChurchId
      : this.trustedChurchId;

    const result = await this.executor.executeTool({
      toolName: "get_financial_summary",
      parameters: { period, church_id: targetChurchId },
      context: { churchId: targetChurchId },
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        facts: null,
        analysis: null,
        interpretation: null,
        provenance: null,
        message: "ไม่สามารถยืนยันข้อมูลจาก Financial Ledger ได้",
        denial_reason: result.denial_reason || result.error,
        code: result.code,
      };
    }

    const { total_income, total_expense, net_cashflow, total_funds_balance } = result.data;
    const incomeM = Money.from(total_income);
    const expenseM = Money.from(total_expense);
    const netM = Money.from(net_cashflow);

    // Objective Fact Extraction
    const facts = {
      total_income: incomeM.format(),
      total_expense: expenseM.format(),
      net_cashflow: netM.format(),
      total_funds_balance: Money.from(total_funds_balance).format(),
    };

    // Analytical Computation (Exact Math)
    const isSurplus = netM.isPositive() && !netM.isZero();
    const analysis = `ยอดรายรับประจำเดือน ${facts.total_income} และรายจ่าย ${facts.total_expense} ส่งผลให้กระแสเงินสดสุทธิ${
      isSurplus ? "เกินดุล" : "ติดลบ"
    } ${facts.net_cashflow} ยอดคงเหลือรวมทุกกองทุนอยู่ที่ ${facts.total_funds_balance}`;

    // AI Interpretation (Explicitly segregated as an observation, not fact)
    const interpretation = isSurplus
      ? `ข้อสังเกตเชิงการเงิน: คริสตจักรมีสภาพคล่องเกินดุล ${facts.net_cashflow} เหมาะสำหรับการสำรองเงินเข้ากองทุนพันธกิจระยะยาว`
      : `ข้อสังเกตเชิงการเงิน: คริสตจักรมีรายจ่ายสูงกว่ารายรับ ${facts.net_cashflow} ควรพิจารณาควบคุมค่าใช้จ่ายผันแปรในหมวดทั่วไป`;

    const provenance: DataProvenance = {
      period,
      source_tool: "get_financial_summary",
      source_type: "POSTGRESQL_POSTED_LEDGER",
      transaction_status: "posted",
      excluded_states: Object.freeze(["draft", "pending_approval", "rejected", "voided"]),
      generated_at: new Date().toISOString(),
      church_id: targetChurchId,
    };

    return {
      success: true,
      facts,
      analysis,
      interpretation,
      provenance,
    };
  }

  /**
   * 2. Query Transactions Report with Provenance
   */
  public async getTransactionsReport(filters: {
    status?: "draft" | "pending_approval" | "approved" | "posted" | "rejected" | "voided";
    start_date?: string;
    end_date?: string;
    limit?: number;
  }): Promise<GraceAiFinancialResponse<{ transactions: any[]; total_count: number }>> {
    const result = await this.executor.executeTool({
      toolName: "get_transactions",
      parameters: { ...filters, church_id: this.trustedChurchId },
      context: { churchId: this.trustedChurchId },
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        facts: null,
        analysis: null,
        interpretation: null,
        provenance: null,
        message: "ไม่สามารถยืนยันข้อมูลจาก Financial Ledger ได้",
        denial_reason: result.denial_reason || result.error,
        code: result.code,
      };
    }

    const { transactions, total_count } = result.data;

    return {
      success: true,
      facts: { transactions, total_count },
      analysis: `พบรายการธุรกรรมที่ตรงตามเงื่อนไขจำนวน ${total_count} รายการ`,
      interpretation: total_count === 0 ? "ข้อสังเกต: ไม่พบรายการธุรกรรมในช่วงเวลาที่ระบุ" : null,
      provenance: {
        period: `${filters.start_date || "ต้นปี"} ถึง ${filters.end_date || "ปัจจุบัน"}`,
        source_tool: "get_transactions",
        source_type: "POSTGRESQL_POSTED_LEDGER",
        transaction_status: filters.status || "all_filtered_states",
        included_count: total_count,
        excluded_states: filters.status === "posted" ? ["draft", "pending_approval", "rejected", "voided"] : [],
        generated_at: new Date().toISOString(),
        church_id: this.trustedChurchId,
      },
    };
  }

  /**
   * 3. Get Fund Balances with Provenance
   */
  public async getFundBalances(fundId?: string): Promise<GraceAiFinancialResponse<{ funds: any[] }>> {
    const result = await this.executor.executeTool({
      toolName: "get_fund_balance",
      parameters: { fund_id: fundId, church_id: this.trustedChurchId },
      context: { churchId: this.trustedChurchId },
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        facts: null,
        analysis: null,
        interpretation: null,
        provenance: null,
        message: "ไม่สามารถยืนยันข้อมูลจาก Financial Ledger ได้",
        denial_reason: result.denial_reason || result.error,
        code: result.code,
      };
    }

    const { funds } = result.data;

    return {
      success: true,
      facts: { funds },
      analysis: `ดึงข้อมูลยอดคงเหลือของกองทุนจำนวน ${funds.length} กองทุน`,
      interpretation: null,
      provenance: {
        period: "ปัจจุบัน",
        source_tool: "get_fund_balance",
        source_type: "POSTGRESQL_POSTED_LEDGER",
        transaction_status: "posted",
        included_count: funds.length,
        excluded_states: ["draft", "pending_approval", "rejected", "voided"],
        generated_at: new Date().toISOString(),
        church_id: this.trustedChurchId,
      },
    };
  }

  /**
   * 4. Get Budget vs Actual Analysis with Provenance
   */
  public async getBudgetComparison(year: number): Promise<GraceAiFinancialResponse<{ year: number; items: any[] }>> {
    const result = await this.executor.executeTool({
      toolName: "get_budget_vs_actual",
      parameters: { year, church_id: this.trustedChurchId },
      context: { churchId: this.trustedChurchId },
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        facts: null,
        analysis: null,
        interpretation: null,
        provenance: null,
        message: "ไม่สามารถยืนยันข้อมูลจาก Financial Ledger ได้",
        denial_reason: result.denial_reason || result.error,
        code: result.code,
      };
    }

    return {
      success: true,
      facts: result.data,
      analysis: `เปรียบเทียบงบประมาณประจำปี ${year} จำนวน ${result.data.items.length} หมวดหมู่`,
      interpretation: null,
      provenance: {
        period: `ปี ${year}`,
        source_tool: "get_budget_vs_actual",
        source_type: "POSTGRESQL_BUDGET_LEDGER",
        transaction_status: "posted_vs_budget",
        included_count: result.data.items.length,
        excluded_states: ["draft", "unapproved_budgets"],
        generated_at: new Date().toISOString(),
        church_id: this.trustedChurchId,
      },
    };
  }

  /**
   * 5. Get Transaction Audit Trail with Provenance
   */
  public async getTransactionAuditTrail(
    transactionId: string
  ): Promise<GraceAiFinancialResponse<{ transaction_id: string; logs: any[] }>> {
    const result = await this.executor.executeTool({
      toolName: "get_transaction_audit_trail",
      parameters: { transaction_id: transactionId, church_id: this.trustedChurchId },
      context: { churchId: this.trustedChurchId },
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        facts: null,
        analysis: null,
        interpretation: null,
        provenance: null,
        message: "ไม่สามารถยืนยันข้อมูลจาก Financial Ledger ได้",
        denial_reason: result.denial_reason || result.error,
        code: result.code,
      };
    }

    return {
      success: true,
      facts: result.data,
      analysis: `พบประวัติการทำธุรกรรม (Audit Trail) จำนวน ${result.data.logs.length} เหตุการณ์`,
      interpretation: null,
      provenance: {
        period: "ประวัติตั้งแต่สร้างรายการ",
        source_tool: "get_transaction_audit_trail",
        source_type: "POSTGRESQL_AUDIT_LEDGER",
        transaction_status: "immutable_audit_log",
        included_count: result.data.logs.length,
        excluded_states: [],
        generated_at: new Date().toISOString(),
        church_id: this.trustedChurchId,
      },
    };
  }

  /**
   * 6. Get Sensitive Member Giving History (Multi-layer Security Guard)
   */
  public async getConfidentialMemberGiving(
    memberId: string,
    reason: string,
    taxYear?: number
  ): Promise<GraceAiFinancialResponse<{
    member_id: string;
    member_name: string;
    records: any[];
    total_giving: string;
  }>> {
    const result = await this.executor.executeTool({
      toolName: "get_member_giving_history",
      parameters: {
        member_id: memberId,
        reason,
        tax_year: taxYear,
        church_id: this.trustedChurchId,
      },
      context: { churchId: this.trustedChurchId },
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        facts: null,
        analysis: null,
        interpretation: null,
        provenance: null,
        message: "ไม่สามารถเข้าถึงข้อมูลความลับทางการเงินได้",
        denial_reason: result.denial_reason || result.error,
        code: result.code,
      };
    }

    const { member_name, total_giving, records } = result.data;

    return {
      success: true,
      facts: {
        member_id: memberId,
        member_name,
        records,
        total_giving: Money.from(total_giving).format(),
      },
      analysis: `สมาชิก: ${member_name} มียอดการถวายสะสมรวม ${Money.from(total_giving).format()} (${records.length} รายการ)`,
      interpretation: null,
      provenance: {
        period: taxYear ? `ปีภาษี ${taxYear}` : "ประวัติทั้งหมด",
        source_tool: "get_member_giving_history",
        source_type: "POSTGRESQL_CONFIDENTIAL_RPC",
        transaction_status: "posted_giving_records",
        included_count: records.length,
        excluded_states: ["unverified_tithes"],
        generated_at: new Date().toISOString(),
        church_id: this.trustedChurchId,
      },
    };
  }
}
