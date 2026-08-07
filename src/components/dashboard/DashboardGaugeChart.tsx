/**
 * DashboardGaugeChart.tsx — Income/Expense trend + annual budget progress
 *
 * Shows 6-month grouped bar chart (income=primary, expense=foreground) using Recharts.
 * Also shows mini stats and annual budget progress bar.
 */

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { MoneyText } from "@/components/shared/MoneyText";
import { cn } from "@/lib/utils";
import { dayjs } from "@/lib/format";
import { calculateGaugeArc } from "@/lib/gauge-utils";

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
}

function buildMonthlyData(
  incomes: Array<{ date: string; amount: number }>,
  expenses: Array<{ date: string; amount: number }>,
): MonthlyData[] {
  const now = dayjs();
  const months: MonthlyData[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = now.subtract(i, "month");
    const label = m.format("MMM");
    const inc = incomes
      .filter((x) => dayjs(x.date).isSame(m, "month"))
      .reduce((s, x) => s + x.amount, 0);
    const exp = expenses
      .filter((x) => dayjs(x.date).isSame(m, "month"))
      .reduce((s, x) => s + x.amount, 0);
    months.push({ month: label, income: inc, expense: exp });
  }
  return months;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">
            {p.name === "income" ? "รายรับ" : "รายจ่าย"}
          </span>
          <span className="font-bold text-foreground num-display ml-auto">
            ฿{(p.value / 1000).toFixed(1)}k
          </span>
        </div>
      ))}
    </div>
  );
}

interface DashboardGaugeChartProps {
  totalBudget?: number;
  usedBudget?: number;
  incomes?: Array<{ date: string; amount: number }>;
  expenses?: Array<{ date: string; amount: number }>;
}

export function DashboardGaugeChart({
  incomes = [],
  expenses = [],
  totalBudget = 2500000,
  usedBudget = 0,
}: DashboardGaugeChartProps) {
  const data = useMemo(() => buildMonthlyData(incomes, expenses), [incomes, expenses]);
  const totalInc = incomes.reduce((s, x) => s + x.amount, 0);
  const totalExp = expenses.reduce((s, x) => s + x.amount, 0);
  const gauge = calculateGaugeArc({ totalBudget, usedBudget });
  const budgetPct = gauge.percentage;
  const maxVal = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1);
  const yMax = Math.ceil(maxVal / 10000) * 10000;

  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-card flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-foreground">รายรับ-รายจ่าย</h3>
        <p className="text-[11.5px] text-muted-foreground mt-0.5">
          ติดตามกระแสเงินสด 6 เดือนล่าสุด
        </p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-foreground">กำไรและขาดทุน</span>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-primary" />
            รายรับ
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-foreground" />
            รายจ่าย
          </span>
        </div>
      </div>

      <div className="h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barSize={10}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={36}
              tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              domain={[0, yMax]}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
            />
            <Bar dataKey="income" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="income" />
            <Bar
              dataKey="expense"
              fill="var(--color-foreground)"
              radius={[4, 4, 0, 0]}
              name="expense"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/40 bg-muted/30 p-3 transition-colors hover:bg-muted/50">
          <p className="text-[10.5px] font-medium text-muted-foreground">รายรับรวม</p>
          <p className="num-display mt-1 text-[17px] font-extrabold text-foreground">
            <MoneyText value={totalInc} />
          </p>
          <p
            className={cn(
              "mt-0.5 text-[10.5px] font-semibold flex items-center gap-0.5",
              totalInc >= totalExp ? "text-success" : "text-destructive",
            )}
          >
            <span>{totalInc >= totalExp ? "▲" : "▼"}</span>
            <span>{totalInc >= totalExp ? "กระแสบวก" : "กระแสลบ"}</span>
          </p>
        </div>
        <div className="rounded-xl border border-border/40 bg-muted/30 p-3 transition-colors hover:bg-muted/50">
          <p className="text-[10.5px] font-medium text-muted-foreground">รายจ่ายรวม</p>
          <p className="num-display mt-1 text-[17px] font-extrabold text-foreground">
            <MoneyText value={totalExp} />
          </p>
          <p
            className={cn(
              "mt-0.5 text-[10.5px] font-semibold",
              totalExp <= totalInc ? "text-success" : "text-destructive",
            )}
          >
            {totalBudget > 0
              ? `${Math.round((usedBudget / totalBudget) * 100)}% ของงบปี`
              : "ตามเป้าหมาย"}
          </p>
        </div>
      </div>

      {totalBudget > 0 && (
        <div className="border-t border-border/50 pt-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground">งบประมาณประจำปี</span>
            <span
              className={cn(
                "font-bold num-display",
                budgetPct > 80
                  ? "text-destructive"
                  : budgetPct > 60
                    ? "text-warning"
                    : "text-primary",
              )}
            >
              {budgetPct}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/80 p-0.5 border border-border/30">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                budgetPct > 80 ? "bg-destructive" : "bg-primary",
              )}
              style={{ width: `${Math.min(budgetPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10.5px] text-muted-foreground">
            <span>
              ใช้ไป{" "}
              <span className="num-display font-semibold text-foreground">
                <MoneyText value={usedBudget} />
              </span>
            </span>
            <span>
              จาก{" "}
              <span className="num-display font-semibold text-foreground">
                <MoneyText value={totalBudget} />
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
