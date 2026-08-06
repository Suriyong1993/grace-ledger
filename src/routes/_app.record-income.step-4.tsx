/**
 * FS-005 — Record Income Wizard, Step 4: Review
 *
 * Sprint 2 HTML prototype (UI validation only — see
 * .claude/sprint-2-instructions.md). Mock/local state, no backend calls —
 * "ยืนยันบันทึกรายรับ" simulates a save (timeout + success modal), it does
 * not persist anything.
 *
 * Route note: same reasoning as step-1/2/3 — lives at
 * /record-income/step-4, not /income/step-4, to avoid nesting under the
 * existing (Outlet-less) `_app.income.tsx` production page.
 */

import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, Upload, X, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { WizardStepIndicator } from "@/components/shared/WizardStepIndicator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { thb, fmtDateTime, dayjs } from "@/lib/format";
import {
  INCOME_CATEGORY_OPTIONS,
  INCOME_DESTINATION_OPTIONS,
  WIZARD_STEP_LABELS,
  isIncomeCategory,
  isIncomeDestination,
  type IncomeCategory,
  type IncomeDestination,
} from "@/lib/recordIncomeWizard";

interface Step4Search {
  category?: IncomeCategory;
  amount?: number;
  destination?: IncomeDestination;
}

export const Route = createFileRoute("/_app/record-income/step-4")({
  head: () => ({ meta: [{ title: "ตรวจสอบรายการ — Grace Ledger" }] }),
  validateSearch: (search: Record<string, unknown>): Step4Search => {
    const amount = Number(search.amount);
    return {
      category: isIncomeCategory(search.category) ? search.category : undefined,
      amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
      destination: isIncomeDestination(search.destination) ? search.destination : undefined,
    };
  },
  component: RecordIncomeStep4,
});

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/jpg", "image/webp"];

function RecordIncomeStep4() {
  const navigate = useNavigate();
  const { category, amount, destination } = Route.useSearch();
  const recordedAtRef = useRef(dayjs());

  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 4 requires category, amount, and destination from the prior
  // steps — bounce back to whichever is missing (e.g. a stale/shared URL).
  useEffect(() => {
    if (!category) {
      navigate({ to: "/record-income/step-1" });
    } else if (!amount) {
      navigate({ to: "/record-income/step-2", search: { category } });
    } else if (!destination) {
      navigate({ to: "/record-income/step-3", search: { category, amount } });
    }
  }, [category, amount, destination, navigate]);

  useEffect(() => {
    if (!receipt) {
      setReceiptPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(receipt);
    setReceiptPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [receipt]);

  if (!category || !amount || !destination) return null;

  const categoryOption = INCOME_CATEGORY_OPTIONS.find((opt) => opt.value === category);
  const destinationOption = INCOME_DESTINATION_OPTIONS.find((opt) => opt.value === destination);

  const acceptFile = (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP)");
      return;
    }
    setReceipt(file);
  };

  const handleConfirm = () => {
    setIsSubmitting(true);
    // Mock save — this prototype has no backend, see file header.
    setTimeout(() => {
      setIsSubmitting(false);
      setShowSuccess(true);
    }, 800);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader kicker="บันทึกรับเงิน" title="ตรวจสอบรายการ" />

      <WizardStepIndicator currentStep={4} labels={WIZARD_STEP_LABELS} />

      {/* Summary card */}
      <div className="rounded-card border border-border bg-card p-6">
        <p className="kicker mb-4">สรุปข้อมูล</p>
        <dl className="space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <dt className="text-sm text-muted-foreground">ประเภทเงินรับ</dt>
            <dd className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              {categoryOption && (
                <categoryOption.icon
                  className="h-3.5 w-3.5 text-muted-foreground"
                  strokeWidth={1.5}
                />
              )}
              {categoryOption?.label}
            </dd>
          </div>
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <dt className="text-sm text-muted-foreground">จำนวนเงิน</dt>
            <dd className="num-display text-2xl font-bold text-foreground">{thb(amount)}</dd>
          </div>
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <dt className="text-sm text-muted-foreground">ช่องทางเงินเข้า</dt>
            <dd className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              {destinationOption && (
                <destinationOption.icon
                  className="h-3.5 w-3.5 text-muted-foreground"
                  strokeWidth={1.5}
                />
              )}
              {destinationOption?.label}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-muted-foreground">วันเวลาที่บันทึก</dt>
            <dd className="text-sm font-medium text-foreground">
              {fmtDateTime(recordedAtRef.current.toISOString())}
            </dd>
          </div>
        </dl>
      </div>

      {/* Receipt attachment */}
      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">แนบหลักฐาน (ไม่บังคับ)</p>

        {receiptPreviewUrl ? (
          <div className="flex items-center gap-3 rounded-card border border-border bg-card p-3">
            <img
              src={receiptPreviewUrl}
              alt="ตัวอย่างสลิป/ใบเสร็จ"
              className="h-16 w-16 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{receipt?.name}</p>
              <p className="text-xs text-muted-foreground">
                {receipt ? `${(receipt.size / 1024).toFixed(1)} KB` : ""}
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setReceipt(null)}
              aria-label="ลบไฟล์แนบ"
            >
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) acceptFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            className={cn(
              "cursor-pointer rounded-card border-2 border-dashed p-8 text-center transition-colors",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/40",
            )}
          >
            <Upload className="mx-auto h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            <p className="mt-2 text-sm font-medium text-foreground">
              ลากรูปสลิป/ใบเสร็จมาวางที่นี่
            </p>
            <p className="mt-1 text-xs text-muted-foreground">หรือคลิกเพื่อเลือกไฟล์ (JPG, PNG)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) acceptFile(file);
                e.target.value = "";
              }}
            />
          </div>
        )}
      </div>

      {/* Navigation / action bar */}
      <div className="flex items-center justify-between border-t border-border pt-5">
        <Button
          variant="outline"
          disabled={isSubmitting}
          onClick={() => navigate({ to: "/record-income/step-3", search: { category, amount } })}
        >
          ย้อนกลับ
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            disabled={isSubmitting}
            onClick={() => navigate({ to: "/staff" })}
          >
            ยกเลิก
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting} className="gap-1.5">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            ยืนยันบันทึกรายรับ
          </Button>
        </div>
      </div>

      {/* Success modal */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader className="items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-muted">
              <CheckCircle2 className="h-7 w-7 text-success" strokeWidth={1.75} />
            </div>
            <DialogTitle className="mt-3">บันทึกรายรับสำเร็จ</DialogTitle>
            <DialogDescription>
              {categoryOption?.label} จำนวน {thb(amount)}
            </DialogDescription>
          </DialogHeader>
          <Button className="mt-2 w-full" onClick={() => navigate({ to: "/staff" })}>
            เสร็จสิ้น
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
