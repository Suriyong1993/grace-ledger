/**
 * Unit tests for ApprovalsPage (page-level orchestrator)
 * Tests the public renderHtml(user?) output and event wiring logic.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ApprovalsPage } from "../../src/pages/ApprovalsPage";
import { Money } from "../../src/lib/money";

// Minimal mock Supabase client
const dummySupabase = {} as any;

const makeItem = (overrides: Partial<any> = {}) => ({
  id: "item-001",
  churchId: "church-abc",
  accountId: "acc-1",
  accountName: "บัญชีหลัก",
  amount: Money.from(5000),
  direction: "expense" as const,
  status: "pending_approval" as const,
  description: "ค่าเช่าสถานที่",
  referenceNumber: "REF-001",
  createdBy: "user-1",
  creatorName: "สุดารัตน์ จิณเซ่ง",
  creatorInitials: "สจ",
  createdAt: "2025-08-01T10:00:00Z",
  hasReceipt: false,
  splits: [
    {
      fundId: "fund-1",
      fundName: "กองทุนทั่วไป",
      amount: Money.from(5000),
    },
  ],
  isCreator: false,
  ...overrides,
});

const dummyUser = {
  name: "อาจารย์สรรเสริญ ดวงจิตร",
  role: "ศิษยาภิบาล",
  initials: "สด",
  churchName: "คริสตจักรชีวิตสุขสันต์กาฬสินธุ์",
};

describe("ApprovalsPage", () => {
  let page: ApprovalsPage;

  beforeEach(() => {
    page = new ApprovalsPage(dummySupabase, "church-abc", "user-999");
  });

  // ─── Loading state ────────────────────────────────────────────────────────

  it("renders loading state when isLoading is true", () => {
    // Access private field via any cast
    (page as any).isLoading = true;
    const html = page.renderHtml();
    expect(html).toContain("gl-approvals-page-container");
    expect(html).toContain("คิวรออนุมัติ");
    expect(html).toContain("gl-empty-center__icon");
    expect(html).toContain("<svg");
    expect(html).toContain("กำลังโหลดรายการรออนุมัติ");
  });

  // ─── Error state ──────────────────────────────────────────────────────────

  it("renders error banner when errorMessage is set", () => {
    (page as any).isLoading = false;
    (page as any).errorMessage = "Connection failed";
    const html = page.renderHtml();
    expect(html).toContain("gl-notice--error");
    expect(html).toContain("โหลดคิวอนุมัติไม่สำเร็จ");
    expect(html).toContain("Connection failed");
    expect(html).toContain("gl-btn-retry");
  });

  // ─── Empty state ──────────────────────────────────────────────────────────

  it("renders empty state when no items", () => {
    (page as any).isLoading = false;
    (page as any).items = [];
    const html = page.renderHtml(dummyUser);
    expect(html).toContain("gl-empty-center__icon");
    expect(html).toContain("<svg");
    expect(html).toContain("ไม่มีรายการรอการตรวจสอบ");
  });

  // ─── Profile header ───────────────────────────────────────────────────────

  it("renders profile header with user info", () => {
    (page as any).isLoading = false;
    (page as any).items = [];
    const html = page.renderHtml(dummyUser);
    expect(html).toContain("อาจารย์สรรเสริญ ดวงจิตร");
    expect(html).toContain("ศิษยาภิบาล");
    expect(html).toContain("คริสตจักรชีวิตสุขสันต์กาฬสินธุ์");
    expect(html).toContain("สด");
  });

  it("renders profile header with fallback when no user", () => {
    (page as any).isLoading = false;
    (page as any).items = [];
    const html = page.renderHtml();
    expect(html).toContain("GL");
    expect(html).toContain("ผู้ใช้งาน");
  });

  it("shows pending count in profile header", () => {
    (page as any).isLoading = false;
    (page as any).items = [makeItem(), makeItem({ id: "item-002" })];
    const html = page.renderHtml(dummyUser);
    expect(html).toContain(">2<"); // pending count = 2
    expect(html).toContain("รออนุมัติ");
  });

  // ─── Summary stats ────────────────────────────────────────────────────────

  it("renders summary stats when items exist", () => {
    (page as any).isLoading = false;
    (page as any).items = [
      makeItem({ direction: "income", amount: Money.from(10000) }),
      makeItem({ id: "e1", direction: "expense", amount: Money.from(3000) }),
    ];
    const html = page.renderHtml(dummyUser);
    expect(html).toContain("รายรับ");
    expect(html).toContain("รายจ่าย");
    expect(html).toContain("รวมมูลค่า");
  });

  it("does not render summary stats when no items", () => {
    (page as any).isLoading = false;
    (page as any).items = [];
    const html = page.renderHtml(dummyUser);
    expect(html).not.toContain("รวมมูลค่า");
  });

  // ─── Approval card ────────────────────────────────────────────────────────

  it("renders approval card with item details", () => {
    const item = makeItem();
    (page as any).isLoading = false;
    (page as any).items = [item];
    const html = page.renderHtml(dummyUser);
    expect(html).toContain("ค่าเช่าสถานที่");
    expect(html).toContain("REF-001");
    expect(html).toContain("สุดารัตน์ จิณเซ่ง");
    expect(html).toContain("gl-approval-card");
    expect(html).toContain("gl-badge--pending");
    expect(html).toContain("gl-quick-approve");
    expect(html).toContain("gl-open-detail");
  });

  it("shows 'คุณสร้างรายการนี้' instead of approve button for creator items", () => {
    const item = makeItem({ isCreator: true });
    (page as any).isLoading = false;
    (page as any).items = [item];
    const html = page.renderHtml(dummyUser);
    expect(html).toContain("คุณสร้างรายการนี้");
    expect(html).not.toContain("gl-quick-approve");
  });

  it("shows receipt indicator when hasReceipt is true", () => {
    const item = makeItem({ hasReceipt: true, receiptUrl: "https://example.com/receipt.pdf" });
    (page as any).isLoading = false;
    (page as any).items = [item];
    const html = page.renderHtml(dummyUser);
    expect(html).toContain("ใบเสร็จ");
    expect(html).toContain("<svg");
    // Emoji are banned as UI iconography — the SVG convention replaced them
    // (design-plans/08). This regex covers pictographs, dingbats and arrows.
    expect(html).not.toMatch(/[🌀-🫿✀-➿←-⇿]/u);
  });

  // ─── Detail panel ─────────────────────────────────────────────────────────

  it("renders detail panel when item is selected", () => {
    const item = makeItem();
    (page as any).isLoading = false;
    (page as any).items = [item];
    (page as any).selectedItemId = "item-001";
    const html = page.renderHtml(dummyUser);
    expect(html).toContain("gl-decision-panel");
    expect(html).toContain("gl-btn-approve");
    expect(html).toContain("gl-btn-request-revision");
    expect(html).toContain("gl-btn-reject");
    expect(html).toContain("บัญชีหลัก");
    expect(html).toContain("กองทุนทั่วไป");
  });

  it("renders disabled approve and creator notice when selected item is own", () => {
    const item = makeItem({ isCreator: true });
    (page as any).isLoading = false;
    (page as any).items = [item];
    (page as any).selectedItemId = "item-001";
    const html = page.renderHtml(dummyUser);
    expect(html).toContain("gl-notice--error");
    expect(html).toContain("หลักการแบ่งแยกหน้าที่");
    expect(html).toContain("disabled");
  });

  // ─── Modal ────────────────────────────────────────────────────────────────

  it("renders revision modal when activeModal is revision_requested", () => {
    const item = makeItem();
    (page as any).isLoading = false;
    (page as any).items = [item];
    (page as any).activeModal = { type: "revision_requested", item };
    const html = page.renderHtml(dummyUser);
    expect(html).toContain("gl-modal-backdrop");
    expect(html).toContain("ส่งรายการกลับเพื่อขอให้แก้ไข");
    expect(html).toContain("ยืนยันการส่งกลับเพื่อแก้ไข");
    expect(html).toContain("gl-rejection-reason");
  });

  it("renders rejection modal when activeModal is rejected", () => {
    const item = makeItem();
    (page as any).isLoading = false;
    (page as any).items = [item];
    (page as any).activeModal = { type: "rejected", item };
    const html = page.renderHtml(dummyUser);
    expect(html).toContain("gl-modal-backdrop");
    expect(html).toContain("ปฏิเสธคำขอเบิกจ่าย");
    expect(html).toContain("ยืนยันการปฏิเสธคำขอ");
  });

  // ─── Alert banners ────────────────────────────────────────────────────────

  it("renders stale warning banner", () => {
    (page as any).isLoading = false;
    (page as any).items = [];
    (page as any).staleWarning = "รายการนี้ได้รับการพิจารณาแล้ว";
    const html = page.renderHtml(dummyUser);
    expect(html).toContain("gl-notice--warning");
    expect(html).toContain("รายการนี้ได้รับการพิจารณาแล้ว");
    expect(html).toContain("gl-btn-refresh-stale");
  });

  it("renders success banner", () => {
    (page as any).isLoading = false;
    (page as any).items = [];
    (page as any).successMessage = "อนุมัติแล้ว รอลงบัญชี";
    const html = page.renderHtml(dummyUser);
    expect(html).toContain("gl-notice--success");
    expect(html).toContain("อนุมัติแล้ว รอลงบัญชี");
  });

  // ─── Refresh / page controls ─────────────────────────────────────────────

  it("renders refresh button in header", () => {
    (page as any).isLoading = false;
    (page as any).items = [];
    const html = page.renderHtml(dummyUser);
    expect(html).toContain("gl-btn-refresh-queue");
    expect(html).toContain("รีเฟรช");
    expect(html).toContain("<svg");
  });

  // ─── XSS safety ───────────────────────────────────────────────────────────

  it("escapes HTML in item description", () => {
    const item = makeItem({ description: '<script>alert("xss")</script>' });
    (page as any).isLoading = false;
    (page as any).items = [item];
    const html = page.renderHtml(dummyUser);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in user name from profile header", () => {
    const xssUser = { ...dummyUser, name: '<img src=x onerror="alert(1)">' };
    (page as any).isLoading = false;
    (page as any).items = [];
    const html = page.renderHtml(xssUser);
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
    expect(html).toContain("&lt;img");
  });

  // ─── Public API ───────────────────────────────────────────────────────────

  it("getItems returns current items", () => {
    const item = makeItem();
    (page as any).items = [item];
    expect(page.getItems()).toHaveLength(1);
    expect(page.getItems()[0].id).toBe("item-001");
  });

  it("setSelectedItem updates selection and clears modal", () => {
    const item = makeItem();
    (page as any).items = [item];
    (page as any).activeModal = { type: "rejected", item };
    page.setSelectedItem("item-001");
    expect((page as any).selectedItemId).toBe("item-001");
    expect((page as any).activeModal).toBeNull();
  });

  it("setSelectedItem with same id does not clear modal", () => {
    const item = makeItem();
    (page as any).items = [item];
    (page as any).selectedItemId = "item-001";
    (page as any).activeModal = { type: "rejected", item };
    page.setSelectedItem("item-001");
    // Same id — no change, modal preserved
    expect((page as any).activeModal).not.toBeNull();
  });
});
