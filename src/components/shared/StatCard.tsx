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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-card p-5 shadow-elegant",
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-70 pointer-events-none", TONES[tone])} />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{label}</p>
            <p className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-foreground">{value}</p>
          </div>
          <div className={cn("grid h-11 w-11 place-items-center rounded-2xl bg-background/70 shadow-sm", TONES[tone].split(" ").pop())}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {(hint || typeof trend === "number") && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            {typeof trend === "number" && (
              <span className={cn("font-semibold", trend >= 0 ? "text-success" : "text-destructive")}>
                {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
              </span>
            )}
            {hint && <span>{hint}</span>}
          </div>
        )}
      </div>
    </motion.div>
  );
}