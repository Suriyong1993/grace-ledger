import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { TrendingDown, TrendingUp, Info } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { thb } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "primary" | "secondary" | "accent" | "success" | "danger" | "warning";
  trend?: number;
  decimals?: number;
  /** Optional info tooltip shown next to the label (e.g. explains a calculated total) */
  tooltip?: ReactNode;
}

const VALUE_TONE: Record<NonNullable<Props["tone"]>, string> = {
  primary: "text-primary",
  secondary: "text-foreground",
  accent: "text-foreground",
  success: "text-success",
  danger: "text-destructive",
  warning: "text-warning",
};

const ICON_BG: Record<NonNullable<Props["tone"]>, string> = {
  primary: "bg-accent/20 text-primary",
  secondary: "bg-secondary text-muted-foreground",
  accent: "bg-accent text-accent-foreground",
  success: "bg-success/10 text-success",
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-warning/10 text-warning",
};

/** Left accent strip per tone — financial terminal style */
const ACCENT_BAR: Record<NonNullable<Props["tone"]>, string> = {
  primary: "bg-primary",
  secondary: "bg-border",
  accent: "bg-muted-foreground/30",
  success: "bg-success",
  danger: "bg-destructive",
  warning: "bg-warning",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "secondary",
  trend,
  decimals = 0,
  tooltip,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="group relative flex overflow-hidden rounded-card border border-border bg-card shadow-card transition-all duration-150 hover:border-primary/50 hover:shadow-elevated"
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
          {tooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="kicker flex items-center gap-1.5 text-muted-foreground">
                  {label}
                  <Info className="h-3 w-3 text-muted-foreground/60" />
                </p>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] normal-case">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          ) : (
            <p className="kicker text-muted-foreground">{label}</p>
          )}
          {Icon && (
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
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
          {typeof value === "number" ? thb(value) : value}
        </p>

        {(hint || typeof trend === "number") && (
          <div className="mt-3.5 flex items-center gap-2 border-t border-border/40 pt-3 text-xs text-muted-foreground">
            {typeof trend === "number" && (
              <span
                className={cn(
                  "num-display inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold",
                  trend >= 0
                    ? "border-success text-success bg-transparent"
                    : "border-destructive text-destructive bg-transparent",
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
