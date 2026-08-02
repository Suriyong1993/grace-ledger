import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { MoneyText } from "@/components/shared/MoneyText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { listFunds, listIncome, listExpense, listOffering } from "@/services/church";
import { thb, dayjs, fmtDate } from "@/lib/format";
import { CHANNEL_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/reconciliation")({
  head: () => ({ meta: [{ title: "สรุปยอด — ระบบจัดการการเงินคริสตจักร" }] }),
  component: ReconciliationPage,
});

type Period = "this_week" | "this_month" | "last_week" | "last_month" | "custom";

function usePeriodRange(period: Period, customRange: { start: string; end: string }) {
  return useMemo(() => {
    const now = dayjs();
    switch (period) {
      case "this_week": {
        const s = now.startOf("week").format("YYYY-MM-DD");
        return { start: s, end: now.format("YYYY-MM-DD") };
      }
      case "this_month": {
        const s = now.startOf("month").format("YYYY-MM-DD");
        return { start: s, end: now.format("YYYY-MM-DD") };
      }
      case "last_week": {
        const s = now.subtract(1, "week").startOf("week");
        const e = now.subtract(1, "week").endOf("week");
        return { start: s.format("YYYY-MM-DD"), end: e.format("YYYY-MM-DD") };
      }
      case "last_month": {
        const s = now.subtract(1, "month").startOf("month");
        const e = now.subtract(1, "month").endOf("month");
        return { start: s.format("YYYY-MM-DD"), end: e.format("YYYY-MM-DD") };
      }
      case "custom":
        return {
          start: customRange.start || now.format("YYYY-MM-DD"),
          end: customRange.end || now.format("YYYY-MM-DD"),
        };
    }
  }, [period, customRange.start, customRange.end]);
}

const PERIOD_LABEL: Record<Period, string> = {
  this_week: "สัปดาห์นี้",
  this_month: "เดือนนี้",
  last_week: "สัปดาห์ที่แล้ว",
  last_month: "เดือนที่แล้ว",
  custom: "กำหนดเอง",
};

