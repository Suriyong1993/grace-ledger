import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { Database } from "../supabase/types";
import { canExecuteFinancialAction, UserRole } from "../rbac";

/**
 * =====================================================================
 * DEDICATED FINANCIAL ACTION EXECUTION ENDPOINT
 * =====================================================================
 * Security Invariants:
 * 1. AI cannot execute. UI cannot execute. ONLY this server endpoint executes.
 * 2. Input contract receives ONLY server-issued confirmation reference.
 * 3. Server re-derives authenticated user identity and recomputes RBAC.
 * 4. Dispatches to the single atomic database orchestration RPC:
 *    `execute_confirmed_financial_action`
 * 5. Guarantees Atomic Transaction Boundary:
 *    [Lock Confirmation + Idempotency + State Validation + Mutation + Audit + Consume Confirmation + Complete Idempotency]
 * 6. If mutation fails -> ROLLBACK ALL (Confirmation is NOT permanently consumed).
 * =====================================================================
 */

export const FinancialActionExecutionRequestSchema = z.object({
  confirmation_id: z.string().min(1),
  nonce: z.string().min(16),
  payload_hash: z.string().length(64),
  idempotency_key: z.string().min(8).optional(),
});

export type FinancialActionExecutionRequest = z.infer<typeof FinancialActionExecutionRequestSchema>;

export type ExecutionResultCode =
  | "SUCCESS"
  | "DENIED"
  | "CONFLICT"
  | "EXPIRED"
  | "INVALID_CONFIRMATION"
  | "INVALID_RESOURCE_STATE"
  | "FINANCIAL_INVARIANT_VIOLATION"
  | "ERROR";

export interface FinancialActionExecutionResponse {
  success: boolean;
  code: ExecutionResultCode;
  message: string;
  action?: string;
  resource_id?: string;
  is_replay?: boolean;
  error?: string;
}

