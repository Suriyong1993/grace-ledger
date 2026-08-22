import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../lib/supabase/types";
import { Money } from "../lib/money";
import { formatDateThai } from "../lib/format";

export interface TransactionItem {
  id: string;
  code: string;
  description: string;
  categoryName: string;
  fundName: string;
  accountName: string;
  amount: Money;
  direction: "income" | "expense" | "transfer";
  date: string;
  dateGroup: "today" | "yesterday" | "earlier";
  recordedBy: string;
  status: "approved" | "pending" | "rejected";
  attachmentName?: string;
  attachmentSize?: string;
  timeline: {
    title: string;
    detail: string;
    status: "done" | "active" | "pending";
  }[];
}

const ICON_SEARCH = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>`;
const ICON_INCOME = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>`;
const ICON_EXPENSE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>`;
const ICON_TRANSFER = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 9h13l-3-3M20 15H7l3 3"/></svg>`;
const ICON_CLOSE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;

export class TransactionsPage {
  private activeFilter: "all" | "income" | "expense" | "transfer" | "pending" = "all";
  private searchQuery = "";
  private selectedTransactionId: string | null = null;
  private transactions: TransactionItem[] = [];
  private errorMessage: string | null = null;
  private isLoading = false;

  constructor(private supabase: SupabaseClient<Database>, private churchId: string) {}

  public async loadData(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    try {
      const { data, error } = await (this.supabase
        .from("transactions") as any)
        .select(`
          id,
          description,
          transaction_date,
          status,
          created_at,
          category_id,
          account_id,
          categories(name),
          accounts(name),
          transaction_splits(amount, fund_id, funds(name))
        `)
        .eq("church_id", this.churchId)
        .order("transaction_date", { ascending: false });

      if (error) {
        this.errorMessage = "ไม่สามารถโหลดรายการเงินได้ กรุณาลองใหม่อีกครั้ง";
        this.transactions = [];
        return;
      }

      if (data && Array.isArray(data)) {
        this.transactions = data.map((t, idx) => {
          let sum = Money.zero();
          let fundName = "กองทุนทั่วไป";
          if (t.transaction_splits && Array.isArray(t.transaction_splits)) {
            for (const sp of t.transaction_splits) {
              if (sp.amount) sum = sum.add(Money.from(sp.amount));
              if (sp.funds?.name) fundName = sp.funds.name;
            }
          }

          const isExp = t.description?.includes("จ่าย") || t.description?.includes("ซื้อ") || t.description?.includes("ค่า");
          const direction: "income" | "expense" | "transfer" = isExp ? "expense" : "income";

          return {
            id: t.id,
            code: `TXN-${String(idx + 1).padStart(4, "0")}`,
            description: t.description || "รายการทั่วไป",
            categoryName: t.categories?.name || (direction === "income" ? "ถวายทรัพย์" : "พันธกิจและสาธารณูปโภค"),
            fundName,
            accountName: t.accounts?.name || "บัญชีหลัก",
            amount: sum,
            direction,
            date: t.transaction_date || "2026-08-21",
            dateGroup: idx === 0 ? "today" : idx < 3 ? "yesterday" : "earlier",
            recordedBy: "เจ้าหน้าที่การเงิน",
            status: t.status === "approved" ? "approved" : t.status === "rejected" ? "rejected" : "pending",
            timeline: [
              { title: "สร้างรายการ", detail: `บันทึกเมื่อ ${formatDateThai(t.transaction_date || "2026-08-21")}`, status: "done" },
            ],
          };
        });
      } else {
        this.transactions = [];
      }
    } catch {
      this.errorMessage = "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง";
      this.transactions = [];
    } finally {
      this.isLoading = false;
    }
  }

