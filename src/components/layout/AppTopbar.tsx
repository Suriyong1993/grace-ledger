import { LogOut, Search, Command as CommandIcon, Moon, Sun } from "lucide-react";
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
import { useTheme } from "@/components/shared/ThemeProvider";

export function AppTopbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const palette = useCommandPalette();
  const { isDark, toggleTheme } = useTheme();

  const initial = user?.name?.trim()?.[0] ?? "?";

  return (
    <header className="glass-topbar sticky top-0 z-30 border-b border-border/80">
      <div className="grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 md:px-6">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="hover:bg-muted/80 rounded-lg transition-colors" />
        </div>
        <button
          type="button"
          onClick={() => palette.setOpen(true)}
          className="group hidden w-full max-w-sm cursor-pointer items-center gap-2.5 rounded-lg border border-border/80 bg-muted/40 px-3.5 py-1.5 text-sm text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted/80 hover:shadow-2xs md:flex"
        >
          <Search
            className="h-3.5 w-3.5 text-muted-foreground/70 transition-colors group-hover:text-primary"
            strokeWidth={2}
          />
          <span className="flex-1 truncate text-left text-xs font-normal">
            ค้นหารายการ, สมาชิก, กองทุน…
          </span>
          <kbd className="hidden items-center gap-1 rounded-md border border-border/80 bg-card px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground shadow-2xs lg:inline-flex">
            <CommandIcon className="h-3 w-3" /> K
          </kbd>
        </button>
        <div className="flex items-center gap-2 justify-self-end">
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            aria-label={isDark ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
            onClick={toggleTheme}
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg md:hidden"
            aria-label="ค้นหา"
            onClick={() => palette.setOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/80 bg-card px-2.5 py-1 shadow-2xs transition-all hover:border-border hover:bg-muted/60">
                <Avatar className="h-6 w-6 rounded-md">
                  <AvatarFallback
                    style={{ background: user?.avatarColor ?? "#C08233" }}
                    className="rounded-md text-[10px] font-bold text-white shadow-xs"
                  >
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden min-w-0 pr-1 text-left sm:block">
                  <p className="max-w-28 truncate text-xs font-semibold leading-tight text-foreground">
                    {user?.name}
                  </p>
                  <p className="truncate text-[10px] font-medium text-muted-foreground">
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
