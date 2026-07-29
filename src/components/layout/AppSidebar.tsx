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
          "px-3 transition-all duration-150 rounded-lg",
          compact ? "h-8 text-xs" : "h-9 text-[13px]",
          active
            ? "bg-primary/10 font-semibold text-primary border border-primary/20 shadow-2xs"
            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
        )}
      >
        <Link to={item.to} className="flex items-center gap-3">
          <item.icon
            className={cn(
              "shrink-0 transition-transform duration-150",
              compact ? "h-3.5 w-3.5" : "h-4 w-4",
              active ? "text-primary scale-105" : "text-muted-foreground/70",
            )}
            strokeWidth={active ? 2.25 : 1.75}
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
    <Sidebar collapsible="icon" className="border-r border-border/80 bg-sidebar/95">
      <SidebarHeader className="border-b border-border/80 px-4 py-3.5">
        <Link to="/dashboard" className="flex items-center gap-3 group">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm shadow-primary/20 transition-transform duration-200 group-hover:scale-105">
            <span className="text-base font-bold">✦</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display truncate text-sm font-bold tracking-tight text-foreground">
                Grace Ledger
              </p>
              <p className="truncate text-[11px] font-medium text-muted-foreground/80">
                การเงินคริสตจักร
              </p>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            {!collapsed && <p className="kicker px-3 pb-1.5 text-[10px]">{group.label}</p>}
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
