import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useRef, useCallback } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  RefreshCw,
  Clock,
  TrendingUp,
  Receipt,
  ExternalLink,
  ChevronRight,
  Wallet,
  AlertTriangle,
  Banknote,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { MoneyText } from "@/components/shared/MoneyText";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { NumberTicker } from "@/components/ui/number-ticker";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  listIncome,
  listExpense,
  listCategories,
  listFunds,
  listOffering,
} from "@/services/church";
import { Money } from "@/lib/money";
import { thb, fmtDate, dayjs } from "@/lib/format";
import { type TxStatus } from "@/lib/types";
import { useNavigate } from "@tanstack/react-router";
import { PageTransition } from "@/components/shared/PageTransition";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "แดชบอร์ดการเงิน — Grace Ledger" }] }),
  component: Dashboard,
});

type Period = "today" | "week" | "month" | "quarter";

const PERIOD_LABELS: Record<Period, string> = {
  today: "วันนี้",
  week: "สัปดาห์นี้",
  month: "เดือนนี้",
  quarter: "ไตรมาสนี้",
};

interface TransactionItem {
  id: string;
  kind: "income" | "expense";
  date: string;
  amount: number;
  description?: string;
  categoryId?: string;
  fundId?: string;
  status?: TxStatus;
  vendor?: string;
  memberId?: string;
  receiptUrl?: string;
}

/** Filter a date string by the selected period */
function byPeriod(dateStr: string, period: Period, now: dayjs.Dayjs) {
  const d = dayjs(dateStr);
  if (period === "today") return d.isSame(now, "day");
  if (period === "week") return d.isAfter(now.subtract(7, "day"));
  if (period === "quarter") return d.isAfter(now.subtract(3, "month"));
  return d.isSame(now, "month");
}

