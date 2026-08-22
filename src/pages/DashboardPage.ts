import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../lib/supabase/types";
import { ApprovalsService } from "../lib/transactions/approvals-service";
import { HistoricalService } from "../lib/reports/historical-service";
import { Money } from "../lib/money";
import { formatDateThai } from "../lib/format";

export interface DashboardFund {
  id?: string;
  name: string;
  balance: Money;
}

export interface RecentTransaction {
  id: string;
  title: string;
  subtitle: string;
  amount: Money;
  direction: "income" | "expense" | "transfer";
  date: string;
  status: "approved" | "pending" | "rejected";
}

export interface HistoricalTrendBar {
  monthName: string;
  income: string;
  expense: string;
  net: string;
  isPositive: boolean;
  incomeSatang: number;
  expenseSatang: number;
  isPartial?: boolean;
}

export interface DashboardData {
  pendingApprovalsCount: number;
  totalFundsBalance?: string;
  monthlyIncome?: string;
  monthlyExpense?: string;
  activeAccountsCount?: number;
  funds?: DashboardFund[];
  recentTransactions?: RecentTransaction[];
  historicalTrend?: HistoricalTrendBar[];
  loadFailed?: boolean;
  errorMessage?: string;
}

const ICON_CLOCK = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
const ICON_ARROW = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7"/></svg>`;
const ICON_INCOME = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 19V5M6 11l6-6 6 6"/></svg>`;
const ICON_EXPENSE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 5v14M6 13l6 6 6-6"/></svg>`;
const ICON_TRANSFER = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="false" focusable="false"><path d="M4 9h13l-3-3M20 15H7l3 3"/></svg>`;

export class DashboardPage {
  private approvalsService: ApprovalsService;
  private historicalService: HistoricalService;

  constructor(private supabase: SupabaseClient<Database>) {
    this.approvalsService = new ApprovalsService(supabase);
    this.historicalService = new HistoricalService(supabase);
  }

  public async loadData(churchId: string): Promise<DashboardData> {
    try {
      const pendingRes = await this.approvalsService.getPendingApprovals(churchId);
      const pendingCount = pendingRes.success && pendingRes.data ? pendingRes.data.length : 0;

      const { data: fundsData, error: fundsError } = await (this.supabase
        .from("funds") as any)
        .select("id, name, current_balance")
        .eq("church_id", churchId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (fundsError) {
        return {
          pendingApprovalsCount: 0,
          totalFundsBalance: "฿0.00",
          monthlyIncome: "฿0.00",
          monthlyExpense: "฿0.00",
          activeAccountsCount: 0,
          funds: [],
          recentTransactions: [],
          loadFailed: true,
          errorMessage: "ไม่สามารถโหลดข้อมูลกองทุนได้",
        };
      }

      let totalFunds = Money.zero();
      const funds: DashboardFund[] = [];
      if (fundsData && Array.isArray(fundsData)) {
        for (const f of fundsData) {
          const balance = f.current_balance ? Money.from(f.current_balance as string) : Money.zero();
          totalFunds = totalFunds.add(balance);
          funds.push({ id: f.id, name: (f.name as string) || "กองทุน", balance });
        }
      }

      const { count: accountsCount } = await this.supabase
        .from("accounts")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .eq("is_active", true);

      // Query recent transactions from Supabase
      const { data: txnsData, error: txnsError } = await (this.supabase
        .from("transactions") as any)
        .select(`
          id,
          description,
          transaction_date,
          status,
          created_at,
          transaction_splits(amount, fund_id)
        `)
        .eq("church_id", churchId)
        .order("transaction_date", { ascending: false })
        .limit(5);

      if (txnsError) {
        return {
          pendingApprovalsCount: pendingCount,
          totalFundsBalance: totalFunds.format(),
          monthlyIncome: "฿0.00",
          monthlyExpense: "฿0.00",
          activeAccountsCount: accountsCount || 0,
          funds,
          recentTransactions: [],
          loadFailed: true,
          errorMessage: "ไม่สามารถโหลดรายการธุรกรรมล่าสุดได้",
        };
      }

      const recentTransactions: RecentTransaction[] = [];
      let calculatedIncome = Money.zero();
      let calculatedExpense = Money.zero();

      if (txnsData && Array.isArray(txnsData) && txnsData.length > 0) {
        for (const t of txnsData) {
          let splitSum = Money.zero();
          if (t.transaction_splits && Array.isArray(t.transaction_splits)) {
            for (const sp of t.transaction_splits) {
              if (sp.amount) splitSum = splitSum.add(Money.from(sp.amount));
            }
          }

          const isExp = t.description?.includes("จ่าย") || t.description?.includes("ซื้อ") || t.description?.includes("ค่า");
          const direction: "income" | "expense" | "transfer" = isExp ? "expense" : "income";

          if (direction === "income") calculatedIncome = calculatedIncome.add(splitSum);
          else calculatedExpense = calculatedExpense.add(splitSum);

          const formattedDate = t.transaction_date ? formatDateThai(t.transaction_date) : "วันนี้";

          recentTransactions.push({
            id: t.id,
            title: t.description || "รายการทั่วไป",
            subtitle: `กองทุนทั่วไป · ${formattedDate}`,
            amount: splitSum,
            direction,
            date: formattedDate,
            status: t.status === "approved" ? "approved" : t.status === "rejected" ? "rejected" : "pending",
          });
        }
      }

      // Query historical monthly summaries for dashboard trend preview
      const histRes = await this.historicalService.getMonthlySummaries(churchId, 2569);
      const historicalTrend: HistoricalTrendBar[] = (histRes.success && histRes.data ? histRes.data : []).map((m) => ({
        monthName: m.monthName.slice(0, 4), // e.g. "ม.ค.", "ก.พ."
        income: m.incomeTotal.format(),
        expense: m.expenseTotal.format(),
        net: m.net.format(),
        isPositive: m.net.isPositive(),
        incomeSatang: m.incomeTotal.toSatang(),
        expenseSatang: m.expenseTotal.toSatang(),
        isPartial: m.status === "historical_partial",
      }));

      return {
        pendingApprovalsCount: pendingCount,
        totalFundsBalance: totalFunds.format(),
        monthlyIncome: calculatedIncome.format(),
        monthlyExpense: calculatedExpense.format(),
        activeAccountsCount: accountsCount || 0,
        funds,
        recentTransactions,
        historicalTrend,
        loadFailed: false,
      };
    } catch {
      return {
        pendingApprovalsCount: 0,
        totalFundsBalance: "฿0.00",
        monthlyIncome: "฿0.00",
        monthlyExpense: "฿0.00",
        activeAccountsCount: 0,
        funds: [],
        recentTransactions: [],
        loadFailed: true,
        errorMessage: "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง",
      };
    }
  }

  public renderHtml(data: DashboardData): string {
    const hasPending = data.pendingApprovalsCount > 0;
    const funds = data.funds || [];
    const recent = data.recentTransactions || [];

    const loadFailedHtml = data.loadFailed
      ? `<div class="gl-notice gl-notice--error" role="alert" style="margin-bottom: var(--space-5);">
          <div class="gl-notice__body">${data.errorMessage || "โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง"}</div>
        </div>`
      : "";

    const fundsGridHtml = funds.length === 0
      ? `<p style="font-size: var(--text-sm); color: var(--muted-foreground); margin: 0;">ยังไม่มีกองทุน</p>`
      : `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-3);">
          ${funds
            .map(
              (f) => `
              <div class="gl-card gl-card--tight gl-fund-card">
                <div style="font-size: var(--text-xs); color: var(--muted-foreground); font-weight: var(--weight-medium);">${f.name}</div>
                <div class="num-display" style="font-size: var(--text-lg); font-weight: var(--weight-bold); margin-top: 4px; color: ${
                  f.balance.isNegative() ? "var(--expense)" : "var(--foreground)"
                };">${f.balance.format()}</div>
              </div>`
            )
            .join("")}
        </div>`;

    const recentHtml = recent.length === 0
      ? `<p style="font-size: var(--text-sm); color: var(--muted-foreground); margin: 0;">ยังไม่มีรายการล่าสุด</p>`
      : `
        <div class="gl-card" style="padding: 2px var(--space-4);">
          ${recent
            .map((item, idx) => {
              const isIncome = item.direction === "income";
              const isExpense = item.direction === "expense";
              const iconSvg = isIncome ? ICON_INCOME : isExpense ? ICON_EXPENSE : ICON_TRANSFER;
              const bgVar = isIncome ? "var(--income-muted)" : isExpense ? "var(--expense-muted)" : "var(--secondary)";
              const colorVar = isIncome ? "var(--income)" : isExpense ? "var(--expense)" : "var(--muted-foreground)";
              const amountPrefix = isIncome ? "+" : isExpense ? "−" : "";
              const borderBottom = idx < recent.length - 1 ? `border-bottom: 1px solid var(--border);` : "";

              return `
              <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) 0; min-height: 48px; ${borderBottom}">
                <div aria-hidden="true" style="
                  width: 36px;
                  height: 36px;
                  border-radius: 11px;
                  background: ${bgVar};
                  color: ${colorVar};
                  display: grid;
                  place-items: center;
                  flex-shrink: 0;
                ">${iconSvg}</div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: var(--text-sm); font-weight: var(--weight-medium); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${item.title}
                  </div>
                  <div style="font-size: var(--text-2xs); color: var(--muted-foreground); margin-top: 2px;">
                    ${item.subtitle}
                  </div>
                </div>
                <div style="text-align: right; flex-shrink: 0;">
                  <div class="num-display" style="font-size: var(--text-sm); font-weight: var(--weight-bold); color: ${
                    isIncome ? "var(--income)" : isExpense ? "var(--expense)" : "var(--foreground)"
                  };">${amountPrefix}${item.amount.format()}</div>
                  <span class="gl-badge gl-badge--${item.status}" style="font-size: 10px; padding: 0 6px; margin-top: 2px;">
                    ${item.status === "approved" ? "อนุมัติแล้ว" : item.status === "rejected" ? "ไม่อนุมัติ" : "รอตรวจสอบ"}
                  </span>
                </div>
              </div>`;
            })
            .join("")}
        </div>`;

    return `
    <style>
      .gl-quick-action { transition: transform var(--duration-micro) var(--ease-out), box-shadow var(--duration-micro) var(--ease-out), background-color var(--duration-micro) var(--ease-out); }
      .gl-quick-action:hover { transform: translateY(-2px); }
      .gl-quick-action:active { transform: translateY(0) scale(0.98); }
      .gl-quick-action--primary:hover { box-shadow: 0 10px 24px -10px color-mix(in srgb, var(--primary) 55%, transparent); }
      .gl-quick-action--muted:hover { background: var(--accent); border-color: var(--primary); }
      .gl-fund-card { transition: transform var(--duration-micro) var(--ease-out), border-color var(--duration-micro) var(--ease-out); }
      .gl-fund-card:hover { transform: translateY(-2px); border-color: var(--primary); }
      .gl-row-link { transition: background-color var(--duration-micro) var(--ease-out); }
      .gl-row-link:hover { background: var(--accent); }
    </style>
    <div class="gl-page gl-dashboard-container gl-fade-in">
      ${loadFailedHtml}

      <!-- HERO BALANCE CARD (Mockup 01) -->
      <section class="gl-section" style="margin-bottom: var(--space-5);">
        <div class="gl-card gl-card--elevated" style="padding: var(--space-5);">
          <div class="kicker" style="margin: 0;">ยอดเงินคงเหลือทั้งหมด</div>
          <div class="num-display" data-testid="total-balance" style="
            margin: var(--space-2) 0 0;
            font-size: var(--text-5xl);
            font-weight: var(--weight-bold);
            letter-spacing: var(--tracking-heading);
            line-height: 1.1;
          ">${data.totalFundsBalance || "฿0.00"}</div>
          <div style="margin-top: 6px; font-size: var(--text-xs); color: var(--muted-foreground);">
            ${funds.length} กองทุน · ${data.activeAccountsCount || 0} บัญชีธนาคาร + เงินสดในมือ
          </div>
          
          <div style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: var(--space-3);
            margin-top: var(--space-4);
            padding-top: var(--space-4);
            border-top: 1px solid var(--border);
          ">
            <div>
              <div style="font-size: var(--text-xs); color: var(--muted-foreground);">รายรับเดือนนี้</div>
              <div class="num-display" style="font-size: var(--text-md); font-weight: var(--weight-bold); color: var(--income); margin-top: 2px;">
                +${data.monthlyIncome || "฿0.00"}
              </div>
            </div>
            <div>
              <div style="font-size: var(--text-xs); color: var(--muted-foreground);">รายจ่ายเดือนนี้</div>
              <div class="num-display" style="font-size: var(--text-md); font-weight: var(--weight-bold); color: var(--expense); margin-top: 2px;">
                −${data.monthlyExpense || "฿0.00"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- QUICK ACTION GRID (Mockup 01: 4 Quick Actions) -->
      <section class="gl-section" style="margin-bottom: var(--space-6);">
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2);">
          <a href="#/offerings/new" class="gl-quick-action gl-quick-action--primary" style="
            background: var(--primary);
            color: var(--primary-foreground);
            border-radius: var(--radius-lg);
            padding: 12px 6px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            min-height: 76px;
            justify-content: center;
            text-decoration: none;
            box-shadow: var(--shadow-sm);
          ">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            <span style="font-size: 11.5px; font-weight: 600; text-align: center; line-height: 1.2;">บันทึก<br>เงินถวาย</span>
          </a>

          <a href="#/transactions" class="gl-quick-action gl-quick-action--muted" style="
            background: var(--card);
            border: 1px solid var(--border);
            color: var(--foreground);
            border-radius: var(--radius-lg);
            padding: 12px 6px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            min-height: 76px;
            justify-content: center;
            text-decoration: none;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5"/></svg>
            <span style="font-size: 11.5px; font-weight: 500; text-align: center; line-height: 1.2;">บันทึก<br>รายจ่าย</span>
          </a>

          <a href="#/funds" class="gl-quick-action gl-quick-action--muted" style="
            background: var(--card);
            border: 1px solid var(--border);
            color: var(--foreground);
            border-radius: var(--radius-lg);
            padding: 12px 6px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            min-height: 76px;
            justify-content: center;
            text-decoration: none;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 9h13l-3-3M20 15H7l3 3"/></svg>
            <span style="font-size: 11.5px; font-weight: 500; text-align: center; line-height: 1.2;">โอนเงิน<br>กองทุน</span>
          </a>

          <a href="#/transactions" class="gl-quick-action gl-quick-action--muted" style="
            background: var(--card);
            border: 1px solid var(--border);
            color: var(--foreground);
            border-radius: var(--radius-lg);
            padding: 12px 6px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            min-height: 76px;
            justify-content: center;
            text-decoration: none;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
            <span style="font-size: 11.5px; font-weight: 500; text-align: center; line-height: 1.2;">รายการ<br>ทั้งหมด</span>
          </a>
        </div>
      </section>

      <!-- ATTENTION QUEUE (Mockup 01: ต้องการให้คุณตรวจสอบ) -->
      <section class="gl-section" style="margin-bottom: var(--space-6);">
        <div class="gl-section__head">
          <h2>ต้องการให้คุณตรวจสอบ</h2>
          <span class="num-display" style="font-size: var(--text-xs); font-weight: var(--weight-semibold); color: ${
            hasPending ? "var(--primary)" : "var(--muted-foreground)"
          };">${data.pendingApprovalsCount} เรื่อง</span>
        </div>

        <div class="gl-card" style="padding: 0; overflow: hidden;">
          <a href="#/approvals" class="gl-row-link" style="
            display: flex;
            align-items: center;
            gap: var(--space-3);
            padding: var(--space-3) var(--space-4);
            min-height: 48px;
            text-decoration: none;
            color: inherit;
          ">
            <div aria-hidden="true" style="
              width: 36px;
              height: 36px;
              border-radius: 11px;
              background: ${hasPending ? "var(--pending-muted)" : "var(--secondary)"};
              color: ${hasPending ? "var(--on-pending-muted)" : "var(--muted-foreground)"};
              display: grid;
              place-items: center;
              flex-shrink: 0;
            ">${ICON_CLOCK}</div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: var(--text-sm); font-weight: var(--weight-semibold);">
                ${hasPending ? `${data.pendingApprovalsCount} รายการรออนุมัติจากคุณ` : "ไม่มีรายการค้างอนุมัติ"}
              </div>
              <div class="num-display" style="font-size: var(--text-2xs); color: var(--muted-foreground); margin-top: 2px;">
                ${hasPending ? "คำขอเบิกจ่ายที่รอการพิจารณา" : "ตรวจทานครบถ้วนทุกรายการแล้ว"}
              </div>
            </div>
            ${ICON_ARROW}
          </a>

          <div style="height: 1px; background: var(--border);"></div>

          <a href="#/offerings" class="gl-row-link" style="
            display: flex;
            align-items: center;
            gap: var(--space-3);
            padding: var(--space-3) var(--space-4);
            min-height: 48px;
            text-decoration: none;
            color: inherit;
          ">
            <div aria-hidden="true" style="
              width: 36px;
              height: 36px;
              border-radius: 11px;
              background: var(--income-muted);
              color: var(--income);
              display: grid;
              place-items: center;
              flex-shrink: 0;
            ">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="7" width="18" height="11" rx="2.5"/><circle cx="12" cy="12.5" r="2.2"/></svg>
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: var(--text-sm); font-weight: var(--weight-semibold);">นับเงินถวายวันอาทิตย์</div>
              <div style="font-size: var(--text-2xs); color: var(--muted-foreground); margin-top: 2px;">รอบสัปดาห์ล่าสุด · ตรวจสอบยอดสดและโอน</div>
            </div>
            ${ICON_ARROW}
          </a>
        </div>
      </section>

      <!-- FUNDS SUMMARY (Mockup 01: กองทุน) -->
      <section class="gl-section" style="margin-bottom: var(--space-6);">
        <div class="gl-section__head">
          <h2>กองทุนหลัก</h2>
          <a href="#/funds" style="font-size: var(--text-xs); color: var(--primary); font-weight: var(--weight-semibold); text-decoration: none;">ดูทั้งหมด</a>
        </div>
        ${fundsGridHtml}
      </section>

      <!-- HISTORICAL PERFORMANCE PREVIEW (Jan–Jul 2569) -->
      ${
        data.historicalTrend && data.historicalTrend.length > 0
          ? `
      <section class="gl-section" style="margin-bottom: var(--space-6);">
        <div class="gl-section__head">
          <div>
            <h2 style="display: inline-block; margin-right: 8px;">สถิติการเงินย้อนหลัง 2569</h2>
            <span class="gl-badge gl-badge--pending" style="font-size: 10px;">ม.ค. – ก.ค. (ก่อนเริ่มระบบ)</span>
          </div>
          <a href="#/reports" style="font-size: var(--text-xs); color: var(--primary); font-weight: var(--weight-semibold); text-decoration: none;">ดูรายงานเต็ม</a>
        </div>
        <div class="gl-card" style="padding: var(--space-4);">
          <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; align-items: flex-end; min-height: 110px; padding-top: 10px;">
            ${data.historicalTrend
              .map((t) => {
                const maxVal = 5000000; // 50,000 THB in satang max scale
                const incHeight = Math.max(12, Math.min(80, Math.round((t.incomeSatang / maxVal) * 80)));
                const expHeight = Math.max(12, Math.min(80, Math.round((t.expenseSatang / maxVal) * 80)));

                return `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                  <div style="display: flex; align-items: flex-end; gap: 3px; height: 80px; width: 100%; justify-content: center;">
                    <div title="รายรับ: ${t.income}" style="width: 10px; height: ${incHeight}px; background: var(--income); border-radius: 2px 2px 0 0;"></div>
                    <div title="รายจ่าย: ${t.expense}" style="width: 10px; height: ${expHeight}px; background: var(--expense); border-radius: 2px 2px 0 0; opacity: 0.85;"></div>
                  </div>
                  <span style="font-size: 10px; font-weight: var(--weight-semibold); color: var(--foreground);">${t.monthName}</span>
                  <span style="font-size: 9px; font-weight: var(--weight-bold); color: ${t.isPositive ? "var(--income)" : "var(--expense)"};">
                    ${t.net}
                  </span>
                </div>`;
              })
              .join("")}
          </div>
          <div style="display: flex; justify-content: center; gap: var(--space-4); margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--border); font-size: 11px; color: var(--muted-foreground);">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="display: inline-block; width: 8px; height: 8px; background: var(--income); border-radius: 2px;"></span>
              <span>รายรับ</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="display: inline-block; width: 8px; height: 8px; background: var(--expense); border-radius: 2px;"></span>
              <span>รายจ่าย</span>
            </div>
            <span style="color: var(--muted-foreground);">· ข้อมูลสรุปย้อนหลัง</span>
          </div>
        </div>
      </section>`
          : ""
      }

      <!-- RECENT ACTIVITY (Mockup 01: ความเคลื่อนไหวล่าสุด) -->
      <section class="gl-section" style="margin-bottom: var(--space-8);">
        <div class="gl-section__head">
          <h2>ความเคลื่อนไหวล่าสุด</h2>
          <a href="#/transactions" style="font-size: var(--text-xs); color: var(--primary); font-weight: var(--weight-semibold); text-decoration: none;">ดูทั้งหมด</a>
        </div>
        ${recentHtml}
      </section>
    </div>
    `;
  }
}
