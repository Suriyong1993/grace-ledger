import { LogOut, Search, Command as CommandIcon } from "lucide-react";
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
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="grid h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 md:px-6">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
        </div>
        <button
          type="button"
          onClick={() => palette.setOpen(true)}
          className="hidden w-full max-w-sm cursor-pointer items-center gap-2 border border-border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex"
        >
          <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span className="flex-1 truncate text-left text-xs">ค้นหารายการ, สมาชิก, กองทุน…</span>
          <kbd className="hidden items-center gap-1 border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] lg:inline-flex">
            <CommandIcon className="h-3 w-3" /> K
          </kbd>
        </button>
        <div className="flex items-center gap-1 justify-self-end">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="ค้นหา"
            onClick={() => palette.setOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex cursor-pointer items-center gap-2 border border-border bg-card px-2 py-1 transition-colors hover:bg-muted">
                <Avatar className="h-6 w-6">
                  <AvatarFallback
                    style={{ background: user?.avatarColor ?? "#C08233" }}
                    className="text-[10px] font-medium text-white"
                  >
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden min-w-0 pr-1 text-left sm:block">
                  <p className="max-w-28 truncate text-xs font-medium leading-tight text-foreground">
                    {user?.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {user ? ROLE_LABEL[user.role] : ""}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                บัญชีของฉัน
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                โปรไฟล์
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                ตั้งค่า
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10"
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
