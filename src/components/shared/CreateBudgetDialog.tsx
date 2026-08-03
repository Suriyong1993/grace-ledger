import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PiggyBank, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createBudget } from "@/services/church";

interface CreateBudgetDialogProps {
  trigger?: React.ReactNode;
}

export function CreateBudgetDialog({ trigger }: CreateBudgetDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState("annual");
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      const numAmount = parseFloat(amount);
      if (!name.trim()) throw new Error("กรุณากรอกชื่อหมวดงบประมาณ");
      if (isNaN(numAmount) || numAmount <= 0) throw new Error("กรุณากรอกจำนวนเงินงบประมาณที่ถูกต้อง");

      return await createBudget({
        name: name.trim(),
        amount: numAmount,
        period,
        year: parseInt(year, 10) || new Date().getFullYear(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget"] });
      toast.success("บันทึกการตั้งงบประมาณเรียบร้อยแล้ว");
      setOpen(false);
      setName("");
      setAmount("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "เกิดข้อผิดพลาดในการตั้งงบประมาณ");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-2 rounded-button font-semibold shadow-sm">
            <Plus className="h-4 w-4" />
            ตั้งงบประมาณ
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px] rounded-dialog p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <PiggyBank className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">ตั้งงบประมาณใหม่</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                กำหนดเพดานงบประมาณเพื่อติดตามการเบิกจ่ายของคริสตจักร
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
          className="space-y-4 py-3"
        >
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">ชื่อหมวดงบประมาณ *</Label>
            <Input
              placeholder="เช่น ค่าสาธารณูปโภค, พันธกิจเด็ก, พันธกิจดนตรี"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-input text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">วงเงินงบประมาณ (บาท) *</Label>
              <Input
                type="number"
                placeholder="50000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="num-display rounded-input text-xs font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ปีงบประมาณ</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="num-display rounded-input text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">รอบระยะเวลา</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="rounded-input text-xs">
                <SelectValue placeholder="เลือกรอบงบประมาณ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="annual">ประจำปี (Annual)</SelectItem>
                <SelectItem value="monthly">รายเดือน (Monthly)</SelectItem>
                <SelectItem value="department">แผนก (Department)</SelectItem>
                <SelectItem value="project">โครงการพิเศษ (Project)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="rounded-button"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={mut.isPending}
              className="rounded-button font-semibold"
            >
              {mut.isPending ? "กำลังบันทึก..." : "บันทึกงบประมาณ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
