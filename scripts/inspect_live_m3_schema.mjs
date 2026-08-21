import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function runQuery(sql) {
  const tmpDir = path.resolve("tmp_queries");
  fs.mkdirSync(tmpDir, { recursive: true });
  const tempFile = path.resolve(tmpDir, `inspect_${Date.now()}_${Math.random().toString(36).substring(7)}.sql`);
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

const queries = [
  {
    title: "1. offering_sessions columns",
    sql: `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'offering_sessions' ORDER BY ordinal_position;`
  },
  {
    title: "2. offering_sessions constraints",
    sql: `SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'offering_sessions';`
  },
  {
    title: "3. offering_sessions triggers",
    sql: `SELECT trigger_name, event_manipulation, action_statement FROM information_schema.triggers WHERE event_object_table = 'offering_sessions';`
  },
  {
    title: "4. offering_sessions existing rows count",
    sql: `SELECT count(*) AS total_rows FROM offering_sessions;`
  },
  {
    title: "5. existing RLS on offering_sessions",
    sql: `SELECT polname, polcmd, polroles::regrole[], polqual, polwithcheck FROM pg_policy pol JOIN pg_class pc ON pol.polrelid = pc.oid WHERE pc.relname = 'offering_sessions';`
  },
  {
    title: "6. existing accounts and types",
    sql: `SELECT id, name, type, current_balance FROM accounts LIMIT 5;`
  },
  {
    title: "7. existing funds",
    sql: `SELECT id, name, current_balance FROM funds LIMIT 5;`
  }
];

console.log("==================================================");
console.log("M3 PHASE 1A: LIVE SUPABASE SCHEMA INSPECTION");
console.log("==================================================");

for (const q of queries) {
  console.log(`\n>>> ${q.title} <<<`);
  const res = runQuery(q.sql);
  try {
    const parsed = JSON.parse(res.output);
    console.log(JSON.stringify(parsed.rows || parsed, null, 2));
  } catch {
    console.log(res.output);
  }
}
