import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="animate-fade-up flex flex-col items-center gap-4 rounded-sm border border-dashed border-border/60 bg-card/30 px-8 py-16 text-center">
      {/* Icon with layered ring treatment */}
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="absolute inset-0 rounded-xl border border-border/40 bg-muted/40" />
        <div className="absolute inset-1.5 rounded-lg border border-border/20 bg-muted/20" />
        <Icon className="relative h-5 w-5 text-muted-foreground/40" strokeWidth={1.25} />
      </div>

      <div className="max-w-xs">
        <h3 className="font-display text-[15px] font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {description && (
          <p className="mx-auto mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {action && <div className="mt-1 flex justify-center">{action}</div>}
    </div>
  );
}
