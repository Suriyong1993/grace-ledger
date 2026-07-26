import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "primary" | "secondary" | "accent" | "success" | "danger";
  trend?: number;
}

const TONES: Record<NonNullable<Props["tone"]>, string> = {
  primary: "text-primary border-l-primary",
  secondary: "text-foreground border-l-foreground/20",
  accent: "text-foreground border-l-accent-foreground/20",
  success: "text-success border-l-success",
  danger: "text-destructive border-l-destructive",
};

export function StatCard({ label, value, hint, icon: Icon, tone = "primary", trend }: Props) {
  return (
    <div
      className={cn("relative border border-border border-l-2 bg-card px-4 py-3.5", TONES[tone])}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </p>
          <p className="mt-1.5 text-xl md:text-2xl font-semibold tracking-tight text-foreground font-mono tabular-nums">
            {value}
          </p>
        </div>
        <Icon className={cn("h-4 w-4 shrink-0 mt-0.5 opacity-60", TONES[tone].split(" ")[0])} />
      </div>
      {(hint || typeof trend === "number") && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          {typeof trend === "number" && (
            <span
              className={cn(
                "font-medium font-mono",
                trend >= 0 ? "text-success" : "text-destructive",
              )}
            >
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
