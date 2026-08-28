import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../lib/supabase/types";
import { OfferingService } from "../lib/offering/offering-service";
import { OfferingSession, OfferingPaymentChannel, CashDenominations } from "../lib/offering/types";
import { Money } from "../lib/money";
import { router } from "../router";
import {
  FundOption,
  OfferingEntryFormState,
  renderOfferingEntryFormHtml,
} from "../components/offering/OfferingEntryForm";
import { renderOfferingReviewSheetHtml } from "../components/offering/OfferingReviewSheet";
import { renderOfferingSessionListHtml } from "../components/offering/OfferingSessionList";
import { renderOfferingDetailOverviewHtml } from "../components/offering/OfferingDetailOverview";
import {
  CashCountFormState,
  ProfileOption,
  renderCashCountViewHtml,
} from "../components/offering/CashCountView";
import {
  AccountOption,
  renderVarianceResolutionViewHtml,
} from "../components/offering/VarianceResolutionView";
import { formatDateThai, toUserMessage } from "../lib/format";

export type OfferingPageMode = "list" | "new" | "detail";
export type OfferingFormStep = "entry" | "review";

export class OfferingPage {
  private offeringService: OfferingService;
  private funds: FundOption[] = [];
  private profiles: ProfileOption[] = [];
  private accounts: AccountOption[] = [];
  private selectedCashAccountId: string = "";
  private selectedBankAccountId: string = "";
  private sessions: OfferingSession[] = [];
  private selectedSession: OfferingSession | null = null;

  // View state
  private mode: OfferingPageMode = "list";
  private formStep: OfferingFormStep = "entry";
  private detailTab: "overview" | "count" | "resolution" = "overview";
  private varianceExplanation: string = "";
  private isLoading: boolean = false;
  private isSubmitting: boolean = false;
  private errorMessage: string | null = null;
  private successMessage: string | null = null;
  private validationErrors: string[] = [];

  // Offering entry form state
  private formState: OfferingEntryFormState = this.getDefaultFormState();

  // Cash count state
  private cashCountState: CashCountFormState = this.getDefaultCashCountState();

  constructor(
    private supabase: SupabaseClient<Database>,
    private churchId: string,
    _currentUserId?: string,
    private currentUserName: string = "ไม่ระบุผู้บันทึก"
  ) {
    this.offeringService = new OfferingService(supabase);
  }

  private getDefaultFormState(): OfferingEntryFormState {
    const today = new Date().toISOString().split("T")[0];
    return {
      serviceDate: today,
      serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
      channels: {
        cash: Money.zero(),
        transfer: Money.zero(),
        qr: Money.zero(),
      },
      allocations: [
        {
          id: "row-" + Math.random().toString(36).substring(2, 9),
          fundId: "",
          channel: "cash",
          sourceType: "envelopes",
          amount: Money.zero(),
          donorName: "",
          notes: "",
        },
      ],
      notes: "",
    };
  }

  private getDefaultCashCountState(): CashCountFormState {
    return {
      counter1Id: "",
      counter2Id: "",
      denominations: {
        b1000: 0,
        b500: 0,
        b100: 0,
        b50: 0,
        b20: 0,
        coins: Money.zero(),
      },
    };
  }

  public setMode(mode: OfferingPageMode, sessionId?: string): void {
    this.mode = mode;
    this.errorMessage = null;
    this.validationErrors = [];
    if (mode === "new") {
      this.formStep = "entry";
      this.resetFormState();
    } else if (mode === "detail" && sessionId) {
      // session will be loaded in loadInitialData
    }
  }

  private resetFormState(): void {
    this.formState = this.getDefaultFormState();
    if (this.funds.length > 0) {
      this.formState.allocations[0].fundId = this.funds[0].id;
    }
  }

  public async init(mode: OfferingPageMode = "list", sessionId?: string): Promise<void> {
    this.setMode(mode, sessionId);
    await this.loadInitialData(sessionId);
  }

  public async loadInitialData(sessionId?: string): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;

