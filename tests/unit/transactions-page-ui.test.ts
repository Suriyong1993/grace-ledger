import { describe, it, expect } from "vitest";
import { TransactionsPage } from "../../src/pages/TransactionsPage";

describe("TransactionsPage UI — Unit Tests", () => {
  // Dynamic dates: today, yesterday, and an earlier date for date grouping.
  // "earlier" is clamped to day 1 rather than a fixed -5 days: near the start
  // of a month, today.getDate() - 5 crosses into the previous calendar month,
  // which the "เดือนนี้" period default would then exclude — the fixture would
  // pass on the 6th and fail on the 3rd.
  const today = new Date();
  const yesterday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 1,
  );
  const earlier = new Date(
    today.getFullYear(),
    today.getMonth(),
    Math.max(1, today.getDate() - 5),
  );
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 15);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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
      transaction_splits: [
        {
          amount: "18450.00",
          fund_id: "fund-1",
          category_id: "cat-1",
          funds: { name: "กองทุนทั่วไป" },
          categories: { name: "ถวายทรัพย์ทั่วไป" },
        },
      ],
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
      transaction_splits: [
        {
          amount: "8500.00",
          fund_id: "fund-2",
          category_id: "cat-2",
          funds: { name: "กองทุนเยาวชน" },
          categories: { name: "พันธกิจเยาวชน" },
        },
      ],
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
      transaction_splits: [
        {
          amount: "4280.00",
          fund_id: "fund-1",
          category_id: "cat-3",
          funds: { name: "กองทุนทั่วไป" },
          categories: { name: "สาธารณูปโภค" },
        },
      ],
    },
    {
      // Dated last calendar month. Large and distinctive so it is unmissable
      // in the "เดือนนี้" default sum if the period bound ever regresses.
      id: "txn-4",
      description: "เงินถวายพิเศษเดือนก่อน",
      transaction_date: fmt(lastMonth),
      direction: "income",
      reference_number: "RCV-2026-000",
      status: "posted",
      account_id: "acc-1",
      created_by: "user-1",
      accounts: { name: "เงินสดในมือ" },
      transaction_splits: [
        {
          amount: "999000.00",
          fund_id: "fund-1",
          category_id: "cat-1",
          funds: { name: "กองทุนทั่วไป" },
          categories: { name: "ถวายทรัพย์ทั่วไป" },
        },
      ],
    },
  ];

  const mockProfiles = [{ id: "user-1", full_name: "สมชาย ใจดี" }];

  const mockSupabase = {
    from: (table: string) => {
      const result =
        table === "profiles"
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
    expect(html).toContain(
      "บันทึกรายรับ รายจ่าย และประวัติธุรกรรมทั้งหมดของคริสตจักร",
    );
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

  describe("period selector — financial correctness", () => {
    it("defaults to เดือนนี้ and excludes last month's transaction from both the sum and the list", async () => {
      const page = new TransactionsPage(mockSupabase, "church-1");
      await page.loadData();
      const html = page.renderHtml();

      expect(html).toContain('data-period="this_month"');
      expect(html).toContain('data-period="last_month"');
      expect(html).toContain('data-period="all"');
      expect(html).toContain(
        'class="gl-tab is-active" data-period="this_month"',
      );

      // txn-4's ฿999,000.00 must not leak into the "เดือนนี้" sum or list —
      // this is the exact bug class the Dashboard fix addressed: a total whose
      // label says one period while it actually sums another.
      expect(html).not.toContain("999,000.00");
      expect(html).not.toContain("เงินถวายพิเศษเดือนก่อน");
    });

    it("switching to เดือนก่อนหน้า shows only last month's transaction and sums just that", async () => {
      const page = new TransactionsPage(mockSupabase, "church-1");
      await page.loadData();
      (page as any).activePeriod = "last_month";
      const html = page.renderHtml();

      expect(html).toContain("เงินถวายพิเศษเดือนก่อน");
      expect(html).toContain("+฿999,000.00");
      expect(html).toContain("รายรับเดือนก่อนหน้า");
      // This month's items are out of scope under "เดือนก่อนหน้า".
      expect(html).not.toContain("เงินถวายวันอาทิตย์ (รอบเช้า)");
    });

    it("switching to ทั้งหมด restores the full unbounded history", async () => {
      const page = new TransactionsPage(mockSupabase, "church-1");
      await page.loadData();
      (page as any).activePeriod = "all";
      const html = page.renderHtml();

      expect(html).toContain("รายรับทั้งหมด");
      expect(html).toContain("เงินถวายพิเศษเดือนก่อน");
      expect(html).toContain("เงินถวายวันอาทิตย์ (รอบเช้า)");
      expect(html).toContain("+฿1,017,450.00"); // 18,450 + 999,000, this month + last month
    });
  });

  describe("rendering — neutral fund/category tags", () => {
    it("renders fund and category as plain outline tags, never a per-category color", async () => {
      const page = new TransactionsPage(mockSupabase, "church-1");
      await page.loadData();
      const html = page.renderHtml();

      expect(html).toContain('<span class="gl-tag">กองทุนทั่วไป</span>');
      expect(html).toContain('<span class="gl-tag">ถวายทรัพย์ทั่วไป</span>');
      // No inline color/background ever attached to a tag — the row-level
      // direction color lives elsewhere; a tag is structural, not a status.
      expect(html).not.toMatch(/<span class="gl-tag" style="[^"]*color/);
    });
  });

  describe("rendering — modal entrance motion", () => {
    it("gives the detail modal the same rise-in treatment as the Dashboard stat rail", async () => {
      const page = new TransactionsPage(mockSupabase, "church-1");
      await page.loadData();
      (page as any).selectedTransactionId = "txn-1";
      const html = page.renderHtml();

      expect(html).toContain('class="gl-modal-content gl-rise"');
    });
  });

  describe("Transactions Page — Mobile-First & Profile-Centric Enhancements", () => {
    it("renders church badge and export CSV button", async () => {
      const page = new TransactionsPage(mockSupabase, "church-1");
      await page.loadData();
      const html = page.renderHtml({
        name: "ศรัณย์ สถิต",
        role: "เหรัญญิก",
        churchName: "คริสตจักรพระคุณ กาฬสินธุ์",
        initials: "ศส",
      });

      expect(html).toContain("คริสตจักรพระคุณ กาฬสินธุ์");
      expect(html).toContain('id="export-csv-btn"');
      expect(html).toContain("ส่งออก CSV");
    });

    it("displays 3-column summary metrics (income, expense, net total) with Decimal precision", async () => {
      const page = new TransactionsPage(mockSupabase, "church-1");
      await page.loadData();
      const html = page.renderHtml();

      expect(html).toContain("รายรับเดือนนี้");
      expect(html).toContain("+฿18,450.00");
      expect(html).toContain("รายจ่ายเดือนนี้");
      expect(html).toContain("−฿12,780.00"); // 8500 + 4280
      expect(html).toContain("ส่วนต่างสุทธิเดือนนี้");
      expect(html).toContain("+฿5,670.00"); // 18450 - 12780
    });

    it("renders sort selector and results counter", async () => {
      const page = new TransactionsPage(mockSupabase, "church-1");
      await page.loadData();
      const html = page.renderHtml();

      expect(html).toContain('id="txn-sort-select"');
      expect(html).toContain("ใหม่สุด");
      expect(html).toContain("เก่าสุด");
      expect(html).toContain("ยอดเงิน: มากไปน้อย");
      expect(html).toContain("ยอดเงิน: น้อยไปมาก");
      expect(html).toContain("แสดง <strong class=\"num-display\" style=\"color: var(--foreground);\">3</strong> รายการจากทั้งหมด <strong class=\"num-display\" style=\"color: var(--foreground);\">4</strong> รายการ");
    });

    it("supports sorting by amount descending and ascending", async () => {
      const page = new TransactionsPage(mockSupabase, "church-1");
      await page.loadData();

      (page as any).activeSort = "amount_desc";
      const htmlDesc = page.renderHtml();
      expect(htmlDesc).toContain("value=\"amount_desc\" selected");

      (page as any).activeSort = "amount_asc";
      const htmlAsc = page.renderHtml();
      expect(htmlAsc).toContain("value=\"amount_asc\" selected");
    });

    it("supports 3-month period filter", async () => {
      const page = new TransactionsPage(mockSupabase, "church-1");
      await page.loadData();

      (page as any).activePeriod = "last_3_months";
      const html = page.renderHtml();

      expect(html).toContain('data-period="last_3_months"');
      expect(html).toContain("3 เดือนล่าสุด");
    });
  });
});
