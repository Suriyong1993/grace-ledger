import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Download, Trash2, HandHeart } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataToolbar } from "@/components/shared/DataToolbar";
import { MoneyText } from "@/components/shared/MoneyText";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createOffering, deleteOffering, listFunds, listMembers, listOffering } from "@/services/church";
import { useAuth } from "@/lib/auth";
import { fmtDate, thb, today } from "@/lib/format";
import { downloadCsv, toCsv } from "@/lib/csv";
import { CHANNEL_LABEL, OFFERING_LABEL, type OfferingType, type PaymentChannel } from "@/lib/types";

export const Route = createFileRoute("/_app/offering")({
  head: () => ({ meta: [{ title: "เงินถวาย — ระบบจัดการการเงินคริสตจักร" }] }),
  component: OfferingPage,
});

const schema = z.object({
  date: z.string().min(1),
  amount: z.coerce.number().positive("จำนวนต้องมากกว่า 0"),
  type: z.enum(["sunday","mission","building","special","youth","children","online"] as const),
  channel: z.enum(["cash","bank","qr"] as const),
  fundId: z.string().min(1),
  memberId: z.string().optional(),
  note: z.string().max(500).optional(),
});
type Values = z.infer<typeof schema>;

function OfferingPage() {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const offQ = useQuery({ queryKey: ["offering"], queryFn: listOffering });
  const fundsQ = useQuery({ queryKey: ["funds"], queryFn: listFunds });
  const membersQ = useQuery({ queryKey: ["members"], queryFn: listMembers });

  const create = useMutation({
    mutationFn: (v: Values) => createOffering({ ...v, memberId: v.memberId || undefined }, user!),
    onSuccess: () => { toast.success("บันทึกเงินถวายเรียบร้อย"); qc.invalidateQueries({ queryKey: ["offering"] }); setOpen(false); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteOffering(id, user!),
    onSuccess: () => { toast.success("ลบแล้ว"); qc.invalidateQueries({ queryKey: ["offering"] }); },
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { date: today(), amount: 0, type: "sunday", channel: "cash", fundId: "", memberId: "", note: "" },
  });

  const funds = fundsQ.data ?? [];
  const members = membersQ.data ?? [];
  const fundName = (id: string) => funds.find((f) => f.id === id)?.name ?? "-";
  const memberName = (id?: string) => (id ? members.find((m) => m.id === id)?.name : undefined);

  const rows = (offQ.data ?? []).filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return [OFFERING_LABEL[r.type], fundName(r.fundId), memberName(r.memberId), String(r.amount)].some((v) => v?.toLowerCase().includes(s));
  });
  const total = rows.reduce((s, r) => s + r.amount, 0);

  const exportCsv = () => {
    const csv = toCsv(
      rows.map((r) => ({ date: r.date, type: OFFERING_LABEL[r.type], channel: CHANNEL_LABEL[r.channel], fund: fundName(r.fundId), member: memberName(r.memberId) ?? "", amount: r.amount })),
      { date: "วันที่", type: "ประเภท", channel: "ช่องทาง", fund: "กองทุน", member: "สมาชิก", amount: "จำนวน" },
    );
    downloadCsv(`offering-${today()}.csv`, csv);
  };

  const types: OfferingType[] = ["sunday","mission","building","special","youth","children","online"];
  const channels: PaymentChannel[] = ["cash","bank","qr"];

  return (
    <div>
      <PageHeader
        title="เงินถวาย"
        description={`รวมทั้งหมด ${thb(total)} จาก ${rows.length} รายการ`}
        actions={
          <>
            <Button variant="outline" className="rounded-2xl" onClick={exportCsv}><Download className="h-4 w-4 mr-2" /> Export</Button>
            {can("offering.write") && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button className="rounded-2xl"><Plus className="h-4 w-4 mr-2" /> บันทึกเงินถวาย</Button></DialogTrigger>
                <DialogContent className="rounded-3xl">
                  <DialogHeader><DialogTitle>บันทึกเงินถวาย</DialogTitle></DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <FormField name="date" control={form.control} render={({ field }) => (
                          <FormItem><FormLabel>วันที่</FormLabel><FormControl><Input type="date" className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField name="amount" control={form.control} render={({ field }) => (
                          <FormItem><FormLabel>จำนวนเงิน</FormLabel><FormControl><Input type="number" step="0.01" className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField name="type" control={form.control} render={({ field }) => (
                          <FormItem><FormLabel>ประเภท</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>{types.map((t) => <SelectItem key={t} value={t}>{OFFERING_LABEL[t]}</SelectItem>)}</SelectContent>
                            </Select><FormMessage /></FormItem>
                        )} />
                        <FormField name="channel" control={form.control} render={({ field }) => (
                          <FormItem><FormLabel>ช่องทาง</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>{channels.map((c) => <SelectItem key={c} value={c}>{CHANNEL_LABEL[c]}</SelectItem>)}</SelectContent>
                            </Select><FormMessage /></FormItem>
                        )} />
                      </div>
                      <FormField name="fundId" control={form.control} render={({ field }) => (
                        <FormItem><FormLabel>กองทุน</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="เลือกกองทุน" /></SelectTrigger></FormControl>
                            <SelectContent>{funds.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                          </Select><FormMessage /></FormItem>
                      )} />
                      <FormField name="memberId" control={form.control} render={({ field }) => (
                        <FormItem><FormLabel>สมาชิก (ถ้ามี)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ""}>
                            <FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="ไม่ระบุ" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                            </SelectContent>
                          </Select></FormItem>
                      )} />
                      <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>ยกเลิก</Button>
                        <Button type="submit" disabled={create.isPending}>บันทึก</Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
      />

      <DataToolbar query={q} onQueryChange={setQ} placeholder="ค้นหาเงินถวาย..." />

      <Card className="rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          {offQ.isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : rows.length === 0 ? (
            <div className="p-6"><EmptyState icon={HandHeart} title="ยังไม่มีเงินถวาย" description="เริ่มบันทึกเงินถวายวันอาทิตย์" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead><TableHead>ประเภท</TableHead><TableHead>ช่องทาง</TableHead>
                  <TableHead>กองทุน</TableHead><TableHead>สมาชิก</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead><TableHead className="text-right">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                    <TableCell>{OFFERING_LABEL[r.type]}</TableCell>
                    <TableCell><Badge variant="outline" className="rounded-full">{CHANNEL_LABEL[r.channel]}</Badge></TableCell>
                    <TableCell>{fundName(r.fundId)}</TableCell>
                    <TableCell className="max-w-xs truncate">{memberName(r.memberId) ?? "-"}</TableCell>
                    <TableCell className="text-right"><MoneyText value={r.amount} tone="income" /></TableCell>
                    <TableCell className="text-right">
                      {can("offering.write") && <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)} aria-label="ลบ"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}