import { SupabaseClient } from "@supabase/supabase-js";
import { renderEmptyStateHtml } from "../components/shared/EmptyState";
import { Database } from "../lib/supabase/types";
import { ApprovalsService } from "../lib/transactions/approvals-service";
import { HistoricalService } from "../lib/reports/historical-service";
import { ReportsService } from "../lib/reports/reports-service";
import { Money } from "../lib/money";
import { escapeHtml, formatDateThai } from "../lib/format";
import { monthBounds } from "../lib/period";
import { can, toUserRole, type UserRole } from "../lib/rbac";
import type { AppShellUser } from "../components/layout/AppShell";
import type { AttentionSummary } from "../services/attention-service";

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
const ICON_DOC = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>`;
const ICON_CHECK = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M20 6L9 17l-5-5"/></svg>`;
const ICON_TREND_UP = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 19V5M6 11l6-6 6 6"/></svg>`;
const ICON_TREND_DOWN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 5v14M6 13l6 6 6-6"/></svg>`;

export class DashboardPage {
  private approvalsService: ApprovalsService;
  private historicalService: HistoricalService;
  private reportsService: ReportsService;

  constructor(private supabase: SupabaseClient<Database>) {
    this.approvalsService = new ApprovalsService(supabase);
    this.historicalService = new HistoricalService(supabase);
    this.reportsService = new ReportsService(supabase);
  }

