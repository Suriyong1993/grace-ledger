import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../../lib/supabase/types";
import { UserRole } from "../../lib/rbac";
import { GraceAiReadService } from "../../lib/ai/grace-ai-read";
import { GraceAiDraftService } from "../../lib/ai/grace-ai-draft";
import { GraceAiProposalService, ActionProposalUiCard } from "../../lib/ai/grace-ai-proposals";
import { FinancialActionExecutionService } from "../../lib/ai/financial-action-endpoint";
import { renderProposalConfirmationModalHtml } from "../ai/ProposalConfirmationModal";
import { toUserMessage } from "../../lib/format";
import { renderAiDrawerStyles } from "./aiDrawerStyles";
import { escapeHtml } from "./html";
import { renderReadProvenanceCard } from "./cards/ReadProvenanceCard";
import { renderDraftTransactionCard } from "./cards/DraftTransactionCard";
import { renderActionProposalCard } from "./cards/ActionProposalCard";
import {
  ActionProposalPayload,
  AiChatMessage,
  AiDrawerCallbacks,
  DraftTransactionPayload,
  ReadMessageContent,
  actionProposalFromService,
  readProvenanceFromService,
} from "./types";

const QUICK_PROMPTS: ReadonlyArray<{ readonly label: string; readonly prompt: string }> = [
  { label: "สรุปการเงินเดือนนี้", prompt: "สรุปการเงินเดือนนี้" },
  { label: "ร่างโอนเงินระหว่างกองทุน", prompt: "ร่างการโอนเงิน 5,000 ระหว่างกองทุน" },
  { label: "เสนอโอนเงินเพื่ออนุมัติ", prompt: "เสนอโอนเงิน 5,000 ระหว่างกองทุน" },
];

const GREETING =
  "สวัสดีครับ ผมช่วยสรุปการเงิน จัดร่างรายการ และเสนอรายการเพื่อรอการยืนยันจากคุณได้ ทุกตัวเลขอ้างอิงจากบัญชีจริงเสมอ";

function extractAmount(prompt: string): string | null {
  const match = prompt.match(/([0-9][0-9,]*(?:\.[0-9]{1,2})?)/);
  return match ? match[1].replace(/,/g, "") : null;
}

/**
 * Grace AI Drawer controller — renders the copilot surface (FAB + slide-in
 * drawer + message stream) and delegates every state-changing decision to
 * the human: drafts route to Transactions, proposals open the existing
 * ProposalConfirmationModal. The controller never executes an action on its
 * own initiative.
 */
export class GraceAiDrawer {
  private isOpen = false;
  private isProcessing = false;
  private messages: AiChatMessage[] = [];
  private readonly proposals = new Map<string, ActionProposalUiCard>();
  private renderedDrafts: readonly DraftTransactionPayload[] = [];
  private isModalOpen = false;
  private modalLoading = false;
  private modalError: string | null = null;
  private activeProposal: ActionProposalUiCard | null = null;
  private idSeq = 0;
  private callbacks: AiDrawerCallbacks = {};

  private readonly supabase: SupabaseClient<Database>;
  private readonly readService: GraceAiReadService;
  private readonly draftService: GraceAiDraftService;
  private readonly proposalService: GraceAiProposalService;
  private readonly executionService: FinancialActionExecutionService;

  constructor(
    supabase: SupabaseClient<Database>,
    private readonly churchId: string,
    private readonly userRole: UserRole,
    _userId: string,
    callbacks: AiDrawerCallbacks = {}
  ) {
    this.supabase = supabase;
    this.readService = new GraceAiReadService(supabase, churchId);
    this.draftService = new GraceAiDraftService(supabase, churchId);
    this.proposalService = new GraceAiProposalService(supabase, churchId);
    this.executionService = new FinancialActionExecutionService(supabase);
    this.callbacks = callbacks;
    this.messages.push({
      id: this.nextId(),
      sender: "grace_ai",
      kind: "text",
      text: GREETING,
      timestamp: this.nowLabel(),
    });
  }

