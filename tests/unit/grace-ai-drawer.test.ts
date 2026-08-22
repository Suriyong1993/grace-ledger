import { describe, it, expect } from "vitest";
import { GraceAiDrawer } from "../../src/components/ai/GraceAiDrawer";

describe("GraceAiDrawer Copilot UI — Unit & Security Tests", () => {
  const dummyChurchId = "00000000-0000-0000-0000-000000000001";
  const dummyUserId = "00000000-0000-0000-0000-000000000002";

  function createMockSupabase() {
    return {
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: dummyUserId } }, error: null }),
        getSession: () => Promise.resolve({ data: { session: { user: { id: dummyUserId } } }, error: null }),
      },
      from: (table: string) => {
        const query: any = {
          _data: null,
          select: () => query,
          insert: () => query,
          update: () => query,
          delete: () => query,
          eq: () => query,
          neq: () => query,
          gte: () => query,
          lte: () => query,
          order: () => query,
          limit: () => query,
          single: () => {
            if (table === "profiles") {
              return Promise.resolve({
                data: { id: dummyUserId, church_id: dummyChurchId, role: "treasurer" },
                error: null,
              });
            }
            if (table === "funds") {
              return Promise.resolve({
                data: { id: "00000000-0000-0000-0000-000000000010", name: "กองทุนทั่วไป", current_balance: 200000, target_budget: 300000, is_active: true },
                error: null,
              });
            }
            return Promise.resolve({ data: null, error: null });
          },
          maybeSingle: () => {
            if (table === "user_roles") {
              return Promise.resolve({ data: { role: "treasurer" }, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          },
          then: (resolve: any) => {
            if (table === "transactions") {
              return resolve({
                data: [
                  {
                    id: "txn-1",
                    amount: 150000,
                    direction: "income",
                    status: "posted",
                    category_id: "cat-1",
                    transaction_date: "2026-08-10",
                    categories: { id: "cat-1", name: "เงินถวายสิบลด" },
                    transaction_splits: [{ fund_id: "fund-1", amount: 150000, funds: { id: "fund-1", name: "กองทุนทั่วไป" } }],
                  },
                  {
                    id: "txn-2",
                    amount: 50000,
                    direction: "expense",
                    status: "posted",
                    category_id: "cat-2",
                    transaction_date: "2026-08-15",
                    categories: { id: "cat-2", name: "ค่าตอบแทนผู้รับใช้" },
                    transaction_splits: [{ fund_id: "fund-1", amount: -50000, funds: { id: "fund-1", name: "กองทุนทั่วไป" } }],
                  },
                ],
                error: null,
              });
            }
            if (table === "funds") {
              return resolve({
                data: [
                  { id: "00000000-0000-0000-0000-000000000010", name: "กองทุนทั่วไป", current_balance: 200000, target_budget: 300000, is_active: true },
                  { id: "00000000-0000-0000-0000-000000000011", name: "กองทุนพันธกิจ", current_balance: 80000, target_budget: 100000, is_active: true },
                ],
                error: null,
              });
            }
            return resolve({ data: [], error: null });
          },
        };
        return query;
      },
      rpc: (fn: string) => {
        if (fn === "create_action_confirmation") {
          return Promise.resolve({
            data: {
              confirmation_id: "conf-123",
              expires_at: new Date(Date.now() + 300000).toISOString(),
            },
            error: null,
          });
        }
        return Promise.resolve({ data: { success: true, message: "OK" }, error: null });
      },
    } as any;
  }

  it("renders floating AI toggle button when drawer is closed", () => {
    const mockSupabase = createMockSupabase();
    const drawer = new GraceAiDrawer(mockSupabase, dummyChurchId, "treasurer", dummyUserId);
    expect(drawer.getIsOpen()).toBe(false);

    const html = drawer.renderHtml();
    expect(html).toContain('id="gl-ai-drawer-toggle"');
    expect(html).not.toContain('id="gl-ai-drawer"');
  });

  it("renders full drawer container with header and quick chips when open", () => {
    const mockSupabase = createMockSupabase();
    const drawer = new GraceAiDrawer(mockSupabase, dummyChurchId, "treasurer", dummyUserId);
    drawer.open();
    expect(drawer.getIsOpen()).toBe(true);

    const html = drawer.renderHtml();
    expect(html).toContain('id="gl-ai-drawer"');
    expect(html).toContain("Grace AI Copilot");
    expect(html).toContain("📊 สรุปการเงิน");
    expect(html).toContain("🏦 ยอดกองทุน");
    expect(html).toContain("📝 ร่างโอนเงิน");
    expect(html).toContain("⚠️ เสนอโอนเงิน");
    expect(html).toContain('id="gl-ai-prompt-input"');
  });

  it("processes READ prompt and renders segregated Facts, Analysis, and Provenance metadata", async () => {
    const mockSupabase = createMockSupabase();
    const drawer = new GraceAiDrawer(mockSupabase, dummyChurchId, "treasurer", dummyUserId);
    drawer.open();

    let updated = false;
    await drawer.processPrompt("สรุปการเงินเดือนนี้", () => {
      updated = true;
    });

    expect(updated).toBe(true);
    const html = drawer.renderHtml();

    expect(html).toContain("ข้อมูลข้อเท็จจริงทางบัญชี (FACTS)");
    expect(html).toContain("150,000.00 บาท");
    expect(html).toContain("50,000.00 บาท");
    expect(html).toContain("100,000.00 บาท");
    expect(html).toContain("การวิเคราะห์");
  });

  it("processes DRAFT transfer prompt and renders uncommitted draft card with non-impact warning", async () => {
    const mockSupabase = createMockSupabase();
    const drawer = new GraceAiDrawer(mockSupabase, dummyChurchId, "treasurer", dummyUserId);
    drawer.open();

    await drawer.processPrompt("ร่างการโอนเงิน 5000", () => {});
    const html = drawer.renderHtml();

    expect(html).toContain("แบบร่างการโอนเงิน (DRAFT)");
    expect(html).toContain("ยังไม่กระทบยอดเงิน");
    expect(html).toContain("฿5,000.00");
    expect(html).toContain("รายการนี้เป็นเพียงแบบร่าง ยังไม่มีการตัดหรือเพิ่มยอดเงินในกองทุนจริง");
  });

  it("processes ACTION PROPOSAL prompt and renders review button without direct execute bypass", async () => {
    const mockSupabase = createMockSupabase();
    const drawer = new GraceAiDrawer(mockSupabase, dummyChurchId, "treasurer", dummyUserId);
    drawer.open();

    await drawer.processPrompt("เสนอโอนเงิน 5000", () => {});
    const html = drawer.renderHtml();

    expect(html).toContain("ข้อเสนอการดำเนินการ (ACTION PROPOSAL)");
    expect(html).toContain("รอการยืนยัน");
    expect(html).toContain("🔍 ตรวจสอบและยืนยันการดำเนินการ");
    expect(html).toContain("gl-ai-review-proposal-btn");

    // CRITICAL SECURITY ASSERTION: No direct execution trigger exists on the card
    expect(html).not.toContain("ยืนยันและโอนเงินทันที");
    expect(html).not.toContain("execute_funds_transfer");
  });
});
