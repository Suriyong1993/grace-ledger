// src/routes/auth.tsx — Number pad (PIN) login
// Users select their name from a list, then enter a 6-digit PIN.
// The PIN is sent to Supabase Auth as the password.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Church, Delete, ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth, fetchLoginUsers, type LoginUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/types";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ระบบ — ระบบจัดการการเงินคริสตจักร" },
      { name: "description", content: "เข้าสู่ระบบด้วยรหัส PIN" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user: authUser, signIn } = useAuth();
  const navigate = useNavigate();
  const [loginUsers, setLoginUsers] = useState<LoginUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<LoginUser | null>(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (authUser) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [authUser, navigate]);

  // Fetch user list on mount
  useEffect(() => {
    fetchLoginUsers().then(setLoginUsers);
  }, []);

  // Auto-submit when PIN reaches 6 digits
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

  // Handle digit press
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

  // Handle backspace
  const handleBackspace = useCallback(() => {
    if (loading) return;
    setPin((p) => p.slice(0, -1));
    setError(null);
  }, [loading]);

  // Handle user selection
  const handleSelectUser = useCallback((user: LoginUser) => {
    setSelectedUser(user);
    setPin("");
    setError(null);
  }, []);

  // Handle back to user list
  const handleBack = useCallback(() => {
    setSelectedUser(null);
    setPin("");
    setError(null);
  }, []);

  return (
    <div className="min-h-dvh grid lg:grid-cols-2 bg-background">
      {/* Left panel — branding */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-primary text-primary-foreground">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,oklch(1_0_0/0.08),transparent_60%)]" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center border border-white/20 bg-white/10 backdrop-blur-sm">
            <Church className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[15px] font-semibold tracking-tight">Grace Ledger</p>
            <p className="text-xs text-white/60 tracking-wide uppercase">Church Finance</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="font-display text-[2rem] font-semibold leading-[1.15] tracking-tight">
            ดูแลการเงินคริสตจักร
            <br />
            ด้วยความโปร่งใส
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-white/70">
            บันทึกรายรับ รายจ่าย เงินถวาย บริหารกองทุน
            <br />
            งบประมาณ และออกรายงานได้ในที่เดียว
          </p>
        </div>
        <p className="relative text-[11px] tracking-wide text-white/40">
          © {new Date().getFullYear()} Grace Ledger
        </p>
      </div>

      {/* Right panel — login */}
      <div className="flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-[360px]">
          {/* Logo + title */}
          <div className="mb-8 text-center">
            <div className="inline-flex h-11 w-11 items-center justify-center border border-primary/20 bg-primary/5 text-primary mb-4">
              <Church className="h-5 w-5" />
            </div>
            <h2 className="font-display text-[22px] font-semibold tracking-tight text-foreground">
              เข้าสู่ระบบ
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1.5">
              {selectedUser ? "กรอกรหัส PIN 6 หลัก" : "เลือกบัญชีของคุณ"}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 border border-destructive/25 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive text-center animate-[fadeUp_0.2s_ease_both]">
              {error}
            </div>
          )}

          {/* Step 1: User selection */}
          {!selectedUser && (
            <div className="space-y-2 animate-[fadeUp_0.4s_ease_both]">
              {loginUsers.length === 0 && (
                <p className="text-center text-[13px] text-muted-foreground py-8">
                  กำลังโหลดรายชื่อผู้ใช้…
                </p>
              )}
              {loginUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleSelectUser(u)}
                  className="w-full flex items-center gap-3 border border-border bg-card hover:bg-muted hover:border-primary/30 px-4 py-3 transition-all duration-150 active:scale-[0.98] cursor-pointer text-left"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center bg-primary/10 text-primary text-sm font-medium">
                    {u.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      {ROLE_LABEL[u.role] || u.role}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: PIN entry */}
          {selectedUser && (
            <div className="animate-[fadeUp_0.3s_ease_both]">
              {/* Selected user header */}
              <div className="flex items-center gap-3 mb-6 p-3 border border-border bg-muted/30">
                <button
                  type="button"
                  onClick={handleBack}
                  className="grid h-8 w-8 shrink-0 place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="ย้อนกลับ"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="grid h-10 w-10 shrink-0 place-items-center bg-primary/10 text-primary text-sm font-medium">
                  {selectedUser.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {selectedUser.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {ROLE_LABEL[selectedUser.role] || selectedUser.role}
                  </p>
                </div>
              </div>

              {/* PIN dots */}
              <div
                className={`flex justify-center gap-3 mb-8 ${shake ? "animate-[shake_0.4s_ease]" : ""}`}
              >
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-3.5 w-3.5 rounded-full border-2 transition-all duration-150 ${
                      i < pin.length
                        ? "bg-primary border-primary scale-110"
                        : "border-border bg-transparent"
                    } ${loading && i === pin.length - 1 ? "animate-pulse" : ""}`}
                  />
                ))}
              </div>

              {/* Number pad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDigit(d)}
                    disabled={loading || pin.length >= 6}
                    className="h-16 flex items-center justify-center text-xl font-semibold border border-border bg-card hover:bg-muted active:scale-95 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleBackspace}
                  disabled={loading || pin.length === 0}
                  className="h-16 flex items-center justify-center border border-border bg-card hover:bg-muted active:scale-95 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="ลบ"
                >
                  <Delete className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit("0")}
                  disabled={loading || pin.length >= 6}
                  className="h-16 flex items-center justify-center text-xl font-semibold border border-border bg-card hover:bg-muted active:scale-95 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() =>
                    selectedUser && pin.length === 6 && handlePinComplete(pin, selectedUser)
                  }
                  disabled={loading || pin.length !== 6}
                  className="h-16 flex items-center justify-center text-xl font-semibold border border-primary bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="ยืนยัน"
                >
                  ✓
                </button>
              </div>

              {/* Loading indicator */}
              {loading && (
                <div className="mt-6 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                  กำลังเข้าสู่ระบบ…
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [class*="animate-"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
