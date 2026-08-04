/**
 * /dashboard — Main Financial Dashboard
 *
 * - Center: Page header, search, KPI row, Funds grid, Recent transactions
 * - Right column: Pending approvals preview, Budget gauge + category
 *   breakdown + AI insight
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  RefreshCw,
  Search,
  ArrowDownCircle,
  ArrowUpCircle,
  HandHeart,
  Clock,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  listBudget,
  getChurchId,
} from "@/services/church";
import { Money } from "@/lib/money";
import { fmtDate, dayjs } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MoneyText } from "@/components/shared/MoneyText";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { useRealtime } from "@/hooks/useRealtime";

// Dashboard Components
import { FundsGrid } from "@/components/dashboard/FundsGrid";
import {
  RecentTransactionsTable,
  type TransactionRow,
} from "@/components/dashboard/RecentTransactionsTable";
import { DashboardGaugeChart } from "@/components/dashboard/DashboardGaugeChart";

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

/** Filter a date string by the selected period */
function byPeriod(dateStr: string, period: Period, now: dayjs.Dayjs) {
  const d = dayjs(dateStr);
  if (period === "today") return d.isSame(now, "day");
  if (period === "week") return d.isAfter(now.subtract(7, "day"));
  if (period === "quarter") return d.isAfter(now.subtract(3, "month"));
  return d.isSame(now, "month");
}

