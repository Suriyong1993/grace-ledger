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
          {kicker && <p className="mb-1.5 text-[13px] font-medium text-muted-foreground">{kicker}</p>}
          <h1 className="font-display text-[26px] md:text-[30px] font-semibold leading-[1.15] tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}