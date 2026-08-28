/**
 * request-pin-bootstrap — request initial PIN setup Magic Link for an active profile.
 *
 * Pre-authentication endpoint (`verify_jwt = false`). The sequence is:
 *
 *   1. Check rate limit and project key
 *   2. Validate profile_id format
 *   3. Look up profile in database (must match deploymentChurchId() and is_active = true)
 *   4. supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })
 *      -> triggers Supabase built-in mailer to deliver the Magic Link email
 *
 * Response is uniform: returns 200 { "status": "sent" } regardless of whether the profile
 * exists or is active, preventing identity and email enumeration.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  clientAddress,
  corsHeadersFor,
  createRateLimiter,
  deploymentChurchId,
  deploymentConfigFault,
  hasProjectKey,
  isUuid,
  json as jsonBase,
} from "../_shared/deployment.ts";

/** Instance-local throttle: 10 requests per minute per IP. */
const takeRequest = createRateLimiter(10, 60_000);

Deno.serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  const json = (body: unknown, status: number) => jsonBase(body, status, corsHeaders);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!hasProjectKey(req)) return json({ error: "unauthorized" }, 401);
  if (!takeRequest(clientAddress(req))) return json({ error: "rate_limited" }, 429);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const churchId = deploymentChurchId();

  if (!supabaseUrl || !serviceRoleKey || !anonKey || !churchId) {
    console.error(`request-pin-bootstrap: deployment not configured — ${deploymentConfigFault()}`);
    return json({ error: "unavailable" }, 503);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid" }, 400);
  }

  const { profile_id: profileId, redirect_to: redirectTo } = (body ?? {}) as Record<string, unknown>;

  if (!isUuid(profileId)) {
    return json({ error: "invalid" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Check profile existence and church scoping
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email, is_active, church_id")
    .eq("id", profileId)
    .eq("church_id", churchId)
    .eq("is_active", true)
    .maybeSingle();

  if (profileError || !profile || !profile.email) {
    // Non-revealing uniform success response to prevent enumeration
    return json({ status: "sent" }, 200);
  }

  // Trigger Supabase email delivery service to send One-Time Magic Link
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cleanRedirect = typeof redirectTo === "string" && redirectTo.startsWith("http")
    ? redirectTo.split("#")[0]
    : undefined;

  const { error: otpError } = await authClient.auth.signInWithOtp({
    email: profile.email,
    options: {
      emailRedirectTo: cleanRedirect,
    },
  });

  if (otpError) {
    // If rate-limited by Supabase Auth (60s email throttle), still return friendly message
    if (otpError.status === 429 || otpError.message.includes("rate limit")) {
      console.warn("request-pin-bootstrap: email send rate limited by auth provider");
      return json({ status: "sent" }, 200);
    }
    console.error("request-pin-bootstrap: signInWithOtp failed", otpError.message);
    return json({ error: "unavailable" }, 503);
  }

  return json({ status: "sent" }, 200);
});
