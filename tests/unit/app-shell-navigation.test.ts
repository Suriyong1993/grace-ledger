import { describe, it, expect } from "vitest";
import { renderAppShellHtml, AppShellProps } from "../../src/components/layout/AppShell";
import { router } from "../../src/router";
import { ProfilePage } from "../../src/pages/ProfilePage";
import type { AttentionSummary } from "../../src/services/attention-service";

/** Minimal pending-work fixture matching AttentionService's shape. */
function attentionFixture(overrides: Partial<AttentionSummary> = {}): AttentionSummary {
  return {
    groups: [
      {
        key: "approvals",
        label: "คิวอนุมัติ",
        href: "#/approvals",
        summary: "3 รายการ · รวม ฿9,000.00",
        count: 3,
        requiresAction: true,
        items: [
          {
            id: "tx-1",
            title: "เบิกจ่ายค่าใช้จ่ายภารกิจ",
            meta: "฿5,000.00 · อาจารย์ ทัศนา ดวงจิตร · 21 ส.ค. 2569",
            href: "#/approvals",
          },
        ],
      },
      {
        key: "offerings",
        label: "เงินถวาย",
        href: "#/offerings",
        summary: "ผลต่างรอดำเนินการ 1",
        count: 1,
        requiresAction: true,
        items: [
          {
            id: "os-1",
            title: "รอบนมัสการวันอาทิตย์ (เช้า) · 23 ส.ค. 2569",
            meta: "มีผลต่างรอดำเนินการ · ผลต่าง −฿1,000.00",
            href: "#/offerings/os-1",
          },
        ],
      },
      {
        key: "drafts",
        label: "ฉบับร่าง",
        href: "#/transactions",
        summary: "2 รายการยังไม่ส่งอนุมัติ",
        count: 2,
        requiresAction: false,
        items: [],
      },
    ],
    totalCount: 6,
    loadFailed: false,
    ...overrides,
  };
}

