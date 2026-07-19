import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Church } from "lucide-react";
import { toast } from "sonner";
import { PinPad } from "@/components/shared/PinPad";
import { useAuth } from "@/lib/auth";
import { loadDb } from "@/lib/mock-db";
import { ROLE_LABEL } from "@/lib/types";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ระบบ — ระบบจัดการการเงินคริสตจักร" },
      { name: "description", content: "เข้าสู่ระบบด้วยรหัส PIN 6 หลัก" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);

  const demoUsers = loadDb().users;

  const handleSubmit = async (pin: string) => {
    const u = await login(pin);
    if (u) {
      toast.success(`ยินดีต้อนรับ ${u.name}`);
      navigate({ to: "/dashboard", replace: true });
      return true;
    }
    toast.error("รหัส PIN ไม่ถูกต้อง");
    return false;
  };

  return (
    <div className="min-h-dvh grid lg:grid-cols-2 bg-background">
      <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden bg-gradient-to-br from-primary via-primary/80 to-secondary text-primary-foreground">
        <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-accent/40 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur">
            <Church className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-semibold">ระบบจัดการการเงินคริสตจักร</p>
            <p className="text-sm opacity-80">Church Financial Management</p>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative max-w-md"
        >
          <h1 className="text-4xl font-bold leading-tight">
            ดูแลการเงินคริสตจักร<br />ด้วยความโปร่งใสและง่ายดาย
          </h1>
          <p className="mt-4 text-white/85">
            บันทึกรายรับ รายจ่าย เงินถวาย บริหารกองทุน งบประมาณ และออกรายงานได้ในที่เดียว
          </p>
        </motion.div>
        <p className="relative text-xs opacity-70">© {new Date().getFullYear()} Church Finance</p>
      </div>

      <div className="flex flex-col items-center justify-center p-6 md:p-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm"
        >
          <PinPad
            title="เข้าสู่ระบบ"
            subtitle="กรอกรหัส PIN 6 หลักของคุณ"
            onSubmit={handleSubmit}
          />
          <div className="mt-8 rounded-2xl border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">บัญชีตัวอย่าง (คลิกเพื่อกรอกให้)</p>
            <div className="grid grid-cols-2 gap-1.5">
              {demoUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSubmit(u.pin)}
                  className="text-left rounded-xl px-2.5 py-1.5 hover:bg-accent text-xs"
                >
                  <div className="font-medium text-foreground truncate">{u.name}</div>
                  <div className="text-[10px] text-muted-foreground">{ROLE_LABEL[u.role]} · {u.pin}</div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}