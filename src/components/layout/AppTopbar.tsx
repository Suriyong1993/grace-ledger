import { LogOut, Search, Bell, Command as CommandIcon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

export function AppTopbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const palette = useCommandPalette();

  const initial = user?.name?.trim()?.[0] ?? "?";

  return (
    <header className="sticky top-0 z-30 glass-topbar transition-all duration-200">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 md:px-6 h-14">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="rounded-xl active-press" />
        </div>
        <button
          type="button"
          onClick={() => palette.setOpen(true)}
          className="hidden md:flex items-center gap-2.5 max-w-md w-full rounded-2xl bg-muted/50 hover:bg-muted/80 border border-border/40 transition-all duration-150 active:scale-[0.99] px-3.5 py-1.5 text-sm text-muted-foreground shadow-2xs cursor-pointer"
        >
          <Search className="h-4 w-4 text-muted-foreground/70" />
          <span className="truncate flex-1 text-left text-xs font-normal">ค้นหารายการ, สมาชิก, กองทุน…</span>
          <kbd className="hidden lg:inline-flex items-center gap-1 rounded-lg border border-border/60 bg-background/90 px-1.5 py-0.5 text-[10px] font-mono font-medium shadow-2xs">
            <CommandIcon className="h-3 w-3 text-muted-foreground" /> K
          </kbd>
        </button>
        <div className="flex items-center gap-2 justify-self-end">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl md:hidden active:scale-95"
            aria-label="ค้นหา"
            onClick={() => palette.setOpen(true)}
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-xl active:scale-95" aria-label="แจ้งเตือน">
            <Bell className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 rounded-2xl bg-card/90 px-2.5 py-1 border border-border/60 shadow-2xs hover:bg-accent/80 transition-all duration-150 active:scale-[0.97] cursor-pointer">
                <Avatar className="h-7.5 w-7.5 shadow-2xs">
                  <AvatarFallback
                    style={{ background: user?.avatarColor ?? "#F97316" }}
                    className="text-white text-xs font-semibold"
                  >
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left min-w-0 pr-1">
                  <p className="text-xs font-semibold leading-tight truncate max-w-32 text-foreground">{user?.name}</p>
                  <p className="text-[10px] font-medium text-muted-foreground/80">
                    {user ? ROLE_LABEL[user.role] : ""}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl border-border/60 backdrop-blur-xl">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                บัญชีของฉัน
              </DropdownMenuLabel>
              <DropdownMenuItem className="rounded-xl cursor-pointer" onClick={() => navigate({ to: "/profile" })}>
                โปรไฟล์
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl cursor-pointer" onClick={() => navigate({ to: "/settings" })}>
                ตั้งค่า
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive rounded-xl cursor-pointer focus:bg-destructive/10"
                onClick={() => {
                  logout();
                  navigate({ to: "/auth" });
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> ออกจากระบบ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
    </header>
  );
}
