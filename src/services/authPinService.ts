import { SupabaseClient } from "@supabase/supabase-js";
import { LoginProfile } from "../components/login/types";

interface RawLoginProfile {
  id: string;
  name: string;
  role: string;
  initials: string;
}

export type LoginProfilesResult =
  | { status: "ready"; profiles: LoginProfile[] }
  | { status: "empty" }
  | { status: "error" };

export type VerifyPinResult =
  | { status: "success"; userId: string }
  | { status: "requires_reset" }
  | { status: "invalid" }
  | { status: "locked"; lockedUntil: string | null }
  | { status: "unavailable" };

interface FunctionCallResult {
  ok: boolean;
  status: number;
  body: unknown;
}

async function callFunction(
  supabase: SupabaseClient,
  name: string,
  body?: Record<string, unknown>
): Promise<FunctionCallResult> {
  const { data, error } = await supabase.functions.invoke(name, body ? { body } : undefined);

  if (!error) return { ok: true, status: 200, body: data };

  const response: Response | undefined = (error as { context?: Response }).context;
  if (!response) return { ok: false, status: 0, body: null };

  let parsedBody: unknown = null;
  try {
    parsedBody = await response.clone().json();
  } catch {
    parsedBody = null;
  }

  return { ok: false, status: response.status, body: parsedBody };
}

export async function fetchLoginProfiles(supabase: SupabaseClient): Promise<LoginProfilesResult> {
  const result = await callFunction(supabase, "login-profiles");
  if (!result.ok) return { status: "error" };

  const body = result.body as { profiles?: RawLoginProfile[] } | null;
  const profiles = (body?.profiles ?? []).map(
    (row): LoginProfile => ({ id: row.id, name: row.name, role: row.role, initials: row.initials })
  );

  return profiles.length === 0 ? { status: "empty" } : { status: "ready", profiles };
}

export async function verifyPin(
  supabase: SupabaseClient,
  profileId: string,
  pin: string
): Promise<VerifyPinResult> {
  const result = await callFunction(supabase, "verify-pin", { profile_id: profileId, pin });

  if (result.ok) {
    const body = result.body as {
      access_token?: string;
      refresh_token?: string;
      requires_reset?: boolean;
    } | null;

    if (body?.requires_reset === true) {
      return { status: "requires_reset" };
    }

    if (!body?.access_token || !body.refresh_token) {
      return { status: "unavailable" };
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    });

    if (error || !data.session?.user?.id) {
      console.error("verify-pin: failed to bridge real Supabase session", error);
      return { status: "unavailable" };
    }

    return { status: "success", userId: data.session.user.id };
  }

  if (result.status === 423) {
    const body = result.body as { locked_until?: string | null } | null;
    return { status: "locked", lockedUntil: body?.locked_until ?? null };
  }

  if (result.status === 401) return { status: "invalid" };

  return { status: "unavailable" };
}

export type RequestPinBootstrapResult =
  | { status: "sent" }
  | { status: "rate_limited" }
  | { status: "unavailable" };

export async function requestPinBootstrap(
  supabase: SupabaseClient,
  profileId: string,
  redirectTo?: string
): Promise<RequestPinBootstrapResult> {
  const result = await callFunction(supabase, "request-pin-bootstrap", {
    profile_id: profileId,
    redirect_to: redirectTo,
  });

  if (result.ok) return { status: "sent" };
  if (result.status === 429) return { status: "rate_limited" };
  return { status: "unavailable" };
}