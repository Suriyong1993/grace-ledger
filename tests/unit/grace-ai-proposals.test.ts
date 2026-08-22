import { describe, it, expect } from "vitest";
import { GraceAiProposalService, ActionProposalUiCardSchema } from "../../src/lib/ai/grace-ai-proposals";

describe("Grace AI ACTION PROPOSAL Generation — Security & Zero Execution Tests", () => {
  const dummyChurchId = "00000000-0000-0000-0000-000000000001";
  const dummyOtherChurchId = "00000000-0000-0000-0000-000000000099";
  const dummyUserId = "00000000-0000-0000-0000-000000000002";
  const dummyTxnId = "00000000-0000-0000-0000-000000000010";
  const dummyPostedTxnId = "00000000-0000-0000-0000-000000000011";
  const dummyFundA = "00000000-0000-0000-0000-000000000020";
  const dummyFundB = "00000000-0000-0000-0000-000000000021";

  function createMockSupabase(options: {
    authenticated?: boolean;
    role?: string;
    churchId?: string;
  }) {
    const auditLogs: any[] = [];
    const confirmationRecords: any[] = [];
    const rpcCalls: { fn: string; args: any }[] = [];

    const transactions = [
      {
        id: dummyTxnId,
        church_id: dummyChurchId,
        amount: "15000.00",
        direction: "income",
        status: "approved",
        description: "เงินถวายพิเศษพันธกิจ",
        categories: { name: "เงินถวายพิเศษ" },
        accounts: { name: "ธนาคารกรุงเทพ" },
      },
      {
        id: dummyPostedTxnId,
        church_id: dummyChurchId,
        amount: "8500.00",
        direction: "expense",
        status: "posted",
        description: "ค่าซ่อมแซมระบบเสียง",
        categories: { name: "ซ่อมบำรุง" },
        accounts: { name: "เงินสดย่อย" },
      },
    ];

    const funds = [
      { id: dummyFundA, church_id: dummyChurchId, name: "กองทุนทั่วไป", current_balance: "150000.00" },
      { id: dummyFundB, church_id: dummyChurchId, name: "กองทุนพันธกิจ", current_balance: "60000.00" },
    ];

    const client = {
      auditLogs,
      confirmationRecords,
      rpcCalls,
      auth: {
        getUser: () =>
          options.authenticated !== false
            ? Promise.resolve({ data: { user: { id: dummyUserId } }, error: null })
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
                      id: dummyUserId,
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
              return { select: () => ({ single: () => Promise.resolve({ data: { id: "audit-1" }, error: null }) }) };
            },
          };
        }
        if (table === "transactions") {
          return {
            select: () => ({
              eq: (_col1: string, val1: string) => ({
                eq: (_col2: string, val2: string) => ({
                  single: () => {
                    const found = transactions.find((t) => t.id === val1 && t.church_id === val2);
                    return Promise.resolve({ data: found || null, error: found ? null : { message: "Not found" } });
                  },
                }),
              }),
            }),
          };
        }
        if (table === "funds") {
          return {
            select: () => ({
              eq: (_col1: string, val1: string) => ({
                eq: (_col2: string, val2: string) => ({
                  single: () => {
                    const found = funds.find((f) => f.id === val1 && f.church_id === val2);
                    return Promise.resolve({ data: found || null, error: found ? null : { message: "Not found" } });
                  },
                }),
              }),
            }),
          };
        }
        if (table === "action_confirmations") {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                single: () => {
                  const found = confirmationRecords.find((c) => c.id === val);
                  return Promise.resolve({ data: found || null, error: null });
                },
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      },
      rpc: (fn: string, args: any) => {
        rpcCalls.push({ fn, args });
        if (fn === "create_action_confirmation") {
          const conf = {
            id: `conf-${Date.now()}`,
            church_id: args.p_church_id,
            action: args.p_action,
            tool_name: args.p_tool_name,
            payload_hash: args.p_payload_hash,
            nonce: args.p_nonce,
            status: "pending",
            expires_at: new Date(Date.now() + 300000).toISOString(),
          };
          confirmationRecords.push(conf);
          return Promise.resolve({
            data: { confirmation_id: conf.id, expires_at: conf.expires_at, nonce: conf.nonce },
            error: null,
          });
        }
        // Critical Trap: If an execute RPC is called, throw error
        if (fn === "transfer_funds" || fn === "post_transaction" || fn === "void_transaction") {
          throw new Error(`CRITICAL VIOLATION: Financial execution RPC "${fn}" called in Proposal Generator!`);
        }
        return Promise.resolve({ data: null, error: null });
      },
    };

    return client as any;
  }

  describe("1. Action Proposals Generation & Schema Validation", () => {
    it("generates a valid Post Transaction proposal card with confirmation binding", async () => {
      const mockSupabase = createMockSupabase({ role: "treasurer" });
      const proposalService = new GraceAiProposalService(mockSupabase, dummyChurchId);

      const res = await proposalService.proposeTransactionPost({
        transaction_id: dummyTxnId,
        summary_justification: "รายการได้รับการอนุมัติจากคณะกรรมการแล้ว พร้อมโพสต์ลงบัญชี",
      });

      expect(res.success).toBe(true);
      expect(res.requires_human_confirmation).toBe(true);
      expect(res.proposal?.action).toBe("post_transaction");
      expect(res.proposal?.amount).toBe("฿15,000.00");
      expect(res.proposal?.payload_hash).toHaveLength(64);
      expect(res.proposal?.nonce).toBeDefined();

      // Validate against Zod UI Card Schema
      const parseRes = ActionProposalUiCardSchema.safeParse(res.proposal);
      expect(parseRes.success).toBe(true);
    });

    it("generates a valid Fund Transfer proposal card with projected balances", async () => {
      const mockSupabase = createMockSupabase({ role: "treasurer" });
      const proposalService = new GraceAiProposalService(mockSupabase, dummyChurchId);

      const res = await proposalService.proposeFundTransfer({
        from_fund_id: dummyFundA,
        to_fund_id: dummyFundB,
        amount: "20000.00",
        reason: "สมทบทุนพันธกิจคริสตจักรสัมพันธ์",
      });

      expect(res.success).toBe(true);
      expect(res.proposal?.action).toBe("fund_transfer");
      expect(res.proposal?.current_state.from_fund_balance).toBe("฿150,000.00");
      expect(res.proposal?.current_state.projected_from_balance).toBe("฿130,000.00");
      expect(res.proposal?.current_state.to_fund_balance).toBe("฿60,000.00");
      expect(res.proposal?.current_state.projected_to_balance).toBe("฿80,000.00");

      const parseRes = ActionProposalUiCardSchema.safeParse(res.proposal);
      expect(parseRes.success).toBe(true);
    });

    it("generates a valid Void Transaction proposal card for posted transactions", async () => {
      const mockSupabase = createMockSupabase({ role: "treasurer" });
      const proposalService = new GraceAiProposalService(mockSupabase, dummyChurchId);

      const res = await proposalService.proposeVoidTransaction({
        transaction_id: dummyPostedTxnId,
        void_reason: "บันทึกข้อมูลซ้ำซ้อนกับใบเสร็จฉบับก่อนหน้า",
      });

      expect(res.success).toBe(true);
      expect(res.proposal?.action).toBe("void_transaction");
      expect(res.proposal?.amount).toBe("฿8,500.00");
      expect(res.proposal?.summary).toContain("Reversal Mirror Entry");

      const parseRes = ActionProposalUiCardSchema.safeParse(res.proposal);
      expect(parseRes.success).toBe(true);
    });
  });

  describe("2. CRITICAL PROOF: Zero Execution Guarantee", () => {
    it("CRITICAL PROOF 1: propose_fund_transfer() NEVER calls transfer_funds() RPC", async () => {
      const mockSupabase = createMockSupabase({ role: "treasurer" });
      const proposalService = new GraceAiProposalService(mockSupabase, dummyChurchId);

      await proposalService.proposeFundTransfer({
        from_fund_id: dummyFundA,
        to_fund_id: dummyFundB,
        amount: "5000.00",
        reason: "ทดสอบการสร้างข้อเสนอ",
      });

      const executeCalls = mockSupabase.rpcCalls.filter((c: any) => c.fn === "transfer_funds");
      expect(executeCalls).toHaveLength(0);
    });

    it("CRITICAL PROOF 2: propose_transaction_post() NEVER calls post_transaction() RPC", async () => {
      const mockSupabase = createMockSupabase({ role: "treasurer" });
      const proposalService = new GraceAiProposalService(mockSupabase, dummyChurchId);

      await proposalService.proposeTransactionPost({
        transaction_id: dummyTxnId,
        summary_justification: "ทดสอบการสร้างข้อเสนอโพสต์",
      });

      const executeCalls = mockSupabase.rpcCalls.filter((c: any) => c.fn === "post_transaction");
      expect(executeCalls).toHaveLength(0);
    });

    it("CRITICAL PROOF 3: propose_void_transaction() NEVER calls void_transaction() RPC", async () => {
      const mockSupabase = createMockSupabase({ role: "treasurer" });
      const proposalService = new GraceAiProposalService(mockSupabase, dummyChurchId);

      await proposalService.proposeVoidTransaction({
        transaction_id: dummyPostedTxnId,
        void_reason: "ทดสอบการสร้างข้อเสนอยกเลิก",
      });

      const executeCalls = mockSupabase.rpcCalls.filter((c: any) => c.fn === "void_transaction");
      expect(executeCalls).toHaveLength(0);
    });
  });

  describe("3. Security & Resource State Protections", () => {
    it("DENIES propose_transaction_post when transaction is already posted", async () => {
      const mockSupabase = createMockSupabase({ role: "treasurer" });
      const proposalService = new GraceAiProposalService(mockSupabase, dummyChurchId);

      const res = await proposalService.proposeTransactionPost({
        transaction_id: dummyPostedTxnId, // Already posted
        summary_justification: "พยายามโพสต์ซ้ำ",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_RESOURCE_STATE");
    });

    it("DENIES propose_void_transaction when transaction is not in posted status", async () => {
      const mockSupabase = createMockSupabase({ role: "treasurer" });
      const proposalService = new GraceAiProposalService(mockSupabase, dummyChurchId);

      const res = await proposalService.proposeVoidTransaction({
        transaction_id: dummyTxnId, // Status is 'approved', not 'posted'
        void_reason: "พยายามยกเลิกรายการที่ยังไม่ได้โพสต์",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_RESOURCE_STATE");
    });

    it("DENIES proposal creation when user has unauthorized role (e.g. member)", async () => {
      const mockSupabase = createMockSupabase({ role: "member" });
      const proposalService = new GraceAiProposalService(mockSupabase, dummyChurchId);

      const res = await proposalService.proposeFundTransfer({
        from_fund_id: dummyFundA,
        to_fund_id: dummyFundB,
        amount: "5000.00",
        reason: "สมาชิกพยายามเสนอโอนเงิน",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("PERMISSION_DENIED");
    });

    it("DENIES proposal when resource belongs to a different church (Tenant Isolation)", async () => {
      const mockSupabase = createMockSupabase({ role: "treasurer", churchId: dummyChurchId });
      const proposalService = new GraceAiProposalService(mockSupabase, dummyOtherChurchId);

      const res = await proposalService.proposeTransactionPost({
        transaction_id: dummyTxnId,
        summary_justification: "พยายามโพสต์ข้ามคริสตจักร",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("TRANSACTION_NOT_FOUND");
    });

    it("verifies dual-actor audit log is recorded on proposal generation", async () => {
      const mockSupabase = createMockSupabase({ role: "treasurer" });
      const proposalService = new GraceAiProposalService(mockSupabase, dummyChurchId);

      await proposalService.proposeTransactionPost({
        transaction_id: dummyTxnId,
        summary_justification: "บันทึก Audit การเสนอโพสต์",
      });

      expect(mockSupabase.auditLogs.length).toBeGreaterThan(0);
      const audit = mockSupabase.auditLogs[0];
      expect(audit.actor_id).toBe(dummyUserId);
      expect(audit.metadata.tool_name).toBe("propose_transaction_post");
      expect(audit.metadata.result).toBe("SUCCESS");
    });
  });
});
