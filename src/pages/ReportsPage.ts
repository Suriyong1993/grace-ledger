import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../lib/supabase/types";
import { Money } from "../lib/money";
import { ReportsService, StatementOfFinancialPosition } from "../lib/reports/reports-service";
import {
  HistoricalService,
  HistoricalMonthlySummary,
  HistoricalWeeklySummary,
  HistoricalGrandTotals,
} from "../lib/reports/historical-service";
import { formatDateThai } from "../lib/format";

const ICON_NO_DATA = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 19h16M7 15v-4M12 15V7M17 15v-7"/><path d="M4 4l16 16" stroke-width="1.2" opacity="0.5"/></svg>`;
const ICON_NO_ARCHIVE = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><path d="M10 13h4"/></svg>`;

interface ChurchLeadership {
  pastor?: string;
  auditor?: string;
  cashCounters: string[];
}

export class ReportsPage {
  private selectedPeriod = "2026-08";
  private reportsService: ReportsService;
  private historicalService: HistoricalService;
  
  // State for Live report
  private statement: StatementOfFinancialPosition | null = null;
  
  // State for Historical monthly report
  private historicalMonthly: HistoricalMonthlySummary | null = null;
  private historicalWeekly: HistoricalWeeklySummary[] = [];
  
  // State for Full Year / Grand Totals
  private historicalGrandTotals: HistoricalGrandTotals | null = null;
  private historicalAllMonths: HistoricalMonthlySummary[] = [];

  private isLoading = true;
  private errorMessage: string | null = null;
  private leadership: ChurchLeadership | null = null;

  constructor(
    public readonly supabase: SupabaseClient<Database>,
    public readonly churchId: string
  ) {
    this.reportsService = new ReportsService(supabase);
    this.historicalService = new HistoricalService(supabase);
  }

  public getSelectedPeriod(): string {
    return this.selectedPeriod;
  }

  public async loadData(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    this.statement = null;
    this.historicalMonthly = null;
    this.historicalWeekly = [];
    this.historicalGrandTotals = null;
    this.historicalAllMonths = [];

    await this.loadLeadership();

    try {
      if (this.selectedPeriod === "2026-year") {
        // Load Grand Totals & all historical months + live August
        const [histMonthsRes, histGrandRes, liveStmtRes] = await Promise.all([
          this.historicalService.getMonthlySummaries(this.churchId, 2569),
          this.historicalService.getGrandTotals(this.churchId, 2569),
          this.reportsService.getStatementOfFinancialPosition(this.churchId, "2026-08-01", "2026-08-31"),
        ]);

        if (histMonthsRes.success && histMonthsRes.data) {
          this.historicalAllMonths = histMonthsRes.data;
        }
        if (histGrandRes.success && histGrandRes.data) {
          this.historicalGrandTotals = histGrandRes.data;
        }
        if (liveStmtRes.success && liveStmtRes.data) {
          this.statement = liveStmtRes.data;
        }
      } else if (HistoricalService.isHistoricalPeriod(this.selectedPeriod)) {
        // Historical month (2026-01 to 2026-07)
        const monthNum = parseInt(this.selectedPeriod.split("-")[1], 10);
        const [monthRes, weeklyRes] = await Promise.all([
          this.historicalService.getMonthlySummaryByMonth(this.churchId, monthNum, 2569),
          this.historicalService.getWeeklySummaries(this.churchId, 2569, monthNum),
        ]);

        if (!monthRes.success) {
          this.errorMessage = monthRes.error || "ไม่สามารถโหลดข้อมูลย้อนหลังได้";
        } else {
          this.historicalMonthly = monthRes.data || null;
          this.historicalWeekly = weeklyRes.data || [];
        }
      } else {
        // Live Accounting month (2026-08+)
        const periodStart = `${this.selectedPeriod}-01`;
        const periodEnd = `${this.selectedPeriod}-31`;

        const res = await this.reportsService.getStatementOfFinancialPosition(
          this.churchId,
          periodStart,
          periodEnd
        );

        if (!res.success || !res.data) {
          this.errorMessage = res.error || "ไม่สามารถโหลดข้อมูลรายงานการเงินได้";
        } else {
          this.statement = res.data;
        }
      }
    } catch (err: any) {
      this.errorMessage = err.message || "เกิดข้อผิดพลาดในการโหลดรายงานการเงิน";
    } finally {
      this.isLoading = false;
    }
  }

  private async loadLeadership(): Promise<void> {
    try {
      const { data } = await (this.supabase
        .from("churches") as any)
        .select("settings")
        .eq("id", this.churchId)
        .single();

      const raw = data?.settings?.leadership;
      if (!raw) {
        this.leadership = null;
        return;
      }

      this.leadership = {
        pastor: typeof raw.pastor === "string" ? raw.pastor : undefined,
        auditor: typeof raw.auditor === "string" ? raw.auditor : undefined,
        cashCounters: Array.isArray(raw.cash_counters) ? raw.cash_counters.filter((v: unknown) => typeof v === "string") : [],
      };
    } catch {
      // Leadership info is supplementary — never let it block the financial report.
      this.leadership = null;
    }
  }

  public renderHtml(): string {
    if (this.isLoading) {
      return `
      <div class="gl-page gl-fade-in">
        <div class="gl-page-header">
          <h1>รายงานการเงิน</h1>
          <p>กำลังประมวลผลข้อมูลทางบัญชี...</p>
        </div>
        <div class="gl-card gl-skeleton" style="height: 300px; display: flex; align-items: center; justify-content: center;">
          <span style="color: var(--muted-foreground);">กำลังโหลดข้อมูลรายงาน...</span>
        </div>
      </div>
      `;
    }

    if (this.errorMessage) {
      return `
      <div class="gl-page gl-fade-in">
        <div class="gl-page-header">
          <h1>รายงานการเงิน</h1>
          <p>งบการเงินประจำเดือน รายรับ-รายจ่าย และรายงานสถานะกองทุน</p>
        </div>
        <div class="gl-notice gl-notice--error" style="margin-bottom: var(--space-4);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>เกิดข้อผิดพลาดในการโหลดรายงาน:</strong> ${this.errorMessage}
            </div>
            <button id="retry-reports-btn" class="gl-btn gl-btn--sm gl-btn--secondary">ลองใหม่อีกครั้ง</button>
          </div>
        </div>
      </div>
      `;
    }

    const isYearView = this.selectedPeriod === "2026-year";
    const isHistorical = HistoricalService.isHistoricalPeriod(this.selectedPeriod);

    return `
    <div class="gl-page gl-fade-in">
      <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: var(--space-4); flex-wrap: wrap; gap: var(--space-3);">
        <div class="gl-page-header" style="margin-bottom: 0;">
          <div style="display: flex; align-items: center; gap: var(--space-2);">
            <h1>รายงานการเงิน</h1>
            ${
              isHistorical
                ? `<span class="gl-badge gl-badge--pending" style="font-size: var(--text-2xs);">ข้อมูลย้อนหลัง</span>`
                : isYearView
                ? `<span class="gl-badge gl-badge--approved" style="font-size: var(--text-2xs);">ประจำปี 2569</span>`
                : `<span class="gl-badge gl-badge--approved" style="font-size: var(--text-2xs);">ระบบบัญชีจริง</span>`
            }
          </div>
          <p style="margin-top: 4px;">งบการเงินประจำเดือน รายรับ-รายจ่าย และข้อมูลเปรียบเทียบย้อนหลัง</p>
        </div>
        <button id="print-report-btn" class="gl-btn gl-btn--secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
          <span>พิมพ์รายงาน</span>
        </button>
      </div>

      <!-- Month Selector Tabs -->
      <section class="gl-section" style="margin-bottom: var(--space-4);">
        <div class="gl-tablist" style="overflow-x: auto; white-space: nowrap; padding-bottom: 4px;">
          <button class="gl-tab ${this.selectedPeriod === "2026-08" ? "is-active" : ""}" data-period="2026-08">ส.ค. 2569 (Live)</button>
          <button class="gl-tab ${this.selectedPeriod === "2026-07" ? "is-active" : ""}" data-period="2026-07">ก.ค. 2569 (ย้อนหลัง)</button>
          <button class="gl-tab ${this.selectedPeriod === "2026-06" ? "is-active" : ""}" data-period="2026-06">มิ.ย. 2569</button>
          <button class="gl-tab ${this.selectedPeriod === "2026-05" ? "is-active" : ""}" data-period="2026-05">พ.ค. 2569</button>
          <button class="gl-tab ${this.selectedPeriod === "2026-04" ? "is-active" : ""}" data-period="2026-04">เม.ย. 2569</button>
          <button class="gl-tab ${this.selectedPeriod === "2026-03" ? "is-active" : ""}" data-period="2026-03">มี.ค. 2569 (ตรวจทาน)</button>
          <button class="gl-tab ${this.selectedPeriod === "2026-02" ? "is-active" : ""}" data-period="2026-02">ก.พ. 2569</button>
          <button class="gl-tab ${this.selectedPeriod === "2026-01" ? "is-active" : ""}" data-period="2026-01">ม.ค. 2569</button>
          <button class="gl-tab ${this.selectedPeriod === "2026-year" ? "is-active" : ""}" data-period="2026-year">ภาพรวมทั้งปี 2569</button>
        </div>
      </section>

      ${isYearView ? this.renderYearView() : isHistorical ? this.renderHistoricalMonthView() : this.renderLiveMonthView()}

      ${this.renderLeadershipBlock()}
    </div>
    `;
  }

  /**
   * Governance / signing parties for the printed financial report — pastor,
   * cash counters, auditor. Read-only display of churches.settings.leadership;
   * these are personnel records, not application users.
   */
  private renderLeadershipBlock(): string {
    const l = this.leadership;
    if (!l || (!l.pastor && !l.auditor && l.cashCounters.length === 0)) return "";

    const rows: string[] = [];
    if (l.pastor) {
      rows.push(`
        <div style="display: flex; justify-content: space-between; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--border);">
          <span style="color: var(--muted-foreground);">ศิษยาภิบาล</span>
          <span style="font-weight: var(--weight-semibold); text-align: right;">${l.pastor}</span>
        </div>`);
    }
    if (l.cashCounters.length > 0) {
      rows.push(`
        <div style="display: flex; justify-content: space-between; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--border);">
          <span style="color: var(--muted-foreground);">ผู้นับเงิน</span>
          <span style="font-weight: var(--weight-semibold); text-align: right;">${l.cashCounters.join(", ")}</span>
        </div>`);
    }
    if (l.auditor) {
      rows.push(`
        <div style="display: flex; justify-content: space-between; gap: var(--space-3); padding: var(--space-2) 0;">
          <span style="color: var(--muted-foreground);">ผู้ตรวจสอบบัญชี</span>
          <span style="font-weight: var(--weight-semibold); text-align: right;">${l.auditor}</span>
        </div>`);
    }

    return `
      <section class="gl-section" style="margin-top: var(--space-6);">
        <div class="gl-section__head">
          <h2>ผู้รับผิดชอบและผู้ตรวจสอบ</h2>
        </div>
        <div class="gl-card" style="padding: var(--space-4);">
          ${rows.join("")}
        </div>
      </section>`;
  }

  /**
   * Render Live Accounting Month (e.g. 2026-08)
   */
  private renderLiveMonthView(): string {
    const statement = this.statement;
    const totalIncome = statement ? statement.total_income : Money.zero();
    const totalExpense = statement ? statement.total_expense : Money.zero();
    const netSurplus = statement ? statement.net_surplus_deficit : Money.zero();

    const incomeCategories = statement?.categories_summary.filter((c) => c.type === "income") || [];
    const expenseCategories = statement?.categories_summary.filter((c) => c.type === "expense") || [];
    const hasData = (statement?.posted_transactions_count || 0) > 0;

    return `
      <section class="gl-section" style="margin-bottom: var(--space-5);">
        <div class="gl-statgrid">
          <div class="gl-stat gl-stat--success">
            <div class="gl-stat__label">รายรับรวมทั้งหมด</div>
            <div class="gl-stat__value num-display">+${totalIncome.format()}</div>
          </div>
          <div class="gl-stat gl-stat--danger">
            <div class="gl-stat__label">รายจ่ายรวมทั้งหมด</div>
            <div class="gl-stat__value num-display">−${totalExpense.format()}</div>
          </div>
          <div class="gl-stat ${netSurplus.isPositive() ? "gl-stat--success" : "gl-stat--danger"}">
            <div class="gl-stat__label">รายรับสุทธิ</div>
            <div class="gl-stat__value num-display">${netSurplus.format()}</div>
          </div>
        </div>
      </section>

      ${
        !hasData
          ? `
      <div class="gl-card gl-empty-state" style="text-align: center; padding: var(--space-8) var(--space-4);">
        <div style="color: var(--muted-foreground); margin-bottom: var(--space-3);">${ICON_NO_DATA}</div>
        <h3>ไม่มีข้อมูลธุรกรรมที่ลงบัญชีแล้วในงวดนี้</h3>
        <p style="color: var(--muted-foreground); max-width: 420px; margin: 0 auto var(--space-4);">
          รายงานการเงินจะประมวลผลเฉพาะรายการที่ผ่านการอนุมัติและลงบัญชี (Posted) ในช่วงเวลาที่เลือกเท่านั้น
        </p>
      </div>`
          : `
      <section class="gl-section">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: var(--space-4);">
          <div class="gl-card" style="padding: 0; overflow: hidden;">
            <div style="padding: var(--space-3) var(--space-4); background: var(--income-muted); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-weight: var(--weight-bold); font-size: var(--text-sm); color: var(--on-income-muted);">หมวดรายรับ</span>
              <span class="num-display" style="font-weight: var(--weight-bold); color: var(--income);">+${totalIncome.format()}</span>
            </div>
            <table class="gl-table">
              <tbody>
                ${
                  incomeCategories.length === 0
                    ? `<tr><td colspan="2" style="text-align: center; color: var(--muted-foreground);">ไม่มีรายการรายรับ</td></tr>`
                    : incomeCategories
                        .map((item) => {
                          const pct = totalIncome.isPositive()
                            ? Math.min(100, Math.round((item.total_amount.toSatang() / totalIncome.toSatang()) * 100))
                            : 0;
                          return `
                    <tr>
                      <td style="width: 65%;">
                        <div style="font-weight: var(--weight-medium);">${item.category_name} (${item.transaction_count} รายการ)</div>
                        <div style="display: flex; align-items: center; gap: var(--space-2); margin-top: 4px;">
                          <div style="flex: 1; height: var(--space-1); background: var(--border); border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: ${pct}%; background: var(--income); border-radius: 3px;"></div>
                          </div>
                          <span style="font-size: var(--text-2xs); color: var(--muted-foreground); width: 32px; text-align: right;">${pct}%</span>
                        </div>
                      </td>
                      <td class="is-right num-display" style="font-weight: var(--weight-semibold); color: var(--income); vertical-align: top;">+${item.total_amount.format()}</td>
                    </tr>`;
                        })
                        .join("")
                }
              </tbody>
            </table>
          </div>

          <div class="gl-card" style="padding: 0; overflow: hidden;">
            <div style="padding: var(--space-3) var(--space-4); background: var(--expense-muted); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-weight: var(--weight-bold); font-size: var(--text-sm); color: var(--on-expense-muted);">หมวดรายจ่าย</span>
              <span class="num-display" style="font-weight: var(--weight-bold); color: var(--expense);">−${totalExpense.format()}</span>
            </div>
            <table class="gl-table">
              <tbody>
                ${
                  expenseCategories.length === 0
                    ? `<tr><td colspan="2" style="text-align: center; color: var(--muted-foreground);">ไม่มีรายการรายจ่าย</td></tr>`
                    : expenseCategories
                        .map((item) => {
                          const pct = totalExpense.isPositive()
                            ? Math.min(100, Math.round((item.total_amount.toSatang() / totalExpense.toSatang()) * 100))
                            : 0;
                          return `
                    <tr>
                      <td style="width: 65%;">
                        <div style="font-weight: var(--weight-medium);">${item.category_name} (${item.transaction_count} รายการ)</div>
                        <div style="display: flex; align-items: center; gap: var(--space-2); margin-top: 4px;">
                          <div style="flex: 1; height: var(--space-1); background: var(--border); border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: ${pct}%; background: var(--expense); border-radius: 3px;"></div>
                          </div>
                          <span style="font-size: var(--text-2xs); color: var(--muted-foreground); width: 32px; text-align: right;">${pct}%</span>
                        </div>
                      </td>
                      <td class="is-right num-display" style="font-weight: var(--weight-semibold); color: var(--expense); vertical-align: top;">−${item.total_amount.format()}</td>
                    </tr>`;
                        })
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      </section>`
      }
    `;
  }

  /**
   * Render Historical Month (2026-01 to 2026-07)
   */
  private renderHistoricalMonthView(): string {
    const m = this.historicalMonthly;
    if (!m) {
      return `
      <div class="gl-card gl-empty-state" style="text-align: center; padding: var(--space-8) var(--space-4);">
        <div style="color: var(--muted-foreground); margin-bottom: var(--space-3);">${ICON_NO_ARCHIVE}</div>
        <h3>ไม่พบข้อมูลย้อนหลังสำหรับงวดนี้</h3>
        <p style="color: var(--muted-foreground); max-width: 420px; margin: 0 auto var(--space-4);">
          ไม่พบข้อมูลสรุปการเงินย้อนหลังในฐานข้อมูล
        </p>
      </div>`;
    }

    const isPartial = m.status === "historical_partial";
    const isDataReview = m.dataQualityFlag === "DATA_REVIEW_REQUIRED";

    return `
      <!-- Historical Notice Banner -->
      <div class="gl-notice gl-notice--info" style="margin-bottom: var(--space-4);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-2);">
          <div>
            <strong>ข้อมูลย้อนหลัง · ${m.monthName} 2569:</strong> 
            ${isPartial ? `ข้อมูลถึง ${formatDateThai(m.dataThrough || "2026-07-19")} (ไม่เต็มเดือน)` : "ข้อมูลนำเข้าสำหรับดูสถิติย้อนหลัง ไม่กระทบบัญชีจริง"}
          </div>
          <span class="gl-badge gl-badge--pending" style="font-size: var(--text-2xs);">ที่มา: ${m.sourceDocument}</span>
        </div>
      </div>

      ${
        isDataReview
          ? `
      <div class="gl-notice gl-notice--warning" style="margin-bottom: var(--space-4);">
        <div>
          <strong>ต้องตรวจทานยอด:</strong> ${m.dataQualityNotes || "ยอดเปิด/ปิดบัญชีเดือน มี.ค. 2569 ไม่ตรงกับยอดสะสมของเดือน ก.พ. กรุณาตรวจสอบก่อนใช้อ้างอิง"}
        </div>
      </div>`
          : ""
      }

      <!-- Stat Cards -->
      <section class="gl-section" style="margin-bottom: var(--space-5);">
        <div class="gl-statgrid">
          <div class="gl-stat gl-stat--success">
            <div class="gl-stat__label">รายรับรวม (${m.monthName})</div>
            <div class="gl-stat__value num-display">+${m.incomeTotal.format()}</div>
            <div style="font-size: var(--text-2xs); color: var(--muted-foreground); margin-top: 4px;">
              เงินสด: ${m.cashIncome.format()} · โอน: ${m.onlineIncome.format()}
            </div>
          </div>
          <div class="gl-stat gl-stat--danger">
            <div class="gl-stat__label">รายจ่ายรวม (${m.monthName})</div>
            <div class="gl-stat__value num-display">−${m.expenseTotal.format()}</div>
            <div style="font-size: var(--text-2xs); color: var(--muted-foreground); margin-top: 4px;">
              ยอดรายจ่ายตามสรุปรายงาน
            </div>
          </div>
          <div class="gl-stat ${m.net.isPositive() ? "gl-stat--success" : "gl-stat--danger"}">
            <div class="gl-stat__label">ผลสุทธิจากข้อมูลย้อนหลัง</div>
            <div class="gl-stat__value num-display">${m.net.format()}</div>
            <div style="font-size: var(--text-2xs); color: var(--muted-foreground); margin-top: 4px;">
              ${m.closingBalanceReported ? `ยกยอดปิดตามรายงาน: ${m.closingBalanceReported.format()}` : "บันทึกตามรายงาน (ไม่ใช่เงินในธนาคาร)"}
            </div>
          </div>
        </div>
      </section>

      <!-- Weekly Breakdown Table -->
      <section class="gl-section">
        <div class="gl-card" style="padding: 0; overflow: hidden;">
          <div style="padding: var(--space-3) var(--space-4); background: var(--secondary); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: var(--weight-bold); font-size: var(--text-sm);">รายละเอียดรายสัปดาห์ ${m.monthName} 2569</span>
            <span style="font-size: 12px; color: var(--muted-foreground);">${this.historicalWeekly.length} สัปดาห์</span>
          </div>
          <div style="overflow-x: auto;">
            <table class="gl-table">
              <thead>
                <tr>
                  <th>วันที่ (วันอาทิตย์)</th>
                  <th class="is-right">เงินสด</th>
                  <th class="is-right">เงินโอน</th>
                  <th class="is-right">รายรับรวม</th>
                  <th class="is-right">รายจ่าย</th>
                  <th class="is-right">สุทธิ</th>
                </tr>
              </thead>
              <tbody>
                ${
                  this.historicalWeekly.length === 0
                    ? `<tr><td colspan="6" style="text-align: center; color: var(--muted-foreground); padding: var(--space-4);">ไม่มีข้อมูลรายสัปดาห์</td></tr>`
                    : this.historicalWeekly
                        .map((w) => `
                    <tr>
                      <td style="font-weight: var(--weight-medium);">${formatDateThai(w.weekDate)}</td>
                      <td class="is-right num-display" style="color: var(--income);">${w.cashIncome.format()}</td>
                      <td class="is-right num-display" style="color: var(--income);">${w.onlineIncome.format()}</td>
                      <td class="is-right num-display" style="font-weight: var(--weight-bold); color: var(--income);">+${w.incomeTotal.format()}</td>
                      <td class="is-right num-display" style="color: var(--expense);">−${w.expenseTotal.format()}</td>
                      <td class="is-right num-display" style="font-weight: var(--weight-semibold); color: ${w.net.isPositive() ? "var(--income)" : "var(--expense)"};">
                        ${w.net.format()}
                      </td>
                    </tr>`)
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Render Full Year View (Jan-Jul Historical + Aug Live)
   */
  private renderYearView(): string {
    const grand = this.historicalGrandTotals;
    const allMonths = this.historicalAllMonths;
    const liveStatement = this.statement;

    const histIncome = grand ? grand.incomeTotal : Money.zero();
    const histExpense = grand ? grand.expenseTotal : Money.zero();
    const histNet = grand ? grand.net : Money.zero();

    const liveIncome = liveStatement ? liveStatement.total_income : Money.zero();
    const liveExpense = liveStatement ? liveStatement.total_expense : Money.zero();
    const liveNet = liveStatement ? liveStatement.net_surplus_deficit : Money.zero();

    const combinedIncome = histIncome.add(liveIncome);
    const combinedExpense = histExpense.add(liveExpense);
    const combinedNet = histNet.add(liveNet);

    return `
      <!-- Stat Cards -->
      <section class="gl-section" style="margin-bottom: var(--space-5);">
        <div class="gl-statgrid">
          <div class="gl-stat gl-stat--success">
            <div class="gl-stat__label">รายรับสะสมทั้งปี 2569</div>
            <div class="gl-stat__value num-display">+${combinedIncome.format()}</div>
            <div style="font-size: var(--text-2xs); color: var(--muted-foreground); margin-top: 4px;">
              ย้อนหลัง (ม.ค.-ก.ค.): +${histIncome.format()} · ส.ค.: +${liveIncome.format()}
            </div>
          </div>
          <div class="gl-stat gl-stat--danger">
            <div class="gl-stat__label">รายจ่ายสะสมทั้งปี 2569</div>
            <div class="gl-stat__value num-display">−${combinedExpense.format()}</div>
            <div style="font-size: var(--text-2xs); color: var(--muted-foreground); margin-top: 4px;">
              ย้อนหลัง (ม.ค.-ก.ค.): −${histExpense.format()} · ส.ค.: −${liveExpense.format()}
            </div>
          </div>
          <div class="gl-stat ${combinedNet.isPositive() ? "gl-stat--success" : "gl-stat--danger"}">
            <div class="gl-stat__label">ผลสุทธิสะสมทั้งปี</div>
            <div class="gl-stat__value num-display">${combinedNet.format()}</div>
            <div style="font-size: var(--text-2xs); color: var(--muted-foreground); margin-top: 4px;">
              ผลต่างรายรับ–รายจ่ายสะสม (ไม่ใช่ยอดเงินคงเหลือในบัญชีธนาคารจริง)
            </div>
          </div>
        </div>
      </section>

      <!-- Monthly Overview Table -->
      <section class="gl-section">
        <div class="gl-card" style="padding: 0; overflow: hidden;">
          <div style="padding: var(--space-3) var(--space-4); background: var(--secondary); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: var(--weight-bold); font-size: var(--text-sm);">ตารางสรุปรายเดือน ประจำปี 2569</span>
            <span style="font-size: 12px; color: var(--muted-foreground);">ข้อมูล 8 เดือน</span>
          </div>
          <div style="overflow-x: auto;">
            <table class="gl-table">
              <thead>
                <tr>
                  <th>เดือน</th>
                  <th>สถานะ</th>
                  <th class="is-right">เงินสด</th>
                  <th class="is-right">เงินโอน</th>
                  <th class="is-right">รายรับรวม</th>
                  <th class="is-right">รายจ่ายรวม</th>
                  <th class="is-right">รายรับสุทธิ</th>
                  <th class="is-right">ยกยอดไป</th>
                </tr>
              </thead>
              <tbody>
                ${allMonths
                  .map((m) => {
                    const isPartial = m.status === "historical_partial";
                    const isWarn = m.dataQualityFlag === "DATA_REVIEW_REQUIRED";
                    return `
                  <tr>
                    <td style="font-weight: var(--weight-semibold);">${m.monthName} 2569</td>
                    <td>
                      <span class="gl-badge ${isPartial ? "gl-badge--pending" : isWarn ? "gl-badge--rejected" : "gl-badge--pending"}" style="font-size: var(--text-2xs);">
                        ${isPartial ? "ย้อนหลัง (ไม่เต็มเดือน)" : isWarn ? "ย้อนหลัง (ต้องตรวจทาน)" : "ย้อนหลัง"}
                      </span>
                    </td>
                    <td class="is-right num-display" style="color: var(--income);">${m.cashIncome.format()}</td>
                    <td class="is-right num-display" style="color: var(--income);">${m.onlineIncome.format()}</td>
                    <td class="is-right num-display" style="font-weight: var(--weight-bold); color: var(--income);">+${m.incomeTotal.format()}</td>
                    <td class="is-right num-display" style="color: var(--expense);">−${m.expenseTotal.format()}</td>
                    <td class="is-right num-display" style="font-weight: var(--weight-semibold); color: ${m.net.isPositive() ? "var(--income)" : "var(--expense)"};">
                      ${m.net.format()}
                    </td>
                    <td class="is-right num-display" style="color: var(--muted-foreground);">
                      ${m.closingBalanceReported ? m.closingBalanceReported.format() : "—"}
                    </td>
                  </tr>`;
                  })
                  .join("")}

                <!-- Live August Row -->
                <tr style="background: var(--primary-muted);">
                  <td style="font-weight: var(--weight-bold);">สิงหาคม 2569</td>
                  <td>
                    <span class="gl-badge gl-badge--approved" style="font-size: var(--text-2xs);">บัญชีปัจจุบัน</span>
                  </td>
                  <td class="is-right num-display" style="color: var(--income);">—</td>
                  <td class="is-right num-display" style="color: var(--income);">—</td>
                  <td class="is-right num-display" style="font-weight: var(--weight-bold); color: var(--income);">+${liveIncome.format()}</td>
                  <td class="is-right num-display" style="color: var(--expense);">−${liveExpense.format()}</td>
                  <td class="is-right num-display" style="font-weight: var(--weight-bold); color: ${liveNet.isPositive() ? "var(--income)" : "var(--expense)"};">
                    ${liveNet.format()}
                  </td>
                  <td class="is-right num-display" style="color: var(--muted-foreground);">ปัจจุบัน</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  public attachEventListeners(root: HTMLElement, onStateChange: () => void): void {
    const printBtn = root.querySelector<HTMLButtonElement>("#print-report-btn");
    printBtn?.addEventListener("click", () => {
      window.print();
    });

    const retryBtn = root.querySelector<HTMLButtonElement>("#retry-reports-btn");
    retryBtn?.addEventListener("click", async () => {
      await this.loadData();
      onStateChange();
    });

    const tabs = root.querySelectorAll<HTMLButtonElement>(".gl-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", async () => {
        this.selectedPeriod = tab.getAttribute("data-period") || "2026-08";
        await this.loadData();
        onStateChange();
      });
    });
  }
}
