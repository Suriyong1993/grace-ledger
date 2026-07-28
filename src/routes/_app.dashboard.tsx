import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  TrendingUp,
  Receipt,
  FileText,
  X,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Filter,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { listIncome, listExpense, listCategories, listFunds } from "@/services/church";
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

export function Dashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("month");
  const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null);
  const [txFilter, setTxFilter] = useState<"all" | "income" | "expense" | "pending">("all");

  const incomeQ = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const expenseQ = useQuery({ queryKey: ["expense"], queryFn: listExpense });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const fundsQ = useQuery({ queryKey: ["funds"], queryFn: listFunds });

  const hasError = incomeQ.isError || expenseQ.isError;
  if (hasError && !incomeQ.data && !expenseQ.data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="card-ledger max-w-md px-6 py-6 text-center shadow-craft">
          <p className="font-display text-base font-semibold text-foreground">
            ไม่สามารถโหลดข้อมูลการเงินได้
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {(incomeQ.error as Error)?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 active-press"
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

  const isLoading = incomeQ.isLoading || expenseQ.isLoading;
  const incomes = incomeQ.data ?? [];
  const expenses = expenseQ.data ?? [];
  const categories = catsQ.data ?? [];
  const funds = fundsQ.data ?? [];

  // Filter logic
  const now = dayjs();
  const filterByPeriod = (dateStr: string) => {
    const d = dayjs(dateStr);
    if (period === "today") return d.isSame(now, "day");
    if (period === "week") return d.isAfter(now.subtract(7, "day"));
    if (period === "quarter") return d.isAfter(now.subtract(3, "month"));
    return d.isSame(now, "month");
  };

  const filteredIncomes = incomes.filter((i) => filterByPeriod(i.date));
  const filteredExpenses = expenses.filter((e) => filterByPeriod(e.date));

  const totalIncome = filteredIncomes.reduce((s, x) => s + x.amount, 0);
  const totalExpense = filteredExpenses.reduce((s, x) => s + x.amount, 0);
  const balance = totalIncome - totalExpense;

  // Pending approvals
  const pendingExpenses = expenses.filter((e) => e.status === "pending");

  // Trend (6 months area chart)
  const monthly = Array.from({ length: 6 }).map((_, i) => {
    const d = now.subtract(5 - i, "month");
    const key = d.format("YYYY-MM");
    const inc = incomes.filter((x) => x.date.startsWith(key)).reduce((s, x) => s + x.amount, 0);
    const exp = expenses.filter((x) => x.date.startsWith(key)).reduce((s, x) => s + x.amount, 0);
    return {
      month: d.format("MMM YY"),
      income: inc,
      expense: exp,
      net: inc - exp,
    };
  });

  // Category breakdown
  const catName = (id?: string) => categories.find((c) => c.id === id)?.name ?? "หมวดทั่วไป";
  const fundName = (id?: string) => funds.find((f) => f.id === id)?.name ?? "กองทุนทั่วไป";

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

  // Combined transactions
  const allTx: TransactionItem[] = [
    ...filteredIncomes.map((i) => ({ ...i, kind: "income" as const })),
    ...filteredExpenses.map((e) => ({ ...e, kind: "expense" as const })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const displayTx = allTx.filter((t) => {
    if (txFilter === "income") return t.kind === "income";
    if (txFilter === "expense") return t.kind === "expense";
    if (txFilter === "pending") return t.status === "pending";
    return true;
  }).slice(0, 12);

  return (
    <PageTransition className="space-y-6 md:space-y-8">
      {/* Page Header */}
      <PageHeader
        kicker="Financial Command Center"
        title="ศูนย์ควบคุมการเงิน"
        description="สรุปกระแสเงินสด สถานะงบประมาณ และรายการที่ต้องอนุมัติเรียลไทม์"
        actions={
          <div className="flex items-center gap-2">
            {/* Period Segmented Control */}
            <div className="flex rounded-md border border-border bg-muted/40 p-0.5">
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "h-7 rounded-sm px-2.5 text-xs font-medium transition-all duration-150 active-press cursor-pointer",
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

      {/* Operational Attention Engine Banner */}
      {pendingExpenses.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-xs animate-fade-up">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-warning shrink-0" />
            <span className="font-medium text-foreground">
              มีรายการเบิกจ่ายรออนุมัติ <span className="font-bold text-warning">{pendingExpenses.length} รายการ</span> รวมเป็นเงิน{" "}
              <span className="num-display font-semibold">฿{pendingExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString("th-TH")}</span>
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-warning/40 text-foreground hover:bg-warning/20 active-press cursor-pointer"
            onClick={() => {
              setTxFilter("pending");
            }}
          >
            <span>ตรวจสอบและอนุมัติทันที</span>
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      )}

      {/* Executive Stat Strip */}
      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-md" />
      ) : (
        <section className="card-ledger rounded-md shadow-craft divide-y divide-border md:divide-y-0 md:divide-x grid grid-cols-1 md:grid-cols-4">
          {/* Net Balance */}
          <div className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="kicker">ยอดคงเหลือสุทธิ · {PERIOD_LABELS[period]}</span>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <p
                className={cn(
                  "num-display font-display mt-2 text-3xl md:text-3xl font-semibold tracking-tight",
                  balance >= 0 ? "text-foreground" : "text-destructive",
                )}
              >
                ฿<NumberTicker value={Math.abs(balance)} decimalPlaces={2} />
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2">
              <span>กระแสเงินสุทธิ</span>
              <span className={cn("font-medium num-display", balance >= 0 ? "text-success" : "text-destructive")}>
                {balance >= 0 ? "+฿" : "-฿"}{Math.abs(balance).toLocaleString("th-TH")}
              </span>
            </div>
          </div>

          {/* Income Flow */}
          <div className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="kicker">รายรับรวม</span>
                <ArrowDownLeft className="h-4 w-4 text-success" />
              </div>
              <p className="num-display font-display mt-2 text-2xl font-semibold text-success">
                +฿<NumberTicker value={totalIncome} decimalPlaces={2} />
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2">
              <span>จำนวนรายการ</span>
              <span className="font-medium text-foreground num-display">{filteredIncomes.length} รายการ</span>
            </div>
          </div>

          {/* Expense Velocity */}
          <div className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="kicker">รายจ่ายรวม</span>
                <ArrowUpRight className="h-4 w-4 text-destructive" />
              </div>
              <p className="num-display font-display mt-2 text-2xl font-semibold text-destructive">
                −฿<NumberTicker value={totalExpense} decimalPlaces={2} />
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2">
              <span>จำนวนรายการ</span>
              <span className="font-medium text-foreground num-display">{filteredExpenses.length} รายการ</span>
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="p-5 flex flex-col justify-between bg-muted/20">
            <div>
              <div className="flex items-center justify-between">
                <span className="kicker">รออนุมัติจ่าย</span>
                <Clock className="h-4 w-4 text-warning" />
              </div>
              <p className="num-display font-display mt-2 text-2xl font-semibold text-warning">
                {pendingExpenses.length} <span className="text-xs font-normal text-muted-foreground">รายการ</span>
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs border-t border-border/40 pt-2">
              <span className="text-muted-foreground">มูลค่ารวม</span>
              <span className="font-medium text-warning num-display">
                ฿{pendingExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString("th-TH")}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Trend Area Chart (6 Months) */}
        <section className="card-ledger rounded-md shadow-craft lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
            <div>
              <p className="kicker">แนวโน้มกระแสเงินสด 6 เดือน</p>
              <p className="text-xs text-muted-foreground mt-0.5">การเปรียบเทียบรายรับและรายจ่ายสะสม</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" /> รายรับ
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-destructive" /> รายจ่าย
              </span>
            </div>
          </div>

          <div className="h-72 px-4 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-destructive)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-destructive)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
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
                  width={45}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                />
                <Tooltip
                  formatter={(v: number) => [thb(v)]}
                  contentStyle={{
                    borderRadius: "4px",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                    fontSize: "12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  }}
                  labelStyle={{ color: "var(--color-foreground)", fontWeight: 600, marginBottom: "4px" }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="รายรับ"
                  stroke="var(--color-success)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#incomeGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="รายจ่าย"
                  stroke="var(--color-destructive)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#expenseGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Top Expense Categories */}
        <section className="card-ledger rounded-md shadow-craft lg:col-span-2 flex flex-col">
          <div className="border-b border-border px-5 py-3.5">
            <p className="kicker">หมวดหมู่รายจ่ายสูงสุด</p>
            <p className="text-xs text-muted-foreground mt-0.5">การกระจายตัวของค่าใช้จ่ายสัดส่วนสูงสุด</p>
          </div>

          <div className="p-5 space-y-4 flex-1">
            {expenseByCat.length === 0 ? (
              <div className="flex h-44 flex-col items-center justify-center text-center text-xs text-muted-foreground">
                <Receipt className="h-8 w-8 stroke-1 text-muted-foreground/50 mb-2" />
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
                        <span className="num-display text-[10px] text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded-xs">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>{cat.name}</span>
                      </span>
                      <span className="num-display font-medium text-foreground">{thb(cat.amount)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full bg-primary transition-all duration-500 rounded-full group-hover:brightness-110"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Unified Live Activity Stream & Inspector */}
      <section className="card-ledger rounded-md shadow-craft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-3">
            <p className="kicker">กระแสรายการล่าสุด</p>
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 rounded-sm border border-border bg-muted/30 p-0.5 text-xs">
              {(
                [
                  { id: "all", label: "ทั้งหมด" },
                  { id: "income", label: "รายรับ" },
                  { id: "expense", label: "รายจ่าย" },
                  { id: "pending", label: "รออนุมัติ" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTxFilter(tab.id)}
                  className={cn(
                    "px-2 py-0.5 rounded-xs font-medium transition-colors cursor-pointer",
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
            className="h-7 text-xs gap-1 cursor-pointer active-press"
            onClick={() => navigate({ to: "/expense" })}
          >
            <span>ดูทั้งหมดในสมุดบัญชี</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Transaction Table */}
        <div className="divide-y divide-border/60">
          {displayTx.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              ไม่พบรายการตรงกับเงื่อนไขที่เลือก
            </div>
          ) : (
            displayTx.map((tx) => (
              <div
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-muted/40 cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-sm text-xs font-semibold",
                      tx.kind === "income"
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {tx.kind === "income" ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {tx.description || tx.vendor || (tx.kind === "income" ? "รายรับทั่วไป" : "รายจ่ายทั่วไป")}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>{fmtDate(tx.date)}</span>
                      <span>•</span>
                      <span>{catName(tx.categoryId)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <StatusBadge status={tx.status || "approved"} />
                  <MoneyText
                    value={tx.amount}
                    tone={tx.kind === "income" ? "income" : "expense"}
                    className="text-sm font-semibold num-display"
                  />
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Slide-over Transaction Inspector Drawer */}
      <Sheet open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-6 border-b border-border text-left">
            <div className="flex items-center justify-between">
              <span className="kicker">รายละเอียดรายการ</span>
              <StatusBadge status={selectedTx?.status || "approved"} />
            </div>
            <SheetTitle className="text-xl font-semibold font-display mt-2">
              {selectedTx?.description || selectedTx?.vendor || "รายการบัญชี"}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              รหัสรายการ: {selectedTx?.id}
            </SheetDescription>
          </SheetHeader>

          {selectedTx && (
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {/* Amount Display Card */}
              <div className="card-ledger p-4 rounded-md text-center bg-muted/20">
                <span className="kicker">จำนวนเงิน</span>
                <p
                  className={cn(
                    "num-display font-display text-3xl font-bold mt-1",
                    selectedTx.kind === "income" ? "text-success" : "text-destructive",
                  )}
                >
                  {selectedTx.kind === "income" ? "+" : "−"}฿{selectedTx.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </p>
              </div>

              {/* Data Grid */}
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">ประเภทรายการ</span>
                  <span className="font-medium text-foreground uppercase">{selectedTx.kind}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">วันที่ทำรายการ</span>
                  <span className="font-medium text-foreground">{fmtDate(selectedTx.date)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">หมวดหมู่</span>
                  <span className="font-medium text-foreground">{catName(selectedTx.categoryId)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">กองทุน</span>
                  <span className="font-medium text-foreground">{fundName(selectedTx.fundId)}</span>
                </div>
                {selectedTx.vendor && (
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">ร้านค้า / ผู้รับเงิน</span>
                    <span className="font-medium text-foreground">{selectedTx.vendor}</span>
                  </div>
                )}
              </div>

              {/* Actions & Verification */}
              <div className="pt-4 border-t border-border space-y-2">
                <Button
                  className="w-full h-9 gap-1.5 active-press cursor-pointer"
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
