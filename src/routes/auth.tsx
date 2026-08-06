// src/routes/auth.tsx — Grace Ledger Church Login
// Distinctly church finance — warm, trustworthy, community-grounded

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Delete, ArrowLeft, ChevronRight, Cross, Users, BookOpen, Heart } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth, fetchLoginUsers, type LoginUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "เข้าสู่ระบบ — Grace Ledger" }],
  }),
  component: AuthPage,
});

const PAD_BUTTON =
  "h-14 rounded-lg border border-border bg-card text-lg font-medium num-display transition-colors duration-150 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed";

function AuthPage() {
  const { user: authUser, signIn } = useAuth();
  const navigate = useNavigate();
  const [loginUsers, setLoginUsers] = useState<LoginUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<LoginUser | null>(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (authUser) navigate({ to: "/dashboard", replace: true });
  }, [authUser, navigate]);

  useEffect(() => {
    fetchLoginUsers().then(setLoginUsers);
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handlePinComplete = useCallback(
    async (fullPin: string, user: LoginUser) => {
      setLoading(true);
      setError(null);
      try {
        const result = await signIn(user.email, fullPin);
        if (result) {
          toast.success(`สวัสดี ${result.name}`);
          navigate({ to: "/dashboard", replace: true });
        } else {
          setError("ไม่พบข้อมูลผู้ใช้ในระบบ");
          triggerShake();
          setPin("");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Invalid login") || msg.includes("Invalid credentials")) {
          setError("รหัส PIN ไม่ถูกต้อง");
        } else if (msg.includes("fetch") || msg.includes("network") || msg.includes("ENOTFOUND")) {
          setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
        } else {
          setError(`เกิดข้อผิดพลาด: ${msg}`);
        }
        triggerShake();
        setPin("");
      } finally {
        setLoading(false);
      }
    },
    [signIn, navigate],
  );

  const handleDigit = useCallback(
    (digit: string) => {
      if (loading || pin.length >= 6) return;
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 6 && selectedUser) {
        handlePinComplete(newPin, selectedUser);
      }
    },
    [pin, loading, selectedUser, handlePinComplete],
  );

  const handleBackspace = useCallback(() => {
    if (loading) return;
    setPin((p) => p.slice(0, -1));
    setError(null);
  }, [loading]);

  const handleSelectUser = useCallback((user: LoginUser) => {
    setSelectedUser(user);
    setPin("");
    setError(null);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedUser(null);
    setPin("");
    setError(null);
  }, []);

  // Keyboard support for PIN entry
  useEffect(() => {
    if (!selectedUser) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Enter" && pin.length === 6) {
        handlePinComplete(pin, selectedUser);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedUser, pin, handleDigit, handleBackspace, handlePinComplete]);

  return (
    <div className="flex min-h-dvh">
      {/* Left brand panel — church identity */}
      <aside className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-card via-card to-background relative overflow-hidden">
        {/* Subtle cross watermark */}
        <div className="absolute -right-20 -top-20 opacity-[0.03]">
          <Cross className="h-96 w-96" strokeWidth={1} />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Cross className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-display text-lg font-semibold tracking-tight">Grace Ledger</p>
            <p className="text-xs text-muted-foreground">ระบบการเงินคริสตจักร</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <p className="kicker text-muted-foreground">สมุดบัญชีแห่งความสัตย์</p>
          <h1 className="mt-4 font-display text-[2.5rem] font-semibold leading-tight tracking-tight">
            การเงินที่โปร่งใส
            <br />
            บริหารด้วยความรับผิดชอบ
          </h1>
          <ul className="mt-8 space-y-4 text-sm text-muted-foreground">
            <li className="flex items-center gap-3">
              <BookOpen className="h-4 w-4 text-primary/60" strokeWidth={2} />
              บันทึกรายรับ-จ่าย-ถวาย ถูกต้อง รัดกุม
            </li>
            <li className="flex items-center gap-3">
              <Users className="h-4 w-4 text-primary/60" strokeWidth={2} />
              ควบคุมสิทธิ์ผู้ใช้งานตามบทบาท
            </li>
            <li className="flex items-center gap-3">
              <Heart className="h-4 w-4 text-primary/60" strokeWidth={2} />
              รายงานสรุปสำหรับคณะกรรมการศจ.
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground/50">
          © {new Date().getFullYear()} Grace Ledger —
          เพื่อการบริหารจัดการการเงินคริสตจักรอย่างโปร่งใส
        </p>
      </aside>

      {/* Right login panel — personal, role-focused */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[360px]">
          {/* Mobile brand */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Cross className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-display text-lg font-semibold tracking-tight">Grace Ledger</p>
              <p className="text-xs text-muted-foreground">ระบบการเงินคริสตจักร</p>
            </div>
          </div>

          {/* Header */}
          <div className="mb-8">
            <p className="kicker flex items-center gap-2">
              <Users className="h-3 w-3 text-primary" />
              เข้าสู่ระบบ
            </p>
            <h2 className="mt-3 font-display text-[22px] font-semibold tracking-tight">
              {selectedUser ? "ยืนยันตัวตนด้วย PIN" : "เลือกบัญชีผู้ใช้"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {selectedUser
                ? "กรอกรหัส PIN 6 หลักเพื่อยืนยันตัวตน"
                : "เลือกชื่อของคุณจากรายการด้านล่าง"}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 border border-destructive/30 bg-destructive/5 px-4 py-3 text-center text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Step 1: User selection — role-focused */}
          {!selectedUser && (
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {loginUsers.length === 0 &&
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
                      <div className="h-2.5 w-1/4 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ))}
              {loginUsers.map((u) => (
                <Button
                  key={u.id}
                  type="button"
                  variant="ghost"
                  onClick={() => handleSelectUser(u)}
                  className="group h-auto w-full justify-start gap-3 rounded-none px-4 py-4 text-left font-normal first:rounded-t-lg last:rounded-b-lg"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                    {u.name.slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{u.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:translate-x-0.5 group-hover:text-primary transition-all duration-150" />
                </Button>
              ))}
            </div>
          )}

          {/* Step 2: PIN entry */}
          {selectedUser && (
            <div>
              {/* User header */}
              <div className="mb-6 flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="ย้อนกลับ"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                  {selectedUser.name.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{selectedUser.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABEL[selectedUser.role] || selectedUser.role}
                  </p>
                </div>
              </div>

              {/* PIN dots */}
              <div className={cn("mb-8 flex justify-center gap-4", shake && "animate-shake")}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <motion.span
                    key={i}
                    initial={false}
                    animate={{
                      scale: i < pin.length ? 1 : 0.75,
                      opacity: i < pin.length ? 1 : 0.3,
                    }}
                    transition={{ duration: 0.15 }}
                    className="h-3 w-3 rounded-full bg-primary"
                    style={{
                      boxShadow: i < pin.length ? "0 0 8px var(--color-primary)" : "none",
                    }}
                  />
                ))}
              </div>

              {/* Number pad */}
              <div className="grid grid-cols-3 gap-3 max-w-[264px] mx-auto">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <Button
                    key={d}
                    type="button"
                    variant="outline"
                    onClick={() => handleDigit(d)}
                    disabled={loading || pin.length >= 6}
                    className={PAD_BUTTON}
                  >
                    {d}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBackspace}
                  disabled={loading || pin.length === 0}
                  className={cn(PAD_BUTTON, "text-muted-foreground")}
                  aria-label="ลบ"
                >
                  <Delete className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDigit("0")}
                  disabled={loading || pin.length >= 6}
                  className={PAD_BUTTON}
                >
                  0
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    selectedUser && pin.length === 6 && handlePinComplete(pin, selectedUser)
                  }
                  disabled={loading || pin.length !== 6}
                  className={cn(
                    PAD_BUTTON,
                    "bg-primary text-primary-foreground border-primary hover:bg-primary/90",
                  )}
                  aria-label="ยืนยัน"
                >
                  ✓
                </Button>
              </div>

              {/* Loading */}
              {loading && (
                <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                  กำลังยืนยันตัวตน…
                </div>
              )}
            </div>
          )}

          {/* Security */}
          <p className="mt-10 text-center text-[11px] text-muted-foreground">
            ข้อมูลของคุณถูกปกป้องด้วยรหัส PIN ส่วนตัว
          </p>
        </div>
      </main>
    </div>
  );
}
