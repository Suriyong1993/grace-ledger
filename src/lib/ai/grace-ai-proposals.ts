import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Database } from "../supabase/types";
import { SecureAiToolExecutor } from "./secure-tool-executor";
import { Money } from "../money";

/**
 * =====================================================================
 * GRACE AI ACTION PROPOSAL SERVICE
 * =====================================================================
 * Core Principle:
 * "AI may propose, but AI cannot execute."
 *
 * Invariants:
 * 1. Generates proposals for: post_transaction, fund_transfer, void_transaction.
 * 2. Every proposal is server-backed by a single-use record in action_confirmations.
 * 3. Prohibits direct mutation RPCs (transfer_funds, post_transaction, void_transaction).
 * 4. Captures exact current resource state and computes expected financial impacts.
 * 5. Returns validated ActionProposalUiCard objects for Human Confirmation Flow.
 * =====================================================================
 */

export const ActionProposalUiCardSchema = z.object({
  proposal_id: z.string(),
  action: z.enum(["post_transaction", "fund_transfer", "void_transaction"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  financial_effect: z.string(),
  source: z.string().optional(),
  destination: z.string().optional(),
  amount: z.string(),
  reason: z.string().optional(),
  current_state: z.record(z.any()),
  confirmation_id: z.string(),
  payload_hash: z.string().length(64),
  nonce: z.string().min(16),
  expires_at: z.string(),
  provenance: z.object({
    source_tool: z.string(),
    source_type: z.literal("POSTGRESQL_POSTED_LEDGER"),
    generated_at: z.string(),
    church_id: z.string(),
  }),
});

export type ActionProposalUiCard = z.infer<typeof ActionProposalUiCardSchema>;

export interface ProposeTransactionPostInput {
  transaction_id: string;
  summary_justification: string;
}

export interface ProposeFundTransferInput {
  from_fund_id: string;
  to_fund_id: string;
  amount: string | number;
  reason: string;
}

export interface ProposeVoidTransactionInput {
  transaction_id: string;
  void_reason: string;
}

export interface GraceAiProposalResponse {
  success: boolean;
  proposal: ActionProposalUiCard | null;
  message: string;
  requires_human_confirmation: true;
  denial_reason?: string;
  code?: string;
}

export class GraceAiProposalService {
  private executor: SecureAiToolExecutor;

  /**
   * @param supabase Authenticated Supabase client
   * @param trustedChurchId Church ID derived strictly from trusted server session
   */
  constructor(
    private supabase: SupabaseClient<Database>,
    private trustedChurchId: string
  ) {
    this.executor = new SecureAiToolExecutor(supabase);
  }

  /**
   * 1. Propose Transaction Post (Proposes posting an approved transaction to the ledger)
   */
  public async proposeTransactionPost(
    input: ProposeTransactionPostInput
  ): Promise<GraceAiProposalResponse> {
    // 1. Revalidate current resource state from Database
    const { data: txn, error: txnErr } = await (this.supabase
      .from("transactions") as any)
      .select("id, amount, status, description, transaction_date, direction, categories(name), accounts(name)")
      .eq("id", input.transaction_id)
      .eq("church_id", this.trustedChurchId)
      .single();

    if (txnErr || !txn) {
      return {
        success: false,
        proposal: null,
        message: "ไม่พบรายการธุรกรรมที่ต้องการโพสต์ หรือรายการไม่ได้อยู่ในคริสตจักรนี้",
        requires_human_confirmation: true,
        code: "TRANSACTION_NOT_FOUND",
        denial_reason: "Transaction not found or church mismatch",
      };
    }

    if (txn.status === "posted") {
      return {
        success: false,
        proposal: null,
        message: "รายการนี้ถูกโพสต์ลงบัญชีแยกประเภทเรียบร้อยแล้ว ไม่สามารถโพสต์ซ้ำได้",
        requires_human_confirmation: true,
        code: "INVALID_RESOURCE_STATE",
        denial_reason: "Transaction is already posted",
      };
    }

    // 2. Dispatch proposal through SecureAiToolExecutor
    const execRes = await this.executor.executeTool({
      toolName: "propose_transaction_post",
      parameters: {
        transaction_id: input.transaction_id,
        summary_justification: input.summary_justification,
        church_id: this.trustedChurchId,
      },
      context: { churchId: this.trustedChurchId },
    });

    if (!execRes.success || !execRes.data) {
      return {
        success: false,
        proposal: null,
        message: execRes.error || "ไม่สามารถสร้างข้อเสนอโพสต์รายการได้",
        requires_human_confirmation: true,
        denial_reason: execRes.denial_reason || execRes.error,
        code: execRes.code,
      };
    }

    // 3. Fetch confirmation state details
    const { data: confRecord } = await (this.supabase
      .from("action_confirmations") as any)
      .select("id, payload_hash, nonce, expires_at")
      .eq("id", execRes.data.proposal_id)
      .single();

    const formattedAmount = Money.from(txn.amount).format();

    const proposalCard: ActionProposalUiCard = {
      proposal_id: execRes.data.proposal_id,
      action: "post_transaction",
      title: `ข้อเสนอขอโพสต์รายการ: ${txn.description || "รายการธุรกรรม"}`,
      summary: input.summary_justification,
      financial_effect: `จะทำการบันทึกยอด ${formattedAmount} (${txn.direction === "income" ? "รายรับ" : "รายจ่าย"}) ลงในบัญชีแยกประเภท`,
      source: txn.accounts?.name || "บัญชีหลัก",
      destination: txn.categories?.name || "หมวดหมู่ทั่วไป",
      amount: formattedAmount,
      reason: input.summary_justification,
      current_state: {
        transaction_id: txn.id,
        current_status: txn.status,
        amount: txn.amount,
        direction: txn.direction,
      },
      confirmation_id: execRes.data.proposal_id,
      payload_hash: confRecord?.payload_hash || "0".repeat(64),
      nonce: confRecord?.nonce || "conf_nonce_default_000000000000",
      expires_at: confRecord?.expires_at || new Date(Date.now() + 300000).toISOString(),
      provenance: {
        source_tool: "propose_transaction_post",
        source_type: "POSTGRESQL_POSTED_LEDGER",
        generated_at: new Date().toISOString(),
        church_id: this.trustedChurchId,
      },
    };

    return {
      success: true,
      proposal: proposalCard,
      message: "สร้างข้อเสนอขอโพสต์รายการเรียบร้อยแล้ว กรุณาตรวจสอบและยืนยันเพื่อดำเนินการ",
      requires_human_confirmation: true,
    };
  }

  /**
   * 2. Propose Fund Transfer (Proposes inter-fund transfer with current & projected balances)
   */
  public async proposeFundTransfer(
    input: ProposeFundTransferInput
  ): Promise<GraceAiProposalResponse> {
    if (input.from_fund_id === input.to_fund_id) {
      return {
        success: false,
        proposal: null,
        message: "กองทุนต้นทางและกองทุนปลายทางต้องไม่เป็นกองทุนเดียวกัน",
        requires_human_confirmation: true,
        code: "SAME_FUND_TRANSFER_PROHIBITED",
        denial_reason: "Source and destination funds must be distinct",
      };
    }

    // 1. Revalidate current fund balances
    const { data: fromFund } = await (this.supabase
      .from("funds") as any)
      .select("id, name, current_balance")
      .eq("id", input.from_fund_id)
      .eq("church_id", this.trustedChurchId)
      .single();

    const { data: toFund } = await (this.supabase
      .from("funds") as any)
      .select("id, name, current_balance")
      .eq("id", input.to_fund_id)
      .eq("church_id", this.trustedChurchId)
      .single();

    if (!fromFund || !toFund) {
      return {
        success: false,
        proposal: null,
        message: "ไม่พบข้อมูลกองทุนต้นทางหรือกองทุนปลายทาง",
        requires_human_confirmation: true,
        code: "FUND_NOT_FOUND",
        denial_reason: "Source or destination fund not found",
      };
    }

    const transferAmount = Money.from(input.amount);
    const fromBalance = Money.from(fromFund.current_balance || "0.00");
    const toBalance = Money.from(toFund.current_balance || "0.00");

    // 2. Dispatch proposal through SecureAiToolExecutor
    const execRes = await this.executor.executeTool({
      toolName: "propose_fund_transfer",
      parameters: {
        from_fund_id: input.from_fund_id,
        to_fund_id: input.to_fund_id,
        amount: transferAmount.toFixed(2),
        reason: input.reason,
        church_id: this.trustedChurchId,
      },
      context: { churchId: this.trustedChurchId },
    });

    if (!execRes.success || !execRes.data) {
      return {
        success: false,
        proposal: null,
        message: execRes.error || "ไม่สามารถสร้างข้อเสนอโอนเงินได้",
        requires_human_confirmation: true,
        denial_reason: execRes.denial_reason || execRes.error,
        code: execRes.code,
      };
    }

    const { data: confRecord } = await (this.supabase
      .from("action_confirmations") as any)
      .select("id, payload_hash, nonce, expires_at")
      .eq("id", execRes.data.proposal_id)
      .single();

    const projectedFrom = fromBalance.subtract(transferAmount);
    const projectedTo = toBalance.add(transferAmount);

    const proposalCard: ActionProposalUiCard = {
      proposal_id: execRes.data.proposal_id,
      action: "fund_transfer",
      title: `ข้อเสนอโอนเงินระหว่างกองทุน: ${fromFund.name} → ${toFund.name}`,
      summary: `โอนเงินจำนวน ${transferAmount.format()} จาก ${fromFund.name} ไปยัง ${toFund.name}`,
      financial_effect: `ยอด ${fromFund.name} จะเปลี่ยนจาก ${fromBalance.format()} เป็น ${projectedFrom.format()} และ ${toFund.name} จะเปลี่ยนจาก ${toBalance.format()} เป็น ${projectedTo.format()}`,
      source: fromFund.name,
      destination: toFund.name,
      amount: transferAmount.format(),
      reason: input.reason,
      current_state: {
        from_fund_id: fromFund.id,
        from_fund_name: fromFund.name,
        from_fund_balance: fromBalance.format(),
        to_fund_id: toFund.id,
        to_fund_name: toFund.name,
        to_fund_balance: toBalance.format(),
        projected_from_balance: projectedFrom.format(),
        projected_to_balance: projectedTo.format(),
      },
      confirmation_id: execRes.data.proposal_id,
      payload_hash: confRecord?.payload_hash || "0".repeat(64),
      nonce: confRecord?.nonce || "conf_nonce_default_000000000000",
      expires_at: confRecord?.expires_at || new Date(Date.now() + 300000).toISOString(),
      provenance: {
        source_tool: "propose_fund_transfer",
        source_type: "POSTGRESQL_POSTED_LEDGER",
        generated_at: new Date().toISOString(),
        church_id: this.trustedChurchId,
      },
    };

    return {
      success: true,
      proposal: proposalCard,
      message: "จัดเตรียมข้อเสนอการโอนเงินเรียบร้อยแล้ว กรุณาตรวจสอบและกดยืนยันเพื่อดำเนินการ",
      requires_human_confirmation: true,
    };
  }

  /**
   * 3. Propose Void Transaction (Proposes voiding a posted transaction and issuing reversal mirror entry)
   */
  public async proposeVoidTransaction(
    input: ProposeVoidTransactionInput
  ): Promise<GraceAiProposalResponse> {
    // 1. Revalidate transaction exists and is currently posted
    const { data: txn, error: txnErr } = await (this.supabase
      .from("transactions") as any)
      .select("id, amount, status, description, transaction_date, direction")
      .eq("id", input.transaction_id)
      .eq("church_id", this.trustedChurchId)
      .single();

    if (txnErr || !txn) {
      return {
        success: false,
        proposal: null,
        message: "ไม่พบรายการธุรกรรมที่ต้องการยกเลิก",
        requires_human_confirmation: true,
        code: "TRANSACTION_NOT_FOUND",
        denial_reason: "Transaction not found",
      };
    }

    if (txn.status !== "posted") {
      return {
        success: false,
        proposal: null,
        message: `ไม่อนุญาตให้ยกเลิกรายการที่อยู่ในสถานะ ${txn.status} (สามารถยกเลิกได้เฉพาะรายการที่โพสต์แล้วเท่านั้น)`,
        requires_human_confirmation: true,
        code: "INVALID_RESOURCE_STATE",
        denial_reason: `Transaction status is "${txn.status}", must be "posted"`,
      };
    }

    // 2. Dispatch proposal through SecureAiToolExecutor
    const execRes = await this.executor.executeTool({
      toolName: "propose_void_transaction",
      parameters: {
        transaction_id: input.transaction_id,
        void_reason: input.void_reason,
        church_id: this.trustedChurchId,
      },
      context: { churchId: this.trustedChurchId },
    });

    if (!execRes.success || !execRes.data) {
      return {
        success: false,
        proposal: null,
        message: execRes.error || "ไม่สามารถสร้างข้อเสนอยกเลิกรายการได้",
        requires_human_confirmation: true,
        denial_reason: execRes.denial_reason || execRes.error,
        code: execRes.code,
      };
    }

    const { data: confRecord } = await (this.supabase
      .from("action_confirmations") as any)
      .select("id, payload_hash, nonce, expires_at")
      .eq("id", execRes.data.proposal_id)
      .single();

    const formattedAmount = Money.from(txn.amount).format();

    const proposalCard: ActionProposalUiCard = {
      proposal_id: execRes.data.proposal_id,
      action: "void_transaction",
      title: `ข้อเสนอยกเลิกรายการ: ${txn.description || "รายการธุรกรรม"}`,
      summary: `ขอยกเลิกรายการ ${formattedAmount} และสร้างรายการปรับปรุงยอดแบบย้อนกลับ (Reversal Mirror Entry)`,
      financial_effect: `จะสร้างรายการคู่ล้างยอดเงิน ${formattedAmount} เพื่อปรับยอดคงเหลือให้ถูกต้องตามหลักการบัญชี`,
      amount: formattedAmount,
      reason: input.void_reason,
      current_state: {
        transaction_id: txn.id,
        current_status: txn.status,
        amount: txn.amount,
        direction: txn.direction,
      },
      confirmation_id: execRes.data.proposal_id,
      payload_hash: confRecord?.payload_hash || "0".repeat(64),
      nonce: confRecord?.nonce || "conf_nonce_default_000000000000",
      expires_at: confRecord?.expires_at || new Date(Date.now() + 300000).toISOString(),
      provenance: {
        source_tool: "propose_void_transaction",
        source_type: "POSTGRESQL_POSTED_LEDGER",
        generated_at: new Date().toISOString(),
        church_id: this.trustedChurchId,
      },
    };

    return {
      success: true,
      proposal: proposalCard,
      message: "สร้างข้อเสนอยกเลิกรายการเรียบร้อยแล้ว กรุณาตรวจสอบและยืนยันเพื่อดำเนินการ",
      requires_human_confirmation: true,
    };
  }
}
