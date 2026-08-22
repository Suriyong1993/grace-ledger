import { z } from "zod";
import { AiToolDefinition } from "./types";

/**
 * The complete, closed set of tools Grace AI may call. This list is the
 * enforcement boundary: a tool executor must reject any tool name not
 * present here, and must never construct SQL or a tool definition at
 * runtime. Nothing below has EXECUTE capability — READ tools only return
 * data, DRAFT tools only prepare a draft row, ACTION_PROPOSAL tools only
 * prepare a proposal a human must separately confirm.
 */

const uuid = z.string().uuid();

// ---- READ ----

const getFinancialSummary: AiToolDefinition<{ periodFrom: string; periodTo: string }> = {
  name: "get_financial_summary",
  capability: "READ",
  description: "สรุปภาพรวมการเงินของโบสถ์ในช่วงเวลาที่ระบุ",
  inputSchema: z.object({ periodFrom: z.string(), periodTo: z.string() }),
  permission: { resource: "reports", action: "read" },
  sensitiveDataClassification: "none",
  tenantScoped: true,
  auditCategory: "AI_READ_FINANCIAL_SUMMARY",
};

const getTransactions: AiToolDefinition<{ periodFrom?: string; periodTo?: string; status?: string }> = {
  name: "get_transactions",
  capability: "READ",
  description: "รายการธุรกรรมทางการเงิน กรองตามช่วงเวลาและสถานะ",
  inputSchema: z.object({
    periodFrom: z.string().optional(),
    periodTo: z.string().optional(),
    status: z.string().optional(),
  }),
  permission: { resource: "transactions", action: "read" },
  sensitiveDataClassification: "none",
  tenantScoped: true,
  auditCategory: "AI_READ_TRANSACTIONS",
};

const getFundBalance: AiToolDefinition<{ fundId?: string }> = {
  name: "get_fund_balance",
  capability: "READ",
  description: "ยอดคงเหลือของกองทุน หนึ่งกองทุนหรือทั้งหมด",
  inputSchema: z.object({ fundId: uuid.optional() }),
  permission: { resource: "funds", action: "read" },
  sensitiveDataClassification: "none",
  tenantScoped: true,
  auditCategory: "AI_READ_FUND_BALANCE",
};

const getBudgetVsActual: AiToolDefinition<{ fundId?: string; periodFrom: string; periodTo: string }> = {
  name: "get_budget_vs_actual",
  capability: "READ",
  description: "เปรียบเทียบงบประมาณกับยอดใช้จ่ายจริงของกองทุน",
  inputSchema: z.object({ fundId: uuid.optional(), periodFrom: z.string(), periodTo: z.string() }),
  permission: { resource: "budgets", action: "read" },
  sensitiveDataClassification: "none",
  tenantScoped: true,
  auditCategory: "AI_READ_BUDGET_VS_ACTUAL",
};

const getTransactionAuditTrail: AiToolDefinition<{ transactionId: string }> = {
  name: "get_transaction_audit_trail",
  capability: "READ",
  description: "ประวัติการเปลี่ยนสถานะและการอนุมัติของธุรกรรมหนึ่งรายการ",
  inputSchema: z.object({ transactionId: uuid }),
  permission: { resource: "audit_logs", action: "read" },
  sensitiveDataClassification: "audit",
  tenantScoped: true,
  auditCategory: "AI_READ_AUDIT_TRAIL",
};

const getMemberGivingHistory: AiToolDefinition<{ memberId: string; reason: string }> = {
  name: "get_member_giving_history",
  capability: "READ",
  description: "ประวัติการถวายของสมาชิกรายบุคคล ต้องระบุเหตุผลในการเข้าถึง",
  inputSchema: z.object({ memberId: uuid, reason: z.string().min(5) }),
  permission: { resource: "member_giving", action: "read" },
  sensitiveDataClassification: "giving",
  tenantScoped: true,
  auditCategory: "AI_READ_MEMBER_GIVING",
};

// ---- DRAFT ----
// Draft tools only ever produce a transaction in status = 'draft'. A draft
// has no effect on any fund balance — only post_transaction (a proposal +
// human-confirmed action, never callable from a DRAFT tool) can do that.

