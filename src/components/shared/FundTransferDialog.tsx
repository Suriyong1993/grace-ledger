import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
            <Button className="rounded-2xl" variant="outline">
              <ArrowLeftRight className="h-4 w-4 mr-2" /> โอนระหว่างกองทุน
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="rounded-3xl max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>โอนระหว่างกองทุน</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                name="fromId"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>กองทุนต้นทาง</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl h-11">
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
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="toId"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>กองทุนปลายทาง</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl h-11">
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
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  name="amount"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>จำนวนเงิน</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" className="rounded-xl" {...field} />
                      </FormControl>
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
                        <Input type="date" className="rounded-xl" {...field} />
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
                      <Input className="rounded-xl" placeholder="REF-2026-0001" {...field} />
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
                      <Textarea className="rounded-xl" rows={2} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div>
                <p className="text-sm font-medium mb-2">เอกสารแนบ (ไม่บังคับ)</p>
                <AttachmentInput value={attachment} onChange={setAttachment} />
              </div>
              {insufficient && (
                <p className="text-sm text-destructive">
                  ยอดกองทุนต้นทางไม่เพียงพอ (คงเหลือ {thb(fromBal)})
                </p>
              )}
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl active:scale-[0.97]"
                  onClick={() => setOpen(false)}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl active:scale-[0.97]"
                  disabled={mut.isPending || !!insufficient}
                >
                  ตรวจสอบและโอน
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent className="rounded-3xl border-border/60 backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการโอนกองทุน</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>ต้นทาง</span>
                  <span className="font-medium">
                    {funds.find((f) => f.id === confirm?.fromId)?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>ปลายทาง</span>
                  <span className="font-medium">
                    {funds.find((f) => f.id === confirm?.toId)?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>จำนวน</span>
                  <span className="font-semibold font-mono tabular-nums text-primary">
                    {thb(confirm?.amount ?? 0)}
                  </span>
                </div>
                {confirm?.reference && (
                  <div className="flex justify-between">
                    <span>อ้างอิง</span>
                    <span className="font-mono">{confirm.reference}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border/60">
                  <span>คงเหลือหลังโอน</span>
                  <span className="font-mono tabular-nums font-medium">
                    {thb((balances[confirm?.fromId ?? ""] ?? 0) - (confirm?.amount ?? 0))}
                  </span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl active:scale-[0.97]">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl active:scale-[0.97]"
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
