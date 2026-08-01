/**
 * RecentTransactionsTable.tsx
 *
 * Renders recent financial entries with premium row design:
 * - Left border flash on hover (color per transaction type)
 * - Pending rows: amber left border persistent + background tint
 * - Stagger entrance animation per row
 * - Right-aligned tabular amounts with min-width for alignment
 * - Category pill tag in meta line
 */

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyText } from "@/components/shared/MoneyText";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TxStatus } from "@/lib/types";

export interface TransactionRow {
  id: string;
  kind: "income" | "expense";
  date: string;
  amount: number;
  description?: string;
  categoryName?: string;
  vendor?: string;
  status: TxStatus;
  createdBy?: string;
}

interface RecentTransactionsTableProps {
  transactions?: TransactionRow[];
  onSelectTx?: (tx: TransactionRow) => void;
}

const DEFAULT_TXS: TransactionRow[] = [
  {
    id: "tx-001",
    kind: "income",
    date: "2024-01-15",
    amount: 45000,
    description: "เงินบริจาคสัปดาห์ที่ 2 ประจำเดือนมกราคม",
    categoryName: "เงินบริจาคประจำสัปดาห์",
    status: "approved",
    createdBy: "คุณสมชาย ใจดี",
  },
  {
    id: "tx-002",
    kind: "expense",
    date: "2024-01-14",
    amount: 12500,
    description: "ค่าซ่อมบำรุงระบบเครื่องเสียงห้องประชุมใหญ่",
    categoryName: "ค่าซ่อมบำรุง",
    vendor: "หจก. ซาวด์เอ็นจิเนียริ่ง",
    status: "approved",
    createdBy: "คุณวิไล รัตน์",
  },
  {
    id: "tx-003",
    kind: "expense",
    date: "2024-01-13",
    amount: 30000,
    description: "เงินสนับสนุนพันธกิจมิชชันนารีภาคเหนือ",
    categoryName: "มิชชันนารี",
    status: "pending",
    createdBy: "คุณสมชาย ใจดี",
  },
  {
    id: "tx-004",
    kind: "expense",
    date: "2024-01-12",
    amount: 8900,
    description: "ชำระค่าไฟฟ้าอาคารคริสตจักรประจำเดือนมกราคม",
    categoryName: "ค่าสาธารณูปโภค",
    vendor: "การไฟฟ้าส่วนภูมิภาค",
    status: "approved",
    createdBy: "คุณสมชาย ใจดี",
  },
];

type FilterTab = "all" | "income" | "expense" | "pending";

const FILTER_LABELS: Record<FilterTab, string> = {
  all: "ทั้งหมด",
  income: "รายรับ",
  expense: "รายจ่าย",
  pending: "รออนุมัติ",
};

export function RecentTransactionsTable({
  transactions = DEFAULT_TXS,
  onSelectTx,
}: RecentTransactionsTableProps) {
  const displayTxs = transactions.length > 0 ? transactions : DEFAULT_TXS;
  const [filter, setFilter] = useState<FilterTab>("all");

  const filtered = displayTxs.filter((tx) => {
    if (filter === "income") return tx.kind === "income";
    if (filter === "expense") return tx.kind === "expense";
    if (filter === "pending") return tx.status === "pending";
    return true;
  });

  const pendingCount = displayTxs.filter((t) => t.status === "pending").length;

  return (
    <div className="card-ledger overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">รายการการเงินล่าสุด</h3>
          <p className="text-xs text-muted-foreground">บันทึกรับ-จ่าย และสถานะการอนุมัติ</p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-0.5 rounded-lg bg-muted/60 p-1">
          {(Object.keys(FILTER_LABELS) as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                "relative px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150",
                filter === tab
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {FILTER_LABELS[tab]}
              {tab === "pending" && pendingCount > 0 && (
                <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-pending px-1 text-[9px] font-bold text-pending-foreground">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/40">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-muted-foreground">ไม่พบรายการ</p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">ลองเปลี่ยนตัวกรอง</p>
          </div>
        ) : (
          filtered.map((tx, index) => {
            const isIncome = tx.kind === "income";
            const isPending = tx.status === "pending";

            return (
              <div
                key={tx.id}
                onClick={() => onSelectTx?.(tx)}
                className={cn(
                  "group relative flex cursor-pointer items-center gap-3 px-5 py-3.5",
                  "transition-colors duration-150 hover:bg-muted/40",
                  // Left border accent
                  "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:rounded-r before:transition-all before:duration-150",
                  isPending
                    ? "before:bg-pending"
                    : isIncome
                      ? "before:bg-income before:opacity-0 hover:before:opacity-100"
                      : "before:bg-expense before:opacity-0 hover:before:opacity-100",
                  isPending && "bg-pending/[0.025]",
                  "animate-fade-up",
                )}
                style={{ animationDelay: `${index * 35}ms` }}
              >
                {/* Kind icon */}
                <div
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                    isIncome ? "bg-income-muted text-income" : "bg-expense-muted text-expense",
                  )}
                >
                  {isIncome ? (
                    <ArrowDownLeft className="h-4 w-4" strokeWidth={2} />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                  )}
                </div>

                {/* Description + meta */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground transition-colors group-hover:text-primary">
                    {tx.description || tx.categoryName || (isIncome ? "รายรับ" : "รายจ่าย")}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 overflow-hidden">
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {fmtDate(tx.date)}
                    </span>
                    {tx.categoryName && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="truncate rounded bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                          {tx.categoryName}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status + amount */}
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={tx.status} variant="dot" />
                  <p
                    className={cn(
                      "num-display min-w-[88px] text-right text-sm font-bold",
                      isIncome ? "amount-income" : "amount-expense",
                    )}
                  >
                    {isIncome ? "+" : "−"}
                    <MoneyText value={tx.amount} />
                  </p>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-foreground" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
