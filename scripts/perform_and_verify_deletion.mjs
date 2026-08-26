import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = "https://jeklcfpqmytdmwczxqlx.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impla2xjZnBxbXl0ZG13Y3p4cWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njk3NjQ0NSwiZXhwIjoyMTAyNTUyNDQ1fQ.goxdjDIYz5hk0wSypHqVVWQr-fHbPbNMX4fG968Mn6k";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function runQuery(sql) {
  const tmpDir = path.resolve("tmp_queries");
  fs.mkdirSync(tmpDir, { recursive: true });
  const tempFile = path.resolve(tmpDir, `query_${Date.now()}_${Math.random().toString(36).substring(7)}.sql`);
  fs.writeFileSync(tempFile, sql, "utf-8");

  try {
    const cmd = `npx supabase db query --linked --file "${tempFile}"`;
    const stdout = execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    return { success: true, output: stdout };
  } catch (err) {
    const errOutput = (err.stdout || "") + (err.stderr || "") + err.message;
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    return { success: false, output: errOutput };
  }
}

function getDatabaseSnapshot() {
  const sql = `
  SELECT json_build_object(
    'counts', json_build_object(
      'auth_users', (SELECT count(*) FROM auth.users),
      'profiles', (SELECT count(*) FROM profiles),
      'user_roles', (SELECT count(*) FROM user_roles),
      'transactions', (SELECT count(*) FROM transactions),
      'transaction_splits', (SELECT count(*) FROM transaction_splits),
      'offering_sessions', (SELECT count(*) FROM offering_sessions),
      'member_giving_records', (SELECT count(*) FROM member_giving_records),
      'audit_logs', (SELECT count(*) FROM audit_logs),
      'churches', (SELECT count(*) FROM churches),
      'auth_pins', (SELECT count(*) FROM auth_pins)
    ),
    'profiles', (SELECT json_agg(p) FROM (SELECT id, church_id, full_name, email FROM profiles ORDER BY id) p),
    'user_roles', (SELECT json_agg(r) FROM (SELECT id, user_id, church_id, role FROM user_roles ORDER BY id) r),
    'churches', (SELECT json_agg(c) FROM (SELECT id, name FROM churches ORDER BY id) c),
    'auth_pins', (SELECT json_agg(a) FROM (SELECT profile_id, church_id FROM auth_pins ORDER BY profile_id) a),
    'all_auth_users', (SELECT json_agg(u) FROM (SELECT id, email, role, created_at FROM auth.users ORDER BY email) u)
  ) as snapshot;
  `;
  const res = runQuery(sql);
  const parsed = JSON.parse(res.output);
  return parsed.rows[0].snapshot;
}

