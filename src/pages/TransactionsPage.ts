import { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml } from "../lib/format";
import { Database } from "../lib/supabase/types";
import { Money } from "../lib/money";
import { formatDateThai } from "../lib/format";
import { monthBounds } from "../lib/period";
import { TransactionsService } from "../lib/transactions/transactions-service";

export interface TransactionItem {
  id: string;
  code: string;
  description: string;
  categoryName: string;
  fundName: string;
  accountName: string;
  amount: Money;
  direction: "income" | "expense" | "transfer";
  date: string | null;
  dateGroup: "today" | "yesterday" | "earlier" | "undated";
  recordedBy: string;
  status:
    | "draft"
    | "pending_approval"
    | "approved"
    | "posted"
    | "rejected"
    | "voided";
  attachmentName?: string;
  attachmentSize?: string;
  timeline: {
    title: string;
    detail: string;
    status: "done" | "active" | "pending";
  }[];
}

interface SelectOption {
  id: string;
  name: string;
}

const ICON_SEARCH = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>`;
const ICON_PLUS = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
const ICON_INCOME = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>`;
const ICON_EXPENSE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>`;
const ICON_TRANSFER = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 9h13l-3-3M20 15H7l3 3"/></svg>`;
const ICON_CLOSE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;

// Real transaction lifecycle status -> Thai label + badge class. No guessing.
const TXN_STATUS: Record<
  TransactionItem["status"],
  {
    label: string;
    badge: "neutral" | "pending" | "approved" | "rejected" | "info";
  }
> = {
  draft: { label: "ร่าง", badge: "neutral" },
  pending_approval: { label: "รออนุมัติ", badge: "pending" },
  approved: { label: "อนุมัติแล้ว", badge: "approved" },
  posted: { label: "ลงบัญชีแล้ว", badge: "approved" },
  rejected: { label: "ไม่อนุมัติ", badge: "rejected" },
  voided: { label: "ยกเลิก", badge: "rejected" },
};

type TxnPeriod = "this_month" | "last_month" | "all";

const PERIOD_LABEL: Record<TxnPeriod, string> = {
  this_month: "เดือนนี้",
  last_month: "เดือนก่อนหน้า",
  all: "ทั้งหมด",
};

function dateGroupFor(dateStr: string | null): TransactionItem["dateGroup"] {
  if (!dateStr) return "undated";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "undated";
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startOfYesterday = new Date(
    startOfToday.getTime() - 24 * 60 * 60 * 1000,
  );
  if (d >= startOfToday) return "today";
  if (d >= startOfYesterday) return "yesterday";
  return "earlier";
}

export class TransactionsPage {
  private activeFilter: "all" | "income" | "expense" | "transfer" | "pending" =
    "all";
  private activePeriod: TxnPeriod = "this_month";
  private searchQuery = "";
  private selectedTransactionId: string | null = null;
  private isCreateModalOpen = false;
  private transactions: TransactionItem[] = [];
  private accounts: SelectOption[] = [];
  private funds: SelectOption[] = [];
  private categories: SelectOption[] = [];
  private transactionsService: TransactionsService;
  private errorMessage: string | null = null;
  private successMessage: string | null = null;
  private formErrorMessage: string | null = null;
  private isLoading = false;
  private isSubmitting = false;

  constructor(
    private supabase: SupabaseClient<Database>,
    private churchId: string,
  ) {
    this.transactionsService = new TransactionsService(supabase);
  }

