/**
 * Grace Ledger v2 — Supabase Admin Client
 *
 * Provides server-side Supabase client for:
 * 1. JWT token verification (frontend sends Supabase access_token)
 * 2. Fetching user/church context from the database
 *
 * Uses the service_role key — never expose this to the browser.
 * Only used in trusted server-side code paths.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

export function getAdminClient() {
  if (!supabaseAdmin) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
          "Set these environment variables for server-side Supabase auth.",
      );
    }
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAdmin;
}

/**
 * Result of a successful Supabase JWT verification.
 */
export interface SupabaseAuthContext {
  /** The public.users.id (NOT auth.users.id) */
  userId: string;
  churchId: string;
  role: string;
  name: string;
  email: string;
  /** The Supabase auth.users.id */
  authUserId: string;
}

/**
 * Verify a Supabase JWT access token and resolve it to a church user.
 *
 * Uses the service_role client to call `auth.getUser()`, which verifies
 * the token against Supabase Auth. Then fetches the corresponding
 * public.users record for church_id, role, and user_id.
 *
 * Returns null if the token is invalid, expired, or the user is not
 * registered in any church.
 */
export async function verifySupabaseToken(token: string): Promise<SupabaseAuthContext | null> {
  try {
    const admin = getAdminClient();

    // Verify JWT with Supabase Auth
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);

    if (error || !user) return null;

    // Fetch church user record from public.users table
    const { data: raw } = await (admin.from("users") as any)
      .select("id, church_id, role, name")
      .eq("auth_user_id", user.id)
      .single();

    if (!raw) return null;

    return {
      userId: raw.id as string,
      churchId: raw.church_id as string,
      role: raw.role as string,
      name: raw.name as string,
      email: user.email ?? "",
      authUserId: user.id,
    };
  } catch {
    // Token verification failed silently — return null
    return null;
  }
}
