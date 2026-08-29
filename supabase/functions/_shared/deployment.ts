/**
 * Shared configuration and guards for the pre-authentication Edge Functions.
 *
 * Grace Ledger runs one deployed instance per church. The church this instance
 * serves comes from the Edge Function secret store and nowhere else:
 * `login-profiles` and `verify-pin` never accept a church id from the browser,
 * so a caller cannot point either endpoint at another congregation's data.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The church this instance serves, read from the Edge Function secret store.
 *
 * There is deliberately NO fallback constant. A committed default would put a
 * production config value in git and in every clone of this repo, and — worse —
 * would let a misconfigured deployment quietly serve the wrong congregation
 * instead of refusing to start. Returns null when the secret is absent or is
 * not a well-formed uuid; callers must answer 503 rather than guess.
 *
 * Set it with the project's existing secret mechanism:
 *   supabase secrets set DEPLOYMENT_CHURCH_ID=<uuid> --project-ref <ref>
 *
 * Never expose this through Vite env vars, the frontend bundle, a request
 * query/body/header, or a log line.
 */
export function deploymentChurchId(): string | null {
  // Trimmed because a secret set through a shell can arrive wrapped in quotes
  // or with a trailing newline, and a config value that is right apart from
  // whitespace should not take the whole deployment down.
  const configured = Deno.env.get("DEPLOYMENT_CHURCH_ID")?.trim().replace(/^["']|["']$/g, "");
  if (!configured || !UUID_PATTERN.test(configured)) return null;
  return configured;
}

/**
 * Why the deployment is refusing to serve, as a phrase safe to log.
 *
 * It distinguishes *absent* from *malformed* — enough to fix a misconfiguration
 * without ever revealing the value itself.
 */
export function deploymentConfigFault(): string | null {
  const raw = Deno.env.get("DEPLOYMENT_CHURCH_ID");
  if (!Deno.env.get("SUPABASE_URL")) return "SUPABASE_URL missing";
  if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return "SUPABASE_SERVICE_ROLE_KEY missing";
  if (raw === undefined) return "DEPLOYMENT_CHURCH_ID not set";
  if (raw.trim() === "") return "DEPLOYMENT_CHURCH_ID empty";
  if (deploymentChurchId() === null) return "DEPLOYMENT_CHURCH_ID not a valid uuid";
  return null;
}

const PIN_PATTERN = /^[0-9]{6}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isPinShaped(value: unknown): value is string {
  return typeof value === "string" && PIN_PATTERN.test(value);
}

/**
 * Origins allowed to call the pre-auth Edge Functions from a browser. Only the
 * deployed frontend needs this — everything else (curl, server-to-server) is
 * unaffected by CORS, so this is a browser-only restriction, not the real
 * security boundary (that's the anon-key check, rate limit, and DB lockout).
 */
const ALLOWED_ORIGINS = new Set([
  "https://grace-ledger-mu.vercel.app",
  "https://grace-ledger-tlcs-projects-ab505ecc.vercel.app",
  "https://grace-ledger-git-main-tlcs-projects-ab505ecc.vercel.app",
  "https://grace-ledger-5r3y2kz3h-tlcs-projects-ab505ecc.vercel.app",
  "http://localhost:5500",
  "http://localhost:5173",
  "http://localhost:4173",
]);

const BASE_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  Vary: "Origin",
};

/** Static fallback for callers that need a headers object before a request exists. */
export const CORS_HEADERS: Record<string, string> = BASE_CORS_HEADERS;

/** Per-request CORS headers: reflects the caller's origin only if it's allowlisted. */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return { ...BASE_CORS_HEADERS, "Access-Control-Allow-Origin": origin };
  }
  return BASE_CORS_HEADERS;
}

/**
 * Both endpoints run with `verify_jwt = false` because they are what a person
 * reaches *before* they have a session. The anon key check is therefore not a
 * secret — it is a coarse filter that keeps the endpoints off the open internet
 * for drive-by scanners. The controls that actually matter are the per-profile
 * lockout in the database and the per-address throttle below.
 */
const PROJECT_KEY_ENV_NAMES = [
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PUBLISHABLE_DEFAULT_KEY",
] as const;

/** Project ref taken from the injected URL, e.g. https://<ref>.supabase.co */
function projectRef(): string | null {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) return null;
  try {
    return new URL(url).hostname.split(".")[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * A legacy anon key is a JWT carrying `{ ref, role: "anon" }`. The signature is
 * deliberately NOT checked: this is a scanner filter, not a security boundary,
 * and a forged anon key buys an attacker nothing that the real one — which ships
 * in the browser bundle — would not.
 */
function isLegacyAnonKeyForThisProject(candidate: string): boolean {
  const ref = projectRef();
  if (!ref) return false;

  const segments = candidate.split(".");
  if (segments.length !== 3) return false;

  try {
    const payload = JSON.parse(atob(segments[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    return payload?.ref === ref && payload?.role === "anon";
  } catch {
    return false;
  }
}

export function hasProjectKey(req: Request): boolean {
  const presented = req.headers.get("apikey")
    ?? (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (!presented) return false;

  // Supabase injects the browser-facing key under a name that depends on whether
  // the project is on legacy anon keys or the newer publishable keys, and a
  // project can serve both generations at once. Accept any of them.
  for (const name of PROJECT_KEY_ENV_NAMES) {
    if (Deno.env.get(name) === presented) return true;
  }

  return isLegacyAnonKeyForThisProject(presented);
}

export function clientAddress(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Per-address throttle. Instance-local and therefore best-effort: Edge Function
 * instances are ephemeral and there may be several, so a determined attacker
 * gets more than `limit` attempts across the fleet. It exists to blunt a single
 * noisy source. Durable protection is the lockout state in `auth_pins`.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const buckets = new Map<string, Bucket>();

  return function take(key: string): boolean {
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      if (buckets.size > 10_000) {
        for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      }
      return true;
    }

    if (bucket.count >= limit) return false;
    bucket.count += 1;
    return true;
  };
}

export function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}
