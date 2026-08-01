import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Download, ArrowDownCircle, ArrowDownLeft, HandHeart, Wallet } from "lucide-react";
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
  createIncome,
  deleteIncome,
  getChurchId,
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
  const [churchId, setChurchId] = useState<string>();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [attachment, setAttachment] = useState<AttachmentValue | undefined>();

  // Load churchId for attachment uploads
  useEffect(() => {
    getChurchId().then(setChurchId);
  }, []);

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
          attachmentStoragePath: attachment?.storagePath,
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
  const isLoading = incomeQ.isLoading || offeringQ.isLoading;

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
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        kicker="รายการเงิน"
        title="รายรับ"
        description={`บันทึกรายรับและเงินถวายของคริสตจักร · แสดง ${rows.length} รายการ`}
        actions={
          <>
            <Button variant="outline" className="h-8" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" strokeWidth={1.75} /> Export
            </Button>
            {can("income.write") && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="h-8">
                    <Plus className="mr-1.5 h-4 w-4" strokeWidth={1.75} /> เพิ่มรายรับ
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>บันทึกรายรับ</DialogTitle>
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
                                <Input type="date" className="bg-card shadow-none" {...field} />
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
                                  className="num-display bg-card shadow-none"
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
                                <SelectTrigger className="bg-card shadow-none">
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
                                <SelectTrigger className="bg-card shadow-none">
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
                              <Textarea rows={3} className="bg-card shadow-none" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div>
                        <p className="text-sm font-medium mb-2">เอกสารแนบ (ไม่บังคับ)</p>
                        <AttachmentInput
                          value={attachment}
                          onChange={setAttachment}
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

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px]" />
          ))}
        </div>
      ) : (
        <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
          <StatCard
            label="รายรับ"
            value={thb(totalIncome)}
            tone="success"
            icon={ArrowDownLeft}
            hint={`${incomes.length} รายการ`}
          />
          <StatCard
            label="เงินถวาย"
            value={thb(totalOffering)}
            tone="primary"
            icon={HandHeart}
            hint={`${offerings.length} รายการ`}
          />
          <StatCard
            label="รวมทั้งหมด"
            value={thb(totalAll)}
            tone="secondary"
            icon={Wallet}
            hint={`รวม ${combined.length} รายการ`}
          />
        </div>
      )}

      <DataToolbar query={q} onQueryChange={setQ} placeholder="ค้นหารายรับหรือเงินถวาย..." />

      <section className="rounded-sm border border-border/80 bg-card shadow-2xs overflow-hidden animate-fade-up">
        <div className="flex items-center justify-between border-b border-border/80 bg-muted/20 px-5 py-3.5">
          <p className="kicker font-medium text-muted-foreground/80">รายการทั้งหมด</p>
          <p className="num-display text-xs font-semibold text-muted-foreground">
            {rows.length} รายการ
          </p>
        </div>
        {isLoading ? (
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
              icon={ArrowDownCircle}
              title="ยังไม่มีรายการ"
              description="เริ่มบันทึกรายรับหรือเงินถวายเพื่อดูข้อมูลที่นี่"
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5">วันที่</TableHead>
                <TableHead className="px-5">ประเภท</TableHead>
                <TableHead className="px-5">หมวดหมู่</TableHead>
                <TableHead className="px-5">ช่องทาง</TableHead>
                <TableHead className="px-5">กองทุน</TableHead>
                <TableHead className="px-5">รายละเอียด</TableHead>
                <TableHead className="px-5">สถานะ</TableHead>
                <TableHead className="px-5 text-right">จำนวน</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                    {fmtDate(r.date)}
                  </TableCell>
                  <TableCell className="px-5 py-3">
                    {r.isOffering ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <HandHeart className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
                        เงินถวาย
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <ArrowDownLeft className="h-3.5 w-3.5 text-success" strokeWidth={1.75} />
                        รายรับ
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-5 py-3 font-medium">{r.category}</TableCell>
                  <TableCell className="px-5 py-3 text-muted-foreground">
                    {r.channel ?? <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="px-5 py-3">{r.fund}</TableCell>
                  <TableCell className="max-w-xs truncate px-5 py-3 text-muted-foreground">
                    {r.description || <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="px-5 py-3">
                    {r.isOffering ? (
                      <StatusBadge status="approved" />
                    ) : (
                      <StatusBadge status={r.status} />
                    )}
                  </TableCell>
                  <TableCell className="px-5 py-3 text-right">
                    <MoneyText value={r.amount} tone="income" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