const createDraftTransaction: AiToolDefinition<{
  amount: string;
  direction: "income" | "expense";
  description: string;
  fundId: string;
  categoryId?: string;
}> = {
  name: "create_draft_transaction",
  capability: "DRAFT",
  description: "เตรียมร่างธุรกรรม (draft) ยังไม่มีผลต่อยอดกองทุน",
  inputSchema: z.object({
    amount: z.string(),
    direction: z.enum(["income", "expense"]),
    description: z.string().min(1),
    fundId: uuid,
    categoryId: uuid.optional(),
  }),
  permission: { resource: "transactions", action: "create" },
  sensitiveDataClassification: "none",
  tenantScoped: true,
  auditCategory: "AI_DRAFT_TRANSACTION",
};

const createTransferDraft: AiToolDefinition<{
  fromFundId: string;
  toFundId: string;
  amount: string;
  note?: string;
}> = {
  name: "create_transfer_draft",
  capability: "DRAFT",
  description: "เตรียมร่างการโอนเงินระหว่างกองทุน ยังไม่มีผลต่อยอดกองทุน",
  inputSchema: z.object({
    fromFundId: uuid,
    toFundId: uuid,
    amount: z.string(),
    note: z.string().optional(),
  }),
  permission: { resource: "fund_transfers", action: "create" },
  sensitiveDataClassification: "none",
  tenantScoped: true,
  auditCategory: "AI_DRAFT_TRANSFER",
};

// ---- ACTION_PROPOSAL ----
// A proposal tool never mutates financial state. It only prepares the exact
// action + a server-backed confirmation reference for a human to confirm
// through the (not-yet-built) confirmation flow and financial action
// endpoint. AI cannot execute any of these itself.

const proposeTransactionPost: AiToolDefinition<{ transactionId: string }> = {
  name: "propose_transaction_post",
  capability: "ACTION_PROPOSAL",
  description: "เสนอให้บันทึกธุรกรรมลงบัญชีแยกประเภท ต้องได้รับการยืนยันจากมนุษย์",
  inputSchema: z.object({ transactionId: uuid }),
  permission: { resource: "transactions", action: "approve" },
  sensitiveDataClassification: "none",
  tenantScoped: true,
  auditCategory: "AI_PROPOSE_TRANSACTION_POST",
};

const proposeFundTransfer: AiToolDefinition<{
  fromFundId: string;
  toFundId: string;
  amount: string;
  note?: string;
}> = {
  name: "propose_fund_transfer",
  capability: "ACTION_PROPOSAL",
  description: "เสนอให้โอนเงินระหว่างกองทุน ต้องได้รับการยืนยันจากมนุษย์",
  inputSchema: z.object({
    fromFundId: uuid,
    toFundId: uuid,
    amount: z.string(),
    note: z.string().optional(),
  }),
  permission: { resource: "fund_transfers", action: "approve" },
  sensitiveDataClassification: "none",
  tenantScoped: true,
  auditCategory: "AI_PROPOSE_FUND_TRANSFER",
};

const proposeVoidTransaction: AiToolDefinition<{ transactionId: string; reason: string }> = {
  name: "propose_void_transaction",
  capability: "ACTION_PROPOSAL",
  description: "เสนอให้ยกเลิกธุรกรรมด้วยรายการกลับรายการ (reversal) ต้องได้รับการยืนยันจากมนุษย์",
  inputSchema: z.object({ transactionId: uuid, reason: z.string().min(5) }),
  permission: { resource: "transactions", action: "approve" },
  sensitiveDataClassification: "none",
  tenantScoped: true,
  auditCategory: "AI_PROPOSE_VOID_TRANSACTION",
};

export const AI_TOOLS_REGISTRY: ReadonlyArray<AiToolDefinition<any>> = [
  getFinancialSummary,
  getTransactions,
  getFundBalance,
  getBudgetVsActual,
  getTransactionAuditTrail,
  getMemberGivingHistory,
  createDraftTransaction,
  createTransferDraft,
  proposeTransactionPost,
  proposeFundTransfer,
  proposeVoidTransaction,
];

export function getAiTool(name: string): AiToolDefinition<any> | undefined {
  return AI_TOOLS_REGISTRY.find((tool) => tool.name === name);
}
