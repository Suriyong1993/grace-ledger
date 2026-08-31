import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../lib/supabase/types";
import { Money } from "../lib/money";
import {
  ReportsService,
  StatementOfFinancialPosition,
} from "../lib/reports/reports-service";
import {
  HistoricalService,
  HistoricalMonthlySummary,
  HistoricalWeeklySummary,
  HistoricalGrandTotals,
} from "../lib/reports/historical-service";
import { formatDateThai, escapeHtml } from "../lib/format";

const ICON_NO_ARCHIVE = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><path d="M10 13h4"/></svg>`;
const ICON_DOWNLOAD = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>`;
const ICON_PRINT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>`;

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
    public readonly churchId: string,
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
          this.reportsService.getStatementOfFinancialPosition(
            this.churchId,
            "2026-08-01",
            "2026-08-31",
          ),
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
          this.historicalService.getMonthlySummaryByMonth(
            this.churchId,
            monthNum,
            2569,
          ),
          this.historicalService.getWeeklySummaries(
            this.churchId,
            2569,
            monthNum,
          ),
        ]);

        if (!monthRes.success) {
          this.errorMessage =
            monthRes.error || "ไม่สามารถโหลดข้อมูลย้อนหลังได้";
        } else {
          this.historicalMonthly = monthRes.data || null;
          this.historicalWeekly = weeklyRes.data || [];
        }
      } else {
        // Live Accounting month (2026-08+)
        const periodStart = `${this.selectedPeriod}-01`;
        const [periodYear, periodMonth] = this.selectedPeriod
          .split("-")
          .map(Number);
        const lastDay = new Date(periodYear, periodMonth, 0).getDate();
        const periodEnd = `${this.selectedPeriod}-${String(lastDay).padStart(2, "0")}`;

        const res = await this.reportsService.getStatementOfFinancialPosition(
          this.churchId,
          periodStart,
          periodEnd,
        );

        if (!res.success) {
          this.errorMessage = res.error || "ไม่สามารถโหลดงบการเงินได้";
        } else {
          this.statement = res.data || null;
        }
      }
    } catch {
      this.errorMessage =
        "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง";
    } finally {
      this.isLoading = false;
    }
  }

  private async loadLeadership(): Promise<void> {
    try {
      const { data, error } = await (this.supabase.from("churches") as any)
        .select("settings")
        .eq("id", this.churchId)
        .maybeSingle();

      if (!error && data?.settings?.leadership) {
        const lead = data.settings.leadership;
        this.leadership = {
          pastor: typeof lead.pastor === "string" ? lead.pastor : undefined,
          auditor: typeof lead.auditor === "string" ? lead.auditor : undefined,
          cashCounters: Array.isArray(lead.cash_counters)
            ? lead.cash_counters.filter((c: any) => typeof c === "string")
            : [],
        };
      } else {
        this.leadership = null;
      }
    } catch {
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
          <div class="gl-actionbar">
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
    const isHistorical = HistoricalService.isHistoricalPeriod(
      this.selectedPeriod,
    );

    return `
    <div class="gl-page gl-fade-in">
      <div class="gl-reports-pagehead">
        <div class="gl-page-header" style="margin-bottom: 0;">
          <div class="gl-reports-pagehead__title-row">
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
        <div class="gl-reports-pagehead__actions no-print">
          <button id="export-csv-btn" class="gl-btn gl-btn--primary">
            ${ICON_DOWNLOAD}
            <span>ส่งออก CSV/Excel</span>
          </button>
          <button id="print-report-btn" class="gl-btn gl-btn--secondary">
            ${ICON_PRINT}
            <span>พิมพ์รายงาน</span>
          </button>
        </div>
      </div>

      <!-- Month Selector Tabs -->
      <section class="gl-section no-print" style="margin-bottom: var(--space-4);">
        <div class="gl-tablist" style="overflow-x: auto; white-space: nowrap; padding-bottom: 4px;">
          <button class="gl-tab ${this.selectedPeriod === "2026-08" ? "is-active" : ""}" data-period="2026-08">ส.ค. 2569</button>
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

  private renderLeadershipBlock(): string {
    const l = this.leadership;
    if (!l || (!l.pastor && !l.auditor && l.cashCounters.length === 0))
      return "";

    const rows: string[] = [];
    if (l.pastor) {
      rows.push(`
        <div class="gl-reports-leadership-row">
          <span class="gl-reports-leadership-row__label">ศิษยาภิบาล</span>
          <span class="gl-reports-leadership-row__value">${l.pastor}</span>
        </div>`);
    }
    if (l.cashCounters.length > 0) {
      rows.push(`
        <div class="gl-reports-leadership-row">
          <span class="gl-reports-leadership-row__label">ผู้นับเงิน</span>
          <span class="gl-reports-leadership-row__value">${l.cashCounters.join(", ")}</span>
        </div>`);
    }
    if (l.auditor) {
      rows.push(`
        <div class="gl-reports-leadership-row">
          <span class="gl-reports-leadership-row__label">ผู้ตรวจสอบบัญชี</span>
          <span class="gl-reports-leadership-row__value">${l.auditor}</span>
        </div>`);
    }

    return `
      <section class="gl-section" style="margin-top: var(--space-6);">
        <div class="gl-section__head">
          <h2>ผู้รับผิดชอบและผู้ตรวจสอบ</h2>
        </div>
        <div class="gl-card gl-rows" style="padding: var(--space-4);">
          ${rows.join("")}
        </div>
      </section>`;
  }

  /**
   * Net surplus/deficit is the figure the screen exists to answer — it's the
   * hero. Income and expense explain it, so they sit as supporting figures
   * beneath a divider rather than as two more equal-weight cards.
   */
  private renderFinancialHero(opts: {
    netLabel: string;
    net: Money;
    netCaption: string;
    incomeLabel: string;
    income: Money;
    incomeCaption: string;
    expenseLabel: string;
    expense: Money;
    expenseCaption: string;
  }): string {
    const netColor = opts.net.isPositive() ? "var(--income)" : "var(--expense)";
    return `
      <section class="gl-section gl-reports-hero">
        <div class="gl-card">
          <div class="kicker" style="margin: 0;">${opts.netLabel}</div>
          <div class="num-display gl-reports-hero__value" style="color: ${netColor};">${opts.net.format()}</div>
          <div class="gl-reports-hero__caption">${opts.netCaption}</div>

          <div class="gl-reports-hero__figures">
            <span class="gl-reports-hero__figure">
              ${opts.incomeLabel}
              <strong class="num-display" style="color: var(--income);">+${opts.income.format()}</strong>
              <span class="gl-reports-hero__figcaption">${opts.incomeCaption}</span>
            </span>
            <span class="gl-reports-hero__figure">
              ${opts.expenseLabel}
              <strong class="num-display" style="color: var(--expense);">−${opts.expense.format()}</strong>
              <span class="gl-reports-hero__figcaption">${opts.expenseCaption}</span>
            </span>
          </div>
        </div>
      </section>
    `;
  }

  private renderLiveMonthView(): string {
    const statement = this.statement;
    const totalIncome = statement ? statement.total_income : Money.zero();
    const totalExpense = statement ? statement.total_expense : Money.zero();
    const netSurplus = statement ? statement.net_surplus_deficit : Money.zero();

    const incomeRows =
      statement?.categories_summary?.filter((c) => c.type === "income") || [];
    const expenseRows =
      statement?.categories_summary?.filter((c) => c.type === "expense") || [];
    const fundRows = statement?.funds_allocation || [];

    if (
      !statement ||
      (statement.posted_transactions_count === 0 &&
        incomeRows.length === 0 &&
        expenseRows.length === 0)
    ) {
      return `
      <section class="gl-section">
        <div class="gl-card gl-empty-state gl-empty-center" style="padding: var(--space-8); border-style: dashed;">
          <div class="gl-empty-center__msg">
            ไม่มีข้อมูลธุรกรรมที่ลงบัญชีแล้วในงวดนี้
          </div>
          <div style="font-size: var(--text-sm); color: var(--muted-foreground);">
            ยังไม่มีรายการธุรกรรมสถานะ 'posted' สำหรับเดือนที่เลือก
          </div>
        </div>
      </section>
      `;
    }

    return `
      ${this.renderFinancialHero({
        netLabel: "รายรับสุทธิ (เกินดุล/ขาดดุล)",
        net: netSurplus,
        netCaption: "ผลต่างรายรับหักรายจ่ายในงวดนี้",
        incomeLabel: "รายรับรวมทั้งหมด",
        income: totalIncome,
        incomeCaption: "ยอดเงินถวายและรายรับที่ลงบัญชีแล้ว",
        expenseLabel: "รายจ่ายรวมทั้งหมด",
        expense: totalExpense,
        expenseCaption: "ค่าใช้จ่ายและพันธกิจที่ได้รับอนุมัติแล้ว",
      })}

      <!-- Tables Grid: Income & Expense Categories -->
      <section class="gl-section" style="margin-bottom: var(--space-6);">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-4);">
          <!-- Income Table -->
          <div class="gl-card" style="padding: 0; overflow: hidden;">
            <div class="gl-reports-table-head">
              หมวดรายรับ
            </div>
            <table class="gl-table">
              <thead>
                <tr>
                  <th>หมวดหมู่</th>
                  <th class="is-right">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                ${
                  incomeRows.length === 0
                    ? `<tr><td colspan="2" style="text-align: center; color: var(--muted-foreground);">ไม่มีรายการรายรับในงวดนี้</td></tr>`
                    : incomeRows
                        .map(
                          (r) => `
                    <tr>
                      <td>${r.category_name}</td>
                      <td class="is-right num-display" style="font-weight: var(--weight-semibold); color: var(--income);">+${r.total_amount.format()}</td>
                    </tr>`,
                        )
                        .join("")
                }
              </tbody>
            </table>
          </div>

          <!-- Expense Table -->
          <div class="gl-card" style="padding: 0; overflow: hidden;">
            <div class="gl-reports-table-head">
              หมวดรายจ่าย
            </div>
            <table class="gl-table">
              <thead>
                <tr>
                  <th>หมวดหมู่</th>
                  <th class="is-right">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                ${
                  expenseRows.length === 0
                    ? `<tr><td colspan="2" style="text-align: center; color: var(--muted-foreground);">ไม่มีรายการรายจ่ายในงวดนี้</td></tr>`
                    : expenseRows
                        .map(
                          (r) => `
                    <tr>
                      <td>${r.category_name}</td>
                      <td class="is-right num-display" style="font-weight: var(--weight-semibold); color: var(--expense);">−${r.total_amount.format()}</td>
                    </tr>`,
                        )
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Fund Breakdown -->
      <section class="gl-section">
        <div class="gl-card" style="padding: 0; overflow: hidden;">
          <div class="gl-reports-table-head">
            สถานะและยอดคงเหลือกองทุน
          </div>
          <table class="gl-table">
            <thead>
              <tr>
                <th>กองทุน</th>
                <th class="is-right">จัดสรรในงวดนี้</th>
                <th class="is-right">จำนวนสปลิต</th>
              </tr>
            </thead>
            <tbody>
              ${
                fundRows.length === 0
                  ? `<tr><td colspan="3" style="text-align: center; color: var(--muted-foreground);">ไม่มีข้อมูลกองทุน</td></tr>`
                  : fundRows
                      .map(
                        (f) => `
                  <tr>
                    <td style="font-weight: var(--weight-medium);">${escapeHtml(f.fund_name)}</td>
                    <td class="is-right num-display" style="font-weight: var(--weight-bold);">${f.total_allocated.format()}</td>
                    <td class="is-right num-display" style="color: var(--muted-foreground);">${f.split_count} รายการ</td>
                  </tr>`,
                      )
                      .join("")
              }
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  private renderHistoricalMonthView(): string {
    const m = this.historicalMonthly;
    const weekly = this.historicalWeekly;

    if (!m) {
      return `
        <div class="gl-card gl-empty-state gl-reports-empty-icon" style="padding: var(--space-8);">
          ${ICON_NO_ARCHIVE}
          <div class="gl-reports-empty-icon__title">ไม่พบข้อมูลเอกสารย้อนหลัง</div>
          <p style="margin: 0; font-size: var(--text-sm);">ยังไม่มีการนำเข้าไฟล์สรุปบัญชีสำหรับเดือนนี้</p>
        </div>
      `;
    }

    const isPartial = m.status === "historical_partial";
    const isWarn = m.dataQualityFlag === "DATA_REVIEW_REQUIRED";

    return `
      ${
        isPartial || isWarn
          ? `
        <div class="gl-notice ${isWarn ? "gl-notice--error" : "gl-notice--warning"}" style="margin-bottom: var(--space-4);">
          <div class="gl-notice__body">
            <strong>${isWarn ? "ข้อมูลเดือนนี้ต้องตรวจทาน:" : "ข้อมูลย้อนหลังไม่เต็มเดือน:"}</strong>
            ${isWarn ? "ยอดรวมบางส่วนไม่ตรงกับเอกสารต้นฉบับ" : "เป็นข้อมูลสรุปเฉพาะช่วงปลายเดือน"}
          </div>
        </div>`
          : ""
      }

      ${this.renderFinancialHero({
        netLabel: "รายรับสุทธิประจำเดือน",
        net: m.net,
        netCaption: `ยกยอดไป: ${m.closingBalanceReported ? m.closingBalanceReported.format() : "—"}`,
        incomeLabel: `รายรับรวม (${m.monthName})`,
        income: m.incomeTotal,
        incomeCaption: `เงินสด: +${m.cashIncome.format()} · โอน/QR: +${m.onlineIncome.format()}`,
        expenseLabel: "รายจ่ายรวม",
        expense: m.expenseTotal,
        expenseCaption: "รายจ่ายตามสมุดบัญชีดั้งเดิม",
      })}

      <!-- Weekly breakdown -->
      <section class="gl-section">
        <div class="gl-card" style="padding: 0; overflow: hidden;">
          <div class="gl-reports-table-head">
            รายละเอียดรายสัปดาห์ (${m.monthName} 2569)
          </div>
          <div style="overflow-x: auto;">
            <table class="gl-table">
              <thead>
                <tr>
                  <th>สัปดาห์ / วันที่</th>
                  <th class="is-right">เงินสด</th>
                  <th class="is-right">เงินโอน</th>
                  <th class="is-right">รายรับรวม</th>
                  <th class="is-right">รายจ่าย</th>
                  <th class="is-right">คงเหลือยกไป</th>
                </tr>
              </thead>
              <tbody>
                ${
                  weekly.length === 0
                    ? `<tr><td colspan="6" style="text-align: center; color: var(--muted-foreground);">ไม่มีข้อมูลรายสัปดาห์</td></tr>`
                    : weekly
                        .map(
                          (w) => `
                    <tr>
                      <td style="font-weight: var(--weight-medium);">${formatDateThai(w.weekDate)}</td>
                      <td class="is-right num-display" style="color: var(--income);">${w.cashIncome.format()}</td>
                      <td class="is-right num-display" style="color: var(--income);">${w.onlineIncome.format()}</td>
                      <td class="is-right num-display" style="font-weight: var(--weight-semibold); color: var(--income);">+${w.incomeTotal.format()}</td>
                      <td class="is-right num-display" style="color: var(--expense);">−${w.expenseTotal.format()}</td>
                      <td class="is-right num-display" style="font-weight: var(--weight-bold);">${w.net.format()}</td>
                    </tr>`,
                        )
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  private renderYearView(): string {
    const grand = this.historicalGrandTotals;
    const allMonths = this.historicalAllMonths;
    const liveStatement = this.statement;

    const histIncome = grand ? grand.incomeTotal : Money.zero();
    const histExpense = grand ? grand.expenseTotal : Money.zero();
    const histNet = grand ? grand.net : Money.zero();

    const liveIncome = liveStatement
      ? liveStatement.total_income
      : Money.zero();
    const liveExpense = liveStatement
      ? liveStatement.total_expense
      : Money.zero();
    const liveNet = liveStatement
      ? liveStatement.net_surplus_deficit
      : Money.zero();

    const combinedIncome = histIncome.add(liveIncome);
    const combinedExpense = histExpense.add(liveExpense);
    const combinedNet = histNet.add(liveNet);

    return `
      ${this.renderFinancialHero({
        netLabel: "ผลสุทธิสะสมทั้งปี",
        net: combinedNet,
        netCaption:
          "ผลต่างรายรับ–รายจ่ายสะสม (ไม่ใช่ยอดเงินคงเหลือในบัญชีธนาคารจริง)",
        incomeLabel: "รายรับสะสมทั้งปี 2569",
        income: combinedIncome,
        incomeCaption: `ย้อนหลัง (ม.ค.-ก.ค.): +${histIncome.format()} · ส.ค.: +${liveIncome.format()}`,
        expenseLabel: "รายจ่ายสะสมทั้งปี 2569",
        expense: combinedExpense,
        expenseCaption: `ย้อนหลัง (ม.ค.-ก.ค.): −${histExpense.format()} · ส.ค.: −${liveExpense.format()}`,
      })}

      <!-- Monthly Overview Table -->
      <section class="gl-section">
        <div class="gl-card" style="padding: 0; overflow: hidden;">
          <div class="gl-reports-table-head gl-reports-table-head--between">
            <span>ตารางสรุปรายเดือน ประจำปี 2569</span>
            <span style="font-weight: var(--weight-regular); color: var(--muted-foreground);">ข้อมูล 8 เดือน</span>
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

  public exportToCSV(): void {
    const isYearView = this.selectedPeriod === "2026-year";
    const isHistorical = HistoricalService.isHistoricalPeriod(
      this.selectedPeriod,
    );
    const rows: string[][] = [];

    if (isYearView) {
      rows.push(["รายงานการเงินประจำปี 2569", "คริสตจักรเกรซแบ๊บติสต์"]);
      rows.push([""]);
      rows.push([
        "เดือน",
        "สถานะ",
        "เงินสด (฿)",
        "เงินโอน (฿)",
        "รายรับรวม (฿)",
        "รายจ่ายรวม (฿)",
        "รายรับสุทธิ (฿)",
        "ยกยอดไป (฿)",
      ]);

      for (const m of this.historicalAllMonths) {
        rows.push([
          `${m.monthName} 2569`,
          m.status === "historical_partial"
            ? "ย้อนหลัง (ไม่เต็มเดือน)"
            : "ย้อนหลัง",
          m.cashIncome.toFixed(2),
          m.onlineIncome.toFixed(2),
          m.incomeTotal.toFixed(2),
          m.expenseTotal.toFixed(2),
          m.net.toFixed(2),
          m.closingBalanceReported ? m.closingBalanceReported.toFixed(2) : "",
        ]);
      }

      if (this.statement) {
        rows.push([
          "สิงหาคม 2569",
          "บัญชีปัจจุบัน",
          "",
          "",
          this.statement.total_income.toFixed(2),
          this.statement.total_expense.toFixed(2),
          this.statement.net_surplus_deficit.toFixed(2),
          "ปัจจุบัน",
        ]);
      }
    } else if (isHistorical && this.historicalMonthly) {
      const m = this.historicalMonthly;
      rows.push([
        `รายงานการเงินย้อนหลัง เดือน ${m.monthName} 2569`,
        "คริสตจักรเกรซแบ๊บติสต์",
      ]);
      rows.push([""]);
      rows.push(["สรุปยอดรวม", "จำนวนเงิน (฿)"]);
      rows.push(["รายรับเงินสด", m.cashIncome.toFixed(2)]);
      rows.push(["รายรับเงินโอน/QR", m.onlineIncome.toFixed(2)]);
      rows.push(["รายรับรวมทั้งหมด", m.incomeTotal.toFixed(2)]);
      rows.push(["รายจ่ายรวมทั้งหมด", m.expenseTotal.toFixed(2)]);
      rows.push(["รายรับสุทธิ", m.net.toFixed(2)]);
      rows.push([""]);
      rows.push([
        "สัปดาห์ / วันที่",
        "เงินสด (฿)",
        "เงินโอน (฿)",
        "รายรับรวม (฿)",
        "รายจ่าย (฿)",
        "สุทธิ (฿)",
      ]);
      for (const w of this.historicalWeekly) {
        rows.push([
          w.weekDate,
          w.cashIncome.toFixed(2),
          w.onlineIncome.toFixed(2),
          w.incomeTotal.toFixed(2),
          w.expenseTotal.toFixed(2),
          w.net.toFixed(2),
        ]);
      }
    } else if (this.statement) {
      const s = this.statement;
      rows.push([
        `งบการเงินประจำเดือน ${this.selectedPeriod}`,
        "คริสตจักรเกรซแบ๊บติสต์",
      ]);
      rows.push([""]);
      rows.push(["สรุปภาพรวม", "จำนวนเงิน (฿)"]);
      rows.push(["รายรับรวมทั้งหมด", s.total_income.toFixed(2)]);
      rows.push(["รายจ่ายรวมทั้งหมด", s.total_expense.toFixed(2)]);
      rows.push([
        "รายรับสุทธิ (เกินดุล/ขาดดุล)",
        s.net_surplus_deficit.toFixed(2),
      ]);
      rows.push([""]);
      rows.push(["หมวดรายรับ", "จำนวนเงิน (฿)"]);
      const incList =
        s.categories_summary?.filter((c) => c.type === "income") || [];
      for (const inc of incList) {
        rows.push([inc.category_name, inc.total_amount.toFixed(2)]);
      }
      rows.push([""]);
      rows.push(["หมวดรายจ่าย", "จำนวนเงิน (฿)"]);
      const expList =
        s.categories_summary?.filter((c) => c.type === "expense") || [];
      for (const exp of expList) {
        rows.push([exp.category_name, exp.total_amount.toFixed(2)]);
      }
      rows.push([""]);
      rows.push(["กองทุน", "จัดสรรในงวดนี้ (฿)", "จำนวนสปลิต"]);
      const fundList = s.funds_allocation || [];
      for (const f of fundList) {
        rows.push([
          f.fund_name,
          f.total_allocated.toFixed(2),
          String(f.split_count),
        ]);
      }
    }

    // Convert to CSV with UTF-8 BOM for Microsoft Excel Thai language compatibility
    const csvContent =
      "\uFEFF" +
      rows
        .map((r) =>
          r
            .map((field) => {
              const str = String(field || "");
              return str.includes(",") ||
                str.includes('"') ||
                str.includes("\n")
                ? `"${str.replace(/"/g, '""')}"`
                : str;
            })
            .join(","),
        )
        .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `grace-ledger-financial-report-${this.selectedPeriod}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  public attachEventListeners(
    root: HTMLElement,
    onStateChange: () => void,
  ): void {
    const printBtn = root.querySelector<HTMLButtonElement>("#print-report-btn");
    printBtn?.addEventListener("click", () => {
      window.print();
    });

    const exportBtn = root.querySelector<HTMLButtonElement>("#export-csv-btn");
    exportBtn?.addEventListener("click", () => {
      this.exportToCSV();
    });

    const retryBtn =
      root.querySelector<HTMLButtonElement>("#retry-reports-btn");
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
