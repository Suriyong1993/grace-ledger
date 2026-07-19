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
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-elegant">
            <Church className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">การเงินคริสตจักร</p>
              <p className="truncate text-[11px] text-muted-foreground">Church Finance</p>
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
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label} className={cn("rounded-xl h-10", active && "bg-primary/10 text-primary hover:bg-primary/15")}> 
                      <Link to={item.to} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 shrink-0" />
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