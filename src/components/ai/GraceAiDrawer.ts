import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../../lib/supabase/types";
import { UserRole } from "../../lib/rbac";
import { GraceAiReadService, GraceAiFinancialResponse } from "../../lib/ai/grace-ai-read";
import { GraceAiDraftService, GraceAiDraftResponse } from "../../lib/ai/grace-ai-draft";
import { GraceAiProposalService, ActionProposalUiCard } from "../../lib/ai/grace-ai-proposals";
import { renderProposalConfirmationModalHtml } from "./ProposalConfirmationModal";
import { FinancialActionExecutionService } from "../../lib/ai/financial-action-endpoint";

export interface ChatMessage {
  id: string;
  sender: "user" | "grace_ai";
  text?: string;
  type?: "read_summary" | "draft_transfer" | "proposal" | "text" | "error";
  readResponse?: GraceAiFinancialResponse;
  draftTransfer?: any;
  proposal?: ActionProposalUiCard;
  timestamp: string;
}

export class GraceAiDrawer {
  private isOpen = false;
  private messages: ChatMessage[] = [];
  private isProcessing = false;
  private readService: GraceAiReadService;
  private draftService: GraceAiDraftService;
  private proposalService: GraceAiProposalService;
  private executionService: FinancialActionExecutionService;
  private activeProposal: ActionProposalUiCard | null = null;
  private isModalOpen = false;
  private modalLoading = false;
  private modalError: string | null = null;

  constructor(
    private supabase: SupabaseClient<Database>,
    private churchId: string,
    private userRole: UserRole,
    _userId: string
  ) {
    this.readService = new GraceAiReadService(supabase, churchId);
    this.draftService = new GraceAiDraftService(supabase, churchId);
    this.proposalService = new GraceAiProposalService(supabase, churchId);
    this.executionService = new FinancialActionExecutionService(supabase);

    // Initial greeting message
    this.messages.push({
      id: "msg-init",
      sender: "grace_ai",
      type: "text",
      text: "สวัสดีครับ ผมคือ Grace AI ผู้ช่วยทางการเงินของคริสตจักร คุณสามารถสอบถามรายงานการเงิน ตรวจสอบยอดกองทุน สร้างแบบร่างรายการ หรือขอเสนอรายการเพื่อรอการอนุมัติได้ครับ",
      timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
    });
  }

  public getIsOpen(): boolean {
    return this.isOpen;
  }

  public toggle(): void {
    this.isOpen = !this.isOpen;
  }

  public open(): void {
    this.isOpen = true;
  }

  public close(): void {
    this.isOpen = false;
  }

