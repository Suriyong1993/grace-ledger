import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../lib/supabase/types";
import { Money } from "../lib/money";
import { ReportsService, StatementOfFinancialPosition } from "../lib/reports/reports-service";

export class ReportsPage {
  private selectedPeriod = "2026-08";
  private reportsService: ReportsService;
  private statement: StatementOfFinancialPosition | null = null;
  private isLoading = true;
  private errorMessage: string | null = null;

  constructor(
    public readonly supabase: SupabaseClient<Database>,
    public readonly churchId: string
  ) {
    this.reportsService = new ReportsService(supabase);
  }

  public getSelectedPeriod(): string {
    return this.selectedPeriod;
  }

  public async loadData(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;

    try {
      let periodStart = "2026-08-01";
      let periodEnd = "2026-08-31";

      if (this.selectedPeriod === "2026-07") {
        periodStart = "2026-07-01";
        periodEnd = "2026-07-31";
      } else if (this.selectedPeriod === "2026-06") {
        periodStart = "2026-06-01";
        periodEnd = "2026-06-30";
      } else if (this.selectedPeriod === "2026-year") {
        periodStart = "2026-01-01";
        periodEnd = "2026-12-31";
      }

      const res = await this.reportsService.getStatementOfFinancialPosition(
        this.churchId,
        periodStart,
        periodEnd
      );

      if (!res.success || !res.data) {
        this.errorMessage = res.error || "ไม่สามารถโหลดข้อมูลรายงานการเงินได้";
        this.statement = null;
      } else {
        this.statement = res.data;
      }
    } catch (err: any) {
      this.errorMessage = err.message || "เกิดข้อผิดพลาดในการโหลดรายงานการเงิน";
      this.statement = null;
    } finally {
      this.isLoading = false;
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
          <span style="color: var(--text-muted);">กำลังโหลดข้อมูลรายงาน...</span>
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

    const statement = this.statement;
    const totalIncome = statement ? statement.total_income : Money.zero();
    const totalExpense = statement ? statement.total_expense : Money.zero();
    const netSurplus = statement ? statement.net_surplus_deficit : Money.zero();

    const incomeCategories = statement?.categories_summary.filter((c) => c.type === "income") || [];
    const expenseCategories = statement?.categories_summary.filter((c) => c.type === "expense") || [];
    const hasData = (statement?.posted_transactions_count || 0) > 0;

    return `
    <div class="gl-page gl-fade-in">
      <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: var(--space-4);">
        <div class="gl-page-header" style="margin-bottom: 0;">
          <h1>รายงานการเงิน</h1>
          <p>งบการเงินประจำเดือน รายรับ-รายจ่าย และรายงานสถานะกองทุน (คำนวณจากบัญชีแยกประเภทที่ลงบัญชีแล้ว)</p>
        </div>
        <button id="print-report-btn" class="gl-btn gl-btn--secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
          <span>พิมพ์รายงาน</span>
        </button>
      </div>

      <!-- Month Selector Tabs -->
      <section class="gl-section" style="margin-bottom: var(--space-4);">
        <div class="gl-tablist">
          <button class="gl-tab ${this.selectedPeriod === "2026-08" ? "is-active" : ""}" data-period="2026-08">สิงหาคม 2569 (งวดปัจจุบัน)</button>
          <button class="gl-tab ${this.selectedPeriod === "2026-07" ? "is-active" : ""}" data-period="2026-07">กรกฎาคม 2569</button>
          <button class="gl-tab ${this.selectedPeriod === "2026-06" ? "is-active" : ""}" data-period="2026-06">มิถุนายน 2569</button>
          <button class="gl-tab ${this.selectedPeriod === "2026-year" ? "is-active" : ""}" data-period="2026-year">ประจำปี 2569</button>
        </div>
      </section>

      <!-- Net Result Strip -->
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
            <div class="gl-stat__label">รายรับสุทธิ (Net Surplus)</div>
            <div class="gl-stat__value num-display">${netSurplus.format()}</div>
          </div>
        </div>
      </section>

      ${
        !hasData
          ? `
      <div class="gl-card gl-empty-state" style="text-align: center; padding: var(--space-8) var(--space-4);">
        <div style="font-size: 3rem; margin-bottom: var(--space-3);">📊</div>
        <h3>ไม่มีข้อมูลธุรกรรมที่ลงบัญชีแล้วในงวดนี้</h3>
        <p style="color: var(--text-muted); max-width: 420px; margin: 0 auto var(--space-4);">
          รายงานการเงินจะประมวลผลเฉพาะรายการที่ผ่านการอนุมัติและลงบัญชี (Posted) ในช่วงเวลาที่เลือกเท่านั้น
        </p>
      </div>`
          : `
      <!-- Detailed Statement Tables -->
      <section class="gl-section">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: var(--space-4);">
          <!-- Income Table -->
          <div class="gl-card" style="padding: 0; overflow: hidden;">
            <div style="padding: var(--space-3) var(--space-4); background: var(--income-muted); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-weight: var(--weight-bold); font-size: var(--text-sm); color: var(--on-income-muted);">หมวดรายรับ</span>
              <span class="num-display" style="font-weight: var(--weight-bold); color: var(--income);">+${totalIncome.format()}</span>
            </div>
            <table class="gl-table">
              <tbody>
                ${
                  incomeCategories.length === 0
                    ? `<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">ไม่มีรายการรายรับ</td></tr>`
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
                          <div style="flex: 1; height: 5px; background: var(--border); border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: ${pct}%; background: var(--income); border-radius: 3px;"></div>
                          </div>
                          <span style="font-size: 11px; color: var(--text-muted); width: 32px; text-align: right;">${pct}%</span>
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

          <!-- Expense Table -->
          <div class="gl-card" style="padding: 0; overflow: hidden;">
            <div style="padding: var(--space-3) var(--space-4); background: var(--expense-muted); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-weight: var(--weight-bold); font-size: var(--text-sm); color: var(--on-expense-muted);">หมวดรายจ่าย</span>
              <span class="num-display" style="font-weight: var(--weight-bold); color: var(--expense);">−${totalExpense.format()}</span>
            </div>
            <table class="gl-table">
              <tbody>
                ${
                  expenseCategories.length === 0
                    ? `<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">ไม่มีรายการรายจ่าย</td></tr>`
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
                          <div style="flex: 1; height: 5px; background: var(--border); border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: ${pct}%; background: var(--expense); border-radius: 3px;"></div>
                          </div>
                          <span style="font-size: 11px; color: var(--text-muted); width: 32px; text-align: right;">${pct}%</span>
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
    </div>
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
