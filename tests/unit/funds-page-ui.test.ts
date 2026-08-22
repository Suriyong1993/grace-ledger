import { describe, it, expect } from "vitest";
import { FundsPage } from "../../src/pages/FundsPage";

describe("FundsPage UI — Unit Tests", () => {
  const mockFunds = [
    { id: "f-1", name: "กองทุนทั่วไป", current_balance: "128450.00", is_active: true },
    { id: "f-2", name: "กองทุนพันธกิจ", current_balance: "42300.00", is_active: true },
    { id: "f-3", name: "กองทุนอาคารและสถานที่", current_balance: "65800.00", is_active: true },
    { id: "f-4", name: "กองทุนเยาวชนและการศึกษา", current_balance: "12010.00", is_active: true },
  ];

  const mockSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: mockFunds, error: null }),
          }),
        }),
      }),
    }),
  } as any;

  it("renders total fund balance card and header", async () => {
    const page = new FundsPage(mockSupabase, "church-1");
    await page.loadData();
    const html = page.renderHtml();

    expect(html).toContain("<h1>กองทุนและงบประมาณ</h1>");
    expect(html).toContain("บริหารจัดการกองทุนเฉพาะกิจ ยอดคงเหลือ และการจัดสรรงบประมาณ");
    expect(html).toContain("ยอดคงเหลือรวมทุกกองทุน");
    expect(html).toContain("฿248,560.00");
    expect(html).toContain('id="open-transfer-btn"');
    expect(html).toContain("โอนเงินกองทุน");
  });

  it("renders clean Thai fund cards without bilingual double-labels", async () => {
    const page = new FundsPage(mockSupabase, "church-1");
    await page.loadData();
    const html = page.renderHtml();

    expect(html).toContain("กองทุนทั่วไป");
    expect(html).toContain("กองทุนพันธกิจ");
    expect(html).toContain("กองทุนอาคารและสถานที่");
    expect(html).toContain("กองทุนเยาวชนและการศึกษา");
    expect(html).not.toContain("General Fund");
    expect(html).not.toContain("Mission Fund");
    expect(html).not.toContain("Building Fund");
    expect(html).not.toContain("Youth & Education");

    // Amount checks
    expect(html).toContain("฿128,450.00");
  });

  it("renders transfer modal when isTransferModalOpen is true", async () => {
    const page = new FundsPage(mockSupabase, "church-1");
    await page.loadData();

    (page as any).isTransferModalOpen = true;
    const html = page.renderHtml();

    expect(html).toContain('id="transfer-modal"');
    expect(html).toContain("โอนเงินระหว่างกองทุน");
    expect(html).toContain("กองทุนต้นทาง (หักเงินออก)");
    expect(html).toContain("กองทุนปลายทาง (รับเงินเข้า)");
    expect(html).toContain('id="transfer-amount"');
    expect(html).toContain("ยืนยันการโอน");
  });

  it("renders success notice when transferSuccessMsg is present", async () => {
    const page = new FundsPage(mockSupabase, "church-1");
    await page.loadData();

    (page as any).transferSuccessMsg = "บันทึกคำขอโอนเงิน ฿5,000.00 เรียบร้อยแล้ว (รอการอนุมัติ)";
    const html = page.renderHtml();

    expect(html).toContain("gl-notice--success");
    expect(html).toContain("บันทึกคำขอโอนเงิน ฿5,000.00 เรียบร้อยแล้ว");
  });
});
