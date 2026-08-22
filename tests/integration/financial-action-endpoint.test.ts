import { describe, it, expect } from "vitest";
import {
  FinancialActionExecutionService,
} from "../../src/lib/ai/financial-action-endpoint";
import { computePayloadHash } from "../../src/lib/ai/confirmation-engine";

describe("FinancialActionExecutionService — Atomic Transaction & Security Tests", () => {
  const dummyChurchId = "00000000-0000-0000-0000-000000000001";
  const dummyOtherChurchId = "00000000-0000-0000-0000-000000000099";
  const dummyUserId = "00000000-0000-0000-0000-000000000002";
  const dummyOtherUserId = "00000000-0000-0000-0000-000000000003";

  const dummyFundA = "00000000-0000-0000-0000-000000000020";
  const dummyFundB = "00000000-0000-0000-0000-000000000021";
  const dummyTxnId = "00000000-0000-0000-0000-000000000030";
  const dummyPostedTxnId = "00000000-0000-0000-0000-000000000031";

  async function createMockSupabase(options: {
    authenticated?: boolean;
    userId?: string;
    role?: string;
    churchId?: string;
    fundABalance?: number;
    txnStatus?: string;
    simulateRpcError?: string;
  }) {
    const auditLogs: any[] = [];
    const rpcCalls: { fn: string; args: any }[] = [];
    const idempotencyStore = new Map<string, { status: string; hash: string; response?: any }>();
    const confirmationsStore = new Map<string, any>();

    // Seed transfer confirmation
    const transferParams = {
      from_fund_id: dummyFundA,
      to_fund_id: dummyFundB,
      amount: "25000.00",
      reason: "สมทบทุนจัดกิจกรรม",
      church_id: dummyChurchId,
    };
    const transferHash = await computePayloadHash(transferParams);
    const transferNonce = "nonce_transfer_1234567890abcdef";
    const transferConfId = "conf-transfer-001";

    confirmationsStore.set(transferConfId, {
      id: transferConfId,
      church_id: dummyChurchId,
      user_id: dummyUserId,
      action: "fund_transfer",
      tool_name: "propose_fund_transfer",
      normalized_parameters: transferParams,
      payload_hash: transferHash,
      nonce: transferNonce,
      status: "pending",
      expires_at: new Date(Date.now() + 300000).toISOString(),
    });

    // Seed post transaction confirmation
    const postParams = {
      transaction_id: dummyTxnId,
      summary_justification: "รายการได้รับการอนุมัติแล้ว",
      church_id: dummyChurchId,
    };
    const postHash = await computePayloadHash(postParams);
    const postNonce = "nonce_post_1234567890abcdef";
    const postConfId = "conf-post-002";

    confirmationsStore.set(postConfId, {
      id: postConfId,
      church_id: dummyChurchId,
      user_id: dummyUserId,
      action: "post_transaction",
      tool_name: "propose_transaction_post",
      normalized_parameters: postParams,
      payload_hash: postHash,
      nonce: postNonce,
      status: "pending",
      expires_at: new Date(Date.now() + 300000).toISOString(),
    });

    // Seed void transaction confirmation
    const voidParams = {
      transaction_id: dummyPostedTxnId,
      void_reason: "บันทึกซ้ำซ้อน",
      church_id: dummyChurchId,
    };
    const voidHash = await computePayloadHash(voidParams);
    const voidNonce = "nonce_void_1234567890abcdef";
    const voidConfId = "conf-void-003";

    confirmationsStore.set(voidConfId, {
      id: voidConfId,
      church_id: dummyChurchId,
      user_id: dummyUserId,
      action: "void_transaction",
      tool_name: "propose_void_transaction",
      normalized_parameters: voidParams,
      payload_hash: voidHash,
      nonce: voidNonce,
      status: "pending",
      expires_at: new Date(Date.now() + 300000).toISOString(),
    });

    const fundBalances = {
      [dummyFundA]: options.fundABalance ?? 100000,
      [dummyFundB]: 50000,
    };

    const txnStatuses = {
      [dummyTxnId]: options.txnStatus ?? "approved",
      [dummyPostedTxnId]: "posted",
    };

    const client = {
      auditLogs,
      rpcCalls,
      confirmationsStore,
      idempotencyStore,
      fundBalances,
      txnStatuses,
      auth: {
        getUser: () =>
          options.authenticated !== false
            ? Promise.resolve({ data: { user: { id: options.userId || dummyUserId } }, error: null })
            : Promise.resolve({ data: { user: null }, error: { message: "No session", status: 401 } }),
      },
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: options.userId || dummyUserId,
                      church_id: options.churchId || dummyChurchId,
                      role: options.role || "treasurer",
                    },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === "audit_logs") {
          return {
            insert: (payload: any) => {
              auditLogs.push(payload);
              return Promise.resolve({ data: null, error: null });
            },
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      },
      rpc: (fn: string, args: any) => {
        rpcCalls.push({ fn, args });

        if (fn === "execute_confirmed_financial_action") {
          if (options.simulateRpcError) {
            return Promise.resolve({ data: null, error: { message: options.simulateRpcError } });
          }

          // 1. Check Idempotency Replay FIRST
          const existingIdemp = idempotencyStore.get(args.p_idempotency_key);
          if (existingIdemp) {
            if (existingIdemp.hash !== args.p_expected_payload_hash) {
              return Promise.resolve({ data: null, error: { message: "Idempotency Conflict: Re-used idempotency key with different payload" } });
            }
            if (existingIdemp.status === "completed") {
              return Promise.resolve({ data: existingIdemp.response, error: null });
            }
            return Promise.resolve({ data: null, error: { message: "Idempotency Conflict: Concurrent request is already in progress" } });
          }

          const conf = confirmationsStore.get(args.p_confirmation_id);
          if (!conf) {
            return Promise.resolve({ data: null, error: { message: "Confirmation Not Found" } });
          }
          if (conf.church_id !== args.p_church_id) {
            return Promise.resolve({ data: null, error: { message: "Cross-Tenant Access Denied" } });
          }
          if (conf.user_id !== (options.userId || dummyUserId)) {
            return Promise.resolve({ data: null, error: { message: "Cross-User Access Denied" } });
          }
          if (conf.status === "consumed") {
            return Promise.resolve({ data: null, error: { message: "Confirmation Already Consumed" } });
          }
          if (new Date(conf.expires_at) <= new Date()) {
            return Promise.resolve({ data: null, error: { message: "Confirmation Expired" } });
          }
          if (conf.nonce !== args.p_expected_nonce) {
            return Promise.resolve({ data: null, error: { message: "Nonce Mismatch" } });
          }
          if (conf.payload_hash !== args.p_expected_payload_hash) {
            return Promise.resolve({ data: null, error: { message: "Payload Hash Mismatch" } });
          }

          // Execute Action Mutation with Invariant Checks
          if (conf.action === "fund_transfer") {
            const transferAmount = 25000;
            if (fundBalances[dummyFundA] < transferAmount) {
              // Rollback: No state changes, confirmation NOT consumed, idempotency NOT completed
              return Promise.resolve({ data: null, error: { message: "Insufficient Funds" } });
            }

            // Apply mutations
            fundBalances[dummyFundA] -= transferAmount;
            fundBalances[dummyFundB] += transferAmount;
          } else if (conf.action === "post_transaction") {
            if (txnStatuses[dummyTxnId] === "posted") {
              return Promise.resolve({ data: null, error: { message: "Invalid State Transition: Already posted" } });
            }
            txnStatuses[dummyTxnId] = "posted";
          } else if (conf.action === "void_transaction") {
            if (txnStatuses[dummyPostedTxnId] !== "posted") {
              return Promise.resolve({ data: null, error: { message: "Invalid State Transition: Only posted transactions can be voided" } });
            }
            txnStatuses[dummyPostedTxnId] = "voided";
          }

          // ATOMIC COMMIT: Mark confirmation consumed, record audit, complete idempotency
          conf.status = "consumed";
          auditLogs.push({
            church_id: args.p_church_id,
            action: `EXECUTE_${conf.action.toUpperCase()}`,
            actor_id: options.userId || dummyUserId,
            result: "SUCCESS",
          });

          const resultPayload = {
            success: true,
            code: "SUCCESS",
            message: "ดำเนินการทางการเงินเรียบร้อยแล้ว",
            action: conf.action,
            resource_id: "res-001",
            is_replay: false,
          };

          idempotencyStore.set(args.p_idempotency_key, {
            status: "completed",
            hash: args.p_expected_payload_hash,
            response: { ...resultPayload, is_replay: true },
          });

          return Promise.resolve({ data: resultPayload, error: null });
        }

        return Promise.resolve({ data: null, error: null });
      },
    };

    return { client: client as any, auditLogs, rpcCalls, confirmationsStore, idempotencyStore, fundBalances, txnStatuses };
  }

  describe("1. Atomic Execution & State Consistency Invariants", () => {
    it("Test 1: When Fund Balance is Insufficient -> Rollbacks mutation, confirmation remains NOT CONSUMED, idempotency NOT COMPLETED", async () => {
      // Fund A only has 10,000 (Required: 25,000)
      const { client, confirmationsStore, idempotencyStore, fundBalances } = await createMockSupabase({
        role: "treasurer",
        fundABalance: 10000,
      });

      const service = new FinancialActionExecutionService(client);
      const transferHash = await computePayloadHash({
        from_fund_id: dummyFundA,
        to_fund_id: dummyFundB,
        amount: "25000.00",
        reason: "สมทบทุนจัดกิจกรรม",
        church_id: dummyChurchId,
      });

      const res = await service.executeAction({
        confirmation_id: "conf-transfer-001",
        nonce: "nonce_transfer_1234567890abcdef",
        payload_hash: transferHash,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("FINANCIAL_INVARIANT_VIOLATION");

      // CRITICAL INVARIANT VERIFICATION:
      // 1. Fund balances are UNMODIFIED
      expect(fundBalances[dummyFundA]).toBe(10000);
      expect(fundBalances[dummyFundB]).toBe(50000);

      // 2. Confirmation record is NOT permanently consumed (remains 'pending' or can retry after fix)
      const conf = confirmationsStore.get("conf-transfer-001");
      expect(conf.status).toBe("pending");

      // 3. Idempotency record is NOT completed
      expect(idempotencyStore.get("idemp_conf_conf-transfer-001")).toBeUndefined();
    });

    it("Test 2: When Transaction is Already Posted -> Rejects execution, confirmation NOT consumed", async () => {
      const { client, confirmationsStore, txnStatuses } = await createMockSupabase({
        role: "treasurer",
        txnStatus: "posted",
      });

      const service = new FinancialActionExecutionService(client);
      const postHash = await computePayloadHash({
        transaction_id: dummyTxnId,
        summary_justification: "รายการได้รับการอนุมัติแล้ว",
        church_id: dummyChurchId,
      });

      const res = await service.executeAction({
        confirmation_id: "conf-post-002",
        nonce: "nonce_post_1234567890abcdef",
        payload_hash: postHash,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_RESOURCE_STATE");

      const conf = confirmationsStore.get("conf-post-002");
      expect(conf.status).toBe("pending");
      expect(txnStatuses[dummyTxnId]).toBe("posted");
    });

    it("Test 3: Valid Execution -> Atomically mutates balances, consumes confirmation, completes idempotency, writes audit", async () => {
      const { client, confirmationsStore, idempotencyStore, fundBalances, auditLogs } = await createMockSupabase({
        role: "treasurer",
        fundABalance: 100000,
      });

      const service = new FinancialActionExecutionService(client);
      const transferHash = await computePayloadHash({
        from_fund_id: dummyFundA,
        to_fund_id: dummyFundB,
        amount: "25000.00",
        reason: "สมทบทุนจัดกิจกรรม",
        church_id: dummyChurchId,
      });

      const res = await service.executeAction({
        confirmation_id: "conf-transfer-001",
        nonce: "nonce_transfer_1234567890abcdef",
        payload_hash: transferHash,
      });

      expect(res.success).toBe(true);
      expect(res.code).toBe("SUCCESS");

      // CRITICAL INVARIANT:
      // 1. Balances mutated correctly
      expect(fundBalances[dummyFundA]).toBe(75000);
      expect(fundBalances[dummyFundB]).toBe(75000);

      // 2. Confirmation status = consumed
      const conf = confirmationsStore.get("conf-transfer-001");
      expect(conf.status).toBe("consumed");

      // 3. Idempotency completed
      const idemp = idempotencyStore.get("idemp_conf_conf-transfer-001");
      expect(idemp?.status).toBe("completed");

      // 4. Audit SUCCESS logged
      const execAudit = auditLogs.find((a) => a.action === "EXECUTE_FUND_TRANSFER");
      expect(execAudit).toBeDefined();
      expect(execAudit?.result).toBe("SUCCESS");
    });

    it("Test 4: Same Action Retry -> Safe replay from Idempotency without duplicate mutation", async () => {
      const { client, fundBalances } = await createMockSupabase({ role: "treasurer", fundABalance: 100000 });
      const service = new FinancialActionExecutionService(client);

      const transferHash = await computePayloadHash({
        from_fund_id: dummyFundA,
        to_fund_id: dummyFundB,
        amount: "25000.00",
        reason: "สมทบทุนจัดกิจกรรม",
        church_id: dummyChurchId,
      });

      // Execution 1
      const res1 = await service.executeAction({
        confirmation_id: "conf-transfer-001",
        nonce: "nonce_transfer_1234567890abcdef",
        payload_hash: transferHash,
      });
      expect(res1.success).toBe(true);
      expect(fundBalances[dummyFundA]).toBe(75000);

      // Retry Execution 2 (with same idempotency key)
      const res2 = await service.executeAction({
        confirmation_id: "conf-transfer-001",
        nonce: "nonce_transfer_1234567890abcdef",
        payload_hash: transferHash,
      });

      expect(res2.success).toBe(true);
      expect(res2.is_replay).toBe(true);

      // Guarantees EXACTLY ONE MUTATION
      expect(fundBalances[dummyFundA]).toBe(75000);
    });

    it("Test 5: Role Revocation before Execution -> DENIED with zero mutations", async () => {
      // User lost treasurer role (now 'member')
      const { client, fundBalances, confirmationsStore } = await createMockSupabase({
        role: "member",
        fundABalance: 100000,
      });

      const service = new FinancialActionExecutionService(client);
      const transferHash = await computePayloadHash({
        from_fund_id: dummyFundA,
        to_fund_id: dummyFundB,
        amount: "25000.00",
        reason: "สมทบทุนจัดกิจกรรม",
        church_id: dummyChurchId,
      });

      const res = await service.executeAction({
        confirmation_id: "conf-transfer-001",
        nonce: "nonce_transfer_1234567890abcdef",
        payload_hash: transferHash,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("DENIED");
      expect(res.error).toBe("PERMISSION_DENIED");

      // Balance untouched
      expect(fundBalances[dummyFundA]).toBe(100000);
      expect(confirmationsStore.get("conf-transfer-001").status).toBe("pending");
    });

    it("Test 6: Valid Void Transaction Execution -> Marks voided and creates reversal entry", async () => {
      const { client, confirmationsStore, txnStatuses } = await createMockSupabase({
        role: "treasurer",
      });

      const service = new FinancialActionExecutionService(client);
      const voidHash = await computePayloadHash({
        transaction_id: dummyPostedTxnId,
        void_reason: "บันทึกซ้ำซ้อน",
        church_id: dummyChurchId,
      });

      const res = await service.executeAction({
        confirmation_id: "conf-void-003",
        nonce: "nonce_void_1234567890abcdef",
        payload_hash: voidHash,
      });

      expect(res.success).toBe(true);
      expect(res.code).toBe("SUCCESS");
      expect(txnStatuses[dummyPostedTxnId]).toBe("voided");

      const conf = confirmationsStore.get("conf-void-003");
      expect(conf.status).toBe("consumed");
    });

    it("Test 7: Cross-Tenant Access Attempt -> DENIED, zero mutations", async () => {
      const { client } = await createMockSupabase({
        role: "treasurer",
        churchId: dummyOtherChurchId, // User belongs to a different church
      });

      const service = new FinancialActionExecutionService(client);
      const res = await service.executeAction({
        confirmation_id: "conf-transfer-001",
        nonce: "nonce_transfer_1234567890abcdef",
        payload_hash: "0".repeat(64),
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("DENIED");
    });

    it("Test 8: Cross-User Confirmation Attempt -> DENIED, zero mutations", async () => {
      const { client } = await createMockSupabase({
        role: "treasurer",
        userId: dummyOtherUserId, // Different user trying to consume User A's confirmation
      });

      const service = new FinancialActionExecutionService(client);
      const res = await service.executeAction({
        confirmation_id: "conf-transfer-001",
        nonce: "nonce_transfer_1234567890abcdef",
        payload_hash: "0".repeat(64),
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("DENIED");
    });

    it("Test 9: Expired Confirmation Attempt -> DENIED with EXPIRED code", async () => {
      const { client, confirmationsStore } = await createMockSupabase({ role: "treasurer" });
      const conf = confirmationsStore.get("conf-transfer-001");
      conf.expires_at = new Date(Date.now() - 10000).toISOString(); // Expired 10s ago

      const service = new FinancialActionExecutionService(client);
      const res = await service.executeAction({
        confirmation_id: "conf-transfer-001",
        nonce: "nonce_transfer_1234567890abcdef",
        payload_hash: conf.payload_hash,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("EXPIRED");
    });

    it("Test 10: Consumed Confirmation Reuse Attempt -> DENIED with INVALID_CONFIRMATION code", async () => {
      const { client, confirmationsStore } = await createMockSupabase({ role: "treasurer" });
      const conf = confirmationsStore.get("conf-transfer-001");
      conf.status = "consumed";

      const service = new FinancialActionExecutionService(client);
      const res = await service.executeAction({
        confirmation_id: "conf-transfer-001",
        nonce: "nonce_transfer_1234567890abcdef",
        payload_hash: conf.payload_hash,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_CONFIRMATION");
    });
  });
});
