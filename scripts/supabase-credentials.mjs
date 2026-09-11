// Grace Ledger — credential loading for operator scripts.
//
// WHY THIS EXISTS
// Three scripts under scripts/ had a live Supabase `service_role` JWT pasted
// into them as a string literal, and three more had a real test user's login
// password. The service_role key bypasses Row Level Security completely: with
// it, anyone holding repo read access could read, rewrite or delete every
// church's transactions, fund balances, member giving records, PIN hashes and
// audit logs — all of the tenant isolation this project enforces in SQL simply
// does not apply to that role. Committing it was the single most severe finding
// of the 2026-09-11 audit.
//
// Removing the literals from HEAD does NOT un-leak them: they remain in git
// history, so the key must be rotated in the Supabase dashboard (Project
// Settings → API → reset the service_role secret) and the test user's password
// changed. See docs/ENGINEERING_REPORT_2026-09-11.md §5.
//
// RULES
//   * Only the anon key may keep a committed default: it is public by design
//     and is already shipped inside the browser bundle (src/lib/supabase/
//     client.ts). Everything privileged comes from the environment.
//   * A missing privileged credential fails loudly and immediately, rather than
//     letting a script run half-way against production with the wrong identity.
//   * scripts/lint-secrets.mjs mechanically enforces that no privileged
//     credential literal comes back.

const DEFAULT_SUPABASE_URL = "https://jeklcfpqmytdmwczxqlx.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impla2xjZnBxbXl0ZG13Y3p4cWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NzY0NDUsImV4cCI6MjEwMjU1MjQ0NX0.ZSM88SkzsWhqsD7x8gpyTSguKB2oG51lZqKLGHQETHA";

/** Project URL. Public; overridable with VITE_SUPABASE_URL / SUPABASE_URL. */
export function supabaseUrl() {
  return (
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    DEFAULT_SUPABASE_URL
  );
}

/** Publishable anon key. Public by design — RLS is the boundary, not this key. */
export function anonKey() {
  return (
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    DEFAULT_SUPABASE_ANON_KEY
  );
}

function required(name, purpose) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `${name} is not set. It is required to ${purpose}.\n` +
        `Provide it through the environment (or a git-ignored .env), never as a\n` +
        `literal in a committed file — see scripts/supabase-credentials.mjs.`,
    );
  }
  return value.trim();
}

/**
 * The service_role key. BYPASSES ROW LEVEL SECURITY. Never commit it, never
 * send it to a browser, and prefer a narrower path (an RPC, an Edge Function)
 * whenever one exists.
 */
export function serviceRoleKey() {
  return required(
    "SUPABASE_SERVICE_ROLE_KEY",
    "act as service_role, which bypasses RLS",
  );
}

/** Login password for the seeded browser-test user. */
export function testUserPassword() {
  return required(
    "GRACE_TEST_USER_PASSWORD",
    "sign in the seeded browser-test user",
  );
}

/** Operator mailbox used by the email/magic-link delivery probes. */
export function testOperatorEmail() {
  return required(
    "GRACE_TEST_OPERATOR_EMAIL",
    "target the email / magic-link delivery probe",
  );
}
