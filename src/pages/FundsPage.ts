import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../lib/supabase/types";
import { Money } from "../lib/money";
import { FundsService } from "../lib/funds/funds-service";
import { escapeHtml } from "../lib/format";

export interface FundDetail {
  id: string;
  name: string;
  description: string;
  balance: Money;
  targetAmount: Money | null;
  percentageUsed: number | null;
  recentActivity: {
    description: string;
    amount: string;
    date: string;
    type: "in" | "out";
  }[];
}

const ICON_TRANSFER = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 9h13l-3-3M20 15H7l3 3"/></svg>`;
const ICON_PLUS = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
const ICON_CLOSE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;

export class FundsPage {
  private funds: FundDetail[] = [];
  private fundsService: FundsService;
  private isTransferModalOpen = false;
  private isCreateModalOpen = false;
  private transferSuccessMsg: string | null = null;
  private errorMessage: string | null = null;
  private formErrorMessage: string | null = null;
  private isLoading = false;
  private isSubmitting = false;

  constructor(
    supabase: SupabaseClient<Database>,
    private churchId: string,
  ) {
    this.fundsService = new FundsService(supabase);
  }

  public async loadData(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    try {
      const res = await this.fundsService.getFunds(this.churchId);
      if (!res.success || !res.data) {
        this.errorMessage = res.error
          ? `ไม่สามารถโหลดข้อมูลกองทุนได้: ${res.error}`
          : "ไม่สามารถโหลดข้อมูลกองทุนได้ กรุณาลองใหม่อีกครั้ง";
        this.funds = [];
        return;
      }

      this.funds = res.data.map((f) => {
        const balance = f.current_balance;
        const hasTarget = f.target_amount.isPositive();
        const target = hasTarget ? f.target_amount : null;
        return {
          id: f.id,
          name: f.name || "กองทุน",
          description:
            f.description || "กองทุนเพื่อวัตถุประสงค์เฉพาะของคริสตจักร",
          balance,
          targetAmount: target,
          percentageUsed: target
            ? Math.min(
                100,
                Math.round((balance.toNumber() / target.toNumber()) * 100),
              )
            : null,
          recentActivity: [],
        };
      });
    } catch {
      this.errorMessage =
        "ไม่สามารถโหลดข้อมูลกองทุนได้ (เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล)";
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
            <span>${escapeHtml(this.errorMessage)}</span>
            <button id="retry-funds-btn" class="gl-btn gl-btn--secondary gl-btn--sm">ลองใหม่</button>
          </div>
        </div>`
      : "";

    const noticeHtml = this.transferSuccessMsg
      ? `
      <div class="gl-notice gl-notice--success" style="margin-bottom: var(--space-4);">
        <div class="gl-notice__body">${escapeHtml(this.transferSuccessMsg)}</div>
      </div>`
      : "";

    const formErrorHtml = this.formErrorMessage
      ? `
      <div class="gl-notice gl-notice--error" style="margin-bottom: var(--space-3); font-size: var(--text-xs);">
        <div class="gl-notice__body">${escapeHtml(this.formErrorMessage)}</div>
      </div>`
      : "";

    // Transfer Modal
    const transferModalHtml = this.isTransferModalOpen
      ? `
      <div id="transfer-modal" class="gl-modal-backdrop gl-fade-in">
        <div class="gl-modal-content gl-rise" style="max-width: 440px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
            <div style="font-size: var(--text-base); font-weight: var(--weight-bold);">โอนเงินระหว่างกองทุน</div>
            <button id="close-transfer-btn" class="gl-btn gl-btn--ghost gl-btn--sm" style="padding: 0; border-radius: var(--radius-full);">
              ${ICON_CLOSE}
            </button>
          </div>

          ${formErrorHtml}

          <form id="transfer-form" style="display: flex; flex-direction: column; gap: var(--space-3);">
            <div class="gl-field">
              <label class="gl-label" for="from-fund">กองทุนต้นทาง (หักเงินออก)</label>
              <select class="gl-select" id="from-fund" required>
                ${this.funds.map((f) => `<option value="${f.id}">${escapeHtml(f.name)} (${f.balance.format()})</option>`).join("")}
              </select>
            </div>

            <div class="gl-field">
              <label class="gl-label" for="to-fund">กองทุนปลายทาง (รับเงินเข้า)</label>
              <select class="gl-select" id="to-fund" required>
                ${this.funds.map((f, idx) => `<option value="${f.id}" ${idx === 1 ? "selected" : ""}>${escapeHtml(f.name)}</option>`).join("")}
              </select>
            </div>

            <div class="gl-field">
              <label class="gl-label" for="transfer-amount">จำนวนเงิน (฿)</label>
              <input type="number" class="gl-input" id="transfer-amount" required placeholder="0.00" step="0.01" min="1" />
            </div>

            <div class="gl-field">
              <label class="gl-label" for="transfer-reason">เหตุผลประกอบการโอนเงิน</label>
              <textarea class="gl-textarea" id="transfer-reason" required placeholder="เช่น มติคณะกรรมการ หรือ สมทบโครงการพันธกิจ..."></textarea>
            </div>

            <div style="display: flex; gap: var(--space-2); margin-top: var(--space-2);">
              <button type="button" id="cancel-transfer-btn" class="gl-btn gl-btn--secondary" style="flex: 1;" ${this.isSubmitting ? "disabled" : ""}>ยกเลิก</button>
              <button type="submit" class="gl-btn gl-btn--primary" style="flex: 1;" ${this.isSubmitting ? "disabled" : ""}>
                ${this.isSubmitting ? "กำลังดำเนินการ..." : "ยืนยันการโอน"}
              </button>
            </div>
          </form>
        </div>
      </div>`
      : "";

    // Create Fund Modal
    const createModalHtml = this.isCreateModalOpen
      ? `
      <div id="create-fund-modal" class="gl-modal-backdrop gl-fade-in">
        <div class="gl-modal-content gl-rise" style="max-width: 440px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
            <div style="font-size: var(--text-base); font-weight: var(--weight-bold);">สร้างกองทุนใหม่</div>
            <button id="close-create-btn" class="gl-btn gl-btn--ghost gl-btn--sm" style="padding: 0; border-radius: var(--radius-full);">
              ${ICON_CLOSE}
            </button>
          </div>

          ${formErrorHtml}

          <form id="create-fund-form" style="display: flex; flex-direction: column; gap: var(--space-3);">
            <div class="gl-field">
              <label class="gl-label" for="fund-name-input">ชื่อกองทุน *</label>
              <input type="text" class="gl-input" id="fund-name-input" required placeholder="เช่น กองทุนสร้างพระวิหาร, กองทุนสงเคราะห์" />
            </div>

            <div class="gl-field">
              <label class="gl-label" for="fund-desc-input">คำอธิบายวัตถุประสงค์</label>
              <textarea class="gl-textarea" id="fund-desc-input" placeholder="ระบุวัตถุประสงค์ในการใช้จ่ายเงินกองทุนนี้..."></textarea>
            </div>

            <div class="gl-field">
              <label class="gl-label" for="fund-target-input">เป้าหมายงบประมาณ (฿) (ถ้ามี)</label>
              <input type="number" class="gl-input" id="fund-target-input" placeholder="0.00" step="0.01" min="0" />
            </div>

            <div style="display: flex; gap: var(--space-2); margin-top: var(--space-2);">
              <button type="button" id="cancel-create-btn" class="gl-btn gl-btn--secondary" style="flex: 1;" ${this.isSubmitting ? "disabled" : ""}>ยกเลิก</button>
              <button type="submit" class="gl-btn gl-btn--primary" style="flex: 1;" ${this.isSubmitting ? "disabled" : ""}>
                ${this.isSubmitting ? "กำลังสร้าง..." : "บันทึกกองทุน"}
              </button>
            </div>
          </form>
        </div>
      </div>`
      : "";

    const fundsGridHtml = this.errorMessage
      ? ""
      : this.funds.length === 0
        ? `<div class="gl-card gl-empty-state" style="text-align: center; padding: var(--space-8); color: var(--muted-foreground);">
          <div style="font-size: var(--text-base); font-weight: var(--weight-medium); color: var(--foreground); margin-bottom: 4px;">ยังไม่มีกองทุนในระบบ</div>
          <p style="margin: 0 0 var(--space-3); font-size: var(--text-sm);">สร้างกองทุนเพื่อเริ่มต้นการจัดสรรงบประมาณและบันทึกบัญชีแยกประเภท</p>
          <button id="empty-create-fund-btn" class="gl-btn gl-btn--primary gl-btn--sm">+ สร้างกองทุนแรก</button>
        </div>`
        : `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-4);">
          ${this.funds
            .map(
              (fund) => `
            <div class="gl-card" style="display: flex; flex-direction: column; gap: var(--space-3);">
              <div style="display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2);">
                <div style="font-size: var(--text-base); font-weight: var(--weight-bold);">${escapeHtml(fund.name)}</div>
                <div class="num-display" style="font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--primary);">${fund.balance.format()}</div>
              </div>

              <div style="font-size: var(--text-xs); color: var(--muted-foreground);">${escapeHtml(fund.description)}</div>

              <!-- Budget Progress Bar -->
              <div>
                <div style="display: flex; justify-content: space-between; font-size: var(--text-2xs); color: var(--muted-foreground); margin-bottom: 4px;">
                  <span>เป้าหมายงบประมาณ: ${fund.targetAmount ? fund.targetAmount.format() : "ไม่ระบุ"}</span>
                  <span class="num-display">${fund.percentageUsed !== null ? fund.percentageUsed + "%" : "—"}</span>
                </div>
                ${
                  fund.targetAmount
                    ? `<div style="height: var(--space-1); background: var(--secondary); border-radius: var(--radius-full); overflow: hidden;">
                  <div style="height: 100%; width: ${fund.percentageUsed}%; background: var(--primary); border-radius: var(--radius-full);"></div>
                </div>`
                    : ""
                }
              </div>
            </div>`,
            )
            .join("")}
        </div>`;

    return `
    <div class="gl-page gl-fade-in">
      <div style="display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-4); flex-wrap: wrap;">
        <div class="gl-page-header" style="margin-bottom: 0;">
          <h1>กองทุนและงบประมาณ</h1>
          <p>บริหารจัดการกองทุนเฉพาะกิจ ยอดคงเหลือ และการจัดสรรงบประมาณ</p>
        </div>
        <div style="display: flex; gap: var(--space-2);">
          <button id="open-create-btn" class="gl-btn gl-btn--secondary">
            ${ICON_PLUS}
            <span>สร้างกองทุนใหม่</span>
          </button>
          <button id="open-transfer-btn" class="gl-btn gl-btn--primary" ${this.funds.length < 2 ? "disabled" : ""}>
            ${ICON_TRANSFER}
            <span>โอนเงินกองทุน</span>
          </button>
        </div>
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

      ${transferModalHtml}
      ${createModalHtml}
    </div>
    `;
  }

  public attachEventListeners(
    root: HTMLElement,
    onStateChange: () => void,
  ): void {
    const retryBtn = root.querySelector<HTMLButtonElement>("#retry-funds-btn");
    retryBtn?.addEventListener("click", async () => {
      await this.loadData();
      onStateChange();
    });

    // Open/Close Transfer Modal
    const openTransferBtn =
      root.querySelector<HTMLButtonElement>("#open-transfer-btn");
    openTransferBtn?.addEventListener("click", () => {
      this.isTransferModalOpen = true;
      this.transferSuccessMsg = null;
      this.formErrorMessage = null;
      onStateChange();
    });

    const closeTransferModal = () => {
      this.isTransferModalOpen = false;
      this.formErrorMessage = null;
      onStateChange();
    };

    root
      .querySelector<HTMLButtonElement>("#close-transfer-btn")
      ?.addEventListener("click", closeTransferModal);
    root
      .querySelector<HTMLButtonElement>("#cancel-transfer-btn")
      ?.addEventListener("click", closeTransferModal);
    const transferBackdrop = root.querySelector<HTMLElement>("#transfer-modal");
    transferBackdrop?.addEventListener("click", (e) => {
      if (e.target === transferBackdrop) closeTransferModal();
    });

    // Open/Close Create Fund Modal
    const openCreate = () => {
      this.isCreateModalOpen = true;
      this.formErrorMessage = null;
      onStateChange();
    };

    root
      .querySelector<HTMLButtonElement>("#open-create-btn")
      ?.addEventListener("click", openCreate);
    root
      .querySelector<HTMLButtonElement>("#empty-create-fund-btn")
      ?.addEventListener("click", openCreate);

    const closeCreateModal = () => {
      this.isCreateModalOpen = false;
      this.formErrorMessage = null;
      onStateChange();
    };

    root
      .querySelector<HTMLButtonElement>("#close-create-btn")
      ?.addEventListener("click", closeCreateModal);
    root
      .querySelector<HTMLButtonElement>("#cancel-create-btn")
      ?.addEventListener("click", closeCreateModal);
    const createBackdrop =
      root.querySelector<HTMLElement>("#create-fund-modal");
    createBackdrop?.addEventListener("click", (e) => {
      if (e.target === createBackdrop) closeCreateModal();
    });

    // Transfer Form Submission (Atomic RPC)
    const transferForm = root.querySelector<HTMLFormElement>("#transfer-form");
    transferForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fromFundSelect =
        root.querySelector<HTMLSelectElement>("#from-fund");
      const toFundSelect = root.querySelector<HTMLSelectElement>("#to-fund");
      const amountInput =
        root.querySelector<HTMLInputElement>("#transfer-amount");
      const reasonInput =
        root.querySelector<HTMLTextAreaElement>("#transfer-reason");

      const fromId = fromFundSelect?.value || "";
      const toId = toFundSelect?.value || "";
      const amountVal = amountInput?.value || "0";
      const reasonVal = reasonInput?.value || "";

      if (fromId === toId) {
        this.formErrorMessage =
          "กองทุนต้นทางและกองทุนปลายทางต้องไม่เป็นกองทุนเดียวกัน";
        onStateChange();
        return;
      }

      this.isSubmitting = true;
      this.formErrorMessage = null;
      onStateChange();

      try {
        const res = await this.fundsService.transferFunds({
          church_id: this.churchId,
          from_fund_id: fromId,
          to_fund_id: toId,
          amount: amountVal,
          notes: reasonVal || "โอนเงินระหว่างกองทุน",
        });

        if (!res.success) {
          this.formErrorMessage = res.error || "เกิดข้อผิดพลาดในการโอนเงิน";
          this.isSubmitting = false;
          onStateChange();
          return;
        }

        this.isTransferModalOpen = false;
        this.transferSuccessMsg = `บันทึกคำขอโอนเงิน ${Money.from(amountVal).format()} เรียบร้อยแล้ว`;
        this.isSubmitting = false;
        await this.loadData();
        onStateChange();
      } catch (err: any) {
        this.formErrorMessage = err.message || "เกิดข้อผิดพลาด";
        this.isSubmitting = false;
        onStateChange();
      }
    });

    // Create Fund Form Submission
    const createForm = root.querySelector<HTMLFormElement>("#create-fund-form");
    createForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nameInput =
        root.querySelector<HTMLInputElement>("#fund-name-input");
      const descInput =
        root.querySelector<HTMLTextAreaElement>("#fund-desc-input");
      const targetInput =
        root.querySelector<HTMLInputElement>("#fund-target-input");

      const nameVal = nameInput?.value?.trim() || "";
      const descVal = descInput?.value?.trim() || undefined;
      const targetVal = targetInput?.value ? targetInput.value : undefined;

      if (!nameVal) {
        this.formErrorMessage = "กรุณาระบุชื่อกองทุน";
        onStateChange();
        return;
      }

      this.isSubmitting = true;
      this.formErrorMessage = null;
      onStateChange();

      try {
        const res = await this.fundsService.createFund({
          church_id: this.churchId,
          name: nameVal,
          description: descVal,
          target_amount: targetVal,
        });

        if (!res.success) {
          this.formErrorMessage = res.error || "เกิดข้อผิดพลาดในการสร้างกองทุน";
          this.isSubmitting = false;
          onStateChange();
          return;
        }

        this.isCreateModalOpen = false;
        this.transferSuccessMsg = `สร้างกองทุน "${nameVal}" เรียบร้อยแล้ว`;
        this.isSubmitting = false;
        await this.loadData();
        onStateChange();
      } catch (err: any) {
        this.formErrorMessage = err.message || "เกิดข้อผิดพลาด";
        this.isSubmitting = false;
        onStateChange();
      }
    });
  }
}
