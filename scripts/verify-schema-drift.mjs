// STEP 1 EVIDENCE — Confirm schema drift on a REAL PostgreSQL 17 instance.
//
// Boots a throwaway local Postgres (see scripts/pg-lab.mjs), applies every
// migration in supabase/migrations in order, then reproduces the two suspected
// drift defects and prints the exact database error output:
//
//   A. migration 016 execute_confirmed_financial_action vs. the real schema
//   B. application-layer `funds.target_budget` vs. the real `funds.target_amount`
//
// No production or staging system is touched. Prints a log suitable for
// docs/FIX_LOG.md.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PgLab } from "./pg-lab.mjs";

const repoRoot = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const migrationsDir = path.join(repoRoot, "supabase", "migrations");

const CHURCH = "c0000000-0000-0000-0000-000000000001";
const TREASURER = "e0000000-0000-0000-0000-000000000001";
const CASH_ACCOUNT = "a0000000-0000-0000-0000-000000000001";
const FUND_A = "f0000000-0000-0000-0000-000000000001";
const FUND_B = "f0000000-0000-0000-0000-000000000002";
const CONF_ID = "00000000-0000-0000-0000-00000000c001";
const PAYLOAD_HASH = "0".repeat(64);
const NONCE = "nonce_drift_probe_0001";

const lab = new PgLab();

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function record(label, err) {
  const msg = err?.message ?? String(err);
  const code = err?.code ?? err?.severity ?? "n/a";
  console.log(`[${label}]`);
  console.log(`  error code: ${code}`);
  console.log(`  message:    ${msg}`);
}

try {
  section("BOOT: applying all migrations to a fresh real PostgreSQL instance");
  await lab.start({ migrationsDir });
  console.log(`applied ${lab.migrationsApplied.length} migrations, in order:`);
  console.log("  " + lab.migrationsApplied.join("\n  "));
  const version = await lab.client.query("SELECT version()");
  console.log("\n" + version.rows[0].version);

  section("FIXTURE: church / treasurer / accounts / funds / pending confirmation");
  await lab.client.query(
    `INSERT INTO churches (id, name) VALUES ($1, 'Drift Probe Church')`,
    [CHURCH],
  );
  await lab.client.query(
    `INSERT INTO profiles (id, church_id, email, full_name) VALUES ($1, $2, 'treasurer@probe.local', 'Probe Treasurer')`,
    [TREASURER, CHURCH],
  );
  await lab.client.query(
    `INSERT INTO user_roles (user_id, church_id, role) VALUES ($1, $2, 'treasurer')`,
    [TREASURER, CHURCH],
  );
  await lab.client.query(
    `INSERT INTO accounts (id, church_id, name, type, current_balance) VALUES ($1, $2, 'Cash Drawer', 'cash_drawer', 100000.00)`,
    [CASH_ACCOUNT, CHURCH],
  );
  await lab.client.query(
    `INSERT INTO funds (id, church_id, name, current_balance) VALUES ($1, $2, 'General Fund', 50000.00), ($3, $4, 'Mission Fund', 20000.00)`,
    [FUND_A, CHURCH, FUND_B, CHURCH],
  );
  await lab.client.query(
    `INSERT INTO action_confirmations (
       id, church_id, user_id, action, tool_name, resource_id,
       normalized_parameters, payload_hash, nonce, status, expires_at
     ) VALUES ($1, $2, $3, 'fund_transfer', 'propose_fund_transfer', NULL, $4, $5, $6, 'pending', now() + interval '10 minutes')`,
    [
      CONF_ID,
      CHURCH,
      TREASURER,
      JSON.stringify({ from_fund_id: FUND_A, to_fund_id: FUND_B, amount: "1000.00", reason: "probe transfer" }),
      PAYLOAD_HASH,
      NONCE,
    ],
  );
  console.log("fixture rows inserted.");

  section("PROBE A: execute_confirmed_financial_action (migration 016 as written)");
  try {
    await lab.asUser(TREASURER, "authenticated", async () => {
      await lab.client.query("SELECT execute_confirmed_financial_action($1, $2, $3, $4, $5)", [
        CONF_ID,
        CHURCH,
        PAYLOAD_HASH,
        NONCE,
        "idem_drift_probe_0001",
      ]);
    });
    console.log("[A] UNEXPECTED: the call succeeded — drift not reproduced?");
  } catch (err) {
    record("A: run 1 (fund_transfer action)", err);
  }

  section("PROBE B: application-layer query SELECT target_budget FROM funds");
  try {
    await lab.client.query("SELECT target_budget FROM funds LIMIT 1");
    console.log("[B] UNEXPECTED: target_budget exists — drift not reproduced?");
  } catch (err) {
    record("B: SELECT target_budget", err);
  }

  section("CONTROL B': the real column name on funds");
  const cols = await lab.client.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'funds' AND column_name ILIKE 'target%'`
  );
  console.table(cols.rows);

  section("DONE — evidence captured");
} finally {
  await lab.stop();
  console.log("\nlab torn down (service removed, user removed, data directory removed).");
}
