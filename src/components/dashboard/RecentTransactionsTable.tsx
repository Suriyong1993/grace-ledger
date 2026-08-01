/**
 * RecentTransactionsTable.tsx
 *
 * Adapted from the "Recent Files" table in the 3-column reference design.
 * Renders recent financial entries with status badges, category icons, and drawer inspection.
 */

import { useState } from "react";
import { ArrowDownLeft, ArrowUpLeft, ChevronRight, FileText } from "lucide-react";
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

export function RecentTransactionsTable({
  transactions = DEFAULT_TXS,
  onSelectTx,
}: RecentTransactionsTableProps) {
  const displayTxs = transactions.length > 0 ? transactions : DEFAULT_TXS;
  const [filter, setFilter] = useState<"all" | "income" | "expense" | "pending">("all");

  const filtered = displayTxs.filter((tx) => {
    if (filter === "income") return tx.kind === "income";
    if (filter === "expense") return tx.kind === "expense";
    if (filter === "pending") return tx.status === "pending";
    return true;
  });

  return (
    <div className="card-ledger space-y-3 p-5">
      {/* Table Header & Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/50">
        <div>
          <h3 className="font-semibold text-sm text-foreground">รายการการเงินล่าสุด</h3>
          <p className="text-xs text-muted-foreground">บันทึกรับ-จ่าย และสถานะการอนุมัติ</p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
          {(["all", "income", "expense", "pending"] as const).map((tab) => {
            const labels = {
              all: "ทั้งหมด",
              income: "รายรับ",
              expense: "รายจ่าย",
              pending: "รออนุมัติ",
            };
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
                  filter === tab
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rows Table */}
      <div className="space-y-1.5 pt-1">
        {filtered.map((tx, index) => {
          const isIncome = tx.kind === "income";
          return (
            <div
              key={tx.id}
              onClick={() => onSelectTx?.(tx)}
              className={cn(
                "flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group border border-transparent hover:border-border/60",
                "animate-fade-up",
              )}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              {/* Kind Icon + Details */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                    isIncome ? "bg-income-muted text-income" : "bg-expense-muted text-expense",
                  )}
                >
                  {isIncome ? (
                    <ArrowDownLeft className="h-4 w-4" strokeWidth={2} />
                  ) : (
                    <ArrowUpLeft className="h-4 w-4" strokeWidth={2} />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                    {tx.description || tx.categoryName || (isIncome ? "รายรับ" : "รายจ่าย")}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {fmtDate(tx.date)}
                    {tx.vendor && ` · ${tx.vendor}`}
                    {tx.createdBy && ` · โดย ${tx.createdBy}`}
                  </p>
                </div>
              </div>

              {/* Status & Amount */}
              <div className="shrink-0 text-right flex items-center gap-3">
                <StatusBadge status={tx.status} variant="dot" />
                <div>
                  <p
                    className={cn(
                      "num-display text-sm font-bold",
                      isIncome ? "amount-income" : "amount-expense",
                    )}
                  >
                    {isIncome ? "+" : "-"}
                    <MoneyText value={tx.amount} />
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
