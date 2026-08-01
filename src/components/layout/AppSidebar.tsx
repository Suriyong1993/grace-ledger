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

/* GL wordmark — SVG-based, no emoji */
function GraceLedgerMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Grace Ledger"
    >
      {/* Background */}
      <rect width="36" height="36" rx="9" fill="currentColor" className="text-primary" />
      {/* "GL" lettermark */}
      <text
        x="18"
        y="24"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fontFamily="Inter, Sarabun, sans-serif"
        letterSpacing="-0.5"
        fill="white"
      >
        GL
      </text>
    </svg>
  );
}

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
          "group/nav-row px-3 transition-all duration-150 rounded-lg",
          compact ? "h-8 text-xs" : "h-9 text-[13px]",
          active
            ? [
                "bg-primary/8 font-semibold text-primary",
                "border border-primary/15 shadow-xs",
                "dark:bg-primary/12 dark:border-primary/20",
              ]
            : [
                "text-muted-foreground font-medium",
                "hover:bg-muted hover:text-foreground",
                "border border-transparent",
              ],
        )}
      >
        <Link to={item.to} className="flex items-center gap-2.5">
          <item.icon
            className={cn(
              "shrink-0 transition-all duration-150",
              compact ? "h-3.5 w-3.5" : "h-4 w-4",
              active
                ? "text-primary"
                : "text-muted-foreground/60 group-hover/nav-row:text-foreground",
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
    <Sidebar
      collapsible="icon"
      className="border-r border-border/60 bg-sidebar"
    >
      {/* ── Header: Wordmark ── */}
      <SidebarHeader className="border-b border-border/60 px-3 py-3">
        <Link
          to="/dashboard"
          className="flex items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-muted/60 group"
        >
          <div className="shrink-0 transition-transform duration-200 group-hover:scale-105">
            <GraceLedgerMark size={34} />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display truncate text-sm font-bold tracking-tight text-foreground">
                Grace Ledger
              </p>
              <p className="truncate text-[10px] font-medium text-muted-foreground/70">
                ระบบการเงินคริสตจักร
              </p>
            </div>
          )}
        </Link>
      </SidebarHeader>

      {/* ── Navigation ── */}
      <SidebarContent className="pt-2 pb-2">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            {!collapsed && (
              <p className="kicker px-3 pb-1.5 pt-0.5">{group.label}</p>
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

      {/* ── Footer: System nav ── */}
      <SidebarFooter className="border-t border-border/60 py-2">
        {!collapsed && (
          <p className="kicker px-3 pb-1.5">ระบบ</p>
        )}
        <SidebarMenu className="gap-0.5">
          {NAV_SYSTEM.map((item) => (
            <NavRow key={item.to} item={item} active={isActive(item.to)} compact />
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