  public getIsOpen(): boolean {
    return this.isOpen;
  }

  public open(): void {
    this.isOpen = true;
  }

  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.callbacks.onClose?.();
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  public renderHtml(): string {
    this.renderedDrafts = [];
    const surface = this.isOpen
      ? `${this.renderBackdropHtml()}${this.renderPanelHtml()}`
      : this.renderFabHtml();
    return `${renderAiDrawerStyles()}${surface}${this.renderModalHtml()}`;
  }

  private renderFabHtml(): string {
    return `
      <button type="button" id="gl-aid-toggle" class="gl-aid-fab" aria-label="เปิด Grace AI Copilot" title="เปิด Grace AI Copilot">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/>
          <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"/>
        </svg>
      </button>
    `;
  }

  private renderBackdropHtml(): string {
    return `<div id="gl-aid-backdrop" class="gl-aid-backdrop"></div>`;
  }

  private renderPanelHtml(): string {
    const chips = QUICK_PROMPTS.map(
      (chip) =>
        `<button type="button" class="gl-aid-chip" data-aid-prompt="${escapeHtml(chip.prompt)}"${this.isProcessing ? " disabled" : ""}>${escapeHtml(chip.label)}</button>`
    ).join("");
    return `
      <aside id="gl-aid-drawer" class="gl-aid-drawer" role="dialog" aria-modal="true" aria-label="Grace AI Copilot">
        <header class="gl-aid-header">
          <span class="gl-aid-mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 5.5C6 4.67157 6.67157 4 7.5 4H16.5C17.3284 4 18 4.67157 18 5.5V19.5L12 16.5L6 19.5V5.5Z" fill="currentColor"/>
            </svg>
          </span>
          <div class="gl-aid-heading">
            <strong>Grace AI Copilot</strong>
            <span>ผู้ช่วยการเงิน · ทุกการเปลี่ยนแปลงรอการยืนยันจากคุณ</span>
          </div>
          <button type="button" id="gl-aid-close" class="gl-aid-close" aria-label="ปิดหน้าต่าง">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>
        <div class="gl-aid-stream" id="gl-aid-stream" role="log" aria-live="polite">
          ${this.messages.map((message) => this.renderMessage(message)).join("")}
          ${this.isProcessing ? this.renderTypingHtml() : ""}
        </div>
        <div class="gl-aid-chips">${chips}</div>
        <form id="gl-aid-input-form" class="gl-aid-inputbar">
          <input
            id="gl-aid-input"
            class="gl-input"
            type="text"
            autocomplete="off"
            placeholder="ถามเรื่องการเงินของคริสตจักร..."
            aria-label="ข้อความถึง Grace AI"
            ${this.isProcessing ? "disabled" : ""}
          />
          <button type="submit" class="gl-btn gl-btn--primary gl-aid-send" aria-label="ส่งข้อความ"${this.isProcessing ? " disabled" : ""}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </button>
        </form>
      </aside>
    `;
  }

  private renderTypingHtml(): string {
    return `
      <div class="gl-aid-row">
        <div class="gl-aid-bubble gl-aid-bubble--typing">
          <span class="gl-aid-spinner" aria-hidden="true"></span>กำลังคิด...
        </div>
      </div>
    `;
  }

