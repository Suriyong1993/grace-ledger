import { SupabaseClient } from "@supabase/supabase-js";
import { renderEmptyStateHtml } from "../components/shared/EmptyState";
import { escapeHtml } from "../lib/format";
import { Database } from "../lib/supabase/types";
import { Money } from "../lib/money";
import { formatDateThai } from "../lib/format";
import { monthBounds } from "../lib/period";

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

const ICON_SEARCH = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>`;
const ICON_INCOME = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>`;
const ICON_EXPENSE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>`;
const ICON_TRANSFER = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 9h13l-3-3M20 15H7l3 3"/></svg>`;
const ICON_DOWNLOAD = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

// Real transaction lifecycle status -> Thai label + badge class.
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

export type TxnPeriod = "this_month" | "last_month" | "last_3_months" | "all";
export type TxnSort = "newest" | "oldest" | "amount_desc" | "amount_asc";

function dateGroupFor(dateStr: string | null): TransactionItem["dateGroup"] {
  if (!dateStr) return "undated";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "undated";
  // Compare as YYYY-MM-DD strings to avoid timezone issues
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (dateStr >= todayStr) return "today";
  if (dateStr >= yesterdayStr) return "yesterday";
  return "earlier";
}

export class TransactionsPage {
  private activeFilter: "all" | "income" | "expense" | "transfer" | "pending" =
    "all";
  private activePeriod: TxnPeriod = "this_month";
  private activeSort: TxnSort = "newest";
  private searchQuery = "";

  /**
   * One-shot deep-link actions, consumed before render:
   * `#/transactions?create=1` (shell "บันทึกรายการ" action) opens the
   * existing create form. The query is cleaned from the URL afterwards so a
   * later back/refresh does not replay the action.
   */
  public consumeDeepLinkActions(): void {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    const queryIndex = hash.indexOf("?");
    if (queryIndex === -1) return;
    const params = new URLSearchParams(hash.slice(queryIndex + 1));
    if (params.get("create") === "1") {
      // create action handled by URL detection
    }
    window.history.replaceState(
      null,
      "",
      window.location.pathname +
        window.location.search +
        hash.slice(0, queryIndex),
    );
  }

  private transactions: TransactionItem[] = [];
  private errorMessage: string | null = null;
  private successMessage: string | null = null;
  private isLoading = false;

