/**
 * QuickAccessCards.tsx
 *
 * Premium KPI cards with distinct visual personalities per metric.
 * Each card has a unique visual language matching its data context:
 * 1. Pending Approvals — primary accent, urgency
 * 2. Cash Balance — emerald, growth, live pulse
 * 3. Offering — amber, sacred, warmth
 */

import { Link } from "@tanstack/react-router";
import { Clock, Wallet, HandHeart, ArrowRight, TrendingUp, AlertCircle } from "lucide-react";
import { MoneyText } from "@/components/shared/MoneyText";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickAccessCardsProps {
  pendingCount: number;
  bankBalance: number;
  offeringTotal: number;
}

export function QuickAccessCards({
  pendingCount = 0,
  bankBalance = 0,
  offeringTotal = 0,
}: QuickAccessCardsProps) {
  const hasPending = pendingCount > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* ── 1. Pending Approvals Card ── */}
      <div
        className={cn(
          "card-ledger p-5 relative overflow-hidden flex flex-col justify-between gap-4",
          "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card",
          hasPending
            ? "bg-gradient-to-br from-primary/8 via-card to-card border-primary/25"
            : "border-border/60",
        )}
      >
        {/* Decorative background orb */}
        {hasPending && (
          <div
            className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/6 blur-2xl"
            aria-hidden
          />
        )}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "relative grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-xs",
                hasPending
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {hasPending ? (
                <Clock className="h-4 w-4" strokeWidth={2.2} />
              ) : (
                <AlertCircle className="h-4 w-4" strokeWidth={1.75} />
              )}
              {/* Live pulse dot */}
              {hasPending && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-pending ring-2 ring-card">
                  <span className="absolute inset-0 animate-ping rounded-full bg-pending opacity-60" />
                </span>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground leading-snug">รายการรออนุมัติ</p>
              <p className="text-[11px] text-muted-foreground">
                {hasPending ? "ต้องการการอนุมัติจากคุณ" : "ไม่มีรายการค้างอยู่"}
              </p>
            </div>
          </div>

          {hasPending && (
            <span className="badge-pending shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold">
              {pendingCount}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          {/* Avatar stack */}
          <div className="flex items-center -space-x-1.5" aria-label="ผู้รออนุมัติ">
            {["SC", "WL"].map((initials, i) => (
              <div
                key={initials}
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full text-[9px] font-bold text-white ring-2 ring-card",
                  i === 0 ? "bg-primary" : "bg-income",
                )}
              >
                {initials}
              </div>
            ))}
            {pendingCount > 2 && (
              <div className="grid h-6 w-6 place-items-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground ring-2 ring-card">
                +{pendingCount - 2}
              </div>
            )}
          </div>

          <Link to="/approvals">
            <Button
              size="sm"
              variant={hasPending ? "default" : "outline"}
              className="h-7 gap-1 text-[11px] font-medium active-press"
            >
              ตรวจสอบ
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* ── 2. Total Balance Card ── */}
      <div className="card-ledger group relative overflow-hidden p-5 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card hover:border-income/30">
        {/* Decorative orb */}
        <div
          className="pointer-events-none absolute -right-8 -bottom-8 h-28 w-28 rounded-full bg-income/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          aria-hidden
        />

        {/* Label */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-income-muted text-income transition-colors group-hover:bg-income group-hover:text-white">
              <Wallet className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">ยอดเงินรวมทั้งหมด</p>
              <p className="text-[11px] text-muted-foreground">ธนาคาร · เงินสด · กองทุน</p>
            </div>
          </div>
        </div>

        {/* Metric hero */}
        <div>
          <p className="num-display text-[1.625rem] font-bold tracking-tight text-foreground leading-none">
            <MoneyText value={bankBalance} />
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 text-income">
              <TrendingUp className="h-3 w-3" strokeWidth={2} />
              <span className="text-[11px] font-semibold">สภาพคล่องสูง</span>
            </div>
            <span className="text-[11px] text-muted-foreground/60">·</span>
            <span className="text-[11px] text-muted-foreground">อัปเดตแบบ real-time</span>
          </div>
        </div>
      </div>

      {/* ── 3. Offering Summary Card ── */}
      <div className="card-ledger group relative overflow-hidden p-5 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card hover:border-offering/30">
        {/* Decorative orb */}
        <div
          className="pointer-events-none absolute -right-8 -bottom-8 h-28 w-28 rounded-full bg-offering/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          aria-hidden
        />

        {/* Label */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-offering-muted text-offering transition-colors group-hover:bg-offering group-hover:text-white">
              <HandHeart className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">ถวายสัปดาห์ล่าสุด</p>
              <p className="text-[11px] text-muted-foreground">ยอดรวมทุกช่องทาง</p>
            </div>
          </div>
          <span className="badge-approved shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold">
            ครบถ้วน
          </span>
        </div>

        {/* Metric hero */}
        <div>
          <p className="num-display text-[1.625rem] font-bold tracking-tight amount-income leading-none">
            +<MoneyText value={offeringTotal} />
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              เงินสด
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              QR Payment
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              โอนเงิน
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
