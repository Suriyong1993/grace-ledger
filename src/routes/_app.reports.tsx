import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
import { thb } from "@/lib/format";
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

  const totalIncome = incomes.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalExpense = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const netBalance = totalIncome - totalExpense;
  const totalOffering = offerings.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "ประเภท,รายการ,จำนวนเงิน (บาท),วันที่\n" +
      incomes.map((i) => `รายรับ,${i.description || 'รายรับ'},${i.amount},${i.date}`).join("\n") +
      "\n" +
      expenses.map((e) => `รายจ่าย,${e.description || 'รายจ่าย'},${e.amount},${e.date}`).join("\n");

    const encodedUri = encodeURI(csvContent);
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

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="รายรับรวม"
          value={thb(totalIncome)}
          hint={`${incomes.length} รายการ`}
          icon={TrendingUp}
        />
        <StatCard
          label="รายจ่ายรวม"
          value={thb(totalExpense)}
          hint={`${expenses.length} รายการ`}
          icon={TrendingDown}
        />
        <StatCard
          label="เงินถวายรวม"
          value={thb(totalOffering)}
          hint={`${offerings.length} สัปดาห์`}
          icon={PieIcon}
        />
        <StatCard
          label="ยอดคงเหลือสุทธิ"
          value={thb(netBalance)}
          hint={netBalance >= 0 ? "เกินงบ / ดุลบวก" : "ติดลบ / ดุลลบ"}
          icon={FileBarChart2}
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-medium">งบสรุปรายรับ-รายจ่ายประจำคริสตจักร</CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>ข้อมูลอัปเดตล่าสุดเรียลไทม์</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold mb-3 text-emerald-600 dark:text-emerald-400">
                    รายการรายรับ ({incomes.length} รายการ)
                  </h4>
                  {incomes.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">ยังไม่มีรายการรายรับ</p>
                  ) : (
                    <div className="border border-border divide-y divide-border rounded-md text-xs">
                      {incomes.map((inc) => (
                        <div key={inc.id} className="flex justify-between p-3">
                          <div>
                            <p className="font-medium text-foreground">{inc.description || "รายรับ"}</p>
                            <p className="text-[11px] text-muted-foreground">{inc.date}</p>
                          </div>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            +{thb(inc.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-3 text-rose-600 dark:text-rose-400">
                    รายการรายจ่าย ({expenses.length} รายการ)
                  </h4>
                  {expenses.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">ยังไม่มีรายการรายจ่าย</p>
                  ) : (
                    <div className="border border-border divide-y divide-border rounded-md text-xs">
                      {expenses.map((exp) => (
                        <div key={exp.id} className="flex justify-between p-3">
                          <div>
                            <p className="font-medium text-foreground">{exp.description || "รายจ่าย"}</p>
                            <p className="text-[11px] text-muted-foreground">{exp.date} · หมวดหมู่ {exp.categoryId}</p>
                          </div>
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            -{thb(exp.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offering" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">รายงานสรุปเงินถวายสัปดาห์</CardTitle>
            </CardHeader>
            <CardContent>
              {offerings.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">ยังไม่มีบันทึกสรุปเงินถวาย</p>
              ) : (
                <div className="border border-border divide-y divide-border rounded-md text-xs">
                  {offerings.map((off) => (
                    <div key={off.id} className="flex justify-between p-3">
                      <div>
                        <p className="font-medium text-foreground">เงินถวายประจำวันที่ {off.date}</p>
                        <p className="text-[11px] text-muted-foreground">บันทึกโดย {off.createdBy}</p>
                      </div>
                      <span className="font-semibold text-foreground">
                        {thb(off.amount)}
                      </span>
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
                  expenses.reduce((acc, curr) => {
                    const cat = curr.categoryId || "อื่นๆ";
                    acc[cat] = (acc[cat] || 0) + (curr.amount || 0);
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([category, amount]) => (
                  <div key={category} className="flex items-center justify-between border-b border-border pb-2 text-xs">
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
