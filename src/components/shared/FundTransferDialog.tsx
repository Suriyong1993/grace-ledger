import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowLeftRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { AttachmentInput, type AttachmentValue } from "./AttachmentInput";
import { listExpense, listFunds, listIncome, listOffering, transferFund } from "@/services/church";
import { useAuth } from "@/lib/auth";
import { thb, today } from "@/lib/format";

const schema = z
  .object({
    fromId: z.string().min(1, "เลือกกองทุนต้นทาง"),
    toId: z.string().min(1, "เลือกกองทุนปลายทาง"),
    amount: z.coerce.number().positive("จำนวนต้องมากกว่า 0"),
    date: z.string().min(1),
    reference: z.string().max(64).optional(),
    description: z.string().max(500).optional(),
  })
  .refine((v) => v.fromId !== v.toId, {
    message: "กองทุนต้นทาง/ปลายทางต้องต่างกัน",
    path: ["toId"],
  });

type Values = z.infer<typeof schema>;

export function FundTransferDialog({
  trigger,
  defaultFromId,
}: {
  trigger?: React.ReactNode;
  defaultFromId?: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<Values | null>(null);
  const [attachment, setAttachment] = useState<AttachmentValue | undefined>();

  const fundsQ = useQuery({ queryKey: ["funds"], queryFn: listFunds });
  const inQ = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const exQ = useQuery({ queryKey: ["expense"], queryFn: listExpense });
  const offQ = useQuery({ queryKey: ["offering"], queryFn: listOffering });

  const funds = fundsQ.data ?? [];
  const balances = useMemo(() => {
    const map: Record<string, number> = {};
    const fundsList = fundsQ.data ?? [];
    for (const f of fundsList) {
      const inc = (inQ.data ?? [])
        .filter((x) => x.fundId === f.id)
        .reduce((s, x) => s + x.amount, 0);
      const off = (offQ.data ?? [])
        .filter((x) => x.fundId === f.id)
        .reduce((s, x) => s + x.amount, 0);
      const exp = (exQ.data ?? [])
        .filter((x) => x.fundId === f.id)
        .reduce((s, x) => s + x.amount, 0);
      map[f.id] = f.openingBalance + inc + off - exp;
    }
    return map;
  }, [fundsQ.data, inQ.data, offQ.data, exQ.data]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromId: defaultFromId ?? "",
      toId: "",
      amount: 0,
      date: today(),
      reference: "",
      description: "",
    },
  });

  const fromId = form.watch("fromId");
  const amount = Number(form.watch("amount") || 0);
  const fromBal = fromId ? (balances[fromId] ?? 0) : 0;
  const insufficient = fromId && amount > fromBal;

  const mut = useMutation({
    mutationFn: (v: Values) => transferFund(v.fromId, v.toId, v.amount, user!),
    onSuccess: () => {
      toast.success("โอนกองทุนเรียบร้อย");
      qc.invalidateQueries({ queryKey: ["funds"] });
      qc.invalidateQueries({ queryKey: ["income"] });
      qc.invalidateQueries({ queryKey: ["expense"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      setOpen(false);
      setConfirm(null);
      setAttachment(undefined);
      form.reset({
        fromId: "",
        toId: "",
        amount: 0,
        date: today(),
        reference: "",
        description: "",
      });
    },
    onError: () => toast.error("โอนไม่สำเร็จ"),
  });

  const onSubmit = (v: Values) => {
    if (v.amount > (balances[v.fromId] ?? 0)) {
      form.setError("amount", {
        message: `ยอดกองทุนต้นทางไม่เพียงพอ (คงเหลือ ${thb(balances[v.fromId] ?? 0)})`,
      });
      return;
    }
    setConfirm(v);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="outline" className="h-8">
              <ArrowLeftRight className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
              โอนระหว่างกองทุน
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-none border-border">
          <DialogHeader>
            <p className="kicker mb-1 flex items-center gap-2">
              <span aria-hidden className="inline-block h-px w-5 bg-primary" />
              กองทุน & งบประมาณ
            </p>
            <DialogTitle className="font-display text-xl">โอนระหว่างกองทุน</DialogTitle>
            <DialogDescription>
              ย้ายเงินจากกองทุนต้นทางไปยังกองทุนปลายทาง พร้อมแนบหลักฐานประกอบรายการ
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* From → To visual */}
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr]">
                <FormField
                  name="fromId"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="border border-border bg-muted/30 px-3.5 py-3">
                      <FormLabel className="kicker">จาก · ต้นทาง</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="mt-2 h-9 w-full border-border bg-card">
                            <SelectValue placeholder="เลือกกองทุนต้นทาง" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {funds.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name} · คงเหลือ {thb(balances[f.id] ?? 0)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fromId && (
                        <p className="num-display mt-2 text-xs text-muted-foreground">
                          คงเหลือ {thb(fromBal)}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div aria-hidden className="flex items-center justify-center py-0.5 sm:pt-10">
                  <ArrowDown
                    className="h-4 w-4 text-muted-foreground sm:hidden"
                    strokeWidth={1.75}
                  />
                  <ArrowRight
                    className="hidden h-4 w-4 text-muted-foreground sm:block"
                    strokeWidth={1.75}
                  />
                </div>
                <FormField
                  name="toId"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="border border-border bg-muted/30 px-3.5 py-3">
                      <FormLabel className="kicker">ไป · ปลายทาง</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="mt-2 h-9 w-full border-border bg-card">
                            <SelectValue placeholder="เลือกกองทุนปลายทาง" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {funds
                            .filter((f) => f.id !== fromId)
                            .map((f) => (
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                          className="num-display h-10 bg-card text-base font-semibold"
                          {...field}
                        />
                      </FormControl>
                      {!insufficient && fromId && amount > 0 && (
                        <p className="num-display text-xs text-muted-foreground">
                          ต้นทางคงเหลือหลังโอน {thb(fromBal - amount)}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="date"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>วันที่โอน</FormLabel>
                      <FormControl>
                        <Input type="date" className="num-display h-10 bg-card" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                name="reference"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>เลขที่อ้างอิง</FormLabel>
                    <FormControl>
                      <Input
                        className="num-display h-10 bg-card"
                        placeholder="REF-2026-0001"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                name="description"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>คำอธิบาย</FormLabel>
                    <FormControl>
                      <Textarea className="bg-card" rows={2} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div>
                <p className="mb-2 text-sm font-medium">เอกสารแนบ (ไม่บังคับ)</p>
                <AttachmentInput value={attachment} onChange={setAttachment} />
              </div>
              {insufficient && (
                <p className="num-display text-sm text-destructive">
                  ยอดกองทุนต้นทางไม่เพียงพอ (คงเหลือ {thb(fromBal)})
                </p>
              )}
              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={mut.isPending || !!insufficient}>
                  ตรวจสอบและโอน
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent className="max-w-md rounded-none border-border">
          <AlertDialogHeader>
            <p className="kicker mb-1 flex items-center gap-2">
              <span aria-hidden className="inline-block h-px w-5 bg-primary" />
              ยืนยันรายการ
            </p>
            <AlertDialogTitle className="font-display text-xl">ยืนยันการโอนกองทุน</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="pt-2">
                {/* From → To summary */}
                <div className="flex items-center justify-between gap-3 border border-border bg-muted/30 px-4 py-3">
                  <div className="min-w-0">
                    <p className="kicker">จาก</p>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">
                      {funds.find((f) => f.id === confirm?.fromId)?.name}
                    </p>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                  <div className="min-w-0 text-right">
                    <p className="kicker">ไป</p>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">
                      {funds.find((f) => f.id === confirm?.toId)?.name}
                    </p>
                  </div>
                </div>

                {/* Amount */}
                <div className="mt-2 border border-border px-4 py-3.5 text-center">
                  <p className="kicker">จำนวนเงิน</p>
                  <p className="num-display mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
                    {thb(confirm?.amount ?? 0)}
                  </p>
                </div>

                {/* Detail rows */}
                <div className="mt-2 divide-y divide-border border border-border text-sm">
                  {confirm?.reference && (
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="text-muted-foreground">เลขที่อ้างอิง</span>
                      <span className="num-display font-medium text-foreground">
                        {confirm.reference}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-muted-foreground">ต้นทางคงเหลือหลังโอน</span>
                    <span className="num-display font-medium text-foreground">
                      {thb((balances[confirm?.fromId ?? ""] ?? 0) - (confirm?.amount ?? 0))}
                    </span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              disabled={mut.isPending}
              onClick={() => confirm && mut.mutate(confirm)}
            >
              ยืนยันโอน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
