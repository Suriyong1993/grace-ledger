import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wallet, Plus } from "lucide-react";
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
import { createFund } from "@/services/church";

interface CreateFundDialogProps {
  trigger?: React.ReactNode;
}

const PRESET_COLORS = [
  "#4F46E5", // Primary Indigo
  "#047857", // Emerald Income
  "#B45309", // Amber Offering
  "#2563EB", // Blue
  "#7C3AED", // Purple
  "#DB2777", // Pink
  "#059669", // Teal
];

export function CreateFundDialog({ trigger }: CreateFundDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);

  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      const balance = parseFloat(openingBalance) || 0;
      if (!name.trim()) throw new Error("กรุณากรอกชื่อกองทุน");

      return await createFund({
        name: name.trim(),
        openingBalance: balance,
        isRestricted: true,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funds"] });
      toast.success("สร้างกองทุนใหม่เรียบร้อยแล้ว");
      setOpen(false);
      setName("");
      setOpeningBalance("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "เกิดข้อผิดพลาดในการสร้างกองทุน");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2 rounded-button font-semibold">
            <Plus className="h-4 w-4 text-primary" />
            สร้างกองทุนใหม่
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px] rounded-dialog p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">สร้างกองทุนใหม่</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                เพิ่มกองทุนสำหรับจัดสรรและติดตามเงินพันธกิจของคริสตจักร
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
            <Label className="text-xs font-semibold">ชื่อกองทุน *</Label>
            <Input
              placeholder="เช่น กองทุนจัดซื้อที่ดิน, กองทุนสงเคราะห์"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-input text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">ยอดเงินยกมาตั้งต้น (บาท)</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="num-display rounded-input text-xs font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">สีประจำกองทุน</Label>
            <div className="flex items-center gap-2 pt-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${
                    selectedColor === c ? "scale-110 border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
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
              {mut.isPending ? "กำลังบันทึก..." : "สร้างกองทุน"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
