import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../lib/supabase/types";
import { ApprovalsService } from "../lib/transactions/approvals-service";
import { Money } from "../lib/money";

export interface DashboardFund {
  name: string;
  balance: Money;
}

export interface DashboardData {
  pendingApprovalsCount: number;
  totalFundsBalance?: string;
  activeAccountsCount?: number;
  funds?: DashboardFund[];
  loadFailed?: boolean;
}

const ICON_CLOCK = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
const ICON_ARROW = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7"/></svg>`;

export class DashboardPage {
  private approvalsService: ApprovalsService;

  constructor(private supabase: SupabaseClient<Database>) {
    this.approvalsService = new ApprovalsService(supabase);
  }

  public async loadData(churchId: string): Promise<DashboardData> {
    try {
      const pendingRes = await this.approvalsService.getPendingApprovals(churchId);
      const pendingCount = pendingRes.success && pendingRes.data ? pendingRes.data.length : 0;

      const { data: fundsData } = await (this.supabase
        .from("funds") as any)
        .select("name, current_balance")
        .eq("church_id", churchId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      let totalFunds = Money.zero();
      const funds: DashboardFund[] = [];
      if (fundsData && Array.isArray(fundsData)) {
        for (const f of fundsData) {
          const balance = f.current_balance ? Money.from(f.current_balance as string) : Money.zero();
          totalFunds = totalFunds.add(balance);
          funds.push({ name: (f.name as string) || "กองทุน", balance });
        }
      }

      const { count: accountsCount } = await this.supabase
        .from("accounts")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .eq("is_active", true);

      return {
        pendingApprovalsCount: pendingCount,
        totalFundsBalance: totalFunds.format(),
        activeAccountsCount: accountsCount || 0,
        funds,
      };
    } catch {
      return {
        pendingApprovalsCount: 0,
        totalFundsBalance: "฿0.00",
        activeAccountsCount: 0,
        funds: [],
        loadFailed: true,
      };
    }
  }

  private renderFundsHtml(funds: DashboardFund[]): string {
    if (funds.length === 0) {
      return `<p style="font-size: var(--text-sm); color: var(--muted-foreground); margin: 0;">ยังไม่มีกองทุน</p>`;
    }

    const rows = funds
      .map(
        (fund) => `
        <div style="
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: var(--space-4);
          padding: var(--space-3) 0;
          border-bottom: 1px solid var(--border);
        ">
          <span style="font-size: var(--text-sm);">${fund.name}</span>
          <span class="num-display" style="font-size: var(--text-md); font-weight: var(--weight-semibold); color: ${
            fund.balance.isNegative() ? "var(--expense)" : "var(--foreground)"
          };">${fund.balance.format()}</span>
        </div>`
      )
      .join("");

    return `<div class="gl-rows" style="margin-top: calc(var(--space-3) * -1);">${rows}</div>`;
  }

  public renderHtml(data: DashboardData): string {
    const hasPending = data.pendingApprovalsCount > 0;
    const funds = data.funds || [];

    const loadFailedHtml = data.loadFailed
      ? `<div class="gl-notice gl-notice--error" role="alert" style="margin-bottom: var(--space-5);">
          <div class="gl-notice__body">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</div>
        </div>`
      : "";

    return `
    <div class="gl-page gl-dashboard-container gl-fade-in">
      <div class="gl-page-header">
        <h1>ภาพรวม</h1>
        <p>ยอดคงเหลือ กองทุน และรายการที่รอคุณตรวจสอบ</p>
      </div>

      ${loadFailedHtml}

      <section class="gl-section">
        <div class="gl-card gl-card--elevated">
          <div style="font-size: var(--text-sm); color: var(--muted-foreground);">ยอดคงเหลือรวมทุกกองทุน</div>
          <div class="num-display" data-testid="total-balance" style="
            font-size: var(--text-5xl);
            font-weight: var(--weight-bold);
            letter-spacing: var(--tracking-heading);
            line-height: var(--leading-heading);
            margin: var(--space-1) 0;
          ">${data.totalFundsBalance || "฿0.00"}</div>
          <div style="font-size: var(--text-xs); color: var(--muted-foreground);">
            ${funds.length} กองทุน · ${data.activeAccountsCount || 0} บัญชี
          </div>
        </div>
      </section>

      <section class="gl-section">
        <div class="gl-section__head">
          <h2>กองทุน</h2>
        </div>
        ${this.renderFundsHtml(funds)}
      </section>

      <section class="gl-section">
        <div class="gl-section__head">
          <h2>รอคุณตรวจสอบ</h2>
          <span class="num-display" style="font-size: var(--text-sm); font-weight: var(--weight-semibold); color: ${
            hasPending ? "var(--primary)" : "var(--muted-foreground)"
          };">${data.pendingApprovalsCount} รายการ</span>
        </div>

        <div class="gl-card${hasPending ? " gl-card--attention" : ""}" style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
        ">
          <div style="display: flex; align-items: center; gap: var(--space-4); min-width: 0;">
            <div aria-hidden="true" style="
              width: 40px;
              height: 40px;
              flex-shrink: 0;
              border-radius: var(--radius-md);
              display: flex;
              align-items: center;
              justify-content: center;
              background: ${hasPending ? "var(--accent)" : "var(--secondary)"};
              color: ${hasPending ? "var(--primary)" : "var(--muted-foreground)"};
            ">${ICON_CLOCK}</div>
            <div style="min-width: 0;">
              <div style="font-size: var(--text-base); font-weight: var(--weight-semibold);">
                ${hasPending ? `${data.pendingApprovalsCount} รายการรออนุมัติ` : "ไม่มีรายการค้างอนุมัติ"}
              </div>
              <div style="font-size: var(--text-xs); color: var(--muted-foreground); margin-top: 2px;">
                ${hasPending ? "คำขอเบิกจ่ายที่รอการพิจารณา" : "ตรวจครบทุกรายการแล้ว"}
              </div>
            </div>
          </div>

          ${
            hasPending
              ? `<a href="#/approvals" class="gl-btn gl-btn--primary" style="flex-shrink: 0;">
                   <span>ไปที่คิวอนุมัติ</span>${ICON_ARROW}
                 </a>`
              : ""
          }
        </div>
      </section>
    </div>
    `;
  }
}