  private renderMessage(message: AiChatMessage): string {
    if (message.kind === "text") {
      if (message.sender === "user") {
        return `
          <div class="gl-aid-row gl-aid-row--user">
            <div class="gl-aid-bubble gl-aid-bubble--user">${escapeHtml(message.text)}</div>
            <span class="gl-aid-meta">${escapeHtml(message.timestamp)}</span>
          </div>
        `;
      }
      return `
        <div class="gl-aid-row">
          <div class="gl-aid-bubble">${escapeHtml(message.text)}</div>
          <span class="gl-aid-meta">Grace AI · ${escapeHtml(message.timestamp)}</span>
        </div>
      `;
    }
    let body: string;
    if (message.kind === "read") {
      body = renderReadProvenanceCard(message.read);
    } else if (message.kind === "draft") {
      const draftIndex = this.renderedDrafts.length;
      this.renderedDrafts = [...this.renderedDrafts, message.draft];
      body = renderDraftTransactionCard(message.draft, { draftIndex });
    } else if (message.kind === "proposal") {
      body = renderActionProposalCard(message.proposal);
    } else {
      body = `<div class="gl-notice gl-notice--error gl-aid-bubble--error" role="alert">${escapeHtml(message.text)}</div>`;
    }
    return `
      <div class="gl-aid-row">
        ${body}
        <span class="gl-aid-meta">Grace AI · ${escapeHtml(message.timestamp)}</span>
      </div>
    `;
  }

  private renderModalHtml(): string {
    if (!this.isModalOpen) return "";
    return renderProposalConfirmationModalHtml({
      proposal: this.activeProposal,
      isOpen: this.isModalOpen,
      isLoading: this.modalLoading,
      error: this.modalError,
      currentUserRole: this.userRole,
    });
  }

  private nextId(): string {
    this.idSeq += 1;
    return `aid-${this.idSeq}`;
  }

  private nowLabel(): string {
    return new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  }

  private pushMessage(message: AiChatMessage, notify: () => void): void {
    this.messages = [...this.messages, message];
    notify();
  }

  private pushError(text: string, notify: () => void): void {
    this.pushMessage(
      { id: this.nextId(), sender: "grace_ai", kind: "error", text, timestamp: this.nowLabel() },
      notify
    );
  }

  private async loadFunds(): Promise<ReadonlyArray<{ id: string; name: string }>> {
    // The generated Database typing for this narrow select resolves to never,
    // so the response is asserted to the exact shape requested — no `any`.
    const response = (await this.supabase
      .from("funds")
      .select("id, name")
      .eq("church_id", this.churchId)
      .limit(2)) as unknown as { data: ReadonlyArray<{ id: string; name: string }> | null };
    return response.data ?? [];
  }

  public async processPrompt(rawPrompt: string, notify: () => void): Promise<void> {
    const prompt = rawPrompt.trim();
    if (!prompt || this.isProcessing) return;

    this.isProcessing = true;
    this.pushMessage(
      { id: this.nextId(), sender: "user", kind: "text", text: prompt, timestamp: this.nowLabel() },
      notify
    );

    try {
      const lower = prompt.toLowerCase();
      if (lower.includes("สรุป") || lower.includes("รายงาน") || lower.includes("ยอดเงิน") || lower.includes("กองทุน")) {
        await this.handleReadPrompt(notify);
      } else if (lower.includes("ร่าง") && lower.includes("โอน")) {
        await this.handleDraftPrompt(prompt, notify);
      } else if (lower.includes("เสนอ") || lower.includes("โอนเงิน") || lower.includes("จ่าย")) {
        await this.handleProposalPrompt(prompt, notify);
      } else {
        this.pushMessage(
          {
            id: this.nextId(),
            sender: "grace_ai",
            kind: "text",
            text: "ผมช่วยสรุปการเงิน จัดร่างรายการ และเสนอโอนเงินระหว่างกองทุนได้ครับ ลองแตะคำแนะนำด้านล่างได้เลย",
            timestamp: this.nowLabel(),
          },
          notify
        );
      }
    } catch (error: unknown) {
      this.pushError(toUserMessage(error, "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง"), notify);
    } finally {
      this.isProcessing = false;
      notify();
    }
  }