    try {
      // 1. Fetch live active funds
      if (this.funds.length === 0) {
        const { data: fundsData, error: fundsError } = await (this.supabase
          .from("funds") as any)
          .select("id, name, description, current_balance")
          .eq("church_id", this.churchId)
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (fundsError) {
          throw new Error("ไม่สามารถโหลดรายชื่อกองทุนได้: " + fundsError.message);
        }

        this.funds = ((fundsData as any[]) || []).map((f) => ({
          id: f.id,
          name: f.name,
          description: f.description,
          currentBalance: f.current_balance,
        }));

        if (this.funds.length > 0 && !this.formState.allocations[0].fundId) {
          this.formState.allocations[0].fundId = this.funds[0].id;
        }
      }

      // 2. Fetch live church profiles (for Dual Custody counters)
      if (this.profiles.length === 0) {
        const { data: profilesData, error: profilesError } = await (this.supabase
          .from("profiles") as any)
          .select("id, full_name, email, is_active")
          .eq("church_id", this.churchId)
          .eq("is_active", true)
          .order("full_name", { ascending: true });

        if (!profilesError && profilesData) {
          this.profiles = (profilesData as any[]).map((p) => ({
            id: p.id,
            fullName: p.full_name,
            email: p.email,
          }));
        }
      }

      // 3. Fetch live church accounts (Cash Drawer & Operating Bank)
      if (this.accounts.length === 0) {
        const { data: accountsData, error: accountsError } = await (this.supabase
          .from("accounts") as any)
          .select("id, name, type, account_number")
          .eq("church_id", this.churchId)
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (!accountsError && accountsData) {
          this.accounts = (accountsData as any[]).map((a) => ({
            id: a.id,
            name: a.name,
            code: a.account_number || "",
            accountType: a.type,
          }));

          if (!this.selectedCashAccountId) {
            const firstCash = this.accounts.find(
              (a) => a.accountType === "cash_drawer" || a.accountType === "cash" || a.accountType === "petty_cash"
            );
            if (firstCash) this.selectedCashAccountId = firstCash.id;
          }
          if (!this.selectedBankAccountId) {
            const firstBank = this.accounts.find(
              (a) => a.accountType === "bank" || a.accountType === "electronic_wallet"
            );
            if (firstBank) this.selectedBankAccountId = firstBank.id;
          }
        }
      }

      // 3. Load mode-specific data
      if (this.mode === "list") {
        const res = await this.offeringService.listSessions(this.churchId);
        if (res.success && res.data) {
          this.sessions = res.data;
        } else {
          this.errorMessage = toUserMessage(res.error?.message, "ไม่สามารถโหลดรายการเงินถวายได้");
        }
      } else if (this.mode === "detail" && sessionId) {
        const res = await this.offeringService.getSession(sessionId);
        if (res.success && res.data) {
          this.selectedSession = res.data;
          this.populateCashCountStateFromSession(res.data);
        } else {
          this.errorMessage = toUserMessage(res.error?.message, "ไม่พบข้อมูลเงินถวายรอบนี้");
        }
      }
    } catch (err: any) {
      this.errorMessage = toUserMessage(err, "เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      this.isLoading = false;
    }
  }

  private populateCashCountStateFromSession(session: OfferingSession): void {
    this.varianceExplanation = session.varianceReason || "";
    // Land on the tab that matches what the session still needs: an unresolved
    // variance needs attention, a locked session is read-only, anything else is
    // mid-count.
    if (session.status === "variance_review") {
      this.detailTab = "resolution";
    } else if (session.status === "confirmed" || session.status === "posted" || session.status === "voided") {
      this.detailTab = "overview";
    } else {
      this.detailTab = "count";
    }
    if (session.cashCount) {
      const cc = session.cashCount;
      this.cashCountState = {
        counter1Id: cc.countedBy1 || session.counter1Id || "",
        counter2Id: cc.countedBy2 || session.counter2Id || "",
        denominations: {
          b1000: cc.b1000 ?? 0,
          b500: cc.b500 ?? 0,
          b100: cc.b100 ?? 0,
          b50: cc.b50 ?? 0,
          b20: cc.b20 ?? 0,
          coins: cc.coins ? Money.from(cc.coins) : Money.zero(),
        },
      };
    } else {
      // Default counters from profiles or session
      const c1 = session.counter1Id || (this.profiles[0]?.id ?? "");
      let c2 = session.counter2Id || "";
      if (!c2 && this.profiles.length > 1) {
        c2 = this.profiles[1].id;
      }
      this.cashCountState = {
        counter1Id: c1,
        counter2Id: c2,
        denominations: {
          b1000: 0,
          b500: 0,
          b100: 0,
          b50: 0,
          b20: 0,
          coins: Money.zero(),
        },
      };
    }
  }

