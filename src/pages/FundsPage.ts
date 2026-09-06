import { SupabaseClient } from "@supabase/supabase-js";
import { renderEmptyStateHtml } from "../components/shared/EmptyState";
import { fieldErrorHtml } from "../components/shared/FieldError";
import { Database } from "../lib/supabase/types";
import { Money } from "../lib/money";
import { FundsService } from "../lib/funds/funds-service";
import { escapeHtml } from "../lib/format";
import { UserRole, can } from "../lib/rbac";

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
  private createFieldErrors: Record<string, string> = {};
  private transferFieldErrors: Record<string, string> = {};
  private isLoading = false;
  private isSubmitting = false;

  constructor(
    supabase: SupabaseClient<Database>,
    private churchId: string,
    private userRole?: UserRole,
  ) {
    this.fundsService = new FundsService(supabase, userRole);
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
        <div class="gl-card gl-loading-center">
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
          <div class="gl-funds-modal-head">
            <div class="gl-funds-modal-title">โอนเงินระหว่างกองทุน</div>
            <button id="close-transfer-btn" class="gl-modal-close gl-btn gl-btn--ghost gl-btn--sm">
              ${ICON_CLOSE}
            </button>
          </div>

          ${formErrorHtml}

          <form id="transfer-form" class="gl-stack" novalidate>
            <div class="gl-field">
              <label class="gl-label" for="from-fund">กองทุนต้นทาง (หักเงินออก)</label>
              <select class="gl-select ${this.transferFieldErrors.fromFund ? "has-error" : ""}" id="from-fund">
                ${this.funds.map((f) => `<option value="${f.id}">${escapeHtml(f.name)} (${f.balance.format()})</option>`).join("")}
              </select>
              ${fieldErrorHtml(this.transferFieldErrors, "fromFund")}
            </div>

            <div class="gl-field">
              <label class="gl-label" for="to-fund">กองทุนปลายทาง (รับเงินเข้า)</label>
              <select class="gl-select ${this.transferFieldErrors.toFund ? "has-error" : ""}" id="to-fund">
                ${this.funds.map((f, idx) => `<option value="${f.id}" ${idx === 1 ? "selected" : ""}>${escapeHtml(f.name)}</option>`).join("")}
              </select>
              ${fieldErrorHtml(this.transferFieldErrors, "toFund")}
            </div>

            <div class="gl-field">
              <label class="gl-label" for="transfer-amount">จำนวนเงิน (฿)</label>
              <input type="number" class="gl-input ${this.transferFieldErrors.amount ? "has-error" : ""}" id="transfer-amount" placeholder="0.00" step="0.01" min="1" />
              ${fieldErrorHtml(this.transferFieldErrors, "amount")}
            </div>

            <div class="gl-field">
              <label class="gl-label" for="transfer-reason">เหตุผลประกอบการโอนเงิน</label>
              <textarea class="gl-textarea ${this.transferFieldErrors.reason ? "has-error" : ""}" id="transfer-reason" placeholder="เช่น มติคณะกรรมการ หรือ สมทบโครงการพันธกิจ..."></textarea>
              ${fieldErrorHtml(this.transferFieldErrors, "reason")}
            </div>

            <div class="gl-funds-modal-actions">
              <button type="button" id="cancel-transfer-btn" class="gl-btn gl-btn--secondary" ${this.isSubmitting ? "disabled" : ""}>ยกเลิก</button>
              <button type="submit" class="gl-btn gl-btn--primary" ${this.isSubmitting ? "disabled" : ""}>
                ${this.isSubmitting ? "กำลังดำเนินการ…" : "ยืนยันการโอน"}
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
          <div class="gl-funds-modal-head">
            <div class="gl-funds-modal-title">สร้างกองทุนใหม่</div>
            <button id="close-create-btn" class="gl-modal-close gl-btn gl-btn--ghost gl-btn--sm">
              ${ICON_CLOSE}
            </button>
          </div>

          ${formErrorHtml}

          <form id="create-fund-form" class="gl-stack" novalidate>
            <div class="gl-field">
              <label class="gl-label" for="fund-name-input">ชื่อกองทุน *</label>
              <input type="text" class="gl-input ${this.createFieldErrors.name ? "has-error" : ""}" id="fund-name-input" placeholder="เช่น กองทุนสร้างพระวิหาร, กองทุนสงเคราะห์" />
              ${fieldErrorHtml(this.createFieldErrors, "name")}
            </div>

            <div class="gl-field">
              <label class="gl-label" for="fund-desc-input">คำอธิบายวัตถุประสงค์</label>
              <textarea class="gl-textarea" id="fund-desc-input" placeholder="ระบุวัตถุประสงค์ในการใช้จ่ายเงินกองทุนนี้..."></textarea>
            </div>

            <div class="gl-field">
              <label class="gl-label" for="fund-target-input">เป้าหมายงบประมาณ (฿) (ถ้ามี)</label>
              <input type="number" class="gl-input ${this.createFieldErrors.target ? "has-error" : ""}" id="fund-target-input" placeholder="0.00" step="0.01" min="0" />
              ${fieldErrorHtml(this.createFieldErrors, "target")}
            </div>

            <div class="gl-funds-modal-actions">
              <button type="button" id="cancel-create-btn" class="gl-btn gl-btn--secondary" ${this.isSubmitting ? "disabled" : ""}>ยกเลิก</button>
              <button type="submit" class="gl-btn gl-btn--primary" ${this.isSubmitting ? "disabled" : ""}>
                ${this.isSubmitting ? "กำลังสร้าง…" : "บันทึกกองทุน"}
              </button>
            </div>
          </form>
        </div>
      </div>`
      : "";

    const canCreateFund = can(this.userRole ?? "member", "create", "funds");
    const canTransferFunds = can(
      this.userRole ?? "member",
      "create",
      "fund_transfers",
    );

    const fundsGridHtml = this.errorMessage
      ? ""
      : this.funds.length === 0
        ? renderEmptyStateHtml({
            icon: ICON_TRANSFER,
            message: "ยังไม่มีกองทุนในระบบ",
            hint: "สร้างกองทุนเพื่อเริ่มต้นการจัดสรรงบประมาณและบันทึกบัญชีแยกประเภท",
            action: canCreateFund
              ? {
                  label: "สร้างกองทุนแรก",
                  type: "button",
                  id: "empty-create-fund-btn",
                  variant: "primary",
                }
              : undefined,
          })
        : `
        <div class="gl-funds-grid">
          ${this.funds
            .map(
              (fund) => `
            <div class="gl-card gl-stack">
              <div class="gl-funds-card__head">
                <div class="gl-funds-card__name">${escapeHtml(fund.name)}</div>
                <div class="num-display gl-funds-card__balance">${fund.balance.format()}</div>
              </div>

              <div class="gl-hint">${escapeHtml(fund.description)}</div>

              <!-- Budget Progress Bar -->
              <div>
                <div class="gl-funds-progress-caption">
                  <span>เป้าหมายงบประมาณ: ${fund.targetAmount ? fund.targetAmount.format() : "ไม่ระบุ"}</span>
                  <span class="num-display">${fund.percentageUsed !== null ? fund.percentageUsed + "%" : "—"}</span>
                </div>
                ${
                  fund.targetAmount
                    ? `<div class="gl-progress" role="progressbar" aria-valuenow="${fund.percentageUsed}" aria-valuemin="0" aria-valuemax="100" aria-label="ความคืบหน้าของ ${escapeHtml(fund.name)}">
                  <div class="gl-progress__fill" style="width: ${fund.percentageUsed}%;"></div>
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
      <div class="gl-funds-pagehead">
        <div class="gl-page-header" style="margin-bottom: 0;">
          <h1>กองทุนและงบประมาณ</h1>
          <p>บริหารจัดการกองทุนเฉพาะกิจ ยอดคงเหลือ และการจัดสรรงบประมาณ</p>
        </div>
        <div class="gl-funds-pagehead__actions">
          ${
            canCreateFund
              ? `<button id="open-create-btn" class="gl-btn gl-btn--secondary">
                  ${ICON_PLUS}
                  <span>สร้างกองทุนใหม่</span>
                </button>`
              : ""
          }
          ${
            canTransferFunds
              ? `<button id="open-transfer-btn" class="gl-btn gl-btn--primary" ${this.funds.length < 2 ? "disabled" : ""}>
                  ${ICON_TRANSFER}
                  <span>โอนเงินกองทุน</span>
                </button>`
              : ""
          }
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
      this.transferFieldErrors = {};
      onStateChange();
    });

    const closeTransferModal = () => {
      this.isTransferModalOpen = false;
      this.formErrorMessage = null;
      this.transferFieldErrors = {};
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
      this.createFieldErrors = {};
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
      this.createFieldErrors = {};
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
      const amountVal = amountInput?.value || "";
      const reasonVal = reasonInput?.value.trim() || "";

      const errors: Record<string, string> = {};
      if (!fromId) errors.fromFund = "กรุณาเลือกกองทุนต้นทาง";
      if (!toId) errors.toFund = "กรุณาเลือกกองทุนปลายทาง";
      if (fromId && toId && fromId === toId) {
        errors.toFund = "กองทุนต้นทางและปลายทางต้องไม่เป็นกองทุนเดียวกัน";
      }
      if (!amountVal) {
        errors.amount = "กรุณาระบุจำนวนเงิน";
      } else {
        try {
          const m = Money.from(amountVal);
          if (!m.isPositive() || m.isZero()) {
            errors.amount = "จำนวนเงินต้องมากกว่า 0.00 บาท";
          }
        } catch {
          errors.amount = "จำนวนเงินไม่ถูกต้อง";
        }
      }
      if (!reasonVal || reasonVal.length < 5) {
        errors.reason = "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร";
      }

      if (Object.keys(errors).length > 0) {
        this.transferFieldErrors = errors;
        onStateChange();
        return;
      }

      this.transferFieldErrors = {};
      this.isSubmitting = true;
      this.formErrorMessage = null;
      onStateChange();

      try {
        const res = await this.fundsService.transferFunds({
          church_id: this.churchId,
          from_fund_id: fromId,
          to_fund_id: toId,
          amount: amountVal,
          notes: reasonVal,
        });

        if (!res.success) {
          this.formErrorMessage =
            res.error || "เกิดข้อผิดพลาดในการโอนเงิน กรุณาลองใหม่อีกครั้ง";
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
        this.formErrorMessage =
          err?.message || "เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
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

      const errors: Record<string, string> = {};
      if (!nameVal) errors.name = "กรุณาระบุชื่อกองทุน";
      if (targetVal) {
        try {
          const m = Money.from(targetVal);
          if (m.isNegative()) errors.target = "เป้าหมายงบประมาณต้องไม่ติดลบ";
        } catch {
          errors.target = "เป้าหมายงบประมาณไม่ถูกต้อง";
        }
      }

      if (Object.keys(errors).length > 0) {
        this.createFieldErrors = errors;
        onStateChange();
        return;
      }

      this.createFieldErrors = {};
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
          this.formErrorMessage =
            res.error || "เกิดข้อผิดพลาดในการสร้างกองทุน กรุณาลองใหม่อีกครั้ง";
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
        this.formErrorMessage =
          err?.message || "เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
        this.isSubmitting = false;
        onStateChange();
      }
    });
  }
}
