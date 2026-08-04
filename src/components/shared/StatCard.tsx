import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "primary" | "secondary" | "accent" | "success" | "danger" | "warning";
  trend?: number;
  /** decimal places when `value` is a number (animated ticker) */
  decimals?: number;
}

const VALUE_TONE: Record<NonNullable<Props["tone"]>, string> = {
  primary: "text-primary",
  secondary: "text-foreground",
  accent: "text-foreground",
  success: "text-success",
  danger: "text-destructive",
  warning: "text-warning",
};

const ICON_TONE: Record<NonNullable<Props["tone"]>, string> = {
  primary: "text-primary",
  secondary: "text-muted-foreground",
  accent: "text-muted-foreground",
  success: "text-success",
  danger: "text-destructive",
  warning: "text-warning",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "secondary",
  trend,
  decimals = 0,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-card border border-border bg-card p-5 transition-colors duration-150 hover:border-border/80"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <Icon
            className={cn("h-4 w-4 shrink-0", ICON_TONE[tone])}
            strokeWidth={1.75}
            aria-hidden
          />
        )}
      </div>

      <p
        className={cn(
          "num-display mt-2 text-[28px] md:text-[30px] font-semibold leading-none tracking-tight",
          VALUE_TONE[tone],
        )}
      >
        {typeof value === "number" ? (
          <NumberTicker value={value} decimalPlaces={decimals} />
        ) : (
          value
        )}
      </p>

      {(hint || typeof trend === "number") && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          {typeof trend === "number" && (
            <span
              className={cn(
                "num-display inline-flex items-center gap-1 font-medium",
                trend >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {trend >= 0 ? (
                <TrendingUp className="h-3 w-3" strokeWidth={2} />
              ) : (
                <TrendingDown className="h-3 w-3" strokeWidth={2} />
              )}
              {trend >= 0 ? "+" : ""}
              {trend.toFixed(1)}%
            </span>
          )}
          {hint && <span className="truncate text-muted-foreground/80">{hint}</span>}
        </div>
      )}
    </motion.div>
  );
}