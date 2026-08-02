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
  tone?: "primary" | "secondary" | "accent" | "success" | "danger";
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
};

const ICON_BG: Record<NonNullable<Props["tone"]>, string> = {
  primary: "bg-primary/8 text-primary",
  secondary: "bg-muted/60 text-muted-foreground",
  accent: "bg-accent text-accent-foreground",
  success: "bg-success/8 text-success",
  danger: "bg-destructive/8 text-destructive",
};

/** Left accent strip per tone — financial terminal style */
const ACCENT_BAR: Record<NonNullable<Props["tone"]>, string> = {
  primary: "bg-primary",
  secondary: "bg-border",
  accent: "bg-muted-foreground/30",
  success: "bg-success",
  danger: "bg-destructive",
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
      initial={{ opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className="group relative flex overflow-hidden rounded-card border border-border/60 bg-card shadow-2xs transition-all duration-200 hover:border-border hover:shadow-xs"
    >
      {/* Left accent strip — financial terminal style */}
      <div
        className={cn(
          "w-0.5 shrink-0 transition-[width] duration-200 group-hover:w-1",
          ACCENT_BAR[tone],
        )}
      />

      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="kicker text-muted-foreground/70">{label}</p>
          {Icon && (
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110",
                ICON_BG[tone],
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            </div>
          )}
        </div>

        <p
          className={cn(
            "num-display font-display mt-3 text-[28px] md:text-[32px] font-bold leading-none tracking-tight",
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
          <div className="mt-3.5 flex items-center gap-2 border-t border-border/40 pt-3 text-xs text-muted-foreground">
            {typeof trend === "number" && (
              <span
                className={cn(
                  "num-display inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                  trend >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
                )}
              >
                {trend >= 0 ? (
                  <TrendingUp className="h-3 w-3" strokeWidth={2.5} />
                ) : (
                  <TrendingDown className="h-3 w-3" strokeWidth={2.5} />
                )}
                {trend >= 0 ? "+" : ""}
                {trend.toFixed(1)}%
              </span>
            )}
            {hint && <span className="truncate text-muted-foreground/80">{hint}</span>}
          </div>
        )}
      </div>
    </motion.div>
  );
}
