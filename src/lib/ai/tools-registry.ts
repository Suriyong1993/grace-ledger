import { z } from "zod";
import { AiToolDefinition } from "./types";

/**
 * =====================================================================
 * GRACE AI EXPLICIT TOOL REGISTRY (STATIC ALLOWLIST)
 * =====================================================================
 * Invariants:
 * 1. AI has NO EXECUTE capability.
 * 2. AI cannot generate dynamic tools or execute arbitrary SQL / RPC.
 * 3. All tools are strictly tenant-scoped (church_id bound).
 * 4. All action proposals strictly require human confirmation.
 * =====================================================================
 */

// 1. READ: Financial Summary
const GetFinancialSummaryTool: AiToolDefinition = {
  name: "get_financial_summary",
  description: "ดึงข้อมูลสรุปทางการเงินประจำเดือน (รายรับ, รายจ่าย, ยอดคงเหลือกองทุน)",
  capability: "READ",
  sensitiveDataLevel: "FINANCIAL",
  auditAction: "AI_READ_FINANCIAL_SUMMARY",
  requiresConfirmation: false,
  tenantScoped: true,
  allowedRoles: ["super_admin", "pastor", "treasurer", "finance_staff", "approver"],
  requiredPermissions: [{ action: "read", resource: "reports" }],
  inputSchema: z.object({
    church_id: z.string().uuid("รหัสคริสตจักรต้องเป็น UUID"),
    period: z.string().regex(/^\d{4}-\d{2}$/, "รูปแบบช่วงเวลาต้องเป็น YYYY-MM"),
  }),
  outputSchema: z.object({
    total_income: z.string(),
    total_expense: z.string(),
    net_cashflow: z.string(),
    total_funds_balance: z.string(),
    period: z.string(),
  }),
};

// 2. READ: Get Transactions
const GetTransactionsTool: AiToolDefinition = {
  name: "get_transactions",
  description: "ค้นหารายการธุรกรรมทางการเงินตามสถานะหรือช่วงเวลา",
  capability: "READ",
  sensitiveDataLevel: "FINANCIAL",
  auditAction: "AI_READ_TRANSACTIONS",
  requiresConfirmation: false,
  tenantScoped: true,
  allowedRoles: ["super_admin", "pastor", "treasurer", "finance_staff", "approver"],
  requiredPermissions: [{ action: "read", resource: "transactions" }],
  inputSchema: z.object({
    church_id: z.string().uuid("รหัสคริสตจักรต้องเป็น UUID"),
    status: z.enum(["draft", "pending_approval", "approved", "posted", "rejected", "voided"]).optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: z.number().int().positive().max(100).optional().default(20),
  }),
  outputSchema: z.object({
    transactions: z.array(z.any()),
    total_count: z.number(),
  }),
};

// 3. READ: Get Fund Balance
const GetFundBalanceTool: AiToolDefinition = {
  name: "get_fund_balance",
  description: "ดึงข้อมูลยอดคงเหลือปัจจุบันและงบประมาณของกองทุน",
  capability: "READ",
  sensitiveDataLevel: "FINANCIAL",
  auditAction: "AI_READ_FUNDS",
  requiresConfirmation: false,
  tenantScoped: true,
  allowedRoles: ["super_admin", "pastor", "treasurer", "finance_staff", "approver", "member"],
  requiredPermissions: [{ action: "read", resource: "funds" }],
  inputSchema: z.object({
    church_id: z.string().uuid("รหัสคริสตจักรต้องเป็น UUID"),
    fund_id: z.string().uuid().optional(),
  }),
  outputSchema: z.object({
    funds: z.array(
      z.object({
        fund_id: z.string(),
        name: z.string(),
        balance: z.string(),
        target_budget: z.string(),
      })
    ),
  }),
};

