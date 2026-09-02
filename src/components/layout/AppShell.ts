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
const ICON_TRANSACTIONS = `<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12.5h2"/><path d="M3 10h18"/>`;
const ICON_OFFERINGS = `<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h0M2 10h20"/>`;
const ICON_FUNDS = `<path d="M12 4l8 4-8 4-8-4 8-4z"/><path d="M4 13l8 4 8-4"/><path d="M4 17l8 4 8-4"/>`;
const ICON_APPROVALS = `<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>`;
const ICON_MEMBERS = `<circle cx="12" cy="7" r="4"/><path d="M5.5 21v-2a6.5 6.5 0 0 1 13 0v2"/>`;
const ICON_REPORTS = `<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h3"/>`;
const ICON_PROFILE = `<circle cx="12" cy="8" r="4"/><path d="M6 20v-1a6 6 0 0 1 12 0v1"/>`;
const ICON_BELL = `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`;
const ICON_LOGOUT = `<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>`;

function icon(paths: string, size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

function buildSidebarDestinations(pendingCount: number): NavDestination[] {
  return [
    {
      href: "#/",
      label: "แดชบอร์ด",
      shortLabel: "หน้าหลัก",
      group: "ภาพรวม",
      icon: ICON_DASHBOARD,
      isActive: (route) => route === "/" || route === "",
    },
    {
      href: "#/transactions",
      label: "รายการเงิน",
      shortLabel: "การเงิน",
      group: "ธุรกรรมและการเงิน",
      icon: ICON_TRANSACTIONS,
      isActive: (route) => route.startsWith("/transactions"),
    },
    {
      href: "#/offerings",
      label: "เงินถวายวันอาทิตย์",
      shortLabel: "เงินถวาย",
      group: "ธุรกรรมและการเงิน",
      icon: ICON_OFFERINGS,
      isActive: (route) => route.startsWith("/offerings"),
    },
    {
      href: "#/funds",
      label: "กองทุนและงบประมาณ",
      shortLabel: "กองทุน",
      group: "ธุรกรรมและการเงิน",
      icon: ICON_FUNDS,
      isActive: (route) => route.startsWith("/funds"),
    },
    {
      href: "#/approvals",
      label: "คิวอนุมัติ",
      shortLabel: "อนุมัติ",
      group: "กำกับดูแล",
      icon: ICON_APPROVALS,
      isActive: (route) => route.startsWith("/approvals"),
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      href: "#/members",
      label: "สมาชิกและการถวาย",
      shortLabel: "สมาชิก",
      group: "สารบบและรายงาน",
      icon: ICON_MEMBERS,
      isActive: (route) => route.startsWith("/members"),
    },
    {
      href: "#/reports",
      label: "รายงานการเงิน",
      shortLabel: "รายงาน",
      group: "สารบบและรายงาน",
      icon: ICON_REPORTS,
      isActive: (route) => route.startsWith("/reports"),
    },
    {
      href: "#/profile",
      label: "โปรไฟล์และระบบ",
      shortLabel: "โปรไฟล์",
      group: "บัญชีผู้ใช้",
      icon: ICON_PROFILE,
      isActive: (route) => route.startsWith("/profile"),
    },
  ];
}

/** 5 Primary Destinations for Mobile Bottom Navigation */
function buildMobileBottomDestinations(pendingCount: number): NavDestination[] {
  return [
    {
      href: "#/",
      label: "แดชบอร์ด",
      shortLabel: "หน้าหลัก",
      group: "หลัก",
      icon: ICON_DASHBOARD,
      isActive: (route) => route === "/" || route === "",
    },
    {
      href: "#/offerings",
      label: "เงินถวาย",
      shortLabel: "ถวายทรัพย์",
      group: "หลัก",
      icon: ICON_OFFERINGS,
      isActive: (route) => route.startsWith("/offerings"),
    },
    {
      href: "#/approvals",
      label: "อนุมัติ",
      shortLabel: "อนุมัติ",
      group: "หลัก",
      icon: ICON_APPROVALS,
      isActive: (route) => route.startsWith("/approvals"),
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      href: "#/reports",
      label: "รายงาน",
      shortLabel: "รายงาน",
      group: "หลัก",
      icon: ICON_REPORTS,
      isActive: (route) => route.startsWith("/reports"),
    },
    {
      href: "#/profile",
      label: "โปรไฟล์",
      shortLabel: "โปรไฟล์",
      group: "หลัก",
      icon: ICON_PROFILE,
      isActive: (route) => route.startsWith("/profile"),
    },
  ];
}

function renderSidebarLink(dest: NavDestination, isActive: boolean): string {
  const badge = dest.badge
    ? `<span class="num-display" style="
        margin-left: auto;
        background: var(--pending);
        color: var(--primary-foreground);
        border-radius: var(--radius-full);
        padding: 1px 7px;
        font-size: var(--text-2xs);
        font-weight: var(--weight-bold);
      ">${dest.badge}</span>`
    : "";

  return `
    <a href="${dest.href}" class="gl-nav-item${isActive ? " gl-nav-item--active" : ""}" ${isActive ? 'aria-current="page"' : ""}>
      <span class="gl-nav-item__icon">${icon(dest.icon, 18)}</span>
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
      <span style="position: relative; display: inline-flex;">
        ${icon(dest.icon, 22)}
        ${badge}
      </span>
      <span>${dest.shortLabel}</span>
    </a>`;
}

export function renderAppShellHtml(props: AppShellProps, contentHtml: string): string {
  const user = props.user;
  const displayName = user?.name || "ยังไม่ระบุผู้ใช้";
  const displayRole = user?.role || "";
  const initials = user?.initials || "?";
  const churchName = user?.churchName || "";
  const pendingCount = props.pendingCount || 0;

  const sidebarDestinations = buildSidebarDestinations(pendingCount);
  const mobileDestinations = buildMobileBottomDestinations(pendingCount);
  const activeSidebar = sidebarDestinations.find((d) => d.isActive(props.activeRoute));
  const activePageLabel = activeSidebar ? activeSidebar.label : "Grace Ledger";

  const groups: string[] = [];
  let lastGroup = "";
  for (const dest of sidebarDestinations) {
    const isActive = dest === activeSidebar;
    if (dest.group !== lastGroup) {
      if (lastGroup) groups.push(`</div>`);
      groups.push(`
        <div style="margin-bottom: var(--space-4);">
          <div class="kicker gl-sidebar__dim" style="padding: var(--space-1) var(--space-3) var(--space-2);">${dest.group}</div>`);
      lastGroup = dest.group;
    }
    groups.push(renderSidebarLink(dest, isActive));
  }
  if (lastGroup) groups.push(`</div>`);

  return `
  <style>
    .gl-nav-item {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-height: var(--touch-target-min);
      padding: var(--space-2) var(--space-3);
      margin-bottom: 2px;
      border-radius: var(--radius-sm);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      text-decoration: none;
      color: var(--sidebar-foreground);
      background: transparent;
      transition: background var(--duration-micro) var(--ease-out), color var(--duration-micro) var(--ease-out);
    }
    .gl-nav-item__icon { display: flex; color: var(--sidebar-icon); transition: color var(--duration-micro) var(--ease-out); }
    .gl-nav-item:hover { background: var(--sidebar-accent); color: var(--sidebar-accent-foreground); }
    .gl-nav-item:hover .gl-nav-item__icon { color: var(--sidebar-accent-foreground); }
    .gl-nav-item:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
    .gl-nav-item--active {
      background: var(--sidebar-accent);
      color: var(--sidebar-primary);
      font-weight: var(--weight-semibold);
    }
    .gl-nav-item--active .gl-nav-item__icon { color: var(--sidebar-primary); }
    .gl-nav-item--active::before {
      content: "";
      position: absolute;
      left: -6px;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 18px;
      border-radius: var(--radius-full);
      background: var(--sidebar-primary);
    }
    /* Dimmed text *inside the dark vault sidebar* must derive from
       --sidebar-foreground — the light-theme --muted-foreground fails
       contrast on --sidebar. */
    .gl-sidebar .gl-sidebar__dim {
      color: color-mix(in srgb, var(--sidebar-foreground) 62%, transparent);
    }
    .gl-sidebar .gl-logout-btn {
      color: color-mix(in srgb, var(--sidebar-foreground) 72%, transparent);
    }
    .gl-sidebar .gl-logout-btn:hover {
      background: var(--sidebar-accent);
      color: var(--sidebar-accent-foreground);
    }
    .gl-shell-mark {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm);
      background: var(--sidebar-primary);
      color: var(--sidebar-primary-foreground);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .gl-shell-avatar {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-full);
      background: var(--sidebar-primary);
      color: var(--sidebar-primary-foreground);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: var(--weight-bold);
      font-size: var(--text-xs);
      flex-shrink: 0;
      text-decoration: none;
    }
    .gl-shell-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--touch-target-min);
      height: var(--touch-target-min);
      border-radius: var(--radius-full);
      border: 1px solid var(--border);
      background: var(--background);
      color: var(--foreground);
      cursor: pointer;
      position: relative;
      text-decoration: none;
      transition: background var(--duration-micro) var(--ease-out);
    }
    .gl-shell-icon-btn:hover {
      background: var(--muted);
    }
    .gl-shell-bell-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      background: var(--pending);
      color: var(--primary-foreground);
      border-radius: var(--radius-full);
      padding: 0 4px;
      min-width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--text-2xs);
      font-weight: var(--weight-bold);
      border: 2px solid var(--card);
    }
  </style>

  <div class="gl-app-container" style="
    display: flex;
    min-height: 100vh;
    background: var(--background);
    color: var(--foreground);
  ">
    <!-- Desktop Sidebar -->
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
        <div class="gl-shell-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <path d="M6 5.5C6 4.67157 6.67157 4 7.5 4H16.5C17.3284 4 18 4.67157 18 5.5V19.5L12 16.5L6 19.5V5.5Z" fill="currentColor"/>
          </svg>
        </div>
        <div style="min-width: 0; color: var(--sidebar-foreground);">
          <div style="font-weight: var(--weight-bold); font-size: var(--text-sm); letter-spacing: var(--tracking-heading);">
            Grace Ledger
          </div>
          <div class="gl-sidebar__dim" style="font-size: var(--text-2xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${churchName}
          </div>
        </div>
      </div>

      <nav aria-label="เมนูหลัก" style="flex: 1; overflow-y: auto; padding: var(--space-3) var(--space-2) var(--space-3) var(--space-4);">
        ${groups.join("")}
      </nav>

      <div style="
        padding: var(--space-3) var(--space-4);
        border-top: 1px solid var(--sidebar-border);
        display: flex;
        align-items: center;
        gap: var(--space-3);
        color: var(--sidebar-foreground);
      ">
        <a href="#/profile" class="gl-shell-avatar" aria-hidden="true" title="ดูโปรไฟล์">${initials}</a>
        <div style="min-width: 0; flex: 1;">
          <a href="#/profile" style="text-decoration: none; color: inherit; display: block;">
            <div style="font-size: var(--text-sm); font-weight: var(--weight-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayName}</div>
            <div class="gl-sidebar__dim" style="font-size: var(--text-2xs);">${displayRole}</div>
          </a>
        </div>
        <button type="button" class="gl-logout-btn" data-logout aria-label="ออกจากระบบ" title="ออกจากระบบ">
          ${icon(ICON_LOGOUT, 18)}
        </button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
      <!-- Mobile/Desktop Top Header -->
      <header class="gl-shell-topbar" style="
        min-height: var(--gl-topbar-h);
        border-bottom: 1px solid var(--border);
        background: color-mix(in srgb, var(--card) 88%, transparent);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        padding: 0 var(--space-4);
        position: sticky;
        top: 0;
        z-index: 100;
      ">
        <div class="gl-shell-topbar__title" style="display: flex; align-items: center; gap: var(--space-2); min-width: 0;">
          <span aria-hidden="true" class="gl-topbar-brand" style="
            display: none;
            font-weight: var(--weight-bold);
            font-size: var(--text-sm);
          ">Grace Ledger</span>
          <span class="gl-shell-topbar__page" style="font-size: var(--text-base); font-weight: var(--weight-bold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${activePageLabel}
          </span>
        </div>

        <div class="gl-shell-topbar__context" style="display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-xs); color: var(--muted-foreground); white-space: nowrap;">
          <span class="gl-shell-church-chip" style="display: inline-flex; align-items: center; gap: 4px; background: var(--muted); padding: 3px 8px; border-radius: var(--radius-full); font-size: var(--text-2xs); font-weight: var(--weight-medium); max-width: 140px; overflow: hidden; text-overflow: ellipsis;">
            <span class="gl-shell-status-dot" aria-hidden="true"></span>
            <span style="overflow: hidden; text-overflow: ellipsis;">${churchName}</span>
          </span>

          <!-- Notification Bell -->
          <a href="#/approvals" class="gl-shell-icon-btn" aria-label="การแจ้งเตือนและการอนุมัติ" title="คิวอนุมัติ (${pendingCount} รายการ)">
            ${icon(ICON_BELL, 18)}
            ${pendingCount > 0 ? `<span class="gl-shell-bell-badge num-display">${pendingCount}</span>` : ""}
          </a>

          <!-- Profile Avatar Link -->
          <a href="#/profile" class="gl-shell-avatar" style="width: var(--touch-target-min); height: var(--touch-target-min); font-size: var(--text-sm);" aria-label="โปรไฟล์ผู้ใช้" title="${displayName}">
            ${initials}
          </a>

          <!-- Sign Out Button -->
          <button type="button" class="gl-logout-btn gl-logout-btn--topbar" data-logout aria-label="ออกจากระบบ" title="ออกจากระบบ">
            ${icon(ICON_LOGOUT, 18)}
          </button>
        </div>
      </header>

      <main id="main-content" class="gl-app-main" style="flex: 1; overflow-y: auto;">
        ${contentHtml}
      </main>
    </div>

    <!-- 5-Tab Mobile Bottom Navigation -->
    <nav class="gl-mobilenav" aria-label="เมนูหลัก">
      ${mobileDestinations.map((d) => renderMobileNavLink(d, d.isActive(props.activeRoute))).join("")}
    </nav>
  </div>
  `;
}
