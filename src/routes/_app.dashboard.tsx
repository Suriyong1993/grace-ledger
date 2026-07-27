import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, RefreshCw } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { MoneyText } from "@/components/shared/MoneyText";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { NumberTicker } from "@/components/ui/number-ticker";
import { listIncome, listExpense, listCategories } from "@/services/church";
import { thb, fmtDate, dayjs } from "@/lib/format";
import { useNavigate } from "@tanstack/react-router";
import { PageTransition } from "@/components/shared/PageTransition";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "แดชบอร์ด — ระบบจัดการการเงิน" }] }),
  component: Dashboard,
});

type Period = "today" | "week" | "month";

const PERIOD_LABELS: Record<Period, string> = {
  today: "วันนี้",
  week: "สัปดาห์นี้",
  month: "เดือนนี้",
};

function Dashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("month");

  const incomeQ = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const expenseQ = useQuery({ queryKey: ["expense"], queryFn: listExpense });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: listCategories });

  const hasError = incomeQ.isError || expenseQ.isError;
  if (hasError && !incomeQ.data && !expenseQ.data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="card-ledger max-w-md px-6 py-6 text-center">
          <p className="font-display text-base font-medium text-foreground">
            ไม่สามารถโหลดข้อมูลได้
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {(incomeQ.error as Error)?.message || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ"}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              incomeQ.refetch();
              expenseQ.refetch();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> ลองใหม่
          </Button>
        </div>
      </div>
    );
  }

  const isLoading = incomeQ.isLoading || expenseQ.isLoading;
  const incomes = incomeQ.data ?? [];
  const expenses = expenseQ.data ?? [];
  const categories = catsQ.data ?? [];

  // Filter by period
  const now = dayjs();
  const filterByPeriod = (dateStr: string) => {
    const d = dayjs(dateStr);
    if (period === "today") return d.isSame(now, "day");
    if (period === "week") return d.isAfter(now.subtract(7, "day"));
    return d.isSame(now, "month");
  };

  const filteredIncomes = incomes.filter((i) => filterByPeriod(i.date));
  const filteredExpenses = expenses.filter((e) => filterByPeriod(e.date));

  const totalIncome = filteredIncomes.reduce((s, x) => s + x.amount, 0);
  const totalExpense = filteredExpenses.reduce((s, x) => s + x.amount, 0);
  const balance = totalIncome - totalExpense;

  // Monthly trend (6 months)
  const monthly = Array.from({ length: 6 }).map((_, i) => {
    const d = now.subtract(5 - i, "month");
    const key = d.format("YYYY-MM");
    return {
      month: d.format("MMM"),
      income: incomes.filter((x) => x.date.startsWith(key)).reduce((s, x) => s + x.amount, 0),
      expense: expenses.filter((x) => x.date.startsWith(key)).reduce((s, x) => s + x.amount, 0),
    };
  });

  // Top expense categories
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "อื่นๆ";
  const expenseByCat = Object.entries(
    filteredExpenses.reduce<Record<string, number>>((acc, e) => {
      const key = e.categoryId || "other";
      acc[key] = (acc[key] ?? 0) + e.amount;
      return acc;
    }, {}),
  )
    .map(([id, amount]) => ({ name: catName(id), amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Recent transactions (last 10)
  const recent = [
    ...filteredIncomes.map((i) => ({ ...i, kind: "income" as const })),
    ...filteredExpenses.map((e) => ({ ...e, kind: "expense" as const })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return (
    <PageTransition className="space-y-6 md:space-y-8">
      <PageHeader
        kicker="Grace Ledger"
        title="แดชบอร์ด"
        description="ภาพรวมการเงินของคริสตจักรแบบเรียลไทม์"
        actions={
          <>
            {/* Period segmented control */}
            <div className="flex gap-px border border-border bg-border">
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "h-8 cursor-pointer px-3 text-xs font-medium transition-colors duration-100",
                    period === p
                      ? "bg-foreground text-background"
                      : "bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            <Button className="h-8" onClick={() => navigate({ to: "/expense" })}>
              <Plus className="mr-1.5 h-4 w-4" /> บันทึกรายการ
            </Button>
          </>
        }
      />

      {/* Ledger hero — balance + flow */}
      {isLoading ? (
        <Skeleton className="h-44 w-full" />
      ) : (
        <section className="card-ledger animate-fade-up">
          <div className="grid divide-y divide-border md:grid-cols-[1.4fr_1fr_1fr] md:divide-x md:divide-y-0">
            <div className="px-5 py-6 md:px-7">
              <p className="kicker">คงเหลือ · {PERIOD_LABELS[period]}</p>
              <p
                className={cn(
                  "num-display font-display mt-3 text-4xl font-semibold tracking-tight md:text-[42px]",
                  balance >= 0 ? "text-foreground" : "text-destructive",
                )}
              >
                ฿<NumberTicker value={Math.abs(balance)} decimalPlaces={2} />
              </p>
              <p className="mt-2.5 text-xs text-muted-foreground">
                รายรับ − รายจ่าย{balance < 0 ? " · ติดลบ" : ""}
              </p>
            </div>
            <div className="px-5 py-5 md:px-6">
              <div className="flex items-center justify-between">
                <p className="kicker">รายรับ</p>
                <ArrowDownLeft className="h-4 w-4 text-success" strokeWidth={1.75} />
              </div>
              <p className="num-display mt-2.5 text-xl font-semibold text-success md:text-2xl">
                +฿<NumberTicker value={totalIncome} decimalPlaces={2} />
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {filteredIncomes.length} รายการ
              </p>
            </div>
            <div className="px-5 py-5 md:px-6">
              <div className="flex items-center justify-between">
                <p className="kicker">รายจ่าย</p>
                <ArrowUpRight className="h-4 w-4 text-destructive" strokeWidth={1.75} />
              </div>
              <p className="num-display mt-2.5 text-xl font-semibold text-destructive md:text-2xl">
                −฿<NumberTicker value={totalExpense} decimalPlaces={2} />
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {filteredExpenses.length} รายการ
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Chart + Top categories */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="card-ledger animate-fade-up lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
            <p className="kicker">แนวโน้ม 6 เดือน</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="h-2 w-2 bg-chart-2" /> รายรับ
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="h-2 w-2 bg-chart-5" /> รายจ่าย
              </span>
            </div>
          </div>
          <div className="h-64 px-3 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--color-border)"
                  strokeDasharray="2 4"
                />
                <XAxis
                  dataKey="month"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  dy={6}
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickFormatter={(v) => (v / 1000).toFixed(0) + "k"}
                />
                <Tooltip
                  formatter={(v: number) => thb(v)}
                  contentStyle={{
                    borderRadius: 2,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--color-muted-foreground)" }}
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  name="รายรับ"
                  stroke="var(--color-chart-2)"
                  strokeWidth={1.75}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="expense"
                  name="รายจ่าย"
                  stroke="var(--color-chart-5)"
                  strokeWidth={1.75}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card-ledger animate-fade-up lg:col-span-2">
          <div className="border-b border-border px-5 py-3.5">
            <p className="kicker">หมวดรายจ่ายสูงสุด</p>
          </div>
          <div className="space-y-4 px-5 py-4">
            {expenseByCat.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
            )}
            {expenseByCat.map((cat, i) => {
              const maxAmount = expenseByCat[0]?.amount ?? 1;
              const pct = Math.round((cat.amount / maxAmount) * 100);
              return (
                <div key={i}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex items-baseline gap-2 font-medium text-foreground">
                      <span className="num-display text-[11px] text-muted-foreground/70">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {cat.name}
                    </span>
                    <span className="num-display text-muted-foreground">{thb(cat.amount)}</span>
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
        </section>
      </div>

      {/* Recent transactions */}
      <section className="card-ledger animate-fade-up">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <p className="kicker">รายการล่าสุด</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => navigate({ to: "/expense" })}
          >
            ดูทั้งหมด
          </Button>
        </div>
        <div className="divide-y divide-border">
          {recent.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {tx.description || (tx.kind === "income" ? "รายรับ" : "รายจ่าย")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(tx.date)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <StatusBadge status={tx.status} />
                <MoneyText value={tx.amount} tone={tx.kind === "income" ? "income" : "expense"} />
              </div>
            </div>
          ))}
          {recent.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">ยังไม่มีรายการ</p>
          )}
        </div>
      </section>
    </PageTransition>
  );
}
