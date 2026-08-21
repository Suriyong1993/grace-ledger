import fs from "node:fs";

const mig010 = fs.readFileSync("supabase/migrations/20260819000010_offering_core_schema_repair.sql", "utf-8");
const mig011 = fs.readFileSync("supabase/migrations/20260819000011_offering_rpcs_and_triggers.sql", "utf-8");
const mig012 = fs.readFileSync("supabase/migrations/20260819000012_offering_rls_policies.sql", "utf-8");

const scriptContent = fs.readFileSync("scripts/pre_apply_audit_m3.mjs", "utf-8");
const match = scriptContent.match(/const comprehensiveAuditSql = `([\s\S]*?)`;/);

if (match) {
  const sql = match[1]
    .replace("${mig010}", mig010)
    .replace("${mig011}", mig011)
    .replace("${mig012}", mig012);

  const lines = sql.split("\n");
  console.log(`Total lines: ${lines.length}`);
  for (let i = Math.max(0, 1467 - 20); i < Math.min(lines.length, 1467 + 20); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
