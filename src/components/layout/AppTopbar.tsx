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
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 md:px-6 h-14">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="rounded-xl" />
        </div>
        <button
          type="button"
          onClick={() => palette.setOpen(true)}
          className="hidden md:flex items-center gap-2 max-w-md w-full rounded-xl bg-muted/60 hover:bg-muted transition px-3 py-1.5 text-sm text-muted-foreground"
        >
          <Search className="h-4 w-4" />
          <span className="truncate flex-1 text-left">ค้นหารายการ, สมาชิก, กองทุน…</span>
          <kbd className="hidden lg:inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium">
            <CommandIcon className="h-3 w-3" /> K
          </kbd>
        </button>
        <div className="flex items-center gap-2 justify-self-end">
          <Button variant="ghost" size="icon" className="rounded-xl md:hidden" aria-label="ค้นหา" onClick={() => palette.setOpen(true)}>
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-xl" aria-label="แจ้งเตือน">
            <Bell className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-2xl bg-card px-2 py-1 border shadow-sm hover:bg-accent transition">
                <Avatar className="h-8 w-8">
                  <AvatarFallback style={{ background: user?.avatarColor ?? "#F97316" }} className="text-white">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left min-w-0">
                  <p className="text-sm font-medium leading-none truncate max-w-32">{user?.name}</p>
                  <p className="text-[11px] text-muted-foreground">{user ? ROLE_LABEL[user.role] : ""}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl">
              <DropdownMenuLabel className="text-xs text-muted-foreground">บัญชีของฉัน</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>โปรไฟล์</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>ตั้งค่า</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => { logout(); navigate({ to: "/auth" }); }}>
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