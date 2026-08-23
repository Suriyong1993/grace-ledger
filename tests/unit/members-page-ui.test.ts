import { describe, it, expect } from "vitest";
import { MembersPage } from "../../src/pages/MembersPage";
import { Money } from "../../src/lib/money";

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

  it("renders member cards with giving totals, tithe counts, and certificates button", async () => {
    const page = new MembersPage(mockSupabase, "church-1");
    await page.loadData();
    const html = page.renderHtml();

    expect(html).toContain("วนิดา เกียรติสกุล");
    expect(html).toContain("MEM-0101");
    expect(html).toContain("ยอดถวายสะสมปี 2026");
    expect(html).toContain("หนังสือรับรอง");
  });

  it("renders donation/giving certificate modal when a member is selected", async () => {
    const page = new MembersPage(mockSupabase, "church-1");
    await page.loadData();

    // Select mem-1 and set giving total for certificate test
    (page as any).selectedMemberId = "mem-1";
    (page as any).members[0].yearGivingTotal = Money.from("36000.00");
    (page as any).members[0].titheCount = 12;
    const html = page.renderHtml();

    expect(html).toContain('id="cert-modal"');
    expect(html).toContain("หนังสือรับรองการถวายทรัพย์");
    expect(html).toContain("คริสตจักรเกรซแบ๊บติสต์");
    expect(html).toContain("หนังสือรับรองการบริจาค/การถวายทรัพย์");
    expect(html).toContain("วนิดา เกียรติสกุล");
    expect(html).toContain("฿36,000.00");
    expect(html).toContain("พิมพ์เอกสาร / ดาวน์โหลด PDF");
  });
});
