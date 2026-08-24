import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Guards for the two pre-authentication Edge Functions.
 *
 * `login-profiles` and `verify-pin` run with `verify_jwt = false` — they are
 * what a person reaches before a session exists, so the platform cannot check
 * one for them. Everything that stands between the open internet and
 * `verify_and_consume_pin` is in this module, so it is tested directly.
 */

const PROJECT_URL = "https://jeklcfpqmytdmwczxqlx.supabase.co";
const PROJECT_REF = "jeklcfpqmytdmwczxqlx";

/** A legacy anon key is an unsigned-here JWT: header.payload.signature. */
function legacyAnonKey(ref: string, role = "anon"): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ iss: "supabase", ref, role })}.sig`;
}

function setEnv(values: Record<string, string>): void {
  globalThis.Deno = {
    env: { get: (key: string) => values[key] },
  };
}

// The module reads Deno.env only inside function bodies, so a default is enough
// for import time and each test can replace it.
setEnv({ SUPABASE_URL: PROJECT_URL });

const {
  clientAddress,
  createRateLimiter,
  deploymentChurchId,
  hasProjectKey,
  isPinShaped,
  isUuid,
} = await import("../../supabase/functions/_shared/deployment.ts");

beforeEach(() => {
  setEnv({ SUPABASE_URL: PROJECT_URL });
});

describe("deploymentChurchId", () => {
  it("reads the church from the Edge Function secret store", () => {
    setEnv({ DEPLOYMENT_CHURCH_ID: "11111111-1111-1111-1111-111111111111" });
    expect(deploymentChurchId()).toBe("11111111-1111-1111-1111-111111111111");
  });

  /**
   * A committed default would put a production config value in git and in every
   * clone of this repo, and a misconfigured deployment would then quietly serve
   * the wrong congregation instead of refusing to start.
   */
  it("returns null rather than falling back to a built-in church", () => {
    setEnv({ SUPABASE_URL: PROJECT_URL });
    expect(deploymentChurchId()).toBeNull();
  });

  it("returns null for a malformed secret, so a typo cannot address a stray tenant", () => {
    for (const value of ["", "   ", "not-a-uuid", "11111111-1111-1111-1111-11111111111"]) {
      setEnv({ DEPLOYMENT_CHURCH_ID: value });
      expect(deploymentChurchId()).toBeNull();
    }
  });

  it("is never baked into the source", () => {
    const source = readFileSync(
      resolve(__dirname, "../../supabase/functions/_shared/deployment.ts"),
      "utf8",
    );
    // Any bare uuid literal here would be a hardcoded tenant. The uuid *pattern*
    // used for validation is not a literal and must survive this check.
    const literals = source.match(/["'][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}["']/gi);
    expect(literals).toBeNull();
  });
});

describe("isUuid", () => {
  it("accepts a canonical uuid in either case", () => {
    expect(isUuid("a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c51")).toBe(true);
    expect(isUuid("3AEB81BD-0AE5-49A4-95B1-C7A877E447FC")).toBe(true);
  });

  it("rejects anything that is not one, including injection-shaped input", () => {
    for (const value of [
      "",
      "not-a-uuid",
      "a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5",
      "a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c511",
      "a1b2c3d4_5e6f_4a7b_8c9d_0e1f2a3b4c51",
      "' OR 1=1 --",
      "a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c51 ",
      null,
      undefined,
      42,
      {},
      ["a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c51"],
    ]) {
      expect(isUuid(value)).toBe(false);
    }
  });
});

describe("isPinShaped", () => {
  it("accepts exactly six digits", () => {
    expect(isPinShaped("482913")).toBe(true);
    expect(isPinShaped("000000")).toBe(true);
  });

  it("rejects wrong length, non-digits, whitespace, and non-strings", () => {
    for (const value of ["", "48291", "4829134", "48291a", " 482913", "482913\n", "٤٨٢٩١٣", 482913, null, undefined]) {
      expect(isPinShaped(value)).toBe(false);
    }
  });
});

describe("hasProjectKey", () => {
  function request(headers: Record<string, string>): Request {
    return new Request("https://example.test/verify-pin", { method: "POST", headers });
  }

  it("rejects a request that presents no key at all", () => {
    expect(hasProjectKey(request({}))).toBe(false);
  });

  it("accepts the publishable key the platform injected", () => {
    setEnv({ SUPABASE_URL: PROJECT_URL, SUPABASE_ANON_KEY: "sb_publishable_abc123" });
    expect(hasProjectKey(request({ apikey: "sb_publishable_abc123" }))).toBe(true);
    expect(hasProjectKey(request({ Authorization: "Bearer sb_publishable_abc123" }))).toBe(true);
  });

  /**
   * A project can serve both key generations at once: the browser bundle still
   * ships the legacy anon JWT while the platform injects the newer publishable
   * key. Rejecting the legacy key would lock the real client out of its own
   * sign-in screen.
   */
  it("accepts this project's legacy anon key even when the injected key is the newer one", () => {
    setEnv({ SUPABASE_URL: PROJECT_URL, SUPABASE_ANON_KEY: "sb_publishable_abc123" });
    expect(hasProjectKey(request({ apikey: legacyAnonKey(PROJECT_REF) }))).toBe(true);
  });

  it("rejects a legacy key minted for a different project", () => {
    setEnv({ SUPABASE_URL: PROJECT_URL, SUPABASE_ANON_KEY: "sb_publishable_abc123" });
    expect(hasProjectKey(request({ apikey: legacyAnonKey("someotherproject") }))).toBe(false);
  });

  it("rejects a legacy key that claims a role other than anon", () => {
    setEnv({ SUPABASE_URL: PROJECT_URL, SUPABASE_ANON_KEY: "sb_publishable_abc123" });
    expect(hasProjectKey(request({ apikey: legacyAnonKey(PROJECT_REF, "service_role") }))).toBe(false);
  });

  it("rejects malformed and garbage keys", () => {
    setEnv({ SUPABASE_URL: PROJECT_URL, SUPABASE_ANON_KEY: "sb_publishable_abc123" });
    for (const value of ["nope", "a.b", "a.b.c", "....", "Bearer"]) {
      expect(hasProjectKey(request({ apikey: value }))).toBe(false);
    }
  });
});

describe("clientAddress", () => {
  it("takes the first hop of x-forwarded-for", () => {
    const req = new Request("https://example.test/", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" },
    });
    expect(clientAddress(req)).toBe("203.0.113.7");
  });

  it("falls back to a stable placeholder when no address header is present", () => {
    expect(clientAddress(new Request("https://example.test/"))).toBe("unknown");
  });
});

describe("createRateLimiter", () => {
  it("allows exactly `limit` calls inside one window, then refuses", () => {
    const take = createRateLimiter(3, 60_000);
    expect([take("a"), take("a"), take("a"), take("a")]).toEqual([true, true, true, false]);
  });

  it("counts each address separately", () => {
    const take = createRateLimiter(1, 60_000);
    expect(take("a")).toBe(true);
    expect(take("b")).toBe(true);
    expect(take("a")).toBe(false);
  });

  it("lets an address through again once its window has passed", async () => {
    const take = createRateLimiter(1, 5);
    expect(take("a")).toBe(true);
    expect(take("a")).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(take("a")).toBe(true);
  });
});