  public renderHtml(): string {
    if (this.isLoading && this.funds.length === 0) {
      return `
      <div class="gl-fade-in gl-loading-center">
        <div class="gl-loading-center__msg">กำลังโหลดระบบเงินถวาย...</div>
      </div>
      `;
    }

    // Success Notification Banner
    const successBannerHtml = this.successMessage ? `
      <div class="gl-toast">
        <div class="gl-toast__body">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>${this.successMessage}</span>
        </div>
        <button id="btn-dismiss-toast" class="gl-toast__close">✕</button>
      </div>
    ` : "";

    let contentHtml = "";

    if (this.mode === "list") {
      contentHtml = renderOfferingSessionListHtml({
        sessions: this.sessions,
        isLoading: this.isLoading,
        errorMessage: this.errorMessage,
      });
    } else if (this.mode === "new") {
      if (this.formStep === "entry") {
        contentHtml = renderOfferingEntryFormHtml({
          funds: this.funds,
          state: this.formState,
          validationErrors: this.validationErrors,
        });
      } else {
        contentHtml = renderOfferingReviewSheetHtml({
          funds: this.funds,
          state: this.formState,
          creatorName: this.currentUserName,
          isSubmitting: this.isSubmitting,
          errorMessage: this.errorMessage,
        });
      }
    } else if (this.mode === "detail") {
      if (!this.selectedSession) {
        contentHtml = `
        <div class="gl-page gl-fade-in gl-empty-center">
          <p class="gl-empty-center__msg">ไม่พบข้อมูลรอบเงินถวาย</p>
          <a href="#/offerings" class="gl-btn gl-btn--secondary">กลับไปหน้ารายการ</a>
        </div>
        `;
      } else {
        const session = this.selectedSession;
        const needsVariance = session.status === "variance_review";

        const tab = (
          id: string,
          key: "overview" | "count" | "resolution",
          label: string,
          badge = ""
        ) => {
          const isActive = this.detailTab === key;
          return `
          <button
            id="${id}"
            type="button"
            role="tab"
            aria-selected="${isActive}"
            aria-controls="gl-detail-panel"
            tabindex="${isActive ? "0" : "-1"}"
            class="gl-tab${isActive ? " is-active" : ""}"
          >${label}${badge}</button>`;
        };

        const tabHeaderHtml = `
        <div class="gl-page gl-page--flush-bottom">
          <div class="gl-tablist" role="tablist" aria-label="รายละเอียดรอบเงินถวาย">
            ${tab("btn-tab-overview", "overview", "ภาพรวม")}
            ${tab("btn-tab-count", "count", "ตรวจนับเงินสด")}
            ${tab(
              "btn-tab-resolution",
              "resolution",
              "ผลต่างและการยืนยัน",
              needsVariance ? '<span class="gl-badge gl-badge--rejected gl-badge--inline" aria-label="มีผลต่างรอจัดการ">1</span>' : ""
            )}
          </div>
        </div>
        `;

        let panelHtml = "";
        if (this.detailTab === "overview") {
          panelHtml = `<div class="gl-page gl-fade-in">${renderOfferingDetailOverviewHtml({ session })}</div>`;
        } else if (this.detailTab === "count") {
          panelHtml = renderCashCountViewHtml({
            session,
            profiles: this.profiles,
            state: this.cashCountState,
            isSubmitting: this.isSubmitting,
            errorMessage: this.errorMessage,
            successMessage: this.successMessage,
          });
        } else {
          panelHtml = renderVarianceResolutionViewHtml({
            session,
            explanation: this.varianceExplanation,
            accounts: this.accounts,
            selectedCashAccountId: this.selectedCashAccountId,
            selectedBankAccountId: this.selectedBankAccountId,
            isSubmitting: this.isSubmitting,
            errorMessage: this.errorMessage,
            successMessage: this.successMessage,
          });
        }

        contentHtml =
          tabHeaderHtml +
          `<div id="gl-detail-panel" role="tabpanel" tabindex="0">${panelHtml}</div>`;
      }
    }

    return successBannerHtml + contentHtml;
  }

  public attachEventListeners(rootElement: HTMLElement, onStateChange: () => void): void {
    // Toast dismiss
    const dismissToastBtn = rootElement.querySelector("#btn-dismiss-toast");
    if (dismissToastBtn) {
      dismissToastBtn.addEventListener("click", () => {
        this.successMessage = null;
        onStateChange();
      });
    }

    // Retry list
    const retryBtn = rootElement.querySelector("#gl-btn-retry-sessions");
    if (retryBtn) {
      retryBtn.addEventListener("click", async () => {
        await this.loadInitialData();
        onStateChange();
      });
    }

    if (this.mode === "new" && this.formStep === "entry") {
      this.attachEntryFormListeners(rootElement, onStateChange);
    } else if (this.mode === "new" && this.formStep === "review") {
      this.attachReviewSheetListeners(rootElement, onStateChange);
    } else if (this.mode === "detail") {
      this.attachCashCountListeners(rootElement, onStateChange);
    }
  }

