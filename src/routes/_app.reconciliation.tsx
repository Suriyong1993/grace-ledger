import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Landmark,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Download,
  FileBarChart2,
  PiggyBank,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { MoneyText } from "@/components/shared/MoneyText";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <div>
      <PageHeader
        title="สรุปยอด Reconciliation"
        description={periodLabel}
        actions={
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v: Period) => setPeriod(v)}>
              <SelectTrigger className="w-44 rounded-2xl">
                <CalendarDays className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                {(["this_week", "this_month", "last_week", "last_month", "custom"] as Period[]).map(
                  (p) => (
                    <SelectItem key={p} value={p}>
                      {PERIOD_LABEL[p]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            {period === "custom" && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  className="rounded-xl w-36"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  className="rounded-xl w-36"
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
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      ) : (
        <>
          {/* ============ SUMMARY STATEMENT ============ */}
          <Card className="rounded-3xl overflow-hidden">
            <CardHeader className="bg-primary/5 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <FileBarChart2 className="h-5 w-5 text-primary" />
                งบแสดงฐานะการเงิน
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {/* Opening */}
                <div className="flex items-center justify-between px-6 py-4 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">ยอดยกมา (Opening Balance)</p>
                      <p className="text-xs text-muted-foreground">ก่อนวันที่ {fmtDate(start)}</p>
                    </div>
                  </div>
                  <MoneyText value={openingBalance} tone="primary" />
                </div>

                {/* Income */}
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-success" />
                    <div>
                      <p className="text-sm font-medium">รายรับ + เงินถวาย</p>
                      <p className="text-xs text-muted-foreground">
                        รายรับ {thb(totalIncome)} + เงินถวาย {thb(totalOffering)}
                      </p>
                    </div>
                  </div>
                  <MoneyText value={totalIncome + totalOffering} tone="income" />
                </motion.div>

                {/* Expense */}
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div className="flex items-center gap-3">
                    <TrendingDown className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="text-sm font-medium">รายจ่าย</p>
                      <p className="text-xs text-muted-foreground">{expenseThis.length} รายการ</p>
                    </div>
                  </div>
                  <MoneyText value={totalExpense} tone="expense" />
                </motion.div>

                {/* Separator */}
                <div className="border-t-2 border-dashed" />

                {/* Net change */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center justify-between px-6 py-4 bg-primary/5"
                >
                  <div className="flex items-center gap-3">
                    <ArrowRight className="h-5 w-5 text-primary" />
                    <p className="text-sm font-semibold">ผลต่างสุทธิ (Net Change)</p>
                  </div>
                  <MoneyText value={netChange} tone={netChange >= 0 ? "income" : "expense"} />
                </motion.div>

                {/* Closing */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center justify-between px-6 py-5 bg-primary/10"
                >
                  <div className="flex items-center gap-3">
                    <PiggyBank className="h-6 w-6 text-primary" />
                    <div>
                      <p className="text-base font-bold">ยอดยกไป (Closing Balance)</p>
                      <p className="text-xs text-muted-foreground">ณ วันที่ {fmtDate(end)}</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    {thb(closingBalance)}
                  </p>
                </motion.div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {/* ============ CHANNEL BREAKDOWN ============ */}
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-primary" />
                  เงินถวายแยกตามช่องทาง
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {["cash", "bank", "qr"].map((ch) => {
                  const amount = channelBreakdown[ch] ?? 0;
                  return (
                    <div
                      key={ch}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`grid h-8 w-8 place-items-center rounded-xl ${
                            ch === "cash"
                              ? "bg-success/10 text-success"
                              : ch === "bank"
                                ? "bg-primary/10 text-primary"
                                : "bg-accent/10 text-accent"
                          }`}
                        >
                          {ch === "cash" ? (
                            <DollarSign className="h-4 w-4" />
                          ) : ch === "bank" ? (
                            <Landmark className="h-4 w-4" />
                          ) : (
                            <Wallet className="h-4 w-4" />
                          )}
                        </div>
                        <span className="text-sm font-medium">
                          {CHANNEL_LABEL[ch as keyof typeof CHANNEL_LABEL]}
                        </span>
                      </div>
                      <MoneyText value={amount} tone="income" />
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-2 border-t-2">
                  <span className="text-sm font-bold">รวมเงินถวาย</span>
                  <MoneyText value={totalOffering} tone="income" />
                </div>
              </CardContent>
            </Card>

            {/* ============ FUND BREAKDOWN ============ */}
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PiggyBank className="h-5 w-5 text-primary" />
                  ยอดคงเหลือแยกตามกองทุน
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
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
                        <TableCell className="font-medium">{f.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {thb(f.openingBalance)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-success">
                          {thb(f.income)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">
                          {thb(f.expense)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {thb(f.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30">
                      <TableCell className="font-bold">รวม</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {thb(fundRows.reduce((s, f) => s + f.openingBalance, 0))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-success">
                        {thb(fundRows.reduce((s, f) => s + f.income, 0))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-destructive">
                        {thb(fundRows.reduce((s, f) => s + f.expense, 0))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-bold">
                        {thb(fundRows.reduce((s, f) => s + f.balance, 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* ============ RECONCILIATION CHECK ============ */}
          <Card className="rounded-3xl mt-4">
            <CardHeader className="border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                ตรวจสอบยอด (Reconciliation)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* System balance */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    ยอดในระบบ
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-3 rounded-2xl bg-muted/50">
                      <span className="text-sm">ยอดยกมาตั้งต้น (Opening Balance)</span>
                      <span className="font-semibold tabular-nums">
                        {thb(funds.reduce((s, f) => s + f.openingBalance, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-2xl bg-success/5">
                      <span className="text-sm">รายรับทั้งหมด (รวมเงินถวาย)</span>
                      <span className="font-semibold tabular-nums text-success">
                        {thb(
                          incomes.reduce((s, x) => s + x.amount, 0) +
                            offerings.reduce((s, x) => s + x.amount, 0),
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-2xl bg-destructive/5">
                      <span className="text-sm">รายจ่ายทั้งหมด</span>
                      <span className="font-semibold tabular-nums text-destructive">
                        {thb(expenses.reduce((s, x) => s + x.amount, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 rounded-2xl bg-primary/10 border-2 border-primary/20">
                      <span className="text-sm font-bold">ยอดคงเหลือในระบบ</span>
                      <span className="text-lg font-bold tabular-nums text-primary">
                        {thb(currentBalance)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actual input */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    ยอดเงินจริง
                  </p>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm">เงินสดในมือ (Cash on Hand)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        className="rounded-2xl mt-1.5 h-12 text-lg"
                        placeholder="0.00"
                        value={actualCash}
                        onChange={(e) => setActualCash(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">เงินในบัญชี (Bank Balance)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        className="rounded-2xl mt-1.5 h-12 text-lg"
                        placeholder="0.00"
                        value={actualBank}
                        onChange={(e) => setActualBank(e.target.value)}
                      />
                    </div>

                    {hasActual && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-2xl border-2 ${
                          isBalanced
                            ? "bg-success/10 border-success/30"
                            : "bg-destructive/10 border-destructive/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">ยอดเงินจริงรวม</span>
                          <span className="font-bold tabular-nums">{thb(actualTotal)}</span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">ผลต่างจากระบบ</span>
                          <span
                            className={`font-bold tabular-nums ${Math.abs(diff) < 0.01 ? "text-success" : Math.abs(diff) < 1000 ? "text-warning" : "text-destructive"}`}
                          >
                            {diff >= 0 ? "+" : ""}
                            {thb(diff)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          {isBalanced ? (
                            <>
                              <CheckCircle2 className="h-5 w-5 text-success" />
                              <span className="text-sm font-medium text-success">ยอดตรงกัน ✅</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-5 w-5 text-destructive" />
                              <span className="text-sm font-medium text-destructive">
                                ยอดไม่ตรงกัน (ต่าง {thb(Math.abs(diff))})
                              </span>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
