import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../supabase/types";
import { Money } from "../money";
import { UserRole, assertPermission } from "../rbac";

export interface CategorySummary {
  category_id: string;
  category_name: string;
  type: "income" | "expense";
  total_amount: Money;
  transaction_count: number;
}

export interface FundAllocationSummary {
  fund_id: string;
  fund_name: string;
  total_allocated: Money;
  split_count: number;
}

export interface StatementOfFinancialPosition {
  church_id: string;
  period_start: string;
  period_end: string;
  total_income: Money;
  total_expense: Money;
  net_surplus_deficit: Money;
  posted_transactions_count: number;
  categories_summary: CategorySummary[];
  funds_allocation: FundAllocationSummary[];
  generated_at: string;
}

export interface FundBalanceReportItem {
  fund_id: string;
  fund_name: string;
  current_balance: Money;
  target_budget: Money;
  budget_variance_percentage: number;
  is_active: boolean;
}

export interface ExecutiveSummary {
  church_id: string;
  total_ledger_balance: Money;
  total_funds_count: number;
  monthly_income: Money;
  monthly_expense: Money;
  net_monthly_cashflow: Money;
  posted_count_this_month: number;
  provenance: {
    data_source: "POSTGRESQL_POSTED_LEDGER";
    period: string;
    generated_at: string;
    excluded_states: string[];
  };
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export class ReportsService {
  constructor(
    private supabase: SupabaseClient<Database>,
    private currentRole?: UserRole
  ) {}

  private checkRole(action: "read" | "export") {
    if (this.currentRole) {
      assertPermission(this.currentRole, action, "reports");
    }
  }

  /**
   * Generates Statement of Financial Position aggregated strictly from POSTED ledger records
   */
  public async getStatementOfFinancialPosition(
    churchId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<ServiceResult<StatementOfFinancialPosition>> {
    try {
      this.checkRole("read");

      // Query posted transactions and their splits
      const { data, error } = await (this.supabase
        .from("transactions") as any)
        .select(`
          id,
          amount,
          direction,
          description,
          transaction_date,
          status,
          category_id,
          categories(id, name),
          transaction_splits(amount, fund_id, funds(id, name))
        `)
        .eq("church_id", churchId)
        .eq("status", "posted")
        .gte("transaction_date", periodStart)
        .lte("transaction_date", periodEnd);

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      const txns = data || [];
      let totalIncome = Money.zero();
      let totalExpense = Money.zero();
      const categoryMap = new Map<string, { name: string; type: "income" | "expense"; amount: Money; count: number }>();
      const fundMap = new Map<string, { name: string; amount: Money; count: number }>();

      for (const t of txns) {
        const txnAmount = Money.from(t.amount);
        const isExp = t.description?.includes("จ่าย") || t.description?.includes("ซื้อ") || t.description?.includes("ค่า");
        const dir: "income" | "expense" = t.direction || (isExp ? "expense" : "income");

        if (dir === "income") {
          totalIncome = totalIncome.add(txnAmount);
        } else {
          totalExpense = totalExpense.add(txnAmount);
        }

        // Category breakdown
        const catId = t.category_id || "uncategorized";
        const catName = t.categories?.name || "หมวดหมู่ทั่วไป";
        const existingCat = categoryMap.get(catId) || { name: catName, type: dir, amount: Money.zero(), count: 0 };
        existingCat.amount = existingCat.amount.add(txnAmount);
        existingCat.count++;
        categoryMap.set(catId, existingCat);

        // Fund splits breakdown
        if (t.transaction_splits && Array.isArray(t.transaction_splits)) {
          for (const sp of t.transaction_splits) {
            const splitAmt = Money.from(sp.amount);
            const fundId = sp.fund_id || "unknown";
            const fundName = sp.funds?.name || "กองทุนทั่วไป";
            const existingFund = fundMap.get(fundId) || { name: fundName, amount: Money.zero(), count: 0 };
            existingFund.amount = existingFund.amount.add(splitAmt);
            existingFund.count++;
            fundMap.set(fundId, existingFund);
          }
        }
      }

      const categoriesSummary: CategorySummary[] = Array.from(categoryMap.entries()).map(([id, cat]) => ({
        category_id: id,
        category_name: cat.name,
        type: cat.type,
        total_amount: cat.amount,
        transaction_count: cat.count,
      }));

      const fundsAllocation: FundAllocationSummary[] = Array.from(fundMap.entries()).map(([id, fund]) => ({
        fund_id: id,
        fund_name: fund.name,
        total_allocated: fund.amount,
        split_count: fund.count,
      }));

      return {
        success: true,
        data: {
          church_id: churchId,
          period_start: periodStart,
          period_end: periodEnd,
          total_income: totalIncome,
          total_expense: totalExpense,
          net_surplus_deficit: totalIncome.subtract(totalExpense),
          posted_transactions_count: txns.length,
          categories_summary: categoriesSummary,
          funds_allocation: fundsAllocation,
          generated_at: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message || "เกิดข้อผิดพลาดในการคำนวณรายงานงบการเงิน" };
    }
  }

  /**
   * Generates real-time Fund Balances Summary
   */
  public async getFundBalancesSummary(churchId: string): Promise<ServiceResult<FundBalanceReportItem[]>> {
    try {
      this.checkRole("read");
      const { data, error } = await (this.supabase
        .from("funds") as any)
        .select("id, name, current_balance, target_budget, is_active")
        .eq("church_id", churchId)
        .order("name", { ascending: true });

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      const items: FundBalanceReportItem[] = (data || []).map((f: any) => {
        const balance = f.current_balance ? Money.from(f.current_balance) : Money.zero();
        const target = f.target_budget ? Money.from(f.target_budget) : Money.zero();
        const variancePct = target.isPositive() && !target.isZero()
          ? Math.round((balance.toNumber() / target.toNumber()) * 100)
          : 0;

        return {
          fund_id: f.id,
          fund_name: f.name,
          current_balance: balance,
          target_budget: target,
          budget_variance_percentage: variancePct,
          is_active: f.is_active,
        };
      });

      return { success: true, data: items };
    } catch (err: any) {
      return { success: false, error: err.message || "เกิดข้อผิดพลาดในการดึงรายงานกองทุน" };
    }
  }

  /**
   * Generates Executive Financial Summary with strict Provenance metadata
   */
  public async getExecutiveFinancialSummary(
    churchId: string,
    currentMonthIso: string // Format: "YYYY-MM"
  ): Promise<ServiceResult<ExecutiveSummary>> {
    try {
      this.checkRole("read");
      // 1. Get total fund balances
      const fundsRes = await this.getFundBalancesSummary(churchId);
      if (!fundsRes.success || !fundsRes.data) {
        return { success: false, error: fundsRes.error || "ไม่สามารถดึงข้อมูลยอดคงเหลือกองทุนได้" };
      }

      let totalBalance = Money.zero();
      for (const f of fundsRes.data) {
        if (f.is_active) {
          totalBalance = totalBalance.add(f.current_balance);
        }
      }

      // 2. Get monthly posted statement
      const monthStart = `${currentMonthIso}-01`;
      const monthEnd = `${currentMonthIso}-31`;
      const stmtRes = await this.getStatementOfFinancialPosition(churchId, monthStart, monthEnd);
      if (!stmtRes.success || !stmtRes.data) {
        return { success: false, error: stmtRes.error || "ไม่สามารถดึงรายงานงบประจำเดือนได้" };
      }

      return {
        success: true,
        data: {
          church_id: churchId,
          total_ledger_balance: totalBalance,
          total_funds_count: fundsRes.data.length,
          monthly_income: stmtRes.data.total_income,
          monthly_expense: stmtRes.data.total_expense,
          net_monthly_cashflow: stmtRes.data.net_surplus_deficit,
          posted_count_this_month: stmtRes.data.posted_transactions_count,
          provenance: {
            data_source: "POSTGRESQL_POSTED_LEDGER",
            period: currentMonthIso,
            generated_at: new Date().toISOString(),
            excluded_states: ["draft", "pending_approval", "rejected", "voided"],
          },
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message || "เกิดข้อผิดพลาดในการดึงรายงานสรุปผู้บริหาร" };
    }
  }

  /**
   * Fetches full historical financial context (Jan-Jul 2569) without modifying live ledger
   */
  public async getHistoricalContext(
    churchId: string,
    fiscalYear: number = 2569
  ): Promise<ServiceResult<{
    monthly: Array<{
      month: number;
      month_name: string;
      status: string;
      data_through: string | null;
      income_total: Money;
      cash_income: Money;
      online_income: Money;
      expense_total: Money;
      net: Money;
      opening_balance_reported: Money | null;
      closing_balance_reported: Money | null;
      data_quality_flag: string;
      data_quality_notes: string | null;
    }>;
    grand_totals: {
      income: Money;
      expense: Money;
      net: Money;
      cash_income: Money;
      online_income: Money;
      data_through: string;
      has_review_flag: boolean;
    };
  }>> {
    try {
      this.checkRole("read");
      const { data, error } = await (this.supabase
        .from("historical_monthly_summaries") as any)
        .select("*")
        .eq("church_id", churchId)
        .eq("fiscal_year", fiscalYear)
        .order("month", { ascending: true });

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      let grandIncome = Money.zero();
      let grandExpense = Money.zero();
      let grandNet = Money.zero();
      let grandCash = Money.zero();
      let grandOnline = Money.zero();
      let hasReview = false;
      let latestDate = "2026-07-19";

      const monthly = (data || []).map((row: any) => {
        const inc = Money.from(row.income_total);
        const exp = Money.from(row.expense_total);
        const net = Money.from(row.net);
        const cash = Money.from(row.cash_income);
        const online = Money.from(row.online_income);

        grandIncome = grandIncome.add(inc);
        grandExpense = grandExpense.add(exp);
        grandNet = grandNet.add(net);
        grandCash = grandCash.add(cash);
        grandOnline = grandOnline.add(online);

        if (row.data_quality_flag === "DATA_REVIEW_REQUIRED") {
          hasReview = true;
        }
        if (row.data_through && row.data_through > latestDate) {
          latestDate = row.data_through;
        }

        return {
          month: row.month,
          month_name: row.month_name,
          status: row.status,
          data_through: row.data_through,
          income_total: inc,
          cash_income: cash,
          online_income: online,
          expense_total: exp,
          net,
          opening_balance_reported: row.opening_balance_reported ? Money.from(row.opening_balance_reported) : null,
          closing_balance_reported: row.closing_balance_reported ? Money.from(row.closing_balance_reported) : null,
          data_quality_flag: row.data_quality_flag,
          data_quality_notes: row.data_quality_notes,
        };
      });

      return {
        success: true,
        data: {
          monthly,
          grand_totals: {
            income: grandIncome,
            expense: grandExpense,
            net: grandNet,
            cash_income: grandCash,
            online_income: grandOnline,
            data_through: latestDate,
            has_review_flag: hasReview,
          },
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message || "เกิดข้อผิดพลาดในการดึงข้อมูลประวัติการเงินย้อนหลัง" };
    }
  }
}

