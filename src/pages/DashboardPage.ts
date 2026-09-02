import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../lib/supabase/types";
import { ApprovalsService } from "../lib/transactions/approvals-service";
import { HistoricalService } from "../lib/reports/historical-service";
import { ReportsService } from "../lib/reports/reports-service";
import { Money } from "../lib/money";
import { escapeHtml, formatDateThai } from "../lib/format";
import { monthBounds } from "../lib/period";
import type { AppShellUser } from "../components/layout/AppShell";

export interface DashboardFund {
  id?: string;
  name: string;
  balance: Money;
  /** Budget target when the fund has one. Null means the fund is untargeted. */
  targetAmount?: Money | null;
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
  user?: AppShellUser;
}

const ICON_CLOCK = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
const ICON_ARROW = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7"/></svg>`;
const ICON_INCOME = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 19V5M6 11l6-6 6 6"/></svg>`;
const ICON_EXPENSE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 5v14M6 13l6 6 6-6"/></svg>`;
const ICON_TRANSFER = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 9h13l-3-3M20 15H7l3 3"/></svg>`;
const ICON_PLUS = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg>`;
const ICON_RECEIPT = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5"/></svg>`;
const ICON_LIST = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 6h16M4 12h16M4 18h10"/></svg>`;
const ICON_OFFERING = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><rect x="3" y="7" width="18" height="11" rx="2.5"/><circle cx="12" cy="12.5" r="2.2"/></svg>`;

export class DashboardPage {
  private approvalsService: ApprovalsService;
  private historicalService: HistoricalService;
  private reportsService: ReportsService;

  constructor(private supabase: SupabaseClient<Database>) {
    this.approvalsService = new ApprovalsService(supabase);
    this.historicalService = new HistoricalService(supabase);
    this.reportsService = new ReportsService(supabase);
  }

  public async loadData(churchId: string): Promise<DashboardData> {
    try {
      const pendingRes =
        await this.approvalsService.getPendingApprovals(churchId);
      const pendingCount =
        pendingRes.success && pendingRes.data ? pendingRes.data.length : 0;

      const { data: fundsData, error: fundsError } = await (
        this.supabase.from("funds") as any
      )
        .select("id, name, current_balance, target_amount")
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
          const balance = f.current_balance
            ? Money.from(f.current_balance as string)
            : Money.zero();
          totalFunds = totalFunds.add(balance);
          const target =
            f.target_amount !== null && f.target_amount !== undefined
              ? Money.from(f.target_amount as string)
              : null;
          funds.push({
            id: f.id,
            name: (f.name as string) || "กองทุน",
            balance,
            targetAmount: target,
          });
        }
      }

      const { count: accountsCount } = await this.supabase
        .from("accounts")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .eq("is_active", true);

      // Query recent transactions from Supabase
      const { data: txnsData, error: txnsError } = await (
        this.supabase.from("transactions") as any
      )
        .select(
          `
          id,
          description,
          amount,
          direction,
          transaction_date,
          status,
          created_at
        `,
        )
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

      // The month's income and expense come from the posted ledger for the
      // current calendar month, through the same service that produces the
      // Reports screen.
      const bounds = monthBounds(new Date());
      const stmtRes = await this.reportsService.getStatementOfFinancialPosition(
        churchId,
        bounds.start,
        bounds.end,
      );
      const monthlyIncome =
        stmtRes.success && stmtRes.data
          ? stmtRes.data.total_income
          : Money.zero();
      const monthlyExpense =
        stmtRes.success && stmtRes.data
          ? stmtRes.data.total_expense
          : Money.zero();

      const recentTransactions: RecentTransaction[] = [];

      if (txnsData && Array.isArray(txnsData) && txnsData.length > 0) {
        for (const t of txnsData) {
          const amount = t.amount
            ? Money.from(t.amount as string)
            : Money.zero();

          const direction: "income" | "expense" | "transfer" =
            t.direction === "income" ||
            t.direction === "expense" ||
            t.direction === "transfer"
              ? t.direction
              : "transfer";

          const formattedDate = t.transaction_date
            ? formatDateThai(t.transaction_date)
            : "วันนี้";

          recentTransactions.push({
            id: t.id,
            title: t.description || "รายการทั่วไป",
            subtitle: formattedDate,
            amount,
            direction,
            date: formattedDate,
            status:
              t.status === "approved"
                ? "approved"
                : t.status === "rejected"
                  ? "rejected"
                  : "pending",
          });
        }
      }

      // Query historical monthly summaries for dashboard trend preview
      const currentBeYear = new Date().getFullYear() + 543;
      const histRes = await this.historicalService.getMonthlySummaries(
        churchId,
        currentBeYear,
      );
      const historicalTrend: HistoricalTrendBar[] = (
        histRes.success && histRes.data ? histRes.data : []
      ).map((m) => ({
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
        monthlyIncome: monthlyIncome.format(),
        monthlyExpense: monthlyExpense.format(),
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
        errorMessage:
          "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง",
      };
    }
  }

  /**
   * Bar height in pixels for one trend value.
   */
  private static trendBarHeight(
    satang: number,
    maxSatang: number,
    trackPx: number,
  ): number {
    if (maxSatang <= 0 || satang <= 0) return 0;
    return Math.max(3, Math.round((satang / maxSatang) * trackPx));
  }

  public renderHtml(data: DashboardData, user?: AppShellUser): string {
    const activeUser = user || data.user;
    const hasPending = data.pendingApprovalsCount > 0;
    const funds = data.funds || [];
    const recent = data.recentTransactions || [];
    const trend = data.historicalTrend || [];

    // Period the figures describe
    const period = new Date().toLocaleDateString("th-TH", {
      month: "short",
      year: "numeric",
    });

    // Compute Net Change for 3-column metric display with Decimal precision
    const parseMoneySafe = (val?: string): Money => {
      if (!val) return Money.zero();
      const clean = val.replace(/[^\d.-]/g, "");
      return clean ? Money.from(clean) : Money.zero();
    };

    const incomeMoney = parseMoneySafe(data.monthlyIncome);
    const expenseMoney = parseMoneySafe(data.monthlyExpense);
    const netMoney = incomeMoney.subtract(expenseMoney);
    const netIsPositive = netMoney.isPositive();
    const netColor = netIsPositive
      ? "var(--income)"
      : netMoney.isNegative()
        ? "var(--expense)"
        : "var(--foreground)";

    const loadFailedHtml = data.loadFailed
      ? `<div class="gl-notice gl-notice--error" role="alert" style="margin-bottom: var(--space-5);">
          <div class="gl-notice__body">${escapeHtml(data.errorMessage || "โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง")}</div>
        </div>`
      : "";

    // 1. User & Church Header Identity (Mobile-first Profile Centric Card)
    const userCardHtml = activeUser
      ? `
      <div class="gl-card gl-dash-user-card">
        <a href="#/profile" class="gl-dash-user-card__avatar-link" aria-label="ดูโปรไฟล์ ${escapeHtml(activeUser.name)}">
          <span class="gl-dash-user-card__avatar">${escapeHtml(activeUser.initials || "?")}</span>
        </a>
        <div class="gl-dash-user-card__body">
          <div class="gl-dash-user-card__idrow">
            <span class="gl-dash-user-card__name">${escapeHtml(activeUser.name)}</span>
            ${
              activeUser.role
                ? `<span class="gl-dash-user-card__role">${escapeHtml(activeUser.role)}</span>`
                : ""
            }
          </div>
          <div class="gl-dash-user-card__church">${escapeHtml(activeUser.churchName || "คริสตจักร")}</div>
        </div>
      </div>
      `
      : "";

    // 2. Funds List
    const fundsHtml =
      funds.length === 0
        ? `<p style="font-size: var(--text-sm); color: var(--muted-foreground); margin: 0;">
             ยังไม่มีกองทุน เริ่มจากสร้างกองทุนแรกเพื่อแยกเงินตามวัตถุประสงค์
           </p>`
        : `<div class="gl-fundlist">
            ${funds
              .map((f) => {
                const target = f.targetAmount || null;
                const hasTarget = target !== null && target.isPositive();
                const pct = hasTarget
                  ? Math.min(
                      100,
                      Math.max(
                        0,
                        Math.round(
                          (f.balance.toNumber() / target.toNumber()) * 100,
                        ),
                      ),
                    )
                  : null;
                const balanceColor = f.balance.isNegative()
                  ? "var(--expense)"
                  : "var(--foreground)";

                return `
                <div>
                  <div class="gl-fundrow__head">
                    <span class="gl-fundrow__name">${escapeHtml(f.name)}</span>
                    <span class="num-display" style="font-size: var(--text-md); font-weight: var(--weight-bold); color: ${balanceColor};">${f.balance.format()}</span>
                  </div>
                  ${
                    hasTarget
                      ? `<div class="gl-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="ความคืบหน้าของ ${escapeHtml(f.name)}">
                          <div class="gl-progress__fill" style="width: ${pct}%;"></div>
                        </div>
                        <div class="gl-fundrow__foot">
                          <span>เป้าหมาย <span class="num-display">${target.format()}</span></span>
                          <span class="num-display">${pct}%</span>
                        </div>`
                      : `<div class="gl-fundrow__foot"><span>ยังไม่ได้ตั้งเป้าหมายกองทุนนี้</span></div>`
                  }
                </div>`;
              })
              .join("")}
          </div>`;

    // 3. Recent Transactions Feed
    const recentHtml =
      recent.length === 0
        ? `<p style="font-size: var(--text-sm); color: var(--muted-foreground); margin: 0;">
             ยังไม่มีรายการล่าสุด รายการที่บันทึกจะแสดงที่นี่
           </p>`
        : `<div class="gl-card" style="padding: 0; overflow: hidden;">
            ${recent
              .map((item) => {
                const isIncome = item.direction === "income";
                const isExpense = item.direction === "expense";
                const iconSvg = isIncome
                  ? ICON_INCOME
                  : isExpense
                    ? ICON_EXPENSE
                    : ICON_TRANSFER;
                const iconClass = isIncome
                  ? "gl-row__icon--income"
                  : isExpense
                    ? "gl-row__icon--expense"
                    : "gl-row__icon--transfer";
                const amountColor = isIncome
                  ? "var(--income)"
                  : isExpense
                    ? "var(--expense)"
                    : "var(--foreground)";
                const sign = isIncome ? "+" : isExpense ? "−" : "";
                const statusLabel =
                  item.status === "approved"
                    ? "อนุมัติแล้ว"
                    : item.status === "rejected"
                      ? "ไม่อนุมัติ"
                      : "รอตรวจสอบ";

                return `
                <a href="#/transactions" class="gl-row">
                  <span class="gl-row__icon ${iconClass}" aria-hidden="true">${iconSvg}</span>
                  <span class="gl-row__body">
                    <span class="gl-row__title" style="display: block;">${escapeHtml(item.title)}</span>
                    <span class="gl-row__meta" style="display: block;">${escapeHtml(item.subtitle)}</span>
                  </span>
                  <span class="gl-row__end">
                    <span class="num-display" style="display: block; font-size: var(--text-sm); font-weight: var(--weight-bold); color: ${amountColor};">${sign}${item.amount.format()}</span>
                    <span class="gl-badge gl-badge--${item.status}" style="font-size: var(--text-2xs); margin-top: 4px;">${statusLabel}</span>
                  </span>
                </a>`;
              })
              .join("")}
          </div>`;

    // 4. Trend Chart
    const trendMaxSatang = trend.reduce(
      (max, t) => Math.max(max, t.incomeSatang, t.expenseSatang),
      0,
    );

    const trendHtml =
      trend.length === 0
        ? ""
        : `
      <section class="gl-section">
        <div class="gl-section__head">
          <h2>รายรับและรายจ่ายรายเดือน</h2>
          <a href="#/reports" class="gl-section__link">ดูรายงานเต็ม</a>
        </div>
        <p style="font-size: var(--text-sm); color: var(--muted-foreground); margin: 0 0 var(--space-4);">
          เดือนที่แท่งสีแดงสูงกว่าสีเขียว คือเดือนที่จ่ายมากกว่ารับ
        </p>
        <div class="gl-card">
          <div class="gl-trend">
            ${trend
              .map((t, i) => {
                const incH = DashboardPage.trendBarHeight(
                  t.incomeSatang,
                  trendMaxSatang,
                  96,
                );
                const expH = DashboardPage.trendBarHeight(
                  t.expenseSatang,
                  trendMaxSatang,
                  96,
                );
                const delay = Math.min(i, 11) * 40;
                return `
                <div class="gl-trend__col" style="--gl-bar-delay: ${delay}ms;">
                  <span class="gl-trend__bars" aria-hidden="true">
                    <span class="gl-trend__bar gl-trend__bar--income" style="height: ${incH}px;"></span>
                    <span class="gl-trend__bar gl-trend__bar--expense" style="height: ${expH}px;"></span>
                  </span>
                  <span class="gl-trend__label">${escapeHtml(t.monthName)}</span>
                  <span class="gl-trend__net num-display" style="font-size: var(--text-2xs); font-weight: var(--weight-bold); color: ${
                    t.isPositive ? "var(--income)" : "var(--expense)"
                  };">${t.net}</span>
                  <span class="gl-visually-hidden">${escapeHtml(t.monthName)} รายรับ ${escapeHtml(t.income)} รายจ่าย ${escapeHtml(t.expense)} คงเหลือ ${escapeHtml(t.net)}</span>
                </div>`;
              })
              .join("")}
          </div>
          <hr class="gl-divider">
          <div class="gl-legend">
            <span class="gl-legend__item">
              <span class="gl-legend__swatch" aria-hidden="true" style="background: var(--income);"></span>
              <span>รายรับ</span>
            </span>
            <span class="gl-legend__item">
              <span class="gl-legend__swatch" aria-hidden="true" style="background: var(--expense);"></span>
              <span>รายจ่าย</span>
            </span>
          </div>
        </div>
      </section>`;

    return `
    <div class="gl-page gl-dashboard-container gl-fade-in">
      ${loadFailedHtml}

      ${userCardHtml}

      <div class="gl-page-header">
        <h1>ภาพรวมการเงิน</h1>
        <p>ข้อมูล ณ ${period}</p>
      </div>

      <!-- Financial position + what needs review. The balance card is the
           operational core; review sits beside it as real content. -->
      <section class="gl-section">
        <h2 class="gl-visually-hidden">สรุปยอดและรายการที่ต้องตรวจสอบ</h2>
        <div class="gl-dash-hero-row">
          <div class="gl-card gl-dash-hero gl-rise">
            <div class="kicker" style="margin: 0;">ยอดเงินคงเหลือทั้งหมด</div>
            <div class="num-display gl-dash-hero__value gl-total-rule" data-testid="total-balance">${data.totalFundsBalance || "฿0.00"}</div>
            <div class="gl-dash-hero__foot">${funds.length} กองทุน · ${data.activeAccountsCount || 0} บัญชีธนาคาร + เงินสดในมือ</div>

            <div class="gl-dash-hero__figures">
              <span class="gl-dash-hero__figure">รายรับเดือนนี้<strong class="num-display" style="color: var(--income);">+${data.monthlyIncome || "฿0.00"}</strong></span>
              <span class="gl-dash-hero__figure">รายจ่ายเดือนนี้<strong class="num-display" style="color: var(--expense);">−${data.monthlyExpense || "฿0.00"}</strong></span>
              <span class="gl-dash-hero__figure">ส่วนต่างสุทธิ<strong class="num-display" style="color: ${netColor};">${netIsPositive ? `+${netMoney.format()}` : netMoney.format()}</strong></span>
            </div>

            <div class="gl-dash-hero__actions">
              <a href="#/offerings/new" class="gl-btn gl-btn--primary">
                ${ICON_PLUS}
                <span>บันทึกเงินถวาย</span>
              </a>
              <a href="#/transactions" class="gl-icon-btn" aria-label="บันทึกรายจ่าย" title="บันทึกรายจ่าย">${ICON_RECEIPT}</a>
              <a href="#/funds" class="gl-icon-btn" aria-label="โอนเงินกองทุน" title="โอนเงินกองทุน">${ICON_TRANSFER}</a>
              <a href="#/transactions" class="gl-icon-btn" aria-label="รายการทั้งหมด" title="รายการทั้งหมด">${ICON_LIST}</a>
            </div>
          </div>

          <!-- Action Alert Section / Attention Queue -->
          <div class="gl-card gl-dash-review gl-rise" style="--gl-rise-delay: 60ms;">
            <div class="gl-dash-review__head">
              <h2>ต้องการให้คุณตรวจสอบ</h2>
              <span class="num-display" style="font-size: var(--text-xs); font-weight: var(--weight-semibold); color: ${
                hasPending ? "var(--pending)" : "var(--muted-foreground)"
              };">${data.pendingApprovalsCount} เรื่อง</span>
            </div>

            <a href="#/approvals" class="gl-row${hasPending ? " gl-dash-review__row--attention" : ""}">
              <span class="gl-row__icon${hasPending ? " gl-row__icon--attention" : ""}" aria-hidden="true">${ICON_CLOCK}</span>
              <span class="gl-row__body">
                <span class="gl-row__title" style="display: block;">
                  ${hasPending ? `${data.pendingApprovalsCount} รายการรออนุมัติจากคุณ` : "ไม่มีรายการค้างอนุมัติ"}
                </span>
                <span class="gl-row__meta" style="display: block;">
                  ${hasPending ? "คำขอเบิกจ่ายที่รอการพิจารณา" : "ตรวจทานครบถ้วนทุกรายการแล้ว"}
                </span>
              </span>
              <span class="gl-row__chevron" aria-hidden="true">${ICON_ARROW}</span>
            </a>

            <a href="#/offerings" class="gl-row">
              <span class="gl-row__icon gl-row__icon--attention" aria-hidden="true">${ICON_OFFERING}</span>
              <span class="gl-row__body">
                <span class="gl-row__title" style="display: block;">เงินถวายวันอาทิตย์</span>
                <span class="gl-row__meta" style="display: block;">เปิดรอบนับเงินและตรวจยอด</span>
              </span>
              <span class="gl-row__chevron" aria-hidden="true">${ICON_ARROW}</span>
            </a>
          </div>
        </div>
      </section>

      ${trendHtml}

      <div class="gl-dash-split">
        <div>
          <section class="gl-section">
            <div class="gl-section__head">
              <h2>ความเคลื่อนไหวล่าสุด</h2>
              <a href="#/transactions" class="gl-section__link">ดูทั้งหมด</a>
            </div>
            ${recentHtml}
          </section>
        </div>

        <div>
          <section class="gl-section">
            <div class="gl-section__head">
              <h2>กองทุนและเป้าหมาย</h2>
              <a href="#/funds" class="gl-section__link">ดูทั้งหมด</a>
            </div>
            <div class="gl-card">
              ${fundsHtml}
            </div>
          </section>
        </div>
      </div>
    </div>
    `;
  }
}
