import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
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
import { SundayCountSheet } from "@/components/shared/SundayCountSheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

function OfferingPage() {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
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
        title="เงินถวาย"
        description={`รวมทั้งหมด ${thb(total)} จาก ${rows.length} รายการ`}
        actions={
          <>
            <Button variant="outline" className="rounded-2xl" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" /> Export
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
                  <Button className="rounded-2xl">
                    <Plus className="h-4 w-4 mr-2" /> บันทึกเงินถวาย
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-3xl">
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
                              <FormLabel>จำนวนเงิน</FormLabel>
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
                                <SelectTrigger className="rounded-xl h-11">
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
                                          className="inline-block w-2.5 h-2.5 rounded-full"
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
                                  <SelectTrigger className="rounded-xl h-11">
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
                                  <SelectTrigger className="rounded-xl h-11">
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
                      </div>

                      <FormField
                        name="memberId"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>สมาชิก (ถ้ามี)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                              <FormControl>
                                <SelectTrigger className="rounded-xl h-11">
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

      <Tabs defaultValue="sunday-sheet" className="space-y-6">
        <TabsList className="rounded-2xl p-1 bg-muted/60 mb-2">
          <TabsTrigger value="sunday-sheet" className="rounded-xl px-4 py-2 text-sm font-semibold">
            ใบนับเงิน & ถวายรายบุคคล (ประจำวันอาทิตย์)
          </TabsTrigger>
          <TabsTrigger value="all-records" className="rounded-xl px-4 py-2 text-sm font-semibold">
            ตารางเงินถวายทั้งหมด ({rows.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sunday-sheet">
          <SundayCountSheet />
        </TabsContent>

        <TabsContent value="all-records" className="space-y-4">
          <DataToolbar query={q} onQueryChange={setQ} placeholder="ค้นหาเงินถวาย..." />

          <Card className="rounded-3xl overflow-hidden">
            <CardContent className="p-0">
              {offQ.isLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-xl" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={HandHeart}
                    title="ยังไม่มีเงินถวาย"
                    description="เริ่มบันทึกเงินถวายวันอาทิตย์"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>วันที่</TableHead>
                      <TableHead>หมวดหมู่</TableHead>
                      <TableHead>ประเภทย่อย</TableHead>
                      <TableHead>ช่องทาง</TableHead>
                      <TableHead>กองทุน</TableHead>
                      <TableHead>สมาชิก</TableHead>
                      <TableHead className="text-right">จำนวน</TableHead>
                      <TableHead className="text-right">การจัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 font-medium">
                            {(() => {
                              const c = categories.find((c) => c.id === r.categoryId);
                              return c ? (
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: c.color }}
                                />
                              ) : null;
                            })()}
                            {catName(r.categoryId)}
                          </span>
                        </TableCell>
                        <TableCell>{subName(r.subcategoryId)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="rounded-full font-mono text-xs">
                            {CHANNEL_LABEL[r.channel]}
                          </Badge>
                        </TableCell>
                        <TableCell>{fundName(r.fundId)}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {memberName(r.memberId) ?? (r.note ? r.note : "-")}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <MoneyText value={r.amount} tone="income" />
                        </TableCell>
                        <TableCell className="text-right">
                          {can("offering.write") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-xl hover:bg-destructive/10"
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
