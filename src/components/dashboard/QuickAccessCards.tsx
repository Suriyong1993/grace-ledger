/**
 * QuickAccessCards.tsx
 *
 * Featured operation cards inspired by the "Quick Access" section of the 3-column UI.
 * Provides high-priority action cards:
 * 1. Pending Approvals Card (with user avatar stack & direct link to /approvals)
 * 2. Cash & Bank Balances Card
 * 3. Sunday Offering Summary Card
 */

import { Link } from "@tanstack/react-router";
import { Clock, Wallet, HandHeart, ArrowRight, CheckCircle2 } from "lucide-react";
import { MoneyText } from "@/components/shared/MoneyText";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickAccessCardsProps {
  pendingCount: number;
  bankBalance: number;
  offeringTotal: number;
}

export function QuickAccessCards({
  pendingCount = 3,
  bankBalance = 1245600,
  offeringTotal = 45000,
}: QuickAccessCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 1. Pending Approvals Featured Card (Primary Accent) */}
      <div className="card-ledger p-5 bg-gradient-to-br from-primary/10 via-card to-card border-primary/20 relative overflow-hidden flex flex-col justify-between space-y-3 group hover:border-primary/40 transition-all">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Clock className="h-4 w-4" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">รายการรออนุมัติ</p>
              <p className="text-[11px] text-muted-foreground">ต้องการการอนุมัติจากคุณ</p>
            </div>
          </div>
          <span className="badge-pending text-xs px-2.5 py-0.5 font-bold rounded-full">
            {pendingCount} รายการ
          </span>
        </div>

        {/* Avatar stack + Link button */}
        <div className="flex items-end justify-between pt-2">
          <div className="flex items-center -space-x-2">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-indigo-600 text-[10px] font-bold text-white ring-2 ring-card">
              SC
            </div>
            <div className="grid h-7 w-7 place-items-center rounded-full bg-emerald-600 text-[10px] font-bold text-white ring-2 ring-card">
              WL
            </div>
            <div className="grid h-7 w-7 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground ring-2 ring-card">
              +{pendingCount}
            </div>
          </div>

          <Link to="/approvals">
            <Button size="sm" className="h-8 gap-1 text-xs font-medium active-press">
              ตรวจสอบ
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Bank & Cash Liquidity Card */}
      <div className="card-ledger p-5 flex flex-col justify-between space-y-3 hover:border-border/80 transition-all">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-income-muted text-income">
              <Wallet className="h-4 w-4" strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">ยอดเงินในบัญชีรวม</p>
              <p className="text-[11px] text-muted-foreground">ธนาคาร + เงินสดสด</p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-income">สภาพคล่องสูง</span>
        </div>

        <div>
          <p className="num-display text-2xl font-bold tracking-tight text-foreground">
            <MoneyText value={bankBalance} />
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            ปรับปรุงล่าสุดเมื่อสักครู่
          </p>
        </div>
      </div>

      {/* 3. Sunday Offering Summary Card */}
      <div className="card-ledger p-5 flex flex-col justify-between space-y-3 hover:border-border/80 transition-all">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-offering-muted text-offering">
              <HandHeart className="h-4 w-4" strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">ถวายสัปดาห์ล่าสุด</p>
              <p className="text-[11px] text-muted-foreground">ยอดถวายเข้าบัญชี</p>
            </div>
          </div>
          <span className="badge-approved text-[11px] px-2 py-0.5 font-medium rounded-full">
            ครบถ้วน
          </span>
        </div>

        <div>
          <p className="num-display text-2xl font-bold tracking-tight amount-income">
            +<MoneyText value={offeringTotal} />
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              เงินสด
            </span>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              QR Payment
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
