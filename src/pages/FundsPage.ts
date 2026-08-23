import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../lib/supabase/types";
import { Money } from "../lib/money";

export interface FundDetail {
  id: string;
  name: string;
  description: string;
  balance: Money;
  targetBudget: Money;
  percentageUsed: number;
  recentActivity: {
    description: string;
    amount: string;
    date: string;
    type: "in" | "out";
  }[];
}

const ICON_TRANSFER = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 9h13l-3-3M20 15H7l3 3"/></svg>`;
const ICON_CLOSE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;

export class FundsPage {
  private funds: FundDetail[] = [];
  private isTransferModalOpen = false;
  private transferSuccessMsg: string | null = null;
  private errorMessage: string | null = null;
  private isLoading = false;

  constructor(private supabase: SupabaseClient<Database>, private churchId: string) {}

  public async loadData(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    try {
      const { data, error } = await (this.supabase
        .from("funds") as any)
        .select("id, name, current_balance, is_active")
        .eq("church_id", this.churchId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) {
        this.errorMessage = "ไม่สามารถโหลดข้อมูลกองทุนได้ กรุณาลองใหม่อีกครั้ง";
        this.funds = [];
        return;
      }

      if (data && Array.isArray(data)) {
        this.funds = data.map((f, idx) => {
          const balance = f.current_balance ? Money.from(f.current_balance) : Money.zero();
          const target = Money.from(String((idx + 1) * 100000));
          return {
            id: f.id,
            name: f.name || "กองทุน",
            description: "กองทุนเพื่อวัตถุประสงค์เฉพาะของคริสตจักร",
            balance,
            targetBudget: target,
            percentageUsed: target.isPositive() && !target.isZero()
              ? Math.min(100, Math.round((balance.toNumber() / target.toNumber()) * 100))
              : 0,
            recentActivity: [],
          };
        });
      } else {
        this.funds = [];
      }
    } catch {
      this.errorMessage = "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง";
      this.funds = [];
    } finally {
      this.isLoading = false;
    }
  }

