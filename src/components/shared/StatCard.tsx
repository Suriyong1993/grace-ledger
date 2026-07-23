import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
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
  primary: "from-primary/15 to-primary/5 text-primary",
  secondary: "from-secondary/25 to-secondary/5 text-foreground",
  accent: "from-accent/25 to-accent/5 text-foreground",
  success: "from-success/15 to-success/5 text-success",
  danger: "from-destructive/15 to-destructive/5 text-destructive",
};

export function StatCard({ label, value, hint, icon: Icon, tone = "primary", trend }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.008 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/60 bg-card/95 p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.03)] backdrop-blur-md transition-shadow duration-200 hover:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.08)]",
      )}
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none transition-opacity duration-300 hover:opacity-80",
          TONES[tone],
        )}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs md:text-sm text-muted-foreground/90 font-medium tracking-wide">{label}</p>
            <p className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums">
              {value}
            </p>
          </div>
          <div
            className={cn(
              "grid h-10 w-10 md:h-11 md:w-11 shrink-0 place-items-center rounded-2xl bg-background/80 backdrop-blur-sm border border-border/40 shadow-2xs transition-transform duration-200 group-hover:scale-105",
              TONES[tone].split(" ").pop(),
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {(hint || typeof trend === "number") && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground/80 font-medium">
            {typeof trend === "number" && (
              <span
                className={cn("font-semibold font-mono", trend >= 0 ? "text-success" : "text-destructive")}
              >
                {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
              </span>
            )}
            {hint && <span className="truncate">{hint}</span>}
          </div>
        )}
      </div>
    </motion.div>
  );
}
