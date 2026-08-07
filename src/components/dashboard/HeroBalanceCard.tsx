/**
 * HeroBalanceCard.tsx
 *
 * Dashboard's single hero metric — total cash balance across all funds.
 * Deliberately the only "lifted" surface on the page (surface-elevated,
 * Linear-style depth ladder) so the number that matters most reads first.
 */

import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { MoneyText } from "@/components/shared/MoneyText";
import { thb } from "@/lib/format";

interface HeroBalanceCardProps {
  totalBalance: number;
  fundCount: number;
  incomeMonth: number;
  expenseMonth: number;
}

export function HeroBalanceCard({
  totalBalance,
  fundCount,
  incomeMonth,
  expenseMonth,
}: HeroBalanceCardProps) {
  return (
    <div className="surface-elevated flex h-full flex-col justify-between rounded-card p-6 md:p-8">
      <div>
        <p className="kicker text-muted-foreground">ยอดคงเหลือรวม</p>
        <p className="num-display font-display mt-3 text-[40px] font-bold leading-none tracking-tight text-foreground md:text-[52px]">
          {thb(totalBalance)}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">{fundCount} กองทุน</p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/50 pt-4 text-xs">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <ArrowDownCircle className="h-3.5 w-3.5 text-income" strokeWidth={1.75} />
          รับเดือนนี้
          <MoneyText value={incomeMonth} tone="income" className="text-xs" />
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <ArrowUpCircle className="h-3.5 w-3.5 text-expense" strokeWidth={1.75} />
          จ่ายเดือนนี้
          <MoneyText value={expenseMonth} tone="expense" className="text-xs" />
        </span>
      </div>
    </div>
  );
}
