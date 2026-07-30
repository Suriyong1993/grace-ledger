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
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-5">
        <div className="min-w-0">
          {kicker && (
            <p className="kicker mb-3 flex items-center gap-2.5">
              <span
                aria-hidden
                className="inline-block h-px w-8 rounded-full bg-gradient-to-r from-primary to-primary/20"
              />
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
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {/* Editorial gradient rule — gold → transparent */}
      <div className="h-px w-full bg-gradient-to-r from-primary/40 via-border/80 to-transparent" />
    </header>
  );
}