  public async processPrompt(rawPrompt: string, onUpdate: () => void): Promise<void> {
    const prompt = rawPrompt.trim();
    if (!prompt || this.isProcessing) return;

    this.isProcessing = true;
    const userMsgId = "msg-" + Date.now();
    this.messages.push({
      id: userMsgId,
      sender: "user",
      type: "text",
      text: prompt,
      timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
    });
    onUpdate();

    try {
      const lower = prompt.toLowerCase();

      // 1. READ Financial Summary / Balance Inquiry
      if (lower.includes("สรุป") || lower.includes("รายงาน") || lower.includes("ยอดเงิน") || lower.includes("กองทุน")) {
        const period = "2026-08";
        const res = await this.readService.getMonthlyFinancialSummary(period);

        if (res.success && res.facts) {
          this.messages.push({
            id: "msg-" + Date.now(),
            sender: "grace_ai",
            type: "read_summary",
            readResponse: res,
            timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          });
        } else {
          this.messages.push({
            id: "msg-" + Date.now(),
            sender: "grace_ai",
            type: "error",
            text: res.message || res.denial_reason || "ไม่สามารถดึงข้อมูลสรุปทางการเงินได้",
            timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          });
        }
      }
      // 2. DRAFT Transfer Inquiry (e.g. "ร่างการโอน 5000")
      else if (lower.includes("ร่าง") && lower.includes("โอน")) {
        const { data: funds } = await (this.supabase.from("funds") as any)
          .select("id, name")
          .eq("church_id", this.churchId)
          .limit(2);

        const fromFundId = funds?.[0]?.id || "00000000-0000-0000-0000-000000000001";
        const toFundId = funds?.[1]?.id || "00000000-0000-0000-0000-000000000002";

        const res: GraceAiDraftResponse = await this.draftService.createDraftTransfer({
          from_fund_id: fromFundId,
          to_fund_id: toFundId,
          amount: "5000.00",
          notes: "ร่างการโอนเงินสมทบพันธกิจ",
        });

        if (res.success && res.data) {
          this.messages.push({
            id: "msg-" + Date.now(),
            sender: "grace_ai",
            type: "draft_transfer",
            draftTransfer: res.data,
            timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          });
        } else {
          this.messages.push({
            id: "msg-" + Date.now(),
            sender: "grace_ai",
            type: "error",
            text: res.message || res.denial_reason || "ไม่สามารถสร้างแบบร่างการโอนเงินได้",
            timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          });
        }
      }
      // 3. ACTION PROPOSAL (e.g. "เสนอโอนเงิน" หรือ "เสนอรายการ")
      else if (lower.includes("เสนอ") || lower.includes("โอนเงิน") || lower.includes("จ่าย")) {
        const { data: funds } = await (this.supabase.from("funds") as any)
          .select("id, name")
          .eq("church_id", this.churchId)
          .limit(2);

        const fromFundId = funds?.[0]?.id || "00000000-0000-0000-0000-000000000001";
        const toFundId = funds?.[1]?.id || "00000000-0000-0000-0000-000000000002";

        const res = await this.proposalService.proposeFundTransfer({
          from_fund_id: fromFundId,
          to_fund_id: toFundId,
          amount: "5000.00",
          reason: "โอนเงินสนับสนุนโครงการค่ายเยาวชน",
        });

        if (res.success && res.proposal) {
          this.messages.push({
            id: "msg-" + Date.now(),
            sender: "grace_ai",
            type: "proposal",
            proposal: res.proposal,
            timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          });
        } else {
          this.messages.push({
            id: "msg-" + Date.now(),
            sender: "grace_ai",
            type: "error",
            text: res.message || res.denial_reason || "ไม่สามารถสร้างข้อเสนอทางการเงินได้",
            timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          });
        }
      }
      // General Natural Conversation fallback
      else {
        this.messages.push({
          id: "msg-" + Date.now(),
          sender: "grace_ai",
          type: "text",
          text: `ได้รับข้อความ "${prompt}" เรียบร้อยแล้วครับ คุณสามารถกดปุ่มคำสั่งด่วนด้านล่างเพื่อดูสรุปการเงิน ร่างรายการ หรือสร้างข้อเสนอทางการเงินได้ครับ`,
          timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
        });
      }
    } catch (err: any) {
      this.messages.push({
        id: "msg-" + Date.now(),
        sender: "grace_ai",
        type: "error",
        text: "เกิดข้อผิดพลาด: " + (err.message || "ระบบไม่สามารถประมวลผลได้"),
        timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      });
    } finally {
      this.isProcessing = false;
      onUpdate();
    }
  }

