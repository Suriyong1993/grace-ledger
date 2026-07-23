import { Church } from "lucide-react";
import { Link, NAV, useCurrentPath } from "./AppNav";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const path = useCurrentPath();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b border-sidebar-border/60 pb-3 pt-3">
        <div className="flex items-center gap-3 px-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <span className="text-base font-bold">✦</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs tracking-widest font-bold uppercase text-foreground/90 font-mono">GRACE LEDGER</p>
              <p className="truncate text-[11px] font-medium text-muted-foreground">ระบบการเงินคริสตจักร</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active = path === item.to || path.startsWith(item.to + "/");
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      className={cn(
                        "rounded-2xl h-10 px-3 transition-all duration-150 ease-[var(--ease-out)] active:scale-[0.98]",
                        active
                          ? "bg-primary/12 text-primary font-semibold shadow-2xs hover:bg-primary/18"
                          : "hover:bg-accent/70 hover:text-foreground",
                      )}
                    >
                      <Link to={item.to} className="flex items-center gap-3">
                        <item.icon className={cn("h-4 w-4 shrink-0 transition-transform duration-150", active && "scale-110")} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