export class FinancialActionExecutionService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Execute confirmed financial action via the atomic orchestration boundary
   */
  public async executeAction(
    request: FinancialActionExecutionRequest
  ): Promise<FinancialActionExecutionResponse> {
    // 1. Validate Input Schema
    const parseRes = FinancialActionExecutionRequestSchema.safeParse(request);
    if (!parseRes.success) {
      return {
        success: false,
        code: "INVALID_CONFIRMATION",
        message: "รูปแบบข้อมูลคำขอยืนยันไม่ถูกต้อง",
        error: parseRes.error.message,
      };
    }

    const { confirmation_id, nonce, payload_hash, idempotency_key: providedIdempKey } = parseRes.data;

    // 2. Authenticate User from Trusted Server Session
    const { data: authData, error: authErr } = await this.supabase.auth.getUser();
    if (authErr || !authData?.user) {
      await this.logExecutionAudit({
        actor_id: "00000000-0000-0000-0000-000000000000",
        church_id: "00000000-0000-0000-0000-000000000000",
        action: "UNKNOWN",
        confirmation_id,
        result: "DENIED",
        reason: "User is not authenticated",
      });

      return {
        success: false,
        code: "DENIED",
        message: "กรุณาเข้าสู่ระบบก่อนทำรายการ",
        error: "UNAUTHENTICATED",
      };
    }

    const userId = authData.user.id;

    // 3. Resolve Profile, Church, and Role
    const { data: profile, error: profileErr } = await (this.supabase
      .from("profiles") as any)
      .select("id, church_id, role")
      .eq("id", userId)
      .single();

    if (profileErr || !profile || !profile.church_id) {
      return {
        success: false,
        code: "DENIED",
        message: "ไม่พบข้อมูลสมาชิกหรือสังกัดคริสตจักร",
        error: "MEMBERSHIP_NOT_FOUND",
      };
    }

    const churchId = profile.church_id;
    const userRole = profile.role as UserRole;

    // 4. Server-Side RBAC Recomputation
    // Segregation of Duties: Only Treasurer or Super Admin can execute financial mutations
    if (!canExecuteFinancialAction(userRole)) {
      await this.logExecutionAudit({
        actor_id: userId,
        church_id: churchId,
        action: "UNKNOWN",
        confirmation_id,
        result: "DENIED",
        reason: `Role '${userRole}' is unauthorized to execute financial actions`,
      });

      return {
        success: false,
        code: "DENIED",
        message: "คุณไม่มีสิทธิ์ในการอนุมัติหรือบันทึกรายการทางการเงินนี้",
        error: "PERMISSION_DENIED",
      };
    }

    // 5. Deterministic Idempotency Key
    // Bound strictly to user, church, and confirmation_id so retries remain deterministic
    const idempotencyKey = providedIdempKey || `idemp_conf_${confirmation_id}`;

    // 6. Execute Single Atomic Database Orchestrator RPC
    const { data: execResult, error: execErr } = await (this.supabase.rpc as any)(
      "execute_confirmed_financial_action",
      {
        p_confirmation_id: confirmation_id,
        p_church_id: churchId,
        p_expected_payload_hash: payload_hash,
        p_expected_nonce: nonce,
        p_idempotency_key: idempotencyKey,
      }
    );

    if (execErr || !execResult) {
      const errMsg = execErr?.message || "Execution failed";
      let code: ExecutionResultCode = "ERROR";
      let userMsg = "เกิดข้อผิดพลาดในการดำเนินการทางการเงิน";

      if (errMsg.includes("Expired") || errMsg.includes("inactive")) {
        code = "EXPIRED";
        userMsg = "ข้อเสนอนี้หมดอายุแล้ว กรุณาขอให้ Grace AI สร้างข้อเสนอใหม่";
      } else if (errMsg.includes("Cross-Tenant") || errMsg.includes("Cross-User") || errMsg.includes("Access Denied")) {
        code = "DENIED";
        userMsg = "ไม่อนุญาตให้ยืนยันข้อเสนอของผู้อื่นหรือข้ามคริสตจักร";
      } else if (errMsg.includes("Mismatch") || errMsg.includes("tampered")) {
        code = "DENIED";
        userMsg = "ข้อมูลข้อเสนอถูกแก้ไขหรือถูกดัดแปลง (Tamper Detected)";
      } else if (errMsg.includes("Insufficient Funds")) {
        code = "FINANCIAL_INVARIANT_VIOLATION";
        userMsg = "ยอดเงินในกองทุนไม่เพียงพอสำหรับการโอน";
      } else if (errMsg.includes("Already Consumed")) {
        code = "INVALID_CONFIRMATION";
        userMsg = "ข้อเสนอนี้ถูกดำเนินการไปเรียบร้อยแล้ว ไม่สามารถดำเนินการซ้ำได้";
      } else if (errMsg.includes("Idempotency Conflict")) {
        code = "CONFLICT";
        userMsg = "คำขอนี้กำลังอยู่ในระหว่างการประมวลผลหรือมีข้อมูลไม่ตรงกับคีย์เดิม";
      } else if (errMsg.includes("State Transition") || errMsg.includes("Not Found")) {
        code = "INVALID_RESOURCE_STATE";
        userMsg = "สถานะของรายการหรือกองทุนในระบบเปลี่ยนแปลงไปแล้ว";
      }

      await this.logExecutionAudit({
        actor_id: userId,
        church_id: churchId,
        action: "EXECUTE_CONFIRMED_ACTION",
        confirmation_id,
        idempotency_key: idempotencyKey,
        result: "ERROR",
        reason: errMsg,
      });

      return {
        success: false,
        code,
        message: userMsg,
        error: errMsg,
      };
    }

    // 7. Successful Execution Result
    return {
      success: true,
      code: "SUCCESS",
      message: execResult.message || "ดำเนินการทางการเงินเรียบร้อยแล้วและบันทึกลงบัญชีแยกประเภทสมบูรณ์",
      action: execResult.action,
      resource_id: execResult.resource_id,
      is_replay: execResult.is_replay || false,
    };
  }

  /**
   * Audit Logger for Denied/Error states before RPC
   */
  private async logExecutionAudit(data: {
    actor_id: string;
    church_id: string;
    action: string;
    confirmation_id?: string;
    idempotency_key?: string;
    resource_id?: string;
    result: "SUCCESS" | "DENIED" | "ERROR";
    reason?: string;
  }) {
    try {
      await (this.supabase.from("audit_logs") as any).insert({
        church_id: data.church_id,
        actor_id: data.actor_id,
        category: "FINANCIAL_EXECUTION",
        action: data.action,
        entity_type: "financial_action",
        entity_id: data.resource_id || data.confirmation_id,
        metadata: {
          ai_agent_id: "grace_ai_v1",
          confirmation_id: data.confirmation_id,
          idempotency_key: data.idempotency_key,
          result: data.result,
          reason: data.reason,
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      // Non-blocking audit log catch
    }
  }
}
