import { Link, NAV_GROUPS, NAV_SYSTEM, useCurrentPath, type NavItem } from "./AppNav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function NavRow({
  item,
  active,
  compact = false,
}: {
  item: NavItem;
  active: boolean;
  compact?: boolean;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className={cn(
          "px-3 transition-colors duration-100",
          compact ? "h-8 text-xs" : "h-9 text-[13px]",
          active
            ? "bg-transparent font-medium text-foreground shadow-[inset_2px_0_0_0_var(--color-primary)]"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Link to={item.to} className="flex items-center gap-3">
          <item.icon
            className={cn("shrink-0", compact ? "h-3.5 w-3.5" : "h-4 w-4", active && "text-primary")}
            strokeWidth={1.75}
          />
          <span className="truncate">{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const path = useCurrentPath();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const isActive = (to: string) => path === to || path.startsWith(to + "/");

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="border-b border-border px-4 py-4">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center bg-primary text-primary-foreground">
            <span className="text-sm font-bold">✦</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display truncate text-sm font-semibold tracking-tight text-foreground">
                Grace Ledger
              </p>
              <p className="truncate text-[11px] text-muted-foreground">การเงินคริสตจักร</p>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            {!collapsed && (
              <p className="kicker px-3 pb-1.5 text-[10px]">{group.label}</p>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => (
                  <NavRow key={item.to} item={item} active={isActive(item.to)} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border py-2">
        <SidebarMenu className="gap-0.5">
          {NAV_SYSTEM.map((item) => (
            <NavRow key={item.to} item={item} active={isActive(item.to)} compact />
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