  /** READ — monthly financial summary with strict provenance. */
  private async handleReadPrompt(notify: () => void): Promise<void> {
    const period = new Date().toISOString().slice(0, 7);
    const res = await this.readService.getMonthlyFinancialSummary(period);

    if (res.success && res.facts && res.provenance) {
      const content: ReadMessageContent = {
        title: `สรุปการเงินเดือน ${period}`,
        facts: [
          { label: "รายรับรวม", value: res.facts.total_income },
          { label: "รายจ่ายรวม", value: res.facts.total_expense },
          { label: "กระแสเงินสดสุทธิ", value: res.facts.net_cashflow },
          { label: "ยอดกองทุนรวม", value: res.facts.total_funds_balance },
        ],
        analysis: res.analysis,
        interpretation: res.interpretation,
        provenance: readProvenanceFromService(res.provenance),
      };
      this.pushMessage({ id: this.nextId(), sender: "grace_ai", kind: "read", read: content, timestamp: this.nowLabel() }, notify);
    } else {
      this.pushError(res.message || res.denial_reason || "ไม่สามารถดึงข้อมูลสรุปทางการเงินได้", notify);
    }
  }

  /** DRAFT — non-committed transfer draft; the card routes to Transactions. */
  private async handleDraftPrompt(prompt: string, notify: () => void): Promise<void> {
    const amount = extractAmount(prompt);
    if (!amount) {
      this.pushMessage(
        {
          id: this.nextId(),
          sender: "grace_ai",
          kind: "text",
          text: "ระบุจำนวนเงินในข้อความด้วยครับ เช่น ร่างการโอนเงิน 1,500.00",
          timestamp: this.nowLabel(),
        },
        notify
      );
      return;
    }

    const funds = await this.loadFunds();
    const fromFund = funds[0];
    const toFund = funds[1];
    if (!fromFund || !toFund) {
      this.pushError("ต้องมีกองทุนอย่างน้อย 2 กองทุนจึงจะร่างการโอนได้", notify);
      return;
    }

    const res = await this.draftService.createDraftTransfer({
      from_fund_id: fromFund.id,
      to_fund_id: toFund.id,
      amount,
      notes: prompt,
    });

    if (res.success && res.data) {
      const draft: DraftTransactionPayload = {
        draftId: null,
        amount: res.data.amount,
        category: "โอนระหว่างกองทุน",
        fundName: toFund.name,
        fundId: toFund.id,
        description: res.data.draft_summary,
        suggestedDate: new Date().toISOString(),
        sourceFundName: fromFund.name,
      };
      this.pushMessage({ id: this.nextId(), sender: "grace_ai", kind: "draft", draft, timestamp: this.nowLabel() }, notify);
    } else {
      this.pushError(res.message || res.denial_reason || "ไม่สามารถจัดร่างการโอนเงินได้", notify);
    }
  }

  /** ACTION_PROPOSAL — creates a server-backed proposal for human confirmation. */
  private async handleProposalPrompt(prompt: string, notify: () => void): Promise<void> {
    const amount = extractAmount(prompt);
    if (!amount) {
      this.pushMessage(
        {
          id: this.nextId(),
          sender: "grace_ai",
          kind: "text",
          text: "ระบุจำนวนเงินในข้อความด้วยครับ เช่น เสนอโอนเงิน 1,500.00",
          timestamp: this.nowLabel(),
        },
        notify
      );
      return;
    }

    const funds = await this.loadFunds();
    const fromFund = funds[0];
    const toFund = funds[1];
    if (!fromFund || !toFund) {
      this.pushError("ต้องมีกองทุนอย่างน้อย 2 กองทุนจึงจะเสนอการโอนได้", notify);
      return;
    }

    const res = await this.proposalService.proposeFundTransfer({
      from_fund_id: fromFund.id,
      to_fund_id: toFund.id,
      amount,
      reason: prompt,
    });

    if (res.success && res.proposal) {
      const payload: ActionProposalPayload = actionProposalFromService(res.proposal);
      this.proposals.set(payload.proposalId, res.proposal);
      this.pushMessage(
        { id: this.nextId(), sender: "grace_ai", kind: "proposal", proposal: payload, timestamp: this.nowLabel() },
        notify
      );
    } else {
      this.pushError(res.message || res.denial_reason || "ไม่สามารถสร้างข้อเสนอทางการเงินได้", notify);
    }
  }