  public renderHtml(): string {
    const errorNoticeHtml = this.errorMessage
      ? `<div class="gl-notice gl-notice--error" role="alert" style="margin-bottom: var(--space-4);">
          <div class="gl-notice__body" style="display: flex; justify-content: space-between; align-items: center;">
            <span>${this.errorMessage}</span>
            <button id="retry-load-btn" class="gl-btn gl-btn--secondary gl-btn--sm">ลองใหม่</button>
          </div>
        </div>`
      : "";

    if (this.isLoading) {
      return `
      <div class="gl-page gl-fade-in">
        <div class="gl-page-header" style="margin-bottom: var(--space-4);">
          <h1>รายการเงิน</h1>
          <p>บันทึกรายรับ รายจ่าย และประวัติธุรกรรมทั้งหมดของคริสตจักร</p>
        </div>
        <div class="gl-card" style="text-align: center; padding: var(--space-8); color: var(--muted-foreground);">
          <p style="margin: 0; font-size: var(--text-sm);">กำลังโหลดข้อมูลรายการเงิน...</p>
        </div>
      </div>`;
    }

    const filtered = this.transactions.filter((item) => {
      if (this.activeFilter === "income" && item.direction !== "income") return false;
      if (this.activeFilter === "expense" && item.direction !== "expense") return false;
      if (this.activeFilter === "transfer" && item.direction !== "transfer") return false;
      if (this.activeFilter === "pending" && item.status !== "pending") return false;

      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const match =
          item.description.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          item.fundName.toLowerCase().includes(q) ||
          item.categoryName.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    const selectedTxn = this.selectedTransactionId
      ? this.transactions.find((t) => t.id === this.selectedTransactionId)
      : null;

    let incomeSum = Money.zero();
    let expenseSum = Money.zero();
    for (const t of this.transactions) {
      if (t.direction === "income") incomeSum = incomeSum.add(t.amount);
      if (t.direction === "expense") expenseSum = expenseSum.add(t.amount);
    }

    const todayItems = filtered.filter((t) => t.dateGroup === "today");
    const yesterdayItems = filtered.filter((t) => t.dateGroup === "yesterday");
    const earlierItems = filtered.filter((t) => t.dateGroup === "earlier");

    const renderGroup = (title: string, items: TransactionItem[]) => {
      if (items.length === 0) return "";
      return `
        <div style="margin-bottom: var(--space-4);">
          <div class="kicker" style="margin: 0 0 var(--space-2);">${title}</div>
          <div class="gl-card" style="padding: 2px var(--space-4);">
            ${items
              .map((item, idx) => {
                const isIncome = item.direction === "income";
                const isExpense = item.direction === "expense";
                const iconSvg = isIncome ? ICON_INCOME : isExpense ? ICON_EXPENSE : ICON_TRANSFER;
                const bgVar = isIncome ? "var(--income-muted)" : isExpense ? "var(--expense-muted)" : "var(--secondary)";
                const colorVar = isIncome ? "var(--income)" : isExpense ? "var(--expense)" : "var(--muted-foreground)";
                const amountPrefix = isIncome ? "+" : isExpense ? "−" : "";
                const borderBottom = idx < items.length - 1 ? `border-bottom: 1px solid var(--border);` : "";

                return `
                <div class="gl-txn-row" data-txn-id="${item.id}" style="
                  display: flex;
                  align-items: center;
                  gap: var(--space-3);
                  padding: var(--space-3) 0;
                  min-height: 48px;
                  cursor: pointer;
                  ${borderBottom}
                ">
                  <div aria-hidden="true" style="
                    width: 36px;
                    height: 36px;
                    border-radius: 11px;
                    background: ${bgVar};
                    color: ${colorVar};
                    display: grid;
                    place-items: center;
                    flex-shrink: 0;
                  ">${iconSvg}</div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: var(--text-sm); font-weight: var(--weight-medium); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${item.description}
                    </div>
                    <div style="font-size: var(--text-2xs); color: var(--muted-foreground); margin-top: 2px;">
                      ${item.fundName} · ${item.categoryName}
                    </div>
                  </div>
                  <div style="text-align: right; flex-shrink: 0;">
                    <div class="num-display" style="font-size: var(--text-sm); font-weight: var(--weight-bold); color: ${
                      isIncome ? "var(--income)" : isExpense ? "var(--expense)" : "var(--foreground)"
                    };">${amountPrefix}${item.amount.format()}</div>
                    <span class="gl-badge gl-badge--${item.status}" style="font-size: 10px; padding: 0 6px; margin-top: 2px;">
                      ${item.status === "approved" ? "อนุมัติแล้ว" : item.status === "rejected" ? "ไม่อนุมัติ" : "รอตรวจสอบ"}
                    </span>
                  </div>
                </div>`;
              })
              .join("")}
          </div>
        </div>`;
    };

    const modalHtml = selectedTxn
      ? `
      <div id="txn-modal" class="gl-modal-backdrop gl-fade-in">
        <div class="gl-modal-content" style="max-width: 440px; padding: var(--space-5); max-height: 90vh; overflow-y: auto;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
            <div>
              <div style="font-size: var(--text-base); font-weight: var(--weight-bold);">รายละเอียดรายการ</div>
              <div class="num-display" style="font-size: var(--text-xs); color: var(--muted-foreground);">${selectedTxn.code}</div>
            </div>
            <button id="close-modal-btn" class="gl-btn gl-btn--ghost gl-btn--sm" style="width: 36px; height: 36px; padding: 0; border-radius: var(--radius-full);">
              ${ICON_CLOSE}
            </button>
          </div>

          <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-4); text-align: center; margin-bottom: var(--space-4);">
            <div style="font-size: var(--text-xs); color: var(--muted-foreground);">${selectedTxn.description}</div>
            <div class="num-display" style="
              font-size: var(--text-3xl);
              font-weight: var(--weight-bold);
              margin: var(--space-2) 0;
              color: ${selectedTxn.direction === "income" ? "var(--income)" : selectedTxn.direction === "expense" ? "var(--expense)" : "var(--foreground)"};
            ">${selectedTxn.direction === "income" ? "+" : selectedTxn.direction === "expense" ? "−" : ""}${selectedTxn.amount.format()}</div>
            <span class="gl-badge gl-badge--${selectedTxn.status}">
              ${selectedTxn.status === "approved" ? "อนุมัติเรียบร้อย" : selectedTxn.status === "rejected" ? "ปฏิเสธ" : "รอการอนุมัติ"}
            </span>
          </div>

          <div class="gl-card" style="padding: 2px var(--space-4); margin-bottom: var(--space-4);">
            <div style="display: flex; justify-content: space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--border); font-size: var(--text-sm);">
              <span style="color: var(--muted-foreground);">กองทุน</span>
              <span style="font-weight: var(--weight-medium);">${selectedTxn.fundName}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--border); font-size: var(--text-sm);">
              <span style="color: var(--muted-foreground);">หมวด</span>
              <span style="font-weight: var(--weight-medium);">${selectedTxn.categoryName}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--border); font-size: var(--text-sm);">
              <span style="color: var(--muted-foreground);">บัญชีการเงิน</span>
              <span style="font-weight: var(--weight-medium);">${selectedTxn.accountName}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: var(--space-2) 0; font-size: var(--text-sm);">
              <span style="color: var(--muted-foreground);">ผู้บันทึก</span>
              <span style="font-weight: var(--weight-medium);">${selectedTxn.recordedBy}</span>
            </div>
          </div>

          <div class="gl-card" style="padding: var(--space-4);">
            <div class="kicker" style="margin: 0 0 var(--space-3);">ประวัติการตรวจสอบ</div>
            ${selectedTxn.timeline
              .map(
                (tl, idx) => `
              <div style="display: flex; gap: var(--space-3);">
                <div style="display: flex; flex-direction: column; align-items: center; padding-top: 3px;">
                  <span style="width: 8px; height: 8px; border-radius: var(--radius-full); background: ${
                    tl.status === "done" ? "var(--approved)" : tl.status === "active" ? "var(--pending)" : "var(--border)"
                  };"></span>
                  ${idx < selectedTxn.timeline.length - 1 ? `<span style="flex: 1; width: 1px; background: var(--border); margin: 3px 0;"></span>` : ""}
                </div>
                <div style="flex: 1; padding-bottom: ${idx < selectedTxn.timeline.length - 1 ? "var(--space-3)" : "0"};">
                  <div style="font-size: var(--text-xs); font-weight: var(--weight-medium);">${tl.title}</div>
                  <div class="num-display" style="font-size: var(--text-2xs); color: var(--muted-foreground); margin-top: 2px;">${tl.detail}</div>
                </div>
              </div>`
              )
              .join("")}
          </div>
        </div>
      </div>`
      : "";

    return `
    <div class="gl-page gl-fade-in">
      <div class="gl-page-header" style="margin-bottom: var(--space-4);">
        <h1>รายการเงิน</h1>
        <p>บันทึกรายรับ รายจ่าย และประวัติธุรกรรมทั้งหมดของคริสตจักร</p>
      </div>

      ${errorNoticeHtml}

      <!-- Month Overview Strip -->
      <section class="gl-section" style="margin-bottom: var(--space-4);">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
          <div class="gl-card gl-card--tight">
            <div style="font-size: var(--text-xs); color: var(--muted-foreground);">รายรับเดือนนี้</div>
            <div class="num-display" style="font-size: var(--text-lg); font-weight: var(--weight-bold); color: var(--income); margin-top: 2px;">
              +${incomeSum.format()}
            </div>
          </div>
          <div class="gl-card gl-card--tight">
            <div style="font-size: var(--text-xs); color: var(--muted-foreground);">รายจ่ายเดือนนี้</div>
            <div class="num-display" style="font-size: var(--text-lg); font-weight: var(--weight-bold); color: var(--expense); margin-top: 2px;">
              −${expenseSum.format()}
            </div>
          </div>
        </div>
      </section>

      <!-- Search and Filters -->
      <section class="gl-section" style="margin-bottom: var(--space-4);">
        <div style="
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: 0 var(--space-3);
          min-height: var(--touch-target-min);
          border: 1px solid var(--input);
          border-radius: var(--radius-input);
          background: var(--card);
          margin-bottom: var(--space-3);
        ">
          <span style="color: var(--muted-foreground);">${ICON_SEARCH}</span>
          <input id="txn-search-input" type="text" value="${this.searchQuery}" placeholder="ค้นหารายการ, รหัส หรือหมวดหมู่..." style="
            flex: 1;
            border: none;
            background: transparent;
            font-size: var(--text-sm);
            color: var(--foreground);
            outline: none;
          " />
        </div>

        <div style="display: flex; gap: var(--space-2); overflow-x: auto; padding-bottom: 4px; scrollbar-width: none;">
          <button class="filter-pill gl-btn gl-btn--sm ${this.activeFilter === "all" ? "gl-btn--primary" : "gl-btn--secondary"}" data-filter="all" style="border-radius: var(--radius-full);">ทั้งหมด</button>
          <button class="filter-pill gl-btn gl-btn--sm ${this.activeFilter === "income" ? "gl-btn--primary" : "gl-btn--secondary"}" data-filter="income" style="border-radius: var(--radius-full);">รายรับ</button>
          <button class="filter-pill gl-btn gl-btn--sm ${this.activeFilter === "expense" ? "gl-btn--primary" : "gl-btn--secondary"}" data-filter="expense" style="border-radius: var(--radius-full);">รายจ่าย</button>
          <button class="filter-pill gl-btn gl-btn--sm ${this.activeFilter === "transfer" ? "gl-btn--primary" : "gl-btn--secondary"}" data-filter="transfer" style="border-radius: var(--radius-full);">โอน</button>
          <button class="filter-pill gl-btn gl-btn--sm ${this.activeFilter === "pending" ? "gl-btn--primary" : "gl-btn--secondary"}" data-filter="pending" style="border-radius: var(--radius-full);">รออนุมัติ</button>
        </div>
      </section>

      <!-- Transaction Groups -->
      <section class="gl-section">
        ${renderGroup("วันนี้", todayItems)}
        ${renderGroup("เมื่อวาน", yesterdayItems)}
        ${renderGroup("รายการก่อนหน้า", earlierItems)}
        ${
          filtered.length === 0 && !this.errorMessage
            ? `<div class="gl-card gl-empty-state" style="text-align: center; padding: var(--space-8); color: var(--muted-foreground);">
                <div style="font-size: var(--text-base); font-weight: var(--weight-medium); color: var(--foreground); margin-bottom: 4px;">ยังไม่มีรายการธุรกรรม</div>
                <p style="margin: 0; font-size: var(--text-sm);">เมื่อมีการบันทึกรายรับ รายจ่าย หรือเงินถวาย รายการจะปรากฏที่นี่</p>
               </div>`
            : ""
        }
      </section>

      ${modalHtml}
    </div>
    `;
  }

