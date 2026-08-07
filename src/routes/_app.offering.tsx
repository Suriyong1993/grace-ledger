import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Download, Trash2, HandHeart, Sparkles, Wallet, AlertTriangle } from "lucide-react";
import { InlineStatBar } from "@/components/shared/InlineStatBar";
import { ChurchHandwrittenFormScannerModal } from "@/components/church/ChurchHandwrittenFormScannerModal";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataToolbar } from "@/components/shared/DataToolbar";
import { MoneyText } from "@/components/shared/MoneyText";
import { EmptyState } from "@/components/shared/EmptyState";
import { SundayCountSheet } from "@/components/shared/SundayCountSheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createOffering,
  deleteOffering,
  listFunds,
  listMembers,
  listOffering,
  listOfferingCategories,
  listOfferingSubcategories,
} from "@/services/church";
import { useAuth } from "@/lib/auth";
import { fmtDate, thb, today } from "@/lib/format";
import { downloadCsv, toCsv } from "@/lib/csv";
import { CHANNEL_LABEL, type PaymentChannel } from "@/lib/types";

export const Route = createFileRoute("/_app/offering")({
  head: () => ({ meta: [{ title: "เงินถวาย — ระบบจัดการการเงินคริสตจักร" }] }),
  component: OfferingPage,
});

const schema = z.object({
  date: z.string().min(1),
  amount: z.coerce.number().positive("จำนวนต้องมากกว่า 0"),
  categoryId: z.string().min(1, "เลือกหมวดหมู่"),
  subcategoryId: z.string().optional(),
  channel: z.enum(["cash", "bank", "qr"] as const),
  fundId: z.string().min(1),
  memberId: z.string().optional(),
  note: z.string().max(500).optional(),
});
type Values = z.infer<typeof schema>;

/** Editorial tab trigger — flat, sharp corners, no shadow or bounce */
const TAB_TRIGGER = "rounded-none text-xs data-[state=active]:shadow-none active:scale-100";

