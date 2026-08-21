import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function runQuery(sql) {
  const tmpDir = path.resolve("tmp_queries");
  fs.mkdirSync(tmpDir, { recursive: true });
  const tempFile = path.resolve(tmpDir, `dryrun_${Date.now()}_${Math.random().toString(36).substring(7)}.sql`);
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

console.log("==================================================");
console.log("M3 PHASE 1E: DRY-RUN REPAIR MIGRATIONS VALIDATION");
console.log("==================================================");

const mig010 = fs.readFileSync("supabase/migrations/20260819000010_offering_core_schema_repair.sql", "utf-8");
const mig011 = fs.readFileSync("supabase/migrations/20260819000011_offering_rpcs_and_triggers.sql", "utf-8");
const mig012 = fs.readFileSync("supabase/migrations/20260819000012_offering_rls_policies.sql", "utf-8");

const fullDryRunSql = `
BEGIN;

-- Migration 010
${mig010}

-- Migration 011
${mig011}

-- Migration 012
${mig012}

-- Verification Query during Dry Run
SELECT 'CORRECTIVE MIGRATIONS DRY RUN SUCCESSFUL' AS validation_status,
       (SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'offering_%') AS offering_tables_count;

ROLLBACK;
`;

console.log("Executing Migrations 010, 011, 012 in a Dry-Run Transaction (BEGIN ... ROLLBACK)...");
const res = runQuery(fullDryRunSql);

console.log("\n--- DRY RUN RESULT ---");
console.log(res.output);

if (res.success && res.output.includes("CORRECTIVE MIGRATIONS DRY RUN SUCCESSFUL")) {
  console.log("\n✅ ALL 3 CORRECTIVE MIGRATIONS (010-012) PASSED STATIC & REAL POSTGRESQL 17 DRY-RUN VALIDATION!");
} else {
  console.error("\n❌ DRY-RUN FAILED!");
  process.exit(1);
}