// 4. READ: Budget vs Actual
const GetBudgetVsActualTool: AiToolDefinition = {
  name: "get_budget_vs_actual",
  description: "เปรียบเทียบงบประมาณที่ตั้งไว้กับยอดรายรับ-รายจ่ายจริง",
  capability: "READ",
  sensitiveDataLevel: "FINANCIAL",
  auditAction: "AI_READ_BUDGET_COMPARISON",
  requiresConfirmation: false,
  tenantScoped: true,
  allowedRoles: ["super_admin", "pastor", "treasurer", "finance_staff"],
  requiredPermissions: [{ action: "read", resource: "budgets" }],
  inputSchema: z.object({
    church_id: z.string().uuid("รหัสคริสตจักรต้องเป็น UUID"),
    year: z.number().int().min(2000).max(2100),
  }),
  outputSchema: z.object({
    year: z.number(),
    items: z.array(z.any()),
  }),
};

// 5. READ: Transaction Audit Trail
const GetTransactionAuditTrailTool: AiToolDefinition = {
  name: "get_transaction_audit_trail",
  description: "ตรวจสอบประวัติการแก้ไขและการอนุมัติของรายการธุรกรรม",
  capability: "READ",
  sensitiveDataLevel: "FINANCIAL",
  auditAction: "AI_READ_AUDIT_TRAIL",
  requiresConfirmation: false,
  tenantScoped: true,
  allowedRoles: ["super_admin", "pastor", "treasurer"],
  requiredPermissions: [{ action: "read", resource: "audit_logs" }],
  inputSchema: z.object({
    church_id: z.string().uuid("รหัสคริสตจักรต้องเป็น UUID"),
    transaction_id: z.string().uuid("รหัสรายการธุรกรรมต้องเป็น UUID"),
  }),
  outputSchema: z.object({
    transaction_id: z.string(),
    logs: z.array(z.any()),
  }),
};

// 6. READ (SENSITIVE): Member Giving History (Privacy by Design)
const GetMemberGivingHistoryTool: AiToolDefinition = {
  name: "get_member_giving_history",
  description: "ดึงประวัติการถวายของสมาชิก (ข้อมูลความลับทางการเงินสูงสุด ต้องระบุเหตุผลในการเข้าถึง)",
  capability: "READ",
  sensitiveDataLevel: "SENSITIVE_FINANCIAL",
  auditAction: "AI_READ_CONFIDENTIAL_MEMBER_GIVING",
  requiresConfirmation: false,
  tenantScoped: true,
  allowedRoles: ["super_admin", "pastor", "treasurer"], // Restricted: Finance staff & others prohibited
  requiredPermissions: [{ action: "read", resource: "member_giving" }],
  inputSchema: z.object({
    church_id: z.string().uuid("รหัสคริสตจักรต้องเป็น UUID"),
    member_id: z.string().uuid("รหัสสมาชิกต้องเป็น UUID"),
    reason: z.string().trim().min(5, "ต้องระบุเหตุผลในการเข้าถึงข้อมูลการถวายอย่างน้อย 5 ตัวอักษร"),
    tax_year: z.number().int().optional(),
  }),
  outputSchema: z.object({
    member_id: z.string(),
    member_name: z.string(),
    records: z.array(z.any()),
    total_giving: z.string(),
  }),
};

// 7. DRAFT: Create Draft Transaction
const CreateDraftTransactionTool: AiToolDefinition = {
  name: "create_draft_transaction",
  description: "สร้างร่างรายการธุรกรรมใหม่ (สถานะ draft) เพื่อให้เจ้าหน้าที่ตรวจสอบ",
  capability: "DRAFT",
  sensitiveDataLevel: "FINANCIAL",
  auditAction: "AI_CREATE_DRAFT_TRANSACTION",
  requiresConfirmation: false,
  tenantScoped: true,
  allowedRoles: ["super_admin", "treasurer", "finance_staff"],
  requiredPermissions: [{ action: "create", resource: "transactions" }],
  inputSchema: z.object({
    church_id: z.string().uuid("รหัสคริสตจักรต้องเป็น UUID"),
    description: z.string().min(1, "กรุณาระบุรายละเอียดรายการ"),
    transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD"),
    category_id: z.string().uuid("รหัสหมวดหมู่ต้องเป็น UUID"),
    account_id: z.string().uuid("รหัสบัญชีต้องเป็น UUID"),
    amount: z.union([z.string(), z.number()]),
    splits: z
      .array(
        z.object({
          fund_id: z.string().uuid(),
          amount: z.union([z.string(), z.number()]),
          notes: z.string().optional(),
        })
      )
      .min(1),
  }),
  outputSchema: z.object({
    draft_transaction_id: z.string(),
    status: z.literal("draft"),
  }),
};