export function Dashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("month");
  const [selectedTx, setSelectedTx] = useState<TransactionRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const incomeQ = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const expenseQ = useQuery({ queryKey: ["expense"], queryFn: listExpense });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const fundsQ = useQuery({ queryKey: ["funds"], queryFn: listFunds });
  const offQ = useQuery({ queryKey: ["offering"], queryFn: listOffering });
  const budgetQ = useQuery({ queryKey: ["budget"], queryFn: listBudget });

  // Real-time: fetch churchId then subscribe to table changes
  const qc = useQueryClient();
  const [churchId, setChurchId] = useState("");

  useEffect(() => {
    getChurchId()
      .then(setChurchId)
      .catch(() => { });
  }, []);

  // When incomes table changes (INSERT/UPDATE/DELETE), refetch income query
  useRealtime("dashboard-income-rt", "incomes", churchId, () => {
    qc.invalidateQueries({ queryKey: ["income"] });
  });
  // When expenses table changes, refetch expense query
  useRealtime("dashboard-expense-rt", "expenses", churchId, () => {
    qc.invalidateQueries({ queryKey: ["expense"] });
  });
  // When offerings table changes, refetch offering query
  useRealtime("dashboard-offering-rt", "offerings", churchId, () => {
    qc.invalidateQueries({ queryKey: ["offering"] });
  });

  const nowRef = useRef(dayjs());
  const now = nowRef.current;

  const incomes = useMemo(() => incomeQ.data ?? [], [incomeQ.data]);
  const expenses = useMemo(() => expenseQ.data ?? [], [expenseQ.data]);
  const categories = useMemo(() => catsQ.data ?? [], [catsQ.data]);
  const funds = useMemo(() => fundsQ.data ?? [], [fundsQ.data]);
  const offerings = useMemo(() => offQ.data ?? [], [offQ.data]);

  // Total Cash Balance across funds
  const totalBalanceNumber = useMemo(() => {
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
    return total.toNumber();
  }, [funds, incomes, expenses, offerings]);

  // Pending items — count and a small preview list for the right column
  const pendingItems = useMemo(() => {
    const pInc = incomes
      .filter((i) => i.status === "pending")
      .map((i) => ({ ...i, kind: "income" as const }));
    const pExp = expenses
      .filter((e) => e.status === "pending")
      .map((e) => ({ ...e, kind: "expense" as const }));
    return [...pInc, ...pExp].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [incomes, expenses]);
  const pendingCount = pendingItems.length;

  // Latest Sunday offering total
  const offeringTotal = useMemo(() => {
    return offerings.reduce((sum, o) => sum + o.amount, 0);
  }, [offerings]);

  // This month's income/expense totals — for the KPI row
  const incomeMonth = useMemo(
    () =>
      incomes.filter((i) => dayjs(i.date).isSame(now, "month")).reduce((s, i) => s + i.amount, 0),
    [incomes, now],
  );
  const expenseMonth = useMemo(
    () =>
      expenses.filter((e) => dayjs(e.date).isSame(now, "month")).reduce((s, e) => s + e.amount, 0),
    [expenses, now],
  );

  // Annual budget from API (replaces hardcoded 2,500,000)
  const budgets = useMemo(() => budgetQ.data ?? [], [budgetQ.data]);
  const annualBudget = useMemo(() => {
    const currentYear = dayjs().year();
    const yearBudgets = budgets.filter((b) => b.year === currentYear);
    const totalAmount = yearBudgets.reduce((s, b) => s + b.amount, 0);
    const totalUsed = yearBudgets.reduce((s, b) => s + b.used, 0);
    return { total: totalAmount, used: totalUsed };
  }, [budgets]);

  // Combined transactions for table
  const recentTransactions: TransactionRow[] = useMemo(() => {
    const combined: TransactionRow[] = [];

    incomes.forEach((i) => {
      const cat = categories.find((c) => c.id === i.categoryId);
      combined.push({
        id: i.id,
        kind: "income",
        date: i.date,
        amount: i.amount,
        description: i.description,
        categoryName: cat?.name || "รายรับ",
        status: i.status || "approved",
        createdBy: i.createdBy,
      });
    });

    expenses.forEach((e) => {
      const cat = categories.find((c) => c.id === e.categoryId);
      combined.push({
        id: e.id,
        kind: "expense",
        date: e.date,
        amount: e.amount,
        description: e.description,
        categoryName: cat?.name || "รายจ่าย",
        vendor: e.vendor,
        status: e.status || "approved",
        createdBy: e.createdBy,
      });
    });

    return combined.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [incomes, expenses, categories]);

  // Filtered transactions by search query AND selected period
  const filteredTxs = useMemo(() => {
    let result = recentTransactions;

    // Filter by period (today / week / month / quarter)
    result = result.filter((t) => byPeriod(t.date, period, now));

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.description?.toLowerCase().includes(q) ||
          t.categoryName?.toLowerCase().includes(q) ||
          t.vendor?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [recentTransactions, searchQuery, period, now]);

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <PageHeader
        kicker="ภาพรวมการเงิน"
        title="แดชบอร์ดคริสตจักร"
        description="ระบบบริหารจัดการการเงินและตรวจสอบบัญชี"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                incomeQ.refetch();
                expenseQ.refetch();
                offQ.refetch();
              }}
              className="gap-1 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              รีเฟรช
            </Button>
            <Button
              size="sm"
              onClick={() => navigate({ to: "/income" })}
              className="gap-1 text-xs active-press"
            >
              <Plus className="h-3.5 w-3.5" />
              บันทึกรายรับ
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate({ to: "/expense" })}
              className="gap-1 text-xs active-press"
            >
              <Plus className="h-3.5 w-3.5" />
              บันทึกรายจ่าย
            </Button>
          </div>
        }
      />

      {/* Search Bar inspired by MyCloud UI */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ค้นหารายการการเงิน, หมวดหมู่, หรือผู้ขาย..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-card border-border/80 focus:border-primary text-sm shadow-sm"
        />
      </div>

      {/* KPI row — cash balance hero + this month's income/expense + latest offering */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="rounded-card border border-border bg-card p-5"
        >
          <p className="text-[13px] font-medium text-muted-foreground">เงินสดคงเหลือรวม</p>
          <p className="num-display font-display mt-2 text-[28px] font-semibold leading-none tracking-tight md:text-[32px]">
            <MoneyText value={totalBalanceNumber} />
          </p>
          <p className="mt-3 text-xs text-muted-foreground">{funds.length} กองทุน</p>
        </motion.div>
        <StatCard
          label="รายรับเดือนนี้"
          value={incomeMonth}
          icon={ArrowDownCircle}
          tone="success"
          hint="เทียบเดือนก่อน"
        />
        <StatCard
          label="รายจ่ายเดือนนี้"
          value={expenseMonth}
          icon={ArrowUpCircle}
          tone="danger"
          hint={
            annualBudget.total > 0
              ? `งบใช้ไป ${Math.round((annualBudget.used / annualBudget.total) * 100)}% ของปี`
              : undefined
          }
        />
        <StatCard
          label="เงินถวายล่าสุด"
          value={offeringTotal}
          icon={HandHeart}
          tone="warning"
          hint="ยอดรวมทุกช่องทาง"
        />
      </div>

      {/* Main 3-Column Layout Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Left 2-Columns: Operations & Transactions */}
        <div className="xl:col-span-2 space-y-6">
          {/* Church Funds Grid */}
          <FundsGrid funds={funds} />

          {/* Recent Transactions Table */}
          <RecentTransactionsTable
            transactions={filteredTxs}
            onSelectTx={(tx) => setSelectedTx(tx)}
          />
        </div>

        {/* Right 1-Column: Approvals, Gauge Chart & Financial Analytics */}
        <div className="xl:col-span-1 space-y-6">
          {/* Pending Approvals preview */}
          <div className="card-ledger p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">รอการอนุมัติ</p>
              {pendingCount > 0 && (
                <span className="num-display rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
                  {pendingCount} รายการ
                </span>
              )}
            </div>
            {pendingItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Clock className="h-5 w-5 text-muted-foreground/40" strokeWidth={1.5} />
                <p className="text-xs text-muted-foreground">ไม่มีรายการค้างอนุมัติ</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {pendingItems.slice(0, 3).map((t) => (
                  <div key={t.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-semibold leading-snug text-foreground">
                        {t.description || "รายการ"}
                      </p>
                      <p
                        className={cn(
                          "num-display shrink-0 text-xs font-bold",
                          t.kind === "income" ? "amount-income" : "amount-expense",
                        )}
                      >
                        <MoneyText value={t.amount} />
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{fmtDate(t.date)}</p>
                  </div>
                ))}
              </div>
            )}
            <Button asChild variant="outline" className="mt-3 w-full">
              <Link to="/approvals">
                ไปที่คิวอนุมัติ
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <DashboardGaugeChart
            totalBudget={annualBudget.total > 0 ? annualBudget.total : 2500000}
            usedBudget={annualBudget.total > 0 ? annualBudget.used : 0}
          />
        </div>
      </div>

      {/* Transaction Detail Drawer */}
      <Sheet open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedTx?.kind === "income" ? "รายรับ" : "รายจ่าย"}
            </SheetTitle>
            <SheetDescription>รายละเอียดรายการการเงิน</SheetDescription>
          </SheetHeader>

          {selectedTx && (
            <div className="mt-6 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-muted/30">
                <p className="kicker">จำนวนเงิน</p>
                <p
                  className={
                    selectedTx.kind === "income"
                      ? "amount-income text-2xl font-bold num-display"
                      : "amount-expense text-2xl font-bold num-display"
                  }
                >
                  <MoneyText value={selectedTx.amount} />
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">วันที่</span>
                  <span className="font-medium">{fmtDate(selectedTx.date)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">หมวดหมู่</span>
                  <span className="font-medium">{selectedTx.categoryName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">สถานะ</span>
                  <StatusBadge status={selectedTx.status} />
                </div>
                {selectedTx.vendor && (
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">ผู้รับเงิน / ร้านค้า</span>
                    <span className="font-medium">{selectedTx.vendor}</span>
                  </div>
                )}
                {selectedTx.createdBy && (
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">บันทึกโดย</span>
                    <span className="font-medium">{selectedTx.createdBy}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
