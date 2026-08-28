/**
 * login-profiles — the list of people the sign-in screen offers.
 *
 * Pre-authentication endpoint (`verify_jwt = false`): it is what the browser
 * calls before anyone has a session, so it cannot require one.
 *
 * What it returns is deliberately thin: a profile id, a name, a role label, and
 * initials. No email, no phone, no church id, no counts, no lockout state. The
 * church is fixed on the server, so this endpoint can only ever describe the
 * one congregation this instance was deployed for.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  clientAddress,
  corsHeadersFor,
  createRateLimiter,
  deploymentChurchId,
  deploymentConfigFault,
  hasProjectKey,
  json as jsonBase,
} from "../_shared/deployment.ts";

const ROLE_LABELS_TH: Record<string, string> = {
  super_admin: "ผู้ดูแลระบบ",
  pastor: "ศิษยาภิบาล",
  treasurer: "เหรัญญิก",
  finance_staff: "เจ้าหน้าที่การเงิน",
  approver: "ผู้อนุมัติ",
  counter: "ผู้นับเงิน",
  member: "สมาชิก",
};

/** Role precedence when a profile holds more than one grant. */
const ROLE_ORDER = [
  "super_admin",
  "pastor",
  "treasurer",
  "finance_staff",
  "approver",
  "counter",
  "member",
];

/**
 * Per-profile display-title override. DB role/RLS stay on the enum value
 * (`super_admin`) — this only changes the text shown on the profile card.
 */
const ROLE_TITLE_OVERRIDES: Record<string, string> = {
  "f0fc6cdd-07ad-4d76-8fe6-80427525d340": "Super Admin / ผู้ตรวจสอบบัญชี",
};

const takeRequest = createRateLimiter(60, 60_000);

interface ProfileRow {
  id: string;
  full_name: string | null;
  display_name: string | null;
}

interface RoleRow {
  user_id: string;
  role: string;
}

/**
 * Thai names carry honorifics and compound given names, so the first letters of
 * the first two whitespace-separated parts are the closest thing to a stable
 * monogram without a curated field.
 */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`;
}

function highestRole(roles: readonly string[]): string | null {
  for (const candidate of ROLE_ORDER) {
    if (roles.includes(candidate)) return candidate;
  }
  return roles[0] ?? null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const corsHeaders = corsHeadersFor(req);
  const json = (body: unknown, status: number) => jsonBase(body, status, corsHeaders);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  if (!hasProjectKey(req)) return json({ error: "unauthorized" }, 401);
  if (!takeRequest(clientAddress(req))) return json({ error: "rate_limited" }, 429);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const churchId = deploymentChurchId();

  // No church configured means no safe answer. Refuse rather than fall back to
  // a built-in default, which could serve the wrong congregation's roster.
  if (!supabaseUrl || !serviceRoleKey || !churchId) {
    console.error(`login-profiles: deployment not configured — ${deploymentConfigFault()}`);
    return json({ error: "unavailable" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, display_name")
    .eq("church_id", churchId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (profileError) {
    console.error("login-profiles: profile query failed", profileError.message);
    return json({ error: "unavailable" }, 503);
  }

  const rows = (profiles ?? []) as ProfileRow[];
  if (rows.length === 0) return json({ profiles: [] }, 200);

  const { data: roleRows, error: roleError } = await admin
    .from("user_roles")
    .select("user_id, role")
    .eq("church_id", churchId)
    .in("user_id", rows.map((row) => row.id));

  if (roleError) {
    console.error("login-profiles: role query failed", roleError.message);
    return json({ error: "unavailable" }, 503);
  }

  const rolesByUser = new Map<string, string[]>();
  for (const row of (roleRows ?? []) as RoleRow[]) {
    const bucket = rolesByUser.get(row.user_id);
    if (bucket) bucket.push(row.role);
    else rolesByUser.set(row.user_id, [row.role]);
  }

  const payload = rows.map((row) => {
    const name = (row.display_name ?? row.full_name ?? "").trim();
    const role = highestRole(rolesByUser.get(row.id) ?? []);
    const roleLabel = ROLE_TITLE_OVERRIDES[row.id] ?? (role ? ROLE_LABELS_TH[role] ?? "" : "");
    return {
      id: row.id,
      name,
      role: roleLabel,
      initials: initialsOf(name),
    };
  });

  return json({ profiles: payload }, 200);
});