/** Compare current period amount vs previous period ∆ */
function deltaPct(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("month");
  const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null);
  const [txFilter, setTxFilter] = useState<"all" | "income" | "expense" | "pending">("all");

  const incomeQ = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const expenseQ = useQuery({ queryKey: ["expense"], queryFn: listExpense });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const fundsQ = useQuery({ queryKey: ["funds"], queryFn: listFunds });
  const offQ = useQuery({ queryKey: ["offering"], queryFn: listOffering });

  // ── Stable reference (render-once timestamp) ─────────────
  const nowRef = useRef(dayjs());
  const now = nowRef.current;

  // ── Stable data references ───────────────────────────────
  const incomes = useMemo(() => incomeQ.data ?? [], [incomeQ.data]);
  const expenses = useMemo(() => expenseQ.data ?? [], [expenseQ.data]);
  const categories = useMemo(() => catsQ.data ?? [], [catsQ.data]);
  const funds = useMemo(() => fundsQ.data ?? [], [fundsQ.data]);
  const offerings = useMemo(() => offQ.data ?? [], [offQ.data]);

  // ── Total Cash Balance across all funds (using Money class) ─────
  const totalCashBalanceMoney = useMemo(() => {
    let total = Money.zero();
    for (const f of funds) {
      const fOpening = Money.fromBaht(String(f.openingBalance ?? 0));
      const fInc = incomes
        .filter((i) => i.fundId === f.id)
        .reduce((acc, i) => acc.add(Money.fromBaht(String(i.amount))), Money.zero());
      const fOff = offerings
        .filter((o) => o.fundId === f.id)
        .reduce((acc, o) => acc.add(Money.fromBaht(String(o.amount))), Money.zero());
      const fExp = expenses
        .filter((e) => e.fundId === f.id)
        .reduce((acc, e) => acc.add(Money.fromBaht(String(e.amount))), Money.zero());

      total = total.add(fOpening).add(fInc).add(fOff).subtract(fExp);
    }
    return total;
  }, [funds, incomes, expenses, offerings]);

  // ── Period-filtered data ──────────────────────────────
  const filteredIncomes = useMemo(
    () => incomes.filter((i) => byPeriod(i.date, period, now)),
    [incomes, period, now],
  );
  const filteredExpenses = useMemo(
    () => expenses.filter((e) => byPeriod(e.date, period, now)),
    [expenses, period, now],
  );

  const totalIncome = useMemo(
    () => filteredIncomes.reduce((s, x) => s + x.amount, 0),
    [filteredIncomes],
  );
  const totalExpense = useMemo(
    () => filteredExpenses.reduce((s, x) => s + x.amount, 0),
    [filteredExpenses],
  );
  const balance = totalIncome - totalExpense;

  // ── Comparison (previous period) ──────────────────────
  const prevIncomes = useMemo(
    () =>
      incomes.filter((i) =>
        byPeriod(
          i.date,
          period,
          now.subtract(1, period === "today" ? "day" : period === "week" ? "week" : "month"),
        ),
      ),
    [incomes, period, now],
  );
  const prevExpenses = useMemo(
    () =>
      expenses.filter((e) =>
        byPeriod(
          e.date,
          period,
          now.subtract(1, period === "today" ? "day" : period === "week" ? "week" : "month"),
        ),
      ),
    [expenses, period, now],
  );
  const prevIncomeTotal = prevIncomes.reduce((s, x) => s + x.amount, 0);
  const prevExpenseTotal = prevExpenses.reduce((s, x) => s + x.amount, 0);
  const incomeDelta = deltaPct(totalIncome, prevIncomeTotal);
  const expenseDelta = deltaPct(totalExpense, prevExpenseTotal);

  // ── Pending ───────────────────────────────────────────
  const pendingItems = useMemo(
    () => [
      ...incomes.filter((i) => i.status === "pending"),
      ...expenses.filter((e) => e.status === "pending"),
    ],
    [incomes, expenses],
  );
  const pendingTotal = useMemo(
    () => pendingItems.reduce((s, e) => s + e.amount, 0),
    [pendingItems],
  );

  // ── Monthly trend (6-month compact) ───────────────────
  const monthly = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, i) => {
        const d = now.subtract(5 - i, "month");
        const key = d.format("YYYY-MM");
        const inc = incomes.filter((x) => x.date.startsWith(key)).reduce((s, x) => s + x.amount, 0);
        const exp = expenses
          .filter((x) => x.date.startsWith(key))
          .reduce((s, x) => s + x.amount, 0);
        return {
          label: d.format("MMM") + (d.year() !== now.year() ? ` ${String(d.year()).slice(2)}` : ""),
          income: inc,
          expense: exp,
          net: inc - exp,
        };
      }),
    [incomes, expenses, now],
  );

  const maxMonthly = Math.max(...monthly.map((m) => Math.max(m.income, m.expense, 1)));

  // ── Category breakdown ────────────────────────────────
  const catName = useCallback(
    (id?: string) => categories.find((c) => c.id === id)?.name ?? "หมวดทั่วไป",
    [categories],
  );

  const expenseByCat = useMemo(
    () =>
      Object.entries(
        filteredExpenses.reduce<Record<string, number>>((acc, e) => {
          const key = e.categoryId || "other";
          acc[key] = (acc[key] ?? 0) + e.amount;
          return acc;
        }, {}),
      )
        .map(([id, amount]) => ({ name: catName(id), amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [filteredExpenses, catName],
  );

  // ── Transaction stream ────────────────────────────────
  const allTx: TransactionItem[] = useMemo(
    () =>
      [
        ...filteredIncomes.map(
          (i): TransactionItem => ({
            id: i.id,
            kind: "income",
            date: i.date,
            amount: i.amount,
            description: i.description,
            categoryId: i.categoryId,
            fundId: i.fundId,
            status: i.status,
          }),
        ),
        ...filteredExpenses.map(
          (e): TransactionItem => ({
            id: e.id,
            kind: "expense",
            date: e.date,
            amount: e.amount,
            description: e.description,
            categoryId: e.categoryId,
            fundId: e.fundId,
            status: e.status,
            vendor: e.vendor,
          }),
        ),
      ].sort((a, b) => b.date.localeCompare(a.date)),
    [filteredIncomes, filteredExpenses],
  );

  const displayTx = useMemo(
    () =>
      allTx
        .filter((t) => {
          if (txFilter === "income") return t.kind === "income";
          if (txFilter === "expense") return t.kind === "expense";
          if (txFilter === "pending") return t.status === "pending";
          return true;
        })
        .slice(0, 12),
    [allTx, txFilter],
  );

  // ── Error check (after all hooks) ─────────────────────
  const hasError = incomeQ.isError || expenseQ.isError;
  if (hasError && !incomeQ.data && !expenseQ.data) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="w-full max-w-md rounded-sm border border-border bg-card p-6 text-center shadow-craft">
          <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-warning" strokeWidth={1.5} />
          <p className="font-display text-base font-semibold text-foreground">
            ไม่สามารถโหลดข้อมูลการเงินได้
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {(incomeQ.error as Error)?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 active-press cursor-pointer"
            onClick={() => {
              incomeQ.refetch();
              expenseQ.refetch();
            }}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> ลองใหม่อีกครั้ง
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading check ─────────────────────────────────────
  const isLoading = incomeQ.isLoading || expenseQ.isLoading;

  // ── Render helpers ────────────────────────────────────

  const renderDelta = (delta: number | null, inverse = false) => {
    if (delta === null) return null;
    const positive = inverse ? delta < 0 : delta > 0;
    const zero = delta === 0;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-xs font-medium",
          zero && "text-muted-foreground",
          positive && "text-success",
          !positive && !zero && "text-destructive",
        )}
      >
        {zero ? "—" : positive ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
      </span>
    );
  };

  if (isLoading) {
    return (
      <PageTransition className="space-y-5 md:space-y-6">
        {/* Skeleton header */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded-sm" />
          <Skeleton className="h-7 w-64 rounded-sm" />
        </div>
        {/* Skeleton stat strip */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Skeleton className="h-44 rounded-sm md:col-span-2" />
          <Skeleton className="h-44 rounded-sm" />
          <Skeleton className="h-44 rounded-sm" />
        </div>
        {/* Skeleton banner */}
        <Skeleton className="h-16 rounded-sm" />
        {/* Skeleton analytics */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <Skeleton className="h-64 rounded-sm md:col-span-3" />
          <Skeleton className="h-64 rounded-sm md:col-span-2" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-5 md:space-y-6">
      {/* ── Header ──────────────────────────────────────── */}
      <PageHeader
        kicker="Financial Command Center"
        title="ศูนย์ควบคุมการเงิน"
        description="สรุปกระแสเงินสด สถานะงบประมาณ และรายการที่ต้องอนุมัติเรียลไทม์"
        actions={
          <div className="flex items-center gap-2">
            {/* Period segmented control */}
            <div className="flex rounded-sm border border-border bg-muted/50 p-0.5">
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "h-8 rounded-[2px] px-3 text-xs font-medium transition-all duration-150 active-press cursor-pointer",
                    period === p
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              className="h-8 gap-1.5 font-medium active-press cursor-pointer"
              onClick={() => navigate({ to: "/expense" })}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>บันทึกรายการ</span>
            </Button>
          </div>
        }
      />

      {/* ── Executive stat strip ────────────────────────── */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {/* Balance — hero cell, spans 2 columns */}
        <div className="relative col-span-1 flex flex-col justify-between rounded-sm border border-border/80 bg-card p-5 shadow-craft transition-colors hover:bg-muted/10 md:col-span-2 md:p-6">
          {/* Editorial top rule */}
          <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-primary via-primary/40 to-transparent" />
          <div>
            <div className="flex items-center justify-between">
              <span className="kicker font-medium text-muted-foreground">
                ยอดเงินสดคงเหลือรวมทุกกองทุน
              </span>
              <Wallet className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </div>
            <p
              className={cn(
                "num-display mt-2 font-display text-[clamp(2.5rem,5vw,3.5rem)] font-bold leading-none tracking-tight",
                totalCashBalanceMoney.isGreaterThanOrEqual(Money.zero())
                  ? "text-foreground"
                  : "text-destructive",
              )}
            >
              ฿{" "}
              <NumberTicker value={Math.abs(totalCashBalanceMoney.toNumber())} decimalPlaces={2} />
            </p>
          </div>
          <div className="mt-4 flex items-center gap-3 border-t border-border/40 pt-3">
            <span className="text-xs text-muted-foreground">
              กระแสเงินสดสุทธิ ({PERIOD_LABELS[period]}):
            </span>
            <span
              className={cn(
                "num-display text-xs font-semibold",
                balance >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {balance >= 0 ? "+" : "−"}฿{thb(Math.abs(balance))}
            </span>
            <span className="text-border/60">·</span>
            <span className="text-xs text-muted-foreground">เทียบช่วงก่อน</span>
            {renderDelta(deltaPct(balance, prevIncomeTotal - prevExpenseTotal))}
          </div>
        </div>

        {/* Income */}
        <div className="flex flex-col justify-between rounded-sm border border-border/80 bg-card p-4 shadow-craft transition-colors hover:bg-muted/10">
          <div>
            <div className="flex items-center justify-between">
              <span className="kicker">รายรับ</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-success/10 text-success">
                <ArrowDownLeft className="h-3.5 w-3.5" strokeWidth={2} />
              </div>
            </div>
            <p className="num-display mt-2 font-display text-2xl font-bold text-success tracking-tight">
              +฿
              <NumberTicker value={totalIncome} decimalPlaces={2} />
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-xs">
            <span className="text-muted-foreground">{filteredIncomes.length} รายการ</span>
            {renderDelta(incomeDelta)}
          </div>
        </div>

        {/* Expense */}
        <div className="flex flex-col justify-between rounded-sm border border-border/80 bg-card p-4 shadow-craft transition-colors hover:bg-muted/10">
          <div>
            <div className="flex items-center justify-between">
              <span className="kicker">รายจ่าย</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-destructive/10 text-destructive">
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
              </div>
            </div>
            <p className="num-display mt-2 font-display text-2xl font-bold text-destructive tracking-tight">
              −฿
              <NumberTicker value={totalExpense} decimalPlaces={2} />
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-xs">
            <span className="text-muted-foreground">{filteredExpenses.length} รายการ</span>
            {renderDelta(expenseDelta, true)}
          </div>
        </div>
      </section>

      {/* ── Pending approvals banner ────────────────────── */}
      {pendingItems.length > 0 && (
        <section className="rounded-sm border border-amber-500/25 bg-amber-50/60 dark:bg-amber-950/15 px-4 py-3 shadow-craft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-amber-500/15 text-warning">
                <Clock className="h-4 w-4" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                  รายการรออนุมัติ {pendingItems.length} รายการ
                </p>
                <p className="num-display text-xs text-amber-600/70 dark:text-amber-400/70">
                  มูลค่ารวม ฿{pendingTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-amber-500/30 text-xs text-amber-700 hover:bg-amber-500/15 dark:text-amber-300 active-press cursor-pointer"
              onClick={() => setTxFilter("pending")}
            >
              <span>ตรวจสอบ</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </section>
      )}

      {/* ── Analytics grid ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {/* 6-month trend — compact editorial table */}
        <section className="rounded-sm border border-border/80 bg-card shadow-craft md:col-span-3">
          <div className="border-b border-border/60 px-5 py-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="kicker">แนวโน้มกระแสเงินสด 6 เดือน</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  รายรับ รายจ่าย และยอดคงเหลือสะสม
                </p>
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
            </div>
          </div>

          <div className="divide-y divide-border/40">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-2 px-5 py-2.5 text-[11px] font-medium text-muted-foreground/70">
              <span className="col-span-2">เดือน</span>
              <span className="col-span-3 text-right">รายรับ</span>
              <span className="col-span-3 text-right">รายจ่าย</span>
              <span className="col-span-4 text-right">คงเหลือ</span>
            </div>

            {monthly.map((m, i) => {
              const maxVal = maxMonthly;
              return (
                <div
                  key={i}
                  className="grid grid-cols-12 gap-2 px-5 py-3 transition-colors hover:bg-muted/20"
                >
                  <span className="col-span-2 self-center text-xs font-semibold text-foreground">
                    {m.label}
                  </span>

                  {/* Income bar */}
                  <div className="col-span-3 self-center">
                    <div className="flex items-center justify-end gap-2">
                      <span className="num-display text-xs font-medium text-success">
                        +{thb(m.income)}
                      </span>
                    </div>
                    <div className="mt-1 h-1 w-full rounded-full bg-muted/50">
                      <div
                        className="h-full rounded-full bg-success/50 transition-all"
                        style={{ width: `${(m.income / maxVal) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Expense bar */}
                  <div className="col-span-3 self-center">
                    <div className="flex items-center justify-end gap-2">
                      <span className="num-display text-xs font-medium text-destructive/80">
                        −{thb(m.expense)}
                      </span>
                    </div>
                    <div className="mt-1 h-1 w-full rounded-full bg-muted/50">
                      <div
                        className="h-full rounded-full bg-destructive/40 transition-all"
                        style={{ width: `${(m.expense / maxVal) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Net */}
                  <div className="col-span-4 self-center text-right">
                    <span
                      className={cn(
                        "num-display text-xs font-bold",
                        m.net >= 0 ? "text-foreground" : "text-destructive",
                      )}
                    >
                      {m.net >= 0 ? "+" : "−"}
                      {thb(Math.abs(m.net))}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Empty state */}
            {monthly.every((m) => !m.income && !m.expense) && (
              <div className="flex h-32 flex-col items-center justify-center text-center text-xs text-muted-foreground">
                <Banknote className="mb-2 h-6 w-6 stroke-1 text-muted-foreground/50" />
                <span>ยังไม่มีข้อมูลในช่วงเวลานี้</span>
              </div>
            )}
          </div>
        </section>

        {/* Top expense categories */}
        <section className="flex flex-col rounded-sm border border-border/80 bg-card p-5 shadow-craft md:col-span-2">
          <div className="flex items-center justify-between pb-4">
            <div>
              <p className="kicker">หมวดหมู่รายจ่ายสูงสุด</p>
              <p className="mt-0.5 text-xs text-muted-foreground">การกระจายตัวของค่าใช้จ่าย</p>
            </div>
            <span className="num-display rounded-[2px] bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {expenseByCat.length} หมวด
            </span>
          </div>

          <div className="flex-1 space-y-4">
            {expenseByCat.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-xs text-muted-foreground">
                <Receipt className="mb-2 h-8 w-8 stroke-1 text-muted-foreground/50" />
                <span>ยังไม่มีรายการจ่ายในงวดนี้</span>
              </div>
            ) : (
              expenseByCat.map((cat, i) => {
                const maxAmt = expenseByCat[0]?.amount || 1;
                const pct = Math.round((cat.amount / maxAmt) * 100);
                return (
                  <div key={i} className="group">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <span className="num-display text-[10px] text-muted-foreground/60">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>{cat.name}</span>
                      </span>
                      <span className="num-display font-medium text-foreground">
                        {thb(cat.amount)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full rounded-full bg-primary transition-all duration-500 group-hover:brightness-110"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* ── Transaction activity stream ─────────────────── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <p className="kicker">กระแสรายการล่าสุด</p>
            {/* Filter pills */}
            <div className="flex items-center gap-1 rounded-sm border border-border bg-muted/30 p-0.5 text-xs">
              {[
                { id: "all" as const, label: "ทั้งหมด" },
                { id: "income" as const, label: "รายรับ" },
                { id: "expense" as const, label: "รายจ่าย" },
                { id: "pending" as const, label: "รออนุมัติ" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTxFilter(tab.id)}
                  className={cn(
                    "rounded-[2px] px-2.5 py-1 font-medium transition-colors cursor-pointer",
                    txFilter === tab.id
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs cursor-pointer active-press"
            onClick={() => navigate({ to: "/expense" })}
          >
            <span>ดูทั้งหมดในสมุดบัญชี</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Transaction rows */}
        <div className="divide-y divide-border/40">
          {displayTx.length === 0 ? (
            <div className="py-14 text-center text-xs text-muted-foreground">
              ไม่พบรายการตรงกับเงื่อนไขที่เลือก
            </div>
          ) : (
            displayTx.map((tx) => (
              <div
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className="group relative flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-muted/20 cursor-pointer"
              >
                {/* Editorial left accent — color-coded */}
                <div
                  className={cn(
                    "absolute inset-y-2 left-0 w-0.5 rounded-full transition-all duration-150 group-hover:w-1 group-hover:inset-y-1",
                    tx.kind === "income" ? "bg-success/60" : "bg-destructive/40",
                  )}
                />

                <div className="flex items-center gap-3.5 min-w-0 pl-2">
                  <div
                    className={cn(
                      "shrink-0",
                      tx.kind === "income" ? "text-success" : "text-destructive/60",
                    )}
                  >
                    {tx.kind === "income" ? (
                      <ArrowDownLeft className="h-4 w-4" strokeWidth={2} />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                      {tx.description ||
                        tx.vendor ||
                        (tx.kind === "income" ? "รายรับทั่วไป" : "รายจ่ายทั่วไป")}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{fmtDate(tx.date)}</span>
                      <span className="text-border/60">·</span>
                      <span>{catName(tx.categoryId)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={tx.status || "approved"} />
                  <MoneyText
                    value={tx.amount}
                    tone={tx.kind === "income" ? "income" : "expense"}
                    className="text-sm font-bold num-display"
                  />
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 transition-colors group-hover:text-muted-foreground/60" />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Transaction inspector sheet ─────────────────── */}
      <Sheet open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border p-6 text-left">
            <div className="flex items-center justify-between">
              <span className="kicker">รายละเอียดรายการ</span>
              <StatusBadge status={selectedTx?.status || "approved"} />
            </div>
            <SheetTitle className="mt-2 font-display text-xl font-semibold">
              {selectedTx?.description || selectedTx?.vendor || "รายการบัญชี"}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              รหัสรายการ: {selectedTx?.id}
            </SheetDescription>
          </SheetHeader>

          {selectedTx && (
            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              {/* Amount */}
              <div className="rounded-sm border border-border/60 bg-muted/20 p-5 text-center">
                <span className="kicker">จำนวนเงิน</span>
                <p
                  className={cn(
                    "num-display mt-1 font-display text-3xl font-bold tracking-tight",
                    selectedTx.kind === "income" ? "text-success" : "text-destructive",
                  )}
                >
                  {selectedTx.kind === "income" ? "+" : "−"}฿
                  {selectedTx.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </p>
              </div>

              {/* Details */}
              <div className="space-y-3 text-xs">
                {[
                  { label: "ประเภทรายการ", value: selectedTx.kind.toUpperCase() },
                  { label: "วันที่ทำรายการ", value: fmtDate(selectedTx.date) },
                  { label: "หมวดหมู่", value: catName(selectedTx.categoryId) },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between border-b border-border/40 py-2.5"
                  >
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Action */}
              <div className="border-t border-border pt-5">
                <Button
                  className="h-9 w-full gap-1.5 active-press cursor-pointer"
                  onClick={() => {
                    const path = selectedTx.kind === "income" ? "/income" : "/expense";
                    setSelectedTx(null);
                    navigate({ to: path });
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>จัดการในสมุดบัญชีหลัก</span>
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </PageTransition>
  );
}
