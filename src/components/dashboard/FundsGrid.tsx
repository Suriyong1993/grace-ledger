/**
 * FundsGrid.tsx
 *
 * Adapted from the "Folders" grid in the 3-column reference design.
 * Displays interactive cards for Church Funds (กองทุนต่างๆ) with balance,
 * transaction counts, and visual status indicators.
 */

import { Folder, ArrowUpRight, MoreVertical } from "lucide-react";
import { MoneyText } from "@/components/shared/MoneyText";
import { cn } from "@/lib/utils";
import type { Fund } from "@/lib/types";

interface FundsGridProps {
  funds?: Fund[];
}

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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm text-foreground">กองทุน & บัญชีแยกประเภท</h3>
          <p className="text-xs text-muted-foreground">สรุปสถานะเงินทุนรายหมวด</p>
        </div>
        <span className="text-xs text-primary font-medium cursor-pointer hover:underline">
          ดูทั้งหมด ({displayFunds.length})
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {displayFunds.map((fund, i) => {
          const balance = fund.currentBalance ?? fund.openingBalance;
          return (
            <div
              key={fund.id}
              className={cn(
                "card-ledger p-4 flex flex-col justify-between space-y-3 hover:border-primary/30 transition-all cursor-pointer group",
                "animate-fade-up",
              )}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Folder className="h-4 w-4" strokeWidth={2} />
                </div>
                <button
                  className="text-muted-foreground/60 hover:text-foreground p-1 rounded transition-colors"
                  aria-label="เมนูกองทุน"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>

              <div>
                <p className="font-semibold text-xs text-foreground truncate">{fund.name}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {fund.description || fund.fundCode || "กองทุนดำเนินงาน"}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                <span className="num-display font-bold text-foreground">
                  <MoneyText value={balance} />
                </span>
                <div className="flex items-center text-[10px] text-income font-medium">
                  <ArrowUpRight className="h-3 w-3" />
                  ปกติ
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