  public renderHtml(): string {
    if (!this.isOpen) {
      return `
      <!-- Floating AI Toggle Button -->
      <button id="gl-ai-drawer-toggle" class="gl-ai-fab" title="เปิด Grace AI Copilot" style="
        position: fixed;
        bottom: calc(var(--gl-mobilenav-h, 60px) + var(--space-4));
        right: var(--space-4);
        width: 52px;
        height: 52px;
        border-radius: var(--radius-full);
        background: linear-gradient(135deg, var(--primary) 0%, #1e40af 100%);
        color: var(--primary-foreground);
        border: 2px solid rgba(255, 255, 255, 0.2);
        box-shadow: var(--shadow-lg);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 950;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      `;
    }

    const modalHtml = this.isModalOpen && this.activeProposal
      ? renderProposalConfirmationModalHtml({
          proposal: this.activeProposal,
          isOpen: true,
          isLoading: this.modalLoading,
          error: this.modalError,
          currentUserRole: this.userRole,
        })
      : "";

    return `
    <!-- AI Drawer Backdrop -->
    <div id="gl-ai-backdrop" style="
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(2px);
      z-index: 1000;
      transition: opacity 0.2s ease;
    "></div>

    <!-- AI Drawer Container -->
    <aside id="gl-ai-drawer" class="gl-ai-drawer gl-slide-in-right" style="
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      max-width: 460px;
      background: color-mix(in srgb, var(--card) 90%, transparent);
      backdrop-filter: blur(20px) saturate(160%);
      -webkit-backdrop-filter: blur(20px) saturate(160%);
      border-left: 1px solid color-mix(in srgb, var(--foreground) 10%, var(--border));
      box-shadow: var(--shadow-xl);
      z-index: 1001;
      display: flex;
      flex-direction: column;
    ">
      <!-- Drawer Header -->
      <div style="
        padding: var(--space-4) var(--space-5);
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: color-mix(in srgb, var(--primary) 6%, var(--card));
      ">
        <div style="display: flex; align-items: center; gap: var(--space-3);">
          <div style="
            width: 32px;
            height: 32px;
            border-radius: var(--radius-sm);
            background: var(--primary);
            color: var(--primary-foreground);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: var(--weight-bold);
            font-size: var(--text-xs);
          ">AI</div>
          <div>
            <div style="font-weight: var(--weight-bold); font-size: var(--text-sm);">Grace AI Copilot</div>
            <div style="font-size: var(--text-2xs); color: var(--muted-foreground);">ผู้ช่วยการเงินคริสตจักร • ปลอดภัยตามมาตรฐาน</div>
          </div>
        </div>
        <button id="gl-ai-drawer-close" class="gl-btn gl-btn--icon gl-btn--ghost" title="ปิดหน้าต่าง">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Quick Prompt Chips -->
      <div style="
        padding: var(--space-2) var(--space-4);
        border-bottom: 1px solid var(--border);
        display: flex;
        gap: var(--space-2);
        overflow-x: auto;
        white-space: nowrap;
        background: var(--surface-subtle, rgba(0,0,0,0.02));
      ">
        <button class="gl-ai-chip gl-btn gl-btn--xs gl-btn--secondary" data-prompt="สรุปการเงินเดือนนี้">สรุปการเงิน</button>
        <button class="gl-ai-chip gl-btn gl-btn--xs gl-btn--secondary" data-prompt="ตรวจสอบยอดเงินกองทุน">ยอดกองทุน</button>
        <button class="gl-ai-chip gl-btn gl-btn--xs gl-btn--secondary" data-prompt="ร่างการโอนเงิน 5000">ร่างโอนเงิน</button>
        <button class="gl-ai-chip gl-btn gl-btn--xs gl-btn--secondary" data-prompt="เสนอโอนเงิน 5000">เสนอโอนเงิน</button>
      </div>

      <!-- Messages Stream -->
      <div id="gl-ai-messages-container" style="
        flex: 1;
        overflow-y: auto;
        padding: var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      ">
        ${this.messages.map((m) => this.renderMessage(m)).join("")}
        ${
          this.isProcessing
            ? `
        <div style="display: flex; align-items: center; gap: var(--space-2); color: var(--muted-foreground); font-size: var(--text-xs); padding: var(--space-2);">
          <span class="gl-spinner" style="width: 14px; height: 14px; border-width: 2px;"></span>
          <span>Grace AI กำลังประมวลผล...</span>
        </div>`
            : ""
        }
      </div>

      <!-- Drawer Input Bar -->
      <div style="
        padding: var(--space-3) var(--space-4);
        border-top: 1px solid var(--border);
        background: var(--card);
      ">
        <form id="gl-ai-input-form" style="display: flex; gap: var(--space-2);">
          <input
            type="text"
            id="gl-ai-prompt-input"
            class="gl-input"
            placeholder="พิมพ์คำถามหรือคำสั่งทางการเงิน..."
            ${this.isProcessing ? "disabled" : ""}
            autocomplete="off"
            style="flex: 1; font-size: var(--text-sm);"
          />
          <button
            type="submit"
            class="gl-btn gl-btn--primary"
            ${this.isProcessing ? "disabled" : ""}
            style="padding: 0 var(--space-3);"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </form>
      </div>
    </aside>

    <!-- Confirmation Modal Container if Active -->
    ${modalHtml}
    `;
  }

