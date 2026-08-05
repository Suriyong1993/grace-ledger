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
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listIncome, listExpense, listOffering, listCategories } from "@/services/church";
import { thb, dayjs, fmtDate } from "@/lib/format";
import { PageTransition } from "@/components/shared/PageTransition";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PAGE_SIZE = 15;

/** Simple client-side pager — resets to page 1 whenever the row count shrinks below the current page */
function usePager<T>(rows: T[]) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return { page: safePage, setPage, totalPages, pageRows };
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-border/60 px-3 py-2">
      <span className="text-[11px] text-muted-foreground">
        หน้า {page} จาก {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="ก่อนหน้า"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="ถัดไป"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "รายงานการเงิน — Grace Ledger" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");

  const incomeQ = useQuery({ queryKey: ["incomes"], queryFn: listIncome });
  const expenseQ = useQuery({ queryKey: ["expenses"], queryFn: listExpense });
  const offeringQ = useQuery({ queryKey: ["offerings"], queryFn: listOffering });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: listCategories });

  const incomes = incomeQ.data ?? [];
  const expenses = expenseQ.data ?? [];
  const offerings = offeringQ.data ?? [];
  const categories = catsQ.data ?? [];
  const catName = (id?: string) => categories.find((c) => c.id === id)?.name ?? "อื่นๆ";

  const isLoading = incomeQ.isLoading || expenseQ.isLoading || offeringQ.isLoading;
  const isError = incomeQ.isError || expenseQ.isError || offeringQ.isError;

  // Filter by selected period
  const now = dayjs();
  const filteredIncomes = useMemo(() => {
    return incomes.filter((i) => {
      const d = dayjs(i.date);
      if (period === "month") return d.isSame(now, "month");
      if (period === "quarter") return d.isAfter(now.subtract(3, "month"));
      return d.isSame(now, "year");
    });
  }, [incomes, period, now]);
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = dayjs(e.date);
      if (period === "month") return d.isSame(now, "month");
      if (period === "quarter") return d.isAfter(now.subtract(3, "month"));
      return d.isSame(now, "year");
    });
  }, [expenses, period, now]);
  const filteredOfferings = useMemo(() => {
    return offerings.filter((o) => {
      const d = dayjs(o.date);
      if (period === "month") return d.isSame(now, "month");
      if (period === "quarter") return d.isAfter(now.subtract(3, "month"));
      return d.isSame(now, "year");
    });
  }, [offerings, period, now]);

  const incomePager = usePager(filteredIncomes);
  const expensePager = usePager(filteredExpenses);

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
    toast.success("ส่งออกรายงานไฟล์ CSV เรียบร้อยแล้ว");
  };

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        kicker="องค์กร"
        title="รายงานการเงิน"
        description="รายงานสรุปรายรับ-รายจ่าย สรุปงบประมาณ และรายงานเงินถวายประจำคริสตจักร"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-button">
              <Printer className="mr-2 h-4 w-4" />
              พิมพ์รายงาน
            </Button>
            <Button size="sm" onClick={handleExportCSV} className="rounded-button font-semibold">
              <Download className="mr-2 h-4 w-4" />
              ส่งออก CSV/Excel
            </Button>
          </div>
        }
      />

      {/* Period Selector */}
      <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-lg w-fit">
        {(["month", "quarter", "year"] as const).map((p) => (
          <Button
            key={p}
            variant="ghost"
            size="sm"
            onClick={() => setPeriod(p)}
            className={cn(
              "h-auto rounded-md px-3 py-1.5 text-xs font-medium",
              period === p
                ? "bg-card text-foreground shadow-sm hover:bg-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p === "month" ? "เดือนนี้" : p === "quarter" ? "ไตรมาสนี้" : "ปีนี้"}
          </Button>
        ))}
      </div>

      {isError ? (
        <div className="flex items-center justify-between gap-4 rounded-card border border-destructive/30 bg-destructive/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">โหลดข้อมูลรายงานไม่สำเร็จ</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              incomeQ.refetch();
              expenseQ.refetch();
              offeringQ.refetch();
            }}
          >
            ลองใหม่
          </Button>
        </div>
      ) : null}

      {/* Overview Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px]" />
          ))}
        </div>
      ) : (
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
      )}

      {/* Tabs for Detailed Reports */}
      <Tabs defaultValue="statement" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="statement">งบรายรับ-รายจ่าย</TabsTrigger>
          <TabsTrigger value="offering">รายงานเงินถวาย</TabsTrigger>
          <TabsTrigger value="category">แยกตามหมวดหมู่</TabsTrigger>
        </TabsList>

        <TabsContent value="statement" className="mt-4">
          <section className="card-ledger overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-5 py-3">
              <p className="kicker text-muted-foreground/80">งบสรุปรายรับ-รายจ่าย</p>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>ข้อมูลอัปเดตล่าสุดเรียลไทม์</span>
              </div>
            </div>
            <div className="space-y-6 p-5">
              <div>
                <h4 className="kicker mb-3 text-success">
                  รายการรายรับ ({filteredIncomes.length} รายการ)
                </h4>
                {isLoading ? (
                  <Skeleton className="h-40" />
                ) : filteredIncomes.length === 0 ? (
                  <p className="py-2 text-xs text-muted-foreground">ยังไม่มีรายการรายรับ</p>
                ) : (
                  <div className="overflow-hidden rounded-sm border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="h-8 text-[11px]">วันที่</TableHead>
                          <TableHead className="h-8 text-[11px]">รายการ</TableHead>
                          <TableHead className="h-8 text-[11px]">หมวดหมู่</TableHead>
                          <TableHead className="h-8 text-right text-[11px]">จำนวน</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {incomePager.pageRows.map((inc) => (
                          <TableRow key={inc.id}>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {fmtDate(inc.date)}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-foreground">
                              {inc.description || "รายรับ"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {catName(inc.categoryId)}
                            </TableCell>
                            <TableCell className="num-display text-right text-xs font-semibold text-success">
                              +{thb(inc.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Pagination
                      page={incomePager.page}
                      totalPages={incomePager.totalPages}
                      onChange={incomePager.setPage}
                    />
                  </div>
                )}
              </div>

              <div>
                <h4 className="kicker mb-3 text-destructive">
                  รายการรายจ่าย ({filteredExpenses.length} รายการ)
                </h4>
                {isLoading ? (
                  <Skeleton className="h-40" />
                ) : filteredExpenses.length === 0 ? (
                  <p className="py-2 text-xs text-muted-foreground">ยังไม่มีรายการรายจ่าย</p>
                ) : (
                  <div className="overflow-hidden rounded-sm border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="h-8 text-[11px]">วันที่</TableHead>
                          <TableHead className="h-8 text-[11px]">รายการ</TableHead>
                          <TableHead className="h-8 text-[11px]">หมวดหมู่</TableHead>
                          <TableHead className="h-8 text-right text-[11px]">จำนวน</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expensePager.pageRows.map((exp) => (
                          <TableRow key={exp.id}>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {fmtDate(exp.date)}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-foreground">
                              {exp.description || "รายจ่าย"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {catName(exp.categoryId)}
                            </TableCell>
                            <TableCell className="num-display text-right text-xs font-semibold text-destructive">
                              −{thb(exp.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Pagination
                      page={expensePager.page}
                      totalPages={expensePager.totalPages}
                      onChange={expensePager.setPage}
                    />
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
                      const cat = catName(curr.categoryId);
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
                    <span className="num-display font-semibold">{thb(amount)}</span>
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