  public attachEventListeners(root: HTMLElement, onStateChange: () => void): void {
    // Retry button
    const retryBtn = root.querySelector<HTMLButtonElement>("#retry-load-btn");
    retryBtn?.addEventListener("click", async () => {
      await this.loadData();
      onStateChange();
    });

    // Search input
    const searchInput = root.querySelector<HTMLInputElement>("#txn-search-input");
    searchInput?.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      onStateChange();
    });

    // Filter pills
    const pills = root.querySelectorAll<HTMLButtonElement>(".filter-pill");
    pills.forEach((btn) => {
      btn.addEventListener("click", () => {
        const filter = btn.getAttribute("data-filter") as any;
        if (filter) {
          this.activeFilter = filter;
          onStateChange();
        }
      });
    });

    // Row click -> open modal
    const rows = root.querySelectorAll<HTMLElement>(".gl-txn-row");
    rows.forEach((row) => {
      row.addEventListener("click", () => {
        const id = row.getAttribute("data-txn-id");
        if (id) {
          this.selectedTransactionId = id;
          onStateChange();
        }
      });
    });

    // Close modal
    const closeBtn = root.querySelector<HTMLButtonElement>("#close-modal-btn");
    closeBtn?.addEventListener("click", () => {
      this.selectedTransactionId = null;
      onStateChange();
    });

    const backdrop = root.querySelector<HTMLElement>("#txn-modal");
    backdrop?.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        this.selectedTransactionId = null;
        onStateChange();
      }
    });
  }
}
