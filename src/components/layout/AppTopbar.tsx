import {
  LogOut,
  Search,
  Command as CommandIcon,
  Moon,
  Sun,
  Bell,
  Clock,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/types";
import { CommandPalette, useCommandPalette } from "@/components/shared/CommandPalette";
import { useTheme } from "@/components/shared/ThemeProvider";
import { cn } from "@/lib/utils";

/* Palette of avatar colors — semantic tokens, not hardcoded hex/oklch */
const AVATAR_COLORS: Record<string, string> = {
  super_admin: "var(--color-primary)", // Blue — Super Admin
  admin: "var(--color-income)", // Emerald — Admin
};

/* Role badge variant mapping */
const ROLE_BADGE_CLASS: Record<string, string> = {
  super_admin: "bg-primary/10 text-primary border-primary/20",
  admin: "bg-income-muted text-income border-income/20",
};

export function AppTopbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const palette = useCommandPalette();
  const { isDark, toggleTheme } = useTheme();

  const initial = user?.name?.trim()?.[0] ?? "?";
  const avatarBg = user?.role
    ? (AVATAR_COLORS[user.role] ?? "var(--color-primary)")
    : "var(--color-primary)";
  const roleBadge = user?.role ? (ROLE_BADGE_CLASS[user.role] ?? ROLE_BADGE_CLASS.auditor) : "";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 md:px-6">
        {/* Left: Sidebar trigger */}
        <div className="flex items-center gap-1">
          <SidebarTrigger className="text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" />
        </div>

        {/* Center: Quick nav pills (desktop) */}
        <div className="hidden md:flex items-center gap-1">
          {[
            { to: "/dashboard", label: "ภาพรวม" },
            { to: "/income", label: "รายรับ" },
            { to: "/expense", label: "รายจ่าย" },
            { to: "/offering", label: "เงินถวาย" },
            { to: "/reports", label: "รายงาน" },
          ].map(({ to, label }) => {
            const active =
              typeof window !== "undefined"
                ? window.location.pathname === to || window.location.pathname.startsWith(to + "/")
                : false;
            return (
              <a
                key={to}
                href={to}
                className={[
                  "px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                ].join(" ")}
              >
                {label}
              </a>
            );
          })}
        </div>

        {/* Right: Actions + User */}
        <div className="flex items-center gap-1.5 justify-self-end">
          {/* Mobile search */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:hidden"
            aria-label="ค้นหา"
            onClick={() => palette.setOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* Pending approvals indicator — visible only for treasurer+ */}
          {(user?.role === "admin" || user?.role === "super_admin") && (
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="รายการรออนุมัติ"
              onClick={() => navigate({ to: "/approvals" as never })}
            >
              <Clock className="h-4 w-4" />
              {/* Dot indicator — will show count in future */}
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-pending animate-pulse-glow" />
            </Button>
          )}

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label={isDark ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
            onClick={toggleTheme}
          >
            {isDark ? <Sun className="h-4 w-4 text-offering" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                id="topbar-user-menu"
                className={cn(
                  "h-9 gap-2 bg-card px-2 border border-border",
                  "hover:border-border hover:bg-secondary active-press",
                )}
              >
                <Avatar className="h-6 w-6 rounded-md shrink-0">
                  <AvatarFallback
                    style={{ background: avatarBg }}
                    className="rounded-md text-[10px] font-bold text-white"
                  >
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden min-w-0 text-left sm:block">
                  <p className="max-w-[100px] truncate text-xs font-semibold leading-tight text-foreground">
                    {user?.name}
                  </p>
                  <p className={cn("truncate text-[10px] font-medium px-1 rounded", roleBadge)}>
                    {user ? ROLE_LABEL[user.role] : ""}
                  </p>
                </div>
                <ChevronRight className="hidden h-3 w-3 text-muted-foreground sm:block" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="pb-1">
                <p className="text-xs font-semibold text-foreground">{user?.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {user ? ROLE_LABEL[user.role] : ""}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/profile" })} className="text-sm">
                โปรไฟล์
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 text-sm"
                onClick={() => {
                  logout();
                  navigate({ to: "/auth" });
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                ออกจากระบบ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
    </header>
  );
}
