import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../supabase/types";
import { Money } from "../money";

export interface HistoricalMonthlySummary {
  id: string;
  churchId: string;
  fiscalYear: number;
  month: number;
  monthName: string;
  status: "historical" | "historical_partial";
  dataThrough: string | null;
  incomeTotal: Money;
  cashIncome: Money;
  onlineIncome: Money;
  expenseTotal: Money;
  net: Money;
  openingBalanceReported: Money | null;
  closingBalanceReported: Money | null;
  dataQualityFlag: "VERIFIED" | "DATA_REVIEW_REQUIRED" | "ESTIMATED";
  dataQualityNotes: string | null;
  source: string;
  sourceDocument: string;
  importedAt: string;
  importBatchId: string;
  isImmutable: boolean;
}

export interface HistoricalWeeklySummary {
  id: string;
  churchId: string;
  fiscalYear: number;
  month: number;
  weekDate: string;
  incomeTotal: Money;
  cashIncome: Money;
  onlineIncome: Money;
  expenseTotal: Money;
  net: Money;
  source: string;
  sourceDocument: string;
  importedAt: string;
  importBatchId: string;
  isImmutable: boolean;
}

export interface HistoricalGrandTotals {
  fiscalYear: number;
  incomeTotal: Money;
  cashIncome: Money;
  onlineIncome: Money;
  expenseTotal: Money;
  net: Money;
  monthlyRecordsCount: number;
  weeklyRecordsCount: number;
  hasDataReviewRequired: boolean;
  dataThrough: string;
}

export const LIVE_CUTOVER_DATE = "2026-08-01";

