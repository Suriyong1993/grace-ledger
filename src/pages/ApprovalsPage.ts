import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../lib/supabase/types";
import { ApprovalsService } from "../lib/transactions/approvals-service";
import { PendingApprovalItem } from "../lib/transactions/types";
import { Money } from "../lib/money";
import { renderApprovalsQueueViewHtml } from "../components/approvals/ApprovalsQueueView";
import { renderApprovalDecisionSheetHtml } from "../components/approvals/ApprovalDecisionSheet";
import { renderRejectionModalHtml } from "../components/approvals/RejectionModal";
import { router } from "../router";
import { toUserMessage } from "../lib/format";

export class ApprovalsPage {
  private approvalsService: ApprovalsService;
  private items: PendingApprovalItem[] = [];
  private selectedItemId: string | null = null;
  private activeModal: { type: "revision_requested" | "rejected"; item: PendingApprovalItem } | null = null;
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

  public renderHtml(): string {
    if (this.isLoading) {
      return `
      <div class="gl-page gl-approvals-page-container gl-fade-in">
        ${renderApprovalsQueueViewHtml({ items: [], isLoading: true })}
      </div>
      `;
    }

    if (this.errorMessage) {
      return `
      <div class="gl-page gl-approvals-page-container gl-fade-in">
        <div class="gl-notice gl-notice--error" role="alert">
          <div class="gl-notice__body">
            <strong>โหลดคิวอนุมัติไม่สำเร็จ</strong>
            <div style="margin-top: var(--space-1);">${this.errorMessage}</div>
          </div>
          <button type="button" id="gl-btn-retry" class="gl-btn gl-btn--secondary gl-btn--sm">ลองใหม่</button>
        </div>
      </div>
      `;
    }

    let alertBannerHtml = "";
    if (this.staleWarning) {
      alertBannerHtml = `
      <div class="gl-notice gl-notice--warning gl-fade-in" role="status" style="margin-bottom: var(--space-4);">
        <div class="gl-notice__body">${this.staleWarning}</div>
        <button type="button" id="gl-btn-refresh-queue" class="gl-btn gl-btn--secondary gl-btn--sm">รีเฟรช</button>
      </div>
      `;
    } else if (this.successMessage) {
      alertBannerHtml = `
      <div class="gl-notice gl-notice--success gl-fade-in" role="status" style="margin-bottom: var(--space-4);">
        <div class="gl-notice__body">${this.successMessage}</div>
      </div>
      `;
    }

    const queueHtml = renderApprovalsQueueViewHtml({
      items: this.items,
      selectedId: this.selectedItemId,
    });

    let decisionSheetHtml = "";
    if (this.selectedItemId) {
      const selectedItem = this.items.find((i) => i.id === this.selectedItemId);
      if (selectedItem) {
        const projections = (selectedItem.splits || []).map((split) => {
          const currentBal = split.fundBalance || Money.zero();
          const impact = selectedItem.direction === "expense" ? Money.zero().subtract(split.amount) : split.amount;
          const projBal = currentBal.add(impact);
          const isDeficit = projBal.isNegative();
          return {
            fundId: split.fundId,
            fundName: split.fundName || "กองทุน",
            currentPostedBalance: currentBal,
            approvedUnpostedImpact: Money.zero(),
            evaluatingTransactionImpact: impact,
            projectedBalance: projBal,
            isDeficit,
            deficitAmount: isDeficit ? projBal.abs() : undefined,
          };
        });

        decisionSheetHtml = renderApprovalDecisionSheetHtml({
          item: selectedItem,
          projections,
        });
      }
    }

    let modalHtml = "";
    if (this.activeModal) {
      modalHtml = renderRejectionModalHtml({
        transactionId: this.activeModal.item.id,
        referenceNumber: this.activeModal.item.referenceNumber,
        amount: this.activeModal.item.amount.format(),
        type: this.activeModal.type,
      });
    }

    return `
    <div class="gl-page gl-approvals-page-container">
      ${alertBannerHtml}
      ${queueHtml}
      ${decisionSheetHtml}
      ${modalHtml}
    </div>
    `;
  }

