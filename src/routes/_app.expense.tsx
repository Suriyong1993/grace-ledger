import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Download,
  Trash2,
  CheckCircle2,
  ArrowUpCircle,
  ArrowUpRight,
  Clock,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataToolbar } from "@/components/shared/DataToolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyText } from "@/components/shared/MoneyText";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createExpense,
  deleteExpense,
  getChurchId,
  listCategories,
  listExpense,
  listFunds,
} from "@/services/church";
import { useAuth } from "@/lib/auth";
import { fmtDate, thb, today } from "@/lib/format";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  AttachmentInput,
  AttachmentPreview,
  type AttachmentValue,
} from "@/components/shared/AttachmentInput";
import { Receipt } from "lucide-react";
import { SmartReceiptScannerModal } from "@/components/receipts/SmartReceiptScannerModal";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { type Expense } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/expense")({
  head: () => ({ meta: [{ title: "รายจ่าย — ระบบจัดการการเงินคริสตจักร" }] }),
  component: ExpensePage,
});

const schema = z.object({
  date: z.string().min(1, "กรุณาเลือกวันที่"),
  amount: z.coerce.number().positive("จำนวนต้องมากกว่า 0"),
  categoryId: z.string().min(1, "เลือกหมวดหมู่"),
  fundId: z.string().min(1, "เลือกกองทุน"),
  vendor: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
});
type Values = z.infer<typeof schema>;

