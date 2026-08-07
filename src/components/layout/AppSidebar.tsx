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
import React from "react";

/* GL wordmark — sidebar-primary badge */
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
      <rect width="36" height="36" rx="9" fill="var(--color-sidebar-primary)" />
      <text
        x="18"
        y="24"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fontFamily="Inter, Sarabun, sans-serif"
        letterSpacing="-0.5"
        fill="var(--color-sidebar-primary-foreground)"
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
    <SidebarMenuItem className="relative">
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className={cn(
          "group/nav-row relative transition-all duration-150 rounded-lg",
          compact ? "h-8" : "h-10",
          active
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-icon hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        <Link to={item.to} className="flex items-center gap-2.5 px-3">
          {/* Active left indicator */}
          {active && (
            <span
              className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-sidebar-primary"
              aria-hidden
            />
          )}
          <span
            className={cn(
              "grid shrink-0 place-items-center rounded-md transition-colors duration-150",
              compact ? "h-5 w-5" : "h-6 w-6",
              active
                ? "text-sidebar-primary"
                : "text-sidebar-icon group-hover/nav-row:text-sidebar-foreground",
            )}
          >
            <item.icon
              className={compact ? "h-3.5 w-3.5" : "h-4 w-4"}
              strokeWidth={active ? 2.25 : 1.75}
            />
          </span>
          <span className="truncate text-[13px] font-medium">{item.label}</span>
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
      className="border-r-0"
      style={{ "--sidebar-width": "220px", "--sidebar-width-icon": "64px" } as React.CSSProperties}
    >
      {/* ── Header: Wordmark ── */}
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <Link
          to="/dashboard"
          className="group flex items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-sidebar-accent"
        >
          <div className="shrink-0">
            <GraceLedgerMark size={34} />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display truncate text-sm font-bold tracking-tight text-sidebar-foreground">
                Grace Ledger
              </p>
              <p className="truncate text-[10px] font-medium text-sidebar-icon">
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
              <p className="px-3 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-icon/60">
                {group.label}
              </p>
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
      <SidebarFooter className="border-t border-sidebar-border py-2">
        {!collapsed && (
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-icon/60">
            ระบบ
          </p>
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
