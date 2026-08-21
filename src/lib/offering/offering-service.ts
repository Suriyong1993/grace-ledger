import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../supabase/types";
import { Money } from "../money";
import {
  OfferingSession,
  OfferingItem,
  CashCount,
  OfferingRevision,
  OfferingSessionStatus,
  CreateOfferingSessionInput,
  ReviseOfferingExpectedInput,
  RecordCashCountInput,
  ResolveVarianceInput,
  PostOfferingInput,
  OfferingServiceResult,
  OfferingServiceError,
  PostOfferingResult,
} from "./types";
import { DenominationEngine } from "./denomination-engine";
import { OfferingLifecycle } from "./lifecycle";

/**
 * Service Layer for Sunday Offering & Cash Count Workflow
 * Integrates application layer with PostgreSQL 17 RPCs & Invariant Triggers.
 */
export class OfferingService {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * Maps raw PostgreSQL / Supabase errors to structured domain errors.
   */
  public static mapDatabaseError(err: any): OfferingServiceError {
    const rawMessage = err?.message || String(err || "");
    const rawCode = err?.code || "UNKNOWN_ERROR";

    // 1. Dual Counter Violation
    if (rawMessage.includes("DUAL_COUNTER_VIOLATION") || rawMessage.includes("Counter 1 and Counter 2 must be different")) {
      return {
        code: "DUAL_COUNTER_VIOLATION",
        message: "ผู้ตรวจนับคนที่ 1 และคนที่ 2 ต้องเป็นคนละคนกันตามหลักการควบคุมภายใน",
        details: rawMessage,
      };
    }

    // 2. Unresolved Variance Guard
    if (rawMessage.includes("CANNOT_CONFIRM_UNRESOLVED_VARIANCE") || rawMessage.includes("must be resolved or explained")) {
      return {
        code: "UNRESOLVED_VARIANCE",
        message: "ไม่สามารถยืนยันยอดถวายได้เนื่องจากมีผลต่างเงินสดที่ยังไม่ได้รับการอธิบาย กรุณาระบุคำอธิบายอย่างน้อย 5 ตัวอักษร",
        details: rawMessage,
      };
    }

    // 3. State Machine Invariants
    if (rawMessage.includes("INVALID_STATE_TRANSITION")) {
      return {
        code: "INVALID_STATE_TRANSITION",
        message: "ลำดับขั้นตอนไม่ถูกต้อง ไม่สามารถเปลี่ยนสถานะข้ามขั้นตอนได้",
        details: rawMessage,
        isStaleState: true,
      };
    }

    if (rawMessage.includes("CANNOT_MODIFY_POSTED_OFFERING")) {
      return {
        code: "CANNOT_MODIFY_POSTED_OFFERING",
        message: "ยอดถวายนี้ถูกบันทึกลงบัญชีแยกประเภทแล้ว (Posted) ไม่สามารถแก้ไขได้อีกต่อไป",
        details: rawMessage,
        isStaleState: true,
      };
    }

    if (rawMessage.includes("CANNOT_REVERT_CONFIRMED_OFFERING")) {
      return {
        code: "CANNOT_REVERT_CONFIRMED_OFFERING",
        message: "ยอดถวายที่ยืนยันแล้วไม่สามารถย้อนกลับสถานะได้",
        details: rawMessage,
        isStaleState: true,
      };
    }

    // 4. Missing Custody Accounts
    if (rawMessage.includes("MISSING_BANK_ACCOUNT")) {
      return {
        code: "MISSING_BANK_ACCOUNT",
        message: "กรุณาระบุบัญชีธนาคารสำหรับการบันทึกยอดเงินโอนและ QR Code",
        details: rawMessage,
      };
    }

    if (rawMessage.includes("INVALID_CASH_ACCOUNT") || rawMessage.includes("INVALID_BANK_ACCOUNT")) {
      return {
        code: "INVALID_ACCOUNT",
        message: "บัญชีการเงินที่เลือกไม่ถูกต้อง หรือไม่ได้อยู่ในสังกัดคริสตจักรนี้",
        details: rawMessage,
      };
    }

    // 5. Revision Reason
    // DB raises: 'MANDATORY_REASON: Revision reason must be at least 5 characters'
    if (rawMessage.includes("MANDATORY_REASON")) {
      return {
        code: "MANDATORY_REVISION_REASON",
        message: "กรุณาระบุเหตุผลในการแก้ไขยอดถวายที่คาดหวังอย่างน้อย 5 ตัวอักษร",
        details: rawMessage,
      };
    }

    // 6. RBAC & Tenant Permissions
    if (rawMessage.includes("FORBIDDEN") || rawMessage.includes("Insufficient permissions")) {
      return {
        code: "FORBIDDEN",
        message: "คุณไม่มีสิทธิ์ในการดำเนินการนี้",
        details: rawMessage,
      };
    }

    if (rawMessage.includes("UNAUTHORIZED")) {
      return {
        code: "UNAUTHORIZED",
        message: "กรุณาเข้าสู่ระบบก่อนทำรายการ",
        details: rawMessage,
      };
    }

    // Default Fallback
    return {
      code: rawCode,
      message: rawMessage || "เกิดข้อผิดพลาดในการประมวลผลยอดถวาย",
      details: err,
    };
  }