function OfferingPage() {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [handwrittenScanOpen, setHandwrittenScanOpen] = useState(false);
  const [q, setQ] = useState("");

  const offQ = useQuery({ queryKey: ["offering"], queryFn: listOffering });
  const catsQ = useQuery({ queryKey: ["offering-categories"], queryFn: listOfferingCategories });
  const fundsQ = useQuery({ queryKey: ["funds"], queryFn: listFunds });
  const membersQ = useQuery({ queryKey: ["members"], queryFn: listMembers });

  const [selectedCat, setSelectedCat] = useState("");

  const subsQ = useQuery({
    queryKey: ["offering-subcategories", selectedCat],
    queryFn: () => listOfferingSubcategories(selectedCat),
    enabled: !!selectedCat,
  });

  const create = useMutation({
    mutationFn: (v: Values) =>
      createOffering(
        {
          ...v,
          memberId: v.memberId || undefined,
          categoryId: v.categoryId,
          subcategoryId: v.subcategoryId || undefined,
        },
        user!,
      ),
    onSuccess: () => {
      toast.success("บันทึกเงินถวายเรียบร้อย");
      qc.invalidateQueries({ queryKey: ["offering"] });
      setOpen(false);
      setSelectedCat("");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteOffering(id, user!),
    onSuccess: () => {
      toast.success("ลบแล้ว");
      qc.invalidateQueries({ queryKey: ["offering"] });
    },
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: today(),
      amount: 0,
      categoryId: "",
      subcategoryId: "",
      channel: "cash",
      fundId: "",
      memberId: "",
      note: "",
    },
  });

  // Lookup helpers
  const categories = catsQ.data ?? [];
  const funds = fundsQ.data ?? [];
  const members = membersQ.data ?? [];
  const subs = subsQ.data ?? [];

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "-";
  const subName = (id?: string) => (id ? subs.find((s) => s.id === id)?.name : undefined) ?? "-";
  const fundName = (id: string) => funds.find((f) => f.id === id)?.name ?? "-";
  const memberName = (id?: string) => (id ? members.find((m) => m.id === id)?.name : undefined);

  const rows = (offQ.data ?? []).filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return [
      catName(r.categoryId),
      subName(r.subcategoryId),
      fundName(r.fundId),
      memberName(r.memberId),
      String(r.amount),
    ].some((v) => v?.toLowerCase().includes(s));
  });
  const total = rows.reduce((s, r) => s + r.amount, 0);

  const exportCsv = () => {
    const csv = toCsv(
      rows.map((r) => ({
        date: r.date,
        category: catName(r.categoryId),
        subcategory: subName(r.subcategoryId),
        channel: CHANNEL_LABEL[r.channel],
        fund: fundName(r.fundId),
        member: memberName(r.memberId) ?? "",
        amount: r.amount,
      })),
      {
        date: "วันที่",
        category: "หมวดหมู่",
        subcategory: "หมวดย่อย",
        channel: "ช่องทาง",
        fund: "กองทุน",
        member: "สมาชิก",
        amount: "จำนวน",
      },
    );
    downloadCsv(`offering-${today()}.csv`, csv);
  };

  const channels: PaymentChannel[] = ["cash", "bank", "qr"];

  return (
    <div>
      <PageHeader
        kicker="รายการเงิน"
        title="เงินถวาย"
        description={`รวมทั้งหมด ${thb(total)} จาก ${rows.length} รายการ`}
        actions={
          <>
            <Button variant="outline" className="h-8" onClick={() => setHandwrittenScanOpen(true)}>
              <Sparkles className="mr-1.5 h-4 w-4" strokeWidth={1.75} /> AI
              สแกนใบตรวจนับเงินเขียนมือ
            </Button>
            <Button variant="outline" className="h-8" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" strokeWidth={1.75} /> ส่งออก CSV
            </Button>
            {can("offering.write") && (
              <Dialog
                open={open}
                onOpenChange={(v) => {
                  setOpen(v);
                  if (!v) setSelectedCat("");
                }}
              >
                <DialogTrigger asChild>
                  <Button className="h-8">
                    <Plus className="mr-1.5 h-4 w-4" strokeWidth={1.75} /> บันทึกเงินถวาย
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>บันทึกเงินถวาย</DialogTitle>
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
                                <Input type="date" className="num-display" {...field} />
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
                              <FormLabel>จำนวนเงิน</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="num-display"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/** Category dropdown */}
                      <FormField
                        name="categoryId"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>หมวดหมู่</FormLabel>
                            <Select
                              onValueChange={(v) => {
                                field.onChange(v);
                                setSelectedCat(v);
                                form.setValue("subcategoryId", "");
                              }}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="เลือกหมวดหมู่" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {categories
                                  .filter((c) => c.isActive)
                                  .map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      <span className="flex items-center gap-2">
                                        <span
                                          className="inline-block h-2 w-2 rounded-full"
                                          style={{ backgroundColor: c.color }}
                                        />
                                        {c.name}
                                      </span>
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/** Subcategory dropdown (shows only when category selected) */}
                      {selectedCat && (
                        <FormField
                          name="subcategoryId"
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ประเภทย่อย</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="เลือกประเภทย่อย (ไม่บังคับ)" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {subs
                                    .filter((s) => s.isActive)
                                    .map((s) => (
                                      <SelectItem key={s.id} value={s.id}>
                                        {s.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          name="channel"
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ช่องทาง</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {channels.map((ch) => (
                                    <SelectItem key={ch} value={ch}>
                                      {CHANNEL_LABEL[ch]}
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
                                  <SelectTrigger>
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
                      </div>

                      <FormField
                        name="memberId"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>สมาชิก (ถ้ามี)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="ไม่ระบุ" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {members.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8"
                          onClick={() => setOpen(false)}
                        >
                          ยกเลิก
                        </Button>
                        <Button type="submit" className="h-8" disabled={create.isPending}>
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

      {offQ.isError ? (
        <div className="mt-6 flex items-center justify-between gap-4 rounded-card border border-destructive/30 bg-destructive/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">โหลดข้อมูลเงินถวายไม่สำเร็จ</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => offQ.refetch()} className="shrink-0">
            ลองใหม่
          </Button>
        </div>
      ) : null}

      <div className="mt-6">
        {offQ.isLoading ? (
          <Skeleton className="h-[52px] rounded-card" />
        ) : (
          <InlineStatBar
            items={[
              { label: "รวมทั้งหมด", value: total, icon: HandHeart, tone: "primary" },
              { label: "จำนวนรายการ", value: rows.length, icon: Wallet, tone: "default" },
              {
                label: "เฉลี่ยต่อรายการ",
                value: rows.length > 0 ? total / rows.length : 0,
                icon: HandHeart,
                tone: "default",
              },
            ]}
          />
        )}
      </div>

      <Tabs defaultValue="sunday-sheet" className="mt-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start rounded-none">
          <TabsTrigger value="sunday-sheet" className={TAB_TRIGGER}>
            ใบนับเงิน &amp; ถวายรายบุคคล (วันอาทิตย์)
          </TabsTrigger>
          <TabsTrigger value="all-records" className={TAB_TRIGGER}>
            รายการเงินถวายทั้งหมด ({rows.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sunday-sheet" className="mt-6">
          <SundayCountSheet />
        </TabsContent>

        <TabsContent value="all-records" className="mt-6 space-y-4">
          <DataToolbar query={q} onQueryChange={setQ} placeholder="ค้นหาเงินถวาย..." />

          <section className="card-ledger">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <p className="kicker">รายการเงินถวายทั้งหมด</p>
              <p className="num-display text-xs text-muted-foreground">{rows.length} รายการ</p>
            </div>
            {offQ.isLoading ? (
              <div className="space-y-3 px-5 py-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={HandHeart}
                  title="ยังไม่มีเงินถวาย"
                  description="เริ่มบันทึกเงินถวายวันอาทิตย์"
                />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-10 pl-5">วันที่</TableHead>
                      <TableHead className="h-10">หมวดหมู่</TableHead>
                      <TableHead className="h-10">ประเภทย่อย</TableHead>
                      <TableHead className="h-10">ช่องทาง</TableHead>
                      <TableHead className="h-10">กองทุน</TableHead>
                      <TableHead className="h-10">สมาชิก</TableHead>
                      <TableHead className="h-10 text-right">จำนวน</TableHead>
                      <TableHead className="h-10 pr-5 text-right">การจัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow
                        key={r.id}
                        className={rows.length > 5 && i % 2 === 1 ? "bg-muted/15" : undefined}
                      >
                        <TableCell className="num-display whitespace-nowrap pl-5 text-muted-foreground">
                          {fmtDate(r.date)}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                            {(() => {
                              const c = categories.find((c) => c.id === r.categoryId);
                              return c ? (
                                <span
                                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: c.color }}
                                />
                              ) : null;
                            })()}
                            {catName(r.categoryId)}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {subName(r.subcategoryId)}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                            <span
                              aria-hidden
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40"
                            />
                            {CHANNEL_LABEL[r.channel]}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {fundName(r.fundId)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {memberName(r.memberId) ?? (r.note ? r.note : "-")}
                        </TableCell>
                        <TableCell className="text-right">
                          <MoneyText value={r.amount} tone="income" />
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          {can("offering.write") && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 hover:bg-destructive/10"
                              onClick={() => remove.mutate(r.id)}
                              aria-label="ลบ"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" strokeWidth={1.75} />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t border-border bg-muted/40 px-5 py-3">
                  <span className="text-xs text-muted-foreground">
                    รวมทั้งหมด {rows.length} รายการ
                  </span>
                  <span className="num-display text-sm font-semibold tracking-tight text-foreground">
                    {thb(total)}
                  </span>
                </div>
              </>
            )}
          </section>
        </TabsContent>
      </Tabs>
      <ChurchHandwrittenFormScannerModal
        open={handwrittenScanOpen}
        onOpenChange={setHandwrittenScanOpen}
      />
    </div>
  );
}
