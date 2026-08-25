import { describe, it, expect, vi } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import { fetchLoginProfiles, verifyPin } from "../../src/lib/auth/login-service";

class FakeFunctionsHttpError extends Error {
  constructor(public readonly context: Response) {
    super("edge function returned a non-2xx status code");
  }
}

function stubSupabase(invoke: ReturnType<typeof vi.fn>): SupabaseClient {
  return { functions: { invoke } } as unknown as SupabaseClient;
}

describe("fetchLoginProfiles", () => {
  it("maps a successful roster response to LoginProfile rows", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { profiles: [{ id: "p1", name: "สมชาย", role: "เหรัญญิก", initials: "สช" }] },
      error: null,
    });

    const result = await fetchLoginProfiles(stubSupabase(invoke));

    expect(result).toEqual({
      status: "ready",
      profiles: [{ id: "p1", name: "สมชาย", role: "เหรัญญิก", initials: "สช" }],
    });
    expect(invoke).toHaveBeenCalledWith("login-profiles", undefined);
  });

  it("reports an empty roster distinctly from a load failure", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { profiles: [] }, error: null });
    const result = await fetchLoginProfiles(stubSupabase(invoke));
    expect(result).toEqual({ status: "empty" });
  });

  it("reports error when the endpoint fails", async () => {
    const response = new Response(JSON.stringify({ error: "unavailable" }), { status: 503 });
    const invoke = vi.fn().mockResolvedValue({ data: null, error: new FakeFunctionsHttpError(response) });

    const result = await fetchLoginProfiles(stubSupabase(invoke));

    expect(result).toEqual({ status: "error" });
  });
});

describe("verifyPin", () => {
  it("returns session tokens on success", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3600,
        expires_at: 123,
        token_type: "bearer",
        requires_reset: false,
      },
      error: null,
    });

    const result = await verifyPin(stubSupabase(invoke), "profile-id", "123456");

    expect(result).toEqual({
      status: "success",
      accessToken: "at",
      refreshToken: "rt",
      requiresReset: false,
    });
    expect(invoke).toHaveBeenCalledWith("verify-pin", { body: { profile_id: "profile-id", pin: "123456" } });
  });

  it("returns invalid on a 401", async () => {
    const response = new Response(JSON.stringify({ error: "invalid" }), { status: 401 });
    const invoke = vi.fn().mockResolvedValue({ data: null, error: new FakeFunctionsHttpError(response) });

    const result = await verifyPin(stubSupabase(invoke), "profile-id", "000000");

    expect(result).toEqual({ status: "invalid" });
  });

  it("returns locked with the lockout timestamp on a 423", async () => {
    const response = new Response(JSON.stringify({ error: "locked", locked_until: "2026-08-25T10:00:00Z" }), {
      status: 423,
    });
    const invoke = vi.fn().mockResolvedValue({ data: null, error: new FakeFunctionsHttpError(response) });

    const result = await verifyPin(stubSupabase(invoke), "profile-id", "111111");

    expect(result).toEqual({ status: "locked", lockedUntil: "2026-08-25T10:00:00Z" });
  });

  it("returns unavailable on any other failure", async () => {
    const response = new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
    const invoke = vi.fn().mockResolvedValue({ data: null, error: new FakeFunctionsHttpError(response) });

    const result = await verifyPin(stubSupabase(invoke), "profile-id", "222222");

    expect(result).toEqual({ status: "unavailable" });
  });
});