  private attachEntryFormListeners(rootElement: HTMLElement, onStateChange: () => void): void {
    // Date & Service Name
    const dateInput = rootElement.querySelector("#input-service-date") as HTMLInputElement;
    if (dateInput) {
      dateInput.addEventListener("change", (e) => {
        this.formState.serviceDate = (e.target as HTMLInputElement).value;
      });
    }

    const serviceSelect = rootElement.querySelector("#input-service-name") as HTMLSelectElement;
    if (serviceSelect) {
      serviceSelect.addEventListener("change", (e) => {
        this.formState.serviceName = (e.target as HTMLSelectElement).value;
      });
    }

    // Channel Expected Amounts
    const cashInput = rootElement.querySelector("#input-expected-cash") as HTMLInputElement;
    if (cashInput) {
      cashInput.addEventListener("input", (e) => {
        const val = (e.target as HTMLInputElement).value;
        this.formState.channels.cash = val ? Money.from(val) : Money.zero();
        onStateChange();
      });
    }

    const transferInput = rootElement.querySelector("#input-expected-transfer") as HTMLInputElement;
    if (transferInput) {
      transferInput.addEventListener("input", (e) => {
        const val = (e.target as HTMLInputElement).value;
        this.formState.channels.transfer = val ? Money.from(val) : Money.zero();
        onStateChange();
      });
    }

    const qrInput = rootElement.querySelector("#input-expected-qr") as HTMLInputElement;
    if (qrInput) {
      qrInput.addEventListener("input", (e) => {
        const val = (e.target as HTMLInputElement).value;
        this.formState.channels.qr = val ? Money.from(val) : Money.zero();
        onStateChange();
      });
    }

    // Notes
    const notesInput = rootElement.querySelector("#input-session-notes") as HTMLTextAreaElement;
    if (notesInput) {
      notesInput.addEventListener("input", (e) => {
        this.formState.notes = (e.target as HTMLTextAreaElement).value;
      });
    }

    // Add Allocation Row
    const addRowBtn = rootElement.querySelector("#btn-add-allocation-row");
    if (addRowBtn) {
      addRowBtn.addEventListener("click", () => {
        this.formState.allocations.push({
          id: "row-" + Math.random().toString(36).substring(2, 9),
          fundId: this.funds.length > 0 ? this.funds[0].id : "",
          channel: "cash",
          sourceType: "envelopes",
          amount: Money.zero(),
          donorName: "",
          notes: "",
        });
        onStateChange();
      });
    }

    // Allocation Row Inputs
    rootElement.querySelectorAll(".select-row-fund").forEach((el) => {
      el.addEventListener("change", (e) => {
        const target = e.target as HTMLSelectElement;
        const rowId = target.dataset.rowId;
        const row = this.formState.allocations.find((r) => r.id === rowId);
        if (row) {
          row.fundId = target.value;
        }
      });
    });

    rootElement.querySelectorAll(".select-row-channel").forEach((el) => {
      el.addEventListener("change", (e) => {
        const target = e.target as HTMLSelectElement;
        const rowId = target.dataset.rowId;
        const row = this.formState.allocations.find((r) => r.id === rowId);
        if (row) {
          row.channel = target.value as OfferingPaymentChannel;
          onStateChange();
        }
      });
    });

    rootElement.querySelectorAll(".input-row-amount").forEach((el) => {
      el.addEventListener("input", (e) => {
        const target = e.target as HTMLInputElement;
        const rowId = target.dataset.rowId;
        const row = this.formState.allocations.find((r) => r.id === rowId);
        if (row) {
          row.amount = target.value ? Money.from(target.value) : Money.zero();
          onStateChange();
        }
      });
    });

    rootElement.querySelectorAll(".input-row-donor").forEach((el) => {
      el.addEventListener("input", (e) => {
        const target = e.target as HTMLInputElement;
        const rowId = target.dataset.rowId;
        const row = this.formState.allocations.find((r) => r.id === rowId);
        if (row) {
          row.donorName = target.value;
        }
      });
    });

    rootElement.querySelectorAll(".btn-remove-row").forEach((el) => {
      el.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest(".btn-remove-row") as HTMLElement;
        const rowId = btn?.dataset.rowId;
        if (rowId && this.formState.allocations.length > 1) {
          this.formState.allocations = this.formState.allocations.filter((r) => r.id !== rowId);
          onStateChange();
        }
      });
    });

    // Proceed to Review
    const proceedBtn = rootElement.querySelector("#btn-proceed-review");
    if (proceedBtn) {
      proceedBtn.addEventListener("click", () => {
        const errors = this.validateForm();
        if (errors.length > 0) {
          this.validationErrors = errors;
          onStateChange();
        } else {
          this.validationErrors = [];
          this.formStep = "review";
          onStateChange();
        }
      });
    }
  }

  private attachReviewSheetListeners(rootElement: HTMLElement, onStateChange: () => void): void {
    rootElement.querySelectorAll("#btn-back-to-entry, #btn-back-to-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.formStep = "entry";
        this.errorMessage = null;
        onStateChange();
      });
    });

    const confirmBtn = rootElement.querySelector("#btn-confirm-save-draft");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", async () => {
        await this.handleSaveDraft(onStateChange);
      });
    }
  }

  private attachCashCountListeners(rootElement: HTMLElement, onStateChange: () => void): void {
    // Counter 1 selection
    const c1Select = rootElement.querySelector("#select-counter-1") as HTMLSelectElement;
    if (c1Select) {
      c1Select.addEventListener("change", (e) => {
        this.cashCountState.counter1Id = (e.target as HTMLSelectElement).value;
        onStateChange();
      });
    }

    // Counter 2 selection
    const c2Select = rootElement.querySelector("#select-counter-2") as HTMLSelectElement;
    if (c2Select) {
      c2Select.addEventListener("change", (e) => {
        this.cashCountState.counter2Id = (e.target as HTMLSelectElement).value;
        onStateChange();
      });
    }

    // Start Counting Button
    const startCountBtn = rootElement.querySelector("#btn-start-counting");
    if (startCountBtn) {
      startCountBtn.addEventListener("click", async () => {
        await this.handleStartCounting(onStateChange);
      });
    }

    // Denomination Inputs
    rootElement.querySelectorAll(".input-denom-count").forEach((el) => {
      el.addEventListener("input", (e) => {
        const target = e.target as HTMLInputElement;
        const key = target.dataset.denom as keyof CashDenominations;
        if (key && key !== "coins") {
          const val = parseInt(target.value, 10);
          (this.cashCountState.denominations as any)[key] = isNaN(val) || val < 0 ? 0 : val;
          onStateChange();
        }
      });
    });

    // Denomination Steppers
    rootElement.querySelectorAll(".btn-denom-step").forEach((el) => {
      el.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest(".btn-denom-step") as HTMLElement;
        const action = btn?.dataset.action;
        const key = btn?.dataset.denom as keyof CashDenominations;
        if (key && key !== "coins") {
          const current = (this.cashCountState.denominations as any)[key] || 0;
          if (action === "plus") {
            (this.cashCountState.denominations as any)[key] = current + 1;
          } else if (action === "minus") {
            (this.cashCountState.denominations as any)[key] = Math.max(0, current - 1);
          }
          onStateChange();
        }
      });
    });

    // Coins Input
    const coinsInput = rootElement.querySelector("#input-coins") as HTMLInputElement;
    if (coinsInput) {
      coinsInput.addEventListener("input", (e) => {
        const val = (e.target as HTMLInputElement).value;
        this.cashCountState.denominations.coins = val ? Money.from(val) : Money.zero();
        onStateChange();
      });
    }

    // Save Cash Count Button
    const saveCountBtn = rootElement.querySelector("#btn-save-cash-count");
    if (saveCountBtn) {
      saveCountBtn.addEventListener("click", async () => {
        await this.handleSaveCashCount(onStateChange);
      });
    }

    // Tab navigation buttons
    const tabOverviewBtn = rootElement.querySelector("#btn-tab-overview");
    if (tabOverviewBtn) {
      tabOverviewBtn.addEventListener("click", () => {
        this.detailTab = "overview";
        onStateChange();
      });
    }

    // Roving focus: left/right move between tabs, as the tablist pattern expects.
    const tabButtons = Array.from(rootElement.querySelectorAll<HTMLElement>('[role="tab"]'));
    const tabKeys: Array<"overview" | "count" | "resolution"> = ["overview", "count", "resolution"];
    tabButtons.forEach((btn, index) => {
      btn.addEventListener("keydown", (e) => {
        const key = (e as KeyboardEvent).key;
        if (key !== "ArrowRight" && key !== "ArrowLeft") return;
        e.preventDefault();
        const offset = key === "ArrowRight" ? 1 : -1;
        const next = (index + offset + tabButtons.length) % tabButtons.length;
        this.detailTab = tabKeys[next];
        onStateChange();
      });
    });

    const tabCountBtn = rootElement.querySelector("#btn-tab-count");
    if (tabCountBtn) {
      tabCountBtn.addEventListener("click", () => {
        this.detailTab = "count";
        onStateChange();
      });
    }

    const tabResBtn = rootElement.querySelector("#btn-tab-resolution");
    if (tabResBtn) {
      tabResBtn.addEventListener("click", () => {
        this.detailTab = "resolution";
        onStateChange();
      });
    }

    const goToResBtn = rootElement.querySelector("#btn-go-to-resolution");
    if (goToResBtn) {
      goToResBtn.addEventListener("click", () => {
        this.detailTab = "resolution";
        onStateChange();
      });
    }

    const backToCountBtn = rootElement.querySelector("#btn-back-to-cash-count");
    if (backToCountBtn) {
      backToCountBtn.addEventListener("click", () => {
        this.detailTab = "count";
        onStateChange();
      });
    }

    // Variance Explanation Input
    const explanationInput = rootElement.querySelector("#input-variance-explanation") as HTMLTextAreaElement;
    if (explanationInput) {
      explanationInput.addEventListener("input", (e) => {
        this.varianceExplanation = (e.target as HTMLTextAreaElement).value;
        const len = this.varianceExplanation.trim().length;
        const counterEl = rootElement.querySelector("#label-char-counter");
        if (counterEl) {
          counterEl.textContent = len < 5 ? ` กรุณากรอกอย่างน้อย 5 ตัวอักษร (ปัจจุบัน ${len}/5)` : `✓ ความยาวคำชี้แจงถูกต้อง (${len} ตัวอักษร)`;
          (counterEl as HTMLElement).style.color = len < 5 ? 'var(--expense)' : 'var(--income)';
        }
        const explainBtn = rootElement.querySelector("#btn-variance-explain") as HTMLButtonElement;
        if (explainBtn) {
          explainBtn.disabled = len < 5;
          explainBtn.style.background = len < 5 ? 'var(--muted-foreground)' : 'var(--info)';
          explainBtn.style.cursor = len < 5 ? 'not-allowed' : 'pointer';
        }
      });
    }

    // Save Variance Explanation Button
    const explainBtn = rootElement.querySelector("#btn-variance-explain");
    if (explainBtn) {
      explainBtn.addEventListener("click", async () => {
        await this.handleSaveVarianceExplanation(onStateChange);
      });
    }

    // Recount Button
    const recountBtn = rootElement.querySelector("#btn-variance-recount");
    if (recountBtn) {
      recountBtn.addEventListener("click", async () => {
        await this.handleVarianceRecount(onStateChange);
      });
    }

    // Confirm Session Button
    const confirmSessionBtn = rootElement.querySelector("#btn-confirm-session");
    if (confirmSessionBtn) {
      confirmSessionBtn.addEventListener("click", async () => {
        await this.handleConfirmSession(onStateChange);
      });
    }

    // Cash Account Selector for Posting
    const cashAcctSelect = rootElement.querySelector("#select-posting-cash-account") as HTMLSelectElement;
    if (cashAcctSelect) {
      cashAcctSelect.addEventListener("change", (e) => {
        this.selectedCashAccountId = (e.target as HTMLSelectElement).value;
      });
    }

    // Bank Account Selector for Posting
    const bankAcctSelect = rootElement.querySelector("#select-posting-bank-account") as HTMLSelectElement;
    if (bankAcctSelect) {
      bankAcctSelect.addEventListener("change", (e) => {
        this.selectedBankAccountId = (e.target as HTMLSelectElement).value;
      });
    }

    // Post to Ledger Button
    const postToLedgerBtn = rootElement.querySelector("#btn-post-to-ledger");
    if (postToLedgerBtn) {
      postToLedgerBtn.addEventListener("click", async () => {
        await this.handlePostToLedger(onStateChange);
      });
    }
  }

  private async handlePostToLedger(onStateChange: () => void): Promise<void> {
    if (!this.selectedSession) return;

    if (!this.selectedCashAccountId) {
      this.errorMessage = "กรุณาระบุบัญชี Cash Drawer สำหรับรับเงินสด";
      onStateChange();
      return;
    }

    const transfer = this.selectedSession.expectedTransferAmount || Money.zero();
    const qr = this.selectedSession.expectedQrAmount || Money.zero();
    if ((!transfer.isZero() || !qr.isZero()) && !this.selectedBankAccountId) {
      this.errorMessage = "กรุณาระบุบัญชีธนาคารสำหรับยอดเงินโอนและ QR";
      onStateChange();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;
    onStateChange();

    try {
      const res = await this.offeringService.postOfferingToLedger({
        sessionId: this.selectedSession.id,
        cashAccountId: this.selectedCashAccountId,
        bankAccountId: this.selectedBankAccountId || null,
      });

      if (res.success && res.data) {
        await this.loadInitialData(this.selectedSession.id);
        this.successMessage = res.data.alreadyPosted
          ? "รอบเงินถวายนี้ได้รับการบันทึกเข้าสมุดบัญชีแยกประเภทแล้ว (สถานะ: posted)"
          : "บันทึกเข้าสมุดบัญชีแยกประเภทเรียบร้อยแล้ว (สถานะ: posted)";
      } else {
        this.errorMessage = toUserMessage(res.error?.message, "ไม่สามารถบันทึกลงสมุดบัญชีได้");
      }
    } catch (err: any) {
      this.errorMessage = toUserMessage(err, "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      this.isSubmitting = false;
      onStateChange();
    }
  }

  private async handleSaveVarianceExplanation(onStateChange: () => void): Promise<void> {
    if (!this.selectedSession) return;

    if (!this.varianceExplanation || this.varianceExplanation.trim().length < 5) {
      this.errorMessage = "กรุณาระบุคำอธิบายผลต่างอย่างน้อย 5 ตัวอักษร";
      onStateChange();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;
    onStateChange();

    try {
      const res = await this.offeringService.resolveVariance({
        sessionId: this.selectedSession.id,
        action: "explain",
        explanation: this.varianceExplanation.trim(),
      });

      if (res.success && res.data) {
        await this.loadInitialData(this.selectedSession.id);
        this.successMessage = "บันทึกคำชี้แจงผลต่างเรียบร้อยแล้ว (สถานะ: explained)";
      } else {
        this.errorMessage = toUserMessage(res.error?.message, "ไม่สามารถบันทึกคำชี้แจงผลต่างได้");
      }
    } catch (err: any) {
      this.errorMessage = toUserMessage(err, "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      this.isSubmitting = false;
      onStateChange();
    }
  }

  private async handleVarianceRecount(onStateChange: () => void): Promise<void> {
    if (!this.selectedSession) return;

    this.isSubmitting = true;
    this.errorMessage = null;
    onStateChange();

    try {
      const res = await this.offeringService.resolveVariance({
        sessionId: this.selectedSession.id,
        action: "recount",
      });

      if (res.success && res.data) {
        await this.loadInitialData(this.selectedSession.id);
        this.detailTab = "count";
        this.successMessage = "ส่งกลับสู่ขั้นตอนตรวจนับเงินใหม่แล้ว (สถานะ: counting)";
      } else {
        this.errorMessage = toUserMessage(res.error?.message, "ไม่สามารถสั่งนับใหม่ได้");
      }
    } catch (err: any) {
      this.errorMessage = toUserMessage(err, "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      this.isSubmitting = false;
      onStateChange();
    }
  }

  private async handleConfirmSession(onStateChange: () => void): Promise<void> {
    if (!this.selectedSession) return;

    this.isSubmitting = true;
    this.errorMessage = null;
    onStateChange();

    try {
      const res = await this.offeringService.confirmSession(this.selectedSession.id);

      if (res.success && res.data) {
        await this.loadInitialData(this.selectedSession.id);
        this.successMessage = "ยืนยันความถูกต้องรอบเงินถวายเรียบร้อยแล้ว (สถานะ: confirmed)";
      } else {
        this.errorMessage = toUserMessage(res.error?.message, "ไม่สามารถยืนยันรอบเงินถวายได้");
      }
    } catch (err: any) {
      this.errorMessage = toUserMessage(err, "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      this.isSubmitting = false;
      onStateChange();
    }
  }

  private async handleStartCounting(onStateChange: () => void): Promise<void> {
    if (!this.selectedSession) return;
    this.isSubmitting = true;
    this.errorMessage = null;
    onStateChange();

    try {
      const res = await this.offeringService.startCashCount(
        this.selectedSession.id,
        this.cashCountState.counter1Id,
        this.cashCountState.counter2Id
      );

      if (res.success && res.data) {
        await this.loadInitialData(this.selectedSession.id);
        this.successMessage = "เริ่มต้นขั้นตอนการตรวจนับเงินแล้ว";
      } else {
        this.errorMessage = toUserMessage(res.error?.message, "ไม่สามารถเริ่มต้นขั้นตอนการตรวจนับเงินได้");
      }
    } catch (err: any) {
      this.errorMessage = toUserMessage(err, "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      this.isSubmitting = false;
      onStateChange();
    }
  }

  private async handleSaveCashCount(onStateChange: () => void): Promise<void> {
    if (!this.selectedSession) return;

    if (!this.cashCountState.counter1Id || !this.cashCountState.counter2Id) {
      this.errorMessage = "กรุณาระบุผู้ร่วมตรวจนับทั้ง 2 คน";
      onStateChange();
      return;
    }

    if (this.cashCountState.counter1Id === this.cashCountState.counter2Id) {
      this.errorMessage = "ผู้ตรวจนับคนที่ 1 และคนที่ 2 ต้องเป็นคนละคนกันตามหลัก Dual Custody";
      onStateChange();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;
    onStateChange();

    try {
      const res = await this.offeringService.recordCashCount({
        sessionId: this.selectedSession.id,
        counter1Id: this.cashCountState.counter1Id,
        counter2Id: this.cashCountState.counter2Id,
        denominations: this.cashCountState.denominations,
      });

      if (res.success && res.data) {
        await this.loadInitialData(this.selectedSession.id);
        const actualCash = this.selectedSession?.cashCount?.totalCashCounted || res.data.totalCash;
        this.successMessage = `บันทึกผลการตรวจนับเงินสดเรียบร้อยแล้ว (ยอดที่นับได้: ${actualCash.format()})`;
      } else {
        this.errorMessage = toUserMessage(res.error?.message, "ไม่สามารถบันทึกผลการตรวจนับเงินสดได้");
      }
    } catch (err: any) {
      this.errorMessage = toUserMessage(err, "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      this.isSubmitting = false;
      onStateChange();
    }
  }

  private validateForm(): string[] {
    const errors: string[] = [];

    if (!this.formState.serviceDate) {
      errors.push("กรุณาระบุวันที่นมัสการ");
    }

    const grandExpected = this.formState.channels.cash
      .add(this.formState.channels.transfer)
      .add(this.formState.channels.qr);

    if (grandExpected.isZero() || grandExpected.isNegative()) {
      errors.push("กรุณาระบุยอดเงินที่คาดหวังอย่างน้อย 1 ช่องทาง");
    }

    // Check allocations per channel
    const allocCash = this.formState.allocations
      .filter((a) => a.channel === "cash")
      .reduce((acc, a) => acc.add(a.amount), Money.zero());

    const allocTransfer = this.formState.allocations
      .filter((a) => a.channel === "bank_transfer")
      .reduce((acc, a) => acc.add(a.amount), Money.zero());

    const allocQr = this.formState.allocations
      .filter((a) => a.channel === "qr_code")
      .reduce((acc, a) => acc.add(a.amount), Money.zero());

    if (!allocCash.equals(this.formState.channels.cash)) {
      errors.push(
        `ยอดจัดสรรเงินสด (${allocCash.format()}) ไม่ตรงกับยอดเงินสดที่คาดหวัง (${this.formState.channels.cash.format()})`
      );
    }

    if (!allocTransfer.equals(this.formState.channels.transfer)) {
      errors.push(
        `ยอดจัดสรรเงินโอน (${allocTransfer.format()}) ไม่ตรงกับยอดเงินโอนที่คาดหวัง (${this.formState.channels.transfer.format()})`
      );
    }

    if (!allocQr.equals(this.formState.channels.qr)) {
      errors.push(
        `ยอดจัดสรร QR Code (${allocQr.format()}) ไม่ตรงกับยอด QR Code ที่คาดหวัง (${this.formState.channels.qr.format()})`
      );
    }

    for (const alloc of this.formState.allocations) {
      if (!alloc.fundId) {
        errors.push("กรุณาเลือกกองทุนสำหรับทุกรายการจัดสรร");
        break;
      }
      if (alloc.amount.isNegative()) {
        errors.push("จำนวนเงินจัดสรรต้องไม่ติดลบ");
        break;
      }
    }

    return errors;
  }

  private async handleSaveDraft(onStateChange: () => void): Promise<void> {
    this.isSubmitting = true;
    this.errorMessage = null;
    onStateChange();

    try {
      // Filter out zero amount allocations if any, or include all valid
      const validItems = this.formState.allocations
        .filter((a) => a.amount.isPositive())
        .map((a) => ({
          fundId: a.fundId,
          paymentChannel: a.channel,
          sourceType: a.sourceType,
          amount: a.amount,
          donorName: a.donorName || null,
          notes: a.notes || null,
        }));

      const res = await this.offeringService.createSession({
        serviceDate: this.formState.serviceDate,
        serviceName: this.formState.serviceName,
        items: validItems,
        notes: this.formState.notes,
      });

      if (res.success && res.data) {
        this.successMessage = `บันทึกร่างเงินถวายเรียบร้อยแล้ว (${formatDateThai(this.formState.serviceDate)} - ${this.formState.serviceName})`;
        this.resetFormState();
        router.navigate("/offerings");
      } else {
        this.errorMessage = toUserMessage(res.error?.message, "ไม่สามารถบันทึกร่างเงินถวายได้");
      }
    } catch (err: any) {
      this.errorMessage = toUserMessage(err, "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      this.isSubmitting = false;
      onStateChange();
    }
  }
}

