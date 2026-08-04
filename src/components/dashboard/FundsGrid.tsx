/**
 * FundsGrid.tsx
 *
 * Church fund cards with distinct visual identity per fund.
 * Each card shows: icon (color-coded by index), fund name, description,
 * balance hero metric, and a subtle progress bar (balance vs opening).
 */

import { Landmark, Home, Users, BookOpen, MoreVertical, TrendingUp } from "lucide-react";
import { MoneyText } from "@/components/shared/MoneyText";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Fund } from "@/lib/types";

interface FundsGridProps {
  funds?: Fund[];
}

/* Icon per fund index — distinct identity, restrained color */
const FUND_ICONS = [Landmark, Home, Users, BookOpen] as const;
const ICON_COLORS = ["text-primary", "text-income", "text-offering", "text-muted-foreground"] as const;

const DEFAULT_FUNDS: Fund[] = [
  {
    id: "f-general",
    name: "กองทุนทั่วไป",
    openingBalance: 500000,
    currentBalance: 780000,
    fundCode: "F-01",
    createdAt: "2024-01-01",
    description: "งบดำเนินงานคริสตจักรประจำวัน",
  },
  {
    id: "f-building",
    name: "กองทุนอาคาร & พันธกิจ",
    openingBalance: 300000,
    currentBalance: 345600,
    fundCode: "F-02",
    createdAt: "2024-01-01",
    description: "ซ่อมบำรุงและต่อเติมอาคาร",
  },
  {
    id: "f-youth",
    name: "กองทุนเยาวชน & การศึกษา",
    openingBalance: 80000,
    currentBalance: 120000,
    fundCode: "F-03",
    createdAt: "2024-01-01",
    description: "ทุนการศึกษาและค่ายเยาวชน",
  },
];

export function FundsGrid({ funds = DEFAULT_FUNDS }: FundsGridProps) {
  const displayFunds = funds.length > 0 ? funds : DEFAULT_FUNDS;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">กองทุน & บัญชีแยกประเภท</h3>
          <p className="text-xs text-muted-foreground">สรุปสถานะเงินทุนรายหมวด</p>
        </div>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs font-medium"
          aria-label="ดูกองทุนทั้งหมด"
        >
          ดูทั้งหมด ({displayFunds.length})
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {displayFunds.map((fund, i) => {
          const balance = fund.currentBalance ?? fund.openingBalance;
          const opening = fund.openingBalance ?? 0;
          const growthRatio = opening > 0 ? Math.min(balance / opening, 2) : 1;
          const progressPercent = Math.round(Math.min(growthRatio * 50, 100));
          const growthDisplay = opening > 0 ? Math.round((growthRatio - 1) * 100) : 0;

          const Icon = FUND_ICONS[i % FUND_ICONS.length];
          const iconColor = ICON_COLORS[i % ICON_COLORS.length];

          return (
            <div
              key={fund.id}
              className={cn(
                "card-ledger flex cursor-pointer flex-col gap-3 p-4",
                "transition-colors duration-150 hover:border-border/80",
              )}
            >
              {/* Top row: icon + menu */}
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border/60",
                    iconColor,
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground/50 hover:text-foreground"
                  aria-label="เมนูกองทุน"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Fund info */}
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">{fund.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {fund.description || fund.fundCode || "กองทุนดำเนินงาน"}
                </p>
              </div>

              {/* Balance + progress */}
              <div className="mt-auto space-y-2">
                <div className="flex items-center justify-between">
                  <span className="num-display text-sm font-bold text-foreground">
                    <MoneyText value={balance} />
                  </span>
                  {growthDisplay >= 0 ? (
                    <div className="flex items-center gap-0.5 text-income">
                      <TrendingUp className="h-3 w-3" strokeWidth={2} />
                      <span className="text-[10px] font-semibold">+{growthDisplay}%</span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-semibold text-expense">{growthDisplay}%</span>
                  )}
                </div>

                {/* Subtle progress bar */}
                <div className="h-1 w-full overflow-hidden rounded-full bg-border/60">
                  <div
                    className="h-full rounded-full bg-primary/70 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  เริ่มต้น{" "}
                  <span className="num-display font-medium">
                    <MoneyText value={opening} />
                  </span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
