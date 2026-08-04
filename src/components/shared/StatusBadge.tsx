import { STATUS_LABEL, type TxStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle, FileEdit, Ban } from "lucide-react";

/*
 * StatusBadge — typed wrapper over the canonical Badge for transaction
 * status. Renders a Badge (variant="outline") with semantic coloring from
 * styles.css (badge-pending, badge-approved, etc.) layered on top — same
 * DOM/CSS system as every other Badge in the app, not a parallel component.
 */

interface StatusConfig {
  pill: string; // Tailwind utility class for the pill background+border+text
  icon: React.ElementType;
  iconClass: string;
  muted?: boolean;
  strike?: boolean;
}

const MAP: Record<TxStatus, StatusConfig> = {
  draft: {
    pill: "bg-muted text-muted-foreground border-transparent",
    icon: FileEdit,
    iconClass: "text-muted-foreground",
    muted: true,
  },
  pending: {
    pill: "bg-muted text-pending border-transparent",
    icon: Clock,
    iconClass: "text-pending",
  },
  approved: {
    pill: "bg-muted text-approved border-transparent",
    icon: CheckCircle2,
    iconClass: "text-approved",
  },
  rejected: {
    pill: "bg-muted text-rejected border-transparent",
    icon: XCircle,
    iconClass: "text-rejected",
    muted: true,
  },
  voided: {
    pill: "bg-muted text-muted-foreground border-transparent",
    icon: Ban,
    iconClass: "text-muted-foreground",
    muted: true,
    strike: true,
  },
};

interface StatusBadgeProps {
  status: TxStatus;
  /** Show icon alongside text (default: true) */
  showIcon?: boolean;
  /** 'pill' = full badge, 'dot' = just a colored dot (legacy) */
  variant?: "pill" | "dot";
  className?: string;
}

export function StatusBadge({
  status,
  showIcon = true,
  variant = "pill",
  className,
}: StatusBadgeProps) {
  const s = MAP[status] ?? MAP.draft;
  const Icon = s.icon;

  /* Dot variant — minimal, for table rows */
  if (variant === "dot") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium",
          s.muted ? "text-muted-foreground" : "text-foreground",
          s.strike && "line-through",
          className,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            status === "pending" && "bg-pending",
            status === "approved" && "bg-approved",
            status === "rejected" && "bg-rejected",
            (status === "draft" || status === "voided") && "bg-muted-foreground/50",
          )}
        />
        {STATUS_LABEL[status]}
      </span>
    );
  }

  /* Pill variant — canonical Badge, semantic status coloring layered on */
  return (
    <Badge
      variant="outline"
      className={cn("whitespace-nowrap", s.strike && "line-through opacity-70", s.pill, className)}
    >
      {showIcon && (
        <Icon className={cn("h-3 w-3 shrink-0", s.iconClass)} strokeWidth={2.5} aria-hidden />
      )}
      {STATUS_LABEL[status]}
    </Badge>
  );
}
