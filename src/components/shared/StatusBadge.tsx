import { STATUS_LABEL, type TxStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Editorial status indicator — a small colored dot + ink label.
 * Color lives only in the dot; text stays readable on ivory.
 */
const MAP: Record<TxStatus, { dot: string; muted?: boolean; strike?: boolean }> = {
  draft: { dot: "bg-muted-foreground/50", muted: true },
  pending: { dot: "bg-warning" },
  approved: { dot: "bg-success" },
  rejected: { dot: "bg-destructive" },
  voided: { dot: "bg-muted-foreground/40", muted: true, strike: true },
};

export function StatusBadge({ status, className }: { status: TxStatus; className?: string }) {
  const s = MAP[status] ?? MAP.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium",
        s.muted ? "text-muted-foreground" : "text-foreground",
        s.strike && "line-through",
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.dot)} />
      {STATUS_LABEL[status]}
    </span>
  );
}
