import { describe, it, expect } from "vitest";
import { TransactionsPage } from "../../src/pages/TransactionsPage";

describe("TransactionsPage UI — Unit Tests", () => {
  const mockTransactions = [
    {
      id: "txn-1",
      description: "เงินถวายวันอาทิตย์ (รอบเช้า)",
      transaction_date: "2026-08-21",
      status: "approved",
      category_id: "cat-1",
      account_id: "acc-1",
      categories: { name: "ถวายทรัพย์ทั่วไป" },
      accounts: { name: "เงินสดในมือ" },
      funds: { name: "กองทุนทั่วไป" },
      transaction_splits: [{ amount: "18450.00", fund_id: "fund-1", funds: { name: "กองทุนทั่วไป" } }],
    },
    {
      id: "txn-2",
      description: "ซื้ออุปกรณ์ระบบเสียงห้องเยาวชน",
      transaction_date: "2026-08-21",
      status: "pending",
      category_id: "cat-2",
      account_id: "acc-2",
      categories: { name: "พันธกิจเยาวชน" },
      accounts: { name: "ธ.กรุงไทย ···4821" },
      funds: { name: "กองทุนเยาวชน" },
      transaction_splits: [{ amount: "8500.00", fund_id: "fund-2", funds: { name: "กองทุนเยาวชน" } }],
    },
    {
      id: "txn-3",
      description: "ค่าไฟฟ้าและสาธารณูปโภคประจำเดือน",
      transaction_date: "2026-08-20",
      status: "approved",
      category_id: "cat-3",
      account_id: "acc-2",
      categories: { name: "สาธารณูปโภค" },
      accounts: { name: "ธ.กรุงไทย ···4821" },
      funds: { name: "กองทุนทั่วไป" },
      transaction_splits: [{ amount: "4280.00", fund_id: "fund-1", funds: { name: "กองทุนทั่วไป" } }],
    },
  ];

  const mockSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: mockTransactions, error: null }),
        }),
      }),
    }),
  } as any;

  it("renders transactions page with header, income/expense overview, and search bar", async () => {
    const page = new TransactionsPage(mockSupabase, "church-1");
    await page.loadData();
    const html = page.renderHtml();

    expect(html).toContain("<h1>รายการเงิน</h1>");
    expect(html).toContain("บันทึกรายรับ รายจ่าย และประวัติธุรกรรมทั้งหมดของคริสตจักร");
    expect(html).toContain("รายรับเดือนนี้");
    expect(html).toContain("รายจ่ายเดือนนี้");
    expect(html).toContain('id="txn-search-input"');
    expect(html).toContain("ค้นหารายการ, รหัส หรือหมวดหมู่...");
  });

  it("renders filter pills (ทั้งหมด, รายรับ, รายจ่าย, โอน, รออนุมัติ)", async () => {
    const page = new TransactionsPage(mockSupabase, "church-1");
    await page.loadData();
    const html = page.renderHtml();

    expect(html).toContain('data-filter="all"');
    expect(html).toContain('data-filter="income"');
    expect(html).toContain('data-filter="expense"');
    expect(html).toContain('data-filter="transfer"');
    expect(html).toContain('data-filter="pending"');
  });

  it("renders transaction items with date groupings and formatted Thai details", async () => {
    const page = new TransactionsPage(mockSupabase, "church-1");
    await page.loadData();
    const html = page.renderHtml();

    expect(html).toContain("วันนี้");
    expect(html).toContain("เมื่อวาน");
    expect(html).toContain("เงินถวายวันอาทิตย์ (รอบเช้า)");
    expect(html).toContain("ซื้ออุปกรณ์ระบบเสียงห้องเยาวชน");
    expect(html).toContain("+฿18,450.00");
    expect(html).toContain("−฿8,500.00");
    expect(html).toContain("อนุมัติแล้ว");
    expect(html).toContain("รอตรวจสอบ");
  });

  it("renders detail modal with audit trail when a transaction is selected", async () => {
    const page = new TransactionsPage(mockSupabase, "church-1");
    await page.loadData();

    // Select txn-1
    (page as any).selectedTransactionId = "txn-1";
    const html = page.renderHtml();

    expect(html).toContain('id="txn-modal"');
    expect(html).toContain("รายละเอียดรายการ");
    expect(html).toContain("TXN-0001");
    expect(html).toContain("ประวัติการตรวจสอบ");
  });
});