  public async loadData(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    try {
      const txnsRes = await (this.supabase.from("transactions") as any)
        .select(
          `
          id,
          description,
          direction,
          transaction_date,
          reference_number,
          status,
          created_by,
          created_at,
          account_id,
          accounts(name),
          transaction_splits(amount, fund_id, category_id, funds(name), categories(name))
        `,
        )
        .eq("church_id", this.churchId)
        .order("transaction_date", { ascending: false });

      if (txnsRes?.error) {
        this.errorMessage = "ไม่สามารถโหลดรายการเงินได้ กรุณาลองใหม่อีกครั้ง";
        this.transactions = [];
        return;
      }

      // Safe auxiliary queries
      try {
        const accRes = await (this.supabase.from("accounts") as any)
          .select("id, name")
          .eq("church_id", this.churchId);
        if (Array.isArray(accRes?.data)) this.accounts = accRes.data;
      } catch {}

      try {
        const fndRes = await (this.supabase.from("funds") as any)
          .select("id, name")
          .eq("church_id", this.churchId);
        if (Array.isArray(fndRes?.data)) this.funds = fndRes.data;
      } catch {}

      try {
        const catRes = await (this.supabase.from("categories") as any)
          .select("id, name")
          .eq("church_id", this.churchId);
        if (Array.isArray(catRes?.data)) this.categories = catRes.data;
      } catch {}

      if (txnsRes.data && Array.isArray(txnsRes.data)) {
        const creatorIds = new Set<string>();
        const items = txnsRes.data.map((t: any) => {
          let sum = Money.zero();
          let fundName = "กองทุนทั่วไป";
          let categoryName: string | null = null;
          if (t.transaction_splits && Array.isArray(t.transaction_splits)) {
            for (const sp of t.transaction_splits) {
              if (sp.amount) sum = sum.add(Money.from(sp.amount));
              if (sp.funds?.name) fundName = sp.funds.name;
              if (!categoryName && sp.categories?.name)
                categoryName = sp.categories.name;
            }
          }

          const direction = (
            t.direction === "expense" || t.direction === "transfer"
              ? t.direction
              : "income"
          ) as "income" | "expense" | "transfer";

          const txnDate: string | null = t.transaction_date ?? null;
          if (t.created_by) creatorIds.add(t.created_by);

          return {
            id: t.id,
            code: t.reference_number || "—",
            description: t.description || "รายการทั่วไป",
            categoryName:
              categoryName ||
              (direction === "income" ? "ถวายทรัพย์" : "พันธกิจและสาธารณูปโภค"),
            fundName,
            accountName: t.accounts?.name || "บัญชีหลัก",
            amount: sum,
            direction,
            date: txnDate,
            dateGroup: dateGroupFor(txnDate),
            recordedBy: "",
            status: (t.status || "draft") as TransactionItem["status"],
            timeline: [
              {
                title: "สร้างรายการ",
                detail: `บันทึกเมื่อ ${txnDate ? formatDateThai(txnDate) : "ไม่ระบุวันที่"}`,
                status: "done" as const,
              },
            ],
            _createdBy: t.created_by as string | null,
          };
        });

        const idList = Array.from(creatorIds);
        const recorderById: Record<string, string> = {};
        if (idList.length > 0) {
          const { data: profiles } = await (
            this.supabase.from("profiles") as any
          )
            .select("id, full_name")
            .in("id", idList);
          for (const p of profiles || [])
            recorderById[p.id] = p.full_name || "ไม่ระบุผู้บันทึก";
        }

        this.transactions = items.map((it: any) => ({
          ...it,
          recordedBy: it._createdBy
            ? recorderById[it._createdBy] || "ไม่ระบุผู้บันทึก"
            : "ไม่ระบุผู้บันทึก",
        }));
      } else {
        this.transactions = [];
      }
    } catch {
      this.errorMessage =
        "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง";
      this.transactions = [];
    } finally {
      this.isLoading = false;
    }
  }

