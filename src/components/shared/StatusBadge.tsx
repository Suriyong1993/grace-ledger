import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type TxStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: TxStatus }) {
  const map: Record<TxStatus, string> = {
    draft: "bg-muted text-muted-foreground",
    pending: "bg-warning/20 text-warning-foreground border-warning/40",
    approved: "bg-success/15 text-success border-success/30",
    rejected: "bg-destructive/15 text-destructive border-destructive/30",
    voided: "bg-muted/50 text-muted-foreground/60 line-through",
  };
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full px-3 py-0.5 text-xs font-medium", map[status])}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}
