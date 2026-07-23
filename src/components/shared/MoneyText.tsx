import { thb } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MoneyText({
  value,
  tone = "default",
  className,
}: {
  value: number;
  tone?: "default" | "income" | "expense";
  className?: string;
}) {
  const color =
    tone === "income"
      ? "text-success"
      : tone === "expense"
        ? "text-destructive"
        : "text-foreground";
  const prefix = tone === "income" ? "+" : tone === "expense" ? "−" : "";
  return (
    <span className={cn("tabular-nums font-mono font-semibold tracking-tight", color, className)}>
      {prefix}
      {thb(Math.abs(value))}
    </span>
  );
}