  private renderMessage(msg: ChatMessage): string {
    const isUser = msg.sender === "user";

    if (isUser) {
      return `
      <div style="align-self: flex-end; max-width: 85%;">
        <div style="
          background: var(--primary);
          color: var(--primary-foreground);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md) var(--radius-md) 0 var(--radius-md);
          font-size: var(--text-sm);
        ">
          ${msg.text}
        </div>
        <div style="font-size: var(--text-2xs); color: var(--muted-foreground); text-align: right; margin-top: 2px;">
          ${msg.timestamp}
        </div>
      </div>
      `;
    }

    // AI Response Rendering
    let innerContent = "";

    if (msg.type === "read_summary" && msg.readResponse?.facts) {
      const facts = msg.readResponse.facts;
      const provenance = msg.readResponse.provenance;
      innerContent = `
      <div style="display: flex; flex-direction: column; gap: var(--space-3);">
        <!-- FACTS -->
        <div style="background: color-mix(in srgb, var(--primary) 5%, transparent); padding: var(--space-3); border-radius: var(--radius-sm); border-left: 3px solid var(--primary);">
          <div style="font-size: var(--text-2xs); font-weight: var(--weight-bold); color: var(--primary); margin-bottom: var(--space-1);">
            ข้อมูลข้อเท็จจริงทางบัญชี
          </div>
          <div style="font-size: var(--text-xs); line-height: 1.5;">
            <div>• รายรับงวด: <strong>${facts.total_income} บาท</strong></div>
            <div>• รายจ่ายงวด: <strong>${facts.total_expense} บาท</strong></div>
            <div>• กระแสเงินสดสุทธิ: <strong>${facts.net_cashflow} บาท</strong></div>
            <div>• ยอดรวมทุกกองทุน: <strong>${facts.total_funds_balance} บาท</strong></div>
          </div>
        </div>

        <!-- ANALYSIS -->
        <div style="font-size: var(--text-xs); color: var(--foreground); line-height: 1.4;">
          <strong>การวิเคราะห์:</strong> ${msg.readResponse.analysis || "สถานะกระแสเงินสดในงวดนี้มีรายรับสุทธิที่มั่นคง"}
        </div>

        <!-- INTERPRETATION -->
        ${
          msg.readResponse.interpretation
            ? `<div style="font-size: var(--text-xs); color: var(--text-muted); font-style: italic; line-height: 1.4;">
                ${msg.readResponse.interpretation}
               </div>`
            : ""
        }

        <!-- PROVENANCE -->
        ${
          provenance
            ? `<div style="font-size: var(--text-2xs); color: var(--muted-foreground); display: flex; align-items: center; gap: 4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>แหล่งข้อมูล: บัญชีแยกประเภท (${provenance.source_type})</span>
               </div>`
            : ""
        }
      </div>
      `;
    } else if (msg.type === "draft_transfer" && msg.draftTransfer) {
      const draft = msg.draftTransfer;
      const formattedAmount = String(draft.amount || "").startsWith("฿") ? draft.amount : `฿${draft.amount}`;
      const statusText = draft.status || "draft";
      innerContent = `
      <div class="gl-card" style="padding: var(--space-3); border: 1px dashed var(--border); background: var(--surface-subtle, rgba(0,0,0,0.02));">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
          <span style="font-weight: var(--weight-bold); font-size: var(--text-xs); color: var(--primary);">แบบร่างการโอนเงิน</span>
          <span class="gl-badge gl-badge--warning" style="font-size: 10px;">ยังไม่กระทบยอดเงิน</span>
        </div>
        <div style="font-size: var(--text-xs); line-height: 1.5; margin-bottom: var(--space-2);">
          <div>• จำนวนเงิน: <strong>${formattedAmount}</strong></div>
          <div>• หมายเหตุ: ${draft.notes || draft.reason || "ไม่ระบุ"}</div>
          <div>• สถานะ: <em>${statusText}</em></div>
        </div>
        <div style="font-size: 11px; color: var(--muted-foreground);">
          * รายการนี้เป็นเพียงแบบร่าง ยังไม่มีการตัดหรือเพิ่มยอดเงินในกองทุนจริง
        </div>
      </div>
      `;
    } else if (msg.type === "proposal" && msg.proposal) {
      const prop = msg.proposal;
      innerContent = `
      <div class="gl-card" style="padding: var(--space-3); border: 1px solid var(--primary); background: color-mix(in srgb, var(--primary) 4%, transparent);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
          <span style="font-weight: var(--weight-bold); font-size: var(--text-xs); color: var(--primary);">ข้อเสนอการดำเนินการ</span>
          <span class="gl-badge gl-badge--info" style="font-size: 10px;">รอการยืนยัน</span>
        </div>
        <div style="font-size: var(--text-xs); line-height: 1.5; margin-bottom: var(--space-3);">
          <div>• การดำเนินการ: <strong>${prop.title || prop.action}</strong></div>
          <div>• จำนวนเงิน: <strong>${prop.amount}</strong></div>
          <div>• รายละเอียด: ${prop.summary}</div>
          <div>• ผลกระทบทางการเงิน: ${prop.financial_effect}</div>
          <div>• อายุคำขอ: 5 นาที</div>
        </div>
        <button
          class="gl-btn gl-btn--sm gl-btn--primary gl-ai-review-proposal-btn"
          style="width: 100%; justify-content: center;"
        >
          ตรวจสอบและยืนยันการดำเนินการ
        </button>
      </div>
      `;
    } else if (msg.type === "error") {
      innerContent = `
      <div class="gl-notice gl-notice--error" style="padding: var(--space-2) var(--space-3); font-size: var(--text-xs);">
        ${msg.text}
      </div>
      `;
    } else {
      innerContent = `
      <div style="font-size: var(--text-sm); line-height: 1.5;">
        ${msg.text}
      </div>
      `;
    }

    return `
    <div style="align-self: flex-start; max-width: 90%;">
      <div style="
        background: var(--surface);
        border: 1px solid var(--border);
        padding: var(--space-3);
        border-radius: 0 var(--radius-md) var(--radius-md) var(--radius-md);
        box-shadow: var(--shadow-xs);
      ">
        ${innerContent}
      </div>
      <div style="font-size: var(--text-2xs); color: var(--muted-foreground); margin-top: 2px;">
        Grace AI • ${msg.timestamp}
      </div>
    </div>
    `;
  }

