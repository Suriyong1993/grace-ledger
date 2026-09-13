import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoPassword = process.env.GRACE_DEMO_PASSWORD;
if (!url || !serviceKey || !demoPassword) throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and GRACE_DEMO_PASSWORD are required");

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const churches = ["Grace Ledger Demo Church A", "Grace Ledger Demo Church B"];
const people = [
  { email: "super_admin@grace-ledger.demo", name: "Demo Super Admin", role: "super_admin" },
  { email: "pastor@grace-ledger.demo", name: "Demo Pastor", role: "pastor" },
  { email: "treasurer@grace-ledger.demo", name: "Demo Treasurer", role: "treasurer" },
];

async function findUser(email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email);
    if (user) return user;
    if (data.users.length < 100) return null;
  }
  return null;
}

async function upsertChurch(name) {
  const { data: existing } = await admin.from("churches").select("id,name").eq("name", name).maybeSingle();
  if (existing) return existing;
  const { data, error } = await admin.from("churches").insert({ name, currency: "THB", settings: { demo: true } }).select("id,name").single();
  if (error) throw error;
  return data;
}

async function upsertUser(person, church) {
  let user = await findUser(person.email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({ email: person.email, password: demoPassword, email_confirm: true, user_metadata: { full_name: person.name } });
    if (error) throw error;
    user = data.user;
  }
  const { error: profileError } = await admin.from("profiles").upsert({ id: user.id, church_id: church.id, email: person.email, full_name: person.name, display_name: person.name, is_active: true });
  if (profileError) throw profileError;
  const { error: roleError } = await admin.from("user_roles").upsert({ user_id: user.id, church_id: church.id, role: person.role });
  if (roleError) throw roleError;
}

for (const name of churches) {
  const church = await upsertChurch(name);
  for (const person of people) await upsertUser(person, church);
  console.log(`${name}: ${church.id}`);
}
console.log("Seed complete. Run scripts/test_tenant_isolation.mjs next. These demo credentials are for non-production testing only.");
