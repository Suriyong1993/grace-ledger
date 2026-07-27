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
    <div className="animate-fade-up border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <Icon className="mx-auto h-7 w-7 text-muted-foreground/40" strokeWidth={1.25} />
      <h3 className="font-display mt-4 text-lg font-medium tracking-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
