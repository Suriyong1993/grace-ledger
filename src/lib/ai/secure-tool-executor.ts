import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../supabase/types";
import { UserRole, can } from "../rbac";
import { GraceAiToolsRegistry } from "./tools-registry";
import { AiToolDefinition } from "./types";
import { ActionConfirmationEngine } from "./confirmation-engine";
import { Money } from "../money";

/**
 * =====================================================================
 * SECURE AI TOOL EXECUTOR
 * =====================================================================
 * Enforces Zero-Trust Boundary for all Grace AI capabilities:
 * 1. AI has NO EXECUTE capability.
 * 2. All inputs, prompts, OCR texts, and descriptions are UNTRUSTED DATA.
 * 3. Server-side Authorization derived from auth.uid() (Client/AI roles rejected).
 * 4. Tenant isolation strictly bound to church_id.
 * 5. Sensitive data (Giving History) protected by multi-layer verification.
 * 6. Dual-Actor Audit Logging generated for SUCCESS, DENY, and ERROR.
 * =====================================================================
 */

export interface ToolExecutionContext {
  churchId: string;
  correlationId?: string;
  aiAgentId?: string;
}

export interface ToolExecutionRequest {
  toolName: string;
  parameters: Record<string, any>;
  context: ToolExecutionContext;
}

export interface ToolExecutionResult<T = any> {
  success: boolean;
  status: "executed" | "denied" | "error";
  data?: T;
  error?: string;
  code?: string;
  denial_reason?: string;
  audit_id?: string;
}

export class SecureAiToolExecutor {
  public static readonly TRUSTED_AI_AGENT_ID = "grace_ai_v1";
  private confirmationEngine: ActionConfirmationEngine;

  constructor(private supabase: SupabaseClient<Database>) {
    this.confirmationEngine = new ActionConfirmationEngine(supabase);
  }

