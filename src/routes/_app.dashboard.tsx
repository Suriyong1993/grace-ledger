import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Wallet, Plus, RefreshCw } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { MoneyText } from "@/components/shared/MoneyText";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { listIncome, listExpense, listCategories } from "@/services/church";
import { thb, fmtDate, dayjs } from "@/lib/format";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "แดชบอร์ด — ระบบจัดการการเงิน" }] }),
  component: Dashboard,
});

type Period = "today" | "week" | "month";

function Dashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("month");

  const incomeQ = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const expenseQ = useQuery({ queryKey: ["expense"], queryFn: listExpense });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: listCategories });

  const hasError = incomeQ.isError || expenseQ.isError;
  if (hasError && !incomeQ.data && !expenseQ.data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>ไม่สามารถโหลดข้อมูลได้</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
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
              <RefreshCw className="h-4 w-4 mr-2" /> ลองใหม่
            </Button>
          </CardContent>
        </Card>
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

  const PERIOD_LABELS: Record<Period, string> = {
    today: "วันนี้",
    week: "สัปดาห์นี้",
    month: "เดือนนี้",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="แดชบอร์ด"
        description="ภาพรวมการเงิน"
        actions={
          <Button onClick={() => navigate({ to: "/expense" })}>
            <Plus className="h-4 w-4 mr-2" /> บันทึกรายการ
          </Button>
        }
      />

      {/* Period toggle */}
      <div className="flex gap-px border border-border bg-border w-fit">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium transition-colors",
              period === p
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* 3 Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border border border-border">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 bg-card" />)
        ) : (
          <>
            <StatCard
              label="รายรับ"
              value={thb(totalIncome)}
              icon={ArrowDownCircle}
              tone="success"
              hint={PERIOD_LABELS[period]}
            />
            <StatCard
              label="รายจ่าย"
              value={thb(totalExpense)}
              icon={ArrowUpCircle}
              tone="danger"
              hint={PERIOD_LABELS[period]}
            />
            <StatCard
              label="คงเหลือ"
              value={thb(balance)}
              icon={Wallet}
              tone={balance >= 0 ? "primary" : "danger"}
              hint={PERIOD_LABELS[period]}
            />
          </>
        )}
      </div>

      {/* Charts + Top Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">แนวโน้มรายรับ / รายจ่าย 6 เดือน</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tickFormatter={(v) => (v / 1000).toFixed(0) + "k"}
                />
                <Tooltip
                  formatter={(v: number) => thb(v)}
                  contentStyle={{ borderRadius: 2, border: "1px solid var(--color-border)" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="income"
                  name="รายรับ"
                  stroke="#22C55E"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="expense"
                  name="รายจ่าย"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">หมวดหมู่รายจ่ายสูงสุด</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {expenseByCat.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
            )}
            {expenseByCat.map((cat, i) => {
              const maxAmount = expenseByCat[0]?.amount ?? 1;
              const pct = Math.round((cat.amount / maxAmount) * 100);
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{cat.name}</span>
                    <span className="text-muted-foreground">{thb(cat.amount)}</span>
                  </div>
                  <div className="h-1.5 bg-muted overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full bg-primary transition-all duration-300"
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">รายการล่าสุด</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/expense" })}>
            ดูทั้งหมด
          </Button>
        </CardHeader>
        <CardContent className="divide-y">
          {recent.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {tx.description || (tx.kind === "income" ? "รายรับ" : "รายจ่าย")}
                </p>
                <p className="text-xs text-muted-foreground">{fmtDate(tx.date)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={tx.status} />
                <MoneyText value={tx.amount} tone={tx.kind === "income" ? "income" : "expense"} />
              </div>
            </div>
          ))}
          {recent.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีรายการ</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
