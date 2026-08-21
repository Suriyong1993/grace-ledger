export interface AppShellUser {
  name: string;
  role: string;
  initials: string;
  churchName?: string;
}

export interface AppShellProps {
  activeRoute: string;
  pendingCount?: number;
  user?: AppShellUser;
}

interface NavDestination {
  href: string;
  label: string;
  shortLabel: string;
  group: string;
  icon: string;
  isActive: (route: string) => boolean;
  badge?: number;
}

const ICON_DASHBOARD = `<path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z"/>`;
const ICON_APPROVALS = `<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>`;
const ICON_OFFERINGS = `<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h0M2 10h20"/>`;

function icon(paths: string, size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

function buildDestinations(pendingCount: number): NavDestination[] {
  return [
    {
      href: "#/",
      label: "แดชบอร์ด",
      shortLabel: "ภาพรวม",
      group: "ภาพรวม",
      icon: ICON_DASHBOARD,
      isActive: (route) => route === "/" || route === "",
    },
    {
      href: "#/approvals",
      label: "คิวอนุมัติ",
      shortLabel: "คิวอนุมัติ",
      group: "กำกับดูแล",
      icon: ICON_APPROVALS,
      isActive: (route) => route.startsWith("/approvals"),
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      href: "#/offerings",
      label: "เงินถวายวันอาทิตย์",
      shortLabel: "เงินถวาย",
      group: "เงินถวาย",
      icon: ICON_OFFERINGS,
      isActive: (route) => route.startsWith("/offerings"),
    },
  ];
}

function renderSidebarLink(dest: NavDestination, isActive: boolean): string {
  const badge = dest.badge
    ? `<span class="num-display" style="
        margin-left: auto;
        background: var(--primary);
        color: var(--primary-foreground);
        border-radius: var(--radius-full);
        padding: 1px 7px;
        font-size: var(--text-2xs);
        font-weight: var(--weight-bold);
      ">${dest.badge}</span>`
    : "";

  return `
    <a href="${dest.href}" class="gl-nav-item" ${isActive ? 'aria-current="page"' : ""} style="
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-height: var(--touch-target-min);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      font-size: var(--text-sm);
      font-weight: ${isActive ? "var(--weight-semibold)" : "var(--weight-medium)"};
      text-decoration: none;
      color: ${isActive ? "var(--primary)" : "var(--foreground)"};
      background: ${isActive ? "var(--accent)" : "transparent"};
    ">
      ${icon(dest.icon, 18)}
      <span>${dest.label}</span>
      ${badge}
    </a>`;
}

function renderMobileNavLink(dest: NavDestination, isActive: boolean): string {
  const badge = dest.badge
    ? `<span class="gl-mobilenav__badge num-display">${dest.badge}</span>`
    : "";
  return `
    <a href="${dest.href}" class="gl-mobilenav__item" ${isActive ? 'aria-current="page"' : ""}>
      ${icon(dest.icon, 20)}${badge}
      <span>${dest.shortLabel}</span>
    </a>`;
}

export function renderAppShellHtml(props: AppShellProps, contentHtml: string): string {
  const user = props.user;
  const displayName = user?.name || "ยังไม่ระบุผู้ใช้";
  const displayRole = user?.role || "";
  const initials = user?.initials || "?";
  const churchName = user?.churchName || "";

  const destinations = buildDestinations(props.pendingCount || 0);
  const active = destinations.find((d) => d.isActive(props.activeRoute));

  const groups: string[] = [];
  let lastGroup = "";
  for (const dest of destinations) {
    const isActive = dest === active;
    if (dest.group !== lastGroup) {
      if (lastGroup) groups.push(`</div>`);
      groups.push(`
        <div style="margin-bottom: var(--space-4);">
          <div class="kicker" style="padding: var(--space-1) var(--space-3) var(--space-2);">${dest.group}</div>`);
      lastGroup = dest.group;
    }
    groups.push(renderSidebarLink(dest, isActive));
  }
  if (lastGroup) groups.push(`</div>`);

  return `
  <div class="gl-app-container" style="
    display: flex;
    min-height: 100vh;
    background: var(--background);
    color: var(--foreground);
  ">
    <aside class="gl-sidebar" style="
      width: var(--gl-sidebar-w);
      flex-shrink: 0;
      background: var(--sidebar);
      border-right: 1px solid var(--sidebar-border);
      display: flex;
      flex-direction: column;
    ">
      <div style="
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-4) var(--space-5);
        border-bottom: 1px solid var(--sidebar-border);
      ">
        <div aria-hidden="true" style="
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          background: var(--primary);
          color: var(--primary-foreground);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: var(--weight-bold);
          font-size: var(--text-md);
        ">GL</div>
        <div style="min-width: 0;">
          <div style="font-weight: var(--weight-bold); font-size: var(--text-sm); letter-spacing: var(--tracking-heading);">
            Grace Ledger
          </div>
          <div style="font-size: var(--text-2xs); color: var(--muted-foreground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${churchName}
          </div>
        </div>
      </div>

      <nav aria-label="เมนูหลัก" style="flex: 1; overflow-y: auto; padding: var(--space-3) var(--space-2);">
        ${groups.join("")}
      </nav>

      <div style="
        padding: var(--space-3) var(--space-4);
        border-top: 1px solid var(--sidebar-border);
        display: flex;
        align-items: center;
        gap: var(--space-3);
      ">
        <div aria-hidden="true" style="
          width: 32px;
          height: 32px;
          border-radius: var(--radius-full);
          background: var(--sidebar-accent);
          color: var(--sidebar-accent-foreground);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: var(--weight-bold);
          font-size: var(--text-xs);
        ">${initials}</div>
        <div style="min-width: 0;">
          <div style="font-size: var(--text-sm); font-weight: var(--weight-semibold);">${displayName}</div>
          <div style="font-size: var(--text-2xs); color: var(--muted-foreground);">${displayRole}</div>
        </div>
      </div>
    </aside>

    <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
      <header style="
        min-height: var(--gl-topbar-h);
        border-bottom: 1px solid var(--border);
        background: color-mix(in srgb, var(--card) 92%, transparent);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        padding: 0 var(--space-5);
        position: sticky;
        top: 0;
        z-index: 100;
      ">
        <div style="display: flex; align-items: center; gap: var(--space-2); min-width: 0;">
          <span aria-hidden="true" class="gl-topbar-brand" style="
            display: none;
            font-weight: var(--weight-bold);
            font-size: var(--text-sm);
          ">Grace Ledger</span>
          <span style="font-size: var(--text-sm); font-weight: var(--weight-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${active ? active.label : ""}
          </span>
        </div>
        <div style="font-size: var(--text-xs); color: var(--muted-foreground); white-space: nowrap;">
          ${churchName}
        </div>
      </header>

      <main id="main-content" class="gl-app-main" style="flex: 1; overflow-y: auto;">
        ${contentHtml}
      </main>
    </div>

    <nav class="gl-mobilenav" aria-label="เมนูหลัก">
      ${destinations.map((d) => renderMobileNavLink(d, d === active)).join("")}
    </nav>
  </div>
  `;
}