  /**
   * @param attention optional preloaded pending-work summary (from
   * AttentionService) — when provided, the approvals query is skipped and the
   * count comes from the shared aggregation, so the shell badge and this page
   * always agree.
   */
  public async loadData(churchId: string, attention?: AttentionSummary): Promise<DashboardData> {
    try {
      const approvalsGroup = attention?.groups.find((g) => g.key === "approvals");
      const pendingCount = approvalsGroup
        ? approvalsGroup.count
        : await (async () => {
            const pendingRes = await this.approvalsService.getPendingApprovals(churchId);
            return pendingRes.success && pendingRes.data ? pendingRes.data.length : 0;
          })();

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

  /**
   * @param attention optional shared pending-work summary (null = loading).
   * When omitted, the section falls back to the legacy pending-approvals
   * count so lightweight callers still render a meaningful section.
   */
  public renderHtml(
    data: DashboardData,
    user?: AppShellUser,
    attention?: AttentionSummary | null,
  ): string {
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

    const loadFailedHtml = data.loadFailed
      ? `<div class="gl-notice gl-notice--error" role="alert">
          <div class="gl-notice__body">${escapeHtml(data.errorMessage || "โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง")}</div>
        </div>`
      : "";

    // 1. "งานสัปดาห์นี้" — the user's pending work, aggregated from the same
    // AttentionService the shell bell uses. Group-level rows answer WHAT,
    // WHY, and WHERE in one line; items live one click behind each row.
    const userRole: UserRole = toUserRole(activeUser?.role);

    const ATTENTION_ROW_ICONS: Record<string, string> = {
      approvals: ICON_CLOCK,
      offerings: ICON_OFFERING,
      drafts: ICON_DOC,
    };

    const renderAttentionRow = (
      key: string,
      title: string,
      meta: string,
      href: string,
      requiresAction: boolean,
    ): string => `
      <a href="${href}" class="gl-attention-row${requiresAction ? " gl-attention-row--attention" : ""}">
        <span class="gl-attention-row__icon${requiresAction ? " gl-attention-row__icon--attention" : ""}" aria-hidden="true">${ATTENTION_ROW_ICONS[key] ?? ICON_LIST}</span>
        <span class="gl-attention-row__body">
          <span class="gl-attention-row__title">${escapeHtml(title)}</span>
          <span class="gl-attention-row__meta">${escapeHtml(meta)}</span>
        </span>
        <span class="gl-attention-row__chevron" aria-hidden="true">${ICON_ARROW}</span>
      </a>`;

    let attentionBodyHtml: string;
    if (attention === undefined) {
      // Fallback for callers/tests without a loaded summary: derive the one
      // group this page has always known about from pendingApprovalsCount.
      attentionBodyHtml =
        hasPending
          ? renderAttentionRow(
              "approvals",
              `คิวอนุมัติรอพิจารณา · ${data.pendingApprovalsCount} รายการ`,
              "คำขอเบิกจ่ายรอการตรวจสอบ",
              "#/approvals",
              true,
            )
          : `<div class="gl-attention-empty" role="status">
              <span class="gl-attention-empty__icon" aria-hidden="true">${ICON_CHECK}</span>
              <span>งานเป็นที่เรียบร้อย — ไม่มีสิ่งที่ต้องดำเนินการค้าง</span>
            </div>`;
    } else if (attention === null) {
      attentionBodyHtml = `
      <div class="gl-attention-loading" role="status" aria-live="polite">
        <span class="gl-skeleton" style="height: 52px; display: block;"></span>
        <span class="gl-skeleton" style="height: 52px; display: block;"></span>
      </div>`;
    } else if (attention.loadFailed && attention.totalCount === 0) {
      attentionBodyHtml = `
      <div class="gl-attention-empty" role="alert">
        <span>โหลดข้อมูลงานค้างไม่สำเร็จ</span>
        <button type="button" class="gl-btn gl-btn--secondary gl-btn--sm" id="dash-attention-retry">ลองใหม่</button>
      </div>`;
    } else if (attention.totalCount === 0) {
      const weeklyOffering = can(userRole, "create", "offering_sessions")
        ? `<a href="#/offerings/new" class="gl-btn gl-btn--primary gl-btn--sm">${ICON_PLUS}<span>บันทึกเงินถวายสัปดาห์นี้</span></a>`
        : "";
      attentionBodyHtml = `
      <div class="gl-attention-empty" role="status">
        <span class="gl-attention-empty__icon" aria-hidden="true">${ICON_CHECK}</span>
        <span>งานเป็นที่เรียบร้อย — ไม่มีสิ่งที่ต้องดำเนินการค้าง</span>
        ${weeklyOffering}
      </div>`;
    } else {
      attentionBodyHtml = attention.groups
        .filter((group) => group.count > 0)
        .map((group) =>
          renderAttentionRow(
            group.key,
            `${group.label} · ${group.count} ${group.key === "offerings" ? "รอบ" : "รายการ"}`,
            group.summary,
            group.href,
            group.requiresAction,
          ),
        )
        .join("");
    }

    // 2. Month-over-month net context, derived from the already-loaded
    // historical series — presentation math on existing figures only.
    const prevBar = trend.length >= 2 ? trend[trend.length - 2] : null;
    const prevNetMoney = prevBar ? parseMoneySafe(prevBar.net) : null;
    const netDelta = prevNetMoney ? netMoney.subtract(prevNetMoney) : null;
    const deltaIsPositive = netDelta ? netDelta.isPositive() : false;
    const deltaIsNegative = netDelta ? netDelta.isNegative() : false;
    const deltaLabel = !netDelta
      ? ""
      : deltaIsPositive
        ? `+${netDelta.format()}`
        : netDelta.format();
    const contextCardHtml = `
      <div class="gl-card gl-dash-context gl-rise" style="--gl-rise-delay: 60ms;">
        <div class="gl-dash-context__head">
          <h2>สุทธิเทียบเดือนก่อน</h2>
        </div>
        ${
          netDelta && prevBar
            ? `<div class="gl-dash-context__delta">
                <span class="gl-dash-context__direction" aria-hidden="true">${
                  deltaIsPositive ? ICON_TREND_UP : deltaIsNegative ? ICON_TREND_DOWN : ICON_TREND_UP
                }</span>
                <span class="num-display gl-dash-context__value ${deltaIsPositive ? 'gl-income' : deltaIsNegative ? 'gl-expense' : 'gl-net'}">${deltaLabel}</span>
              </div>
              <p class="gl-dash-context__note">
                ${escapeHtml(period)} สุทธิ <span class="num-display">${netIsPositive ? "+" : ""}${netMoney.format()}</span>
                · ${escapeHtml(prevBar!.monthName)} สุทธิ <span class="num-display">${prevNetMoney!.isPositive() ? "+" : ""}${prevNetMoney!.format()}</span>
              </p>`
            : `<p class="gl-dash-context__note">ยังไม่มีข้อมูลเดือนก่อนสำหรับเปรียบเทียบ — สุทธิเดือนนี้ <span class="num-display">${netIsPositive ? "+" : ""}${netMoney.format()}</span></p>`
        }
        <a href="#/reports" class="gl-dash-context__link">ดูรายงานเต็ม →</a>
      </div>`;

    // Per-figure month-over-month delta for the hero's income/expense lines —
    // net already gets its own delta in the context card above, so this only
    // covers the two figures that previously had none. Income: higher is
    // better (green/up). Expense: higher is worse (red/up) — the arrow always
    // reflects the real direction the number moved, only the color inverts.
    const prevIncomeMoney = prevBar ? parseMoneySafe(prevBar.income) : null;
    const incomeDelta = prevIncomeMoney ? incomeMoney.subtract(prevIncomeMoney) : null;
    const incomeDeltaHtml = incomeDelta
      ? `<span class="gl-dash-hero__figure-delta ${incomeDelta.isPositive() ? 'gl-income' : 'gl-expense'}">
          <span class="gl-dash-context__direction" aria-hidden="true">${incomeDelta.isPositive() ? ICON_TREND_UP : ICON_TREND_DOWN}</span>
          <span class="num-display">${incomeDelta.isPositive() ? "+" : ""}${incomeDelta.format()}</span>
        </span>`
      : "";

    const prevExpenseMoney = prevBar ? parseMoneySafe(prevBar.expense) : null;
    const expenseDelta = prevExpenseMoney ? expenseMoney.subtract(prevExpenseMoney) : null;
    const expenseDeltaIsWorse = expenseDelta ? expenseDelta.isPositive() : false;
    const expenseDeltaHtml = expenseDelta
      ? `<span class="gl-dash-hero__figure-delta ${expenseDeltaIsWorse ? 'gl-expense' : 'gl-income'}">
          <span class="gl-dash-context__direction" aria-hidden="true">${expenseDeltaIsWorse ? ICON_TREND_UP : ICON_TREND_DOWN}</span>
          <span class="num-display">${expenseDeltaIsWorse ? "+" : ""}${expenseDelta.format()}</span>
        </span>`
      : "";

    // 2. Funds List
    const fundsHtml =
      funds.length === 0
        ? renderEmptyStateHtml({
            message: "ยังไม่มีกองทุน เริ่มจากสร้างกองทุนแรกเพื่อแยกเงินตามวัตถุประสงค์",
          })
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
                return `
                <div>
                  <div class="gl-fundrow__head">
                    <span class="gl-fundrow__name">${escapeHtml(f.name)}</span>
                    <span class="num-display ${f.balance.isNegative() ? 'gl-expense' : 'gl-net'}">${f.balance.format()}</span>
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
        ? `<p class="gl-empty-center__msg">
             ยังไม่มีรายการล่าสุด รายการที่บันทึกจะแสดงที่นี่
           </p>`
        : `<div class="gl-card gl-txn-list">
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
                    <span class="gl-row__title">${escapeHtml(item.title)}</span>
                    <span class="gl-row__meta">${escapeHtml(item.subtitle)}</span>
                  </span>
                  <span class="gl-row__end">
                    <span class="num-display" style="color: ${amountColor};">${sign}${item.amount.format()}</span>
                    <span class="gl-badge gl-badge--${item.status}">${statusLabel}</span>
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
        ? `
      <section class="gl-section">
        <div class="gl-section__head">
          <h2>รายรับและรายจ่ายรายเดือน</h2>
        </div>
        ${renderEmptyStateHtml({
          message: "ยังไม่มีข้อมูลย้อนหลังสำหรับแสดงกราฟ",
          hint: "กราฟจะแสดงเมื่อมีข้อมูลอย่างน้อย 1 เดือน",
        })}
      </section>`
        : `
      <section class="gl-section">
        <div class="gl-section__head">
          <h2>รายรับและรายจ่ายรายเดือน</h2>
          <a href="#/reports" class="gl-section__link">ดูรายงานเต็ม</a>
        </div>
        <p class="gl-trend__desc">
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
                <div class="gl-trend__col" tabindex="0" style="--gl-bar-delay: ${delay}ms;">
                  <span class="gl-trend__bars" aria-hidden="true">
                    <span class="gl-trend__bar gl-trend__bar--income" style="height: ${incH}px;"></span>
                    <span class="gl-trend__bar gl-trend__bar--expense" style="height: ${expH}px;"></span>
                  </span>
                  <span class="gl-trend__label">${escapeHtml(t.monthName)}</span>
                  <span class="gl-trend__net num-display ${t.isPositive ? 'gl-income' : 'gl-expense'}">${t.net}</span>
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

    const attentionTotal = attention ? attention.totalCount : data.pendingApprovalsCount;

    // Role-gated hero quick actions — each opens the existing workflow.
    const heroActionsHtml = [
      can(userRole, "create", "offering_sessions")
        ? `<a href="#/offerings/new" class="gl-btn gl-btn--primary">
            ${ICON_PLUS}
            <span>บันทึกเงินถวาย</span>
          </a>`
        : "",
      can(userRole, "create", "transactions")
        ? `<a href="#/transactions?create=1" class="gl-icon-btn" aria-label="บันทึกรายจ่าย" title="บันทึกรายจ่าย">${ICON_RECEIPT}</a>`
        : "",
      can(userRole, "create", "fund_transfers")
        ? `<a href="#/funds" class="gl-icon-btn" aria-label="โอนเงินกองทุน" title="โอนเงินกองทุน">${ICON_TRANSFER}</a>`
        : "",
      can(userRole, "read", "transactions")
        ? `<a href="#/transactions" class="gl-icon-btn" aria-label="รายการทั้งหมด" title="รายการทั้งหมด">${ICON_LIST}</a>`
        : "",
    ]
      .filter(Boolean)
      .join("");

    const displayName = activeUser?.name || "";
    const userRoleLabel = activeUser?.role === "pastor"
      ? "ศิษยาภิบาล"
      : activeUser?.role === "treasurer"
        ? "เหรัญญิก"
        : activeUser?.role === "counter"
          ? "ผู้นับเงิน"
          : activeUser?.role === "super_admin"
            ? "ผู้ตรวจสอบบัญชี"
            : "";

    const greetingTitle = displayName
      ? `สวัสดีครับ ${escapeHtml(displayName)}${userRoleLabel ? ` · ${escapeHtml(userRoleLabel)}` : ""}`
      : "ระบบบันทึกบัญชีคริสตจักร Grace Ledger";

    const aiGreetingMessage = attentionTotal > 0
      ? `สัปดาห์นี้มีงานสำคัญ <strong>${attentionTotal} รายการ</strong> ที่รอการดำเนินการของคุณ`
      : `ระบบการเงินเป็นระเบียบเรียบร้อย ไม่มีรายการค้างที่ต้องดำเนินการ`;

    const aiGreetingHtml = `
      <div class="gl-ai-greeting" role="region" aria-label="ข้อความจาก Grace AI">
        <div class="gl-ai-greeting__content">
          <span class="gl-ai-greeting__sparkle" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          </span>
          <div>
            <div class="gl-ai-greeting__title">${greetingTitle}</div>
            <div class="gl-ai-greeting__subtitle">${aiGreetingMessage}</div>
          </div>
        </div>
        ${attentionTotal > 0 ? `<a href="#/approvals" class="gl-btn gl-btn--sm gl-btn--cta-2026 gl-ai-greeting__action">ดูงานค้าง →</a>` : ""}
      </div>`;

    return `
    <div class="gl-page gl-dashboard-container gl-fade-in">
      ${loadFailedHtml}
      ${aiGreetingHtml}

      <div class="gl-page-header">
        <h1>ภาพรวมการเงิน</h1>
        <p>${escapeHtml(activeUser?.churchName || "คริสตจักร")} · ข้อมูล ณ ${period}</p>
      </div>

      <!-- งานสัปดาห์นี้: attention → action. Aggregated from the same source
           as the shell bell, deep-linked to each workflow. -->
      <section class="gl-command-center" aria-label="งานสัปดาห์นี้">
        <div class="gl-command-center__head">
          <h2 class="gl-command-center__title">
            <span>งานสัปดาห์นี้</span>
          </h2>
          <span class="gl-badge ${attentionTotal > 0 ? "gl-badge--pending" : "gl-badge--neutral"}">
            ${attentionTotal > 0 ? `ต้องดำเนินการ ${attentionTotal} รายการ` : "ไม่มีงานค้าง"}
          </span>
        </div>
        ${attentionBodyHtml}
      </section>

      <!-- Financial health: total balance + month figures + month-over-month
           net context. The balance card is the operational core. -->
      <section class="gl-section">
        <h2 class="gl-visually-hidden">สุขภาพการเงิน</h2>
        <div class="gl-dash-hero-row">
          <div class="gl-card gl-dash-hero gl-rise">
            <div class="kicker">ยอดเงินคงเหลือทั้งหมด</div>
            <div class="num-display gl-dash-hero__value gl-total-rule" data-testid="total-balance">${data.totalFundsBalance || "฿0.00"}</div>
            <div class="gl-dash-hero__foot">${funds.length} กองทุน · ${data.activeAccountsCount || 0} บัญชีธนาคาร + เงินสดในมือ</div>

            <div class="gl-dash-hero__figures">
              <span class="gl-dash-hero__figure">รายรับเดือนนี้<strong class="num-display gl-income">+${data.monthlyIncome || "฿0.00"}</strong>${incomeDeltaHtml}</span>
              <span class="gl-dash-hero__figure">รายจ่ายเดือนนี้<strong class="num-display gl-expense">−${data.monthlyExpense || "฿0.00"}</strong>${expenseDeltaHtml}</span>
              <span class="gl-dash-hero__figure">ส่วนต่างสุทธิ<strong class="num-display ${netIsPositive ? 'gl-income' : netMoney.isNegative() ? 'gl-expense' : 'gl-net'}">${netIsPositive ? `+${netMoney.format()}` : netMoney.format()}</strong></span>
            </div>

            ${heroActionsHtml ? `<div class="gl-dash-hero__actions">${heroActionsHtml}</div>` : ""}
          </div>

          ${contextCardHtml}
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
            ${fundsHtml}
          </section>
        </div>
      </div>
    </div>
    `;
  }
}
