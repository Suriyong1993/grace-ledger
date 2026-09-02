import { describe, it, expect } from "vitest";
import { MembersPage } from "../../src/pages/MembersPage";

describe("MembersPage UI — Unit Tests", () => {
  const mockMembers = [
    {
      id: "mem-1",
      full_name: "วนิดา เกียรติสกุล",
      email: "wanida@grace.org",
      phone: "081-234-5678",
      is_active: true,
      created_at: "2026-08-14T00:00:00Z",
    },
    {
      id: "mem-2",
      full_name: "ธีรเดช พงษ์ไพโรจน์",
      email: "theeradej@grace.org",
      phone: "089-876-5432",
      is_active: true,
      created_at: "2026-08-14T00:00:00Z",
    },
  ];

  const mockSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: mockMembers, error: null }),
          }),
        }),
      }),
    }),
  } as any;

  it("renders member directory header and search bar", async () => {
    const page = new MembersPage(mockSupabase, "church-1");
    await page.loadData();
    const html = page.renderHtml();

    expect(html).toContain("<h1>สมาชิกและการถวาย</h1>");
    expect(html).toContain("ทะเบียนสมาชิก ประวัติการถวายสิบลด และการออกหนังสือรับรองภาษี");
    expect(html).toContain('id="member-search-input"');
    expect(html).toContain("ค้นหาชื่อสมาชิก รหัส หรือกลุ่มแคร์...");
  });

  it("renders member cards with member code and certificates button", async () => {
    const page = new MembersPage(mockSupabase, "church-1");
    await page.loadData();
    const html = page.renderHtml();

    expect(html).toContain("วนิดา เกียรติสกุล");
    // member_code comes from DB; mock has none → shows "—"
    expect(html).toContain("หนังสือรับรอง");
    // Privacy: giving totals not shown on card
    expect(html).toContain("ประวัติการถวายเป็นข้อมูลส่วนตัว");
  });

  it("renders donation/giving certificate modal when a member is selected", async () => {
    const page = new MembersPage(mockSupabase, "church-1");
    await page.loadData();

    // Select mem-1 — cert modal renders; RPC not mocked so shows loading state
    (page as any).selectedMemberId = "mem-1";
    const html = page.renderHtml();

    expect(html).toContain('id="cert-modal"');
    expect(html).toContain("หนังสือรับรองการถวายทรัพย์");
    // Certificate header comes from the church identity constant, never a hardcoded name
    expect(html).toContain("คริสตจักรชีวิตสุขสันต์กาฬสินธุ์");
    expect(html).not.toContain("Grace Baptist Church Thailand");
    expect(html).toContain("หนังสือรับรองการบริจาค/การถวายทรัพย์");
    expect(html).toContain("วนิดา เกียรติสกุล");
    // Giving data loaded via RPC; mock doesn't provide it → loading state
    expect(html).toContain("กำลังโหลดประวัติการถวาย...");
    expect(html).toContain("พิมพ์เอกสาร / ดาวน์โหลด PDF");
  });
});

describe("MembersPage — interaction honesty fixes", () => {
  const mockMembers = [
    { id: "mem-1", full_name: "วนิดา เกียรติสกุล", email: "w@x.org", phone: "", is_active: true, created_at: "2026-08-14T00:00:00Z" },
  ];
  const baseSupabase = {
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve({ data: mockMembers, error: null }) }) }) }) }),
  } as any;

  it("search with no match says ไม่พบสมาชิกที่ค้นหา — never claims the registry is empty", async () => {
    const page = new MembersPage(baseSupabase, "church-1");
    await page.loadData();
    (page as any).searchQuery = "zzz ไม่มีจริง";
    const html = page.renderHtml();
    expect(html).toContain("ไม่พบสมาชิกที่ค้นหา");
    expect(html).toContain('id="clear-member-search-btn"');
    expect(html).not.toContain("เพิ่มสมาชิกคนแรก");
    expect(html).not.toContain("ยังไม่มีรายชื่อสมาชิก");
  });

  it("transport failure is a retryable failed state — not a permission denial", async () => {
    const throwingSupabase = {
      ...baseSupabase,
      rpc: () => Promise.reject(new Error("network down")),
    } as any;
    const page = new MembersPage(throwingSupabase, "church-1");
    await page.loadData();
    await page.loadGivingForMember("mem-1", () => {});
    (page as any).selectedMemberId = "mem-1";
    expect((page as any).givingById["mem-1"].status).toBe("failed");
    expect(page.renderHtml()).toContain("ดูข้อมูลไม่สำเร็จ");
    expect(page.renderHtml()).not.toContain("ไม่มีสิทธิ์ดูข้อมูลการถวาย");
  });

  it("an RPC rejection is a genuine permission denial", async () => {
    const deniedSupabase = {
      ...baseSupabase,
      rpc: () => Promise.resolve({ data: null, error: { message: "Access Denied: Only Pastors or designated Finance Leaders may view confidential member giving records." } }),
    } as any;
    const page = new MembersPage(deniedSupabase, "church-1");
    await page.loadData();
    await page.loadGivingForMember("mem-1", () => {});
    (page as any).selectedMemberId = "mem-1";
    expect((page as any).givingById["mem-1"].status).toBe("denied");
    expect(page.renderHtml()).toContain("ไม่มีสิทธิ์ดูข้อมูลการถวาย");
  });
});
