import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  FileBarChart2,
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  Calendar,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listIncome, listExpense, listOffering } from "@/services/church";
import { thb, dayjs } from "@/lib/format";
import { PageTransition } from "@/components/shared/PageTransition";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "รายงานการเงิน — Grace Ledger" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");

  const incomeQ = useQuery({ queryKey: ["incomes"], queryFn: listIncome });
  const expenseQ = useQuery({ queryKey: ["expenses"], queryFn: listExpense });
  const offeringQ = useQuery({ queryKey: ["offerings"], queryFn: listOffering });

  const incomes = incomeQ.data ?? [];
  const expenses = expenseQ.data ?? [];
  const offerings = offeringQ.data ?? [];

  // Filter by selected period
  const now = dayjs();
  const filteredIncomes = useMemo(() => {
    return incomes.filter((i) => {
      const d = dayjs(i.date);
      if (period === "month") return d.isSame(now, "month");
      if (period === "quarter") return d.isAfter(now.subtract(3, "month"));
      return d.isSame(now, "year");
    });
  }, [incomes, period]);
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = dayjs(e.date);
      if (period === "month") return d.isSame(now, "month");
      if (period === "quarter") return d.isAfter(now.subtract(3, "month"));
      return d.isSame(now, "year");
    });
  }, [expenses, period]);
  const filteredOfferings = useMemo(() => {
    return offerings.filter((o) => {
      const d = dayjs(o.date);
      if (period === "month") return d.isSame(now, "month");
      if (period === "quarter") return d.isAfter(now.subtract(3, "month"));
      return d.isSame(now, "year");
    });
  }, [offerings, period]);

  const totalIncome = filteredIncomes.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalExpense = filteredExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const netBalance = totalIncome - totalExpense;
  const totalOffering = filteredOfferings.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const csvRows = [
      "ประเภท,รายการ,จำนวนเงิน (บาท),วันที่",
      ...filteredIncomes.map((i) => `รายรับ,${i.description || "รายรับ"},${i.amount},${i.date}`),
      ...filteredExpenses.map((e) => `รายจ่าย,${e.description || "รายจ่าย"},${e.amount},${e.date}`),
    ];
    const BOM = "\uFEFF";
    const csvContent = BOM + csvRows.join("\n");
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `financial_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        kicker="องค์กร"
        title="รายงานการเงิน"
        description="รายงานสรุปรายรับ-รายจ่าย สรุปงบประมาณ และรายงานเงินถวายประจำคริสตจักร"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              พิมพ์รายงาน
            </Button>
            <Button size="sm" onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              ส่งออก CSV
            </Button>
          </div>
        }
      />

      {/* Period Selector */}
      <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-lg w-fit">
        {(["month", "quarter", "year"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              period === p
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p === "month" ? "เดือนนี้" : p === "quarter" ? "ไตรมาสนี้" : "ปีนี้"}
          </button>
        ))}
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="รายรับรวม"
          value={thb(totalIncome)}
          hint={`${filteredIncomes.length} รายการ`}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="รายจ่ายรวม"
          value={thb(totalExpense)}
          hint={`${filteredExpenses.length} รายการ`}
          icon={TrendingDown}
          tone="danger"
        />
        <StatCard
          label="เงินถวายรวม"
          value={thb(totalOffering)}
          hint={`${filteredOfferings.length} สัปดาห์`}
          icon={PieIcon}
          tone="primary"
        />
        <StatCard
          label="ยอดคงเหลือสุทธิ"
          value={thb(netBalance)}
          hint={netBalance >= 0 ? "ดุลบวก" : "ดุลลบ"}
          icon={FileBarChart2}
          tone={netBalance >= 0 ? "success" : "danger"}
        />
      </div>

      {/* Tabs for Detailed Reports */}
      <Tabs defaultValue="statement" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="statement">งบรายรับ-รายจ่าย</TabsTrigger>
          <TabsTrigger value="offering">รายงานเงินถวาย</TabsTrigger>
          <TabsTrigger value="category">แยกตามหมวดหมู่</TabsTrigger>
        </TabsList>

        <TabsContent value="statement" className="mt-4">
          <section className="card-ledger rounded-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-5 py-3">
              <p className="kicker text-muted-foreground/80">งบสรุปรายรับ-รายจ่าย</p>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>ข้อมูลอัปเดตล่าสุดเรียลไทม์</span>
              </div>
            </div>
            <div className="p-5 space-y-6">
              <div>
                                <h4 className="kicker mb-3 text-success">รายการรายรับ ({filteredIncomes.length} รายการ)</h4>
                {filteredIncomes.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">ยังไม่มีรายการรายรับ</p>
                ) : (
                  <div className="divide-y divide-border/60 border border-border/60 rounded-sm text-xs">
                    {filteredIncomes.map((inc) => (
                      <div
                        key={inc.id}
                        className="flex justify-between p-3 hover:bg-muted/30 transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-foreground">
                            {inc.description || "รายรับ"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{inc.date}</p>
                        </div>
                        <span className="num-display font-semibold text-success">
                          +{thb(inc.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="kicker mb-3 text-destructive">
                  รายการรายจ่าย ({filteredExpenses.length} รายการ)
                </h4>
                {filteredExpenses.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">ยังไม่มีรายการรายจ่าย</p>
                ) : (
                  <div className="divide-y divide-border/60 border border-border/60 rounded-sm text-xs">
                    {filteredExpenses.map((exp) => (
                      <div
                        key={exp.id}
                        className="flex justify-between p-3 hover:bg-muted/30 transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-foreground">
                            {exp.description || "รายจ่าย"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {exp.date} · หมวดหมู่ {exp.categoryId}
                          </p>
                        </div>
                        <span className="num-display font-semibold text-destructive">
                          −{thb(exp.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="offering" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">รายงานสรุปเงินถวายสัปดาห์</CardTitle>
            </CardHeader>
            <CardContent>
                            {filteredOfferings.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  ยังไม่มีบันทึกสรุปเงินถวาย
                </p>
              ) : (
                <div className="border border-border divide-y divide-border rounded-md text-xs">
                  {filteredOfferings.map((off) => (
                    <div key={off.id} className="flex justify-between p-3">
                      <div>
                        <p className="font-medium text-foreground">
                          เงินถวายประจำวันที่ {off.date}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          บันทึกโดย {off.createdBy}
                        </p>
                      </div>
                      <span className="font-semibold text-foreground">{thb(off.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">สรุปค่าใช้จ่ายแยกตามหมวดหมู่</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(
                  filteredExpenses.reduce(
                    (acc, curr) => {
                      const cat = curr.categoryId || "อื่นๆ";
                      acc[cat] = (acc[cat] || 0) + (curr.amount || 0);
                      return acc;
                    },
                    {} as Record<string, number>,
                  ),
                ).map(([category, amount]) => (
                  <div
                    key={category}
                    className="flex items-center justify-between border-b border-border pb-2 text-xs"
                  >
                    <span className="font-medium">{category}</span>
                    <span className="font-semibold">{thb(amount)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageTransition>
  );
}
