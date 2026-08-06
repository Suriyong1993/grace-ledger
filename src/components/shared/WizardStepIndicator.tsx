import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardStepIndicatorProps {
  /** 1-indexed current step */
  currentStep: number;
  labels: string[];
}

/**
 * Shared step indicator for the Record Income wizard (FS-002–FS-005) and any
 * future multi-step flow. Steps before `currentStep` render as completed
 * (checkmark), the current step is highlighted, later steps stay muted.
 */
export function WizardStepIndicator({ currentStep, labels }: WizardStepIndicatorProps) {
  return (
    <div className="flex items-center" role="list" aria-label="ขั้นตอนการบันทึกรายการ">
      {labels.map((label, i) => {
        const step = i + 1;
        const isComplete = step < currentStep;
        const isCurrent = step === currentStep;

        return (
          <div key={label} className={cn("flex items-center", i < labels.length - 1 && "flex-1")}>
            <div className="flex flex-col items-center gap-1.5" role="listitem">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  isComplete && "bg-primary text-primary-foreground",
                  isCurrent && "border-2 border-primary bg-card text-primary",
                  !isComplete &&
                    !isCurrent &&
                    "border border-border bg-muted text-muted-foreground",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isComplete ? <Check className="h-4 w-4" strokeWidth={2.5} /> : step}
              </div>
              <span
                className={cn(
                  "whitespace-nowrap text-[11px] font-medium",
                  isCurrent ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div
                className={cn("mx-2 h-px flex-1", isComplete ? "bg-primary" : "bg-border")}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
