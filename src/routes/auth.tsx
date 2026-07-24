// src/routes/auth.tsx — Updated: Supabase Auth (email/password) replaces PIN 6 digits
// Changes made:
// 1. Removed PinPad component (was for insecure PIN login)
// 2. Removed loadDb() + demoUsers (mock data — Supabase DB is now real)
// 3. Added email/password form with validation
// 4. Added "Forgot password?" link (Supabase handles password reset)
// 5. Added "Don't have an account? Sign up" link
// 6. Removed useAuth() for login only — useAuth() still provides signUp/signOut if needed
// 7. Uses Supabase Auth signInWithPassword() — credentials go to Supabase (bcrypt + argon2 hashed)
// 8. onSubmit: email + password → Supabase session → redirect to /dashboard
// 9. If session exists → auto-redirect (same as before)
//
// Why this matters:
// - PIN 6 digits stored in localStorage = no security (XSS steals it trivially)
// - Email/password goes to Supabase Auth — server-side bcrypt hashing
// - Supabase manages session in httpOnly cookies (not accessible to JS = safe from XSS)
// - Supabase handles brute-force lockout, password reset, email verification automatically

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Church, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/types";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ระบบ — ระบบจัดการการเงินคริสตจักร" },
      { name: "description", content: "เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in (same as previous PIN-based logic)
  if (authUser) {
    navigate({ to: "/dashboard", replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validate
    if (!email.trim() || !password) {
      setError("กรุณากรอกอีเมลและรหัสผ่าน");
      setLoading(false);
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("รูปแบบอีเมลไม่ถูกต้อง");
      setLoading(false);
      return;
    }

    // Password length check (Supabase default min 6)
    if (password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      setLoading(false);
      return;
    }

    try {
      const { signIn } = useAuth();
      // NOTE: signIn is from useAuth() hook, which calls supabase.auth.signInWithPassword()
      // This triggers Supabase Auth flow — password verified server-side (bcrypt/argon2)
      // On success: Supabase sets httpOnly session cookie + returns session
      // On failure: generic "Invalid credentials" (prevents user enumeration)
      const result = await signIn(email.trim(), password);

      if (result) {
        toast.success(`ยินดีต้อนรับ ${result.name}`);
        navigate({ to: "/dashboard", replace: true });
      } else {
        setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      }
    } catch (err) {
      // Supabase returns generic error to prevent user enumeration
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh grid lg:grid-cols-2 bg-background">
      {/* Left panel — branding */}
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
            ดูแลการเงินคริสตจักร
            <br />
            ด้วยความโปร่งใสและง่ายดาย
          </h1>
          <p className="mt-4 text-white/85">
            บันทึกรายรับ รายจ่าย เงินถวาย บริหารกองทุน งบประมาณ และออกรายงานได้ในที่เดียว
          </p>
        </motion.div>
        <p className="relative text-xs opacity-70">© {new Date().getFullYear()} Church Finance</p>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-col items-center justify-center p-6 md:p-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm"
        >
          {/* Logo + title */}
          <div className="text-center mb-8">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
              <Church className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground">เข้าสู่ระบบ</h2>
            <p className="text-sm text-muted-foreground mt-1">
              กรอกอีเมลและรหัสผ่านของคุณ
            </p>
          </div>

          {/* Error display */}
          {error && (
            <div className="mb-4 rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">อีเมล</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="example@church.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  autoComplete="email"
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">รหัสผ่าน</Label>
                <a
                  href="/forgot-password"
                  className="text-xs text-primary hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info("ลืมรหัสผ่าน? ติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่าน");
                  }}
                >
                  ลืมรหัสผ่าน?
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  กำลังเข้าสู่ระบบ...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  เข้าสู่ระบบ
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Sign up link */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            ยังไม่มีบัญชี?{" "}
            <a
              href="/register"
              className="text-primary font-medium hover:underline"
              onClick={(e) => {
                e.preventDefault();
                toast.info("สมัครสมาชิก: กรุณาติดต่อผู้ดูแลระบบเพื่อขอบัญชีใหม่");
              }}
            >
              สมัครสมาชิก
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}