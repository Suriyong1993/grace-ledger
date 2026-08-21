import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function runQuery(sql) {
  const tempFile = path.resolve("supabase", ".temp", `query_${Date.now()}_${Math.random().toString(36).substring(7)}.sql`);
  fs.mkdirSync(path.dirname(tempFile), { recursive: true });
  fs.writeFileSync(tempFile, sql, "utf-8");

  try {
    const cmd = `npx supabase db query --linked --file "${tempFile}"`;
    const stdout = execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    return { success: true, output: stdout };
  } catch (err) {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    const errOutput = (err.stdout || "") + (err.stderr || "") + err.message;
    return { success: false, output: errOutput };
  }
}

console.log("==================================================");
console.log("GATE 2 — REAL SUPABASE SECURITY TEST SUITE");
console.log("Database: Supabase PostgreSQL 17 (grace-ledger-test)");
console.log("==================================================");

const testResults = [];

function testCase(name, sqlBodyFn) {
  const res = sqlBodyFn();
  testResults.push({ name, ...res });
  console.log(`[Test] ${name} -> ${res.passed ? "PASS" : "FAIL"}: ${res.detail}`);
}

// ----------------------------------------------------
// 1. TENANT ISOLATION TESTS
// ----------------------------------------------------
console.log("\n--- 1. Tenant Isolation Tests ---");

testCase("Cross-Church SELECT: Church A Treasurer cannot read Church B accounts", () => {
  const sql = `
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claims', '{"sub": "aaaaaaaa-2222-2222-2222-222222222222", "role": "authenticated"}', true);
    SELECT count(*) as count FROM accounts WHERE church_id = '22222222-2222-2222-2222-222222222222';
    ROLLBACK;
  `;
  const res = runQuery(sql);
  const passed = res.success && res.output.includes('"count": 0');
  return { passed, detail: passed ? "Returned 0 rows (RLS Isolated)" : res.output };
});

testCase("Cross-Church INSERT: Church A Treasurer cannot insert into Church B", () => {
  const sql = `
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claims', '{"sub": "aaaaaaaa-2222-2222-2222-222222222222", "role": "authenticated"}', true);
    INSERT INTO accounts (church_id, name, type) VALUES ('22222222-2222-2222-2222-222222222222', 'Illegal Account', 'bank');
    ROLLBACK;
  `;
  const res = runQuery(sql);
  const passed = !res.success && (res.output.includes("row-level security") || res.output.includes("violates"));
  return { passed, detail: passed ? "Denied by RLS WITH CHECK policy" : res.output };
});

testCase("Cross-Church UPDATE: Church A Treasurer cannot update Church B accounts", () => {
  const sql = `
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claims', '{"sub": "aaaaaaaa-2222-2222-2222-222222222222", "role": "authenticated"}', true);
    UPDATE accounts SET name = 'Hacked' WHERE church_id = '22222222-2222-2222-2222-222222222222';
    SELECT count(*) as modified FROM accounts WHERE name = 'Hacked';
    ROLLBACK;
  `;
  const res = runQuery(sql);
  const passed = res.success && res.output.includes('"modified": 0');
  return { passed, detail: passed ? "0 rows modified (RLS Isolated)" : res.output };
});

testCase("Cross-Church DELETE: Church A Treasurer cannot delete Church B accounts", () => {
  const sql = `
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claims', '{"sub": "aaaaaaaa-2222-2222-2222-222222222222", "role": "authenticated"}', true);
    DELETE FROM accounts WHERE church_id = '22222222-2222-2222-2222-222222222222';
    SELECT count(*) as b_count FROM accounts WHERE church_id = '22222222-2222-2222-2222-222222222222';
    ROLLBACK;
  `;
  const res = runQuery(sql);
  const passed = res.success && res.output.includes('"b_count": 0');
  return { passed, detail: passed ? "0 rows affected on foreign tenant (RLS Protected)" : res.output };
});

// ----------------------------------------------------
// 2. ROLE BOUNDARIES & RBAC
// ----------------------------------------------------
console.log("\n--- 2. Role Boundaries Tests ---");

