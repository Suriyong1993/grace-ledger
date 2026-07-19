import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  HandHeart,
  Wallet,
  PiggyBank,
  Briefcase,
  ClipboardCheck,
  CalendarClock,
  Plus,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { MoneyText } from "@/components/shared/MoneyText";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  listIncome, listExpense, listOffering, listFunds, listBudget, listProjects,
} from "@/services/church";
import { thb, fmtDate, dayjs } from "@/lib/format";
import { OFFERING_LABEL } from "@/lib/types";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "แดชบอร์ด — ระบบจัดการการเงินคริสตจักร" }] }),
  component: Dashboard,
});

const CHART_COLORS = ["#F97316", "#F59E0B", "#EAB308", "#22C55E", "#EF4444", "#0EA5E9", "#A855F7"];

function Dashboard() {
  const navigate = useNavigate();
  const incomeQ = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const expenseQ = useQuery({ queryKey: ["expense"], queryFn: listExpense });
  const offeringQ = useQuery({ queryKey: ["offering"], queryFn: listOffering });
  const fundsQ = useQuery({ queryKey: ["funds"], queryFn: listFunds });
  const budgetQ = useQuery({ queryKey: ["budget"], queryFn: listBudget });
  const projectsQ = useQuery({ queryKey: ["projects"], queryFn: listProjects });

  const isLoading = incomeQ.isLoading || expenseQ.isLoading || offeringQ.isLoading;

  const incomes = incomeQ.data ?? [];
  const expenses = expenseQ.data ?? [];
  const offerings = offeringQ.data ?? [];
  const funds = fundsQ.data ?? [];
  const budgets = budgetQ.data ?? [];
  const projects = projectsQ.data ?? [];

  const totalIncome = incomes.reduce((s, x) => s + x.amount, 0);
  const totalExpense = expenses.reduce((s, x) => s + x.amount, 0);
  const totalOffering = offerings.reduce((s, x) => s + x.amount, 0);
  const openingSum = funds.reduce((s, f) => s + f.openingBalance, 0);
  const cashBalance = openingSum + totalIncome + totalOffering - totalExpense;
  const todayStr = dayjs().format("YYYY-MM-DD");
  const todayOffering = offerings.filter((o) => o.date === todayStr).reduce((s, x) => s + x.amount, 0);
  const thisMonth = dayjs().format("YYYY-MM");
  const monthlyOffering = offerings.filter((o) => o.date.startsWith(thisMonth)).reduce((s, x) => s + x.amount, 0);
  const annualBudget = budgets.find((b) => b.period === "annual");
  const projectBudget = projects.reduce((s, p) => s + p.budget, 0);
  const pendingApprovals =
    incomes.filter((i) => i.status === "pending").length +
    expenses.filter((e) => e.status === "pending").length;

  // Monthly comparison chart
  const monthly = Array.from({ length: 6 }).map((_, i) => {
    const d = dayjs().subtract(5 - i, "month");
    const key = d.format("YYYY-MM");
    return {
      month: d.format("MMM"),
      income: incomes.filter((x) => x.date.startsWith(key)).reduce((s, x) => s + x.amount, 0),
      expense: expenses.filter((x) => x.date.startsWith(key)).reduce((s, x) => s + x.amount, 0),
      offering: offerings.filter((x) => x.date.startsWith(key)).reduce((s, x) => s + x.amount, 0),
    };
  });

  // Fund distribution
  const fundDist = funds.map((f) => ({
    name: f.name,
    value: f.openingBalance
      + incomes.filter((i) => i.fundId === f.id).reduce((s, x) => s + x.amount, 0)
      + offerings.filter((o) => o.fundId === f.id).reduce((s, x) => s + x.amount, 0)
      - expenses.filter((e) => e.fundId === f.id).reduce((s, x) => s + x.amount, 0),
  }));

  // Offering by type
  const offeringByType = Object.entries(OFFERING_LABEL).map(([k, v]) => ({
    name: v,
    value: offerings.filter((o) => o.type === k).reduce((s, x) => s + x.amount, 0),
  })).filter((x) => x.value > 0);

  return (
    <div>
      <PageHeader
        title="แดชบอร์ด"
        description="ภาพรวมการเงินคริสตจักร"
        actions={
          <>
            <Button variant="outline" className="rounded-2xl" onClick={() => navigate({ to: "/reports" })}>
              <CalendarClock className="h-4 w-4 mr-2" /> รายงาน
            </Button>
            <Button className="rounded-2xl" onClick={() => navigate({ to: "/offering" })}>
              <Plus className="h-4 w-4 mr-2" /> บันทึกเงินถวาย
            </Button>
          </>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)
        ) : (
          <>
            <StatCard label="รายรับรวม" value={thb(totalIncome)} icon={ArrowDownCircle} tone="success" hint="สะสมทั้งหมด" />
            <StatCard label="รายจ่ายรวม" value={thb(totalExpense)} icon={ArrowUpCircle} tone="danger" hint="สะสมทั้งหมด" />
            <StatCard label="ยอดเงินสดคงเหลือ" value={thb(cashBalance)} icon={Wallet} tone="primary" hint="ทุกกองทุนรวมกัน" />
            <StatCard label="เงินถวายวันนี้" value={thb(todayOffering)} icon={HandHeart} tone="accent" hint={fmtDate(todayStr)} />
            <StatCard label="เงินถวายเดือนนี้" value={thb(monthlyOffering)} icon={HandHeart} tone="secondary" hint={dayjs().format("MMMM YYYY")} />
            <StatCard label="งบประมาณประจำปี" value={annualBudget ? thb(annualBudget.amount) : "-"} icon={PiggyBank} tone="primary" hint={annualBudget ? `ใช้ ${thb(annualBudget.used)}` : "ยังไม่ตั้งงบ"} />
            <StatCard label="งบประมาณโครงการ" value={thb(projectBudget)} icon={Briefcase} tone="secondary" hint={`${projects.length} โครงการ`} />
            <StatCard label="รออนุมัติ" value={pendingApprovals} icon={ClipboardCheck} tone="danger" hint="ทั้งรายรับและรายจ่าย" />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Card className="lg:col-span-2 rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">แนวโน้มรายรับ / รายจ่าย 6 เดือน</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                <Tooltip formatter={(v: number) => thb(v)} contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)" }} />
                <Legend />
                <Line type="monotone" dataKey="income" name="รายรับ" stroke="#22C55E" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="expense" name="รายจ่าย" stroke="#EF4444" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="offering" name="ถวาย" stroke="#F97316" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">การกระจายกองทุน</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={fundDist} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                  {fundDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => thb(v)} contentStyle={{ borderRadius: 12 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">เปรียบเทียบรายเดือน</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                <Tooltip formatter={(v: number) => thb(v)} contentStyle={{ borderRadius: 12 }} />
                <Legend />
                <Bar dataKey="income" name="รายรับ" fill="#22C55E" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expense" name="รายจ่าย" fill="#EF4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">การใช้งบประมาณ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {budgets.slice(0, 4).map((b) => {
              const pct = Math.min(100, Math.round((b.used / b.amount) * 100));
              return (
                <div key={b.id}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium truncate">{b.name}</span>
                    <span className="text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6 }}
                      className={pct > 90 ? "h-full bg-destructive" : pct > 70 ? "h-full bg-warning" : "h-full bg-primary"}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                    <span>{thb(b.used)}</span>
                    <span>{thb(b.amount)}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Latest transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <Card className="rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">รายการล่าสุด</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/income" })}>ดูทั้งหมด</Button>
          </CardHeader>
          <CardContent className="divide-y">
            {[...incomes.slice(0, 3).map((i) => ({ ...i, kind: "income" as const })),
              ...expenses.slice(0, 3).map((e) => ({ ...e, kind: "expense" as const }))]
              .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{tx.description || (tx.kind === "income" ? "รายรับ" : "รายจ่าย")}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(tx.date)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={tx.status} />
                  <MoneyText value={tx.amount} tone={tx.kind === "income" ? "income" : "expense"} />
                </div>
              </div>
            ))}
            {incomes.length === 0 && expenses.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีรายการ</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">เงินถวายล่าสุด</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/offering" })}>ดูทั้งหมด</Button>
          </CardHeader>
          <CardContent className="divide-y">
            {offerings.slice(0, 6).map((o) => (
              <div key={o.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{OFFERING_LABEL[o.type]}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(o.date)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="rounded-full text-[10px]">{o.channel === "cash" ? "เงินสด" : o.channel === "bank" ? "โอน" : "QR"}</Badge>
                  <MoneyText value={o.amount} tone="income" />
                </div>
              </div>
            ))}
            {offerings.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Offering distribution */}
      {offeringByType.length > 0 && (
        <Card className="rounded-3xl mt-6">
          <CardHeader>
            <CardTitle className="text-base">การกระจายเงินถวายตามประเภท</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={offeringByType} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} width={80} />
                <Tooltip formatter={(v: number) => thb(v)} contentStyle={{ borderRadius: 12 }} />
                <Bar dataKey="value" fill="#F97316" radius={[0, 8, 8, 0]}>
                  {offeringByType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}