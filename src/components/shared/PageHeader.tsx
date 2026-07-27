import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 md:mb-8 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-border pb-5">
        <div className="min-w-0">
          {kicker && (
            <p className="kicker mb-2 flex items-center gap-2">
              <span aria-hidden className="inline-block h-px w-6 bg-primary" />
              {kicker}
            </p>
          )}
          <h1 className="font-display text-2xl md:text-[28px] font-semibold leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
