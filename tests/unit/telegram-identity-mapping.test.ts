import { describe, it, expect } from "vitest";
import { TelegramIdentityService } from "../../src/lib/hermes/telegram-identity-mapping";

describe("REAL-19: Telegram Identity Mapping & Verification", () => {
  const dummyChurchId = "00000000-0000-0000-0000-000000000001";
  const dummyUserId = "00000000-0000-0000-0000-000000000002";
  const dummyTelegramId = 987654321;

  function createMockSupabase() {
    const linkRequests = new Map<string, any>();
    const userMappings = new Map<number, any>();
    const auditLogs: any[] = [];

    const client = {
      linkRequests,
      userMappings,
      auditLogs,
      from: (table: string) => {
        let tokenOrOtpFilter: string | null = null;
        let telegramUserIdFilter: number | null = null;
        let userIdFilter: string | null = null;
        let isDelete = false;

        const query: any = {
          select: () => query,
          insert: (payload: any) => {
            if (table === "telegram_link_requests") linkRequests.set(payload.otp, payload);
            if (table === "audit_logs") auditLogs.push(payload);
            return query;
          },
          upsert: (payload: any) => {
            if (table === "telegram_user_mappings") userMappings.set(payload.telegram_user_id, payload);
            return query;
          },
          update: (payload: any) => {
            if (table === "telegram_link_requests") {
              const req = Array.from(linkRequests.values()).find(
                (r) => r.token === tokenOrOtpFilter || r.otp === tokenOrOtpFilter
              );
              if (req) Object.assign(req, payload);
            }
            return query;
          },
          delete: () => {
            isDelete = true;
            return query;
          },
          eq: (col: string, val: any) => {
            if (col === "telegram_user_id") {
              telegramUserIdFilter = Number(val);
              if (isDelete && table === "telegram_user_mappings") {
                userMappings.delete(telegramUserIdFilter);
              }
            } else if (col === "id") {
              userIdFilter = String(val);
            } else if (col === "token" || col === "otp") {
              tokenOrOtpFilter = String(val);
            }
            return query;
          },
          or: (expr: string) => {
            const match = expr.match(/otp\.eq\.([^,]+)/);
            if (match) tokenOrOtpFilter = match[1];
            return query;
          },
          gt: () => query,
          order: () => query,
          limit: () => query,
          single: () => {
            if (table === "telegram_link_requests") {
              const req = Array.from(linkRequests.values()).find(
                (r) => (r.otp === tokenOrOtpFilter || r.token === tokenOrOtpFilter) && !r.is_used
              );
              return Promise.resolve({ data: req || null, error: req ? null : { message: "Not found" } });
            }
            if (table === "profiles") {
              return Promise.resolve({
                data: { id: userIdFilter || dummyUserId, church_id: dummyChurchId, role: "treasurer" },
                error: null,
              });
            }
            if (table === "telegram_user_mappings") {
              const map = userMappings.get(telegramUserIdFilter || dummyTelegramId);
              return Promise.resolve({ data: map || null, error: map ? null : { message: "Not found" } });
            }
            return Promise.resolve({ data: null, error: null });
          },
        };
        return query;
      },
    };

    return { client: client as any, linkRequests, userMappings, auditLogs };
  }

  it("generates a secure 6-digit OTP link request with 5-minute TTL", async () => {
    const { client, linkRequests } = createMockSupabase();
    const service = new TelegramIdentityService(client);

    const res = await service.generateLinkRequest({
      telegram_user_id: dummyTelegramId,
      telegram_username: "treasurer_john",
    });

    expect(res.success).toBe(true);
    expect(res.linkToken?.otp).toHaveLength(6);
    expect(res.linkToken?.token).toContain("tok_");
    expect(linkRequests.size).toBe(1);
  });

  it("verifies and binds Telegram account to authenticated Grace Ledger profile", async () => {
    const { client, userMappings, auditLogs } = createMockSupabase();
    const service = new TelegramIdentityService(client);

    // 1. Generate Link OTP
    const genRes = await service.generateLinkRequest({
      telegram_user_id: dummyTelegramId,
      telegram_username: "treasurer_john",
    });
    const otp = genRes.linkToken!.otp;

    // 2. Bind Account
    const bindRes = await service.verifyAndBindAccount({
      otpOrToken: otp,
      authenticatedUserId: dummyUserId,
    });

    expect(bindRes.success).toBe(true);
    expect(bindRes.role).toBe("treasurer");
    expect(userMappings.get(dummyTelegramId)?.user_id).toBe(dummyUserId);
    expect(auditLogs.some((l) => l.action === "TELEGRAM_ACCOUNT_LINKED")).toBe(true);
  });

  it("resolves linked user identity and permissions for Telegram interactions", async () => {
    const { client } = createMockSupabase();
    const service = new TelegramIdentityService(client);

    const genRes = await service.generateLinkRequest({
      telegram_user_id: dummyTelegramId,
      telegram_username: "treasurer_john",
    });
    await service.verifyAndBindAccount({
      otpOrToken: genRes.linkToken!.otp,
      authenticatedUserId: dummyUserId,
    });

    const resolveRes = await service.resolveTelegramUser(dummyTelegramId);
    expect(resolveRes.isLinked).toBe(true);
    expect(resolveRes.mapping?.user_id).toBe(dummyUserId);
    expect(resolveRes.mapping?.role).toBe("treasurer");
  });

  it("returns unlinked prompt when Telegram user is unknown", async () => {
    const { client } = createMockSupabase();
    const service = new TelegramIdentityService(client);

    const resolveRes = await service.resolveTelegramUser(111222333);
    expect(resolveRes.isLinked).toBe(false);
    expect(resolveRes.message).toContain("กรุณาพิมพ์ /link เพื่อเชื่อมต่อบัญชี");
  });

  it("unlinks Telegram account cleanly and logs security audit", async () => {
    const { client, userMappings, auditLogs } = createMockSupabase();
    const service = new TelegramIdentityService(client);

    const genRes = await service.generateLinkRequest({
      telegram_user_id: dummyTelegramId,
    });
    await service.verifyAndBindAccount({
      otpOrToken: genRes.linkToken!.otp,
      authenticatedUserId: dummyUserId,
    });

    const unlinkRes = await service.unlinkTelegramAccount(dummyTelegramId);
    expect(unlinkRes.success).toBe(true);
    expect(userMappings.has(dummyTelegramId)).toBe(false);
    expect(auditLogs.some((l) => l.action === "TELEGRAM_ACCOUNT_UNLINKED")).toBe(true);
  });
});
