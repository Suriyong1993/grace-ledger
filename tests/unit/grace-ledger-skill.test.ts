import { describe, it, expect } from "vitest";
import { HermesGraceLedgerAdapter } from "../../src/lib/hermes/hermes-adapter";
import { HermesGraceLedgerSkill } from "../../src/lib/hermes/grace-ledger-skill";

describe("REAL-17: Hermes Grace Ledger Skill", () => {
  const dummyChurchId = "00000000-0000-0000-0000-000000000001";
  const dummyUserId = "00000000-0000-0000-0000-000000000002";
  const fundGeneralId = "00000000-0000-0000-0000-000000000010";
  const fundMissionId = "00000000-0000-0000-0000-000000000011";

  function createMockAdapter(overrides?: any) {
    const mockAdapter = {
      handleHermesToolCall: async (req: any) => {
        if (overrides?.handleHermesToolCall) {
          return overrides.handleHermesToolCall(req);
        }
        if (req.tool_name === "get_financial_summary") {
          return {
            success: true,
            channel: req.channel,
            tool_name: req.tool_name,
            status: "executed",
            data: { total_income: "150,000.00", total_expense: "50,000.00", net_income: "100,000.00" },
            correlation_id: "corr-1",
          };
        }
        if (req.tool_name === "propose_fund_transfer") {
          return {
            success: true,
            channel: req.channel,
            tool_name: req.tool_name,
            status: "requires_confirmation",
            code: "CONFIRMATION_REQUIRED",
            proposal: {
              proposal_id: "conf-123",
              action_type: "fund_transfer",
              title: "ข้อเสนอ: fund_transfer",
              summary: "โอนเงินจากกองทุนทั่วไป ไปยังกองทุนพันธกิจ",
              amount: "฿5000.00",
              financial_effect: "รายการนี้ยังไม่กระทบยอดเงิน",
              expires_at: new Date(Date.now() + 300000).toISOString(),
              confirmation_url: "https://ledger.grace.church/confirm?id=conf-123",
              payload_hash: "0".repeat(64),
              nonce: "nonce_1234567890123456",
              requires_human_confirmation: true,
            },
            correlation_id: "corr-2",
          };
        }
        if (req.tool_name === "execute_confirmed_action") {
          return {
            success: true,
            channel: req.channel,
            tool_name: req.tool_name,
            status: "executed",
            message: "บันทึกลงระบบบัญชีแยกประเภทเรียบร้อยแล้ว",
            correlation_id: "corr-3",
          };
        }
        return {
          success: false,
          channel: req.channel,
          tool_name: req.tool_name,
          status: "denied",
          message: "ไม่พบเครื่องมือนี้ในระบบ",
          correlation_id: "corr-err",
        };
      },
    };
    return mockAdapter as unknown as HermesGraceLedgerAdapter;
  }

  it("exposes approved financial tool definitions with valid schemas", () => {
    const adapter = createMockAdapter();
    const skill = new HermesGraceLedgerSkill(adapter);
    const tools = skill.getTools();

    expect(tools.length).toBeGreaterThanOrEqual(5);
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("gl_get_financial_summary");
    expect(toolNames).toContain("gl_get_fund_balance");
    expect(toolNames).toContain("gl_create_draft_transfer");
    expect(toolNames).toContain("gl_propose_fund_transfer");
    expect(toolNames).toContain("gl_confirm_action");
  });

  it("executes READ tool and returns formatted financial summary", async () => {
    const adapter = createMockAdapter();
    const skill = new HermesGraceLedgerSkill(adapter);
    const summaryTool = skill.getTools().find((t) => t.name === "gl_get_financial_summary")!;

    const result = await summaryTool.execute(
      { period: "2026-08" },
      { channel: "telegram", userId: dummyUserId, churchId: dummyChurchId }
    );

    expect(result).toContain("ข้อมูลทางการเงินจาก Grace Ledger");
    expect(result).toContain("150,000.00");
  });

  it("executes PROPOSAL tool and returns structured human confirmation card with link", async () => {
    const adapter = createMockAdapter();
    const skill = new HermesGraceLedgerSkill(adapter);
    const proposeTool = skill.getTools().find((t) => t.name === "gl_propose_fund_transfer")!;

    const result = await proposeTool.execute(
      { from_fund_id: fundGeneralId, to_fund_id: fundMissionId, amount: "5000.00", reason: "พันธกิจ" },
      { channel: "telegram", userId: dummyUserId, churchId: dummyChurchId }
    );

    expect(result).toContain("ต้องการการยืนยันจากมนุษย์ (ACTION PROPOSAL)");
    expect(result).toContain("฿5000.00");
    expect(result).toContain("https://ledger.grace.church/confirm?id=conf-123");
    expect(result).toContain("รายการนี้ยังไม่มีการเปลี่ยนแปลงยอดเงินในบัญชีจริง");
  });

  it("executes CONFIRM ACTION tool when valid confirmation parameters are provided", async () => {
    const adapter = createMockAdapter();
    const skill = new HermesGraceLedgerSkill(adapter);
    const confirmTool = skill.getTools().find((t) => t.name === "gl_confirm_action")!;

    const result = await confirmTool.execute(
      { confirmation_id: "conf-123", nonce: "nonce_1234567890123456", payload_hash: "0".repeat(64) },
      { channel: "telegram", userId: dummyUserId, churchId: dummyChurchId }
    );

    expect(result).toContain("ดำเนินการทางการเงินสำเร็จ");
    expect(result).toContain("บันทึกลงระบบบัญชีแยกประเภทเรียบร้อยแล้ว");
  });
});
