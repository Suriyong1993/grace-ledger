import { describe, it, expect } from "vitest";
import { TransactionsPage } from "../../src/pages/TransactionsPage";

describe("TransactionsPage UI — Unit Tests", () => {
  // Dynamic dates: today, yesterday, and an earlier date for date grouping
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const earlier = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const mockTransactions = [
    {
      id: "txn-1",
      description: "เงินถวายวันอาทิตย์ (รอบเช้า)",
      transaction_date: fmt(today),
      direction: "income",
      reference_number: "RCV-2026-001",
      status: "posted",
      account_id: "acc-1",
      created_by: "user-1",
      accounts: { name: "เงินสดในมือ" },
      transaction_splits: [{ amount: "18450.00", fund_id: "fund-1", category_id: "cat-1", funds: { name: "กองทุนทั่วไป" }, categories: { name: "ถวายทรัพย์ทั่วไป" } }],
    },
    {
      id: "txn-2",
      description: "ซื้ออุปกรณ์ระบบเสียงห้องเยาวชน",
      transaction_date: fmt(yesterday),
      direction: "expense",
      reference_number: "EXP-2026-002",
      status: "pending_approval",
      account_id: "acc-2",
      created_by: "user-1",
      accounts: { name: "ธ.กรุงไทย ···4821" },
      transaction_splits: [{ amount: "8500.00", fund_id: "fund-2", category_id: "cat-2", funds: { name: "กองทุนเยาวชน" }, categories: { name: "พันธกิจเยาวชน" } }],
    },
    {
      id: "txn-3",
      description: "ค่าไฟฟ้าและสาธารณูปโภคประจำเดือน",
      transaction_date: fmt(earlier),
      direction: "expense",
      reference_number: null,
      status: "posted",
      account_id: "acc-2",
      created_by: "user-1",
      accounts: { name: "ธ.กรุงไทย ···4821" },
      transaction_splits: [{ amount: "4280.00", fund_id: "fund-1", category_id: "cat-3", funds: { name: "กองทุนทั่วไป" }, categories: { name: "สาธารณูปโภค" } }],
    },
  ];

  const mockProfiles = [
    { id: "user-1", full_name: "สมชาย ใจดี" },
  ];

  const mockSupabase = {
    from: (table: string) => {
      const result = table === "profiles"
        ? { data: mockProfiles, error: null }
        : { data: mockTransactions, error: null };
      const base: any = {
        in: () => Promise.resolve(result),
      };
      base.eq = () => ({
        order: () => Promise.resolve(result),
        in: () => Promise.resolve(result),
      });
      return {
        select: () => base,
      };
    },
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
    expect(html).toContain("ลงบัญชีแล้ว");
    expect(html).toContain("รออนุมัติ");
  });

  it("resolves category name from transaction_splits, not a transactions.category_id column (regression)", async () => {
    const page = new TransactionsPage(mockSupabase, "church-1");
    await page.loadData();
    const html = page.renderHtml();

    expect(html).toContain("ถวายทรัพย์ทั่วไป");
    expect(html).toContain("พันธกิจเยาวชน");
    expect(html).toContain("สาธารณูปโภค");
  });

  it("renders detail modal with audit trail when a transaction is selected", async () => {
    const page = new TransactionsPage(mockSupabase, "church-1");
    await page.loadData();

    // Select txn-1
    (page as any).selectedTransactionId = "txn-1";
    const html = page.renderHtml();

    expect(html).toContain('id="txn-modal"');
    expect(html).toContain("รายละเอียดรายการ");
    expect(html).toContain("RCV-2026-001");
    expect(html).toContain("ประวัติการตรวจสอบ");
  });
});
