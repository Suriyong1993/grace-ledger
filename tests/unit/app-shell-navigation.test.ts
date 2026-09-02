import { describe, it, expect } from "vitest";
import { renderAppShellHtml, AppShellProps } from "../../src/components/layout/AppShell";
import { router } from "../../src/router";
import { ProfilePage } from "../../src/pages/ProfilePage";

describe("Authenticated App Shell & Navigation", () => {
  const mockProps: AppShellProps = {
    activeRoute: "/",
    pendingCount: 3,
    user: {
      name: "อาจารย์ สมชาย ใจดี",
      role: "ศิษยาภิบาล",
      initials: "สจ",
      churchName: "คริสตจักรพระคุณ กาฬสินธุ์",
    },
  };

  it("matches the /profile route in the client router", () => {
    const matched = router.matchRoute("/profile");
    expect(matched.pattern).toBe("/profile");
    expect(matched.path).toBe("/profile");
  });

  it("renders 5-tab mobile bottom navigation with correct primary tabs", () => {
    const html = renderAppShellHtml(mockProps, "<div>Content</div>");

    // Must have the mobile navigation container
    expect(html).toContain('class="gl-mobilenav"');

    // 5 primary tabs in mobile nav
    expect(html).toContain('href="#/"');
    expect(html).toContain('href="#/offerings"');
    expect(html).toContain('href="#/approvals"');
    expect(html).toContain('href="#/reports"');
    expect(html).toContain('href="#/profile"');

    // Labels
    expect(html).toContain("หน้าหลัก");
    expect(html).toContain("ถวายทรัพย์");
    expect(html).toContain("อนุมัติ");
    expect(html).toContain("รายงาน");
    expect(html).toContain("โปรไฟล์");
  });

  it("marks active page with aria-current='page'", () => {
    const html = renderAppShellHtml(
      { ...mockProps, activeRoute: "/approvals" },
      "<div>Approvals Content</div>"
    );

    expect(html).toContain('<a href="#/approvals" class="gl-mobilenav__item" aria-current="page"');
    expect(html).toContain('<a href="#/approvals" class="gl-nav-item gl-nav-item--active" aria-current="page"');
  });

  it("renders notification bell with pending approvals badge count in header", () => {
    const html = renderAppShellHtml(mockProps, "<div>Content</div>");

    // Notification bell link
    expect(html).toContain('class="gl-shell-icon-btn"');
    expect(html).toContain('aria-label="การแจ้งเตือนและการอนุมัติ"');
    expect(html).toContain('class="gl-shell-bell-badge num-display">3</span>');
  });

  it("renders church name and user avatar in top header and sidebar", () => {
    const html = renderAppShellHtml(mockProps, "<div>Content</div>");

    expect(html).toContain("คริสตจักรพระคุณ กาฬสินธุ์");
    expect(html).toContain("อาจารย์ สมชาย ใจดี");
    expect(html).toContain("ศิษยาภิบาล");
    expect(html).toContain("สจ");
  });

  it("renders ProfilePage component with identity card, quick links, and logout", () => {
    const profilePage = new ProfilePage({} as any, {
      user: mockProps.user!,
      userId: "11111111-2222-3333-4444-555555555555",
      churchId: "church-uuid-1234",
    });

    const html = profilePage.renderHtml();

    expect(html).toContain("อาจารย์ สมชาย ใจดี");
    expect(html).toContain("ศิษยาภิบาล");
    expect(html).toContain("คริสตจักรพระคุณ กาฬสินธุ์");
    expect(html).toContain("11111111...555555");
    expect(html).toContain('href="#/transactions"');
    expect(html).toContain('href="#/funds"');
    expect(html).toContain('href="#/members"');
    expect(html).toContain("data-logout");
  });
});
