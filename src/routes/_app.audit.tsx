import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { listAudit } from "@/services/church";
import { fmtDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/audit")({
  head: () => ({ meta: [{ title: "Audit Logs" }] }),
  component: AuditPage,
});

function AuditPage() {
  const { can } = useAuth();
  const q = useQuery({ queryKey: ["audit"], queryFn: listAudit });
  if (!can("audit.view")) return <Navigate to="/dashboard" replace />;
  const rows = q.data ?? [];
  return (
    <div>
      <PageHeader title="Audit Logs" description="บันทึกกิจกรรมและการเปลี่ยนแปลง" />
      <Card className="rounded-3xl"><CardContent className="p-0">
        {rows.length === 0 ? <div className="p-6"><EmptyState icon={ScrollText} title="ยังไม่มีบันทึก" /></div> : (
          <ul className="divide-y">{rows.map((a) => (
            <li key={a.id} className="flex items-start gap-3 px-5 py-3.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><ScrollText className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{a.userName}</span>
                  <Badge variant="outline" className="rounded-full text-[10px]">{a.action}</Badge>
                  <Badge variant="outline" className="rounded-full text-[10px] bg-secondary/20">{a.entity}</Badge>
                </div>
                {a.details && <p className="text-xs text-muted-foreground mt-0.5 truncate">{a.details}</p>}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{fmtDateTime(a.at)}</span>
            </li>))}</ul>
        )}
      </CardContent></Card>
    </div>
  );
}