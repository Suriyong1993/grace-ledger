import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Download, Phone, Mail, ChevronRight, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataToolbar } from "@/components/shared/DataToolbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { MemberFormDialog } from "@/components/shared/MemberFormDialog";
import { listMembers, listOffering } from "@/services/church";
import { thb, fmtDate, today } from "@/lib/format";
import { downloadCsv, toCsv } from "@/lib/csv";
import { type Member } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/members")({
  head: () => ({ meta: [{ title: "สมาชิก — ระบบจัดการการเงินคริสตจักร" }] }),
  component: MembersPage,
});

export function MembersPage() {
  const membersQ = useQuery({ queryKey: ["members"], queryFn: listMembers });
  const offeringQ = useQuery({ queryKey: ["offering"], queryFn: listOffering });

  const [query, setQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const members = membersQ.data ?? [];
  const offerings = offeringQ.data ?? [];

  const rows = members.filter((m) => {
    if (!query) return true;
    const s = query.toLowerCase();
    return [m.name, m.family, m.department, m.phone, m.email].some((v) =>
      v?.toLowerCase().includes(s),
    );
  });

  // Calculate giving total per member
  const getMemberOfferings = (memberId: string) => {
    return offerings.filter((o) => o.memberId === memberId);
  };

  const getMemberTotal = (memberId: string) => {
    return getMemberOfferings(memberId).reduce((sum, o) => sum + o.amount, 0);
  };

  // Real CSV export of a member's giving history — a genuine "ใบอนุโมทนาบัตร"
  // PDF generator does not exist yet, so this does not pretend to be one; it
  // gives the treasurer real, complete source data instead of a fake success
  // toast that recorded nothing (see docs/design/GRACE_LEDGER_VNEXT_MASTERPLAN.md §8.4).
  const exportGivingHistory = (member: Member) => {
    const rows = getMemberOfferings(member.id);
    if (rows.length === 0) {
      toast.error("ไม่มีประวัติการถวายให้ส่งออก");
      return;
    }
    const csv = toCsv(
      rows.map((o) => ({ date: o.date, amount: o.amount, note: o.note ?? "" })),
      { date: "วันที่", amount: "จำนวนเงิน", note: "หมายเหตุ" },
    );
    downloadCsv(`giving-history-${member.name}-${today()}.csv`, csv);
    toast.success(`ส่งออกประวัติการถวายของ ${member.name} เรียบร้อย`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="องค์กร"
        title="สมาชิก"
        description={`รายชื่อสมาชิกทั้งหมด ${rows.length} คน · คลิกเพื่อดูประวัติการถวายและส่งออกไฟล์`}
        actions={<MemberFormDialog />}
      />
      <DataToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="ค้นหาสมาชิกด้วยชื่อ, ครอบครัว, หรือเบอร์โทร..."
      />

      {membersQ.isError ? (
        <div className="flex items-center justify-between gap-4 rounded-card border border-destructive/30 bg-destructive/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">โหลดรายชื่อสมาชิกไม่สำเร็จ</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => membersQ.refetch()}>
            ลองใหม่
          </Button>
        </div>
      ) : null}

      {membersQ.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="ไม่พบสมาชิก"
          description="ลองค้นหาด้วยชื่อ ครอบครัว แผนก หรือเบอร์โทร"
        />
      ) : (
        <section className="card-ledger">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <p className="kicker">รายชื่อสมาชิก</p>
            <span className="num-display text-xs text-muted-foreground">{rows.length} คน</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">ชื่อ-นามสกุล</TableHead>
                <TableHead>ครอบครัว</TableHead>
                <TableHead>แผนก</TableHead>
                <TableHead>เบอร์โทร</TableHead>
                <TableHead className="text-right">ยอดถวายสะสม (YTD)</TableHead>
                <TableHead className="pr-5 text-right">การจัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => {
                const totalGiving = getMemberTotal(m.id);
                return (
                  <TableRow
                    key={m.id}
                    onClick={() => setSelectedMember(m)}
                    className="cursor-pointer hover:bg-muted/40 transition-colors group"
                  >
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-primary/10 text-xs font-semibold text-primary"
                        >
                          {m.name[0]}
                        </span>
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {m.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.family || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{m.department || "—"}</TableCell>
                    <TableCell className="num-display whitespace-nowrap text-muted-foreground">
                      {m.phone || "—"}
                    </TableCell>
                    <TableCell className="num-display font-semibold text-right text-success">
                      {thb(totalGiving)}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <ChevronRight className="h-4 w-4 inline text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      )}

      {/* Member Tithe Profile Drawer */}
      <Sheet open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-6 border-b border-border text-left">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-primary text-primary-foreground font-bold">
                {selectedMember?.name[0]}
              </div>
              <div>
                <SheetTitle className="text-lg font-semibold font-display">
                  {selectedMember?.name}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  ครอบครัว {selectedMember?.family || "—"} • แผนก{" "}
                  {selectedMember?.department || "—"}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {selectedMember && (
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {/* Total Giving Stat Card */}
              <div className="card-ledger p-4 text-center bg-muted/20">
                <span className="kicker">ยอดถวายสะสมประจำปี (YTD)</span>
                <p className="num-display font-display text-3xl font-bold text-success mt-1">
                  {thb(getMemberTotal(selectedMember.id))}
                </p>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 text-xs">
                <span className="kicker block mb-1">ข้อมูลติดต่อ</span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span className="num-display">{selectedMember.phone || "ไม่ระบุเบอร์โทร"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span>{selectedMember.email || "ไม่ระบุอีเมล"}</span>
                </div>
              </div>

              {/* Giving History Stream */}
              <div className="space-y-3">
                <span className="kicker block">
                  ประวัติการถวาย ({getMemberOfferings(selectedMember.id).length} รายการ)
                </span>
                <div className="divide-y divide-border/60 border border-border rounded-md overflow-hidden bg-card text-xs">
                  {getMemberOfferings(selectedMember.id).length === 0 ? (
                    <div className="py-6 text-center text-muted-foreground">
                      ยังไม่มีประวัติการถวายระบุชื่อ
                    </div>
                  ) : (
                    getMemberOfferings(selectedMember.id).map((o) => (
                      <div key={o.id} className="flex items-center justify-between p-3">
                        <div>
                          <p className="font-medium text-foreground">{fmtDate(o.date)}</p>
                          <p className="text-muted-foreground text-[11px]">
                            {o.note || "เงินถวายทั่วไป"}
                          </p>
                        </div>
                        <span className="num-display font-semibold text-success">
                          {thb(o.amount)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Export giving history — real CSV, for producing a tax receipt manually */}
              <div className="pt-4 border-t border-border">
                <Button
                  className="w-full h-10 gap-2 active-press cursor-pointer"
                  variant="outline"
                  onClick={() => exportGivingHistory(selectedMember)}
                >
                  <Download className="h-4 w-4" />
                  <span>ส่งออกประวัติการถวาย (CSV)</span>
                </Button>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  ใบอนุโมทนาบัตร PDF ยังไม่พร้อมใช้งาน — ใช้ไฟล์นี้จัดทำเอกสารได้
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
