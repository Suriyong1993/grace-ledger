/**
 * FS-004 — Record Income Wizard, Step 3: Destination
 *
 * Sprint 2 HTML prototype (UI validation only — see
 * .claude/sprint-2-instructions.md). Mock/local state, no backend calls.
 *
 * Route note: same reasoning as step-1/step-2 — lives at
 * /record-income/step-3, not /income/step-3, to avoid nesting under the
 * existing (Outlet-less) `_app.income.tsx` production page.
 */

import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { WizardStepIndicator } from "@/components/shared/WizardStepIndicator";
import { MoneyText } from "@/components/shared/MoneyText";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  INCOME_CATEGORY_OPTIONS,
  INCOME_DESTINATION_OPTIONS,
  WIZARD_STEP_LABELS,
  isIncomeCategory,
  type IncomeCategory,
  type IncomeDestination,
} from "@/lib/recordIncomeWizard";

interface Step3Search {
  category?: IncomeCategory;
  amount?: number;
}

export const Route = createFileRoute("/_app/record-income/step-3")({
  head: () => ({ meta: [{ title: "เลือกปลายทางเงินเข้า — Grace Ledger" }] }),
  validateSearch: (search: Record<string, unknown>): Step3Search => {
    const amount = Number(search.amount);
    return {
      category: isIncomeCategory(search.category) ? search.category : undefined,
      amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
    };
  },
  component: RecordIncomeStep3,
});

function RecordIncomeStep3() {
  const navigate = useNavigate();
  const { category, amount } = Route.useSearch();
  const [selected, setSelected] = useState<IncomeDestination | null>(null);

  // Step 3 requires both a category (from step 1) and a valid amount (from
  // step 2) — bounce back to whichever is missing (e.g. a stale/shared URL).
  useEffect(() => {
    if (!category) {
      navigate({ to: "/record-income/step-1" });
    } else if (!amount) {
      navigate({ to: "/record-income/step-2", search: { category } });
    }
  }, [category, amount, navigate]);

  if (!category || !amount) return null;

  const categoryOption = INCOME_CATEGORY_OPTIONS.find((opt) => opt.value === category);

  const handleNext = () => {
    if (!selected) return;
    navigate({
      to: "/record-income/step-4",
      search: { category, amount, destination: selected },
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader kicker="บันทึกรับเงิน" title="เลือกปลายทางเงินเข้า" />

      <WizardStepIndicator currentStep={3} labels={WIZARD_STEP_LABELS} />

      {/* Category + amount context */}
      <div className="flex items-center justify-between rounded-card border border-border bg-card px-5 py-4">
        {categoryOption && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <categoryOption.icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            <span className="font-medium text-foreground">{categoryOption.label}</span>
          </div>
        )}
        <MoneyText value={amount} tone="income" className="text-xl" />
      </div>

      {/* Destination radio group */}
      <div role="radiogroup" aria-label="ปลายทางเงินเข้า" className="flex flex-col gap-3">
        {INCOME_DESTINATION_OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(opt.value)}
              className={cn(
                "active-press flex items-center gap-4 rounded-card border bg-card p-4 text-left transition-colors",
                isSelected
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                  isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <opt.icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
              </span>
              <span className="flex-1 font-display text-base font-semibold leading-tight text-foreground">
                {opt.label}
              </span>
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                )}
                aria-hidden
              >
                {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between border-t border-border pt-5">
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/record-income/step-2", search: { category, amount } })}
        >
          ย้อนกลับ
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate({ to: "/staff" })}>
            ยกเลิก
          </Button>
          <Button onClick={handleNext} disabled={!selected}>
            ถัดไป
          </Button>
        </div>
      </div>
    </div>
  );
}
