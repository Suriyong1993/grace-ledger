import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";
import { useGSAPAnimation } from "@/hooks/useGSAPAnimation";
import { gsap } from "@/lib/gsap";

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
  primary: "bg-primary/10 text-primary border-primary/20",
  secondary: "bg-muted text-muted-foreground border-border/40",
  accent: "bg-accent text-accent-foreground border-accent-foreground/10",
  success: "bg-success/10 text-success border-success/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
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
  const cardRef = useGSAPAnimation<HTMLDivElement>((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: 15, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "power2.out" },
    );
  });

  return (
    <div
      ref={cardRef}
      className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-5 shadow-2xs transition-all duration-200 hover:border-border hover:shadow-xs"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="kicker font-medium tracking-wider text-muted-foreground/80">{label}</p>
        {Icon && (
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-transform duration-200 group-hover:scale-105",
              ICON_BG[tone],
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
          </div>
        )}
      </div>
      <p
        className={cn(
          "num-display mt-3 text-2xl font-bold tracking-tight md:text-[28px]",
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
                "num-display inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors",
                trend >= 0
                  ? "bg-success/10 text-success border border-success/20"
                  : "bg-destructive/10 text-destructive border border-destructive/20",
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
          {hint && <span className="truncate font-normal text-muted-foreground/90">{hint}</span>}
        </div>
      )}
    </div>
  );
}
