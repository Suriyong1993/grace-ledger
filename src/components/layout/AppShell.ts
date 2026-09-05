import type { AttentionGroup, AttentionSummary } from "../../services/attention-service";
import { can, toUserRole, type Resource, type UserRole } from "../../lib/rbac";
import { escapeHtml } from "../../lib/format";

export interface AppShellUser {
  name: string;
  role: string;
  initials: string;
  churchName?: string;
}

export interface AppShellProps {
  activeRoute: string;
  /** @deprecated derived from {@link attention} when provided; kept for callers/tests without an attention summary. */
  pendingCount?: number;
  user?: AppShellUser;
  /** Real pending-work aggregation for the bell panel and badges. Null = loading. */
  attention?: AttentionSummary | null;
}

interface NavDestination {
  href: string;
  label: string;
  shortLabel: string;
  group: string;
  icon: string;
  isActive: (route: string) => boolean;
  /** RBAC resource guarding visibility; omitted = always visible. */
  resource?: Resource;
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
const ICON_PLUS = `<path d="M12 5v14M5 12h14"/>`;
const ICON_CHECK = `<path d="M20 6L9 17l-5-5"/>`;
const ICON_ALERT = `<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/>`;
const ICON_DOC = `<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>`;
const ICON_MORE = `<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>`;

function icon(paths: string, size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

const ALL_DESTINATIONS: NavDestination[] = [
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
    resource: "transactions",
  },
  {
    href: "#/offerings",
    label: "เงินถวายวันอาทิตย์",
    shortLabel: "เงินถวาย",
    group: "ธุรกรรมและการเงิน",
    icon: ICON_OFFERINGS,
    isActive: (route) => route.startsWith("/offerings"),
    resource: "offering_sessions",
  },
  {
    href: "#/funds",
    label: "กองทุนและงบประมาณ",
    shortLabel: "กองทุน",
    group: "ธุรกรรมและการเงิน",
    icon: ICON_FUNDS,
    isActive: (route) => route.startsWith("/funds"),
    resource: "funds",
  },
  {
    href: "#/approvals",
    label: "คิวอนุมัติ",
    shortLabel: "อนุมัติ",
    group: "กำกับดูแล",
    icon: ICON_APPROVALS,
    isActive: (route) => route.startsWith("/approvals"),
    resource: "approvals",
  },
  {
    href: "#/members",
    label: "สมาชิกและการถวาย",
    shortLabel: "สมาชิก",
    group: "สารบบและรายงาน",
    icon: ICON_MEMBERS,
    isActive: (route) => route.startsWith("/members"),
    resource: "members",
  },
  {
    href: "#/reports",
    label: "รายงานการเงิน",
    shortLabel: "รายงาน",
    group: "สารบบและรายงาน",
    icon: ICON_REPORTS,
    isActive: (route) => route.startsWith("/reports"),
    resource: "reports",
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

function destinationsForRole(role: UserRole, approvalsBadge: number | undefined): NavDestination[] {
  return ALL_DESTINATIONS.filter(
    (dest) => !dest.resource || can(role, "read", dest.resource),
  ).map((dest) =>
    dest.resource === "approvals" && approvalsBadge !== undefined
      ? { ...dest, badge: approvalsBadge }
      : dest,
  );
}

/** Mobile bottom-bar priority for content tabs (after the fixed หน้าหลัก). */
const MOBILE_CONTENT_PRIORITY = [
  "transactions",
  "offerings",
  "approvals",
  "funds",
  "reports",
  "members",
] as const;

interface MobileComposition {
  /** หน้าหลัก + up to 3 core workflow tabs, rendered as bar links. */
  tabs: NavDestination[];
  /** Every reachable destination that did not fit as a tab. Never dropped
   * silently — surfaced via the "เพิ่มเติม" sheet instead. Profile is
   * reachable from the topbar avatar on every width, so it is excluded
   * from both the tabs and this overflow list. */
  overflow: NavDestination[];
}

/**
 * Mobile composition: หน้าหลัก + up to 3 core workflow tabs + "เพิ่มเติม"
 * (a role with more than 3 reachable content destinations gets an overflow
 * sheet instead of losing access to the rest — see DECISIONS.md D13).
 */
function buildMobileComposition(
  destinations: NavDestination[],
  approvalsBadge: number | undefined,
): MobileComposition {
  const dashboard = destinations.find((d) => d.href === "#/")!;
  const contentPool = destinations.filter(
    (d) => d.href !== "#/" && d.href !== "#/profile",
  );

  const byPriority = MOBILE_CONTENT_PRIORITY.map((key) =>
    contentPool.find((d) => d.href === `#/${key}`),
  ).filter((d): d is NavDestination => Boolean(d));

  const leftovers = contentPool.filter((d) => !byPriority.includes(d));
  const candidateContent = [...byPriority, ...leftovers];

  const selectedContent = candidateContent.slice(0, 3);
  const overflow = candidateContent.slice(3);
  const approvalsTab = [...selectedContent, ...overflow].find(
    (d) => d.resource === "approvals",
  );
  if (approvalsTab && approvalsBadge !== undefined) {
    approvalsTab.badge = approvalsBadge;
  }

  return { tabs: [dashboard, ...selectedContent], overflow };
}

function renderSidebarLink(dest: NavDestination, isActive: boolean): string {
  const badge = dest.badge
    ? `<span class="num-display gl-nav-item__badge">${dest.badge}</span>`
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

function renderMoreSheetLink(dest: NavDestination): string {
  const badge = dest.badge
    ? `<span class="gl-attention-panel__group-count num-display" style="margin-left: auto;">${dest.badge}</span>`
    : "";
  return `
    <a href="${dest.href}" class="gl-attention-panel__item" style="align-items: center;">
      <span class="gl-attention-panel__item-icon" aria-hidden="true">${icon(dest.icon, 18)}</span>
      <span class="gl-attention-panel__item-title">${dest.label}</span>
      ${badge}
    </a>`;
}

const ATTENTION_GROUP_ICONS: Record<AttentionGroup["key"], string> = {
  approvals: ICON_APPROVALS,
  offerings: ICON_OFFERINGS,
  drafts: ICON_DOC,
};

function renderAttentionPanel(attention: AttentionSummary | null | undefined): string {
  let body: string;
  if (attention === null || attention === undefined) {
    body = `
      <div class="gl-attention-panel__loading" role="status" aria-live="polite">
        <span class="gl-skeleton" style="height: 44px; display: block;"></span>
        <span class="gl-skeleton" style="height: 44px; display: block;"></span>
        <span class="gl-skeleton" style="height: 44px; display: block;"></span>
        <span class="gl-attention-panel__hint">กำลังรวบรวมงานที่ต้องดำเนินการ…</span>
      </div>`;
  } else if (attention.loadFailed && attention.totalCount === 0) {
    body = `
      <div class="gl-attention-panel__empty" role="alert">
        ${icon(ICON_ALERT, 20)}
        <p>โหลดข้อมูลงานค้างไม่สำเร็จ</p>
        <button type="button" class="gl-btn gl-btn--secondary gl-btn--sm" data-attention-retry>ลองใหม่</button>
      </div>`;
  } else if (attention.totalCount === 0) {
    body = `
      <div class="gl-attention-panel__empty" role="status">
        <span class="gl-attention-panel__done" aria-hidden="true">${icon(ICON_CHECK, 20)}</span>
        <p>ไม่มีงานที่ต้องดำเนินการ</p>
      </div>`;
  } else {
    body = attention.groups
      .filter((group) => group.count > 0)
      .map(
        (group) => `
        <div class="gl-attention-panel__group">
          <a href="${group.href}" class="gl-attention-panel__group-head${group.requiresAction ? " gl-attention-panel__group-head--attention" : ""}">
            <span class="gl-attention-panel__group-label">${escapeHtml(group.label)}</span>
            <span class="gl-attention-panel__group-count num-display">${group.count}</span>
          </a>
          ${group.items
            .map(
              (item) => `
            <a href="${item.href}" class="gl-attention-panel__item">
              <span class="gl-attention-panel__item-icon" aria-hidden="true">${icon(ATTENTION_GROUP_ICONS[group.key], 15)}</span>
              <span class="gl-attention-panel__item-body">
                <span class="gl-attention-panel__item-title">${escapeHtml(item.title)}</span>
                <span class="gl-attention-panel__item-meta">${escapeHtml(item.meta)}</span>
              </span>
            </a>`,
            )
            .join("")}
          <a href="${group.href}" class="gl-attention-panel__more-link">ดูทั้งหมด →</a>
        </div>`,
      )
      .join("");
  }

  return `
    <div id="gl-attention-panel" class="gl-attention-panel" role="dialog" aria-modal="false" aria-label="งานที่ต้องดำเนินการ" hidden>
      ${body}
    </div>`;
}

export function renderAppShellHtml(props: AppShellProps, contentHtml: string): string {
  const user = props.user;
  const displayName = user?.name || "ยังไม่ระบุผู้ใช้";
  const displayRole = user?.role || "";
  const initials = user?.initials || "?";
  const churchName = user?.churchName || "";
  const role = toUserRole(user?.role);

  const attention = props.attention ?? null;
  const approvalsGroup = attention?.groups.find((g) => g.key === "approvals");
  // While the attention summary is loading, fall back to the legacy pending
  // count so the approvals badge never silently disappears mid-navigation.
  const approvalsBadge = approvalsGroup
    ? approvalsGroup.count
    : props.pendingCount && props.pendingCount > 0
      ? props.pendingCount
      : undefined;
  const legacyBadge = props.pendingCount || 0;
  const totalAttention = attention ? attention.totalCount : legacyBadge;
  const canCreateTransactions = can(role, "create", "transactions");
  const hasAttentionSources =
    can(role, "read", "approvals") ||
    can(role, "read", "offering_sessions") ||
    can(role, "read", "transactions");

  const sidebarDestinations = destinationsForRole(role, approvalsBadge);
  const { tabs: mobileTabs, overflow: mobileOverflow } = buildMobileComposition(
    sidebarDestinations,
    approvalsBadge,
  );
  const mobileOverflowCount = mobileOverflow.reduce((sum, d) => sum + (d.badge || 0), 0);

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
    .gl-nav-item__badge {
      margin-left: auto;
      background: var(--pending);
      color: var(--primary-foreground);
      border-radius: var(--radius-full);
      padding: 1px 7px;
      font-size: var(--text-2xs);
      font-weight: var(--weight-bold);
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
    .gl-shell-icon-btn:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
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

    /* --- Global primary action (opens the existing transaction entry) --- */
    .gl-shell-primary-action {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      min-height: var(--touch-target-min);
      padding: 0 var(--space-4);
      border-radius: var(--radius-full);
      text-decoration: none;
      font-size: var(--text-sm);
      font-weight: var(--weight-semibold);
      white-space: nowrap;
    }
    .gl-shell-primary-action:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }
    .gl-shell-primary-action__short { display: none; }

    /* --- Attention (bell) panel --- */
    .gl-attention-wrap { position: relative; display: inline-flex; }
    .gl-attention-panel[hidden],
    .gl-more-panel[hidden] {
      display: none !important;
    }
    .gl-attention-panel {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: min(380px, calc(100vw - var(--space-6)));
      max-height: min(480px, 70vh);
      overflow-y: auto;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-elevated);
      padding: var(--space-2);
      z-index: 210;
    }
    .gl-attention-panel__group { margin-bottom: var(--space-1); }
    .gl-attention-panel__group-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      text-decoration: none;
      color: var(--foreground);
      font-size: var(--text-xs);
      font-weight: var(--weight-semibold);
    }
    .gl-attention-panel__group-head:hover { background: var(--muted); }
    .gl-attention-panel__group-head:focus-visible { outline: 2px solid var(--ring); outline-offset: -2px; }
    .gl-attention-panel__group-head--attention .gl-attention-panel__group-count {
      background: var(--pending);
      color: var(--primary-foreground);
    }
    .gl-attention-panel__group-count {
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: var(--radius-full);
      background: var(--muted);
      color: var(--muted-foreground);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: var(--text-2xs);
      font-weight: var(--weight-bold);
    }
    .gl-attention-panel__item {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      text-decoration: none;
      color: var(--foreground);
    }
    .gl-attention-panel__item:hover { background: var(--muted); }
    .gl-attention-panel__item:focus-visible { outline: 2px solid var(--ring); outline-offset: -2px; }
    .gl-attention-panel__item-icon { display: flex; color: var(--muted-foreground); margin-top: 2px; }
    .gl-attention-panel__item-body { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .gl-attention-panel__item-title {
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .gl-attention-panel__item-meta {
      font-size: var(--text-2xs);
      color: var(--muted-foreground);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .gl-attention-panel__more-link {
      display: block;
      padding: var(--space-1) var(--space-3) var(--space-2);
      font-size: var(--text-2xs);
      font-weight: var(--weight-semibold);
      color: var(--primary);
      text-decoration: none;
      border-radius: var(--radius-sm);
    }
    .gl-attention-panel__more-link:hover { text-decoration: underline; }
    .gl-attention-panel__more-link:focus-visible { outline: 2px solid var(--ring); outline-offset: -2px; }
    .gl-attention-panel__empty,
    .gl-attention-panel__loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-5) var(--space-4);
      text-align: center;
      color: var(--muted-foreground);
      font-size: var(--text-sm);
    }
    .gl-attention-panel__loading { align-items: stretch; text-align: left; }
    .gl-attention-panel__hint { font-size: var(--text-2xs); text-align: center; }
    .gl-attention-panel__done {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-full);
      background: var(--income);
      color: var(--income-foreground);
      display: grid;
      place-items: center;
    }

    .gl-mobilenav__item:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: -2px;
    }

    @media (max-width: 768px) {
      .gl-attention-panel {
        position: fixed;
        top: calc(var(--gl-topbar-h) + 6px);
        right: var(--space-3);
        left: var(--space-3);
        width: auto;
      }
      /* The "เพิ่มเติม" sheet opens from the bottom bar, not the topbar bell —
         anchor it above the bar instead of below the header. */
      .gl-more-panel {
        top: auto;
        bottom: calc(var(--gl-mobilenav-h) + env(safe-area-inset-bottom, 0px) + 8px);
        max-height: min(420px, 60vh);
      }
      .gl-shell-primary-action {
        /* Narrower padding and the short label buy the width; the touch target
           itself stays at the 44px minimum. It was 40px, which compacted the
           app's most-tapped control below the size the design system sets for
           every other one. The room came back when the topbar's percentage
           cap was removed. */
        min-height: var(--touch-target-min);
        padding: 0 var(--space-3);
        font-size: var(--text-xs);
      }
      .gl-shell-primary-action__full { display: none; }
      .gl-shell-primary-action__short { display: inline; }
    }
    @media (prefers-reduced-motion: reduce) {
      .gl-attention-panel { transition: none; }
    }
  </style>

  <div class="gl-app-container" style="
    display: flex;
    min-height: 100vh;
    background: var(--background);
    color: var(--foreground);
  ">
    <!-- Accessible Skip Link for Keyboard & Assistive Technology -->
    <a href="#main-content" class="gl-skip-link">ข้ามไปเนื้อหาหลัก</a>

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
        background: var(--card);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        padding: 0 var(--space-3) 0 var(--space-4);
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
          ${
            canCreateTransactions
              ? `<a href="#/transactions?create=1" class="gl-shell-primary-action gl-btn gl-btn--primary" title="บันทึกรายการรับ-จ่ายใหม่">
                  ${icon(ICON_PLUS, 15)}
                  <span class="gl-shell-primary-action__full">บันทึกรายการ</span>
                  <span class="gl-shell-primary-action__short" aria-hidden="true">รายการ</span>
                  <span class="gl-visually-hidden">บันทึกรายการรับ-จ่ายใหม่</span>
                </a>`
              : ""
          }

          <span class="gl-shell-church-chip" style="display: inline-flex; align-items: center; gap: 4px; background: var(--muted); padding: 3px 8px; border-radius: var(--radius-full); font-size: var(--text-2xs); font-weight: var(--weight-medium); max-width: 140px; overflow: hidden; text-overflow: ellipsis;">
            <span class="gl-shell-status-dot" aria-hidden="true"></span>
            <span style="overflow: hidden; text-overflow: ellipsis;">${churchName}</span>
          </span>

          ${
            hasAttentionSources
              ? `<div class="gl-attention-wrap">
                  <button type="button" id="gl-attention-btn" class="gl-shell-icon-btn" aria-haspopup="dialog" aria-expanded="false" aria-controls="gl-attention-panel" aria-label="งานที่ต้องดำเนินการ${totalAttention > 0 ? ` (${totalAttention} รายการ)` : ""}" title="งานที่ต้องดำเนินการ">
                    ${icon(ICON_BELL, 18)}
                    ${totalAttention > 0 ? `<span class="gl-shell-bell-badge num-display">${totalAttention > 99 ? "99+" : totalAttention}</span>` : ""}
                  </button>
                  ${renderAttentionPanel(attention)}
                </div>`
              : ""
          }

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

    <!-- Role-aware Mobile Bottom Navigation -->
    <nav class="gl-mobilenav" aria-label="เมนูหลัก">
      ${mobileTabs.map((d) => renderMobileNavLink(d, d.isActive(props.activeRoute))).join("")}
      ${
        mobileOverflow.length > 0
          ? `<button type="button" id="gl-more-btn" class="gl-mobilenav__item" aria-haspopup="dialog" aria-expanded="false" aria-controls="gl-more-panel" aria-label="เพิ่มเติม${mobileOverflowCount > 0 ? ` (${mobileOverflowCount} รายการ)` : ""}">
              <span style="position: relative; display: inline-flex;">
                ${icon(ICON_MORE, 22)}
                ${mobileOverflowCount > 0 ? `<span class="gl-mobilenav__badge num-display">${mobileOverflowCount > 99 ? "99+" : mobileOverflowCount}</span>` : ""}
              </span>
              <span>เพิ่มเติม</span>
            </button>
            <div id="gl-more-panel" class="gl-attention-panel gl-more-panel" role="dialog" aria-modal="false" aria-label="เมนูเพิ่มเติม" hidden>
              ${mobileOverflow.map((d) => renderMoreSheetLink(d)).join("")}
            </div>`
          : ""
      }
    </nav>
  </div>
  `;
}
