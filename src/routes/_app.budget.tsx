import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { listBudget } from "@/services/church";
import { thb } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/budget")({
  head: () => ({ meta: [{ title: "งบประมาณ" }] }),
  component: BudgetPage,
});

const PERIOD_LABEL: Record<string, string> = {
  annual: "ประจำปี",
  monthly: "รายเดือน",
  department: "แผนก",
  project: "โครงการ",
};

function BudgetPage() {
  const q = useQuery({ queryKey: ["budget"], queryFn: listBudget });
  const budgets = q.data ?? [];

  const totalAmount = budgets.reduce((s, b) => s + b.amount, 0);
  const totalUsed = budgets.reduce((s, b) => s + b.used, 0);
  const nearFull = budgets.filter((b) => Math.round((b.used / b.amount) * 100) >= 90).length;

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        kicker="กองทุน & งบประมาณ"
        title="งบประมาณ"
        description="ติดตามการใช้งบประมาณเทียบยอดที่ตั้งไว้"
      />

      {q.isLoading ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        </>
      ) : budgets.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="ยังไม่มีงบประมาณ"
          description="เมื่อมีการตั้งงบประมาณ การใช้จ่ายเทียบงบจะแสดงที่นี่"
        />
      ) : (
        <>
          {/* Page-level stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="งบประมาณรวม"
              value={thb(totalAmount)}
              icon={PiggyBank}
              hint={`${budgets.length} รายการ`}
            />
            <StatCard
              label="ใช้ไปแล้ว"
              value={thb(totalUsed)}
              icon={TrendingUp}
              hint="เบิกจ่ายสะสม"
            />
            <StatCard
              label="คงเหลือรวม"
              value={thb(totalAmount - totalUsed)}
              icon={Wallet}
              tone={totalAmount - totalUsed < 0 ? "danger" : "secondary"}
              hint="งบที่ยังใช้ได้"
            />
            <StatCard
              label="ใกล้เต็ม"
              value={nearFull}
              icon={AlertTriangle}
              tone={nearFull > 0 ? "danger" : "secondary"}
              hint="ใช้ไปแล้ว ≥ 90% ของงบ"
            />
          </div>

          {/* Budget vs actual cards */}
          <div className="stagger grid gap-4 md:grid-cols-2">
            {budgets.map((b) => {
              const pct = Math.min(100, Math.round((b.used / b.amount) * 100));
              const alert = pct >= 90;
              const remaining = b.amount - b.used;
              return (
                <article
                  key={b.id}
                  className={cn(
                    "card-ledger rounded-sm overflow-hidden",
                    alert && "border-destructive/30",
                  )}
                >
                  {/* Top accent strip for over-budget items */}
                  {alert && (
                    <div className="h-0.5 w-full bg-gradient-to-r from-destructive to-destructive/30" />
                  )}
                  <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-foreground">{b.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {PERIOD_LABEL[b.period]} · ปี {b.year}
                      </p>
                    </div>
                    {alert && (
                      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                        <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                        ใกล้เต็ม
                      </span>
                    )}
                  </div>

                  <div className="px-5 py-4">
                    <div className="mb-2.5 flex items-baseline justify-between gap-3">
                      <span className="text-[11px] text-muted-foreground">ใช้ไป</span>
                      <span className="num-display text-sm font-bold text-foreground">
                        {thb(b.used)}{" "}
                        <span className="font-normal text-muted-foreground">/ {thb(b.amount)}</span>
                      </span>
                    </div>
                    {/* Progress bar — thicker, with % label */}
                    <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          alert ? "bg-destructive" : pct >= 70 ? "bg-warning" : "bg-primary",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between gap-3 text-[11px]">
                      <span className="num-display font-semibold text-muted-foreground">{pct}%</span>
                      <span
                        className={cn(
                          "num-display",
                          remaining < 0 ? "font-semibold text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {remaining < 0
                          ? `เกินงบ ${thb(Math.abs(remaining))}`
                          : `คงเหลือ ${thb(remaining)}`}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
