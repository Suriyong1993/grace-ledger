import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { listBudget } from "@/services/church";
import { thb } from "@/lib/format";

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
  return (
    <div>
      <PageHeader title="งบประมาณ" description="ติดตามการใช้งบประมาณ" />
      {q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {budgets.map((b) => {
            const pct = Math.min(100, Math.round((b.used / b.amount) * 100));
            const alert = pct >= 90;
            return (
              <Card key={b.id} className="rounded-3xl">
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-lg truncate">{b.name}</CardTitle>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="rounded-full">
                        {PERIOD_LABEL[b.period]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">ปี {b.year}</span>
                    </div>
                  </div>
                  {alert && (
                    <Badge
                      variant="outline"
                      className="rounded-full bg-destructive/15 text-destructive border-destructive/30 gap-1"
                    >
                      <AlertTriangle className="h-3 w-3" /> ใกล้เต็ม
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">ใช้ไป</span>
                    <span className="font-semibold">
                      {thb(b.used)} / {thb(b.amount)}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className={
                        pct > 90
                          ? "h-full bg-destructive"
                          : pct > 70
                            ? "h-full bg-warning"
                            : "h-full bg-primary"
                      }
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>{pct}%</span>
                    <span>คงเหลือ {thb(b.amount - b.used)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
