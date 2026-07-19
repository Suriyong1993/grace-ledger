import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataToolbar } from "@/components/shared/DataToolbar";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { listMembers } from "@/services/church";

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
    return [m.name, m.family, m.department, m.phone, m.email].some((v) => v?.toLowerCase().includes(s));
  });
  return (
    <div>
      <PageHeader title="สมาชิก" description={`สมาชิกทั้งหมด ${rows.length} คน`} />
      <DataToolbar query={query} onQueryChange={setQuery} placeholder="ค้นหาสมาชิก..." />
      <Card className="rounded-3xl overflow-hidden"><CardContent className="p-0">
        {rows.length === 0 ? <div className="p-6"><EmptyState icon={Users} title="ไม่พบสมาชิก" /></div> : (
          <Table>
            <TableHeader><TableRow><TableHead>ชื่อ</TableHead><TableHead>ครอบครัว</TableHead><TableHead>แผนก</TableHead><TableHead>เบอร์โทร</TableHead><TableHead>อีเมล</TableHead><TableHead>สถานะ</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>{m.family}</TableCell>
                <TableCell>{m.department}</TableCell>
                <TableCell>{m.phone}</TableCell>
                <TableCell className="truncate max-w-40">{m.email}</TableCell>
                <TableCell><Badge variant="outline" className={m.status === "active" ? "rounded-full bg-success/10 text-success border-success/30" : "rounded-full"}>{m.status === "active" ? "ใช้งาน" : "ระงับ"}</Badge></TableCell>
              </TableRow>))}</TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}