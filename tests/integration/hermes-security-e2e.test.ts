import { describe, it, expect } from "vitest";
import { HermesGraceLedgerAdapter } from "../../src/lib/hermes/hermes-adapter";
import { HermesGraceLedgerSkill } from "../../src/lib/hermes/grace-ledger-skill";
import { TelegramCallbackHandler } from "../../src/lib/hermes/telegram-workflow";
import { TelegramIdentityService } from "../../src/lib/hermes/telegram-identity-mapping";

describe("REAL-20: Hermes ↔ Grace Ledger End-to-End Security & Workflow Matrix", () => {
  const dummyChurchId = "00000000-0000-0000-0000-000000000001";
  const dummyTreasurerUserId = "00000000-0000-0000-0000-000000000002";
  const dummyMemberUserId = "00000000-0000-0000-0000-000000000003";

  const treasurerTelegramId = 111111;
  const memberTelegramId = 222222;
  const unlinkedTelegramId = 999999;

  const fundGeneralId = "00000000-0000-0000-0000-000000000010";
  const fundMissionId = "00000000-0000-0000-0000-000000000011";

  function createFullMockHermesEnvironment() {
    const fundBalances: Record<string, number> = {
      [fundGeneralId]: 100000,
      [fundMissionId]: 20000,
    };

    const confirmations = new Map<string, any>();
    const userMappings = new Map<number, any>([
      [
        treasurerTelegramId,
        {
          telegram_user_id: treasurerTelegramId,
          user_id: dummyTreasurerUserId,
          church_id: dummyChurchId,
          is_verified: true,
        },
      ],
      [
        memberTelegramId,
        {
          telegram_user_id: memberTelegramId,
          user_id: dummyMemberUserId,
          church_id: dummyChurchId,
          is_verified: true,
        },
      ],
    ]);

    const auditLogs: any[] = [];
    let currentAuthUser = dummyTreasurerUserId;

    const client = {
      fundBalances,
      confirmations,
      userMappings,
      auditLogs,
      setAuthUser: (uId: string) => {
        currentAuthUser = uId;
      },
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: currentAuthUser } }, error: null }),
        getSession: () => Promise.resolve({ data: { session: { user: { id: currentAuthUser } } }, error: null }),
      },
      from: (table: string) => {
        let telegramUserIdFilter: number | null = null;
        let genericIdFilter: any = null;

        const query: any = {
          select: () => query,
          insert: (payload: any) => {
            if (table === "audit_logs") auditLogs.push(payload);
            return query;
          },
          update: () => query,
          delete: () => query,
          eq: (col: string, val: any) => {
            if (col === "telegram_user_id") {
              telegramUserIdFilter = Number(val);
            } else if (col === "id") {
              genericIdFilter = val;
            }
            return query;
          },
          neq: () => query,
          gte: () => query,
          lte: () => query,
          order: () => query,
          limit: () => query,
          single: () => {
            if (table === "profiles") {
              const uId = genericIdFilter || currentAuthUser;
              const role = uId === dummyMemberUserId ? "member" : "treasurer";
              return Promise.resolve({
                data: { id: uId, church_id: dummyChurchId, role },
                error: null,
              });
            }
            if (table === "funds") {
              const fId = genericIdFilter || fundGeneralId;
              const fName = fId === fundMissionId ? "กองทุนพันธกิจ" : "กองทุนทั่วไป";
              return Promise.resolve({
                data: { id: fId, church_id: dummyChurchId, name: fName, current_balance: fundBalances[fId] ?? 0, is_active: true },
                error: null,
              });
            }
            if (table === "telegram_user_mappings") {
              const map = userMappings.get(telegramUserIdFilter || 0);
              return Promise.resolve({ data: map || null, error: map ? null : { message: "Not found" } });
            }
            if (table === "action_confirmations") {
              const conf = genericIdFilter ? confirmations.get(genericIdFilter) : null;
              return Promise.resolve({ data: conf || null, error: conf ? null : { message: "Not found" } });
            }
            return Promise.resolve({ data: null, error: null });
          },
          maybeSingle: () => {
            if (table === "user_roles") {
              const role = currentAuthUser === dummyMemberUserId ? "member" : "treasurer";
              return Promise.resolve({ data: { role }, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          },
          then: (resolve: any) => {
            if (table === "funds") {
              return resolve({
                data: [
                  { id: fundGeneralId, church_id: dummyChurchId, name: "กองทุนทั่วไป", current_balance: fundBalances[fundGeneralId], is_active: true },
                  { id: fundMissionId, church_id: dummyChurchId, name: "กองทุนพันธกิจ", current_balance: fundBalances[fundMissionId], is_active: true },
                ],
                error: null,
              });
            }
            if (table === "transactions") {
              return resolve({
                data: [
                  { id: "tx-1", amount: 10000, direction: "income", status: "posted", transaction_date: "2026-08-01" },
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
            user_id: currentAuthUser,
            action: args.p_action,
            tool_name: args.p_tool_name,
            normalized_parameters: args.p_normalized_parameters,
            payload_hash: args.p_payload_hash,
            nonce: args.p_nonce,
            status: "pending",
            expires_at: exp,
          });
          return Promise.resolve({ data: { confirmation_id: confId, expires_at: exp }, error: null });
        }
        if (fn === "execute_confirmed_financial_action") {
          const conf = confirmations.get(args.p_confirmation_id);
          if (!conf) return Promise.resolve({ data: null, error: { message: "Confirmation Not Found" } });
          if (conf.status === "consumed") return Promise.resolve({ data: null, error: { message: "Confirmation Already Consumed" } });
          if (conf.nonce !== args.p_expected_nonce) return Promise.resolve({ data: null, error: { message: "Nonce Mismatch" } });
          if (conf.payload_hash !== args.p_expected_payload_hash) return Promise.resolve({ data: null, error: { message: "Payload Hash Mismatch" } });

          if (conf.action === "fund_transfer") {
            const amount = 5000;
            if (fundBalances[fundGeneralId] < amount) {
              return Promise.resolve({ data: null, error: { message: "Insufficient Funds" } });
            }
            fundBalances[fundGeneralId] -= amount;
            fundBalances[fundMissionId] += amount;
          }

          conf.status = "consumed";
          return Promise.resolve({
            data: {
              success: true,
              code: "SUCCESS",
              message: "โอนเงินเรียบร้อยแล้ว",
              action: conf.action,
              resource_id: "res-transfer-001",
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
    };

    return { client: client as any, fundBalances, confirmations, auditLogs };
  }

  it("Step 1: Rejects unlinked Telegram user and directs to /link workflow", async () => {
    const { client } = createFullMockHermesEnvironment();
    const identityService = new TelegramIdentityService(client);

    const userRes = await identityService.resolveTelegramUser(unlinkedTelegramId);
    expect(userRes.isLinked).toBe(false);
    expect(userRes.message).toContain("/link");
  });

  it("Step 2: Authenticated Treasurer proposes fund transfer via Telegram and receives human confirmation card", async () => {
    const { client, fundBalances, confirmations } = createFullMockHermesEnvironment();
    const identityService = new TelegramIdentityService(client);
    const adapter = new HermesGraceLedgerAdapter(client);
    const skill = new HermesGraceLedgerSkill(adapter);

    // 1. Resolve linked Treasurer
    const userRes = await identityService.resolveTelegramUser(treasurerTelegramId);
    expect(userRes.isLinked).toBe(true);
    const context = {
      channel: "telegram" as const,
      userId: userRes.mapping!.user_id,
      churchId: userRes.mapping!.church_id,
    };

    // 2. Treasurer sends transfer proposal command
    const proposeTool = skill.getTools().find((t) => t.name === "gl_propose_fund_transfer")!;
    const responseText = await proposeTool.execute(
      {
        from_fund_id: fundGeneralId,
        to_fund_id: fundMissionId,
        amount: "5000.00",
        reason: "สนับสนุนค่ายเยาวชน",
      },
      context
    );

    // Invariant: Proposal created, but NO direct fund mutation has occurred yet
    expect(responseText).toContain("ต้องการการยืนยันจากมนุษย์ (ACTION PROPOSAL)");
    expect(responseText).toContain("฿5000.00");
    expect(responseText).toContain("https://ledger.grace.church/confirm?id=");
    expect(fundBalances[fundGeneralId]).toBe(100000); // Balance untouched
    expect(fundBalances[fundMissionId]).toBe(20000);  // Balance untouched
    expect(confirmations.size).toBe(1);
  });

  it("Step 3: Completes Telegram 2-Step Confirmation and executes financial mutation atomically", async () => {
    const { client, fundBalances, confirmations } = createFullMockHermesEnvironment();
    const adapter = new HermesGraceLedgerAdapter(client);
    const skill = new HermesGraceLedgerSkill(adapter);

    // 1. Propose transfer
    const proposeTool = skill.getTools().find((t) => t.name === "gl_propose_fund_transfer")!;
    await proposeTool.execute(
      {
        from_fund_id: fundGeneralId,
        to_fund_id: fundMissionId,
        amount: "5000.00",
        reason: "สนับสนุนค่ายเยาวชน",
      },
      { channel: "telegram", userId: dummyTreasurerUserId, churchId: dummyChurchId }
    );

    const confId = Array.from(confirmations.keys())[0];
    const confRecord = confirmations.get(confId);

    // 2. Treasurer clicks "✅ ยืนยันผ่าน Telegram"
    const callbackRes = await TelegramCallbackHandler.processCallback(
      {
        id: "cb-1",
        from: { id: treasurerTelegramId, first_name: "John" },
        data: `gl_confirm:${confId}:${confRecord.nonce.substring(0, 16)}`,
      },
      dummyChurchId,
      dummyTreasurerUserId,
      adapter,
      async () => ({ nonce: confRecord.nonce, payload_hash: confRecord.payload_hash })
    );

    expect(callbackRes.answer).toBe("ดำเนินการทางการเงินสำเร็จ");
    expect(callbackRes.messageUpdate).toContain("ดำเนินการทางการเงินเรียบร้อยแล้ว");

    // Invariant: Balance updated atomically
    expect(fundBalances[fundGeneralId]).toBe(95000);
    expect(fundBalances[fundMissionId]).toBe(25000);
    expect(confRecord.status).toBe("consumed");
  });

  it("Step 4: Denies confirmation reuse (Single-Use Replay Attack Defense)", async () => {
    const { client, fundBalances, confirmations } = createFullMockHermesEnvironment();
    const adapter = new HermesGraceLedgerAdapter(client);
    const skill = new HermesGraceLedgerSkill(adapter);

    // 1. Propose transfer
    const proposeTool = skill.getTools().find((t) => t.name === "gl_propose_fund_transfer")!;
    await proposeTool.execute(
      {
        from_fund_id: fundGeneralId,
        to_fund_id: fundMissionId,
        amount: "5000.00",
        reason: "งบประมาณ",
      },
      { channel: "telegram", userId: dummyTreasurerUserId, churchId: dummyChurchId }
    );

    const confId = Array.from(confirmations.keys())[0];
    const confRecord = confirmations.get(confId);

    // Attempt 1: Confirm -> SUCCESS
    await TelegramCallbackHandler.processCallback(
      { id: "cb-1", from: { id: treasurerTelegramId, first_name: "John" }, data: `gl_confirm:${confId}:${confRecord.nonce.substring(0, 16)}` },
      dummyChurchId,
      dummyTreasurerUserId,
      adapter,
      async () => ({ nonce: confRecord.nonce, payload_hash: confRecord.payload_hash })
    );
    expect(fundBalances[fundGeneralId]).toBe(95000);

    // Attempt 2: Replay same callback -> DENIED
    const replayRes = await TelegramCallbackHandler.processCallback(
      { id: "cb-2", from: { id: treasurerTelegramId, first_name: "John" }, data: `gl_confirm:${confId}:${confRecord.nonce.substring(0, 16)}` },
      dummyChurchId,
      dummyTreasurerUserId,
      adapter,
      async () => ({ nonce: confRecord.nonce, payload_hash: confRecord.payload_hash })
    );

    expect(replayRes.answer).toContain("การดำเนินการถูกปฏิเสธ");
    expect(fundBalances[fundGeneralId]).toBe(95000); // Guarantees NO second deduction
  });

  it("Step 5: Enforces RBAC defense when Member attempts to execute transfer", async () => {
    const { client, fundBalances } = createFullMockHermesEnvironment();
    client.setAuthUser(dummyMemberUserId);

    const adapter = new HermesGraceLedgerAdapter(client);
    const skill = new HermesGraceLedgerSkill(adapter);

    // Member attempts to execute confirm tool
    const confirmTool = skill.getTools().find((t) => t.name === "gl_confirm_action")!;
    const res = await confirmTool.execute(
      {
        confirmation_id: "conf-123",
        nonce: "nonce_1234567890123456",
        payload_hash: "0".repeat(64),
      },
      {
        channel: "telegram",
        userId: dummyMemberUserId,
        churchId: dummyChurchId,
      }
    );

    expect(res).toContain("❌ **เกิดข้อผิดพลาดในการดำเนินการ**");
    expect(res).toContain("คุณไม่มีสิทธิ์ในการอนุมัติหรือบันทึกรายการทางการเงินนี้");
    expect(fundBalances[fundGeneralId]).toBe(100000); // Untouched
  });
});
