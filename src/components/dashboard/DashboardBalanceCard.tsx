/**
 * DashboardBalanceCard.tsx
 *
 * Finexy-style hero balance card for the left column of the dashboard.
 * - Total cash balance hero metric
 * - Currency label + THB pill
 * - Transfer (→ /income) and Request (→ /expense) action buttons
 * - Wallet strip: shows top 4 funds with balance, limit hint, and active status
 */

import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, TrendingUp } from "lucide-react";
import { MoneyText } from "@/components/shared/MoneyText";
import { cn } from "@/lib/utils";
import type { Fund } from "@/lib/types";

interface DashboardBalanceCardProps {
  totalBalance: number;
  funds?: Fund[];
  incomeMonth?: number;
  prevMonthBalance?: number;
}

const FUND_FLAGS = ["🇹🇭", "🏦", "📚", "🏛️"];

export function DashboardBalanceCard({
  totalBalance,
  funds = [],
  incomeMonth = 0,
  prevMonthBalance,
}: DashboardBalanceCardProps) {
  const growthPct =
    prevMonthBalance && prevMonthBalance > 0
      ? Math.round(((totalBalance - prevMonthBalance) / prevMonthBalance) * 100)
      : null;

  const topFunds = funds.slice(0, 4);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold text-muted-foreground">ยอดคงเหลือรวม</span>
        <div className="flex items-center gap-1.5 rounded-full bg-muted/80 px-2.5 py-1 text-[11px] font-semibold text-foreground border border-border/50">
          🇹🇭 THB
        </div>
      </div>

      {/* Hero balance */}
      <div>
        <p className="num-display text-3xl font-extrabold tracking-tight text-foreground">
          <MoneyText value={totalBalance} />
        </p>
        {growthPct !== null ? (
          <div className="mt-1 flex items-center gap-1 text-xs text-[#22C55E]">
            <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span className="font-semibold">{growthPct > 0 ? `+${growthPct}` : growthPct}%</span>
            <span className="text-muted-foreground">จากเดือนก่อน</span>
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <span>รายรับเดือนนี้</span>
            <span className="font-semibold text-[#22C55E] num-display">
              +<MoneyText value={incomeMonth} />
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Link
          to="/income"
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5",
            "bg-foreground text-background text-xs font-semibold shadow-xs",
            "transition-opacity hover:opacity-90 active:scale-[0.98]",
          )}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          บันทึกรายรับ
        </Link>
        <Link
          to="/expense"
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5",
            "border border-border/80 bg-muted/40 text-foreground text-xs font-semibold",
            "transition-colors hover:bg-muted active:scale-[0.98]",
          )}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          บันทึกรายจ่าย
        </Link>
      </div>

      {/* Wallet strip */}
      <div className="border-t border-border/50 pt-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            กองทุนคริสตจักร
          </span>
          <Link
            to="/funds"
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            ทั้งหมด ({funds.length})
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          {topFunds.map((fund, i) => {
            const balance = fund.currentBalance ?? fund.openingBalance ?? 0;
            return (
              <div
                key={fund.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-2.5 transition-colors hover:border-[#E8450A]/30 hover:bg-muted/40"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{FUND_FLAGS[i % FUND_FLAGS.length]}</span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{fund.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {fund.fundCode || `F-0${i + 1}`}
                    </p>
                  </div>
                </div>
                <p className="num-display text-xs font-bold text-foreground">
                  <MoneyText value={balance} />
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