  /**
   * Main Dispatcher for AI Tool Execution
   */
  public async executeTool(
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult> {
    const correlationId = request.context.correlationId || "corr_" + crypto.randomUUID().replace(/-/g, "");
    // RULE 1: ai_agent_id is strictly a server-defined identity constant. Client inputs are ignored.
    const aiAgentId = SecureAiToolExecutor.TRUSTED_AI_AGENT_ID;

    let tool: AiToolDefinition | undefined;
    let authenticatedUserId: string | null = null;
    let userRole: UserRole | null = null;
    let churchId = request.context.churchId;

    try {
      // 1. Static Tool Registry Validation
      tool = GraceAiToolsRegistry.getTool(request.toolName);
      if (!tool) {
        await this.logAudit({
          churchId,
          userId: null,
          aiAgentId,
          toolName: request.toolName,
          action: "UNKNOWN_TOOL_EXECUTION_ATTEMPT",
          correlationId,
          result: "DENIED",
          denialReason: `Unknown or prohibited tool "${request.toolName}"`,
        });

        return {
          success: false,
          status: "denied",
          code: "TOOL_NOT_FOUND",
          error: `Tool "${request.toolName}" ไม่ได้รับอนุญาตในระบบ Grace AI`,
          denial_reason: "Unknown or prohibited tool",
        };
      }

      // 2. Strict Capability Verification: NO EXECUTE allowed
      if ((tool.capability as any) === "EXECUTE") {
        await this.logAudit({
          churchId,
          userId: null,
          aiAgentId,
          toolName: tool.name,
          action: "PROHIBITED_CAPABILITY_ATTEMPT",
          correlationId,
          result: "DENIED",
          denialReason: "Tool capability EXECUTE is strictly prohibited in Grace AI",
        });

        return {
          success: false,
          status: "denied",
          code: "PROHIBITED_CAPABILITY",
          error: "Grace AI ไม่มีสิทธิ์ในการสั่ง Execute ธุรกรรมทางการเงินโดยตรง",
          denial_reason: "EXECUTE capability prohibited",
        };
      }

      // 3. Authenticated Server Context Extraction (Zero-Trust Identity)
      const { data: authUser, error: authError } = await this.supabase.auth.getUser();
      if (authError || !authUser?.user) {
        await this.logAudit({
          churchId,
          userId: null,
          aiAgentId,
          toolName: tool.name,
          action: tool.auditAction,
          correlationId,
          result: "DENIED",
          denialReason: "Unauthenticated session: auth.uid() is missing",
        });

        return {
          success: false,
          status: "denied",
          code: "UNAUTHENTICATED",
          error: "กรุณาเข้าสู่ระบบก่อนใช้งาน Grace AI",
          denial_reason: "Unauthenticated session",
        };
      }

      authenticatedUserId = authUser.user.id;

      // 4. Derive Server-side Role & Church Membership from Database
      const { data: memberProfile, error: profileError } = await (this.supabase
        .from("profiles") as any)
        .select("id, church_id, role")
        .eq("id", authenticatedUserId)
        .single();

      if (profileError || !memberProfile) {
        await this.logAudit({
          churchId,
          userId: authenticatedUserId,
          aiAgentId,
          toolName: tool.name,
          action: tool.auditAction,
          correlationId,
          result: "DENIED",
          denialReason: "Profile or church membership not found",
        });

        return {
          success: false,
          status: "denied",
          code: "MEMBERSHIP_NOT_FOUND",
          error: "ไม่พบข้อมูลสมาชิกหรือสังกัดคริสตจักรของผู้ใช้งาน",
          denial_reason: "Profile or membership not found",
        };
      }

      userRole = memberProfile.role as UserRole;

      // 5. Tenant Validation (Strict Church Scope Enforcement)
      if (memberProfile.church_id !== churchId && userRole !== "super_admin") {
        await this.logAudit({
          churchId,
          userId: authenticatedUserId,
          aiAgentId,
          toolName: tool.name,
          action: tool.auditAction,
          correlationId,
          result: "DENIED",
          denialReason: `Cross-Tenant Access Denied: User belongs to ${memberProfile.church_id}, requested ${churchId}`,
        });

        return {
          success: false,
          status: "denied",
          code: "TENANT_MISMATCH",
          error: "ไม่อนุญาตให้เข้าถึงข้อมูลข้ามคริสตจักร",
          denial_reason: "Cross-Tenant Access Denied",
        };
      }

      // Also ensure input church_id matches authenticated church
      const rawParams = { ...request.parameters, church_id: churchId };

      // 6. Zod Input Validation (Untrusted Input Sanitization)
      const inputParsed = tool.inputSchema.safeParse(rawParams);
      if (!inputParsed.success) {
        const errorMsg = inputParsed.error.issues.map((i) => i.message).join("; ");
        await this.logAudit({
          churchId,
          userId: authenticatedUserId,
          aiAgentId,
          toolName: tool.name,
          action: tool.auditAction,
          correlationId,
          result: "DENIED",
          denialReason: `Input schema validation failed: ${errorMsg}`,
        });

        return {
          success: false,
          status: "denied",
          code: "INVALID_INPUT_SCHEMA",
          error: `พารามิเตอร์ของเครื่องมือไม่ถูกต้อง: ${errorMsg}`,
          denial_reason: `Input validation failed: ${errorMsg}`,
        };
      }

      const validatedInput = inputParsed.data;

      // 7. Server-side RBAC Permission Verification
      for (const required of tool.requiredPermissions) {
        if (!can(userRole, required.action, required.resource)) {
          await this.logAudit({
            churchId,
            userId: authenticatedUserId,
            aiAgentId,
            toolName: tool.name,
            action: tool.auditAction,
            correlationId,
            result: "DENIED",
            denialReason: `Access Denied: Role "${userRole}" lacks permission "${required.action}" on "${required.resource}"`,
          });

          return {
            success: false,
            status: "denied",
            code: "PERMISSION_DENIED",
            error: `บทบาท "${userRole}" ไม่มีสิทธิ์ดำเนินการ "${required.action}" สำหรับทรัพยากร ${required.resource}`,
            denial_reason: `Role "${userRole}" lacks permission`,
          };
        }
      }

      // 8. Sensitive Data Policy (Giving History Privacy Protection)
      if (tool.sensitiveDataLevel === "SENSITIVE_FINANCIAL") {
        if (!["super_admin", "pastor", "treasurer"].includes(userRole)) {
          await this.logAudit({
            churchId,
            userId: authenticatedUserId,
            aiAgentId,
            toolName: tool.name,
            action: tool.auditAction,
            correlationId,
            result: "DENIED",
            denialReason: `Role "${userRole}" prohibited from accessing SENSITIVE_FINANCIAL giving data`,
          });

          return {
            success: false,
            status: "denied",
            code: "SENSITIVE_DATA_PROHIBITED",
            error: "ข้อมูลการถวายของสมาชิกเป็นความลับทางการเงินสูงสุด เข้าถึงได้เฉพาะศิษยาภิบาลและเหรัญญิก",
            denial_reason: "Sensitive financial data access prohibited for this role",
          };
        }
      }

      // 9. Tool Execution Delegation (READ / DRAFT / ACTION_PROPOSAL only)
      let rawResult: any;

      if (tool.capability === "READ") {
        rawResult = await this.handleReadTool(tool.name, validatedInput, authenticatedUserId);
      } else if (tool.capability === "DRAFT") {
        rawResult = await this.handleDraftTool(tool.name, validatedInput, authenticatedUserId);
      } else if (tool.capability === "ACTION_PROPOSAL") {
        rawResult = await this.handleProposalTool(tool.name, validatedInput, authenticatedUserId, churchId);
      }

      // 10. Zod Output Validation (Prevent Data Leakage & Schema Drift)
      const outputParsed = tool.outputSchema.safeParse(rawResult);
      if (!outputParsed.success) {
        const errorMsg = outputParsed.error.issues.map((i) => i.message).join("; ");
        await this.logAudit({
          churchId,
          userId: authenticatedUserId,
          aiAgentId,
          toolName: tool.name,
          action: tool.auditAction,
          correlationId,
          result: "ERROR",
          denialReason: `Output schema validation failed: ${errorMsg}`,
        });

        return {
          success: false,
          status: "error",
          code: "INVALID_OUTPUT_SCHEMA",
          error: "ผลลัพธ์จากระบบไม่ตรงกับโครงสร้างความปลอดภัยที่กำหนด",
          denial_reason: "Output schema validation failed",
        };
      }

      // 11. Dual-Actor Audit Logging for SUCCESS
      const auditLog = await this.logAudit({
        churchId,
        userId: authenticatedUserId,
        aiAgentId,
        toolName: tool.name,
        action: tool.auditAction,
        correlationId,
        result: "SUCCESS",
        metadata: {
          capability: tool.capability,
          sensitiveDataLevel: tool.sensitiveDataLevel,
        },
      });

      return {
        success: true,
        status: "executed",
        data: outputParsed.data,
        audit_id: auditLog?.id,
      };
    } catch (err: any) {
      await this.logAudit({
        churchId,
        userId: authenticatedUserId,
        aiAgentId,
        toolName: tool?.name || request.toolName,
        action: tool?.auditAction || "TOOL_EXECUTION_ERROR",
        correlationId,
        result: "ERROR",
        denialReason: err.message || "Unhandled exception during tool execution",
      });

      return {
        success: false,
        status: "error",
        code: "EXECUTION_EXCEPTION",
        error: err.message || "เกิดข้อผิดพลาดในการประมวลผลคำสั่ง",
        denial_reason: err.message,
      };
    }
  }

  /**
   * READ Handlers (Read-only data retrieval through Authorized Services/RPCs)
   */
  private async handleReadTool(toolName: string, input: any, _userId: string): Promise<any> {
    if (toolName === "get_financial_summary") {
      const { data: funds, error: fundsError } = await (this.supabase
        .from("funds") as any)
        .select("current_balance")
        .eq("church_id", input.church_id)
        .eq("is_active", true);

      if (fundsError) throw new Error(fundsError.message);

      let totalFunds = Money.zero();
      if (funds) {
        for (const f of funds) {
          totalFunds = totalFunds.add(Money.from(f.current_balance || "0.00"));
        }
      }

      const { data: txns, error: txnsError } = await (this.supabase
        .from("transactions") as any)
        .select("amount, direction")
        .eq("church_id", input.church_id)
        .eq("status", "posted")
        .gte("transaction_date", `${input.period}-01`)
        .lte("transaction_date", `${input.period}-31`);

      if (txnsError) throw new Error(txnsError.message);

      let income = Money.zero();
      let expense = Money.zero();
      if (txns) {
        for (const t of txns) {
          const m = Money.from(t.amount);
          if (t.direction === "income") income = income.add(m);
          else if (t.direction === "expense") expense = expense.add(m);
        }
      }

      return {
        total_income: income.toFixed(2),
        total_expense: expense.toFixed(2),
        net_cashflow: income.subtract(expense).toFixed(2),
        total_funds_balance: totalFunds.toFixed(2),
        period: input.period,
      };
    }

    if (toolName === "get_transactions") {
      let q = (this.supabase
        .from("transactions") as any)
        .select("id, description, amount, status, transaction_date, direction")
        .eq("church_id", input.church_id)
        .order("transaction_date", { ascending: false });

      if (input.status) q = q.eq("status", input.status);
      if (input.start_date) q = q.gte("transaction_date", input.start_date);
      if (input.end_date) q = q.lte("transaction_date", input.end_date);
      if (input.limit) q = q.limit(input.limit);

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      return {
        transactions: data || [],
        total_count: (data || []).length,
      };
    }

    if (toolName === "get_fund_balance") {
      let q = (this.supabase
        .from("funds") as any)
        .select("id, name, current_balance, target_budget")
        .eq("church_id", input.church_id)
        .eq("is_active", true);

      if (input.fund_id) q = q.eq("id", input.fund_id);

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      return {
        funds: (data || []).map((f: any) => ({
          fund_id: f.id,
          name: f.name,
          balance: Money.from(f.current_balance || "0.00").toFixed(2),
          target_budget: Money.from(f.target_budget || "0.00").toFixed(2),
        })),
      };
    }

    if (toolName === "get_budget_vs_actual") {
      const { data, error } = await (this.supabase
        .from("budgets") as any)
        .select("id, name, amount, actual_amount, period_start, period_end")
        .eq("church_id", input.church_id);

      if (error) throw new Error(error.message);
      return {
        year: input.year,
        items: data || [],
      };
    }

    if (toolName === "get_transaction_audit_trail") {
      const { data, error } = await (this.supabase
        .from("audit_logs") as any)
        .select("id, action, category, before_state, after_state, metadata, created_at, actor_id")
        .eq("entity_id", input.transaction_id)
        .order("created_at", { ascending: true });

      if (error) throw new Error(error.message);
      return {
        transaction_id: input.transaction_id,
        logs: data || [],
      };
    }

    if (toolName === "get_member_giving_history") {
      // Must call secure RPC get_member_giving_history (Never read raw table)
      const { data, error } = await (this.supabase.rpc as any)("get_member_giving_history", {
        p_member_id: input.member_id,
        p_reason: input.reason,
      });

      if (error) throw new Error(error.message);

      const { data: member } = await (this.supabase
        .from("members") as any)
        .select("full_name")
        .eq("id", input.member_id)
        .single();

      let total = Money.zero();
      const records = data || [];
      for (const r of records) {
        total = total.add(Money.from(r.amount));
      }

      return {
        member_id: input.member_id,
        member_name: member?.full_name || "สมาชิก",
        records,
        total_giving: total.toFixed(2),
      };
    }

    throw new Error(`Unhandled read tool: ${toolName}`);
  }

  /**
   * DRAFT Handlers (Creates uncommitted draft records in draft status)
   */
  private async handleDraftTool(toolName: string, input: any, _userId: string): Promise<any> {
    if (toolName === "create_draft_transaction") {
      const totalAmount = Money.from(input.amount);

      const { data: txn, error: txnError } = await (this.supabase
        .from("transactions") as any)
        .insert({
          church_id: input.church_id,
          description: input.description,
          transaction_date: input.transaction_date,
          category_id: input.category_id,
          account_id: input.account_id,
          amount: totalAmount.toFixed(2),
          status: "draft",
        })
        .select("id")
        .single();

      if (txnError) throw new Error(txnError.message);

      const splitsToInsert = input.splits.map((s: any) => ({
        transaction_id: txn.id,
        fund_id: s.fund_id,
        amount: Money.from(s.amount).toFixed(2),
        notes: s.notes || null,
      }));

      const { error: splitsError } = await (this.supabase
        .from("transaction_splits") as any)
        .insert(splitsToInsert);

      if (splitsError) throw new Error(splitsError.message);

      return {
        draft_transaction_id: txn.id,
        status: "draft",
      };
    }

    if (toolName === "create_transfer_draft") {
      return {
        draft_summary: `เตรียมข้อเสนอการโอนเงิน ${Money.from(input.amount).format()} ระหว่างกองทุน`,
        from_fund_id: input.from_fund_id,
        to_fund_id: input.to_fund_id,
        amount: Money.from(input.amount).toFixed(2),
      };
    }

    throw new Error(`Unhandled draft tool: ${toolName}`);
  }

  /**
   * ACTION PROPOSAL Handlers (Creates server-backed Confirmation for Human Review)
   * Strictly DOES NOT execute the financial mutation
   */
  private async handleProposalTool(
    toolName: string,
    input: any,
    _userId: string,
    churchId: string
  ): Promise<any> {
    let actionType: "post_transaction" | "fund_transfer" | "void_transaction";
    let resourceId: string | null = null;

    if (toolName === "propose_transaction_post") {
      actionType = "post_transaction";
      resourceId = input.transaction_id;
    } else if (toolName === "propose_fund_transfer") {
      actionType = "fund_transfer";
    } else if (toolName === "propose_void_transaction") {
      actionType = "void_transaction";
      resourceId = input.transaction_id;
    } else {
      throw new Error(`Unhandled proposal tool: ${toolName}`);
    }

    // Create server-backed confirmation
    const confRes = await this.confirmationEngine.createConfirmation({
      church_id: churchId,
      action: actionType,
      tool_name: toolName,
      resource_id: resourceId,
      parameters: input,
      ttl_seconds: 300,
    });

    if (!confRes.success || !confRes.data) {
      throw new Error(confRes.error || "Failed to create action confirmation for proposal");
    }

    return {
      proposal_id: confRes.data.confirmation_id,
      action_type: actionType,
      requires_confirmation: true,
      parameters: input,
    };
  }

  /**
   * Dual-Actor Audit Logger
   */
  private async logAudit(params: {
    churchId: string;
    userId: string | null;
    aiAgentId: string;
    toolName: string;
    action: string;
    correlationId: string;
    result: "SUCCESS" | "DENIED" | "ERROR";
    targetResource?: string;
    denialReason?: string;
    metadata?: Record<string, any>;
  }): Promise<{ id?: string } | null> {
    try {
      const payload = {
        church_id: params.churchId,
        actor_id: params.userId,
        action: params.action,
        category: "ai_governance",
        metadata: {
          ai_agent_id: params.aiAgentId,
          tool_name: params.toolName,
          correlation_id: params.correlationId,
          result: params.result,
          denial_reason: params.denialReason || null,
          target_resource: params.targetResource || null,
          ...params.metadata,
        },
      };

      const { data } = await (this.supabase
        .from("audit_logs") as any)
        .insert(payload)
        .select("id")
        .single();

      return data || null;
    } catch {
      // Fail-safe: Logging failure should not crash security boundary
      return null;
    }
  }
}
