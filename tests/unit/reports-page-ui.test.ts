import { describe, it, expect } from "vitest";
import { ReportsPage } from "../../src/pages/ReportsPage";

describe("ReportsPage UI — Unit Tests", () => {
  const mockSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gte: () => ({
              lte: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "txn-1",
                      amount: 124500,
                      direction: "income",
                      status: "posted",
                      category_id: "cat-1",
                      categories: { id: "cat-1", name: "เงินถวายสิบลด" },
                      transaction_splits: [{ fund_id: "fund-1", amount: 124500, funds: { id: "fund-1", name: "กองทุนทั่วไป" } }],
                    },
                    {
                      id: "txn-2",
                      amount: 65000,
                      direction: "expense",
                      status: "posted",
                      category_id: "cat-2",
                      categories: { id: "cat-2", name: "ค่าตอบแทนและพันธกิจผู้รับใช้" },
                      transaction_splits: [{ fund_id: "fund-1", amount: -65000, funds: { id: "fund-1", name: "กองทุนทั่วไป" } }],
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        }),
      }),
    }),
  } as any;

  it("renders reports page header and month tabs", async () => {
    const page = new ReportsPage(mockSupabase, "church-1");
    await page.loadData();
    const html = page.renderHtml();

    expect(html).toContain("<h1>รายงานการเงิน</h1>");
    expect(html).toContain("งบการเงินประจำเดือน รายรับ-รายจ่าย");
    expect(html).toContain("ส.ค. 2569 (Live)");
    expect(html).toContain("ก.ค. 2569 (ย้อนหลัง)");
    expect(html).toContain("มิ.ย. 2569");
    expect(html).toContain("มี.ค. 2569 ⚠️");
    expect(html).toContain("ภาพรวมทั้งปี 2569");
    expect(html).toContain("พิมพ์รายงาน");
  });

  it("renders net result strip with accurate income, expense, and surplus calculations from real data", async () => {
    const page = new ReportsPage(mockSupabase, "church-1");
    await page.loadData();
    const html = page.renderHtml();

    expect(html).toContain("รายรับรวมทั้งหมด");
    expect(html).toContain("+฿124,500.00");
    expect(html).toContain("รายจ่ายรวมทั้งหมด");
    expect(html).toContain("−฿65,000.00");
    expect(html).toContain("รายรับสุทธิ");
    expect(html).toContain("฿59,500.00");
  });

  it("renders clean Thai tables for income and expense categories without English labels", async () => {
    const page = new ReportsPage(mockSupabase, "church-1");
    await page.loadData();
    const html = page.renderHtml();

    expect(html).toContain("หมวดรายรับ");
    expect(html).toContain("หมวดรายจ่าย");
    expect(html).not.toContain("หมวดรายรับ (Income)");
    expect(html).not.toContain("หมวดรายจ่าย (Expenses)");

    expect(html).toContain("เงินถวายสิบลด");
    expect(html).toContain("ค่าตอบแทนและพันธกิจผู้รับใช้");
    expect(html).not.toContain("Tithes");
    expect(html).not.toContain("Staff & Ministry");
  });
});