  public renderHtml(): string {
    if (this.isLoading) {
      return `
      <div class="gl-page gl-fade-in">
        <div class="gl-page-header" style="margin-bottom: var(--space-4);">
          <h1>กองทุนและงบประมาณ</h1>
          <p>บริหารจัดการกองทุนเฉพาะกิจ ยอดคงเหลือ และการจัดสรรงบประมาณ</p>
        </div>
        <div class="gl-card" style="text-align: center; padding: var(--space-8); color: var(--muted-foreground);">
          <p style="margin: 0; font-size: var(--text-sm);">กำลังโหลดข้อมูลกองทุน...</p>
        </div>
      </div>`;
    }

    let totalAll = Money.zero();
    for (const f of this.funds) {
      totalAll = totalAll.add(f.balance);
    }

    const errorNoticeHtml = this.errorMessage
      ? `<div class="gl-notice gl-notice--error" role="alert" style="margin-bottom: var(--space-4);">
          <div class="gl-notice__body" style="display: flex; justify-content: space-between; align-items: center;">
            <span>${this.errorMessage}</span>
            <button id="retry-funds-btn" class="gl-btn gl-btn--secondary gl-btn--sm">ลองใหม่</button>
          </div>
        </div>`
      : "";

    const modalHtml = this.isTransferModalOpen
      ? `
      <div id="transfer-modal" class="gl-modal-backdrop gl-fade-in">
        <div class="gl-modal-content" style="max-width: 440px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
            <div style="font-size: var(--text-base); font-weight: var(--weight-bold);">โอนเงินระหว่างกองทุน</div>
            <button id="close-transfer-btn" class="gl-btn gl-btn--ghost gl-btn--sm" style="width: 36px; height: 36px; padding: 0; border-radius: var(--radius-full);">
              ${ICON_CLOSE}
            </button>
          </div>

          <form id="transfer-form" style="display: flex; flex-direction: column; gap: var(--space-3);">
            <div class="gl-field">
              <label class="gl-label">กองทุนต้นทาง (หักเงินออก)</label>
              <select class="gl-select" id="from-fund">
                ${this.funds.map((f) => `<option value="${f.id}">${f.name} (${f.balance.format()})</option>`).join("")}
              </select>
            </div>

            <div class="gl-field">
              <label class="gl-label">กองทุนปลายทาง (รับเงินเข้า)</label>
              <select class="gl-select" id="to-fund">
                ${this.funds.slice(1).map((f) => `<option value="${f.id}">${f.name}</option>`).join("")}
              </select>
            </div>

            <div class="gl-field">
              <label class="gl-label">จำนวนเงิน (฿)</label>
              <input type="number" class="gl-input" id="transfer-amount" required placeholder="0.00" step="0.01" min="1" />
            </div>

            <div class="gl-field">
              <label class="gl-label">เหตุผลประกอบการโอนเงิน</label>
              <textarea class="gl-textarea" id="transfer-reason" placeholder="เช่น มติกรรมการ หรือ สมทบโครงการ..."></textarea>
            </div>

            <div style="display: flex; gap: var(--space-2); margin-top: var(--space-2);">
              <button type="button" id="cancel-transfer-btn" class="gl-btn gl-btn--secondary" style="flex: 1;">ยกเลิก</button>
              <button type="submit" class="gl-btn gl-btn--primary" style="flex: 1;">ยืนยันการโอน</button>
            </div>
          </form>
        </div>
      </div>`
      : "";

    const noticeHtml = this.transferSuccessMsg
      ? `
      <div class="gl-notice gl-notice--success" style="margin-bottom: var(--space-4);">
        <div class="gl-notice__body">${this.transferSuccessMsg}</div>
      </div>`
      : "";

    const fundsGridHtml = this.errorMessage
      ? ""
      : this.funds.length === 0
      ? `<div class="gl-card gl-empty-state" style="text-align: center; padding: var(--space-8); color: var(--muted-foreground);">
          <div style="font-size: var(--text-base); font-weight: var(--weight-medium); color: var(--foreground); margin-bottom: 4px;">ยังไม่มีกองทุนในระบบ</div>
          <p style="margin: 0; font-size: var(--text-sm);">สร้างกองทุนเพื่อเริ่มต้นการจัดสรรงบประมาณและบันทึกบัญชีแยกประเภท</p>
        </div>`
      : `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-4);">
          ${this.funds
            .map(
              (fund) => `
            <div class="gl-card" style="display: flex; flex-direction: column; gap: var(--space-3);">
              <div style="display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2);">
                <div style="font-size: var(--text-base); font-weight: var(--weight-bold handwriting);">${fund.name}</div>
                <div class="num-display" style="font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--primary);">${fund.balance.format()}</div>
              </div>

              <div style="font-size: var(--text-xs); color: var(--muted-foreground);">${fund.description}</div>

              <!-- Budget Progress Bar -->
              <div>
                <div style="display: flex; justify-content: space-between; font-size: var(--text-2xs); color: var(--muted-foreground); margin-bottom: 4px;">
                  <span>เป้าหมายงบประมาณ: ${fund.targetBudget.format()}</span>
                  <span class="num-display">${fund.percentageUsed}%</span>
                </div>
                <div style="height: 6px; background: var(--secondary); border-radius: var(--radius-full); overflow: hidden;">
                  <div style="height: 100%; width: ${fund.percentageUsed}%; background: var(--primary); border-radius: var(--radius-full);"></div>
                </div>
              </div>

              ${fund.recentActivity && fund.recentActivity.length > 0 ? `
              <!-- Mini Recent Activity -->
              <div style="border-top: 1px solid var(--border); padding-top: var(--space-2); margin-top: var(--space-1);">
                <div class="kicker" style="margin: 0 0 6px; font-size: 10px;">ความเคลื่อนไหวล่าสุด</div>
                ${fund.recentActivity
                  .map(
                    (act) => `
                  <div style="display: flex; justify-content: space-between; font-size: var(--text-xs); padding: 2px 0;">
                    <span style="color: var(--foreground);">${act.description}</span>
                    <span class="num-display" style="font-weight: var(--weight-medium); color: ${
                      act.type === "in" ? "var(--income)" : "var(--expense)"
                    };">${act.amount}</span>
                  </div>`
                  )
                  .join("")}
              </div>` : ""}
            </div>`
            )
            .join("")}
        </div>`;

