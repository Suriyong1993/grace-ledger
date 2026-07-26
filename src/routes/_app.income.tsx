import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Download, Trash2, CheckCircle2, ArrowDownCircle, HandHeart } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataToolbar } from "@/components/shared/DataToolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyText } from "@/components/shared/MoneyText";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  approveIncome,
  createIncome,
  deleteIncome,
  listCategories,
  listFunds,
  listIncome,
} from "@/services/church";
import { listOffering, listOfferingCategories } from "@/services/church";
import { useAuth } from "@/lib/auth";
import { fmtDate, today, thb } from "@/lib/format";
import { downloadCsv, toCsv } from "@/lib/csv";
import { CHANNEL_LABEL } from "@/lib/types";
import {
  AttachmentInput,
  AttachmentPreview,
  type AttachmentValue,
} from "@/components/shared/AttachmentInput";
import { Paperclip } from "lucide-react";

export const Route = createFileRoute("/_app/income")({
  head: () => ({ meta: [{ title: "รายรับทั้งหมด — ระบบจัดการการเงินคริสตจักร" }] }),
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
  const offeringQ = useQuery({ queryKey: ["offering"], queryFn: listOffering });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const fundsQ = useQuery({ queryKey: ["funds"], queryFn: listFunds });
  const offCatsQ = useQuery({ queryKey: ["offering-categories"], queryFn: listOfferingCategories });

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      createIncome(
        {
          ...v,
          description: v.description ?? "",
          attachmentName: attachment?.name,
          attachmentDataUrl: attachment?.url,
          attachmentType: attachment?.type,
          attachmentSize: attachment?.size,
        },
        user!,
      ),
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
    onSuccess: () => {
      toast.success("ลบแล้ว");
      qc.invalidateQueries({ queryKey: ["income"] });
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) => approveIncome(id, user!),
    onSuccess: () => {
      toast.success("อนุมัติแล้ว");
      qc.invalidateQueries({ queryKey: ["income"] });
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: today(), amount: 0, categoryId: "", fundId: "", description: "" },
  });

  // Lookup helpers
  const cats = (catsQ.data ?? []).filter((c) => c.kind === "income");
  const funds = fundsQ.data ?? [];
  const offCats = offCatsQ.data ?? [];
  const offCatName = (id: string) => offCats.find((c) => c.id === id)?.name ?? id;
  const catName = (id: string) => cats.find((c) => c.id === id)?.name ?? "-";
  const fundName = (id: string) => funds.find((f) => f.id === id)?.name ?? "-";

  // Merge income + offering into one combined list
  const incomes = incomeQ.data ?? [];
  const offerings = offeringQ.data ?? [];

  const combined = [
    ...incomes.map((r) => ({
      id: r.id,
      date: r.date,
      category: catName(r.categoryId),
      fund: fundName(r.fundId),
      amount: r.amount,
      status: r.status,
      description: r.description ?? "",
      isOffering: false as const,
      channel: undefined as string | undefined,
      hasAttachment: !!r.attachmentDataUrl,
    })),
    ...offerings.map((r) => ({
      id: r.id,
      date: r.date,
      category: offCatName(r.categoryId),
      fund: fundName(r.fundId),
      amount: r.amount,
      status: "approved" as const,
      description: r.note ?? "",
      isOffering: true as const,
      channel: CHANNEL_LABEL[r.channel],
      hasAttachment: false,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const rows = combined.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return [r.category, r.fund, r.description, String(r.amount)].some((v) =>
      v.toLowerCase().includes(s),
    );
  });

  const totalIncome = incomes.reduce((s, r) => s + r.amount, 0);
  const totalOffering = offerings.reduce((s, r) => s + r.amount, 0);
  const totalAll = totalIncome + totalOffering;

  const exportCsv = () => {
    const csv = toCsv(
      rows.map((r) => ({
        date: r.date,
        type: r.isOffering ? "เงินถวาย" : "รายรับ",
        category: r.category,
        channel: r.channel ?? "-",
        fund: r.fund,
        amount: r.amount,
        description: r.description,
      })),
      {
        date: "วันที่",
        type: "ประเภท",
        category: "หมวดหมู่",
        channel: "ช่องทาง",
        fund: "กองทุน",
        amount: "จำนวน",
        description: "รายละเอียด",
      },
    );
    downloadCsv(`income-all-${today()}.csv`, csv);
  };

  return (
    <div>
      <PageHeader
        title="รายรับทั้งหมด"
        description={`รายรับ ${thb(totalIncome)} + เงินถวาย ${thb(totalOffering)} = ${thb(totalAll)} จาก ${rows.length} รายการ`}
        actions={
          <>
            <Button variant="outline" className="" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            {can("income.write") && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="">
                    <Plus className="h-4 w-4 mr-2" /> เพิ่มรายรับ
                  </Button>
                </DialogTrigger>
                <DialogContent className="">
                  <DialogHeader>
                    <DialogTitle>บันทึกรายรับ</DialogTitle>
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
                        <p className="text-sm font-medium mb-2">เอกสารแนบ (ไม่บังคับ)</p>
                        <AttachmentInput value={attachment} onChange={setAttachment} />
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

      <DataToolbar query={q} onQueryChange={setQ} placeholder="ค้นหารายรับทั้งหมด..." />

      <Card className=" overflow-hidden">
        <CardContent className="p-0">
          {incomeQ.isLoading || offeringQ.isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={ArrowDownCircle}
                title="ยังไม่มีรายการ"
                description="เริ่มบันทึกรายรับหรือเงินถวายเพื่อดูข้อมูลที่นี่"
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead>ช่องทาง</TableHead>
                  <TableHead>กองทุน</TableHead>
                  <TableHead>รายละเอียด</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className={r.isOffering ? "bg-primary/[0.02]" : ""}>
                    <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                    <TableCell>
                      {r.isOffering ? (
                        <Badge variant="secondary" className="rounded-full text-[10px] gap-1">
                          <HandHeart className="h-3 w-3" /> เงินถวาย
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full text-[10px]">
                          <ArrowDownCircle className="h-3 w-3 mr-0.5" /> รายรับ
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{r.category}</TableCell>
                    <TableCell>
                      {r.channel ?? <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>{r.fund}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {r.description || <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {r.isOffering ? (
                        <StatusBadge status="approved" />
                      ) : (
                        <StatusBadge status={r.status} />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyText value={r.amount} tone="income" />
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