  constructor(
    private supabase: SupabaseClient<Database>,
    private churchId: string,
  ) {
    // TransactionsService available if needed for future features
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

      // Safe auxiliary queries — results used for form dropdowns if needed
      try {
        await this.supabase
          .from("accounts")
          .select("id, name")
          .eq("church_id", this.churchId);
      } catch {}

      try {
        await this.supabase
          .from("funds")
          .select("id, name")
          .eq("church_id", this.churchId);
      } catch {}

      try {
        await this.supabase
          .from("categories")
          .select("id, name")
          .eq("church_id", this.churchId);
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

  public exportCsv(): void {
    if (this.transactions.length === 0) return;
    const headers = [
      "ID",
      "Code",
      "Date",
      "Description",
      "Fund",
      "Category",
      "Account",
      "Direction",
      "Amount",
      "Status",
      "RecordedBy",
    ];
    const rows = this.transactions.map((t) => [
      t.id,
      t.code,
      t.date || "",
      `"${(t.description || "").replace(/"/g, '""')}"`,
      `"${(t.fundName || "").replace(/"/g, '""')}"`,
      `"${(t.categoryName || "").replace(/"/g, '""')}"`,
      `"${(t.accountName || "").replace(/"/g, '""')}"`,
      t.direction,
      t.amount.toFixed(2),
      t.status,
      `"${(t.recordedBy || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      "﻿" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `grace_ledger_transactions_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  public renderHtml(_user?: any): string {
    const errorNoticeHtml = this.errorMessage
      ? `<div class="gl-notice gl-notice--error" role="alert">
          <div class="gl-notice__body">
            <span>${escapeHtml(this.errorMessage)}</span>
            <button id="retry-load-btn" class="gl-btn gl-btn--secondary gl-btn--sm">ลองใหม่</button>
          </div>
        </div>`
      : "";

    const successNoticeHtml = this.successMessage
      ? `<div class="gl-notice gl-notice--success" role="status">
          <div class="gl-notice__body">${escapeHtml(this.successMessage)}</div>
        </div>`
      : "";

    if (this.isLoading) {
      return `
      <div class="gl-page gl-fade-in">
        <div class="gl-page-header">
          <h1>รายการเงิน</h1>
          <p>บันทึกรายรับ รายจ่าย และประวัติธุรกรรมทั้งหมดของคริสตจักร</p>
        </div>
        <div class="gl-card gl-loading-center">
          <p>กำลังโหลดข้อมูลรายการเงิน...</p>
        </div>
      </div>`;
    }

    const now = new Date();
    let periodBounds: { start: string; end: string } | null = null;
    if (this.activePeriod === "this_month") {
      periodBounds = monthBounds(now);
    } else if (this.activePeriod === "last_month") {
      periodBounds = monthBounds(
        new Date(now.getFullYear(), now.getMonth() - 1, 1),
      );
    } else if (this.activePeriod === "last_3_months") {
      const start3Months = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const currentMonth = monthBounds(now);
      const startBounds = monthBounds(start3Months);
      periodBounds = { start: startBounds.start, end: currentMonth.end };
    }

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
          item.categoryName.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    // Sorting
    const sorted = [...filtered];
    if (this.activeSort === "oldest") {
      sorted.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    } else if (this.activeSort === "amount_desc") {
      sorted.sort((a, b) => b.amount.toNumber() - a.amount.toNumber());
    } else if (this.activeSort === "amount_asc") {
      sorted.sort((a, b) => a.amount.toNumber() - b.amount.toNumber());
    } else {
      // newest
      sorted.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    }

    // Calculate Summary Stats from periodScoped
    let incomeSum = Money.zero();
    let expenseSum = Money.zero();
    for (const t of periodScoped) {
      if (t.direction === "income") incomeSum = incomeSum.add(t.amount);
      if (t.direction === "expense") expenseSum = expenseSum.add(t.amount);
    }
    const netSum = incomeSum.subtract(expenseSum);
    const netIsPositive = netSum.isPositive();
    const netSign = netIsPositive ? "+" : "";

    const todayItems = sorted.filter((t) => t.dateGroup === "today");
    const yesterdayItems = sorted.filter((t) => t.dateGroup === "yesterday");
    const earlierItems = sorted.filter((t) => t.dateGroup === "earlier");
    const undatedItems = sorted.filter((t) => t.dateGroup === "undated");

    const renderGroup = (title: string, items: TransactionItem[]) => {
      if (items.length === 0) return "";
      return `
        <div class="gl-txn-group">
          <div class="kicker gl-txn-group__title">${title}</div>
          <div class="gl-card gl-txn-list">
            ${items
              .map((item) => {
                const isIncome = item.direction === "income";
                const isExpense = item.direction === "expense";
                const iconSvg = isIncome
                  ? ICON_INCOME
                  : isExpense
                    ? ICON_EXPENSE
                    : ICON_TRANSFER;
                const iconClass = isIncome
                  ? "gl-row__icon--income"
                  : isExpense
                    ? "gl-row__icon--expense"
                    : "gl-row__icon--transfer";
                const amountColor = isIncome
                  ? "var(--income)"
                  : isExpense
                    ? "var(--expense)"
                    : "var(--foreground)";
                const amountPrefix = isIncome ? "+" : isExpense ? "−" : "";
                const statusInfo = TXN_STATUS[item.status];

                return `
                <a href="#/transactions/${item.id}" class="gl-row gl-txn-row" data-txn-id="${item.id}" aria-label="ดูรายละเอียด ${escapeHtml(item.description)}">
                  <span class="gl-row__icon ${iconClass}" aria-hidden="true">${iconSvg}</span>
                  <span class="gl-row__body">
                    <span class="gl-row__title">${escapeHtml(item.description)}</span>
                    <span class="gl-row__meta">
                      <span class="gl-tag">${escapeHtml(item.fundName)}</span>
                      <span class="gl-tag">${escapeHtml(item.categoryName)}</span>
                      ${item.date ? `<span>${formatDateThai(item.date)}</span>` : ""}
                    </span>
                  </span>
                  <span class="gl-row__end">
                    <span class="num-display" style="color: ${amountColor};">${amountPrefix}${item.amount.format()}</span>
                    <span class="gl-badge gl-badge--${statusInfo.badge}">${statusInfo.label}</span>
                  </span>
                </a>`;
              })
              .join("")}
          </div>
        </div>`;
    };

    const emptyHtml = sorted.length === 0
      ? renderEmptyStateHtml({
          message: "ไม่พบรายการที่ตรงกับเงื่อนไข",
          hint: "ลองเปลี่ยนตัวกรองหรือคำค้นหา",
        })
      : "";

    return `
    <div class="gl-page gl-fade-in">
      ${errorNoticeHtml}
      ${successNoticeHtml}

      <div class="gl-page-header">
        <h1>รายการเงิน</h1>
        <p>บันทึกรายรับ รายจ่าย และประวัติธุรกรรมทั้งหมดของคริสตจักร</p>
      </div>

      <!-- Summary Stats -->
      <div class="gl-card gl-txn-summary">
        <div class="gl-txn-summary__item">
          <span class="gl-txn-summary__label">รายรับ</span>
          <span class="num-display gl-txn-summary__value gl-income">+${incomeSum.format()}</span>
        </div>
        <div class="gl-txn-summary__item">
          <span class="gl-txn-summary__label">รายจ่าย</span>
          <span class="num-display gl-txn-summary__value gl-expense">−${expenseSum.format()}</span>
        </div>
        <div class="gl-txn-summary__item">
          <span class="gl-txn-summary__label">สุทธิ</span>
          <span class="num-display gl-txn-summary__value ${netSum.isPositive() ? 'gl-income' : netSum.isNegative() ? 'gl-expense' : 'gl-net'}">${netSign}${netSum.format()}</span>
        </div>
      </div>

      <!-- Filters -->
      <div class="gl-card gl-txn-filters">
        <div class="gl-txn-filters__search">
          <span class="gl-input-icon" aria-hidden="true">${ICON_SEARCH}</span>
          <input type="text" class="gl-input gl-txn-filters__input" placeholder="ค้นหารายการ..." value="${escapeHtml(this.searchQuery)}" data-action="search">
        </div>
        <div class="gl-txn-filters__actions">
          <div class="gl-filter-group">
            <button class="filter-pill ${this.activeFilter === "all" ? "is-active" : ""}" data-action="filter" data-value="all">ทั้งหมด</button>
            <button class="filter-pill ${this.activeFilter === "income" ? "is-active" : ""}" data-action="filter" data-value="income">รายรับ</button>
            <button class="filter-pill ${this.activeFilter === "expense" ? "is-active" : ""}" data-action="filter" data-value="expense">รายจ่าย</button>
            <button class="filter-pill ${this.activeFilter === "pending" ? "is-active" : ""}" data-action="filter" data-value="pending">รอดำเนินการ</button>
          </div>
          <select class="gl-select gl-txn-filters__period" data-action="period">
            <option value="this_month" ${this.activePeriod === "this_month" ? "selected" : ""}>เดือนนี้</option>
            <option value="last_month" ${this.activePeriod === "last_month" ? "selected" : ""}>เดือนก่อน</option>
            <option value="last_3_months" ${this.activePeriod === "last_3_months" ? "selected" : ""}>3 เดือนล่าสุด</option>
            <option value="all" ${this.activePeriod === "all" ? "selected" : ""}>ทั้งหมด</option>
          </select>
          <button class="gl-btn gl-btn--secondary gl-btn--sm" data-action="export" aria-label="ส่งออก CSV">${ICON_DOWNLOAD}</button>
        </div>
      </div>

      <!-- Transaction List -->
      ${emptyHtml}
      ${renderGroup("วันนี้", todayItems)}
      ${renderGroup("เมื่อวาน", yesterdayItems)}
      ${renderGroup("ก่อนหน้านี้", earlierItems)}
      ${renderGroup("ไม่ระบุวันที่", undatedItems)}
    </div>`;
  }
}