  /**
   * 1. Create a new Sunday Offering Session in 'draft' status.
   */
  async createSession(
    input: CreateOfferingSessionInput
  ): Promise<OfferingServiceResult<{ sessionId: string }>> {
    if (!input.items || input.items.length === 0) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "ต้องมีรายการยอดถวายอย่างน้อย 1 รายการ",
        },
      };
    }

    try {
      const itemsPayload = input.items.map((item) => ({
        fund_id: item.fundId,
        category_id: item.categoryId || null,
        payment_channel: item.paymentChannel,
        source_type: item.sourceType || "envelopes",
        amount: Money.from(item.amount).toNumber(),
        donor_name: item.donorName || null,
        notes: item.notes || null,
      }));

      const { data, error } = await (this.supabase.rpc as any)("create_offering_session", {
        p_service_date: input.serviceDate,
        p_service_name: input.serviceName,
        p_items: itemsPayload,
        p_notes: input.notes || null,
      });

      if (error) {
        return { success: false, error: OfferingService.mapDatabaseError(error) };
      }

      return {
        success: true,
        data: { sessionId: data as string },
      };
    } catch (err: any) {
      return { success: false, error: OfferingService.mapDatabaseError(err) };
    }
  }

  /**
   * 2. Start physical cash count with dual counters.
   */
  async startCashCount(
    sessionId: string,
    counter1Id: string,
    counter2Id: string
  ): Promise<OfferingServiceResult<{ sessionId: string; status: string }>> {
    const dualValidation = OfferingLifecycle.validateDualCounters(counter1Id, counter2Id);
    if (!dualValidation.isValid) {
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: dualValidation.error! },
      };
    }

    try {
      const { data, error } = await (this.supabase.rpc as any)("start_cash_count", {
        p_session_id: sessionId,
        p_counter1_id: counter1Id,
        p_counter2_id: counter2Id,
      });

      if (error) {
        return { success: false, error: OfferingService.mapDatabaseError(error) };
      }

      return {
        success: true,
        data: {
          sessionId,
          status: (data as any)?.status || "counting",
        },
      };
    } catch (err: any) {
      return { success: false, error: OfferingService.mapDatabaseError(err) };
    }
  }

  /**
   * 3. Record physical cash denomination counts and calculate variance.
   */
  async recordCashCount(
    input: RecordCashCountInput
  ): Promise<OfferingServiceResult<{
    sessionId: string;
    totalCash: Money;
    varianceAmount: Money;
    varianceStatus: string;
    status: OfferingSessionStatus;
  }>> {
    const dualValidation = OfferingLifecycle.validateDualCounters(
      input.counter1Id,
      input.counter2Id
    );
    if (!dualValidation.isValid) {
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: dualValidation.error! },
      };
    }

    const denomValidation = DenominationEngine.validate(input.denominations);
    if (!denomValidation.isValid) {
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: denomValidation.errors.join(", ") },
      };
    }

    try {
      const coinMoney = Money.from(input.denominations.coins);

      const { data, error } = await (this.supabase.rpc as any)("record_cash_count", {
        p_session_id: input.sessionId,
        p_counter1_id: input.counter1Id,
        p_counter2_id: input.counter2Id,
        p_bill_1000: input.denominations.b1000,
        p_bill_500: input.denominations.b500,
        p_bill_100: input.denominations.b100,
        p_bill_50: input.denominations.b50,
        p_bill_20: input.denominations.b20,
        p_coins: coinMoney.toNumber(),
      });

      if (error) {
        return { success: false, error: OfferingService.mapDatabaseError(error) };
      }

      const res = data as any;
      return {
        success: true,
        data: {
          sessionId: input.sessionId,
          totalCash: Money.from(res.counted_cash),
          varianceAmount: Money.from(res.cash_variance),
          varianceStatus: res.variance_status,
          status: res.status as OfferingSessionStatus,
        },
      };
    } catch (err: any) {
      return { success: false, error: OfferingService.mapDatabaseError(err) };
    }
  }

  /**
   * 4. Resolve cash count variance (either recount or explain).
   */
  async resolveVariance(
    input: ResolveVarianceInput
  ): Promise<OfferingServiceResult<{
    sessionId: string;
    action: string;
    varianceStatus?: string;
    varianceReason: string | null;
    status?: OfferingSessionStatus;
  }>> {
    if (input.action === "explain") {
      if (!input.explanation || input.explanation.trim().length < 5) {
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "กรุณาระบุคำอธิบายผลต่างอย่างน้อย 5 ตัวอักษร",
          },
        };
      }
    }

    try {
      const { data, error } = await (this.supabase.rpc as any)("resolve_offering_variance", {
        p_session_id: input.sessionId,
        p_action: input.action,
        p_explanation: input.explanation?.trim() || null,
      });

      if (error) {
        return { success: false, error: OfferingService.mapDatabaseError(error) };
      }

      const res = data as any;
      return {
        success: true,
        data: {
          sessionId: input.sessionId,
          action: res.action,
          // The RPC branches: recount reports `status`, explain reports
          // `variance_status` + `variance_reason`. Each is absent in the other.
          varianceStatus: res.variance_status,
          varianceReason: res.variance_reason ?? null,
          status: res.status as OfferingSessionStatus | undefined,
        },
      };
    } catch (err: any) {
      return { success: false, error: OfferingService.mapDatabaseError(err) };
    }
  }

  /**
   * 5. Revise Expected Amount (Immutable audit trail).
   */
  async reviseExpectedAmount(
    input: ReviseOfferingExpectedInput
  ): Promise<OfferingServiceResult<{
    sessionId: string;
    expectedCash: Money;
    expectedTotal: Money;
    varianceAmount: Money;
    revisionNumber: number;
  }>> {
    if (!input.revisionReason || input.revisionReason.trim().length < 5) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "กรุณาระบุเหตุผลในการแก้ไขยอดถวายอย่างน้อย 5 ตัวอักษร",
        },
      };
    }

    try {
      const itemsPayload = input.newItems.map((item) => ({
        fund_id: item.fundId,
        category_id: item.categoryId || null,
        payment_channel: item.paymentChannel,
        source_type: item.sourceType || "envelopes",
        amount: Money.from(item.amount).toNumber(),
        donor_name: item.donorName || null,
        notes: item.notes || null,
      }));

      const { data, error } = await (this.supabase.rpc as any)(
        "revise_offering_expected_amount",
        {
          p_session_id: input.sessionId,
          p_new_items: itemsPayload,
          p_revision_reason: input.revisionReason.trim(),
        }
      );

      if (error) {
        return { success: false, error: OfferingService.mapDatabaseError(error) };
      }

      const res = data as any;
      return {
        success: true,
        data: {
          sessionId: input.sessionId,
          expectedCash: Money.from(res.expected_cash),
          expectedTotal: Money.from(res.expected_total),
          varianceAmount: Money.from(res.cash_variance),
          revisionNumber: res.revision_number as number,
        },
      };
    } catch (err: any) {
      return { success: false, error: OfferingService.mapDatabaseError(err) };
    }
  }

  /**
   * 6. Confirm offering session after verification.
   */
  async confirmSession(
    sessionId: string
  ): Promise<OfferingServiceResult<{ sessionId: string; status: OfferingSessionStatus }>> {
    try {
      const { data, error } = await (this.supabase.rpc as any)(
        "confirm_offering_session",
        {
          p_session_id: sessionId,
        }
      );

      if (error) {
        return { success: false, error: OfferingService.mapDatabaseError(error) };
      }

      const res = data as any;
      return {
        success: true,
        data: {
          sessionId,
          status: (res?.status || "confirmed") as OfferingSessionStatus,
        },
      };
    } catch (err: any) {
      return { success: false, error: OfferingService.mapDatabaseError(err) };
    }
  }

  /**
   * 7. Post offering to financial ledger (Atomic double-entry posting with idempotency).
   */
  async postOfferingToLedger(
    input: PostOfferingInput
  ): Promise<OfferingServiceResult<PostOfferingResult>> {
    if (!input.cashAccountId) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "กรุณาระบุบัญชี Cash Drawer สำหรับรับเงินสด",
        },
      };
    }

    try {
      const { data, error } = await (this.supabase.rpc as any)(
        "post_offering_to_ledger",
        {
          p_session_id: input.sessionId,
          p_cash_account_id: input.cashAccountId,
          p_bank_account_id: input.bankAccountId || null,
        }
      );

      if (error) {
        return { success: false, error: OfferingService.mapDatabaseError(error) };
      }

      const res = data as any;
      return {
        success: true,
        data: {
          sessionId: input.sessionId,
          transactionId: res.transaction_id,
          status: "posted",
          alreadyPosted: Boolean(res.already_posted),
        },
      };
    } catch (err: any) {
      return { success: false, error: OfferingService.mapDatabaseError(err) };
    }
  }

  /**
   * 8. Fetch complete offering session with items, cash count, and revisions.
   */
  async getSession(sessionId: string): Promise<OfferingServiceResult<OfferingSession>> {
    try {
      const { data, error } = await this.supabase
        .from("offering_sessions" as any)
        .select(`
          *,
          items:offering_session_items (
            id,
            offering_session_id,
            church_id,
            fund_id,
            category_id,
            payment_channel,
            source_type,
            amount,
            notes,
            funds ( name ),
            categories ( name )
          ),
          cash_counts:offering_cash_counts (
            id,
            offering_session_id,
            church_id,
            bill_1000,
            bill_500,
            bill_100,
            bill_50,
            bill_20,
            coins_amount,
            total_cash_counted,
            counted_by_1,
            counted_by_2,
            counted_at,
            p1:profiles!offering_cash_counts_counted_by_1_fkey ( full_name ),
            p2:profiles!offering_cash_counts_counted_by_2_fkey ( full_name )
          ),
          revisions:offering_session_revisions (
            id,
            offering_session_id,
            church_id,
            revision_number,
            previous_cash_amount,
            new_cash_amount,
            previous_total_amount,
            new_total_amount,
            revision_reason,
            revised_by,
            created_at
          )
        `)
        .eq("id", sessionId)
        .single();

      if (error) {
        return { success: false, error: OfferingService.mapDatabaseError(error) };
      }

      const s = data as any;
      const items: OfferingItem[] = (s.items || []).map((it: any) => ({
        id: it.id,
        offeringSessionId: it.offering_session_id,
        churchId: it.church_id,
        fundId: it.fund_id,
        fundName: it.funds?.name,
        categoryId: it.category_id,
        categoryName: it.categories?.name,
        paymentChannel: it.payment_channel,
        sourceType: it.source_type,
        amount: Money.from(it.amount),
        notes: it.notes,
      }));

      const rawCount = Array.isArray(s.cash_counts) ? s.cash_counts[0] : s.cash_counts;
      let cashCount: CashCount | null = null;
      if (rawCount) {
        cashCount = {
          id: rawCount.id,
          offeringSessionId: rawCount.offering_session_id,
          churchId: rawCount.church_id,
          b1000: rawCount.bill_1000 ?? rawCount.b1000 ?? 0,
          b500: rawCount.bill_500 ?? rawCount.b500 ?? 0,
          b100: rawCount.bill_100 ?? rawCount.b100 ?? 0,
          b50: rawCount.bill_50 ?? rawCount.b50 ?? 0,
          b20: rawCount.bill_20 ?? rawCount.b20 ?? 0,
          coins: Money.from(rawCount.coins_amount ?? rawCount.coins ?? 0),
          totalCashCounted: Money.from(rawCount.total_cash_counted || 0),
          countedBy1: rawCount.counted_by_1,
          countedBy1Name: rawCount.p1?.full_name || rawCount.counted_by_1_name || rawCount.counted_by_1,
          countedBy2: rawCount.counted_by_2,
          countedBy2Name: rawCount.p2?.full_name || rawCount.counted_by_2_name || rawCount.counted_by_2,
          counter1SignedAt: rawCount.counted_at,
          counter2SignedAt: rawCount.counted_at,
          createdAt: rawCount.counted_at || rawCount.created_at,
        };
      }

      const revisions: OfferingRevision[] = (s.revisions || []).map((rev: any) => ({
        id: rev.id,
        offeringSessionId: rev.offering_session_id,
        churchId: rev.church_id,
        revisionNumber: rev.revision_number,
        previousCashAmount: Money.from(rev.previous_cash_amount),
        newCashAmount: Money.from(rev.new_cash_amount),
        previousTotalAmount: Money.from(rev.previous_total_amount),
        newTotalAmount: Money.from(rev.new_total_amount),
        revisionReason: rev.revision_reason,
        revisedBy: rev.revised_by,
        revisedByName: rev.profiles?.full_name,
        createdAt: rev.created_at,
      }));

      const session: OfferingSession = {
        id: s.id,
        churchId: s.church_id,
        serviceDate: s.service_date,
        serviceName: s.service_name,
        location: s.location,
        status: s.status as OfferingSessionStatus,
        expectedCashAmount: Money.from(s.expected_cash_amount || s.expected_amount || 0),
        expectedTransferAmount: Money.from(s.expected_transfer_amount || 0),
        expectedQrAmount: Money.from(s.expected_qr_amount || 0),
        expectedTotalAmount: Money.from(s.expected_total_amount || s.expected_amount || 0),
        countedCashAmount: s.counted_cash_amount ? Money.from(s.counted_cash_amount) : null,
        cashVarianceAmount: s.cash_variance_amount !== null && s.cash_variance_amount !== undefined
          ? Money.from(s.cash_variance_amount)
          : null,
        varianceStatus: s.variance_status,
        varianceReason: s.variance_reason,
        counter1Id: s.counter1_id,
        counter2Id: s.counter2_id,
        financialTransactionId: s.financial_transaction_id,
        postedAt: s.posted_at,
        postedBy: s.posted_by,
        notes: s.notes,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        items,
        cashCount,
        revisions,
      };

      return {
        success: true,
        data: session,
      };
    } catch (err: any) {
      return { success: false, error: OfferingService.mapDatabaseError(err) };
    }
  }

  /**
   * 9. List offering sessions for a church.
   */
  async listSessions(
    churchId: string,
    status?: OfferingSessionStatus
  ): Promise<OfferingServiceResult<OfferingSession[]>> {
    try {
      let query = this.supabase
        .from("offering_sessions" as any)
        .select(`
          id,
          church_id,
          service_date,
          service_name,
          status,
          expected_cash_amount,
          expected_transfer_amount,
          expected_qr_amount,
          expected_total_amount,
          counted_cash_amount,
          cash_variance_amount,
          variance_status,
          created_at,
          updated_at
        `)
        .eq("church_id", churchId)
        .order("service_date", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) {
        return { success: false, error: OfferingService.mapDatabaseError(error) };
      }

      const sessions: OfferingSession[] = (data || []).map((s: any) => ({
        id: s.id,
        churchId: s.church_id,
        serviceDate: s.service_date,
        serviceName: s.service_name,
        status: s.status as OfferingSessionStatus,
        expectedCashAmount: Money.from(s.expected_cash_amount || 0),
        expectedTransferAmount: Money.from(s.expected_transfer_amount || 0),
        expectedQrAmount: Money.from(s.expected_qr_amount || 0),
        expectedTotalAmount: Money.from(s.expected_total_amount || 0),
        countedCashAmount: s.counted_cash_amount ? Money.from(s.counted_cash_amount) : null,
        cashVarianceAmount: s.cash_variance_amount !== null && s.cash_variance_amount !== undefined
          ? Money.from(s.cash_variance_amount)
          : null,
        varianceStatus: s.variance_status,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      }));

      return {
        success: true,
        data: sessions,
      };
    } catch (err: any) {
      return { success: false, error: OfferingService.mapDatabaseError(err) };
    }
  }
}
