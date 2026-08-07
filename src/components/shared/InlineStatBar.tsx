/**
 * InlineStatBar.tsx
 *
 * Compact single-row metric strip for ledger-style pages (Income, Expense,
 * Offering, Funds, Budget) — where a data table is the primary surface and
 * summary numbers are secondary context, not a competing hero.
 */

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { thb } from "@/lib/format";

export interface InlineStatItem {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: "primary" | "success" | "danger" | "warning" | "default";
}

const TONE_CLASS: Record<NonNullable<InlineStatItem["tone"]>, string> = {
  primary: "text-primary",
  success: "text-success",
  danger: "text-destructive",
  warning: "text-warning",
  default: "text-foreground",
};

export function InlineStatBar({ items }: { items: InlineStatItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-card border border-border bg-card px-5 py-3.5">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={cn(
              "flex items-center gap-2",
              i > 0 && "border-l border-border/60 pl-6 first:border-0 first:pl-0",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />}
            <span className="text-xs text-muted-foreground">{item.label}</span>
            <span
              className={cn(
                "num-display text-sm font-semibold",
                TONE_CLASS[item.tone ?? "default"],
              )}
            >
              {typeof item.value === "number" ? thb(item.value) : item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
