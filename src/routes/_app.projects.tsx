import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listProjects } from "@/services/church";
import { fmtDate, thb } from "@/lib/format";
import { PROJECT_STATUS_LABEL } from "@/lib/types";

export const Route = createFileRoute("/_app/projects")({
  head: () => ({ meta: [{ title: "โครงการ" }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const q = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const projects = q.data ?? [];
  return (
    <div>
      <PageHeader title="โครงการ" description="ติดตามความคืบหน้าและงบประมาณ" />
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((p) => {
          const pct = Math.min(100, Math.round((p.used / p.budget) * 100));
          return (
            <Card key={p.id} className="">
              <CardHeader className="flex flex-row items-start justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="grid h-11 w-11 shrink-0 place-items-center  bg-primary/10 text-primary">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-lg truncate">{p.name}</CardTitle>
                    {p.description && (
                      <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="rounded-full shrink-0">
                  {PROJECT_STATUS_LABEL[p.status]}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">ความคืบหน้า</span>
                    <span>{p.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${p.progress}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">งบประมาณ</span>
                    <span>
                      {thb(p.used)} / {thb(p.budget)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={pct > 90 ? "h-full bg-destructive" : "h-full bg-secondary"}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(p.startDate)}
                  {p.endDate ? ` – ${fmtDate(p.endDate)}` : ""}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