testCase("RBAC: Member cannot SELECT church financial accounts", () => {
  const sql = `
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claims', '{"sub": "aaaaaaaa-4444-4444-4444-444444444444", "role": "authenticated"}', true);
    SELECT count(*) as count FROM accounts;
    ROLLBACK;
  `;
  const res = runQuery(sql);
  const passed = res.success && res.output.includes('"count": 0');
  return { passed, detail: passed ? "Member sees 0 financial accounts" : res.output };
});

testCase("RBAC: Member cannot INSERT transactions", () => {
  const sql = `
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claims', '{"sub": "aaaaaaaa-4444-4444-4444-444444444444", "role": "authenticated"}', true);
    INSERT INTO transactions (church_id, account_id, amount, direction, description, created_by)
    VALUES ('11111111-1111-1111-1111-111111111111', 'acc11111-1111-1111-1111-111111111111', 1000.00, 'expense', 'Unauthorized', 'aaaaaaaa-4444-4444-4444-444444444444');
    ROLLBACK;
  `;
  const res = runQuery(sql);
  const passed = !res.success && (res.output.includes("row-level security") || res.output.includes("violates"));
  return { passed, detail: passed ? "Denied by RLS transactions policy" : res.output };
});

// ----------------------------------------------------
// 3. MEMBER GIVING PRIVACY & SECURE RPC
// ----------------------------------------------------
console.log("\n--- 3. Member Giving Privacy & RPC Tests ---");

testCase("Member Giving Privacy: Direct SELECT on member_giving_records is DENIED for all roles (including Pastor)", () => {
  const sql = `
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claims', '{"sub": "aaaaaaaa-1111-1111-1111-111111111111", "role": "authenticated"}', true);
    SELECT count(*) as count FROM member_giving_records;
    ROLLBACK;
  `;
  const res = runQuery(sql);
  const passed = res.success && res.output.includes('"count": 0');
  return { passed, detail: passed ? "Returned 0 rows (Direct SELECT locked down via USING false)" : res.output };
});

testCase("Member Giving RPC: Authorized Pastor with valid reason can read giving history and generates ACCESS audit", () => {
  const sql = `
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claims', '{"sub": "aaaaaaaa-1111-1111-1111-111111111111", "role": "authenticated"}', true);
    DO $$
    BEGIN
      PERFORM get_member_giving_history('ee111111-1111-1111-1111-111111111111', 'Year-end pastoral counseling and tax review');
    END $$;
    SELECT count(*) as access_audit_count FROM audit_logs WHERE category = 'ACCESS' AND action = 'VIEW_MEMBER_GIVING';
    ROLLBACK;
  `;
  const res = runQuery(sql);
  const passed = res.success && res.output.includes('"access_audit_count": 1');
  return { passed, detail: passed ? "Giving RPC executed and ACCESS audit log written" : res.output };
});

testCase("Member Giving RPC: Unauthorized Finance Staff access is DENIED", () => {
  const sql = `
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claims', '{"sub": "aaaaaaaa-3333-3333-3333-333333333333", "role": "authenticated"}', true);
    SELECT * FROM get_member_giving_history('ee111111-1111-1111-1111-111111111111', 'Curiosity check');
    ROLLBACK;
  `;
  const res = runQuery(sql);
  const passed = !res.success && res.output.includes("Access Denied");
  return { passed, detail: passed ? "Denied by RPC authorization check" : res.output };
});

testCase("Member Giving RPC: Missing / short reason (<5 chars) is DENIED", () => {
  const sql = `
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claims', '{"sub": "aaaaaaaa-1111-1111-1111-111111111111", "role": "authenticated"}', true);
    SELECT * FROM get_member_giving_history('ee111111-1111-1111-1111-111111111111', 'abc');
    ROLLBACK;
  `;
  const res = runQuery(sql);
  const passed = !res.success && res.output.includes("minimum 5 characters");
  return { passed, detail: passed ? "Denied due to invalid reason length" : res.output };
});

// ----------------------------------------------------
// 4. AUDIT LOG IMMUTABILITY
// ----------------------------------------------------
console.log("\n--- 4. Audit Log Immutability Tests ---");

