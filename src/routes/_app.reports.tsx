import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, FileBarChart2, Printer } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listExpense, listIncome, listOffering } from "@/services/church";
import { thb, fmtMonth, dayjs } from "@/lib/format";
import { downloadCsv, toCsv } from "@/lib/csv";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "รายงาน" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const inQ = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const exQ = useQuery({ queryKey: ["expense"], queryFn: listExpense });
  const offQ = useQuery({ queryKey: ["offering"], queryFn: listOffering });
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
  const exportCsv = () => {
    const csv = toCsv(months.map((m) => ({ month: m.label, income: m.income, offering: m.offering, expense: m.expense, net: m.net })), { month: "เดือน", income: "รายรับ", offering: "เงินถวาย", expense: "รายจ่าย", net: "สุทธิ" });
    downloadCsv(`monthly-report-${dayjs().format("YYYYMMDD")}.csv`, csv);
  };
  return (
    <div>
      <PageHeader title="รายงาน" description="สรุปรายงานการเงิน" actions={<>
        <Button variant="outline" className="rounded-2xl" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> พิมพ์</Button>
        <Button className="rounded-2xl" onClick={exportCsv}><Download className="h-4 w-4 mr-2" /> ดาวน์โหลด CSV</Button>
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