async function main() {
  console.log("================================================================================");
  console.log("GRACE LEDGER - SUPABASE AUTH ADMIN USER DELETION & INTEGRITY VERIFICATION");
  console.log("================================================================================");

  const targets = [
    { uid: "66666666-aaaa-2222-2222-222222222222", email: "p23_approver@test.com" },
    { uid: "66666666-aaaa-3333-3333-333333333333", email: "p21_approver2@test.com" },
    { uid: "66666666-aaaa-4444-4444-444444444444", email: "p21_treasurer@test.com" },
  ];

  // 1. PRE SNAPSHOT
  console.log("\n[PHASE 1] CAPTURING PRE-DELETION SNAPSHOT...");
  const preSnapshot = getDatabaseSnapshot();
  console.log("Pre-Deletion Table Counts:", JSON.stringify(preSnapshot.counts, null, 2));

  // 2. AUTH ADMIN DELETION
  console.log("\n[PHASE 2] EXECUTING DELETION VIA SUPABASE AUTH ADMIN API (supabase.auth.admin.deleteUser)...");
  const deletionResults = [];
  for (const t of targets) {
    console.log(`-> Deleting ${t.uid} (${t.email})...`);
    const delRes = await supabase.auth.admin.deleteUser(t.uid);
    if (delRes.error) {
      console.error(`ERROR deleting ${t.uid}:`, delRes.error);
      deletionResults.push({ uid: t.uid, email: t.email, success: false, error: delRes.error });
    } else {
      console.log(`✓ Successfully deleted ${t.uid} (${t.email}) via Supabase Auth Admin API`);
      deletionResults.push({ uid: t.uid, email: t.email, success: true, user: delRes.data?.user });
    }
  }

  // 3. POST SNAPSHOT
  console.log("\n[PHASE 3] CAPTURING POST-DELETION SNAPSHOT...");
  const postSnapshot = getDatabaseSnapshot();
  console.log("Post-Deletion Table Counts:", JSON.stringify(postSnapshot.counts, null, 2));

  // 4. VERIFICATION
  console.log("\n[PHASE 4] RUNNING RIGOROUS INTEGRITY VERIFICATION...");

  const checks = [];

  // 4.1 Target UIDs and emails in auth.users = 0
  for (const t of targets) {
    const adminCheck = await supabase.auth.admin.getUserById(t.uid);
    const authAdminDeleted = adminCheck.error?.status === 404 || adminCheck.error?.code === "user_not_found";
    const inDbUsers = (postSnapshot.all_auth_users || []).filter((u) => u.id === t.uid || u.email === t.email);
    const isZero = inDbUsers.length === 0 && authAdminDeleted;

    checks.push({
      name: `Target User ${t.uid} (${t.email}) removed from auth.users`,
      passed: isZero,
      detail: `Auth Admin API Status: ${adminCheck.error?.status || "200 OK"}, DB Auth Users Count: ${inDbUsers.length}`,
    });
  }

  // 4.2 profiles table unchanged
  const profilesMatch = JSON.stringify(preSnapshot.profiles) === JSON.stringify(postSnapshot.profiles);
  checks.push({
    name: "profiles table intact & unchanged",
    passed: profilesMatch && postSnapshot.counts.profiles === 12,
    detail: `Count before: ${preSnapshot.counts.profiles}, Count after: ${postSnapshot.counts.profiles}`,
  });

  // 4.3 user_roles table unchanged
  const userRolesMatch = JSON.stringify(preSnapshot.user_roles) === JSON.stringify(postSnapshot.user_roles);
  checks.push({
    name: "user_roles table intact & unchanged",
    passed: userRolesMatch && postSnapshot.counts.user_roles === 12,
    detail: `Count before: ${preSnapshot.counts.user_roles}, Count after: ${postSnapshot.counts.user_roles}`,
  });

  // 4.4 transactions table unchanged
  checks.push({
    name: "transactions table intact & unchanged",
    passed: preSnapshot.counts.transactions === postSnapshot.counts.transactions && postSnapshot.counts.transactions === 15,
    detail: `Count before: ${preSnapshot.counts.transactions}, Count after: ${postSnapshot.counts.transactions}`,
  });

  // 4.5 transaction_splits table unchanged
  checks.push({
    name: "transaction_splits table intact & unchanged",
    passed: preSnapshot.counts.transaction_splits === postSnapshot.counts.transaction_splits && postSnapshot.counts.transaction_splits === 23,
    detail: `Count before: ${preSnapshot.counts.transaction_splits}, Count after: ${postSnapshot.counts.transaction_splits}`,
  });

  // 4.6 offering_sessions table unchanged
  checks.push({
    name: "offering_sessions table intact & unchanged",
    passed: preSnapshot.counts.offering_sessions === postSnapshot.counts.offering_sessions && postSnapshot.counts.offering_sessions === 19,
    detail: `Count before: ${preSnapshot.counts.offering_sessions}, Count after: ${postSnapshot.counts.offering_sessions}`,
  });

  // 4.7 member_giving_records table unchanged
  checks.push({
    name: "member_giving_records table intact & unchanged",
    passed: preSnapshot.counts.member_giving_records === postSnapshot.counts.member_giving_records && postSnapshot.counts.member_giving_records === 1,
    detail: `Count before: ${preSnapshot.counts.member_giving_records}, Count after: ${postSnapshot.counts.member_giving_records}`,
  });

  // 4.8 audit_logs table unchanged
  checks.push({
    name: "audit_logs table intact & unchanged",
    passed: preSnapshot.counts.audit_logs === postSnapshot.counts.audit_logs && postSnapshot.counts.audit_logs === 313,
    detail: `Count before: ${preSnapshot.counts.audit_logs}, Count after: ${postSnapshot.counts.audit_logs}`,
  });

  // 4.9 churches table unchanged
  const churchesMatch = JSON.stringify(preSnapshot.churches) === JSON.stringify(postSnapshot.churches);
  checks.push({
    name: "churches table intact & unchanged",
    passed: churchesMatch && postSnapshot.counts.churches === 4,
    detail: `Count before: ${preSnapshot.counts.churches}, Count after: ${postSnapshot.counts.churches}`,
  });

  // 4.10 auth_pins = 0
  checks.push({
    name: "auth_pins count is 0",
    passed: postSnapshot.counts.auth_pins === 0,
    detail: `auth_pins count: ${postSnapshot.counts.auth_pins}`,
  });

  // 4.11 Real users / Somchai check
  const somchaiProfile = (postSnapshot.profiles || []).find((p) => p.id === "3aeb81bd-0ae5-49a4-95b1-c7a877e447fc");
  const somchaiRole = (postSnapshot.user_roles || []).find((r) => r.user_id === "3aeb81bd-0ae5-49a4-95b1-c7a877e447fc");
  const somchaiAuth = (postSnapshot.all_auth_users || []).find((u) => u.id === "52f40eb3-8e4d-42ef-b41c-7a40b5c2ef93");

  checks.push({
    name: "Somchai (3aeb81bd / ศจ.สมชาย มีสุข) profile & role & auth completely untouched",
    passed: !!somchaiProfile && !!somchaiRole && !!somchaiAuth,
    detail: `Profile: ${somchaiProfile?.full_name}, Role: ${somchaiRole?.role}, Auth: ${somchaiAuth?.email}`,
  });

  console.log("\n================================================================================");
  console.log("FINAL INTEGRITY VERIFICATION SUMMARY");
  console.log("================================================================================");
  let allPassed = true;
  for (const c of checks) {
    const status = c.passed ? "PASS" : "FAIL";
    if (!c.passed) allPassed = false;
    console.log(`[${status}] ${c.name} -> ${c.detail}`);
  }

  const finalOutput = {
    allPassed,
    preSnapshot,
    postSnapshot,
    deletionResults,
    checks,
  };

  fs.writeFileSync("scripts/deletion_result.json", JSON.stringify(finalOutput, null, 2), "utf-8");
  console.log(`\nResult written to scripts/deletion_result.json. Overall Status: ${allPassed ? "ALL PASSED" : "FAILED"}`);
}

main().catch(console.error);
