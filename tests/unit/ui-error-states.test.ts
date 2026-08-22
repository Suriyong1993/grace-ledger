import { describe, it, expect } from "vitest";
import { TransactionsPage } from "../../src/pages/TransactionsPage";
import { FundsPage } from "../../src/pages/FundsPage";
import { MembersPage } from "../../src/pages/MembersPage";
import { DashboardPage } from "../../src/pages/DashboardPage";
import { ReportsPage } from "../../src/pages/ReportsPage";

describe("UI Error & Empty States (Fail-Closed Architecture)", () => {
  const failingSupabase = {
    from: () => {
      const chain: any = () => chain;
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.gte = () => chain;
      chain.lte = () => chain;
      chain.order = () => chain;
      chain.then = (resolve: any) => resolve({ data: null, error: { message: "Database connection failure" } });
      return chain;
    },
  } as any;

  const emptySupabase = {
    from: () => {
      const chain: any = () => chain;
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.gte = () => chain;
      chain.lte = () => chain;
      chain.order = () => chain;
      chain.then = (resolve: any) => resolve({ data: [], error: null });
      return chain;
    },
  } as any;

  describe("TransactionsPage", () => {
    it("renders explicit error notice on query failure without falling back to mock data", async () => {
      const page = new TransactionsPage(failingSupabase, "church-1");
      await page.loadData();
      const html = page.renderHtml();

      expect(html).toContain("gl-notice--error");
      expect(html).toContain("ไม่สามารถโหลดรายการเงินได้");
      expect(html).toContain('id="retry-load-btn"');
      expect(html).not.toContain("INC-0184");
      expect(html).not.toContain("เงินถวายวันอาทิตย์ (รอบเช้า)");
    });

    it("renders clean empty state on 0 transactions without error notice", async () => {
      const page = new TransactionsPage(emptySupabase, "church-1");
      await page.loadData();
      const html = page.renderHtml();

      expect(html).not.toContain("gl-notice--error");
      expect(html).toContain("gl-empty-state");
      expect(html).toContain("ยังไม่มีรายการธุรกรรม");
    });
  });

  describe("FundsPage", () => {
    it("renders explicit error notice on query failure without falling back to mock funds", async () => {
      const page = new FundsPage(failingSupabase, "church-1");
      await page.loadData();
      const html = page.renderHtml();

      expect(html).toContain("gl-notice--error");
      expect(html).toContain("ไม่สามารถโหลดข้อมูลกองทุนได้");
      expect(html).toContain('id="retry-funds-btn"');
      expect(html).not.toContain("กองทุนเยาวชนและการศึกษา");
    });

    it("renders clean empty state on 0 funds without error notice", async () => {
      const page = new FundsPage(emptySupabase, "church-1");
      await page.loadData();
      const html = page.renderHtml();

      expect(html).not.toContain("gl-notice--error");
      expect(html).toContain("gl-empty-state");
      expect(html).toContain("ยังไม่มีกองทุนในระบบ");
    });
  });

  describe("MembersPage", () => {
    it("renders explicit error notice on query failure without falling back to mock members", async () => {
      const page = new MembersPage(failingSupabase, "church-1");
      await page.loadData();
      const html = page.renderHtml();

      expect(html).toContain("gl-notice--error");
      expect(html).toContain("ไม่สามารถโหลดข้อมูลสมาชิกได้");
      expect(html).toContain('id="retry-members-btn"');
      expect(html).not.toContain("วนิดา เกียรติสกุล");
    });

    it("renders clean empty state on 0 members without error notice", async () => {
      const page = new MembersPage(emptySupabase, "church-1");
      await page.loadData();
      const html = page.renderHtml();

      expect(html).not.toContain("gl-notice--error");
      expect(html).toContain("gl-empty-state");
      expect(html).toContain("ยังไม่มีรายชื่อสมาชิก");
    });
  });

  describe("DashboardPage", () => {
    it("returns loadFailed: true with error message on query failure without mock balance", async () => {
      const page = new DashboardPage(failingSupabase);
      const data = await page.loadData("church-1");
      const html = page.renderHtml(data);

      expect(data.loadFailed).toBe(true);
      expect(html).toContain("gl-notice--error");
      expect(data.totalFundsBalance).toBe("฿0.00");
    });
  });

  describe("ReportsPage", () => {
    it("renders explicit error notice on query failure without falling back to mock numbers", async () => {
      const page = new ReportsPage(failingSupabase, "church-1");
      await page.loadData();
      const html = page.renderHtml();

      expect(html).toContain("gl-notice--error");
      expect(html).toContain("เกิดข้อผิดพลาดในการโหลดรายงาน");
      expect(html).toContain('id="retry-reports-btn"');
      expect(html).not.toContain("124,500.00");
    });

    it("renders clean empty state on 0 transactions without error notice", async () => {
      const page = new ReportsPage(emptySupabase, "church-1");
      await page.loadData();
      const html = page.renderHtml();

      expect(html).not.toContain("gl-notice--error");
      expect(html).toContain("gl-empty-state");
      expect(html).toContain("ไม่มีข้อมูลธุรกรรมที่ลงบัญชีแล้วในงวดนี้");
    });
  });
});
