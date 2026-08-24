/**
 * verify-pin — exchange a profile id and a 6-digit PIN for a Supabase session.
 *
 * Pre-authentication endpoint (`verify_jwt = false`). The sequence is:
 *
 *   verify_and_consume_pin()  -> spends one attempt, returns the profile email
 *   admin.generateLink()      -> mints a one-time magic-link token for that email
 *   verifyOtp(token_hash)     -> burns the token, returns access + refresh tokens
 *
 * The client never sees the magic link, the token hash, or the profile email.
 * The church is fixed on the server, so a profile id from another congregation
 * fails exactly like a wrong PIN.
 *
 * Failure responses are uniform on purpose: `invalid` says nothing about which
 * part was wrong, and carries no attempt counter.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  CORS_HEADERS,
  clientAddress,
  createRateLimiter,
  deploymentChurchId,
  deploymentConfigFault,
  hasProjectKey,
  isPinShaped,
  isUuid,
  json,
} from "../_shared/deployment.ts";

/** Instance-local throttle. The durable control is the lockout in `auth_pins`. */
const takeRequest = createRateLimiter(20, 60_000);

interface VerifyResult {
  status: "success" | "invalid" | "locked";
  user_id?: string;
  email?: string;
  requires_reset?: boolean;
  locked_until?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!hasProjectKey(req)) return json({ error: "unauthorized" }, 401);
  if (!takeRequest(clientAddress(req))) return json({ error: "rate_limited" }, 429);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const churchId = deploymentChurchId();

  // No church configured means no safe answer. Refuse rather than fall back to
  // a built-in default, which could authenticate against the wrong tenant.
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !churchId) {
    console.error(`verify-pin: deployment not configured — ${deploymentConfigFault()}`);
    return json({ error: "unavailable" }, 503);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid" }, 401);
  }

  const { profile_id: profileId, pin } = (body ?? {}) as Record<string, unknown>;

  // A malformed request is answered exactly like a wrong PIN, and without
  // touching the database, so shape probing yields nothing.
  if (!isUuid(profileId) || !isPinShaped(pin)) return json({ error: "invalid" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("verify_and_consume_pin", {
    p_profile_id: profileId,
    p_church_id: churchId,
    p_pin: pin,
  });

  if (error) {
    console.error("verify-pin: rpc failed", error.message);
    return json({ error: "unavailable" }, 503);
  }

  const result = data as VerifyResult | null;

  if (result?.status === "locked") {
    return json({ error: "locked", locked_until: result.locked_until ?? null }, 423);
  }

  if (result?.status !== "success" || !result.email || !result.user_id) {
    return json({ error: "invalid" }, 401);
  }

  // The PIN is now spent and proven. Turn that proof into a real session by
  // minting a single-use magic-link token and immediately redeeming it here,
  // server side. The link itself never leaves this function.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: result.email,
  });

  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error("verify-pin: generateLink failed", linkError?.message ?? "no hashed_token");
    return json({ error: "unavailable" }, 503);
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: otpData, error: otpError } = await anonClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });

  const session = otpData?.session;
  if (otpError || !session?.access_token || !session.refresh_token) {
    console.error("verify-pin: verifyOtp failed", otpError?.message ?? "no session");
    return json({ error: "unavailable" }, 503);
  }

  // The session belongs to the profile that proved the PIN, or nothing is sent.
  // A mismatch here would mean the email lookup and the minted session diverged.
  if (session.user?.id !== result.user_id) {
    console.error("verify-pin: session subject did not match verified profile");
    return json({ error: "unavailable" }, 503);
  }

  return json(
    {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in ?? null,
      expires_at: session.expires_at ?? null,
      token_type: session.token_type ?? "bearer",
      requires_reset: result.requires_reset === true,
    },
    200,
  );
});
