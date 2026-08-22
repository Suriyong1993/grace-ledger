import { describe, it, expect } from "vitest";
import { DashboardPage, DashboardData } from "../../src/pages/DashboardPage";
import { Money } from "../../src/lib/money";

describe("DashboardPage UI — Unit Tests", () => {
  const dummySupabase = {} as any;
  const page = new DashboardPage(dummySupabase);

  it("renders hero balance card, monthly income and expense correctly", () => {
    const data: DashboardData = {
      pendingApprovalsCount: 2,
      totalFundsBalance: "฿248,560.00",
      monthlyIncome: "฿18,450.00",
      monthlyExpense: "฿12,820.00",
      activeAccountsCount: 3,
      funds: [
        { id: "f-1", name: "กองทุนทั่วไป", balance: Money.from("128450.00") },
        { id: "f-2", name: "กองทุนพันธกิจ", balance: Money.from("42300.00") },
      ],
      recentTransactions: [
        {
          id: "tx-1",
          title: "เงินถวายวันอาทิตย์",
          subtitle: "กองทุนทั่วไป · 21 ส.ค. 2569",
          amount: Money.from("18450.00"),
          direction: "income",
          date: "21 ส.ค. 2569",
          status: "approved",
        },
      ],
    };

    const html = page.renderHtml(data);

    expect(html).toContain("ยอดเงินคงเหลือทั้งหมด");
    expect(html).toContain("฿248,560.00");
    expect(html).toContain("+฿18,450.00");
    expect(html).toContain("−฿12,820.00");
    expect(html).toContain("2 กองทุน · 3 บัญชีธนาคาร + เงินสดในมือ");
  });

  it("renders 4 quick action links with correct hrefs", () => {
    const html = page.renderHtml({ pendingApprovalsCount: 0 });

    expect(html).toContain('href="#/offerings/new"');
    expect(html).toContain('href="#/transactions"');
    expect(html).toContain('href="#/funds"');
    expect(html).toContain("บันทึก<br>เงินถวาย");
    expect(html).toContain("บันทึก<br>รายจ่าย");
    expect(html).toContain("โอนเงิน<br>กองทุน");
    expect(html).toContain("รายการ<br>ทั้งหมด");
  });

  it("renders attention queue with pending count when pending approvals exist", () => {
    const html = page.renderHtml({ pendingApprovalsCount: 3 });

    expect(html).toContain("ต้องการให้คุณตรวจสอบ");
    expect(html).toContain("3 เรื่อง");
    expect(html).toContain("3 รายการรออนุมัติจากคุณ");
    expect(html).toContain('href="#/approvals"');
    expect(html).toContain('href="#/offerings"');
  });

  it("renders empty states gracefully for funds and recent transactions", () => {
    const html = page.renderHtml({
      pendingApprovalsCount: 0,
      funds: [],
      recentTransactions: [],
    });

    expect(html).toContain("ยังไม่มีกองทุน");
    expect(html).toContain("ยังไม่มีรายการล่าสุด");
    expect(html).toContain("ไม่มีรายการค้างอนุมัติ");
  });

  it("renders error notice if loadFailed is true", () => {
    const html = page.renderHtml({
      pendingApprovalsCount: 0,
      loadFailed: true,
    });

    expect(html).toContain("gl-notice--error");
    expect(html).toContain("โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง");
  });
});
