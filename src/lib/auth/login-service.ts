import { SupabaseClient } from "@supabase/supabase-js";
import { LoginProfile } from "../../components/login/types";

/**
 * Bridges the pre-authentication screens to the `login-profiles` and
 * `verify-pin` Edge Functions. Both endpoints run with `verify_jwt = false`
 * and are scoped server-side to one church — nothing here ever sends or
 * reads a church id.
 */

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
  | { status: "success"; accessToken: string; refreshToken: string; requiresReset: boolean }
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

    if (body?.access_token && body.refresh_token) {
      return {
        status: "success",
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        requiresReset: body.requires_reset === true,
      };
    }
    return { status: "unavailable" };
  }

  if (result.status === 423) {
    const body = result.body as { locked_until?: string | null } | null;
    return { status: "locked", lockedUntil: body?.locked_until ?? null };
  }

  if (result.status === 401) return { status: "invalid" };

  return { status: "unavailable" };
}
