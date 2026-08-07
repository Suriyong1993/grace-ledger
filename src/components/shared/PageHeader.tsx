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
    <header className="mb-6 md:mb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-5">
        <div className="min-w-0">
          {kicker && (
            <p className="kicker mb-3 flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              {kicker}
            </p>
          )}
          <h1 className="font-display text-[26px] md:text-[32px] font-bold leading-[1.1] tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
            {actions}
          </div>
        )}
      </div>
      <div className="h-px w-full bg-border" />
    </header>
  );
}
