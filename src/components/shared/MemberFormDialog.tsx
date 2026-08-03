import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Users } from "lucide-react";
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
import { createMember } from "@/services/church";

interface MemberFormDialogProps {
  trigger?: React.ReactNode;
}

export function MemberFormDialog({ trigger }: MemberFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("member");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("กรุณากรอกชื่อ-นามสกุลสมาชิก");

      return await createMember({
        name: name.trim(),
        department: role,
        status: "active",
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      toast.success("ลงทะเบียนสมาชิกใหม่เรียบร้อยแล้ว");
      setOpen(false);
      setName("");
      setEmail("");
      setPhone("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "เกิดข้อผิดพลาดในการลงทะเบียนสมาชิก");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-2 rounded-button font-semibold shadow-sm">
            <UserPlus className="h-4 w-4" />
            ลงทะเบียนสมาชิกใหม่
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px] rounded-dialog p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">ลงทะเบียนสมาชิกคริสตจักร</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                เพิ่มข้อมูลสมาชิกสำหรับติดตามการถวายและสิทธิ์ใช้งานระบบ
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
            <Label className="text-xs font-semibold">ชื่อ-นามสกุล *</Label>
            <Input
              placeholder="เช่น สมชาย ใจดี"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-input text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">บทบาทหน้าที่ในคริสตจักร</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="rounded-input text-xs">
                <SelectValue placeholder="เลือกบทบาท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">สมาชิกทั่วไป (Member)</SelectItem>
                <SelectItem value="treasurer">เหรัญญิก (Treasurer)</SelectItem>
                <SelectItem value="auditor">ผู้ตรวจสอบบัญชี (Auditor)</SelectItem>
                <SelectItem value="pastor">ศิษยาภิบาล (Pastor)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">เบอร์โทรศัพท์</Label>
              <Input
                placeholder="081-234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="num-display rounded-input text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">อีเมล</Label>
              <Input
                type="email"
                placeholder="name@church.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-input text-xs"
              />
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
              {mut.isPending ? "กำลังบันทึก..." : "บันทึกสมาชิก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