  // ------------------------------------------------------------------ events

  public attachEventListeners(root: HTMLElement, callbacks: AiDrawerCallbacks, onStateChange: () => void): void {
    this.callbacks = callbacks;

    root.querySelector<HTMLButtonElement>("#gl-aid-toggle")?.addEventListener("click", () => {
      this.toggle();
      onStateChange();
    });

    root.querySelector<HTMLButtonElement>("#gl-aid-close")?.addEventListener("click", () => {
      this.close();
      onStateChange();
    });

    root.querySelector<HTMLDivElement>("#gl-aid-backdrop")?.addEventListener("click", () => {
      this.close();
      onStateChange();
    });

    root.querySelectorAll<HTMLButtonElement>("[data-aid-prompt]").forEach((chip) => {
      chip.addEventListener("click", () => {
        void this.processPrompt(chip.getAttribute("data-aid-prompt") ?? "", onStateChange);
      });
    });

    root.querySelector<HTMLFormElement>("#gl-aid-input-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = root.querySelector<HTMLInputElement>("#gl-aid-input");
      const prompt = input?.value ?? "";
      if (input) input.value = "";
      void this.processPrompt(prompt, onStateChange);
    });

    root.querySelectorAll<HTMLButtonElement>("[data-aid-draft-review]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-aid-draft-review"));
        const draft = this.renderedDrafts[index];
        if (draft) this.callbacks.onDraftReview?.(draft);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-aid-proposal-review]").forEach((button) => {
      button.addEventListener("click", () => {
        const proposalId = button.getAttribute("data-aid-proposal-review") ?? "";
        const proposal = this.proposals.get(proposalId);
        if (!proposal) return;
        this.activeProposal = proposal;
        this.isModalOpen = true;
        this.modalError = null;
        onStateChange();
      });
    });

    this.attachModalListeners(root, onStateChange);
  }

  private attachModalListeners(root: HTMLElement, onStateChange: () => void): void {
    if (!this.isModalOpen) return;

    const dismiss = (): void => {
      this.isModalOpen = false;
      this.activeProposal = null;
      this.modalError = null;
      onStateChange();
    };

    root.querySelector<HTMLButtonElement>(".gl-btn-cancel")?.addEventListener("click", dismiss);
    root.querySelector<HTMLButtonElement>(".gl-modal-close")?.addEventListener("click", dismiss);
    root.querySelector<HTMLDivElement>("#gl-proposal-modal-backdrop")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) dismiss();
    });

    root.querySelector<HTMLButtonElement>(".gl-btn-confirm")?.addEventListener("click", () => {
      void this.confirmActiveProposal(onStateChange);
    });
  }

  /** Human confirmation landed — execute the single-use confirmation token. */
  private async confirmActiveProposal(onStateChange: () => void): Promise<void> {
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
        const result = {
          proposalId: this.activeProposal.proposal_id,
          resourceId: res.resource_id ?? this.activeProposal.proposal_id,
          message: res.message,
        };
        this.isModalOpen = false;
        this.activeProposal = null;
        this.pushMessage(
          {
            id: this.nextId(),
            sender: "grace_ai",
            kind: "text",
            text: `${result.message} (รหัสอ้างอิง: ${result.resourceId})`,
            timestamp: this.nowLabel(),
          },
          onStateChange
        );
        this.callbacks.onProposalExecuted?.(result);
      } else {
        this.modalError = res.message || res.error || "ดำเนินการไม่สำเร็จ";
      }
    } catch (error: unknown) {
      this.modalError = toUserMessage(error, "ดำเนินการไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      this.modalLoading = false;
      onStateChange();
    }
  }
}



