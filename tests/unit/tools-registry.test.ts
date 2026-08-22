import { describe, it, expect } from "vitest";
import { GraceAiToolsRegistry } from "../../src/lib/ai/tools-registry";
import { AiToolDefinition } from "../../src/lib/ai/types";

describe("Grace AI Tool Registry — Security & Capability Contract Tests", () => {
  const allTools = GraceAiToolsRegistry.getAllTools();

  describe("1. Static Allowlist & Inventory", () => {
    it("contains exactly the 11 authorized Grace AI tools", () => {
      expect(allTools).toHaveLength(11);

      const expectedToolNames = [
        // READ
        "get_financial_summary",
        "get_transactions",
        "get_fund_balance",
        "get_budget_vs_actual",
        "get_transaction_audit_trail",
        "get_member_giving_history",
        // DRAFT
        "create_draft_transaction",
        "create_transfer_draft",
        // ACTION PROPOSAL
        "propose_transaction_post",
        "propose_fund_transfer",
        "propose_void_transaction",
      ];

      for (const name of expectedToolNames) {
        expect(GraceAiToolsRegistry.isApproved(name)).toBe(true);
        expect(GraceAiToolsRegistry.getTool(name)).toBeDefined();
      }
    });

    it("DENIES and returns undefined for unknown, unregistered, or arbitrary tool names", () => {
      expect(GraceAiToolsRegistry.isApproved("execute_raw_sql")).toBe(false);
      expect(GraceAiToolsRegistry.getTool("execute_raw_sql")).toBeUndefined();
      expect(GraceAiToolsRegistry.isApproved("drop_tables")).toBe(false);
      expect(GraceAiToolsRegistry.isApproved("bypass_rls")).toBe(false);
      expect(GraceAiToolsRegistry.isApproved("delete_transaction")).toBe(false);
    });
  });

  describe("2. Strict Capability Boundaries & Security Invariants", () => {
    it("CRITICAL: Registry contains ZERO EXECUTE capabilities", () => {
      const executeTools = allTools.filter(
        (tool: AiToolDefinition) => (tool.capability as any) === "EXECUTE"
      );
      expect(executeTools).toHaveLength(0);

      const hasExecuteWordInName = allTools.filter((tool) =>
        tool.name.toLowerCase().includes("execute")
      );
      expect(hasExecuteWordInName).toHaveLength(0);
    });

    it("CRITICAL: Registry contains ZERO Raw SQL or Dynamic Table Access tools", () => {
      const sqlTools = allTools.filter(
        (tool) =>
          tool.name.toLowerCase().includes("sql") ||
          tool.name.toLowerCase().includes("query_db") ||
          tool.name.toLowerCase().includes("exec_rpc")
      );
      expect(sqlTools).toHaveLength(0);
    });

    it("CRITICAL: Registry contains ZERO dynamic tool definitions (Static Frozen Allowlist)", () => {
      expect(Object.isFrozen(allTools)).toBe(true);
    });

    it("enforces tenantScoped = true on 100% of approved tools", () => {
      for (const tool of allTools) {
        expect(tool.tenantScoped).toBe(true);
      }
    });
  });

  describe("3. Data Sensitivity & Proposal Confirmation Requirements", () => {
    it("classifies get_member_giving_history as SENSITIVE_FINANCIAL with restricted roles and justification", () => {
      const givingTool = GraceAiToolsRegistry.getTool("get_member_giving_history");
      expect(givingTool).toBeDefined();
      expect(givingTool?.sensitiveDataLevel).toBe("SENSITIVE_FINANCIAL");
      expect(givingTool?.allowedRoles).toEqual(["super_admin", "pastor", "treasurer"]);

      // Schema requires reason >= 5 chars
      const invalidInput = {
        church_id: "00000000-0000-0000-0000-000000000001",
        member_id: "00000000-0000-0000-0000-000000000002",
        reason: "ดู", // < 5 chars
      };
      const parseRes = givingTool?.inputSchema.safeParse(invalidInput);
      expect(parseRes?.success).toBe(false);

      const validInput = {
        church_id: "00000000-0000-0000-0000-000000000001",
        member_id: "00000000-0000-0000-0000-000000000002",
        reason: "ตรวจสอบข้อมูลเพื่อออกหนังสือรับรองภาษี",
      };
      const validParse = givingTool?.inputSchema.safeParse(validInput);
      expect(validParse?.success).toBe(true);
    });

    it("mandates requiresConfirmation = true for all ACTION_PROPOSAL tools", () => {
      const proposalTools = allTools.filter(
        (tool) => tool.capability === "ACTION_PROPOSAL"
      );

      expect(proposalTools).toHaveLength(3);
      for (const tool of proposalTools) {
        expect(tool.requiresConfirmation).toBe(true);
        expect(tool.name).toMatch(/^propose_/);
      }
    });

    it("verifies DRAFT tools create uncommitted drafts with requiresConfirmation = false", () => {
      const draftTools = allTools.filter((tool) => tool.capability === "DRAFT");
      expect(draftTools).toHaveLength(2);
      for (const tool of draftTools) {
        expect(tool.requiresConfirmation).toBe(false);
        expect(tool.name).toMatch(/^create_.*draft/);
      }
    });
  });

  describe("4. Runtime Zod Schema Validations", () => {
    it("validates create_draft_transaction input schema", () => {
      const draftTool = GraceAiToolsRegistry.getTool("create_draft_transaction")!;
      const invalid = {
        church_id: "not-a-uuid",
        description: "",
        transaction_date: "2026-13-45",
        category_id: "cat-1",
        account_id: "acc-1",
        amount: "1000",
        splits: [],
      };
      expect(draftTool.inputSchema.safeParse(invalid).success).toBe(false);

      const valid = {
        church_id: "00000000-0000-0000-0000-000000000001",
        description: "ค่าเครื่องเขียน",
        transaction_date: "2026-08-21",
        category_id: "00000000-0000-0000-0000-000000000002",
        account_id: "00000000-0000-0000-0000-000000000003",
        amount: "500.00",
        splits: [
          { fund_id: "00000000-0000-0000-0000-000000000004", amount: "500.00" },
        ],
      };
      expect(draftTool.inputSchema.safeParse(valid).success).toBe(true);
    });

    it("filters tools available by User Role correctly", () => {
      const memberTools = GraceAiToolsRegistry.getToolsForRole("member");
      const toolNames = memberTools.map((t) => t.name);

      // Member can only access general fund balance, cannot see giving records or create drafts/proposals
      expect(toolNames).toContain("get_fund_balance");
      expect(toolNames).not.toContain("get_member_giving_history");
      expect(toolNames).not.toContain("create_draft_transaction");
      expect(toolNames).not.toContain("propose_fund_transfer");
    });
  });
});
