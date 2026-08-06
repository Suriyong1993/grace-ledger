import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/types";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "โปรไฟล์" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <div className="max-w-2xl">
      <PageHeader kicker="ระบบ" title="โปรไฟล์" description="บัญชีและสิทธิ์การใช้งานของคุณ" />

      {/* Identity */}
      <section className="card-ledger">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center bg-primary/10 text-xl font-semibold text-primary">
            {user.name[0]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-lg font-semibold tracking-tight text-foreground">
              {user.name}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
              {ROLE_LABEL[user.role]}
            </p>
          </div>
          <Button
            variant="outline"
            className="h-8"
            onClick={() => {
              logout();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="mr-1.5 h-4 w-4" /> ออกจากระบบ
          </Button>
        </div>

        {/* Account details */}
        <div className="divide-y divide-border border-t border-border">
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <span className="text-sm text-muted-foreground">ชื่อผู้ใช้</span>
            <span className="text-sm font-medium text-foreground">{user.name}</span>
          </div>
          {user.email && (
            <div className="flex items-center justify-between gap-4 px-5 py-3">
              <span className="text-sm text-muted-foreground">อีเมล</span>
              <span className="truncate text-sm font-medium text-foreground">{user.email}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <span className="text-sm text-muted-foreground">สิทธิ์</span>
            <span className="text-sm font-medium text-foreground">{ROLE_LABEL[user.role]}</span>
          </div>
        </div>
      </section>

      <p className="mt-4 text-xs text-muted-foreground">
        การเข้าสู่ระบบใช้รหัส PIN 6 หลัก — หากต้องการเปลี่ยนรหัส กรุณาติดต่อผู้ดูแลระบบ
      </p>
    </div>
  );
}