function ReconciliationPage() {
  const [period, setPeriod] = useState<Period>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [actualCash, setActualCash] = useState("");
  const [actualBank, setActualBank] = useState("");

  const range = usePeriodRange(period, { start: customStart, end: customEnd });

  const fundsQ = useQuery({ queryKey: ["funds"], queryFn: listFunds });
  const incomeQ = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const expenseQ = useQuery({ queryKey: ["expense"], queryFn: listExpense });
  const offeringQ = useQuery({ queryKey: ["offering"], queryFn: listOffering });

  const isLoading =
    fundsQ.isLoading || incomeQ.isLoading || expenseQ.isLoading || offeringQ.isLoading;

  const funds = fundsQ.data ?? [];
  const incomes = incomeQ.data ?? [];
  const expenses = expenseQ.data ?? [];
  const offerings = offeringQ.data ?? [];

  // ---- Calculations ----
  const { start, end } = range;

  // Transactions before this period = opening balance contributors
  const incomeBefore = incomes.filter((x) => x.date < start);
  const offeringBefore = offerings.filter((x) => x.date < start);
  const expenseBefore = expenses.filter((x) => x.date < start);

  const openingBalance =
    funds.reduce((s, f) => s + f.openingBalance, 0) +
    incomeBefore.reduce((s, x) => s + x.amount, 0) +
    offeringBefore.reduce((s, x) => s + x.amount, 0) -
    expenseBefore.reduce((s, x) => s + x.amount, 0);

  // Transactions this period
  const incomeThis = incomes.filter((x) => x.date >= start && x.date <= end);
  const offeringThis = offerings.filter((x) => x.date >= start && x.date <= end);
  const expenseThis = expenses.filter((x) => x.date >= start && x.date <= end);

  const totalIncome = incomeThis.reduce((s, x) => s + x.amount, 0);
  const totalOffering = offeringThis.reduce((s, x) => s + x.amount, 0);
  const totalExpense = expenseThis.reduce((s, x) => s + x.amount, 0);
  const netChange = totalIncome + totalOffering - totalExpense;
  const closingBalance = openingBalance + netChange;

  // Current actual balance (all time)
  const currentBalance =
    funds.reduce((s, f) => s + f.openingBalance, 0) +
    incomes.reduce((s, x) => s + x.amount, 0) +
    offerings.reduce((s, x) => s + x.amount, 0) -
    expenses.reduce((s, x) => s + x.amount, 0);

  // Offering by channel this period
  const channelBreakdown = useMemo(() => {
    const byChannel: Record<string, number> = {};
    for (const o of offeringThis) {
      byChannel[o.channel] = (byChannel[o.channel] ?? 0) + o.amount;
    }
    return byChannel;
  }, [offeringThis]);

  // Per-fund breakdown
  const fundRows = useMemo(() => {
    const fundsList = fundsQ.data ?? [];
    const incomesList = incomeQ.data ?? [];
    const offeringsList = offeringQ.data ?? [];
    const expensesList = expenseQ.data ?? [];

    return fundsList.map((f) => {
      const fundIncome = incomeThis
        .filter((x) => x.fundId === f.id)
        .reduce((s, x) => s + x.amount, 0);
      const fundOffering = offeringThis
        .filter((x) => x.fundId === f.id)
        .reduce((s, x) => s + x.amount, 0);
      const fundExpense = expenseThis
        .filter((x) => x.fundId === f.id)
        .reduce((s, x) => s + x.amount, 0);
      const fundBalance =
        f.openingBalance +
        incomesList.filter((x) => x.fundId === f.id).reduce((s, x) => s + x.amount, 0) +
        offeringsList.filter((x) => x.fundId === f.id).reduce((s, x) => s + x.amount, 0) -
        expensesList.filter((x) => x.fundId === f.id).reduce((s, x) => s + x.amount, 0);
      return {
        name: f.name,
        openingBalance: f.openingBalance,
        income: fundIncome + fundOffering,
        expense: fundExpense,
        balance: fundBalance,
      };
    });
  }, [
    fundsQ.data,
    incomeThis,
    offeringThis,
    expenseThis,
    incomeQ.data,
    offeringQ.data,
    expenseQ.data,
  ]);

  // Reconciliation check
  const actualCashNum = parseFloat(actualCash) || 0;
  const actualBankNum = parseFloat(actualBank) || 0;
  const actualTotal = actualCashNum + actualBankNum;
  const hasActual = actualCash !== "" || actualBank !== "";
  const diff = hasActual ? currentBalance - actualTotal : 0;
  const isBalanced = hasActual && Math.abs(diff) < 0.01;

  const periodLabel = `${fmtDate(start)} — ${fmtDate(end)}`;

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        kicker="องค์กร"
        title="สรุปและกระทบยอด"
        description={periodLabel}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-px border border-border bg-border">
              {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "h-8 rounded-none px-3 text-xs font-medium whitespace-nowrap",
                    period === p
                      ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                      : "bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {PERIOD_LABEL[p]}
                </Button>
              ))}
            </div>
            {period === "custom" && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  className="h-8 w-36 bg-card text-xs"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <ArrowRight
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <Input
                  type="date"
                  className="h-8 w-36 bg-card text-xs"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            )}
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* ============ SUMMARY STATEMENT ============ */}
          <section className="card-ledger animate-fade-up">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <p className="kicker">งบแสดงฐานะการเงิน</p>
              <span className="num-display text-xs text-muted-foreground">
                {PERIOD_LABEL[period]}
              </span>
            </div>
            <div className="divide-y divide-border">
              {/* Opening */}
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">ยอดยกมา</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    ก่อนวันที่ {fmtDate(start)}
                  </p>
                </div>
                <MoneyText value={openingBalance} tone="default" />
              </div>

              {/* Income + Offering */}
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">รายรับ + เงินถวาย</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    รายรับ {thb(totalIncome)} · เงินถวาย {thb(totalOffering)}
                  </p>
                </div>
                <MoneyText value={totalIncome + totalOffering} tone="income" />
              </div>

              {/* Expense */}
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">รายจ่าย</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {expenseThis.length} รายการ
                  </p>
                </div>
                <MoneyText value={totalExpense} tone="expense" />
              </div>

              {/* Net change */}
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <p className="text-sm font-semibold text-foreground">ผลต่างสุทธิ</p>
                <MoneyText value={netChange} tone={netChange >= 0 ? "income" : "expense"} />
              </div>
            </div>

            {/* Closing */}
            <div className="flex items-center justify-between gap-4 border-t border-border bg-muted/30 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">ยอดยกไป</p>
                <p className="mt-0.5 text-xs text-muted-foreground">ณ วันที่ {fmtDate(end)}</p>
              </div>
              <p className="num-display text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                {thb(closingBalance)}
              </p>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* ============ CHANNEL BREAKDOWN ============ */}
            <section className="card-ledger animate-fade-up">
              <div className="border-b border-border px-5 py-3.5">
                <p className="kicker">เงินถวายแยกตามช่องทาง</p>
              </div>
              <div className="space-y-4 px-5 py-4">
                {(["cash", "bank", "qr"] as const).map((ch) => {
                  const amount = channelBreakdown[ch] ?? 0;
                  const pct =
                    totalOffering > 0
                      ? Math.min(100, Math.round((amount / totalOffering) * 100))
                      : 0;
                  return (
                    <div key={ch}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium text-foreground">{CHANNEL_LABEL[ch]}</span>
                        <span className="num-display text-muted-foreground">{thb(amount)}</span>
                      </div>
                      <div className="h-1 bg-muted">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-primary transition-all duration-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
                <span className="text-sm font-semibold text-foreground">รวมเงินถวาย</span>
                <MoneyText value={totalOffering} tone="income" />
              </div>
            </section>

            {/* ============ FUND BREAKDOWN ============ */}
            <section className="card-ledger animate-fade-up">
              <div className="border-b border-border px-5 py-3.5">
                <p className="kicker">ยอดคงเหลือแยกตามกองทุน</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>กองทุน</TableHead>
                    <TableHead className="text-right">ยอดตั้งต้น</TableHead>
                    <TableHead className="text-right">รายรับ</TableHead>
                    <TableHead className="text-right">รายจ่าย</TableHead>
                    <TableHead className="text-right">คงเหลือ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fundRows.map((f) => (
                    <TableRow key={f.name}>
                      <TableCell className="font-medium text-foreground">{f.name}</TableCell>
                      <TableCell className="num-display text-right text-muted-foreground">
                        {thb(f.openingBalance)}
                      </TableCell>
                      <TableCell className="num-display text-right text-success">
                        {thb(f.income)}
                      </TableCell>
                      <TableCell className="num-display text-right text-destructive">
                        {thb(f.expense)}
                      </TableCell>
                      <TableCell className="num-display text-right font-semibold text-foreground">
                        {thb(f.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell className="font-semibold text-foreground">รวม</TableCell>
                    <TableCell className="num-display text-right font-semibold">
                      {thb(fundRows.reduce((s, f) => s + f.openingBalance, 0))}
                    </TableCell>
                    <TableCell className="num-display text-right font-semibold text-success">
                      {thb(fundRows.reduce((s, f) => s + f.income, 0))}
                    </TableCell>
                    <TableCell className="num-display text-right font-semibold text-destructive">
                      {thb(fundRows.reduce((s, f) => s + f.expense, 0))}
                    </TableCell>
                    <TableCell className="num-display text-right font-semibold">
                      {thb(fundRows.reduce((s, f) => s + f.balance, 0))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </section>
          </div>

          {/* ============ RECONCILIATION CHECK ============ */}
          <section className="card-ledger animate-fade-up">
            <div className="border-b border-border px-5 py-3.5">
              <p className="kicker">ตรวจสอบยอด (Reconciliation)</p>
            </div>
            <div className="grid divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              {/* System ledger column */}
              <div className="px-5 py-4">
                <p className="kicker">ยอดในระบบ</p>
                <div className="mt-3 space-y-2.5 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">ยอดยกมาตั้งต้น</span>
                    <span className="num-display text-foreground">
                      {thb(funds.reduce((s, f) => s + f.openingBalance, 0))}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">รายรับทั้งหมด (รวมเงินถวาย)</span>
                    <span className="num-display text-success">
                      {thb(
                        incomes.reduce((s, x) => s + x.amount, 0) +
                          offerings.reduce((s, x) => s + x.amount, 0),
                      )}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">รายจ่ายทั้งหมด</span>
                    <span className="num-display text-destructive">
                      {thb(expenses.reduce((s, x) => s + x.amount, 0))}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3">
                  <span className="text-sm font-semibold text-foreground">ยอดคงเหลือในระบบ</span>
                  <span className="num-display text-lg font-semibold text-foreground">
                    {thb(currentBalance)}
                  </span>
                </div>
              </div>

              {/* Actual ledger column */}
              <div className="px-5 py-4">
                <p className="kicker">ยอดเงินจริง</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label
                      htmlFor="actual-cash"
                      className="text-xs font-normal text-muted-foreground"
                    >
                      เงินสดในมือ (Cash on Hand)
                    </Label>
                    <Input
                      id="actual-cash"
                      type="number"
                      step="0.01"
                      className="num-display mt-1.5 h-9 bg-card"
                      placeholder="0.00"
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="actual-bank"
                      className="text-xs font-normal text-muted-foreground"
                    >
                      เงินในบัญชี (Bank Balance)
                    </Label>
                    <Input
                      id="actual-bank"
                      type="number"
                      step="0.01"
                      className="num-display mt-1.5 h-9 bg-card"
                      placeholder="0.00"
                      value={actualBank}
                      onChange={(e) => setActualBank(e.target.value)}
                    />
                  </div>
                </div>

                {hasActual ? (
                  <div className="mt-4 border-t border-border pt-3">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">ยอดเงินจริงรวม</span>
                      <span className="num-display font-medium text-foreground">
                        {thb(actualTotal)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">ผลต่างจากระบบ</span>
                      <span
                        className={cn(
                          "num-display font-semibold",
                          isBalanced ? "text-success" : "text-destructive",
                        )}
                      >
                        {diff >= 0 ? "+" : ""}
                        {thb(diff)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mt-3 flex items-center gap-1.5 text-xs font-medium",
                        isBalanced ? "text-success" : "text-destructive",
                      )}
                    >
                      {isBalanced ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      )}
                      {isBalanced ? "ยอดตรงกัน" : `ยอดไม่ตรงกัน (ต่าง ${thb(Math.abs(diff))})`}
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                    กรอกยอดเงินจริงเพื่อเปรียบเทียบกับยอดในระบบ
                  </p>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
