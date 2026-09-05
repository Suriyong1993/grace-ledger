import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../lib/supabase/types";
import { ApprovalsService } from "../lib/transactions/approvals-service";
import { PendingApprovalItem } from "../lib/transactions/types";
import { Money } from "../lib/money";
import { router } from "../router";
import { escapeHtml, formatDateThai, toUserMessage } from "../lib/format";
import { type AppShellUser } from "../components/layout/AppShell";

/* Per-page ICON_* inline SVGs — the repo convention (see design-plans/08).
   Lucide-style stroke icons; decorative ones are aria-hidden at the call site. */
const ICON_CLOCK = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
const ICON_CHECK_CIRCLE = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>`;
const ICON_CHECK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4.5 12.5l5 5 10-11"/></svg>`;
const ICON_UNDO = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>`;
const ICON_X = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const ICON_PAPERCLIP = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 11.5l-8.5 8.5a6 6 0 0 1-8.5-8.5L12.5 3a4 4 0 0 1 5.7 5.7L10 16.5a2 2 0 0 1-2.8-2.8l7.3-7.3"/></svg>`;
const ICON_REFRESH = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>`;

export class ApprovalsPage {
  private approvalsService: ApprovalsService;
  private items: PendingApprovalItem[] = [];
  private selectedItemId: string | null = null;
  private activeModal: {
    type: "revision_requested" | "rejected";
    item: PendingApprovalItem;
  } | null = null;
  private isLoading: boolean = false;
  private errorMessage: string | null = null;
  private staleWarning: string | null = null;
  private successMessage: string | null = null;

  constructor(
    supabase: SupabaseClient<Database>,
    private churchId: string,
    private currentUserId?: string
  ) {
    this.approvalsService = new ApprovalsService(supabase);
  }

  public async init(selectedId?: string): Promise<void> {
    this.selectedItemId = selectedId || null;
    await this.loadQueue();
  }

  public getItems(): PendingApprovalItem[] {
    return this.items;
  }

  public setSelectedItem(id: string | null): void {
    if (this.selectedItemId !== id) {
      this.selectedItemId = id;
      this.activeModal = null;
      this.staleWarning = null;
      this.errorMessage = null;
    }
  }

  public async loadQueue(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    try {
      const res = await this.approvalsService.getPendingApprovals(this.churchId, this.currentUserId);
      if (res.success && res.data) {
        this.items = res.data;
      } else {
        this.errorMessage = toUserMessage(res.error?.message, "ไม่สามารถโหลดรายการรออนุมัติได้");
      }
    } catch (err: any) {
      this.errorMessage = toUserMessage(err, "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      this.isLoading = false;
    }
  }

  // ─── Render Helpers ───────────────────────────────────────────────────────

  private renderProfileHeader(user?: AppShellUser): string {
    const initials = escapeHtml(user?.initials || "GL");
    const name = escapeHtml(user?.name || "ผู้ใช้งาน");
    const role = escapeHtml(user?.role || "");
    const church = escapeHtml(user?.churchName || "");
    const pendingCount = this.items.length;
    return `
    <div class="gl-card gl-appr-profile gl-rise">
      <div class="gl-appr-profile__avatar" aria-hidden="true">${initials}</div>
      <div class="gl-appr-profile__body">
        <div class="gl-appr-profile__name">${name}</div>
        <div class="gl-appr-profile__idrow">
          ${role ? `<span class="gl-badge gl-badge--pending">${role}</span>` : ""}
          ${church ? `<span class="gl-appr-profile__meta">${church}</span>` : ""}
        </div>
      </div>
      <div class="gl-appr-profile__count${pendingCount > 0 ? " gl-appr-profile__count--attention" : ""}">
        <span class="num-display gl-appr-profile__count-value">${pendingCount}</span>
        <span class="gl-appr-profile__count-label">รออนุมัติ</span>
      </div>
    </div>`;
  }

  private renderSummaryStats(): string {
    const incomeItems = this.items.filter((i) => i.direction === "income");
    const expenseItems = this.items.filter((i) => i.direction === "expense");
    const incomeTotal = incomeItems.reduce((acc, i) => acc.add(i.amount), Money.zero());
    const expenseTotal = expenseItems.reduce((acc, i) => acc.add(i.amount), Money.zero());
    const total = incomeTotal.add(expenseTotal);
    return `
    <div class="gl-card gl-appr-stats">
      <div class="gl-appr-stat">
        <div class="num-display gl-appr-stat__value" style="color: var(--income);">+${incomeTotal.format()}</div>
        <div class="gl-appr-stat__label">รายรับ (${incomeItems.length})</div>
      </div>
      <div class="gl-appr-stat gl-appr-stat--mid">
        <div class="num-display gl-appr-stat__value" style="color: var(--expense);">−${expenseTotal.format()}</div>
        <div class="gl-appr-stat__label">รายจ่าย (${expenseItems.length})</div>
      </div>
      <div class="gl-appr-stat">
        <div class="num-display gl-appr-stat__value" style="color: var(--muted-foreground);">${total.format()}</div>
        <div class="gl-appr-stat__label">รวมมูลค่า</div>
      </div>
    </div>`;
  }

  private renderDirectionIcon(direction: string): string {
    if (direction === "income") {
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--income)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
    }
    if (direction === "expense") {
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--expense)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;
    }
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;
  }

  private renderDetailPanel(item: PendingApprovalItem): string {
    const accountName = escapeHtml(item.accountName || "บัญชีหลัก");
    const splitsHtml =
      item.splits && item.splits.length > 0
        ? item.splits
            .map(
              (sp) => `
          <div class="gl-appr-detail__split">
            <span>${escapeHtml(sp.fundName || "กองทุน")}</span>
            <span class="num-display">${sp.amount.format()}</span>
          </div>`
            )
            .join("")
        : `<div class="gl-appr-detail__split" style="color: var(--muted-foreground);">ไม่มีข้อมูลกองทุน</div>`;
    return `
    <div class="gl-appr-detail gl-decision-panel gl-fade-in">
      <div class="gl-appr-detail__grid">
        <div>
          <div class="gl-appr-detail__label">บัญชี</div>
          <div style="font-weight: 500; margin-top: 2px;">${accountName}</div>
        </div>
        <div>
          <div class="gl-appr-detail__label">มูลค่า</div>
          <div class="num-display" style="font-weight: 700; margin-top: 2px;">${item.amount.format()}</div>
        </div>
      </div>
      <div class="gl-appr-detail__section">
        <div class="gl-appr-detail__head">รายละเอียดกองทุน</div>
        ${splitsHtml}
      </div>
      ${
        item.hasReceipt && item.receiptUrl
          ? `<div class="gl-appr-detail__section">
          <a href="${escapeHtml(item.receiptUrl)}" target="_blank" rel="noopener noreferrer"
            style="font-size: var(--text-xs); color: var(--primary); text-decoration: none; display: inline-flex; align-items: center; gap: var(--space-1);">
            <span aria-hidden="true">${ICON_PAPERCLIP}</span> มีเอกสารใบเสร็จแนบ</a>
        </div>`
          : ""
      }
      ${
        item.isCreator
          ? `<div class="gl-notice gl-notice--error" role="alert" style="margin-bottom: var(--space-4); font-size: var(--text-xs);">
          <div class="gl-notice__body">
            <strong>หลักการแบ่งแยกหน้าที่</strong>
            <div style="margin-top: 4px;">คุณเป็นผู้สร้างรายการนี้ ไม่สามารถอนุมัติตัวเองได้</div>
          </div>
        </div>`
          : ""
      }
      <div class="gl-appr-detail__actions">
        ${
          !item.isCreator
            ? `<button type="button" class="gl-btn gl-btn--primary gl-btn-approve"
              data-id="${escapeHtml(item.id)}">${ICON_CHECK} อนุมัติ</button>`
            : `<button type="button" class="gl-btn gl-btn--primary" disabled
              style="opacity: 0.4; cursor: not-allowed;">${ICON_CHECK} อนุมัติ</button>`
        }
        <button type="button" class="gl-btn gl-btn--secondary gl-btn-request-revision"
          data-id="${escapeHtml(item.id)}">${ICON_UNDO} ขอแก้ไข</button>
        <button type="button" class="gl-btn gl-btn--secondary gl-btn-reject"
          data-id="${escapeHtml(item.id)}" style="color: var(--expense);">${ICON_X} ปฏิเสธ</button>
      </div>
      <button type="button" class="gl-appr-detail__close gl-sheet-close">ปิดรายละเอียด</button>
    </div>`;
  }

  private renderApprovalCard(item: PendingApprovalItem): string {
    const isSelected = this.selectedItemId === item.id;
    const dirColor =
      item.direction === "income"
        ? "var(--income)"
        : item.direction === "expense"
          ? "var(--expense)"
          : "var(--muted-foreground)";
    const amountSign = item.direction === "expense" ? "−" : "+";
    const fundNames =
      item.splits && item.splits.length > 0
        ? item.splits
            .map((s) => escapeHtml(s.fundName || ""))
            .filter(Boolean)
            .join(", ")
        : "";
    const dateStr = item.createdAt ? formatDateThai(item.createdAt.substring(0, 10)) : "";
    const refNum = item.referenceNumber ? escapeHtml(item.referenceNumber) : "";
    const iconClass =
      item.direction === "income"
        ? "gl-appr-card__icon--income"
        : item.direction === "expense"
          ? "gl-appr-card__icon--expense"
          : "";
    return `
    <div class="gl-approval-card gl-fade-in${isSelected ? " gl-approval-card--selected" : ""}" data-id="${escapeHtml(item.id)}" role="listitem">
      <div class="gl-appr-card__row">
        <div class="gl-appr-card__icon ${iconClass}" aria-hidden="true">
          ${this.renderDirectionIcon(item.direction)}
        </div>
        <div class="gl-appr-card__body">
          <div class="gl-appr-card__desc">${escapeHtml(item.description)}</div>
          <div class="gl-appr-card__meta">
            ${refNum ? `<span>${refNum}</span>` : ""}
            ${dateStr ? `<span>· ${dateStr}</span>` : ""}
            ${fundNames ? `<span>· ${fundNames}</span>` : ""}
          </div>
          <div class="gl-appr-card__byline">
            บันทึกโดย: ${escapeHtml(item.creatorName || "ไม่ระบุ")}
            ${item.hasReceipt ? `<span class="gl-appr-receipt" style="display: inline-flex; align-items: center; gap: 2px;"><span aria-hidden="true">${ICON_PAPERCLIP}</span>ใบเสร็จ</span>` : ""}
          </div>
        </div>
        <div class="num-display gl-appr-card__amount" style="color: ${dirColor};">
          ${amountSign}${item.amount.format()}
        </div>
      </div>
      <div class="gl-appr-card__foot">
        <span class="gl-badge gl-badge--pending">รออนุมัติ</span>
        <div class="gl-appr-card__actions">
          ${
            !item.isCreator
              ? `<button type="button" class="gl-btn gl-btn--primary gl-btn--sm gl-quick-approve"
                data-id="${escapeHtml(item.id)}"
                aria-label="อนุมัติ ${escapeHtml(item.description)}">${ICON_CHECK} อนุมัติ</button>`
              : `<span class="gl-appr-card__byline" style="font-style: italic;">คุณสร้างรายการนี้</span>`
          }
          <button type="button" class="gl-btn gl-btn--secondary gl-btn--sm gl-open-detail"
            data-id="${escapeHtml(item.id)}"
            aria-label="ดูรายละเอียด ${escapeHtml(item.description)}">ดูรายละเอียด</button>
        </div>
      </div>
      ${isSelected ? this.renderDetailPanel(item) : ""}
    </div>`;
  }

  private renderRejectionModal(item: PendingApprovalItem, type: "revision_requested" | "rejected"): string {
    const isRevision = type === "revision_requested";
    const title = isRevision ? "ส่งรายการกลับเพื่อขอให้แก้ไข" : "ปฏิเสธคำขอเบิกจ่าย";
    const submitLabel = isRevision ? "ยืนยันการส่งกลับเพื่อแก้ไข" : "ยืนยันการปฏิเสธคำขอ";
    const submitStyle = isRevision ? "" : "background: var(--expense); border-color: var(--expense);";
    return `
    <div class="gl-modal-backdrop gl-modal-backdrop--sheet">
      <div class="gl-modal-content gl-modal-content--sheet" role="dialog" aria-modal="true" aria-labelledby="gl-modal-title">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
          <h2 id="gl-modal-title" style="font-size: var(--text-md); font-weight: var(--weight-bold); margin: 0;">${title}</h2>
          <button type="button" class="gl-modal-close" aria-label="ปิด">&times;</button>
        </div>
        <div style="background: var(--secondary); border-radius: var(--radius); padding: var(--space-3); margin-bottom: var(--space-4); font-size: var(--text-xs);">
          <div><strong>รายการ:</strong> ${escapeHtml(item.description)}</div>
          ${item.referenceNumber ? `<div><strong>เลขที่:</strong> ${escapeHtml(item.referenceNumber)}</div>` : ""}
          <div><strong>มูลค่า:</strong> <span class="num-display">${item.amount.format()}</span></div>
        </div>
        <div style="margin-bottom: var(--space-4);">
          <label for="gl-rejection-reason" class="gl-label">เหตุผล <span style="color: var(--expense);">*</span></label>
          <textarea id="gl-rejection-reason" rows="4" maxlength="500" class="gl-textarea"
            style="resize: vertical; min-height: 100px;"></textarea>
          <div style="display: flex; justify-content: space-between; margin-top: var(--space-1); font-size: var(--text-2xs); color: var(--muted-foreground);">
            <span id="gl-reason-error" style="display: none; color: var(--expense);">กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร</span>
            <span id="gl-char-count" style="margin-left: auto;">0 / 5 ตัวอักษรขั้นต่ำ</span>
          </div>
        </div>
        <div style="display: flex; gap: var(--space-3);">
          <button type="button" class="gl-btn gl-btn--secondary gl-btn-cancel" style="flex: 1; min-height: 48px;">ยกเลิก</button>
          <button type="button" class="gl-btn gl-btn--primary gl-btn-submit"
            data-id="${escapeHtml(item.id)}" data-type="${type}"
            style="flex: 2; min-height: 48px; ${submitStyle}">
            ${submitLabel}
          </button>
        </div>
      </div>
    </div>`;
  }

  // ─── Main Render ──────────────────────────────────────────────────────────

  public renderHtml(user?: AppShellUser): string {
    if (this.isLoading) {
      return `
      <div class="gl-page gl-approvals-page-container gl-fade-in">
        <div class="gl-page-header"><h1>คิวรออนุมัติ</h1></div>
        <div class="gl-card gl-card--pad-lg gl-empty-center">
          <div class="gl-empty-center__icon" aria-hidden="true">${ICON_CLOCK}</div>
          <div class="gl-empty-center__hint">กำลังโหลดรายการรออนุมัติ…</div>
        </div>
      </div>`;
    }
    if (this.errorMessage) {
      return `
      <div class="gl-page gl-approvals-page-container gl-fade-in">
        <div class="gl-page-header"><h1>คิวรออนุมัติ</h1></div>
        <div class="gl-notice gl-notice--error" role="alert">
          <div class="gl-notice__body">
            <strong>โหลดคิวอนุมัติไม่สำเร็จ</strong>
            <div style="margin-top: var(--space-1);">${escapeHtml(this.errorMessage)}</div>
          </div>
          <button type="button" id="gl-btn-retry" class="gl-btn gl-btn--secondary gl-btn--sm">ลองใหม่</button>
        </div>
      </div>`;
    }

    let alertBannerHtml = "";
    if (this.staleWarning) {
      alertBannerHtml = `
      <div class="gl-notice gl-notice--warning gl-fade-in" role="status" style="margin-bottom: var(--space-4);">
        <div class="gl-notice__body">${escapeHtml(this.staleWarning)}</div>
        <button type="button" id="gl-btn-refresh-stale" class="gl-btn gl-btn--secondary gl-btn--sm">รีเฟรช</button>
      </div>`;
    } else if (this.successMessage) {
      alertBannerHtml = `
      <div class="gl-notice gl-notice--success gl-fade-in" role="status" style="margin-bottom: var(--space-4);">
        <div class="gl-notice__body">${escapeHtml(this.successMessage)}</div>
      </div>`;
    }

    const emptyHtml = `
    <div class="gl-card gl-card--pad-lg gl-empty-center">
      <div class="gl-empty-center__icon" aria-hidden="true">${ICON_CHECK_CIRCLE}</div>
      <p class="gl-empty-center__msg">ไม่มีรายการรอการตรวจสอบ</p>
      <p class="gl-empty-center__hint">รายการทั้งหมดได้รับการพิจารณาเรียบร้อยแล้ว</p>
    </div>`;

    const cardsHtml =
      this.items.length === 0 ? emptyHtml : this.items.map((item) => this.renderApprovalCard(item)).join("");
    const modalHtml = this.activeModal ? this.renderRejectionModal(this.activeModal.item, this.activeModal.type) : "";

    return `
    <div class="gl-page gl-approvals-page-container gl-fade-in">
      <div class="gl-page-header">
        <h1>คิวรออนุมัติ</h1>
        <button type="button" id="gl-btn-refresh-queue" class="gl-btn gl-btn--secondary gl-btn--sm"
          aria-label="รีเฟรชรายการ" style="min-height: 36px;">
          <span aria-hidden="true">${ICON_REFRESH}</span> รีเฟรช
        </button>
      </div>
      ${this.renderProfileHeader(user)}
      ${this.items.length > 0 ? this.renderSummaryStats() : ""}
      ${alertBannerHtml}
      <div id="gl-approvals-queue" role="list" aria-label="รายการรออนุมัติ">
        ${cardsHtml}
      </div>
      ${modalHtml}
    </div>`;
  }

  // ─── Event Listeners ──────────────────────────────────────────────────────

  public attachEventListeners(rootElement: HTMLElement, onRefreshNeeded?: () => void): void {
    const refresh = () => {
      if (onRefreshNeeded) onRefreshNeeded();
    };

    // 1. "ดูรายละเอียด" buttons — toggle detail panel via router
    const detailBtns = rootElement.querySelectorAll<HTMLElement>(".gl-open-detail");
    detailBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        if (!id) return;
        if (this.selectedItemId === id) {
          router.navigate("/approvals");
        } else {
          router.navigate(`/approvals/${id}`);
        }
      });
    });

    // 2. Close panel button
    const closeBtns = rootElement.querySelectorAll<HTMLElement>(".gl-sheet-close");
    closeBtns.forEach((btn) => {
      btn.addEventListener("click", () => router.navigate("/approvals"));
    });

    // 3. Quick-approve from list row
    const quickApproveBtns = rootElement.querySelectorAll<HTMLButtonElement>(".gl-quick-approve");
    quickApproveBtns.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        const item = this.items.find((i) => i.id === id);
        if (!item || item.isCreator) return;
        btn.disabled = true;
        btn.textContent = "กำลังอนุมัติ…";
        await this._handleApprove(item, refresh);
      });
    });

    // 4. Approve button in detail panel
    const approveBtn = rootElement.querySelector<HTMLButtonElement>(".gl-btn-approve");
    if (approveBtn) {
      approveBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = approveBtn.getAttribute("data-id") || this.selectedItemId;
        const item = this.items.find((i) => i.id === id);
        if (!item || item.isCreator) return;
        approveBtn.disabled = true;
        approveBtn.textContent = "กำลังอนุมัติ…";
        await this._handleApprove(item, refresh);
      });
    }

    // 5. Revision & Reject buttons in detail panel
    const selectedItem = this.items.find((i) => i.id === this.selectedItemId);
    const revisionBtn = rootElement.querySelector<HTMLElement>(".gl-btn-request-revision");
    const rejectBtn = rootElement.querySelector<HTMLElement>(".gl-btn-reject");

    if (revisionBtn && selectedItem) {
      revisionBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.activeModal = { type: "revision_requested", item: selectedItem };
        refresh();
      });
    }
    if (rejectBtn && selectedItem) {
      rejectBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.activeModal = { type: "rejected", item: selectedItem };
        refresh();
      });
    }

    // 6. Scroll expanded panel into view
    const decisionPanel = rootElement.querySelector<HTMLElement>(".gl-decision-panel");
    if (decisionPanel && this.selectedItemId) {
      decisionPanel.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    // 7. Modal events
    if (this.activeModal) {
      const modalClose = rootElement.querySelector<HTMLElement>(".gl-modal-close");
      const modalCancel = rootElement.querySelector<HTMLElement>(".gl-btn-cancel");
      const modalSubmit = rootElement.querySelector<HTMLButtonElement>(".gl-btn-submit");
      const reasonTextarea = rootElement.querySelector<HTMLTextAreaElement>("#gl-rejection-reason");
      const charCountSpan = rootElement.querySelector<HTMLElement>("#gl-char-count");
      const reasonError = rootElement.querySelector<HTMLElement>("#gl-reason-error");
      const backdrop = rootElement.querySelector<HTMLElement>(".gl-modal-backdrop");

      const closeModal = () => {
        this.activeModal = null;
        refresh();
      };
      if (modalClose) modalClose.addEventListener("click", closeModal);
      if (modalCancel) modalCancel.addEventListener("click", closeModal);
      if (backdrop) {
        backdrop.addEventListener("click", (e) => {
          if (e.target === backdrop) closeModal();
        });
      }
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", onKeyDown);
          closeModal();
        }
      };
      document.addEventListener("keydown", onKeyDown);
      if (reasonTextarea) reasonTextarea.focus();
      if (reasonTextarea && charCountSpan) {
        reasonTextarea.addEventListener("input", () => {
          const len = reasonTextarea.value.trim().length;
          charCountSpan.textContent = `${len} / 5 ตัวอักษรขั้นต่ำ`;
          if (len >= 5 && reasonError) reasonError.style.display = "none";
        });
      }
      if (modalSubmit && reasonTextarea && this.activeModal) {
        const modalType = this.activeModal.type;
        const targetItem = this.activeModal.item;
        modalSubmit.addEventListener("click", async () => {
          const reason = reasonTextarea.value.trim();
          if (reason.length < 5) {
            if (reasonError) reasonError.style.display = "block";
            return;
          }
          modalSubmit.disabled = true;
          modalSubmit.textContent = "กำลังบันทึก…";
          if (modalType === "revision_requested") {
            await this._handleRevision(targetItem, reason, refresh);
          } else {
            await this._handleTerminalReject(targetItem, reason, refresh);
          }
        });
      }
    }

    // 8. Refresh / Retry / Stale-refresh buttons
    const refreshBtn = rootElement.querySelector<HTMLElement>("#gl-btn-refresh-queue");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        this.staleWarning = null;
        this.successMessage = null;
        await this.loadQueue();
        refresh();
      });
    }
    const staleRefreshBtn = rootElement.querySelector<HTMLElement>("#gl-btn-refresh-stale");
    if (staleRefreshBtn) {
      staleRefreshBtn.addEventListener("click", async () => {
        this.staleWarning = null;
        await this.loadQueue();
        refresh();
      });
    }
    const retryBtn = rootElement.querySelector<HTMLElement>("#gl-btn-retry");
    if (retryBtn) {
      retryBtn.addEventListener("click", async () => {
        this.errorMessage = null;
        await this.loadQueue();
        refresh();
      });
    }
  }

  // ─── Private Action Handlers ──────────────────────────────────────────────

  private async _handleApprove(item: PendingApprovalItem, refresh: () => void): Promise<void> {
    const res = await this.approvalsService.approveTransaction({ transactionId: item.id });
    if (res.success) {
      this.successMessage = `อนุมัติรายการ "${item.description}" แล้ว รอลงบัญชี`;
      this.selectedItemId = null;
      await this.loadQueue();
      refresh();
      router.navigate("/approvals");
    } else if (res.error?.isStaleState) {
      this.staleWarning = "รายการนี้ได้รับการพิจารณาแล้ว";
      refresh();
    } else {
      this.errorMessage = toUserMessage(res.error?.message, "ไม่สามารถอนุมัติรายการได้");
      refresh();
    }
  }

  private async _handleRevision(item: PendingApprovalItem, reason: string, refresh: () => void): Promise<void> {
    const res = await this.approvalsService.requestRevision({ transactionId: item.id, revisionNote: reason });
    if (res.success) {
      this.successMessage = "ส่งกลับให้แก้ไขแล้ว";
      this.activeModal = null;
      this.selectedItemId = null;
      await this.loadQueue();
      refresh();
      router.navigate("/approvals");
    } else if (res.error?.isStaleState) {
      this.staleWarning = "รายการนี้ได้รับการพิจารณาแล้ว";
      this.activeModal = null;
      refresh();
    } else {
      this.errorMessage = toUserMessage(res.error?.message, "เกิดข้อผิดพลาดในการขอแก้ไข");
      refresh();
    }
  }

  private async _handleTerminalReject(item: PendingApprovalItem, reason: string, refresh: () => void): Promise<void> {
    const res = await this.approvalsService.rejectTransactionTerminal({ transactionId: item.id, rejectionReason: reason });
    if (res.success) {
      this.successMessage = "ปฏิเสธคำขอแล้ว";
      this.activeModal = null;
      this.selectedItemId = null;
      await this.loadQueue();
      refresh();
      router.navigate("/approvals");
    } else if (res.error?.isStaleState) {
      this.staleWarning = "รายการนี้ได้รับการพิจารณาแล้ว";
      this.activeModal = null;
      refresh();
    } else {
      this.errorMessage = toUserMessage(res.error?.message, "เกิดข้อผิดพลาดในการปฏิเสธคำขอ");
      refresh();
    }
  }
}
