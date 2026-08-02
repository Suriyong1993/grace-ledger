// src/routes/auth.tsx — Number pad (PIN) login
// Users select their name from a list, then enter a 6-digit PIN.
// The PIN is sent to Supabase Auth as the password.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Delete, ArrowLeft, ShieldCheck, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth, fetchLoginUsers, type LoginUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ระบบ — ระบบจัดการการเงินคริสตจักร" },
      { name: "description", content: "เข้าสู่ระบบด้วยรหัส PIN" },
    ],
  }),
  component: AuthPage,
});

const FEATURES = [
  "บันทึกรายรับ รายจ่าย และเงินถวายในที่เดียว",
  "บริหารกองทุน โครงการ และงบประมาณอย่างเป็นระบบ",
  "รายงานพร้อมตรวจสอบ — โปร่งใสต่อคณะกรรมการ",
];

/* Deliberately square, bordered "vault gate" look — not the app's usual
   rounded-button radius. Preserved via explicit rounded-none.
   TODO(UI-VERIFY): confirm this renders pixel-consistent with the
   pre-migration square design (shadow/focus-ring/active-press scale
   from the Button base could interact with rounded-none unexpectedly);
   not verifiable in this environment (no browser available). */
const PAD_BUTTON =
  "h-14 rounded-none border border-border bg-card text-lg font-medium num-display hover:bg-muted";

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
    if (authUser) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [authUser, navigate]);

  useEffect(() => {
    fetchLoginUsers().then(setLoginUsers);
  }, []);

  const handlePinComplete = useCallback(
    async (fullPin: string, user: LoginUser) => {
      setLoading(true);
      setError(null);
      try {
        const result = await signIn(user.email, fullPin);
        if (result) {
          toast.success(`ยินดีต้อนรับ ${result.name}`);
          navigate({ to: "/dashboard", replace: true });
        } else {
          setError("ไม่พบข้อมูลผู้ใช้ในระบบ");
          setShake(true);
          setTimeout(() => setShake(false), 500);
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
        setShake(true);
        setTimeout(() => setShake(false), 500);
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

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — ledger paper motif */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-12 text-background lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 35px, currentColor 35px, currentColor 36px)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center bg-primary text-primary-foreground">
            <span className="text-sm font-bold">✦</span>
          </div>
          <div>
            <p className="font-display text-[15px] font-semibold tracking-tight">Grace Ledger</p>
            <p className="text-xs text-background/50">Church Finance</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <p className="kicker text-background/40">สมุดบัญชีคริสตจักร</p>
          <h1 className="font-display mt-4 text-[2rem] font-semibold leading-[1.2] tracking-tight">
            การเงินที่โปร่งใส
            <br />
            เริ่มจากบันทึกที่เรียบง่าย
          </h1>
          <ul className="mt-8 space-y-3.5 text-sm text-background/65">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <span aria-hidden className="mt-[9px] h-px w-5 shrink-0 bg-primary" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[11px] tracking-wide text-background/35">
          © {new Date().getFullYear()} Grace Ledger
        </p>
      </aside>

      {/* Login panel */}
      <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10 lg:min-h-0">
        <div className="w-full max-w-[360px]">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-9 w-9 shrink-0 place-items-center bg-primary text-primary-foreground">
              <span className="text-sm font-bold">✦</span>
            </div>
            <div>
              <p className="font-display text-[15px] font-semibold tracking-tight text-foreground">
                Grace Ledger
              </p>
              <p className="text-[11px] text-muted-foreground">การเงินคริสตจักร</p>
            </div>
          </div>

          <p className="kicker flex items-center gap-2">
            <span aria-hidden className="h-px w-6 bg-primary" />
            เข้าสู่ระบบ
          </p>
          <h2 className="font-display mt-2 text-[22px] font-semibold tracking-tight text-foreground">
            {selectedUser ? "กรอกรหัส PIN" : "เลือกบัญชีของคุณ"}
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {selectedUser
              ? "รหัส PIN 6 หลักของคุณ"
              : "เลือกชื่อ แล้วยืนยันตัวตนด้วยรหัส PIN 6 หลัก"}
          </p>

          {/* Error message */}
          {error && (
            <div className="animate-fade-up mt-5 border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-center text-[13px] text-destructive">
              {error}
            </div>
          )}

          {/* Step 1: User selection */}
          {!selectedUser && (
            <div className="animate-fade-up mt-6 divide-y divide-border border border-border bg-card">
              {loginUsers.length === 0 &&
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-9 w-9 shrink-0 animate-pulse bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-2/5 animate-pulse bg-muted" />
                      <div className="h-2.5 w-1/4 animate-pulse bg-muted" />
                    </div>
                  </div>
                ))}
              {loginUsers.map((u) => (
                <Button
                  key={u.id}
                  type="button"
                  variant="ghost"
                  onClick={() => handleSelectUser(u)}
                  className="group h-auto w-full justify-start gap-3 rounded-none px-4 py-3 text-left font-normal"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center bg-primary/10 text-[13px] font-semibold text-primary">
                    {u.name[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {u.name}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-transform duration-100 group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Button>
              ))}
            </div>
          )}

          {/* Step 2: PIN entry */}
          {selectedUser && (
            <div className="animate-fade-up mt-6">
              {/* Selected user header */}
              <div className="mb-8 flex items-center gap-3 border border-border bg-card p-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  className="h-8 w-8 shrink-0 rounded-none text-muted-foreground"
                  aria-label="ย้อนกลับ"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span className="grid h-9 w-9 shrink-0 place-items-center bg-primary/10 text-[13px] font-semibold text-primary">
                  {selectedUser.name[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {selectedUser.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {ROLE_LABEL[selectedUser.role] || selectedUser.role}
                  </p>
                </div>
              </div>

              {/* PIN dots — square, ledger-like */}
              <div className={cn("mb-8 flex justify-center gap-3", shake && "animate-shake")}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-3 w-3 border transition-all duration-150",
                      i < pin.length
                        ? "scale-110 border-primary bg-primary"
                        : "border-border bg-transparent",
                      loading && i === pin.length - 1 ? "animate-pulse" : "",
                    )}
                  />
                ))}
              </div>

              {/* Number pad */}
              <div className="mx-auto grid max-w-[264px] grid-cols-3 gap-2">
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
                  variant="outline"
                  onClick={handleBackspace}
                  disabled={loading || pin.length === 0}
                  className={PAD_BUTTON}
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
                  className="h-14 rounded-none text-lg font-semibold"
                  aria-label="ยืนยัน"
                >
                  ✓
                </Button>
              </div>

              {loading && (
                <div className="mt-6 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                  กำลังเข้าสู่ระบบ…
                </div>
              )}
            </div>
          )}

          <p className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            เข้าสู่ระบบปลอดภัยด้วยรหัส PIN ส่วนตัว
          </p>
        </div>
      </main>
    </div>
  );
}
