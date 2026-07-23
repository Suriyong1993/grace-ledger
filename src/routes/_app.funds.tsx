import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listExpense, listFunds, listIncome, listOffering } from "@/services/church";
import { thb } from "@/lib/format";
import { FundTransferDialog } from "@/components/shared/FundTransferDialog";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/funds")({
  head: () => ({ meta: [{ title: "กองทุน — ระบบจัดการการเงินคริสตจักร" }] }),
  component: FundsPage,
});

function FundsPage() {
  const { can } = useAuth();
  const fundsQ = useQuery({ queryKey: ["funds"], queryFn: listFunds });
  const inQ = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const exQ = useQuery({ queryKey: ["expense"], queryFn: listExpense });
  const offQ = useQuery({ queryKey: ["offering"], queryFn: listOffering });
  const funds = fundsQ.data ?? [];
  const inc = inQ.data ?? [];
  const exp = exQ.data ?? [];
  const off = offQ.data ?? [];
  return (
    <div>
      <PageHeader
        title="กองทุน"
        description="บริหารกองทุนและติดตามยอดคงเหลือ"
        actions={can("fund.write") ? <FundTransferDialog /> : null}
      />
      {fundsQ.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {funds.map((f, i) => {
            const income = inc.filter((x) => x.fundId === f.id).reduce((s, x) => s + x.amount, 0);
            const offering = off.filter((x) => x.fundId === f.id).reduce((s, x) => s + x.amount, 0);
            const expense = exp.filter((x) => x.fundId === f.id).reduce((s, x) => s + x.amount, 0);
            const balance = f.openingBalance + income + offering - expense;
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="rounded-3xl overflow-hidden">
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div className="min-w-0">
                      <CardTitle className="text-lg truncate">{f.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        ยอดตั้งต้น {thb(f.openingBalance)}
                      </p>
                    </div>
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <Wallet className="h-5 w-5" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold tracking-tight text-foreground">
                      {thb(balance)}
                    </p>
                    <p className="text-xs text-muted-foreground">ยอดคงเหลือปัจจุบัน</p>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="rounded-2xl bg-success/10 p-3">
                        <div className="flex items-center gap-1 text-xs text-success">
                          <TrendingUp className="h-3 w-3" /> รายรับ
                        </div>
                        <p className="mt-1 font-semibold text-foreground text-sm">
                          {thb(income + offering)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-destructive/10 p-3">
                        <div className="flex items-center gap-1 text-xs text-destructive">
                          <TrendingDown className="h-3 w-3" /> รายจ่าย
                        </div>
                        <p className="mt-1 font-semibold text-foreground text-sm">{thb(expense)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
