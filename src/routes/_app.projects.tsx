import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, CalendarDays, PiggyBank, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { listProjects } from "@/services/church";
import { fmtDate, thb } from "@/lib/format";
import { PROJECT_STATUS_LABEL, type ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/projects")({
  head: () => ({ meta: [{ title: "โครงการ" }] }),
  component: ProjectsPage,
});

/** Editorial status indicator — colored dot + ink label (mirrors StatusBadge). */
const STATUS_STYLE: Record<ProjectStatus, { dot: string; muted?: boolean }> = {
  planning: { dot: "bg-muted-foreground/50", muted: true },
  active: { dot: "bg-success" },
  paused: { dot: "bg-warning" },
  completed: { dot: "bg-primary", muted: true },
};

function ProjectsPage() {
  const q = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const projects = q.data ?? [];

  const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
  const totalUsed = projects.reduce((s, p) => s + p.used, 0);
  const activeCount = projects.filter((p) => p.status === "active").length;

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        kicker="กองทุน & งบประมาณ"
        title="โครงการ"
        description="ติดตามความคืบหน้าและงบประมาณของแต่ละโครงการ"
      />

      {q.isLoading ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-52" />
            ))}
          </div>
        </>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="ยังไม่มีโครงการ"
          description="เมื่อมีการสร้างโครงการ ความคืบหน้าและงบประมาณจะแสดงที่นี่"
        />
      ) : (
        <>
          {/* Page-level stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="โครงการทั้งหมด"
              value={projects.length}
              icon={Briefcase}
              hint={`${activeCount} กำลังดำเนินการ`}
            />
            <StatCard
              label="งบประมาณรวม"
              value={thb(totalBudget)}
              icon={PiggyBank}
              hint="งบที่ตั้งไว้ทุกโครงการ"
            />
            <StatCard
              label="ใช้ไปรวม"
              value={thb(totalUsed)}
              icon={TrendingUp}
              hint="เบิกจ่ายแล้วทุกโครงการ"
            />
          </div>

          {/* Project ledger cards */}
          <div className="stagger grid gap-4 md:grid-cols-2">
            {projects.map((p) => {
              const pct = Math.min(100, Math.round((p.used / p.budget) * 100));
              const st = STATUS_STYLE[p.status] ?? STATUS_STYLE.planning;
              return (
                <article key={p.id} className="card-ledger flex flex-col">
                  <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                      {p.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {p.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium",
                        st.muted ? "text-muted-foreground" : "text-foreground",
                      )}
                    >
                      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                      {PROJECT_STATUS_LABEL[p.status]}
                    </span>
                  </div>

                  <div className="flex-1 space-y-4 px-5 py-4">
                    <div>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="text-xs text-muted-foreground">ความคืบหน้า</span>
                        <span className="num-display text-xs font-medium text-foreground">
                          {p.progress}%
                        </span>
                      </div>
                      <div className="h-1 bg-muted">
                        <div
                          className="h-full bg-primary transition-all duration-200"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="text-xs text-muted-foreground">งบประมาณ</span>
                        <span className="num-display text-xs font-medium text-foreground">
                          {thb(p.used)}{" "}
                          <span className="font-normal text-muted-foreground">
                            / {thb(p.budget)}
                          </span>
                        </span>
                      </div>
                      <div className="h-1 bg-muted">
                        <div
                          className={cn(
                            "h-full transition-all duration-200",
                            pct > 90 ? "bg-destructive" : "bg-primary",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between gap-3 text-[11px] text-muted-foreground">
                        <span className="num-display">ใช้ไป {pct}%</span>
                        <span className="num-display">คงเหลือ {thb(p.budget - p.used)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                    <span className="num-display">
                      {fmtDate(p.startDate)}
                      {p.endDate ? ` – ${fmtDate(p.endDate)}` : ""}
                    </span>
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
