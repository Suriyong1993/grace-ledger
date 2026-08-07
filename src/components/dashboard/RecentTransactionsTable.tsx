/**
 * RecentTransactionsTable.tsx
 *
 * Recent transactions table:
 * - Compact rows with short-ID, icon, description, amount, status dot, date
 * - Filter pill tabs: ทั้งหมด / รายรับ / รายจ่าย / รออนุมัติ
 * - Pending rows get a warning-tone left-border flash
 * - Right-aligned tabular amounts, green=credit / red=debit always
 */

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, HandHeart } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyText } from "@/components/shared/MoneyText";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TxStatus } from "@/lib/types";

export interface TransactionRow {
  id: string;
  kind: "income" | "expense" | "offering";
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
    description: "เงินบริจาคสัปดาห์ที่ 2 มกราคม",
    categoryName: "เงินบริจาคประจำสัปดาห์",
    status: "approved",
    createdBy: "คุณสมชาย ใจดี",
  },
  {
    id: "tx-002",
    kind: "expense",
    date: "2024-01-14",
    amount: 12500,
    description: "ค่าซ่อมบำรุงระบบเครื่องเสียง",
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
    description: "ชำระค่าไฟฟ้าอาคารคริสตจักร มกราคม",
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

function KindIcon({ kind }: { kind: "income" | "expense" | "offering" }) {
  if (kind === "income") {
    return (
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-income-muted text-income">
        <ArrowDownLeft className="h-4 w-4" strokeWidth={2.25} />
      </div>
    );
  }
  if (kind === "offering") {
    return (
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-offering-muted text-offering">
        <HandHeart className="h-4 w-4" strokeWidth={1.75} />
      </div>
    );
  }
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-expense-muted text-expense">
      <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
    </div>
  );
}

export function RecentTransactionsTable({
  transactions = DEFAULT_TXS,
  onSelectTx,
}: RecentTransactionsTableProps) {
  const displayTxs = transactions;
  const [filter, setFilter] = useState<FilterTab>("all");

  const filtered = displayTxs.filter((tx) => {
    if (filter === "income") return tx.kind === "income";
    if (filter === "expense") return tx.kind === "expense" || tx.kind === "offering";
    if (filter === "pending") return tx.status === "pending";
    return true;
  });

  const pendingCount = displayTxs.filter((t) => t.status === "pending").length;

  return (
    <div className="rounded-card border border-border bg-card shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">รายการการเงินล่าสุด</h3>
          <p className="text-xs text-muted-foreground mt-0.5">บันทึกรับ-จ่ายและสถานะการอนุมัติ</p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-0.5 rounded-xl bg-muted/60 p-1">
          {(Object.keys(FILTER_LABELS) as FilterTab[]).map((tab) => (
            <Button
              key={tab}
              variant="ghost"
              size="sm"
              onClick={() => setFilter(tab)}
              className={cn(
                "h-auto rounded-lg px-2.5 py-1 text-[11px] font-medium",
                filter === tab
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "text-muted-foreground hover:text-foreground hover:bg-card",
              )}
            >
              {FILTER_LABELS[tab]}
              {tab === "pending" && pendingCount > 0 && (
                <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[9px] font-bold text-warning-foreground">
                  {pendingCount}
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 border-b border-border/30 bg-muted/30 px-5 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-12">
          ID
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          รายการ
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right min-w-[88px]">
          จำนวนเงิน
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[72px]">
          สถานะ
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[72px] text-right">
          วันที่
        </span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/30">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-muted-foreground">ไม่พบรายการ</p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">ลองเปลี่ยนตัวกรอง</p>
          </div>
        ) : (
          filtered.map((tx) => {
            const isIncome = tx.kind === "income";
            const isPending = tx.status === "pending";
            const shortId = tx.id.replace("tx-", "#").padStart(4, "0");

            return (
              <div
                key={tx.id}
                onClick={() => onSelectTx?.(tx)}
                className={cn(
                  "group relative grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 px-5 py-3.5",
                  "cursor-pointer transition-colors duration-100 hover:bg-muted/40",
                  isPending && "bg-warning/5",
                  isPending &&
                    "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-warning",
                )}
              >
                {/* ID */}
                <div className="flex items-center gap-2 w-12">
                  <span className="text-[10px] font-mono text-muted-foreground/70 font-semibold">
                    {shortId}
                  </span>
                </div>

                {/* Description + meta */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <KindIcon kind={tx.kind as "income" | "expense" | "offering"} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">
                      {tx.description || tx.categoryName || (isIncome ? "รายรับ" : "รายจ่าย")}
                    </p>
                    {tx.categoryName && (
                      <span className="mt-0.5 inline-block truncate rounded-md bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                        {tx.categoryName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <p
                  className={cn(
                    "num-display min-w-[88px] text-right text-[13px] font-bold",
                    isIncome ? "text-income" : "text-expense",
                  )}
                >
                  {isIncome ? "+" : "−"}
                  <MoneyText value={tx.amount} />
                </p>

                {/* Status */}
                <div className="min-w-[72px]">
                  <StatusBadge status={tx.status} variant="dot" />
                </div>

                {/* Date */}
                <p className="min-w-[72px] text-right text-[11px] text-muted-foreground">
                  {fmtDate(tx.date)}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