  public renderHtml(): string {
    const errorNoticeHtml = this.errorMessage
      ? `<div class="gl-notice gl-notice--error" role="alert" style="margin-bottom: var(--space-4);">
          <div class="gl-notice__body" style="display: flex; justify-content: space-between; align-items: center;">
            <span>${escapeHtml(this.errorMessage)}</span>
            <button id="retry-load-btn" class="gl-btn gl-btn--secondary gl-btn--sm">ลองใหม่</button>
          </div>
        </div>`
      : "";

    const successNoticeHtml = this.successMessage
      ? `<div class="gl-notice gl-notice--success" role="status" style="margin-bottom: var(--space-4);">
          <div class="gl-notice__body">${escapeHtml(this.successMessage)}</div>
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

    const now = new Date();
    const periodBounds =
      this.activePeriod === "all"
        ? null
        : this.activePeriod === "this_month"
          ? monthBounds(now)
          : monthBounds(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    const periodScoped = periodBounds
      ? this.transactions.filter(
          (t) =>
            t.date !== null &&
            t.date >= periodBounds.start &&
            t.date <= periodBounds.end,
        )
      : this.transactions;

    const filtered = periodScoped.filter((item) => {
      if (this.activeFilter === "income" && item.direction !== "income")
        return false;
      if (this.activeFilter === "expense" && item.direction !== "expense")
        return false;
      if (this.activeFilter === "transfer" && item.direction !== "transfer")
        return false;
      if (
        this.activeFilter === "pending" &&
        item.status !== "pending_approval" &&
        item.status !== "draft"
      )
        return false;

      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const match =
          item.description.toLowerCase().includes(q) ||
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
    for (const t of periodScoped) {
      if (t.direction === "income") incomeSum = incomeSum.add(t.amount);
      if (t.direction === "expense") expenseSum = expenseSum.add(t.amount);
    }

    const todayItems = filtered.filter((t) => t.dateGroup === "today");
    const yesterdayItems = filtered.filter((t) => t.dateGroup === "yesterday");
    const earlierItems = filtered.filter((t) => t.dateGroup === "earlier");
    const undatedItems = filtered.filter((t) => t.dateGroup === "undated");

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
                const iconSvg = isIncome
                  ? ICON_INCOME
                  : isExpense
                    ? ICON_EXPENSE
                    : ICON_TRANSFER;
                const bgVar = isIncome
                  ? "var(--income-muted)"
                  : isExpense
                    ? "var(--expense-muted)"
                    : "var(--secondary)";
                const colorVar = isIncome
                  ? "var(--income)"
                  : isExpense
                    ? "var(--expense)"
                    : "var(--muted-foreground)";
                const amountPrefix = isIncome ? "+" : isExpense ? "−" : "";
                const borderBottom =
                  idx < items.length - 1
                    ? `border-bottom: 1px solid var(--border);`
                    : "";

                return `
                <div class="gl-txn-row" data-txn-id="${item.id}" role="button" tabindex="0" aria-label="ดูรายละเอียด ${escapeHtml(item.description)}" style="
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
                    border-radius: var(--radius-md);
                    background: ${bgVar};
                    color: ${colorVar};
                    display: grid;
                    place-items: center;
                    flex-shrink: 0;
                  ">${iconSvg}</div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: var(--text-sm); font-weight: var(--weight-medium); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${escapeHtml(item.description)}
                    </div>
                    <div style="display: flex; align-items: center; gap: var(--space-1); margin-top: 4px; flex-wrap: wrap;">
                      <span class="gl-tag">${escapeHtml(item.fundName)}</span>
                      <span class="gl-tag">${escapeHtml(item.categoryName)}</span>
                    </div>
                  </div>
                  <div style="text-align: right; flex-shrink: 0;">
                    <div class="num-display" style="font-size: var(--text-sm); font-weight: var(--weight-bold); color: ${
                      isIncome
                        ? "var(--income)"
                        : isExpense
                          ? "var(--expense)"
                          : "var(--foreground)"
                    };">${amountPrefix}${item.amount.format()}</div>
                    <span class="gl-badge gl-badge--${TXN_STATUS[item.status].badge}" style="font-size: var(--text-2xs); padding: 0 var(--space-2); margin-top: 2px;">
                      ${TXN_STATUS[item.status].label}
                    </span>
                  </div>
                </div>`;
              })
              .join("")}
          </div>
        </div>`;
    };

    // Detail Modal
    const modalHtml = selectedTxn
      ? `
      <div id="txn-modal" class="gl-modal-backdrop gl-fade-in">
        <div class="gl-modal-content gl-rise" style="max-width: 440px; padding: var(--space-5); max-height: 90vh; overflow-y: auto;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
            <div>
              <div style="font-size: var(--text-base); font-weight: var(--weight-bold);">รายละเอียดรายการ</div>
              <div class="num-display" style="font-size: var(--text-xs); color: var(--muted-foreground);">${selectedTxn.code}</div>
            </div>
            <button id="close-modal-btn" class="gl-btn gl-btn--ghost gl-btn--sm" style="padding: 0; border-radius: var(--radius-full);">
              ${ICON_CLOSE}
            </button>
          </div>

          <div style="background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-4); text-align: center; margin-bottom: var(--space-4);">
            <div style="font-size: var(--text-xs); color: var(--muted-foreground);">${escapeHtml(selectedTxn.description)}</div>
            <div class="num-display" style="
              font-size: var(--text-3xl);
              font-weight: var(--weight-bold);
              margin: var(--space-2) 0;
              color: ${selectedTxn.direction === "income" ? "var(--income)" : selectedTxn.direction === "expense" ? "var(--expense)" : "var(--foreground)"};
            ">${selectedTxn.direction === "income" ? "+" : selectedTxn.direction === "expense" ? "−" : ""}${selectedTxn.amount.format()}</div>
            <span class="gl-badge gl-badge--${TXN_STATUS[selectedTxn.status].badge}">
              ${TXN_STATUS[selectedTxn.status].label}
            </span>
          </div>

          <div class="gl-card" style="padding: 2px var(--space-4); margin-bottom: var(--space-4);">
            <div style="display: flex; justify-content: space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--border); font-size: var(--text-sm);">
              <span style="color: var(--muted-foreground);">กองทุน</span>
              <span style="font-weight: var(--weight-medium);">${escapeHtml(selectedTxn.fundName)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: var(--space-2) 0; border-bottom: 1px solid var(--border); font-size: var(--text-sm);">
              <span style="color: var(--muted-foreground);">หมวด</span>
              <span style="font-weight: var(--weight-medium);">${escapeHtml(selectedTxn.categoryName)}</span>
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
                    tl.status === "done"
                      ? "var(--approved)"
                      : tl.status === "active"
                        ? "var(--pending)"
                        : "var(--border)"
                  };"></span>
                  ${idx < selectedTxn.timeline.length - 1 ? `<span style="flex: 1; width: 1px; background: var(--border); margin: 3px 0;"></span>` : ""}
                </div>
                <div style="flex: 1; padding-bottom: ${idx < selectedTxn.timeline.length - 1 ? "var(--space-3)" : "0"};">
                  <div style="font-size: var(--text-xs); font-weight: var(--weight-medium);">${tl.title}</div>
                  <div class="num-display" style="font-size: var(--text-2xs); color: var(--muted-foreground); margin-top: 2px;">${tl.detail}</div>
                </div>
              </div>`,
              )
              .join("")}
          </div>
        </div>
      </div>`
      : "";

    const todayDateStr = new Date().toISOString().split("T")[0];

    // Create Transaction Modal
    const createModalHtml = this.isCreateModalOpen
      ? `
      <div id="create-txn-modal" class="gl-modal-backdrop gl-fade-in">
        <div class="gl-modal-content gl-rise" style="max-width: 480px; max-height: 90vh; overflow-y: auto;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
            <div style="font-size: var(--text-base); font-weight: var(--weight-bold);">บันทึกรายการใหม่</div>
            <button id="close-create-txn-btn" class="gl-btn gl-btn--ghost gl-btn--sm" style="padding: 0; border-radius: var(--radius-full);">
              ${ICON_CLOSE}
            </button>
          </div>

          ${
            this.formErrorMessage
              ? `<div class="gl-notice gl-notice--error" style="margin-bottom: var(--space-3); font-size: var(--text-xs);">
                  <div class="gl-notice__body">${escapeHtml(this.formErrorMessage)}</div>
                </div>`
              : ""
          }

          <form id="create-txn-form" style="display: flex; flex-direction: column; gap: var(--space-3);">
            <div class="gl-field">
              <label class="gl-label">ประเภทรายการ *</label>
              <div style="display: flex; gap: var(--space-2);">
                <label style="flex: 1; display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-input); cursor: pointer;">
                  <input type="radio" name="txn-direction" value="expense" checked />
                  <span style="font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--expense);">รายจ่าย</span>
                </label>
                <label style="flex: 1; display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-input); cursor: pointer;">
                  <input type="radio" name="txn-direction" value="income" />
                  <span style="font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--income);">รายรับ</span>
                </label>
              </div>
            </div>

            <div class="gl-field">
              <label class="gl-label" for="txn-desc-input">รายละเอียดรายการ *</label>
              <input type="text" class="gl-input" id="txn-desc-input" required placeholder="เช่น ค่าไฟฟ้าประจำเดือน, ซื้ออุปกรณ์สำนักงาน" />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);">
              <div class="gl-field">
                <label class="gl-label" for="txn-amount-input">จำนวนเงิน (฿) *</label>
                <input type="number" class="gl-input" id="txn-amount-input" required placeholder="0.00" step="0.01" min="0.01" />
              </div>
              <div class="gl-field">
                <label class="gl-label" for="txn-date-input">วันที่ทำรายการ *</label>
                <input type="date" class="gl-input" id="txn-date-input" required value="${todayDateStr}" />
              </div>
            </div>

            <div class="gl-field">
              <label class="gl-label" for="txn-account-select">บัญชีการเงิน *</label>
              <select class="gl-select" id="txn-account-select" required>
                ${
                  this.accounts.length === 0
                    ? `<option value="">กำลังโหลดบัญชี...</option>`
                    : this.accounts
                        .map(
                          (a) =>
                            `<option value="${a.id}">${escapeHtml(a.name)}</option>`,
                        )
                        .join("")
                }
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);">
              <div class="gl-field">
                <label class="gl-label" for="txn-fund-select">กองทุน *</label>
                <select class="gl-select" id="txn-fund-select" required>
                  ${
                    this.funds.length === 0
                      ? `<option value="">กำลังโหลดกองทุน...</option>`
                      : this.funds
                          .map(
                            (f) =>
                              `<option value="${f.id}">${escapeHtml(f.name)}</option>`,
                          )
                          .join("")
                  }
                </select>
              </div>

              <div class="gl-field">
                <label class="gl-label" for="txn-cat-select">หมวดหมู่ *</label>
                <select class="gl-select" id="txn-cat-select" required>
                  ${
                    this.categories.length === 0
                      ? `<option value="">กำลังโหลดหมวด...</option>`
                      : this.categories
                          .map(
                            (c) =>
                              `<option value="${c.id}">${escapeHtml(c.name)}</option>`,
                          )
                          .join("")
                  }
                </select>
              </div>
            </div>

            <div style="display: flex; gap: var(--space-2); margin-top: var(--space-2);">
              <button type="button" id="cancel-create-txn-btn" class="gl-btn gl-btn--secondary" style="flex: 1;" ${this.isSubmitting ? "disabled" : ""}>ยกเลิก</button>
              <button type="submit" class="gl-btn gl-btn--primary" style="flex: 1;" ${this.isSubmitting ? "disabled" : ""}>
                ${this.isSubmitting ? "กำลังบันทึก..." : "ส่งขออนุมัติ"}
              </button>
            </div>
          </form>
        </div>
      </div>`
      : "";

    return `
    <div class="gl-page gl-fade-in">
      <div style="display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-4); flex-wrap: wrap;">
        <div class="gl-page-header" style="margin-bottom: 0;">
          <h1>รายการเงิน</h1>
          <p>บันทึกรายรับ รายจ่าย และประวัติธุรกรรมทั้งหมดของคริสตจักร</p>
        </div>
        <button id="open-create-txn-btn" class="gl-btn gl-btn--primary">
          ${ICON_PLUS}
          <span>บันทึกรายการใหม่</span>
        </button>
      </div>

      ${errorNoticeHtml}
      ${successNoticeHtml}

      <!-- Period selector -->
      <section class="gl-section" style="margin-bottom: var(--space-3);">
        <div class="gl-tablist" role="tablist" aria-label="ช่วงเวลา">
          <button class="gl-tab${this.activePeriod === "this_month" ? " is-active" : ""}" data-period="this_month">เดือนนี้</button>
          <button class="gl-tab${this.activePeriod === "last_month" ? " is-active" : ""}" data-period="last_month">เดือนก่อนหน้า</button>
          <button class="gl-tab${this.activePeriod === "all" ? " is-active" : ""}" data-period="all">ทั้งหมด</button>
        </div>
      </section>

      <!-- Period overview strip -->
      <section class="gl-section" style="margin-bottom: var(--space-4);">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
          <div class="gl-card gl-card--tight">
            <div style="font-size: var(--text-xs); color: var(--muted-foreground);">รายรับ${PERIOD_LABEL[this.activePeriod]}</div>
            <div class="num-display" style="font-size: var(--text-lg); font-weight: var(--weight-bold); color: var(--income); margin-top: 2px;">
              +${incomeSum.format()}
            </div>
          </div>
          <div class="gl-card gl-card--tight">
            <div style="font-size: var(--text-xs); color: var(--muted-foreground);">รายจ่าย${PERIOD_LABEL[this.activePeriod]}</div>
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
        ${renderGroup("ไม่ระบุวันที่", undatedItems)}
        ${
          filtered.length === 0 && !this.errorMessage
            ? `<div class="gl-card gl-empty-state" style="text-align: center; padding: var(--space-8); color: var(--muted-foreground);">
                <div style="font-size: var(--text-base); font-weight: var(--weight-medium); color: var(--foreground); margin-bottom: 4px;">ยังไม่มีรายการธุรกรรม</div>
                <p style="margin: 0 0 var(--space-3); font-size: var(--text-sm);">เมื่อมีการบันทึกรายรับ รายจ่าย หรือเงินถวาย รายการจะปรากฏที่นี่</p>
                <button id="empty-create-txn-btn" class="gl-btn gl-btn--primary gl-btn--sm">+ บันทึกรายการแรก</button>
               </div>`
            : ""
        }
      </section>

      ${modalHtml}
      ${createModalHtml}
    </div>
    `;
  }

  public attachEventListeners(
    root: HTMLElement,
    onStateChange: () => void,
  ): void {
    // Retry button
    const retryBtn = root.querySelector<HTMLButtonElement>("#retry-load-btn");
    retryBtn?.addEventListener("click", async () => {
      await this.loadData();
      onStateChange();
    });

    // Search input
    const searchInput =
      root.querySelector<HTMLInputElement>("#txn-search-input");
    searchInput?.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      onStateChange();
    });

    // Create Transaction Modal Toggle
    const openCreate = () => {
      this.isCreateModalOpen = true;
      this.formErrorMessage = null;
      this.successMessage = null;
      onStateChange();
    };

    root
      .querySelector<HTMLButtonElement>("#open-create-txn-btn")
      ?.addEventListener("click", openCreate);
    root
      .querySelector<HTMLButtonElement>("#empty-create-txn-btn")
      ?.addEventListener("click", openCreate);

    const closeCreateModal = () => {
      this.isCreateModalOpen = false;
      this.formErrorMessage = null;
      onStateChange();
    };

    root
      .querySelector<HTMLButtonElement>("#close-create-txn-btn")
      ?.addEventListener("click", closeCreateModal);
    root
      .querySelector<HTMLButtonElement>("#cancel-create-txn-btn")
      ?.addEventListener("click", closeCreateModal);
    const createBackdrop = root.querySelector<HTMLElement>("#create-txn-modal");
    createBackdrop?.addEventListener("click", (e) => {
      if (e.target === createBackdrop) closeCreateModal();
    });

    // Create Transaction Form Submission
    const createForm = root.querySelector<HTMLFormElement>("#create-txn-form");
    createForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const descInput = root.querySelector<HTMLInputElement>("#txn-desc-input");
      const amountInput =
        root.querySelector<HTMLInputElement>("#txn-amount-input");
      const dateInput = root.querySelector<HTMLInputElement>("#txn-date-input");
      const accountSelect = root.querySelector<HTMLSelectElement>(
        "#txn-account-select",
      );
      const fundSelect =
        root.querySelector<HTMLSelectElement>("#txn-fund-select");
      const catSelect =
        root.querySelector<HTMLSelectElement>("#txn-cat-select");

      const descVal = descInput?.value?.trim() || "";
      const amountVal = amountInput?.value || "0";
      const dateVal = dateInput?.value || "";
      const accountVal = accountSelect?.value || "";
      const fundVal = fundSelect?.value || "";
      const catVal = catSelect?.value || "";

      if (!descVal || !amountVal || !accountVal || !fundVal || !catVal) {
        this.formErrorMessage = "กรุณากรอกข้อมูลให้ครบทุกช่อง";
        onStateChange();
        return;
      }

      this.isSubmitting = true;
      this.formErrorMessage = null;
      onStateChange();

      try {
        const draftRes = await this.transactionsService.createDraftTransaction({
          church_id: this.churchId,
          description: descVal,
          transaction_date: dateVal,
          account_id: accountVal,
          category_id: catVal,
          amount: amountVal,
          splits: [
            {
              fund_id: fundVal,
              amount: amountVal,
              notes: descVal,
            },
          ],
        });

        if (!draftRes.success || !draftRes.data) {
          this.formErrorMessage = draftRes.error || "ไม่สามารถบันทึกรายการได้";
          this.isSubmitting = false;
          onStateChange();
          return;
        }

        // Submit for approval
        const submitRes = await this.transactionsService.submitTransaction(
          draftRes.data.transaction_id,
        );
        if (!submitRes.success) {
          this.formErrorMessage =
            submitRes.error || "บันทึกร่างแล้วแต่ส่งขออนุมัติไม่สำเร็จ";
          this.isSubmitting = false;
          await this.loadData();
          onStateChange();
          return;
        }

        this.isCreateModalOpen = false;
        this.successMessage = `บันทึกรายการ "${descVal}" และส่งขออนุมัติเรียบร้อยแล้ว`;
        this.isSubmitting = false;
        await this.loadData();
        onStateChange();
      } catch (err: any) {
        this.formErrorMessage = err.message || "เกิดข้อผิดพลาด";
        this.isSubmitting = false;
        onStateChange();
      }
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

    // Period tabs
    const periodTabs = root.querySelectorAll<HTMLButtonElement>(
      ".gl-tablist [data-period]",
    );
    periodTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const period = tab.getAttribute("data-period") as TxnPeriod | null;
        if (period) {
          this.activePeriod = period;
          onStateChange();
        }
      });
    });

    // Row click / keyboard activation -> open modal
    const rows = root.querySelectorAll<HTMLElement>(".gl-txn-row");
    rows.forEach((row) => {
      const openRow = () => {
        const id = row.getAttribute("data-txn-id");
        if (id) {
          this.selectedTransactionId = id;
          onStateChange();
        }
      };
      row.addEventListener("click", openRow);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openRow();
        }
      });
    });

    // Close modal
    const closeModal = () => {
      this.selectedTransactionId = null;
      onStateChange();
    };

    const closeBtn = root.querySelector<HTMLButtonElement>("#close-modal-btn");
    closeBtn?.addEventListener("click", closeModal);

    const backdrop = root.querySelector<HTMLElement>("#txn-modal");
    backdrop?.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });

    if (this.selectedTransactionId) {
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", onKeyDown);
          closeModal();
        }
      };
      document.addEventListener("keydown", onKeyDown);
    }
  }
}
