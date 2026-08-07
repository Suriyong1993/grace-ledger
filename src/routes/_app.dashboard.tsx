/**
 * /dashboard — Main Financial Dashboard
 *
 * - Header: greeting, date, refresh, quick record income/expense actions
 * - KPI row: total balance / income / expense / offering (StatCard)
 * - Left: Funds grid, search + period filter, recent transactions table
 * - Right: Pending approvals preview, budget + income/expense trend
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect } from "react";
import {
  RefreshCw,
  Search,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  HandHeart,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { useRealtime } from "@/hooks/useRealtime";
import { useAuth } from "@/lib/auth";

// Dashboard Components
import { FundsGrid } from "@/components/dashboard/FundsGrid";
import {
  RecentTransactionsTable,
  type TransactionRow,
} from "@/components/dashboard/RecentTransactionsTable";
import { DashboardGaugeChart } from "@/components/dashboard/DashboardGaugeChart";
import { PendingApprovalsCard } from "@/components/dashboard/PendingApprovalsCard";

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
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("month");
  const [selectedTx, setSelectedTx] = useState<TransactionRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const incomeQ = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const expenseQ = useQuery({ queryKey: ["expense"], queryFn: listExpense });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const fundsQ = useQuery({ queryKey: ["funds"], queryFn: listFunds });
  const offQ = useQuery({ queryKey: ["offering"], queryFn: listOffering });
  const budgetQ = useQuery({ queryKey: ["budget"], queryFn: listBudget });

  const queries = [incomeQ, expenseQ, catsQ, fundsQ, offQ, budgetQ];
  const isInitialLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const refetchAll = () => queries.forEach((q) => q.refetch());

  // Real-time: fetch churchId then subscribe to table changes
  const qc = useQueryClient();
  const [churchId, setChurchId] = useState("");

  useEffect(() => {
    getChurchId()
      .then(setChurchId)
      .catch(() => {});
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
      .map((i) => ({
        id: i.id,
        kind: "income" as const,
        description: i.description || "รายรับ",
        amount: i.amount,
        meta: `${categories.find((c) => c.id === i.categoryId)?.name || "รายรับ"} · ${fmtDate(i.date)}`,
        date: i.date,
      }));
    const pExp = expenses
      .filter((e) => e.status === "pending")
      .map((e) => ({
        id: e.id,
        kind: "expense" as const,
        description: e.description || "รายจ่าย",
        amount: e.amount,
        meta: `${categories.find((c) => c.id === e.categoryId)?.name || "รายจ่าย"} · ${fmtDate(e.date)}`,
        date: e.date,
      }));
    return [...pInc, ...pExp].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [incomes, expenses, categories]);
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

  // Greeting — time-of-day
  const hour = now.hour();
  const greeting = hour < 12 ? "สวัสดีตอนเช้า" : hour < 17 ? "สวัสดีตอนบ่าย" : "สวัสดีตอนเย็น";
  const userName = user?.name || user?.email?.split("@")[0] || "";

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={`ภาพรวมการเงิน · ${now.format("MMMM BBBB")}`}
        title={`${greeting}${userName ? `, ${userName}` : ""}`}
        description={`ภาพรวมการเงินคริสตจักร — ${now.format("dddd D MMMM BBBB")}`}
        actions={
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={refetchAll}
              aria-label="รีเฟรชข้อมูล"
              className="h-9 w-9 text-muted-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/expense">
                <Plus className="h-3.5 w-3.5" />
                บันทึกรายจ่าย
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/income">
                <Plus className="h-3.5 w-3.5" />
                บันทึกรายรับ
              </Link>
            </Button>
          </>
        }
      />

      {/* ── Error banner ── */}
      {isError && (
        <div className="flex items-center justify-between gap-4 rounded-card border border-destructive/30 bg-destructive/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">
              โหลดข้อมูลแดชบอร์ดไม่สำเร็จ — ตัวเลขที่แสดงอาจไม่ครบถ้วน
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={refetchAll}
            className="shrink-0 gap-1 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            ลองใหม่
          </Button>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {isInitialLoading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-card" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-5">
              <Skeleton className="h-[180px] rounded-card" />
              <Skeleton className="h-[360px] rounded-card" />
            </div>
            <div className="space-y-5">
              <Skeleton className="h-[220px] rounded-card" />
              <Skeleton className="h-[320px] rounded-card" />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="ยอดคงเหลือรวม"
              value={totalBalanceNumber}
              hint={`${funds.length} กองทุน`}
              icon={Wallet}
              tone="primary"
            />
            <StatCard
              label="รายรับเดือนนี้"
              value={incomeMonth}
              hint="เดือนปัจจุบัน"
              icon={ArrowDownCircle}
              tone="success"
            />
            <StatCard
              label="รายจ่ายเดือนนี้"
              value={expenseMonth}
              hint={
                annualBudget.total > 0
                  ? `งบใช้ไป ${Math.round((annualBudget.used / annualBudget.total) * 100)}% ของปี`
                  : "เดือนปัจจุบัน"
              }
              icon={ArrowUpCircle}
              tone="secondary"
            />
            <StatCard
              label="เงินถวายรวม"
              value={offeringTotal}
              hint="ยอดรวมทุกช่องทาง"
              icon={HandHeart}
              tone="warning"
            />
          </div>

          {/* ── 2-column body ── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px] items-start">
            {/* LEFT: Funds, search + period, transactions */}
            <div className="space-y-5">
              <FundsGrid funds={funds} />

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาในรายการล่าสุด..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-0.5 rounded-lg bg-muted/60 p-1">
                  {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                    <Button
                      key={p}
                      variant="ghost"
                      size="sm"
                      onClick={() => setPeriod(p)}
                      className={cn(
                        "h-auto rounded-md px-2.5 py-1 text-[11px] font-medium",
                        period === p
                          ? "bg-foreground text-background hover:bg-foreground/90"
                          : "text-muted-foreground hover:text-foreground hover:bg-card",
                      )}
                    >
                      {PERIOD_LABELS[p]}
                    </Button>
                  ))}
                </div>
              </div>

              <RecentTransactionsTable
                transactions={filteredTxs}
                onSelectTx={(tx) => setSelectedTx(tx)}
              />
            </div>

            {/* RIGHT: Pending approvals, budget + trend */}
            <div className="space-y-5">
              <PendingApprovalsCard items={pendingItems} count={pendingCount} />
              <DashboardGaugeChart
                totalBudget={annualBudget.total > 0 ? annualBudget.total : 2500000}
                usedBudget={annualBudget.total > 0 ? annualBudget.used : 0}
                incomes={incomes.map((i) => ({ date: i.date, amount: i.amount }))}
                expenses={expenses.map((e) => ({ date: e.date, amount: e.amount }))}
              />
            </div>
          </div>
        </>
      )}

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
