/**
 * Grace Ledger — Hermes Agent Gateway API Adapter
 * 
 * Boundary Contract:
 * - Hermes acts strictly as Messaging Transport & Agent Orchestrator.
 * - Grace Ledger remains the sole Financial Authority and Authorization Boundary.
 * - Zero direct database, RPC, or secret access is granted to Hermes.
 * - All Hermes tool calls route strictly through SecureAiToolExecutor or FinancialActionExecutionService.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { SecureAiToolExecutor } from "../ai/secure-tool-executor";
import { FinancialActionExecutionService } from "../ai/financial-action-endpoint";

export interface HermesToolRequest {
  channel: "telegram" | "api" | "hermes_internal";
  session_user_id: string;
  session_church_id: string;
  tool_name: string;
  parameters: Record<string, any>;
  correlation_id?: string;
}

export interface HermesToolResponse {
  success: boolean;
  channel: string;
  tool_name: string;
  status: "executed" | "denied" | "requires_confirmation" | "error";
  code?: string;
  message?: string;
  data?: any;
  proposal?: {
    proposal_id: string;
    action_type: string;
    title: string;
    summary: string;
    amount: string;
    financial_effect: string;
    expires_at: string;
    confirmation_url: string;
    payload_hash: string;
    nonce: string;
    requires_human_confirmation: true;
  } | null;
  denial_reason?: string;
  correlation_id: string;
}

export class HermesGraceLedgerAdapter {
  private supabase: SupabaseClient;
  private executor: SecureAiToolExecutor;
  private executionService: FinancialActionExecutionService;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.executor = new SecureAiToolExecutor(supabase);
    this.executionService = new FinancialActionExecutionService(supabase);
  }

  /**
   * Dispatches a tool request from Hermes through Grace Ledger security boundary.
   */
  public async handleHermesToolCall(request: HermesToolRequest): Promise<HermesToolResponse> {
    const correlationId = request.correlation_id || `hermes-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // 1. Mandatory Identity and Tenant Validation
    if (!request.session_user_id || !request.session_church_id) {
      return {
        success: false,
        channel: request.channel,
        tool_name: request.tool_name,
        status: "denied",
        code: "UNAUTHORIZED_HERMES_SESSION",
        message: "ไม่พบข้อมูลผู้ใช้หรือคริสตจักรที่ยืนยันตัวตนแล้วจาก Hermes Gateway",
        denial_reason: "Missing session_user_id or session_church_id in Hermes request",
        correlation_id: correlationId,
      };
    }

    // 2. Resolve User Profile & Role from Server (Never trust client claims)
    const { data: profile, error: profileErr } = await (this.supabase
      .from("profiles") as any)
      .select("id, church_id, role")
      .eq("id", request.session_user_id)
      .single();

    if (profileErr || !profile || profile.church_id !== request.session_church_id) {
      return {
        success: false,
        channel: request.channel,
        tool_name: request.tool_name,
        status: "denied",
        code: "CROSS_TENANT_OR_USER_MISMATCH",
        message: "การยืนยันตัวตนของผู้ใช้ไม่ตรงกับคริสตจักรในระบบบัญชี",
        denial_reason: "Profile resolution failed or tenant mismatch detected",
        correlation_id: correlationId,
      };
    }

    // 3. Handle Special Execution Tool Call (Human Confirmed Action)
    if (request.tool_name === "execute_confirmed_action") {
      const { confirmation_id, nonce, payload_hash, idempotency_key } = request.parameters || {};
      if (!confirmation_id || !nonce || !payload_hash) {
        return {
          success: false,
          channel: request.channel,
          tool_name: request.tool_name,
          status: "denied",
          code: "INVALID_CONFIRMATION_PARAMETERS",
          message: "ข้อมูลสำหรับการยืนยันการดำเนินการไม่ครบถ้วน",
          denial_reason: "Missing confirmation_id, nonce, or payload_hash",
          correlation_id: correlationId,
        };
      }

      const execResult = await this.executionService.executeAction({
        confirmation_id,
        nonce,
        payload_hash,
        idempotency_key,
      });

      return {
        success: execResult.success,
        channel: request.channel,
        tool_name: request.tool_name,
        status: execResult.success ? "executed" : "denied",
        code: execResult.code,
        message: execResult.message,
        data: {
          action: execResult.action,
          resource_id: execResult.resource_id,
          is_replay: execResult.is_replay,
        },
        correlation_id: correlationId,
      };
    }

    // 4. Dispatch through SecureAiToolExecutor
    // Parameters are injected with verified server church_id
    const safeParams: Record<string, any> = {
      ...request.parameters,
      church_id: profile.church_id,
    };

    const toolResult = await this.executor.executeTool({
      toolName: request.tool_name,
      parameters: safeParams,
      context: {
        churchId: profile.church_id,
        correlationId,
      },
    });

    if (!toolResult.success) {
      return {
        success: false,
        channel: request.channel,
        tool_name: request.tool_name,
        status: toolResult.status,
        code: toolResult.code,
        message: toolResult.error || "การดำเนินการไม่สำเร็จตามนโยบายความปลอดภัย",
        denial_reason: toolResult.denial_reason,
        correlation_id: correlationId,
      };
    }

    // 5. Handle ACTION_PROPOSAL tools formatting for Hermes/Telegram
    if (toolResult.data?.requires_confirmation === true && toolResult.data?.proposal_id) {
      const proposalId = toolResult.data.proposal_id;
      const { data: conf } = await (this.supabase
        .from("action_confirmations") as any)
        .select("id, payload_hash, nonce, expires_at, action, normalized_parameters")
        .eq("id", proposalId)
        .single();

      const confUrl = `https://ledger.grace.church/confirm?id=${proposalId}&nonce=${conf?.nonce || ""}&hash=${conf?.payload_hash || ""}`;
      const amountVal = safeParams.amount ? `฿${safeParams.amount}` : "-";

      return {
        success: true,
        channel: request.channel,
        tool_name: request.tool_name,
        status: "requires_confirmation",
        code: "CONFIRMATION_REQUIRED",
        message: "สร้างข้อเสนอการดำเนินการเรียบร้อยแล้ว ต้องการการยืนยันจากผู้มีอำนาจก่อนมีผลทางการเงิน",
        proposal: {
          proposal_id: proposalId,
          action_type: conf?.action || toolResult.data.action_type,
          title: `ข้อเสนอ: ${conf?.action || toolResult.data.action_type}`,
          summary: `กรุณาตรวจสอบรายละเอียดรายการและกดยืนยันผ่านลิงก์หรือปุ่มยืนยัน`,
          amount: amountVal,
          financial_effect: "รายการนี้ยังไม่กระทบยอดเงินในบัญชีจนกว่าจะได้รับการกดยืนยัน",
          expires_at: conf?.expires_at || new Date(Date.now() + 300000).toISOString(),
          confirmation_url: confUrl,
          payload_hash: conf?.payload_hash || "",
          nonce: conf?.nonce || "",
          requires_human_confirmation: true,
        },
        correlation_id: correlationId,
      };
    }

    // 6. Return successful READ or DRAFT result
    return {
      success: true,
      channel: request.channel,
      tool_name: request.tool_name,
      status: "executed",
      code: "SUCCESS",
      data: toolResult.data,
      correlation_id: correlationId,
    };
  }
}
