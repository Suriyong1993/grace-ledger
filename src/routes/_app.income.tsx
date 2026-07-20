import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Download, Trash2, CheckCircle2, ArrowDownCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataToolbar } from "@/components/shared/DataToolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyText } from "@/components/shared/MoneyText";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { approveIncome, createIncome, deleteIncome, listCategories, listFunds, listIncome } from "@/services/church";
import { useAuth } from "@/lib/auth";
import { fmtDate, today, thb } from "@/lib/format";
import { downloadCsv, toCsv } from "@/lib/csv";
import { AttachmentInput, AttachmentPreview, type AttachmentValue } from "@/components/shared/AttachmentInput";
import { Paperclip } from "lucide-react";

export const Route = createFileRoute("/_app/income")({
  head: () => ({ meta: [{ title: "รายรับ — ระบบจัดการการเงินคริสตจักร" }] }),
  component: IncomePage,
});

const schema = z.object({
  date: z.string().min(1, "กรุณาเลือกวันที่"),
  amount: z.coerce.number().positive("จำนวนต้องมากกว่า 0"),
  categoryId: z.string().min(1, "เลือกหมวดหมู่"),
  fundId: z.string().min(1, "เลือกกองทุน"),
  description: z.string().max(500).optional(),
});
type FormValues = z.infer<typeof schema>;

function IncomePage() {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [attachment, setAttachment] = useState<AttachmentValue | undefined>();

  const incomeQ = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const fundsQ = useQuery({ queryKey: ["funds"], queryFn: listFunds });

  const create = useMutation({
    mutationFn: (v: FormValues) => createIncome({
      ...v,
      description: v.description ?? "",
      attachmentName: attachment?.name,
      attachmentDataUrl: attachment?.dataUrl,
      attachmentType: attachment?.type,
      attachmentSize: attachment?.size,
    }, user!),
    onSuccess: () => {
      toast.success("บันทึกรายรับเรียบร้อย");
      qc.invalidateQueries({ queryKey: ["income"] });
      setOpen(false);
      setAttachment(undefined);
      form.reset({ date: today(), amount: 0, categoryId: "", fundId: "", description: "" });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteIncome(id, user!),
    onSuccess: () => { toast.success("ลบแล้ว"); qc.invalidateQueries({ queryKey: ["income"] }); },
  });

  const approve = useMutation({
    mutationFn: (id: string) => approveIncome(id, user!),
    onSuccess: () => { toast.success("อนุมัติแล้ว"); qc.invalidateQueries({ queryKey: ["income"] }); },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: today(), amount: 0, categoryId: "", fundId: "", description: "" },
  });

  const cats = (catsQ.data ?? []).filter((c) => c.kind === "income");
  const funds = fundsQ.data ?? [];
  const catName = (id: string) => cats.find((c) => c.id === id)?.name ?? "-";
  const fundName = (id: string) => funds.find((f) => f.id === id)?.name ?? "-";

  const rows = (incomeQ.data ?? []).filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return [r.description, catName(r.categoryId), fundName(r.fundId), String(r.amount)].some((v) => v?.toLowerCase().includes(s));
  });

  const total = rows.reduce((s, r) => s + r.amount, 0);

  const exportCsv = () => {
    const csv = toCsv(
      rows.map((r) => ({
        date: r.date, category: catName(r.categoryId), fund: fundName(r.fundId),
        amount: r.amount, status: r.status, description: r.description ?? "",
      })),
      { date: "วันที่", category: "หมวดหมู่", fund: "กองทุน", amount: "จำนวน", status: "สถานะ", description: "รายละเอียด" },
    );
    downloadCsv(`income-${today()}.csv`, csv);
  };

  return (
    <div>
      <PageHeader
        title="รายรับ"
        description={`รวมทั้งหมด ${thb(total)} จาก ${rows.length} รายการ`}
        actions={
          <>
            <Button variant="outline" className="rounded-2xl" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            {can("income.write") && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-2xl"><Plus className="h-4 w-4 mr-2" /> เพิ่มรายรับ</Button>
                </DialogTrigger>
                <DialogContent className="rounded-3xl">
                  <DialogHeader><DialogTitle>บันทึกรายรับ</DialogTitle></DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <FormField name="date" control={form.control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>วันที่</FormLabel>
                            <FormControl><Input type="date" className="rounded-xl" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField name="amount" control={form.control} render={({ field }) => (
                          <FormItem>
                            <FormLabel>จำนวนเงิน (บาท)</FormLabel>
                            <FormControl><Input type="number" step="0.01" className="rounded-xl" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <FormField name="categoryId" control={form.control} render={({ field }) => (
                        <FormItem>
                          <FormLabel>หมวดหมู่</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="เลือกหมวดหมู่" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField name="fundId" control={form.control} render={({ field }) => (
                        <FormItem>
                          <FormLabel>กองทุน</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="เลือกกองทุน" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {funds.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField name="description" control={form.control} render={({ field }) => (
                        <FormItem>
                          <FormLabel>รายละเอียด</FormLabel>
                          <FormControl><Textarea className="rounded-xl" rows={3} {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <div>
                        <p className="text-sm font-medium mb-2">เอกสารแนบ (ไม่บังคับ)</p>
                        <AttachmentInput value={attachment} onChange={setAttachment} />
                      </div>
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

      <DataToolbar query={q} onQueryChange={setQ} placeholder="ค้นหารายรับ..." />

      <Card className="rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          {incomeQ.isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6"><EmptyState icon={ArrowDownCircle} title="ยังไม่มีรายรับ" description="เริ่มบันทึกรายรับแรกของคุณเพื่อดูข้อมูลที่นี่" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead>กองทุน</TableHead>
                  <TableHead>รายละเอียด</TableHead>
                  <TableHead>ไฟล์แนบ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead>
                  <TableHead className="text-right">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                    <TableCell>{catName(r.categoryId)}</TableCell>
                    <TableCell>{fundName(r.fundId)}</TableCell>
                    <TableCell className="max-w-xs truncate">{r.description}</TableCell>
                    <TableCell>{r.attachmentDataUrl ? (
                      <AttachmentPreview value={{ name: r.attachmentName, dataUrl: r.attachmentDataUrl, type: r.attachmentType, size: r.attachmentSize }} />
                    ) : (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />—</span>
                    )}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right"><MoneyText value={r.amount} tone="income" /></TableCell>
                    <TableCell className="text-right space-x-1">
                      {can("income.approve") && r.status === "pending" && (
                        <Button size="sm" variant="ghost" onClick={() => approve.mutate(r.id)} aria-label="อนุมัติ">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        </Button>
                      )}
                      {can("income.write") && (
                        <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)} aria-label="ลบ">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
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