export class HistoricalService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Helper to determine whether a given ISO date or YYYY-MM period falls into the historical window (< 2026-08-01)
   */
  public static isHistoricalPeriod(periodOrDate: string): boolean {
    if (!periodOrDate) return false;
    // Normalize format (e.g., "2026-07" -> "2026-07-01", "2026-07-15" -> "2026-07-15")
    const dateStr = periodOrDate.length === 7 ? `${periodOrDate}-01` : periodOrDate;
    return dateStr < LIVE_CUTOVER_DATE;
  }

  /**
   * Fetch all historical monthly summaries for a given church and fiscal year (sorted chronologically 1..12)
   */
  public async getMonthlySummaries(
    churchId: string,
    fiscalYear: number = 2569
  ): Promise<{ success: boolean; data?: HistoricalMonthlySummary[]; error?: string }> {
    try {
      const { data, error } = await (this.supabase
        .from("historical_monthly_summaries") as any)
        .select("*")
        .eq("church_id", churchId)
        .eq("fiscal_year", fiscalYear)
        .order("month", { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      const mapped: HistoricalMonthlySummary[] = (data || []).map((row: any) => ({
        id: row.id,
        churchId: row.church_id,
        fiscalYear: row.fiscal_year,
        month: row.month,
        monthName: row.month_name,
        status: row.status,
        dataThrough: row.data_through,
        incomeTotal: Money.from(row.income_total),
        cashIncome: Money.from(row.cash_income),
        onlineIncome: Money.from(row.online_income),
        expenseTotal: Money.from(row.expense_total),
        net: Money.from(row.net),
        openingBalanceReported: row.opening_balance_reported != null ? Money.from(row.opening_balance_reported) : null,
        closingBalanceReported: row.closing_balance_reported != null ? Money.from(row.closing_balance_reported) : null,
        dataQualityFlag: row.data_quality_flag,
        dataQualityNotes: row.data_quality_notes,
        source: row.source,
        sourceDocument: row.source_document,
        importedAt: row.imported_at,
        importBatchId: row.import_batch_id,
        isImmutable: row.is_immutable,
      }));

      return { success: true, data: mapped };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to fetch historical monthly summaries" };
    }
  }

  /**
   * Fetch a single historical monthly summary by month number
   */
  public async getMonthlySummaryByMonth(
    churchId: string,
    month: number,
    fiscalYear: number = 2569
  ): Promise<{ success: boolean; data?: HistoricalMonthlySummary | null; error?: string }> {
    try {
      const { data, error } = await (this.supabase
        .from("historical_monthly_summaries") as any)
        .select("*")
        .eq("church_id", churchId)
        .eq("fiscal_year", fiscalYear)
        .eq("month", month)
        .maybeSingle();

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: true, data: null };
      }

      const mapped: HistoricalMonthlySummary = {
        id: data.id,
        churchId: data.church_id,
        fiscalYear: data.fiscal_year,
        month: data.month,
        monthName: data.month_name,
        status: data.status,
        dataThrough: data.data_through,
        incomeTotal: Money.from(data.income_total),
        cashIncome: Money.from(data.cash_income),
        onlineIncome: Money.from(data.online_income),
        expenseTotal: Money.from(data.expense_total),
        net: Money.from(data.net),
        openingBalanceReported: data.opening_balance_reported != null ? Money.from(data.opening_balance_reported) : null,
        closingBalanceReported: data.closing_balance_reported != null ? Money.from(data.closing_balance_reported) : null,
        dataQualityFlag: data.data_quality_flag,
        dataQualityNotes: data.data_quality_notes,
        source: data.source,
        sourceDocument: data.source_document,
        importedAt: data.imported_at,
        importBatchId: data.import_batch_id,
        isImmutable: data.is_immutable,
      };

      return { success: true, data: mapped };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to fetch historical monthly summary" };
    }
  }

  /**
   * Fetch weekly breakdown summaries (optionally filtered by month)
   */
  public async getWeeklySummaries(
    churchId: string,
    fiscalYear: number = 2569,
    month?: number
  ): Promise<{ success: boolean; data?: HistoricalWeeklySummary[]; error?: string }> {
    try {
      let query = (this.supabase
        .from("historical_weekly_summaries") as any)
        .select("*")
        .eq("church_id", churchId)
        .eq("fiscal_year", fiscalYear);

      if (month !== undefined) {
        query = query.eq("month", month);
      }

      const { data, error } = await query.order("week_date", { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      const mapped: HistoricalWeeklySummary[] = (data || []).map((row: any) => ({
        id: row.id,
        churchId: row.church_id,
        fiscalYear: row.fiscal_year,
        month: row.month,
        weekDate: row.week_date,
        incomeTotal: Money.from(row.income_total),
        cashIncome: Money.from(row.cash_income),
        onlineIncome: Money.from(row.online_income),
        expenseTotal: Money.from(row.expense_total),
        net: Money.from(row.net),
        source: row.source,
        sourceDocument: row.source_document,
        importedAt: row.imported_at,
        importBatchId: row.import_batch_id,
        isImmutable: row.is_immutable,
      }));

      return { success: true, data: mapped };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to fetch historical weekly summaries" };
    }
  }

  /**
   * Aggregate Grand Totals across Jan-Jul 2569
   */
  public async getGrandTotals(
    churchId: string,
    fiscalYear: number = 2569
  ): Promise<{ success: boolean; data?: HistoricalGrandTotals; error?: string }> {
    const monthlyRes = await this.getMonthlySummaries(churchId, fiscalYear);
    if (!monthlyRes.success || !monthlyRes.data) {
      return { success: false, error: monthlyRes.error };
    }

    const weeklyRes = await this.getWeeklySummaries(churchId, fiscalYear);
    const weeklyCount = weeklyRes.success && weeklyRes.data ? weeklyRes.data.length : 0;

    let incomeTotal = Money.zero();
    let cashIncome = Money.zero();
    let onlineIncome = Money.zero();
    let expenseTotal = Money.zero();
    let netTotal = Money.zero();
    let hasDataReviewRequired = false;
    let latestDataThrough = "2026-07-19";

    for (const m of monthlyRes.data) {
      incomeTotal = incomeTotal.add(m.incomeTotal);
      cashIncome = cashIncome.add(m.cashIncome);
      onlineIncome = onlineIncome.add(m.onlineIncome);
      expenseTotal = expenseTotal.add(m.expenseTotal);
      netTotal = netTotal.add(m.net);
      if (m.dataQualityFlag === "DATA_REVIEW_REQUIRED") {
        hasDataReviewRequired = true;
      }
      if (m.dataThrough && m.dataThrough > latestDataThrough) {
        latestDataThrough = m.dataThrough;
      }
    }

    return {
      success: true,
      data: {
        fiscalYear,
        incomeTotal,
        cashIncome,
        onlineIncome,
        expenseTotal,
        net: netTotal,
        monthlyRecordsCount: monthlyRes.data.length,
        weeklyRecordsCount: weeklyCount,
        hasDataReviewRequired,
        dataThrough: latestDataThrough,
      },
    };
  }
}
