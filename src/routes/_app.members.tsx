import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataToolbar } from "@/components/shared/DataToolbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { listMembers } from "@/services/church";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/members")({
  head: () => ({ meta: [{ title: "สมาชิก" }] }),
  component: MembersPage,
});

function MembersPage() {
  const q = useQuery({ queryKey: ["members"], queryFn: listMembers });
  const [query, setQuery] = useState("");
  const rows = (q.data ?? []).filter((m) => {
    if (!query) return true;
    const s = query.toLowerCase();
    return [m.name, m.family, m.department, m.phone, m.email].some((v) =>
      v?.toLowerCase().includes(s),
    );
  });
  return (
    <div>
      <PageHeader
        kicker="องค์กร"
        title="สมาชิก"
        description={`สมาชิกทั้งหมด ${rows.length} คน`}
      />
      <DataToolbar query={query} onQueryChange={setQuery} placeholder="ค้นหาสมาชิก..." />
      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="ไม่พบสมาชิก"
          description="ลองค้นหาด้วยชื่อ ครอบครัว แผนก หรือเบอร์โทร"
        />
      ) : (
        <section className="card-ledger animate-fade-up">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <p className="kicker">รายชื่อสมาชิก</p>
            <span className="num-display text-xs text-muted-foreground">{rows.length} คน</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>ชื่อ</TableHead>
                <TableHead>ครอบครัว</TableHead>
                <TableHead>แผนก</TableHead>
                <TableHead>เบอร์โทร</TableHead>
                <TableHead>อีเมล</TableHead>
                <TableHead>สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="grid h-8 w-8 shrink-0 place-items-center bg-primary/10 text-xs font-semibold text-primary"
                      >
                        {m.name[0]}
                      </span>
                      <span className="font-medium text-foreground">{m.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.family || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{m.department || "—"}</TableCell>
                  <TableCell className="num-display whitespace-nowrap text-muted-foreground">
                    {m.phone || "—"}
                  </TableCell>
                  <TableCell className="max-w-44 truncate text-muted-foreground">
                    {m.email || "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium",
                        m.status === "active" ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          m.status === "active" ? "bg-success" : "bg-muted-foreground/40",
                        )}
                      />
                      {m.status === "active" ? "ใช้งาน" : "ระงับ"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}