  public attachEventListeners(root: HTMLElement, onStateChange: () => void): void {
    // Toggle / Open / Close
    const toggleBtn = root.querySelector<HTMLButtonElement>("#gl-ai-drawer-toggle");
    toggleBtn?.addEventListener("click", () => {
      this.toggle();
      onStateChange();
    });

    const closeBtn = root.querySelector<HTMLButtonElement>("#gl-ai-drawer-close");
    closeBtn?.addEventListener("click", () => {
      this.close();
      onStateChange();
    });

    const backdrop = root.querySelector<HTMLDivElement>("#gl-ai-backdrop");
    backdrop?.addEventListener("click", () => {
      this.close();
      onStateChange();
    });

    // Quick Chips
    const chips = root.querySelectorAll<HTMLButtonElement>(".gl-ai-chip");
    chips.forEach((chip) => {
      chip.addEventListener("click", async () => {
        const prompt = chip.getAttribute("data-prompt") || "";
        await this.processPrompt(prompt, onStateChange);
      });
    });

    // Form Submit
    const form = root.querySelector<HTMLFormElement>("#gl-ai-input-form");
    const input = root.querySelector<HTMLInputElement>("#gl-ai-prompt-input");

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const prompt = input?.value || "";
      if (prompt.trim()) {
        if (input) input.value = "";
        await this.processPrompt(prompt, onStateChange);
      }
    });

    // Review Proposal Button -> Opens ProposalConfirmationModal
    const reviewBtns = root.querySelectorAll<HTMLButtonElement>(".gl-ai-review-proposal-btn");
    reviewBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        // Find latest proposal
        const lastPropMsg = [...this.messages].reverse().find((m) => m.type === "proposal" && m.proposal);
        if (lastPropMsg && lastPropMsg.proposal) {
          this.activeProposal = lastPropMsg.proposal;
          this.isModalOpen = true;
          this.modalError = null;
          onStateChange();
        }
      });
    });

    // Modal Events
    if (this.isModalOpen) {
      const modalCancel = root.querySelector<HTMLButtonElement>("#gl-proposal-modal-cancel");
      const modalClose = root.querySelector<HTMLButtonElement>("#gl-proposal-modal-close");
      const modalBackdrop = root.querySelector<HTMLDivElement>("#gl-proposal-modal-backdrop");
      const modalConfirm = root.querySelector<HTMLButtonElement>("#gl-proposal-modal-confirm");

      modalCancel?.addEventListener("click", () => {
        this.isModalOpen = false;
        this.activeProposal = null;
        onStateChange();
      });

      modalClose?.addEventListener("click", () => {
        this.isModalOpen = false;
        this.activeProposal = null;
        onStateChange();
      });

      modalBackdrop?.addEventListener("click", (e) => {
        if (e.target === modalBackdrop) {
          this.isModalOpen = false;
          this.activeProposal = null;
          onStateChange();
        }
      });

      modalConfirm?.addEventListener("click", async () => {
        if (!this.activeProposal || this.modalLoading) return;

        this.modalLoading = true;
        this.modalError = null;
        onStateChange();

        try {
          const res = await this.executionService.executeAction({
            confirmation_id: this.activeProposal.confirmation_id,
            nonce: this.activeProposal.nonce,
            payload_hash: this.activeProposal.payload_hash,
          });

          if (res.success) {
            this.isModalOpen = false;
            this.activeProposal = null;
            this.messages.push({
              id: "msg-" + Date.now(),
              sender: "grace_ai",
              type: "text",
              text: `${res.message} (รหัสอ้างอิง: ${res.resource_id})`,
              timestamp: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
            });
          } else {
            this.modalError = res.message || res.error || "ดำเนินการไม่สำเร็จ";
          }
        } catch (err: any) {
          this.modalError = err.message || "เกิดข้อผิดพลาดในการทำรายการ";
        } finally {
          this.modalLoading = false;
          onStateChange();
        }
      });
    }
  }
}