function ExpensePage() {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const [churchId, setChurchId] = useState<string>();
  const [open, setOpen] = useState(false);
  const [aiScannerOpen, setAiScannerOpen] = useState(false);
  const [q, setQ] = useState("");
  const [receipt, setReceipt] = useState<AttachmentValue | undefined>();

  // Load churchId for attachment uploads
  useEffect(() => {
    getChurchId().then(setChurchId);
  }, []);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  const expQ = useQuery({ queryKey: ["expense"], queryFn: listExpense });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const fundsQ = useQuery({ queryKey: ["funds"], queryFn: listFunds });

  const create = useMutation({
    mutationFn: (v: Values) =>
      createExpense(
        {
          ...v,
          attachmentName: receipt?.name,
          attachmentDataUrl: receipt?.url,
          attachmentStoragePath: receipt?.storagePath,
          attachmentType: receipt?.type,
          attachmentSize: receipt?.size,
        },
        user!,
      ),
    onSuccess: () => {
      toast.success("บันทึกรายจ่ายเรียบร้อย");
      qc.invalidateQueries({ queryKey: ["expense"] });
      setOpen(false);
      setReceipt(undefined);
      form.reset({
        date: today(),
        amount: 0,
        categoryId: "",
        fundId: "",
        vendor: "",
        description: "",
      });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteExpense(id, user!),
    onSuccess: () => {
      toast.success("ลบแล้ว");
      qc.invalidateQueries({ queryKey: ["expense"] });
    },
  });
  // Approve/reject happens in exactly one place: /approvals (with its
  // mandatory reason-on-reject + confirm-dialog friction, appropriate for an
  // irreversible financial action). This page only links there — no inline
  // one-click approve, no second competing path. See
  // docs/design/GRACE_LEDGER_VNEXT_MASTERPLAN.md §8 principle 7.

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: today(),
      amount: 0,
      categoryId: "",
      fundId: "",
      vendor: "",
      description: "",
    },
  });

  const cats = (catsQ.data ?? []).filter((c) => c.kind === "expense");
  const funds = fundsQ.data ?? [];
  const catName = (id: string) => cats.find((c) => c.id === id)?.name ?? "-";
  const fundName = (id: string) => funds.find((f) => f.id === id)?.name ?? "-";

  const rows = (expQ.data ?? []).filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return [
      r.description,
      r.vendor,
      catName(r.categoryId),
      fundName(r.fundId),
      String(r.amount),
    ].some((v) => v?.toLowerCase().includes(s));
  });
  const total = rows.reduce((s, r) => s + r.amount, 0);

  // Summary figures for the stat row (derived from unfiltered data)
  const allRows = expQ.data ?? [];
  const totalAll = allRows.reduce((s, r) => s + r.amount, 0);
  const pendingRows = allRows.filter((r) => r.status === "pending");
  const pendingTotal = pendingRows.reduce((s, r) => s + r.amount, 0);
  const approvedTotal = allRows
    .filter((r) => r.status === "approved")
    .reduce((s, r) => s + r.amount, 0);

  const exportCsv = () => {
    const csv = toCsv(
      rows.map((r) => ({
        date: r.date,
        category: catName(r.categoryId),
        fund: fundName(r.fundId),
        vendor: r.vendor ?? "",
        amount: r.amount,
        status: r.status,
        description: r.description ?? "",
      })),
      {
        date: "วันที่",
        category: "หมวดหมู่",
        fund: "กองทุน",
        vendor: "ผู้ขาย",
        amount: "จำนวน",
        status: "สถานะ",
        description: "รายละเอียด",
      },
    );
    downloadCsv(`expense-${today()}.csv`, csv);
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        kicker="รายการเงิน"
        title="รายจ่าย"
        description={`รวมทั้งหมด ${thb(total)} จาก ${rows.length} รายการ`}
        actions={
          <>
            <Button variant="outline" className="h-8" onClick={() => setAiScannerOpen(true)}>
              <Sparkles className="mr-1.5 h-4 w-4" strokeWidth={1.75} /> AI สแกนบิล/สลิป
            </Button>
            <Button variant="outline" className="h-8" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" strokeWidth={1.75} /> Export
            </Button>
            {can("expense.write") && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="h-8">
                    <Plus className="mr-1.5 h-4 w-4" strokeWidth={1.75} /> เพิ่มรายจ่าย
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>บันทึกรายจ่าย</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit((v) => create.mutate(v))}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FormField
                          name="date"
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>วันที่</FormLabel>
                              <FormControl>
                                <Input type="date" className="bg-card" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          name="amount"
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>จำนวนเงิน (บาท)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="num-display bg-card"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        name="categoryId"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>หมวดหมู่</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-card">
                                  <SelectValue placeholder="เลือกหมวดหมู่" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {cats.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        name="fundId"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>กองทุน</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-card">
                                  <SelectValue placeholder="เลือกกองทุน" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {funds.map((f) => (
                                  <SelectItem key={f.id} value={f.id}>
                                    {f.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        name="vendor"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ผู้ขาย / ผู้รับเงิน</FormLabel>
                            <FormControl>
                              <Input className="bg-card" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        name="description"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>รายละเอียด</FormLabel>
                            <FormControl>
                              <Textarea rows={3} className="bg-card" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div>
                        <p className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                          ใบเสร็จ / ใบกำกับภาษี
                        </p>
                        <AttachmentInput
                          value={receipt}
                          onChange={setReceipt}
                          label="ถ่ายรูปหรือแนบไฟล์ (JPG, PNG, PDF ไม่เกิน 10MB)"
                          capture
                          churchId={churchId}
                        />
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                          ยกเลิก
                        </Button>
                        <Button type="submit" disabled={create.isPending}>
                          บันทึก
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
      />

      {expQ.isError ? (
        <div className="flex items-center justify-between gap-4 rounded-card border border-destructive/30 bg-destructive/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">โหลดข้อมูลรายจ่ายไม่สำเร็จ</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => expQ.refetch()} className="shrink-0">
            ลองใหม่
          </Button>
        </div>
      ) : null}

      {expQ.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px]" />
          ))}
        </div>
      ) : (
        <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
          <StatCard
            label="รายจ่ายทั้งหมด"
            value={thb(totalAll)}
            tone="danger"
            icon={ArrowUpRight}
            hint={`${allRows.length} รายการ`}
          />
          <StatCard
            label="รออนุมัติ"
            value={thb(pendingTotal)}
            tone="primary"
            icon={Clock}
            hint={`${pendingRows.length} รายการ`}
          />
          <StatCard
            label="อนุมัติแล้ว"
            value={thb(approvedTotal)}
            tone="secondary"
            icon={CheckCircle2}
            hint="ยอดที่อนุมัติแล้ว"
          />
        </div>
      )}

      <DataToolbar query={q} onQueryChange={setQ} placeholder="ค้นหารายจ่าย..." />

      <section className="rounded-card border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-5 py-3">
          <p className="kicker text-muted-foreground/80">รายการรายจ่าย</p>
          <p className="num-display text-[11px] font-semibold text-muted-foreground">
            {rows.length} รายการ
          </p>
        </div>
        {expQ.isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-5 py-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="hidden h-4 w-32 sm:block" />
                <Skeleton className="hidden h-4 w-20 md:block" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4 md:p-5">
            <EmptyState
              icon={ArrowUpCircle}
              title="ยังไม่มีรายจ่าย"
              description="เริ่มบันทึกรายจ่ายแรก"
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5">วันที่</TableHead>
                <TableHead className="px-5">หมวดหมู่</TableHead>
                <TableHead className="px-5">ผู้ขาย</TableHead>
                <TableHead className="px-5">กองทุน</TableHead>
                <TableHead className="px-5">ใบเสร็จ</TableHead>
                <TableHead className="px-5">สถานะ</TableHead>
                <TableHead className="px-5 text-right">จำนวน</TableHead>
                <TableHead className="px-5 text-right">การจัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={r.id}
                  onClick={() => setSelectedExpense(r)}
                  className="cursor-pointer hover:bg-muted/40 transition-colors group"
                >
                  <TableCell className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                    {fmtDate(r.date)}
                  </TableCell>
                  <TableCell className="px-5 py-3 font-medium group-hover:text-primary transition-colors">
                    {catName(r.categoryId)}
                  </TableCell>
                  <TableCell className="max-w-xs truncate px-5 py-3 text-muted-foreground">
                    {r.vendor || <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="px-5 py-3">{fundName(r.fundId)}</TableCell>
                  <TableCell className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    {r.attachmentDataUrl ? (
                      <AttachmentPreview
                        value={{
                          name: r.attachmentName,
                          url: r.attachmentDataUrl,
                          type: r.attachmentType,
                          size: r.attachmentSize,
                        }}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-5 py-3">
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="px-5 py-3 text-right">
                    <MoneyText value={r.amount} tone="expense" />
                  </TableCell>
                  <TableCell className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {can("expense.write") && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 active-press"
                          onClick={() => remove.mutate(r.id)}
                          aria-label="ลบ"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" strokeWidth={1.75} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Voucher Inspector Slide-over Drawer */}
      <Sheet open={!!selectedExpense} onOpenChange={(v) => !v && setSelectedExpense(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
          <SheetHeader className="p-6 border-b border-border text-left">
            <div className="flex items-center justify-between">
              <span className="kicker">ใบสำคัญจ่าย (Voucher Inspector)</span>
              <StatusBadge status={selectedExpense?.status || "pending"} />
            </div>
            <SheetTitle className="text-xl font-semibold font-display mt-2">
              {selectedExpense?.vendor || selectedExpense?.description || "รายการรายจ่าย"}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              รหัสสำคัญจ่าย: {selectedExpense?.id}
            </SheetDescription>
          </SheetHeader>

          {selectedExpense && (
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {/* Approval Pipeline Stepper */}
              <div className="card-ledger p-4 bg-muted/20">
                <span className="kicker block mb-3">ขั้นตอนการอนุมัติ (Approval Stepper)</span>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex flex-col items-center gap-1">
                    <span className="h-6 w-6 rounded-full bg-success text-success-foreground grid place-items-center text-[10px] font-bold">
                      1
                    </span>
                    <span className="font-medium text-foreground">สร้างใบเบิก</span>
                  </div>
                  <div className="h-px flex-1 bg-border mx-2" />
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={cn(
                        "h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold",
                        selectedExpense.status === "pending"
                          ? "bg-warning text-warning-foreground"
                          : "bg-success text-success-foreground",
                      )}
                    >
                      2
                    </span>
                    <span className="font-medium text-foreground">พิจารณาอนุมัติ</span>
                  </div>
                  <div className="h-px flex-1 bg-border mx-2" />
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={cn(
                        "h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold",
                        selectedExpense.status === "approved"
                          ? "bg-success text-success-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      3
                    </span>
                    <span className="text-muted-foreground">เบิกจ่ายเรียบร้อย</span>
                  </div>
                </div>
              </div>

              {/* Amount Display Card */}
              <div className="card-ledger p-5 text-center">
                <span className="kicker">จำนวนเงินเบิกจ่าย</span>
                <p className="num-display font-display text-3xl font-bold text-destructive mt-1">
                  −฿{selectedExpense.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </p>
              </div>

              {/* Attachment Receipt Preview */}
              {selectedExpense.attachmentDataUrl && (
                <div className="space-y-2">
                  <span className="kicker">หลักฐานสลิป / ใบเสร็จแนบ</span>
                  <div className="card-ledger p-2 overflow-hidden bg-black/5 dark:bg-black/40">
                    <img
                      src={selectedExpense.attachmentDataUrl}
                      alt="Receipt Slip"
                      className="max-h-72 w-full object-contain rounded-xs"
                    />
                  </div>
                </div>
              )}

              {/* Details Data Grid */}
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">วันที่เบิกจ่าย</span>
                  <span className="font-medium text-foreground">
                    {fmtDate(selectedExpense.date)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">หมวดหมู่งบประมาณ</span>
                  <span className="font-medium text-foreground">
                    {catName(selectedExpense.categoryId)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">เบิกจ่ายจากกองทุน</span>
                  <span className="font-medium text-foreground">
                    {fundName(selectedExpense.fundId)}
                  </span>
                </div>
                {selectedExpense.vendor && (
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-muted-foreground">ร้านค้า / ผู้รับเงิน</span>
                    <span className="font-medium text-foreground">{selectedExpense.vendor}</span>
                  </div>
                )}
                {selectedExpense.description && (
                  <div className="py-2 border-b border-border/50">
                    <span className="text-muted-foreground block mb-1">
                      รายละเอียดโครงการ/วัตถุประสงค์
                    </span>
                    <p className="text-foreground leading-relaxed">{selectedExpense.description}</p>
                  </div>
                )}
              </div>

              {/* Approver Action Bar — redirect to /approvals for proper workflow */}
              {can("expense.approve") && selectedExpense.status === "pending" && (
                <div className="pt-4 border-t border-border">
                  <Button
                    asChild
                    variant="outline"
                    className="w-full border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                  >
                    <Link to="/approvals">
                      <ArrowUpRight className="h-4 w-4" />
                      <span>ไปที่หน้ารออนุมัติ</span>
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <SmartReceiptScannerModal open={aiScannerOpen} onOpenChange={setAiScannerOpen} />
    </div>
  );
}
