import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const password = process.env.GRACE_DEMO_PASSWORD;
const churchA = process.env.GRACE_DEMO_CHURCH_A_ID;
const churchB = process.env.GRACE_DEMO_CHURCH_B_ID;
if (!url || !anonKey || !password || !churchA || !churchB) throw new Error("SUPABASE_URL, SUPABASE_ANON_KEY, GRACE_DEMO_PASSWORD, GRACE_DEMO_CHURCH_A_ID and GRACE_DEMO_CHURCH_B_ID are required");

const users = ["super_admin@grace-ledger.demo", "pastor@grace-ledger.demo", "treasurer@grace-ledger.demo"];
const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

for (const email of users) {
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`${email}: sign-in failed: ${signInError.message}`);

  const { data: profile, error: profileError } = await client.from("profiles").select("church_id").eq("id", (await client.auth.getUser()).data.user?.id).single();
  if (profileError || !profile) throw new Error(`${email}: profile lookup failed`);
  if (profile.church_id !== churchA) throw new Error(`${email}: expected church A, got ${profile.church_id}`);

  const { data: ownRows, error: ownError } = await client.from("funds").select("id").eq("church_id", churchA);
  if (ownError) throw new Error(`${email}: own church query failed: ${ownError.message}`);
  if (!Array.isArray(ownRows)) throw new Error(`${email}: own church result is invalid`);

  const { data: crossRows, error: crossError } = await client.from("funds").select("id").eq("church_id", churchB);
  if (crossError) throw new Error(`${email}: cross-tenant query errored unexpectedly: ${crossError.message}`);
  if ((crossRows ?? []).length !== 0) throw new Error(`${email}: SECURITY FAILURE — saw ${crossRows.length} fund rows from church B`);

  console.log(`PASS ${email}: own church visible, other church hidden`);
  await client.auth.signOut();
}

console.log("Tenant isolation test: 3/3 roles PASS");