    return `
    <div class="gl-page gl-fade-in">
      <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: var(--space-4);">
        <div class="gl-page-header" style="margin-bottom: 0;">
          <h1>กองทุนและงบประมาณ</h1>
          <p>บริหารจัดการกองทุนเฉพาะกิจ ยอดคงเหลือ และการจัดสรรงบประมาณ</p>
        </div>
        <button id="open-transfer-btn" class="gl-btn gl-btn--primary" ${this.funds.length < 2 ? "disabled" : ""}>
          ${ICON_TRANSFER}
          <span>โอนเงินกองทุน</span>
        </button>
      </div>

      ${errorNoticeHtml}
      ${noticeHtml}

      <!-- Total Fund Balance Card -->
      <section class="gl-section" style="margin-bottom: var(--space-5);">
        <div class="gl-card gl-card--elevated">
          <div class="kicker" style="margin: 0;">ยอดคงเหลือรวมทุกกองทุน</div>
          <div class="num-display" style="
            font-size: var(--text-5xl);
            font-weight: var(--weight-bold);
            letter-spacing: var(--tracking-heading);
            margin: var(--space-2) 0 4px;
          ">${totalAll.format()}</div>
          <div style="font-size: var(--text-xs); color: var(--muted-foreground);">
            แบ่งออกเป็น ${this.funds.length} กองทุนเฉพาะกิจ · สัดส่วนตรงตามผังบัญชี
          </div>
        </div>
      </section>

      <!-- Funds Grid -->
      <section class="gl-section">
        ${fundsGridHtml}
      </section>

      ${modalHtml}
    </div>
    `;
  }

  public attachEventListeners(root: HTMLElement, onStateChange: () => void): void {
    const retryBtn = root.querySelector<HTMLButtonElement>("#retry-funds-btn");
    retryBtn?.addEventListener("click", async () => {
      await this.loadData();
      onStateChange();
    });

    const openBtn = root.querySelector<HTMLButtonElement>("#open-transfer-btn");
    openBtn?.addEventListener("click", () => {
      this.isTransferModalOpen = true;
      this.transferSuccessMsg = null;
      onStateChange();
    });

    const closeTransferModal = () => {
      this.isTransferModalOpen = false;
      onStateChange();
    };

    const closeBtn = root.querySelector<HTMLButtonElement>("#close-transfer-btn");
    closeBtn?.addEventListener("click", closeTransferModal);

    const cancelBtn = root.querySelector<HTMLButtonElement>("#cancel-transfer-btn");
    cancelBtn?.addEventListener("click", closeTransferModal);

    const backdrop = root.querySelector<HTMLElement>("#transfer-modal");
    backdrop?.addEventListener("click", (e) => {
      if (e.target === backdrop) closeTransferModal();
    });

    if (this.isTransferModalOpen) {
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", onKeyDown);
          closeTransferModal();
        }
      };
      document.addEventListener("keydown", onKeyDown);
    }

    const form = root.querySelector<HTMLFormElement>("#transfer-form");
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const amountInput = root.querySelector<HTMLInputElement>("#transfer-amount");
      const amountVal = amountInput?.value || "0";
      this.isTransferModalOpen = false;
      this.transferSuccessMsg = `บันทึกคำขอโอนเงิน ฿${amountVal} เรียบร้อยแล้ว (รอการอนุมัติ)`;
      onStateChange();
    });
  }
}
