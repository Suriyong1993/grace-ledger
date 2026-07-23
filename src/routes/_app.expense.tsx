import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Download, Trash2, CheckCircle2, XCircle, ArrowUpCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataToolbar } from "@/components/shared/DataToolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyText } from "@/components/shared/MoneyText";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  listCategories,
  listExpense,
  listFunds,
  setExpenseStatus,
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
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [receipt, setReceipt] = useState<AttachmentValue | undefined>();

  const expQ = useQuery({ queryKey: ["expense"], queryFn: listExpense });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const fundsQ = useQuery({ queryKey: ["funds"], queryFn: listFunds });

  const create = useMutation({
    mutationFn: (v: Values) =>
      createExpense(
        {
          ...v,
          attachmentName: receipt?.name,
          attachmentDataUrl: receipt?.dataUrl,
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
  const setStatus = useMutation({
    mutationFn: ({ id, s }: { id: string; s: "approved" | "rejected" }) =>
      setExpenseStatus(id, s, user!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense"] });
    },
  });

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
    <div>
      <PageHeader
        title="รายจ่าย"
        description={`รวมทั้งหมด ${thb(total)} จาก ${rows.length} รายการ`}
        actions={
          <>
            <Button variant="outline" className="rounded-2xl" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            {can("expense.write") && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-2xl">
                    <Plus className="h-4 w-4 mr-2" /> เพิ่มรายจ่าย
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-3xl">
                  <DialogHeader>
                    <DialogTitle>บันทึกรายจ่าย</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit((v) => create.mutate(v))}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          name="date"
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>วันที่</FormLabel>
                              <FormControl>
                                <Input type="date" className="rounded-xl" {...field} />
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
                                  className="rounded-xl"
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
                                <SelectTrigger className="rounded-xl h-11">
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
                                <SelectTrigger className="rounded-xl h-11">
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
                              <Input className="rounded-xl" {...field} />
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
                              <Textarea className="rounded-xl" rows={3} {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div>
                        <p className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Receipt className="h-4 w-4" /> ใบเสร็จ / ใบกำกับภาษี
                        </p>
                        <AttachmentInput
                          value={receipt}
                          onChange={setReceipt}
                          label="ถ่ายรูปหรือแนบไฟล์ (JPG, PNG, PDF ไม่เกิน 10MB)"
                          capture
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

      <DataToolbar query={q} onQueryChange={setQ} placeholder="ค้นหารายจ่าย..." />

      <Card className="rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          {expQ.isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={ArrowUpCircle}
                title="ยังไม่มีรายจ่าย"
                description="เริ่มบันทึกรายจ่ายแรก"
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead>ผู้ขาย</TableHead>
                  <TableHead>กองทุน</TableHead>
                  <TableHead>ใบเสร็จ</TableHead>
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
                    <TableCell className="max-w-xs truncate">{r.vendor}</TableCell>
                    <TableCell>{fundName(r.fundId)}</TableCell>
                    <TableCell>
                      {r.attachmentDataUrl ? (
                        <AttachmentPreview
                          value={{
                            name: r.attachmentName,
                            dataUrl: r.attachmentDataUrl,
                            type: r.attachmentType,
                            size: r.attachmentSize,
                          }}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyText value={r.amount} tone="expense" />
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {can("expense.approve") && r.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setStatus.mutate({ id: r.id, s: "approved" })}
                            aria-label="อนุมัติ"
                          >
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setStatus.mutate({ id: r.id, s: "rejected" })}
                            aria-label="ปฏิเสธ"
                          >
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {can("expense.write") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove.mutate(r.id)}
                          aria-label="ลบ"
                        >
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
