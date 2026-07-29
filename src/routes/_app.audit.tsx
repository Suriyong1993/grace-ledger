import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { listAudit } from "@/services/church";
import { dayjs, fmtDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import type { AuditLog } from "@/lib/types";

export const Route = createFileRoute("/_app/audit")({
  head: () => ({ meta: [{ title: "Audit Logs" }] }),
  component: AuditPage,
});

function AuditPage() {
  const { can } = useAuth();
  const q = useQuery({ queryKey: ["audit"], queryFn: listAudit });
  if (!can("audit.view")) return <Navigate to="/dashboard" replace />;
  const rows = q.data ?? [];

  // Chronological feed — group consecutive entries by calendar day
  const groups: { key: string; label: string; items: AuditLog[] }[] = [];
  for (const a of rows) {
    const key = dayjs(a.at).format("YYYY-MM-DD");
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(a);
    } else {
      groups.push({ key, label: fmtDate(a.at), items: [a] });
    }
  }

  return (
    <div>
      <PageHeader
        kicker="องค์กร"
        title="บันทึกกิจกรรม"
        description={`กิจกรรมและการเปลี่ยนแปลงทั้งหมดในระบบ · ${rows.length} รายการ`}
        actions={
          <Badge
            variant="outline"
            className="gap-1.5 rounded-full border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success shadow-2xs"
          >
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
            <span>SHA-256 Verified Chain</span>
          </Badge>
        }
      />
      {q.isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="ยังไม่มีบันทึก"
          description="เมื่อมีการเพิ่มหรือแก้ไขข้อมูล รายการจะปรากฏที่นี่"
        />
      ) : (
        <div className="stagger space-y-6">
          {groups.map((g) => (
            <section
              key={g.key}
              className="rounded-sm border border-border/80 bg-card shadow-2xs overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-5 py-3">
                <p className="kicker text-muted-foreground/80">{g.label}</p>
                <span className="num-display text-[11px] font-semibold text-muted-foreground">
                  {g.items.length} รายการ
                </span>
              </div>
              {/* Timeline feed */}
              <ul className="relative divide-y divide-border/40 pl-14">
                {/* Vertical connector line */}
                <div className="pointer-events-none absolute inset-y-0 left-[2.75rem] w-px bg-border/40" />
                {g.items.map((a, idx) => (
                  <li key={a.id} className="relative flex gap-4 py-3 pr-5">
                    {/* Timeline dot */}
                    <div className="absolute -left-[1.625rem] top-[1.125rem] flex h-3 w-3 items-center justify-center">
                      <div className="h-2 w-2 rounded-full border border-primary/40 bg-primary/20" />
                    </div>
                    {/* Time */}
                    <span className="num-display absolute left-[-3.25rem] top-[0.875rem] w-10 text-right text-[10px] font-medium text-muted-foreground/60">
                      {dayjs(a.at).format("HH:mm")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug">
                        <span className="font-semibold text-foreground">{a.userName}</span>{" "}
                        <span className="text-muted-foreground">{a.action}</span>
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
                        {a.entity}
                        {a.details ? ` · ${a.details}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