// 8. DRAFT: Create Transfer Draft
const CreateTransferDraftTool: AiToolDefinition = {
  name: "create_transfer_draft",
  description: "จัดเตรียมข้อเสนอการโอนเงินระหว่างกองทุนเพื่อตรวจสอบก่อนส่งอนุมัติ",
  capability: "DRAFT",
  sensitiveDataLevel: "FINANCIAL",
  auditAction: "AI_CREATE_TRANSFER_DRAFT",
  requiresConfirmation: false,
  tenantScoped: true,
  allowedRoles: ["super_admin", "treasurer", "finance_staff"],
  requiredPermissions: [{ action: "create", resource: "fund_transfers" }],
  inputSchema: z.object({
    church_id: z.string().uuid("รหัสคริสตจักรต้องเป็น UUID"),
    from_fund_id: z.string().uuid("รหัสกองทุนต้นทางต้องเป็น UUID"),
    to_fund_id: z.string().uuid("รหัสกองทุนปลายทางต้องเป็น UUID"),
    amount: z.union([z.string(), z.number()]),
    notes: z.string().min(5, "เหตุผลการโอนต้องมีความยาวอย่างน้อย 5 ตัวอักษร"),
  }),
  outputSchema: z.object({
    draft_summary: z.string(),
    from_fund_id: z.string(),
    to_fund_id: z.string(),
    amount: z.string(),
  }),
};

// 9. ACTION PROPOSAL: Propose Transaction Post
const ProposeTransactionPostTool: AiToolDefinition = {
  name: "propose_transaction_post",
  description: "สร้างข้อเสนอเพื่อขออนุมัติโพสต์รายการลงบัญชี (ต้องได้รับการยืนยันจากมนุษย์ก่อนดำเนินการ)",
  capability: "ACTION_PROPOSAL",
  sensitiveDataLevel: "FINANCIAL",
  auditAction: "AI_PROPOSE_TRANSACTION_POST",
  requiresConfirmation: true, // STRICT MANDATE
  tenantScoped: true,
  allowedRoles: ["super_admin", "treasurer"],
  requiredPermissions: [{ action: "update", resource: "transactions" }],
  inputSchema: z.object({
    church_id: z.string().uuid("รหัสคริสตจักรต้องเป็น UUID"),
    transaction_id: z.string().uuid("รหัสรายการธุรกรรมต้องเป็น UUID"),
    summary_justification: z.string().min(5, "เหตุผลข้อเสนอต้องมีความยาวอย่างน้อย 5 ตัวอักษร"),
  }),
  outputSchema: z.object({
    proposal_id: z.string(),
    action_type: z.literal("post_transaction"),
    requires_confirmation: z.literal(true),
    parameters: z.any(),
  }),
};