describe("Authenticated App Shell & Navigation", () => {
  const treasurerProps: AppShellProps = {
    activeRoute: "/",
    user: {
      name: "อาจารย์สรรเสริญ ดวงจิตร",
      role: "treasurer",
      initials: "สด",
      churchName: "คริสตจักรชีวิตสุขสันต์กาฬสินธุ์",
    },
    attention: attentionFixture(),
  };

  it("matches the /profile route and strips deep-link query strings", () => {
    const matched = router.matchRoute("/profile");
    expect(matched.pattern).toBe("/profile");
    expect(matched.path).toBe("/profile");

    // The shell's global action deep-links into the transactions page with a
    // one-shot query; the router must still resolve the route itself.
    const withQuery = router.matchRoute("/transactions?create=1");
    expect(withQuery.pattern).toBe("/transactions");
  });

  it("shows only destinations the role can read (role-gated navigation)", () => {
    const treasurerHtml = renderAppShellHtml(treasurerProps, "<div>Content</div>");
    expect(treasurerHtml).toContain('href="#/transactions"');
    expect(treasurerHtml).toContain('href="#/members"');
    expect(treasurerHtml).toContain('href="#/reports"');

    // Counters count offerings: no transactions, approvals, members or
    // reports in their navigation — the UI must not advertise destinations
    // the role cannot use.
    const counterHtml = renderAppShellHtml(
      {
        ...treasurerProps,
        user: { ...treasurerProps.user!, role: "counter" },
        attention: attentionFixture({ groups: [], totalCount: 0 }),
      },
      "<div>Content</div>",
    );
    expect(counterHtml).not.toContain('href="#/transactions"');
    expect(counterHtml).not.toContain('href="#/approvals"');
    expect(counterHtml).not.toContain('href="#/members"');
    expect(counterHtml).not.toContain('href="#/reports"');
    expect(counterHtml).toContain('href="#/offerings"');
    expect(counterHtml).toContain('href="#/funds"');

    // Unknown roles fall back to the least-privileged view (member).
    const unknownHtml = renderAppShellHtml(
      {
        ...treasurerProps,
        user: { ...treasurerProps.user!, role: "ศิษยาภิบาล (ไม่รู้จัก)" },
        attention: attentionFixture({ groups: [], totalCount: 0 }),
      },
      "<div>Content</div>",
    );
    expect(unknownHtml).not.toContain('href="#/members"');
    expect(unknownHtml).toContain('href="#/funds"');
  });

  it("composes the mobile bar deliberately: 5 core workflow tabs with Profile and no overflow sheet", () => {
    const html = renderAppShellHtml(treasurerProps, "<div>Content</div>");

    expect(html).toContain('class="gl-mobilenav"');
    // Core workflow tabs + Profile
    expect(html).toContain('href="#/"');
    expect(html).toContain('href="#/transactions"');
    expect(html).toContain('href="#/offerings"');
    expect(html).toContain('href="#/approvals"');
    expect(html).toContain('href="#/profile"');
    // No overflow sheet or more button
    expect(html).not.toContain('id="gl-more-btn"');
    expect(html).not.toContain('id="gl-more-panel"');
  });

  it("marks the active page with aria-current='page' on both navs", () => {
    const html = renderAppShellHtml(
      { ...treasurerProps, activeRoute: "/approvals" },
      "<div>Approvals Content</div>",
    );

    expect(html).toContain('<a href="#/approvals" class="gl-mobilenav__item" aria-current="page"');
    expect(html).toContain('<a href="#/approvals" class="gl-nav-item gl-nav-item--active" aria-current="page"');
  });

  it("turns the bell into the pending-work surface with the real total", () => {
    const html = renderAppShellHtml(treasurerProps, "<div>Content</div>");

    expect(html).toContain('id="gl-attention-btn"');
    expect(html).toContain('aria-label="งานที่ต้องดำเนินการ (6 รายการ)"');
    expect(html).toContain('class="gl-shell-bell-badge num-display">6</span>');
    // Panel renders hidden and carries the grouped, deep-linked items.
    expect(html).toContain('id="gl-attention-panel"');
    expect(html).toMatch(/id="gl-attention-panel"[^>]*hidden/);
    expect(html).toContain('href="#/offerings/os-1"');
    expect(html).toContain("ผลต่าง −฿1,000.00");
  });

  it("shows an all-clear attention panel when nothing is pending", () => {
    const html = renderAppShellHtml(
      {
        ...treasurerProps,
        attention: attentionFixture({
          groups: [],
          totalCount: 0,
        }),
      },
      "<div>Content</div>",
    );

    expect(html).toContain("ไม่มีงานค้าง — ทุกอย่างเรียบร้อย");
    // The badge element is gone (the CSS rule for it still exists).
    expect(html).not.toMatch(/class="gl-shell-bell-badge/);
  });

  it("renders the global บันทึกรายการ action only for roles that may create transactions", () => {
    const treasurerHtml = renderAppShellHtml(treasurerProps, "<div>Content</div>");
    expect(treasurerHtml).toContain('href="#/transactions?create=1"');
    expect(treasurerHtml).toContain("บันทึกรายการ");

    const approverHtml = renderAppShellHtml(
      {
        ...treasurerProps,
        user: { ...treasurerProps.user!, role: "approver" },
      },
      "<div>Content</div>",
    );
    expect(approverHtml).not.toContain('href="#/transactions?create=1"');
  });

  it("renders church name and user avatar in top header and sidebar", () => {
    const html = renderAppShellHtml(treasurerProps, "<div>Content</div>");

    expect(html).toContain("คริสตจักรชีวิตสุขสันต์กาฬสินธุ์");
    expect(html).toContain("อาจารย์สรรเสริญ ดวงจิตร");
    expect(html).toContain("สด");
  });

  it("renders ProfilePage component with identity card, quick links, and logout", () => {
    const profilePage = new ProfilePage({} as any, {
      user: treasurerProps.user!,
      userId: "11111111-2222-3333-4444-555555555555",
      churchId: "church-uuid-1234",
    });

    const html = profilePage.renderHtml();

    expect(html).toContain("อาจารย์สรรเสริญ ดวงจิตร");
    expect(html).toContain("คริสตจักรชีวิตสุขสันต์กาฬสินธุ์");
    expect(html).toContain("11111111...555555");
    expect(html).toContain('href="#/transactions"');
    expect(html).toContain('href="#/funds"');
    expect(html).toContain('href="#/members"');
    expect(html).toContain("data-logout");
  });
});
