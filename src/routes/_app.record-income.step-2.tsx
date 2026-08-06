/**
 * FS-003 — Record Income Wizard, Step 2: Amount
 *
 * Sprint 2 HTML prototype (UI validation only — see
 * .claude/sprint-2-instructions.md). Mock/local state, no backend calls.
 *
 * Route note: same reasoning as step-1 — lives at /record-income/step-2,
 * not /income/step-2, to avoid nesting under the existing (Outlet-less)
 * `_app.income.tsx` production page. See step-1's file header for detail.
 */

import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
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

interface Step2Search {
  category?: IncomeCategory;
  amount?: number;
}

export const Route = createFileRoute("/_app/record-income/step-2")({
  head: () => ({ meta: [{ title: "ระบุจำนวนเงิน — Grace Ledger" }] }),
  validateSearch: (search: Record<string, unknown>): Step2Search => {
    const amount = Number(search.amount);
    return {
      category: isIncomeCategory(search.category) ? search.category : undefined,
      amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
    };
  },
  component: RecordIncomeStep2,
});

/** Only digits and a single decimal point, mirroring how THB amounts are entered. */
function sanitizeAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
}

function RecordIncomeStep2() {
  const navigate = useNavigate();
  const { category, amount } = Route.useSearch();
  const [amountInput, setAmountInput] = useState(amount ? String(amount) : "");

  // Step 2 requires a category from step 1 — bounce back if someone lands
  // here directly (e.g. a stale/shared URL) without one.
  useEffect(() => {
    if (!category) {
      navigate({ to: "/record-income/step-1" });
    }
  }, [category, navigate]);

  if (!category) return null;

  const categoryOption = INCOME_CATEGORY_OPTIONS.find((opt) => opt.value === category);
  const parsedAmount = Number(amountInput);
  const hasInput = amountInput.trim().length > 0;
  const isValid = hasInput && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const showError = hasInput && !isValid;

  const handleNext = () => {
    if (!isValid) return;
    navigate({ to: "/record-income/step-3", search: { category, amount: parsedAmount } });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader kicker="บันทึกรับเงิน" title="ระบุจำนวนเงิน" />

      <WizardStepIndicator currentStep={2} labels={WIZARD_STEP_LABELS} />

      {/* Selected category context */}
      {categoryOption && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <categoryOption.icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          <span>
            หมวดหมู่: <span className="font-medium text-foreground">{categoryOption.label}</span>
          </span>
        </div>
      )}

      {/* Large amount input */}
      <div className="rounded-card border border-border bg-card p-6">
        <label htmlFor="amount" className="text-sm font-medium text-muted-foreground">
          จำนวนเงิน
        </label>
        <div className="relative mt-3">
          <span
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-semibold text-muted-foreground md:text-4xl"
          >
            ฿
          </span>
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amountInput}
            onChange={(e) => setAmountInput(sanitizeAmountInput(e.target.value))}
            aria-invalid={showError}
            aria-describedby={showError ? "amount-error" : undefined}
            className={cn(
              "num-display h-20 w-full rounded-input border-2 bg-transparent pl-14 pr-4 text-4xl font-semibold tracking-tight outline-none transition-colors md:h-24 md:text-5xl",
              showError
                ? "border-destructive focus-visible:ring-2 focus-visible:ring-destructive/20"
                : "border-border focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
            )}
          />
        </div>

        {showError && (
          <p id="amount-error" className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            กรุณาระบุจำนวนเงินมากกว่า 0 บาท
          </p>
        )}
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between border-t border-border pt-5">
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/record-income/step-1", search: { category } })}
        >
          ย้อนกลับ
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate({ to: "/staff" })}>
            ยกเลิก
          </Button>
          <Button onClick={handleNext} disabled={!isValid}>
            ถัดไป
          </Button>
        </div>
      </div>
    </div>
  );
}