// 10. ACTION PROPOSAL: Propose Fund Transfer
const ProposeFundTransferTool: AiToolDefinition = {
  name: "propose_fund_transfer",
  description: "สร้างข้อเสนอเพื่อขออนุมัติโอนเงินระหว่างกองทุน (ต้องได้รับการยืนยันจากมนุษย์ก่อนดำเนินการ)",
  capability: "ACTION_PROPOSAL",
  sensitiveDataLevel: "FINANCIAL",
  auditAction: "AI_PROPOSE_FUND_TRANSFER",
  requiresConfirmation: true, // STRICT MANDATE
  tenantScoped: true,
  allowedRoles: ["super_admin", "treasurer"],
  requiredPermissions: [{ action: "create", resource: "fund_transfers" }],
  inputSchema: z.object({
    church_id: z.string().uuid("รหัสคริสตจักรต้องเป็น UUID"),
    from_fund_id: z.string().uuid("รหัสกองทุนต้นทางต้องเป็น UUID"),
    to_fund_id: z.string().uuid("รหัสกองทุนปลายทางต้องเป็น UUID"),
    amount: z.union([z.string(), z.number()]),
    reason: z.string().min(5, "เหตุผลการโอนต้องมีความยาวอย่างน้อย 5 ตัวอักษร"),
  }),
  outputSchema: z.object({
    proposal_id: z.string(),
    action_type: z.literal("fund_transfer"),
    requires_confirmation: z.literal(true),
    parameters: z.any(),
  }),
};

// 11. ACTION PROPOSAL: Propose Void Transaction
const ProposeVoidTransactionTool: AiToolDefinition = {
  name: "propose_void_transaction",
  description: "สร้างข้อเสนอเพื่อขอยกเลิกรายการที่โพสต์แล้ว (ต้องได้รับการยืนยันจากมนุษย์ก่อนดำเนินการ)",
  capability: "ACTION_PROPOSAL",
  sensitiveDataLevel: "FINANCIAL",
  auditAction: "AI_PROPOSE_VOID_TRANSACTION",
  requiresConfirmation: true, // STRICT MANDATE
  tenantScoped: true,
  allowedRoles: ["super_admin", "treasurer"],
  requiredPermissions: [{ action: "update", resource: "transactions" }],
  inputSchema: z.object({
    church_id: z.string().uuid("รหัสคริสตจักรต้องเป็น UUID"),
    transaction_id: z.string().uuid("รหัสรายการธุรกรรมต้องเป็น UUID"),
    void_reason: z.string().min(5, "เหตุผลการยกเลิกต้องมีความยาวอย่างน้อย 5 ตัวอักษร"),
  }),
  outputSchema: z.object({
    proposal_id: z.string(),
    action_type: z.literal("void_transaction"),
    requires_confirmation: z.literal(true),
    parameters: z.any(),
  }),
};

/**
 * Authoritative Static Tool Allowlist
 */
const APPROVED_TOOLS_LIST: ReadonlyArray<AiToolDefinition> = Object.freeze([
  GetFinancialSummaryTool,
  GetTransactionsTool,
  GetFundBalanceTool,
  GetBudgetVsActualTool,
  GetTransactionAuditTrailTool,
  GetMemberGivingHistoryTool,
  CreateDraftTransactionTool,
  CreateTransferDraftTool,
  ProposeTransactionPostTool,
  ProposeFundTransferTool,
  ProposeVoidTransactionTool,
]);

const APPROVED_TOOLS_MAP: ReadonlyMap<string, AiToolDefinition> = new Map(
  APPROVED_TOOLS_LIST.map((tool) => [tool.name, tool])
);

/**
 * Registry Lookup & Inspection Helpers
 */
export class GraceAiToolsRegistry {
  /**
   * Retrieves an approved tool definition by name.
   * Returns undefined for any unregistered or prohibited tool name.
   */
  public static getTool(name: string): AiToolDefinition | undefined {
    return APPROVED_TOOLS_MAP.get(name);
  }

  /**
   * Returns all approved tools in the allowlist.
   */
  public static getAllTools(): readonly AiToolDefinition[] {
    return APPROVED_TOOLS_LIST;
  }

  /**
   * Checks if a tool name is in the static approved allowlist.
   */
  public static isApproved(name: string): boolean {
    return APPROVED_TOOLS_MAP.has(name);
  }

  /**
   * Filter approved tools available for a given User Role
   */
  public static getToolsForRole(role: string): readonly AiToolDefinition[] {
    return APPROVED_TOOLS_LIST.filter((tool) => tool.allowedRoles.includes(role as any));
  }
}