  public attachEventListeners(rootElement: HTMLElement, onRefreshNeeded?: () => void): void {
    // 1. Click on Queue items to navigate to /approvals/:id
    const cards = rootElement.querySelectorAll<HTMLElement>(".gl-approval-item, .gl-btn-open-decision, .gl-approval-card");
    cards.forEach((card) => {
      card.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = card.getAttribute("data-id");
        if (id) {
          router.navigate(`/approvals/${id}`);
        }
      });
    });

    // 2. Bring the decision sheet into view and move focus into it
    const sheet = rootElement.querySelector<HTMLElement>(".gl-decision-sheet");
    if (sheet && this.selectedItemId) {
      sheet.scrollIntoView({ block: "start", behavior: "smooth" });
      const heading = sheet.querySelector<HTMLElement>("#gl-decision-title");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    }

    // 2b. Close decision sheet
    const closeBtn = rootElement.querySelector<HTMLElement>(".gl-sheet-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        router.navigate("/approvals");
      });
    }

    // 3. Action Buttons in Decision Sheet
    const approveBtn = rootElement.querySelector<HTMLButtonElement>(".gl-btn-approve");
    const revisionBtn = rootElement.querySelector<HTMLButtonElement>(".gl-btn-request-revision");
    const rejectBtn = rootElement.querySelector<HTMLButtonElement>(".gl-btn-reject");

    const selectedItem = this.items.find((i) => i.id === this.selectedItemId);

    if (approveBtn && selectedItem && !selectedItem.isCreator) {
      approveBtn.addEventListener("click", async () => {
        approveBtn.disabled = true;
        approveBtn.innerText = "กำลังอนุมัติ...";
        const res = await this.approvalsService.approveTransaction({
          transactionId: selectedItem.id,
        });

        if (res.success) {
          this.successMessage = "อนุมัติแล้ว รอลงบัญชี";
          this.selectedItemId = null;
          await this.loadQueue();
          if (onRefreshNeeded) onRefreshNeeded();
          router.navigate("/approvals");
        } else if (res.error?.isStaleState) {
          this.staleWarning = "รายการนี้ได้รับการพิจารณาแล้ว";
          if (onRefreshNeeded) onRefreshNeeded();
        } else {
          this.errorMessage = toUserMessage(res.error?.message, "ไม่สามารถอนุมัติรายการได้");
          if (onRefreshNeeded) onRefreshNeeded();
        }
      });
    }

    if (revisionBtn && selectedItem) {
      revisionBtn.addEventListener("click", () => {
        this.activeModal = { type: "revision_requested", item: selectedItem };
        if (onRefreshNeeded) onRefreshNeeded();
      });
    }

    if (rejectBtn && selectedItem) {
      rejectBtn.addEventListener("click", () => {
        this.activeModal = { type: "rejected", item: selectedItem };
        if (onRefreshNeeded) onRefreshNeeded();
      });
    }

    // 4. Rejection / Revision Modal Events
    if (this.activeModal) {
      const modalClose = rootElement.querySelector<HTMLElement>(".gl-modal-close");
      const modalCancel = rootElement.querySelector<HTMLElement>(".gl-btn-cancel");
      const modalSubmit = rootElement.querySelector<HTMLButtonElement>(".gl-btn-submit");
      const reasonTextarea = rootElement.querySelector<HTMLTextAreaElement>("#gl-rejection-reason");
      const charCountSpan = rootElement.querySelector<HTMLElement>("#gl-char-count");
      const reasonError = rootElement.querySelector<HTMLElement>("#gl-reason-error");

      const closeModal = () => {
        this.activeModal = null;
        if (onRefreshNeeded) onRefreshNeeded();
      };

      if (modalClose) modalClose.addEventListener("click", closeModal);
      if (modalCancel) modalCancel.addEventListener("click", closeModal);

      const backdrop = rootElement.querySelector<HTMLElement>(".gl-modal-backdrop");
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

      if (reasonTextarea) {
        reasonTextarea.focus();
      }

      if (reasonTextarea && charCountSpan) {
        reasonTextarea.addEventListener("input", () => {
          const len = reasonTextarea.value.trim().length;
          charCountSpan.innerText = `${len} / 5 ตัวอักษรขั้นต่ำ`;
          if (len >= 5 && reasonError) {
            reasonError.style.display = "none";
          }
        });
      }

      if (modalSubmit && reasonTextarea && this.activeModal) {
        const modalType = this.activeModal.type;
        const targetId = this.activeModal.item.id;

        modalSubmit.addEventListener("click", async () => {
          const reason = reasonTextarea.value.trim();
          if (reason.length < 5) {
            if (reasonError) reasonError.style.display = "block";
            return;
          }

          modalSubmit.disabled = true;
          modalSubmit.innerText = "กำลังบันทึก...";

          if (modalType === "revision_requested") {
            const res = await this.approvalsService.requestRevision({
              transactionId: targetId,
              revisionNote: reason,
            });

            if (res.success) {
              this.successMessage = "ส่งกลับให้แก้ไขแล้ว";
              this.activeModal = null;
              this.selectedItemId = null;
              await this.loadQueue();
              if (onRefreshNeeded) onRefreshNeeded();
              router.navigate("/approvals");
            } else if (res.error?.isStaleState) {
              this.staleWarning = "รายการนี้ได้รับการพิจารณาแล้ว";
              this.activeModal = null;
              if (onRefreshNeeded) onRefreshNeeded();
            } else {
              this.errorMessage = toUserMessage(res.error?.message, "เกิดข้อผิดพลาดในการขอแก้ไข");
              if (onRefreshNeeded) onRefreshNeeded();
            }
          } else {
            // Terminal Reject
            const res = await this.approvalsService.rejectTransactionTerminal({
              transactionId: targetId,
              rejectionReason: reason,
            });

            if (res.success) {
              this.successMessage = "ปฏิเสธคำขอแล้ว";
              this.activeModal = null;
              this.selectedItemId = null;
              await this.loadQueue();
              if (onRefreshNeeded) onRefreshNeeded();
              router.navigate("/approvals");
            } else if (res.error?.isStaleState) {
              this.staleWarning = "รายการนี้ได้รับการพิจารณาแล้ว";
              this.activeModal = null;
              if (onRefreshNeeded) onRefreshNeeded();
            } else {
              this.errorMessage = toUserMessage(res.error?.message, "เกิดข้อผิดพลาดในการปฏิเสธคำขอ");
              if (onRefreshNeeded) onRefreshNeeded();
            }
          }
        });
      }
    }

    // 5. Refresh / Retry buttons
    const refreshBtn = rootElement.querySelector<HTMLElement>("#gl-btn-refresh-queue");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        this.staleWarning = null;
        await this.loadQueue();
        if (onRefreshNeeded) onRefreshNeeded();
      });
    }

    const retryBtn = rootElement.querySelector<HTMLElement>("#gl-btn-retry");
    if (retryBtn) {
      retryBtn.addEventListener("click", async () => {
        this.errorMessage = null;
        await this.loadQueue();
        if (onRefreshNeeded) onRefreshNeeded();
      });
    }
  }
}
