import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, FileBarChart2, Printer, FileSpreadsheet, FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listExpense, listIncome, listOffering, getSettings } from "@/services/church";
import { thb, fmtMonth, dayjs } from "@/lib/format";
import { exportCSV, exportExcel, exportPDF, printReport, type ExportColumn } from "@/lib/exporters";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "รายงาน" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { user } = useAuth();
  const inQ = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const exQ = useQuery({ queryKey: ["expense"], queryFn: listExpense });
  const offQ = useQuery({ queryKey: ["offering"], queryFn: listOffering });
  const setQ = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const inc = inQ.data ?? []; const exp = exQ.data ?? []; const off = offQ.data ?? [];
  const months = Array.from({ length: 6 }).map((_, i) => {
    const d = dayjs().subtract(5 - i, "month");
    const key = d.format("YYYY-MM");
    const income = inc.filter((x) => x.date.startsWith(key)).reduce((s, x) => s + x.amount, 0);
    const offering = off.filter((x) => x.date.startsWith(key)).reduce((s, x) => s + x.amount, 0);
    const expense = exp.filter((x) => x.date.startsWith(key)).reduce((s, x) => s + x.amount, 0);
    return { label: fmtMonth(d.toDate()), income, offering, expense, net: income + offering - expense };
  });
  const totals = { income: inc.reduce((s, x) => s + x.amount, 0), offering: off.reduce((s, x) => s + x.amount, 0), expense: exp.reduce((s, x) => s + x.amount, 0) };

  const cols: ExportColumn<typeof months[number]>[] = [
    { key: "label", label: "เดือน" },
    { key: "income", label: "รายรับ", align: "right", format: (r) => r.income.toFixed(2) },
    { key: "offering", label: "เงินถวาย", align: "right", format: (r) => r.offering.toFixed(2) },
    { key: "expense", label: "รายจ่าย", align: "right", format: (r) => r.expense.toFixed(2) },
    { key: "net", label: "สุทธิ", align: "right", format: (r) => r.net.toFixed(2) },
  ];
  const meta = {
    title: "รายงานสรุปรายเดือน",
    subtitle: `${months[0]?.label} - ${months[months.length - 1]?.label}`,
    churchName: setQ.data?.churchName ?? "",
    generatedBy: user?.name,
    fileBase: "Monthly_Report",
  };
  const doExport = (fmt: "csv" | "excel" | "pdf") => {
    try {
      if (fmt === "csv") exportCSV(months, cols, meta);
      if (fmt === "excel") exportExcel(months, cols, meta);
      if (fmt === "pdf") exportPDF(months, cols, meta);
      toast.success("ส่งออกรายงานสำเร็จ");
    } catch (e) {
      toast.error("ส่งออกไม่สำเร็จ");
      console.error(e);
    }
  };
  return (
    <div>
      <PageHeader title="รายงาน" description="สรุปรายงานการเงิน" actions={<>
        <Button variant="outline" className="rounded-2xl" onClick={printReport}><Printer className="h-4 w-4 mr-2" /> พิมพ์</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="rounded-2xl"><Download className="h-4 w-4 mr-2" /> ส่งออก</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl">
            <DropdownMenuItem onClick={() => doExport("pdf")}><FileText className="h-4 w-4 mr-2 text-destructive" /> PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={() => doExport("excel")}><FileSpreadsheet className="h-4 w-4 mr-2 text-success" /> Excel</DropdownMenuItem>
            <DropdownMenuItem onClick={() => doExport("csv")}><Download className="h-4 w-4 mr-2" /> CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="rounded-3xl"><CardContent className="p-5"><p className="text-sm text-muted-foreground">รายรับสะสม</p><p className="mt-2 text-3xl font-bold text-success tabular-nums">{thb(totals.income)}</p></CardContent></Card>
        <Card className="rounded-3xl"><CardContent className="p-5"><p className="text-sm text-muted-foreground">เงินถวายสะสม</p><p className="mt-2 text-3xl font-bold text-primary tabular-nums">{thb(totals.offering)}</p></CardContent></Card>
        <Card className="rounded-3xl"><CardContent className="p-5"><p className="text-sm text-muted-foreground">รายจ่ายสะสม</p><p className="mt-2 text-3xl font-bold text-destructive tabular-nums">{thb(totals.expense)}</p></CardContent></Card>
      </div>
      <Card className="rounded-3xl">
        <CardHeader className="flex flex-row items-center gap-2"><FileBarChart2 className="h-5 w-5 text-primary" /><CardTitle>รายงานรายเดือน (6 เดือน)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground border-b"><th className="py-2">เดือน</th><th className="text-right py-2">รายรับ</th><th className="text-right py-2">เงินถวาย</th><th className="text-right py-2">รายจ่าย</th><th className="text-right py-2">สุทธิ</th></tr></thead>
            <tbody className="divide-y">{months.map((m) => (
              <tr key={m.label}>
                <td className="py-3 font-medium">{m.label}</td>
                <td className="text-right tabular-nums text-success">{thb(m.income)}</td>
                <td className="text-right tabular-nums text-primary">{thb(m.offering)}</td>
                <td className="text-right tabular-nums text-destructive">{thb(m.expense)}</td>
                <td className={"text-right tabular-nums font-semibold " + (m.net >= 0 ? "text-success" : "text-destructive")}>{thb(m.net)}</td>
              </tr>))}</tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}