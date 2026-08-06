/**
 * FS-002 — Record Income Wizard, Step 1: Category
 *
 * Sprint 2 HTML prototype (UI validation only — see
 * .claude/sprint-2-instructions.md). Mock/local state, no backend calls.
 *
 * Route note: intentionally placed at /record-income/step-1, not
 * /income/step-1. TanStack Router's file-based codegen nests any
 * `_app.income.*` file under the existing `_app.income.tsx` (the
 * production Income list page), which renders no `<Outlet />` — a child
 * route there would silently never appear. `/record-income/...` avoids
 * that collision and gives FS-002–FS-005 a clean, un-nested path.
 */

import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { WizardStepIndicator } from "@/components/shared/WizardStepIndicator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  INCOME_CATEGORY_OPTIONS,
  WIZARD_STEP_LABELS,
  isIncomeCategory,
  type IncomeCategory,
} from "@/lib/recordIncomeWizard";

export const Route = createFileRoute("/_app/record-income/step-1")({
  head: () => ({ meta: [{ title: "เลือกประเภทเงินรับ — Grace Ledger" }] }),
  validateSearch: (search: Record<string, unknown>): { category?: IncomeCategory } => ({
    category: isIncomeCategory(search.category) ? search.category : undefined,
  }),
  component: RecordIncomeStep1,
});

function RecordIncomeStep1() {
  const navigate = useNavigate();
  const { category } = Route.useSearch();
  const [selected, setSelected] = useState<IncomeCategory | null>(category ?? null);

  const handleNext = () => {
    if (!selected) return;
    navigate({ to: "/record-income/step-2", search: { category: selected } });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader kicker="บันทึกรับเงิน" title="เลือกประเภทเงินรับ" />

      <WizardStepIndicator currentStep={1} labels={WIZARD_STEP_LABELS} />

      {/* Category grid selection */}
      <div className="grid grid-cols-2 gap-4">
        {INCOME_CATEGORY_OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(opt.value)}
              className={cn(
                "active-press relative flex flex-col items-start gap-4 rounded-card border bg-card p-5 text-left transition-colors",
                isSelected
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-muted-foreground/30",
              )}
            >
              {isSelected && (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
              <span
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-lg",
                  isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <opt.icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
              </span>
              <span className="font-display text-base font-semibold leading-tight text-foreground">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between border-t border-border pt-5">
        <Button variant="outline" onClick={() => navigate({ to: "/staff" })}>
          ยกเลิก
        </Button>
        <Button onClick={handleNext} disabled={!selected}>
          ถัดไป
        </Button>
      </div>
    </div>
  );
}