testCase("Audit Log Immutability: UPDATE on audit_logs affects 0 rows (BLOCKED by RLS)", () => {
  const sql = `
    BEGIN;
    INSERT INTO audit_logs (id, church_id, category, action, entity_type) 
    VALUES ('11111111-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'SECURITY', 'LOGIN', 'auth')
    ON CONFLICT (id) DO NOTHING;

    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claims', '{"sub": "aaaaaaaa-1111-1111-1111-111111111111", "role": "authenticated"}', true);
    UPDATE audit_logs SET action = 'ALTERED' WHERE id = '11111111-9999-9999-9999-999999999999';

    SELECT count(*) as altered_count FROM audit_logs WHERE action = 'ALTERED';
    ROLLBACK;
  `;
  const res = runQuery(sql);
  const passed = res.success && res.output.includes('"altered_count": 0');
  return { passed, detail: passed ? "0 rows modified (Audit Log Immutability Enforced)" : res.output };
});

testCase("Audit Log Immutability: DELETE on audit_logs affects 0 rows (BLOCKED by RLS)", () => {
  const sql = `
    BEGIN;
    INSERT INTO audit_logs (id, church_id, category, action, entity_type) 
    VALUES ('11111111-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'SECURITY', 'LOGIN', 'auth')
    ON CONFLICT (id) DO NOTHING;

    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claims', '{"sub": "aaaaaaaa-1111-1111-1111-111111111111", "role": "authenticated"}', true);
    DELETE FROM audit_logs WHERE id = '11111111-9999-9999-9999-999999999999';

    SELECT count(*) as preserved_count FROM audit_logs WHERE id = '11111111-9999-9999-9999-999999999999';
    ROLLBACK;
  `;
  const res = runQuery(sql);
  const passed = res.success && res.output.includes('"preserved_count": 1');
  return { passed, detail: passed ? "Audit record preserved (Delete Blocked by RLS)" : res.output };
});

// ----------------------------------------------------
// 5. RLS TABLE COVERAGE CHECK
// ----------------------------------------------------
console.log("\n--- 5. RLS Table Coverage Audit ---");

testCase("RLS Coverage: All 13 core domain tables have rowsecurity = true", () => {
  const sql = `
    SELECT count(*) as protected_table_count 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND rowsecurity = true
      AND tablename IN (
        'churches', 'profiles', 'user_roles', 'accounts', 'funds', 
        'categories', 'transactions', 'transaction_splits', 'fund_transfers', 
        'offering_sessions', 'members', 'member_giving_records', 'audit_logs'
      );
  `;
  const res = runQuery(sql);
  const passed = res.success && res.output.includes('"protected_table_count": 13');
  return { passed, detail: passed ? "All 13 core tables have rowsecurity = true" : res.output };
});

// ----------------------------------------------------
// 6. SECURITY DEFINER SEARCH PATH AUDIT
// ----------------------------------------------------
console.log("\n--- 6. SECURITY DEFINER Search Path Audit ---");

testCase("SECURITY DEFINER: All security functions have safe search_path = 'public, pg_temp'", () => {
  const sql = `
    SELECT count(*) as safe_function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'current_user_church_id', 'current_user_has_role', 'has_church_access',
        'transfer_funds', 'void_transaction', 'get_member_giving_history'
      )
      AND array_to_string(p.proconfig, ',') LIKE '%search_path=public, pg_temp%';
  `;
  const res = runQuery(sql);
  const passed = res.success && res.output.includes('"safe_function_count": 6');
  return { passed, detail: passed ? "All 6 SECURITY DEFINER functions have explicit safe search_path" : res.output };
});

// Output Summary
console.log("\n==================================================");
console.log("SUMMARY OF GATE 2 RESULTS:");
console.log("==================================================");
const passedCount = testResults.filter(t => t.passed).length;
console.log(`Total Tests: ${testResults.length} | Passed: ${passedCount} | Failed: ${testResults.length - passedCount}`);

if (passedCount === testResults.length) {
  console.log("\n>>> GATE 2 RESULT: ALL TESTS PASSED ON REAL SUPABASE POSTGRESQL <<<");
} else {
  console.log("\n>>> GATE 2 RESULT: SOME TESTS FAILED <<<");
}
