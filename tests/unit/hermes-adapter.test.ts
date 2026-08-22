import { describe, it, expect } from "vitest";
import { HermesGraceLedgerAdapter } from "../../src/lib/hermes/hermes-adapter";

describe("REAL-16: Hermes Grace Ledger Gateway API Adapter", () => {
  const dummyChurchId = "00000000-0000-0000-0000-000000000001";
  const dummyUserId = "00000000-0000-0000-0000-000000000002";
  const foreignChurchId = "00000000-0000-0000-0000-000000000099";

  const fundGeneralId = "00000000-0000-0000-0000-000000000010";
  const fundMissionId = "00000000-0000-0000-0000-000000000011";

  function createMockSupabase(options?: { userRole?: string; userChurchId?: string }) {
    const role = options?.userRole || "treasurer";
    const churchId = options?.userChurchId || dummyChurchId;

    const confirmations = new Map<string, any>();

    const client = {
      confirmations,
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: dummyUserId } }, error: null }),
        getSession: () => Promise.resolve({ data: { session: { user: { id: dummyUserId } } }, error: null }),
      },
      from: (table: string) => {
        let filterId: string | null = null;
        const query: any = {
          select: () => query,
          insert: () => query,
          update: () => query,
          delete: () => query,
          eq: (col: string, val: any) => {
            if (col === "id") filterId = val;
            return query;
          },
          neq: () => query,
          gte: () => query,
          lte: () => query,
          order: () => query,
          limit: () => query,
          single: () => {
            if (table === "profiles") {
              return Promise.resolve({
                data: { id: dummyUserId, church_id: churchId, role },
                error: null,
              });
            }
            if (table === "funds") {
              const fId = filterId || fundGeneralId;
              return Promise.resolve({
                data: { id: fId, church_id: dummyChurchId, name: "กองทุนทั่วไป", current_balance: 100000, is_active: true },
                error: null,
              });
            }
            if (table === "action_confirmations") {
              const conf = filterId ? confirmations.get(filterId) : null;
              return Promise.resolve({
                data: conf || {
                  id: "conf-123",
                  nonce: "nonce_1234567890123456",
                  payload_hash: "0".repeat(64),
                  expires_at: new Date(Date.now() + 300000).toISOString(),
                  action: "fund_transfer",
                },
                error: null,
              });
            }
            return Promise.resolve({ data: null, error: null });
          },
          maybeSingle: () => {
            if (table === "user_roles") {
              return Promise.resolve({ data: { role }, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          },
          then: (resolve: any) => {
            if (table === "transactions") {
              return resolve({
                data: [
                  { id: "t1", amount: 5000, direction: "income", status: "posted", transaction_date: "2026-08-01" },
                ],
                error: null,
              });
            }
            return resolve({ data: [], error: null });
          },
        };
        return query;
      },
      rpc: (fn: string, args: any) => {
        if (fn === "create_action_confirmation") {
          const confId = `conf-${Date.now()}`;
          const exp = new Date(Date.now() + 300000).toISOString();
          confirmations.set(confId, {
            id: confId,
            church_id: args.p_church_id,
            action: args.p_action,
            nonce: args.p_nonce,
            payload_hash: args.p_payload_hash,
            status: "pending",
            expires_at: exp,
          });
          return Promise.resolve({ data: { confirmation_id: confId, expires_at: exp }, error: null });
        }
        if (fn === "execute_confirmed_financial_action") {
          return Promise.resolve({
            data: {
              success: true,
              code: "SUCCESS",
              message: "ดำเนินการตามคำขอยืนยันเรียบร้อยแล้ว",
              action: "fund_transfer",
              resource_id: "res-123",
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
    };

    return { client: client as any, confirmations };
  }

  it("rejects tool calls with missing session credentials", async () => {
    const { client } = createMockSupabase();
    const adapter = new HermesGraceLedgerAdapter(client);

    const res = await adapter.handleHermesToolCall({
      channel: "telegram",
      session_user_id: "",
      session_church_id: "",
      tool_name: "get_financial_summary",
      parameters: { period: "2026-08" },
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe("denied");
    expect(res.code).toBe("UNAUTHORIZED_HERMES_SESSION");
  });

  it("rejects tool calls when session church does not match user profile", async () => {
    const { client } = createMockSupabase({ userChurchId: dummyChurchId });
    const adapter = new HermesGraceLedgerAdapter(client);

    const res = await adapter.handleHermesToolCall({
      channel: "telegram",
      session_user_id: dummyUserId,
      session_church_id: foreignChurchId, // Tampered church claim
      tool_name: "get_financial_summary",
      parameters: { period: "2026-08" },
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe("denied");
    expect(res.code).toBe("CROSS_TENANT_OR_USER_MISMATCH");
  });

  it("handles READ tool calls and returns financial information safely", async () => {
    const { client } = createMockSupabase();
    const adapter = new HermesGraceLedgerAdapter(client);

    const res = await adapter.handleHermesToolCall({
      channel: "telegram",
      session_user_id: dummyUserId,
      session_church_id: dummyChurchId,
      tool_name: "get_financial_summary",
      parameters: { period: "2026-08" },
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe("executed");
    expect(res.data).toBeDefined();
  });

  it("handles ACTION_PROPOSAL tool calls and returns formatted proposal with confirmation URL", async () => {
    const { client } = createMockSupabase();
    const adapter = new HermesGraceLedgerAdapter(client);

    const res = await adapter.handleHermesToolCall({
      channel: "telegram",
      session_user_id: dummyUserId,
      session_church_id: dummyChurchId,
      tool_name: "propose_fund_transfer",
      parameters: {
        from_fund_id: fundGeneralId,
        to_fund_id: fundMissionId,
        amount: "5000.00",
        reason: "งบประมาณสนับสนุนพันธกิจ",
      },
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe("requires_confirmation");
    expect(res.code).toBe("CONFIRMATION_REQUIRED");
    expect(res.proposal).toBeDefined();
    expect(res.proposal?.confirmation_url).toContain("https://ledger.grace.church/confirm?id=");
    expect(res.proposal?.requires_human_confirmation).toBe(true);
  });

  it("handles execute_confirmed_action when valid human confirmation parameters are supplied", async () => {
    const { client } = createMockSupabase();
    const adapter = new HermesGraceLedgerAdapter(client);

    const res = await adapter.handleHermesToolCall({
      channel: "telegram",
      session_user_id: dummyUserId,
      session_church_id: dummyChurchId,
      tool_name: "execute_confirmed_action",
      parameters: {
        confirmation_id: "conf-123",
        nonce: "nonce_1234567890123456",
        payload_hash: "0".repeat(64),
      },
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe("executed");
    expect(res.message).toBe("ดำเนินการตามคำขอยืนยันเรียบร้อยแล้ว");
  });
});
