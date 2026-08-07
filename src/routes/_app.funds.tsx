import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InlineStatBar } from "@/components/shared/InlineStatBar";
import { MoneyText } from "@/components/shared/MoneyText";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listExpense, listFunds, listIncome, listOffering } from "@/services/church";
import { thb } from "@/lib/format";
import { FundTransferDialog } from "@/components/shared/FundTransferDialog";
import { CreateFundDialog } from "@/components/shared/CreateFundDialog";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

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
  const isError = fundsQ.isError || inQ.isError || exQ.isError || offQ.isError;

  const rows = useMemo(
    () =>
      funds.map((f) => {
        const income = inc.filter((x) => x.fundId === f.id).reduce((s, x) => s + x.amount, 0);
        const offering = off.filter((x) => x.fundId === f.id).reduce((s, x) => s + x.amount, 0);
        const expense = exp.filter((x) => x.fundId === f.id).reduce((s, x) => s + x.amount, 0);
        return {
          fund: f,
          income,
          offering,
          expense,
          balance: f.openingBalance + income + offering - expense,
        };
      }),
    [funds, inc, exp, off],
  );

  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);
  const totalIn = rows.reduce((s, r) => s + r.income + r.offering, 0);
  const totalExp = rows.reduce((s, r) => s + r.expense, 0);

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        kicker="กองทุน & งบประมาณ"
        title="กองทุน"
        description="บริหารกองทุนและติดตามยอดคงเหลือแยกตามกองทุน"
        actions={
          can("fund.write") ? (
            <div className="flex flex-wrap items-center gap-2">
              <CreateFundDialog />
              <FundTransferDialog />
            </div>
          ) : null
        }
      />

      {isError ? (
        <div className="flex items-center justify-between gap-4 rounded-card border border-destructive/30 bg-destructive/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">โหลดข้อมูลกองทุนไม่สำเร็จ</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              fundsQ.refetch();
              inQ.refetch();
              exQ.refetch();
              offQ.refetch();
            }}
          >
            ลองใหม่
          </Button>
        </div>
      ) : null}

      {fundsQ.isLoading ? (
        <>
          <Skeleton className="h-[52px] rounded-card" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-60" />
            ))}
          </div>
        </>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="ยังไม่มีกองทุน"
          description="เมื่อมีการสร้างกองทุน ยอดคงเหลือและการเคลื่อนไหวจะแสดงที่นี่"
        />
      ) : (
        <>
          {/* Page-level stats */}
          <InlineStatBar
            items={[
              { label: "ยอดคงเหลือรวม", value: totalBalance, icon: Wallet, tone: "primary" },
              { label: "รายรับรวม", value: totalIn, icon: TrendingUp, tone: "success" },
              { label: "รายจ่ายรวม", value: totalExp, icon: TrendingDown, tone: "danger" },
              { label: "จำนวนกองทุน", value: String(rows.length), tone: "default" },
            ]}
          />
          {/* Fund ledger cards */}
          <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map(({ fund: f, income, offering, expense, balance }, i) => (
              <article
                key={f.id}
                className={cn(
                  "card-ledger flex flex-col overflow-hidden",
                  balance < 0 && "border-destructive/30",
                )}
              >
                {/* Top accent — primary positive, red negative */}
                <div
                  className={cn("h-0.5 w-full", balance >= 0 ? "bg-primary" : "bg-destructive")}
                />
                <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
                  <p className="truncate text-[13px] font-semibold text-foreground">{f.name}</p>
                  <span
                    aria-hidden
                    className="num-display shrink-0 text-[10px] font-medium text-muted-foreground/50"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>

                <div className="px-5 py-4">
                  <p className="kicker text-muted-foreground/70">ยอดคงเหลือปัจจุบัน</p>
                  <p
                    className={cn(
                      "num-display font-display mt-2 text-[32px] font-bold leading-none tracking-tight",
                      balance >= 0 ? "text-foreground" : "text-destructive",
                    )}
                  >
                    {thb(balance)}
                  </p>
                </div>

                <div className="mt-auto divide-y divide-border/60 border-t border-border/60">
                  <div className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <TrendingUp className="h-3 w-3 text-success" strokeWidth={2} />
                      รายรับ
                    </span>
                    <MoneyText
                      value={income + offering}
                      tone="income"
                      className="text-sm font-semibold"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <TrendingDown className="h-3 w-3 text-destructive" strokeWidth={2} />
                      รายจ่าย
                    </span>
                    <MoneyText value={expense} tone="expense" className="text-sm font-semibold" />
                  </div>
                  <div className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="text-[11px] text-muted-foreground">ยอดตั้งต้น</span>
                    <span className="num-display text-sm text-muted-foreground">
                      {thb(f.openingBalance)}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
