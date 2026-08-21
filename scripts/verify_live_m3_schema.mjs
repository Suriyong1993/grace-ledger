import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function runQuery(sql) {
  const tmpDir = path.resolve("tmp_queries");
  fs.mkdirSync(tmpDir, { recursive: true });
  const tempFile = path.resolve(tmpDir, `verify_${Date.now()}_${Math.random().toString(36).substring(7)}.sql`);
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

console.log("===================================================================");
console.log("M3 STEP 4: LIVE POSTGRESQL 17 SCHEMA & COMPONENT VERIFICATION");
console.log("===================================================================");

const verificationSql = `
WITH table_audit AS (
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name LIKE 'offering_%'
),
column_audit AS (
  SELECT table_name, column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name LIKE 'offering_%'
  ORDER BY table_name, ordinal_position
),
constraint_audit AS (
  SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(c.oid) AS def
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE n.nspname = 'public' AND conrelid::regclass::text LIKE 'offering_%'
  ORDER BY table_name, conname
),
rpc_audit AS (
  SELECT routine_name, data_type AS return_type
  FROM information_schema.routines
  WHERE routine_schema = 'public' AND routine_name IN (
    'create_offering_session',
    'revise_offering_expected_amount',
    'start_cash_count',
    'record_cash_count',
    'resolve_offering_variance',
    'confirm_offering_session',
    'post_offering_to_ledger'
  )
  ORDER BY routine_name
),
trigger_audit AS (
  SELECT event_object_table, trigger_name, action_timing, event_manipulation
  FROM information_schema.triggers
  WHERE trigger_schema = 'public' AND event_object_table LIKE 'offering_%'
  ORDER BY event_object_table, trigger_name
),
policy_audit AS (
  SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename LIKE 'offering_%'
  ORDER BY tablename, policyname
),
index_audit AS (
  SELECT tablename, indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename LIKE 'offering_%'
  ORDER BY tablename, indexname
)
SELECT jsonb_build_object(
  'tables', (SELECT jsonb_agg(table_name) FROM table_audit),
  'columns_count', (SELECT count(*) FROM column_audit),
  'constraints_count', (SELECT count(*) FROM constraint_audit),
  'rpcs', (SELECT jsonb_agg(routine_name) FROM rpc_audit),
  'triggers', (SELECT jsonb_agg(trigger_name) FROM trigger_audit),
  'policies_count', (SELECT count(*) FROM policy_audit),
  'indexes', (SELECT jsonb_agg(indexname) FROM index_audit)
) AS verification_summary;
`;

const res = runQuery(verificationSql);
console.log("\n--- LIVE VERIFICATION SUMMARY ---");
console.log(res.output);
