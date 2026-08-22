import { describe, it, expect } from "vitest";
import { AI_TOOLS_REGISTRY, getAiTool } from "../../src/lib/ai/tools-registry";
import { can } from "../../src/lib/rbac";

describe("AI Tools Registry — Golden Rules", () => {
  it("only defines READ, DRAFT, or ACTION_PROPOSAL tools — no EXECUTE capability exists", () => {
    for (const tool of AI_TOOLS_REGISTRY) {
      expect(["READ", "DRAFT", "ACTION_PROPOSAL"]).toContain(tool.capability);
    }
  });

  it("every tool is tenant-scoped and has a non-empty audit category", () => {
    for (const tool of AI_TOOLS_REGISTRY) {
      expect(tool.tenantScoped).toBe(true);
      expect(tool.auditCategory.length).toBeGreaterThan(0);
    }
  });

  it("every tool's permission maps to a real RBAC resource/action for at least one role", () => {
    const roles = ["super_admin", "pastor", "treasurer", "finance_staff", "approver", "counter", "member"] as const;
    for (const tool of AI_TOOLS_REGISTRY) {
      const grantedToSomeone = roles.some((role) => can(role, tool.permission.action, tool.permission.resource));
      expect(grantedToSomeone, `${tool.name} permission is unreachable by any role`).toBe(true);
    }
  });

  it("proposal tools never carry the DRAFT or READ capability, and vice versa (no tool wears two hats)", () => {
    const proposalNames = AI_TOOLS_REGISTRY.filter((t) => t.capability === "ACTION_PROPOSAL").map((t) => t.name);
    expect(proposalNames).toEqual([
      "propose_transaction_post",
      "propose_fund_transfer",
      "propose_void_transaction",
    ]);
  });

  it("getAiTool rejects any name not in the registry (closed set, no dynamic tools)", () => {
    expect(getAiTool("drop_table_transactions")).toBeUndefined();
    expect(getAiTool("execute_raw_sql")).toBeUndefined();
    expect(getAiTool("get_fund_balance")).toBeDefined();
  });

  it("get_member_giving_history requires a reason of at least 5 characters via its schema", () => {
    const tool = getAiTool("get_member_giving_history")!;
    const badResult = tool.inputSchema.safeParse({ memberId: "11111111-1111-1111-1111-111111111111", reason: "ok" });
    expect(badResult.success).toBe(false);

    const goodResult = tool.inputSchema.safeParse({
      memberId: "11111111-1111-1111-1111-111111111111",
      reason: "ตรวจสอบตามคำร้องขอ",
    });
    expect(goodResult.success).toBe(true);
  });

  it("DRAFT tool schemas reject a payload missing required fields", () => {
    const tool = getAiTool("create_draft_transaction")!;
    const result = tool.inputSchema.safeParse({ amount: "100.00" });
    expect(result.success).toBe(false);
  });

  it("propose_fund_transfer schema does not accept churchId/userId as caller-supplied fields", () => {
    const tool = getAiTool("propose_fund_transfer")!;
    const shape = (tool.inputSchema as any)._def.shape();
    expect(shape.churchId).toBeUndefined();
    expect(shape.userId).toBeUndefined();
  });
});
