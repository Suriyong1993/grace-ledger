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
      { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "power2.out" }
    );
  });

  return (
    <div ref={cardRef} className="card-ledger px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="kicker">{label}</p>
        {Icon && (
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />
        )}
      </div>
      <p
        className={cn(
          "num-display mt-2 text-2xl md:text-[26px] font-semibold tracking-tight",
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
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          {typeof trend === "number" && (
            <span
              className={cn(
                "num-display inline-flex items-center gap-0.5 font-medium",
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
          {hint && <span className="truncate">{hint}</span>}
        </div>
      )}
    </div>
  );
}
