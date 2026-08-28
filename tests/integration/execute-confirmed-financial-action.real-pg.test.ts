import { describe, it, expect, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PgLab } from "../../scripts/pg-lab.mjs";

// REAL-PostgreSQL integration test for execute_confirmed_financial_action.
//
// Boots a throwaway PostgreSQL 17 instance (scripts/pg-lab.mjs), applies every
// migration in supabase/migrations in order — including the new migration 022
// that fixes the orchestrator — and exercises the fixed function end to end.
// This is NOT a mock and NOT the Map-based fake in financial-action-endpoint.
//
// If the lab cannot boot in this environment (no binaries / not elevated), the
// suite is SKIPPED rather than failed so the deterministic unit suite stays
// green; run under an elevated shell for the full verification.
//
// Verification points required by the task:
//   (1) confirmed transaction gets posted
//   (2) audit log entry is correct
//   (3) idempotency record is created / completed + replay protection
//   (4) fund transfer is reflected in fund_transfers
// Plus: security (cross-user, cross-tenant, wrong nonce/hash) and a preserved
// financial invariant (positive splits, split-sum parity, amount > 0).

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../supabase/migrations",
);

const lab = new PgLab();
let booted = false;

// Stable UUIDs for a realistic two-church fixture.
const CHURCH_A = "10000000-0000-0000-0000-0000000000aa";
const CHURCH_B = "20000000-0000-0000-0000-0000000000bb";
const TREASURER = "30000000-0000-0000-0000-0000000000aa";
const OTHER_USER = "30000000-0000-0000-0000-0000000000bb";
const TREASURER_B = "30000000-0000-0000-0000-0000000000cc";
const TREASURER2 = "30000000-0000-0000-0000-0000000000dd";

const ACCOUNT_A = "40000000-0000-0000-0000-0000000000aa";
const FUND_MAIN = "50000000-0000-0000-0000-0000000000aa";
const FUND_MISSION = "50000000-0000-0000-0000-0000000000bb";

const PAYLOAD_HASH = "a".repeat(64);

function n(suffix: string) {
  return `nonce_${suffix}_0000000000000001`;
}

async function seedChurchA() {
  const c = lab.client!;
  await c.query(`INSERT INTO churches (id, name) VALUES ($1,'Grace Test Church')`, [CHURCH_A]);
  await c.query(
    `INSERT INTO profiles (id, church_id, email, full_name) VALUES ($1,$2,'t@a.local','Treasurer'), ($3,$2,'u@a.local','Other'), ($4,$2,'t2@a.local','Treasurer 2')`,
    [TREASURER, CHURCH_A, OTHER_USER, TREASURER2],
  );
  await c.query(
    `INSERT INTO user_roles (user_id, church_id, role) VALUES ($1,$2,'treasurer'), ($3,$2,'treasurer')`,
    [TREASURER, CHURCH_A, TREASURER2],
  );
  await c.query(
    `INSERT INTO accounts (id, church_id, name, type, current_balance) VALUES ($1,$2,'Cash Drawer','cash_drawer',10000.00)`,
    [ACCOUNT_A, CHURCH_A],
  );
  await c.query(
    `INSERT INTO funds (id, church_id, name, current_balance) VALUES ($1,$2,'General Fund',10000.00), ($3,$2,'Mission Fund',5000.00)`,
    [FUND_MAIN, CHURCH_A, FUND_MISSION],
  );
}

async function seedChurchB() {
  const c = lab.client!;
  await c.query(`INSERT INTO churches (id, name) VALUES ($1,'Church B')`, [CHURCH_B]);
  await c.query(
    `INSERT INTO profiles (id, church_id, email, full_name) VALUES ($1,$2,'t@b.local','Treasurer B')`,
    [TREASURER_B, CHURCH_B],
  );
  await c.query(
    `INSERT INTO user_roles (user_id, church_id, role) VALUES ($1,$2,'treasurer')`,
    [TREASURER_B, CHURCH_B],
  );
}

async function insertConfirmation(p: {
  id: string;
  churchId: string;
  userId: string;
  action: string;
  toolName: string;
  resourceId: string | null;
  normalized: Record<string, unknown>;
  hash: string;
  nonce: string;
}) {
  await lab.client!.query(
    `INSERT INTO action_confirmations (
       id, church_id, user_id, action, tool_name, resource_id,
       normalized_parameters, payload_hash, nonce, status, expires_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,'pending', now() + interval '10 minutes')`,
    [
      p.id,
      p.churchId,
      p.userId,
      p.action,
      p.toolName,
      p.resourceId,
      JSON.stringify(p.normalized),
      p.hash,
      p.nonce,
    ],
  );
}

/** Runs the orchestrator as TREASURER with the given confirmation + key. */
async function run(
  confId: string,
  key: string,
  nonce: string,
  hash = PAYLOAD_HASH,
  user = TREASURER,
): Promise<{ rows: any[] }> {
  return lab.asUser(user, "authenticated", () =>
    lab.client!.query("SELECT execute_confirmed_financial_action($1,$2,$3,$4,$5) AS r", [
      confId,
      CHURCH_A,
      hash,
      nonce,
      key,
    ]) as any,
  ) as any;
}

// Boot at module top-level so -> booted is known when the describe block is
// registered (top-level await is supported in ESM test modules). Placed after
// the fixture constants / seed helpers so no const is read before init.
try {
  await lab.start({ migrationsDir });
  await seedChurchA();
  await seedChurchB();
  booted = true;
} catch (err) {
  booted = false;
  const reason = (err as Error).message;
  console.warn(
    [
      "",
      "############################################################",
      "# SKIPPED: execute_confirmed_financial_action (real PostgreSQL 17)",
      "# This suite did NOT run. Financial RPC/schema bugs it would",
      "# catch (e.g. the 2026-08-25 ERROR 42703 schema drift) can",
      "# reach production undetected while this stays skipped.",
      `# Reason: ${reason}`,
      "# Fix: run under an elevated shell so the embedded PG lab can",
      "# create its unprivileged service account, then re-run.",
      "############################################################",
      "",
    ].join("\n"),
  );
}

describe.runIf(booted)("execute_confirmed_financial_action (real PostgreSQL 17)", () => {
  it("(post) confirmed transaction is posted + fund/account balances move", async () => {
    const txnId = "60000000-0000-0000-0000-0000000000a1";
    const confId = "70000000-0000-0000-0000-0000000000a1";
    const nonce = n("post");

    await lab.client!.query(
      `INSERT INTO transactions (id, church_id, account_id, amount, direction, status, description, created_by, approved_by, reference_number)
       VALUES ($1,$2,$3,5000.00,'income','approved','Test income',$4,$4,'T-1001')`,
      [txnId, CHURCH_A, ACCOUNT_A, TREASURER],
    );
    await lab.client!.query(
      `INSERT INTO transaction_splits (transaction_id, church_id, fund_id, amount, note)
       VALUES ($1,$2,$3,3000.00,'main'), ($1,$2,$4,2000.00,'mission')`,
      [txnId, CHURCH_A, FUND_MAIN, FUND_MISSION],
    );
    await insertConfirmation({
      id: confId, churchId: CHURCH_A, userId: TREASURER,
      action: "post_transaction", toolName: "propose_post_transaction", resourceId: txnId,
      normalized: { transaction_id: txnId, summary_justification: "approved" },
      hash: PAYLOAD_HASH, nonce,
    });

    await run(confId, "idem_post_01", nonce);

    // (1) transaction posted
    const txn = await lab.client!.query("SELECT status, posted_at FROM transactions WHERE id=$1", [txnId]);
    expect(txn.rows[0].status).toBe("posted");
    expect(txn.rows[0].posted_at).toBeTruthy();

    // account credited by full amount; funds credited by split sums
    const acc = await lab.client!.query("SELECT current_balance FROM accounts WHERE id=$1", [ACCOUNT_A]);
    expect(Number(acc.rows[0].current_balance)).toBe(15000.0); // 10000 + 5000
    const fm = await lab.client!.query("SELECT current_balance FROM funds WHERE id=$1", [FUND_MAIN]);
    const fs = await lab.client!.query("SELECT current_balance FROM funds WHERE id=$1", [FUND_MISSION]);
    expect(Number(fm.rows[0].current_balance)).toBe(13000.0); // 10000 + 3000
    expect(Number(fs.rows[0].current_balance)).toBe(7000.0); // 5000 + 2000

    // (2) audit log written by the orchestrator with a valid FINANCIAL category
    const audit = await lab.client!.query(
      `SELECT category, action, entity_id FROM audit_logs WHERE church_id=$1 AND entity_type='financial_action' AND entity_id=$2`,
      [CHURCH_A, txnId],
    );
    expect(audit.rows.length).toBeGreaterThanOrEqual(1);
    expect(audit.rows[0].category).toBe("FINANCIAL");
    expect(audit.rows[0].action).toBe("EXECUTE_POST_TRANSACTION");

    // (3) idempotency record completed
    const idem = await lab.client!.query(
      `SELECT status, operation, response_body FROM idempotency_keys WHERE church_id=$1 AND idempotency_key=$2`,
      [CHURCH_A, "idem_post_01"],
    );
    expect(idem.rows[0].status).toBe("completed");
    expect(idem.rows[0].operation).toBe("execute_confirmed_financial_action");
    expect(idem.rows[0].response_body?.success).toBe(true);
  }, 60000);

  it("(transfer) moves money through fund_transfers, no negative splits", async () => {
    const confId = "70000000-0000-0000-0000-0000000000a2";
    const nonce = n("transfer");

    await insertConfirmation({
      id: confId, churchId: CHURCH_A, userId: TREASURER,
      action: "fund_transfer", toolName: "propose_fund_transfer", resourceId: null,
      normalized: { from_fund_id: FUND_MAIN, to_fund_id: FUND_MISSION, amount: "1000.00", reason: "top up" },
      hash: PAYLOAD_HASH, nonce,
    });

    const beforeMain = Number(
      (await (lab.client!.query("SELECT current_balance FROM funds WHERE id=$1", [FUND_MAIN]) as any)).rows[0].current_balance,
    );
    const beforeMission = Number(
      (await (lab.client!.query("SELECT current_balance FROM funds WHERE id=$1", [FUND_MISSION]) as any)).rows[0].current_balance,
    );

    const { rows } = await run(confId, "idem_transfer_01", nonce);
    const resourceId: string = rows[0].r.resource_id;

    // (4) a fund_transfers ledger row is written
    const ft = await lab.client!.query(
      `SELECT from_fund_id, to_fund_id, amount, status FROM fund_transfers WHERE id=$1 AND church_id=$2`,
      [resourceId, CHURCH_A],
    );
    expect(ft.rows[0].status).toBe("completed");
    expect(Number(ft.rows[0].amount)).toBe(1000.0);

    // balances move atomically by exactly the transfer amount (tests share one
    // DB, so assert against the pre-transfer snapshot, not absolute values).
    const fm = await lab.client!.query("SELECT current_balance FROM funds WHERE id=$1", [FUND_MAIN]);
    const fs = await lab.client!.query("SELECT current_balance FROM funds WHERE id=$1", [FUND_MISSION]);
    expect(Number(fm.rows[0].current_balance)).toBeCloseTo(beforeMain - 1000.0, 2);
    expect(Number(fs.rows[0].current_balance)).toBeCloseTo(beforeMission + 1000.0, 2);

    // no transactions row published for the transfer (would have required a
    // fabricated account_id and caused negative splits in migration 016)
    const txnCount = await lab.client!.query(
      "SELECT count(*)::int AS n FROM transactions WHERE church_id=$1",
      [CHURCH_A],
    );
    expect(txnCount.rows[0].n).toBe(1); // only the income txn from the first test

    // audit recorded with valid FINANCIAL category
    const audit = await lab.client!.query(
      `SELECT category, action FROM audit_logs WHERE church_id=$1 AND entity_type='financial_action' AND entity_id=$2`,
      [CHURCH_A, resourceId],
    );
    expect(audit.rows[0].category).toBe("FINANCIAL");
    expect(audit.rows[0].action).toBe("EXECUTE_FUND_TRANSFER");
  }, 60000);

  it("(idempotent replay) same key + payload returns cached body, no double-mutation", async () => {
    const confId = "70000000-0000-0000-0000-0000000000a3";
    const nonce = n("transfer2");

    await insertConfirmation({
      id: confId, churchId: CHURCH_A, userId: TREASURER,
      action: "fund_transfer", toolName: "propose_fund_transfer", resourceId: null,
      normalized: { from_fund_id: FUND_MAIN, to_fund_id: FUND_MISSION, amount: "100.00", reason: "replay" },
      hash: PAYLOAD_HASH, nonce,
    });

    const first = await run(confId, "idem_replay_01", nonce);
    const beforeMain = Number(
      (await (lab.client!.query("SELECT current_balance FROM funds WHERE id=$1", [FUND_MAIN]) as any)).rows[0].current_balance,
    );

    // Second call, same key, same payload hash -> cached response, no mutation.
    const second = await run(confId, "idem_replay_01", nonce);
    const afterMain = Number(
      (await (lab.client!.query("SELECT current_balance FROM funds WHERE id=$1", [FUND_MAIN]) as any)).rows[0].current_balance,
    );

    expect(second.rows[0].r.success).toBe(true);
    expect(second.rows[0].r.resource_id).toBe(first.rows[0].r.resource_id);
    expect(afterMain).toBe(beforeMain); // mutated once, not twice
  }, 60000);

  it("rejects wrong nonce (P0005) and wrong payload hash (P0006) with no mutation", async () => {
    const confId = "70000000-0000-0000-0000-0000000000a4";
    const nonce = n("tamper");

    await insertConfirmation({
      id: confId, churchId: CHURCH_A, userId: TREASURER,
      action: "fund_transfer", toolName: "propose_fund_transfer", resourceId: null,
      normalized: { from_fund_id: FUND_MAIN, to_fund_id: FUND_MISSION, amount: "50.00", reason: "tamper" },
      hash: PAYLOAD_HASH, nonce,
    });

    await expect(run(confId, "idem_tamper_01", "wrong_nonce_00000001")).rejects.toThrow(/Nonce Mismatch/);
    await expect(run(confId, "idem_tamper_01", nonce, "b".repeat(64))).rejects.toThrow(/Payload Hash Mismatch/);
  }, 60000);

  it("rejects cross-user execution (confirmation belongs to another user)", async () => {
    const confId = "70000000-0000-0000-0000-0000000000a5";
    const nonce = n("crossuser");

    await insertConfirmation({
      id: confId, churchId: CHURCH_A, userId: TREASURER,
      action: "fund_transfer", toolName: "propose_fund_transfer", resourceId: null,
      normalized: { from_fund_id: FUND_MAIN, to_fund_id: FUND_MISSION, amount: "25.00", reason: "xuser" },
      hash: PAYLOAD_HASH, nonce,
    });

    // TREASURER2 is also a church-A treasurer, so the treasurer gate passes and
    // the cross-user ownership check is the one that must fire.
    await expect(run(confId, "idem_xuser_01", nonce, PAYLOAD_HASH, TREASURER2)).rejects.toThrow(
      /Cross-User Access Denied/,
    );
  }, 60000);

  it("rejects cross-tenant execution (confirmation belongs to another church)", async () => {
    const confId = "70000000-0000-0000-0000-0000000000a6";
    const nonce = n("xtenant");

    // Confirmation created in CHURCH_B, but the caller passes CHURCH_A.
    await lab.client!.query(
      `INSERT INTO action_confirmations (
         id, church_id, user_id, action, tool_name, resource_id,
         normalized_parameters, payload_hash, nonce, status, expires_at
       ) VALUES ($1,$2,$3,'fund_transfer','propose_fund_transfer',NULL,$4::jsonb,$5,$6,'pending',now()+interval '10 minutes')`,
      [confId, CHURCH_B, TREASURER, JSON.stringify({ from_fund_id: FUND_MAIN, to_fund_id: FUND_MISSION, amount: "1.00", reason: "xt" }), PAYLOAD_HASH, nonce],
    );

    // Execute against CHURCH_A (the treasury's church) -> cross-tenant.
    await expect(
      lab.asUser(TREASURER, "authenticated", () =>
        lab.client!.query("SELECT execute_confirmed_financial_action($1,$2,$3,$4,$5) AS r", [
          confId, CHURCH_A, PAYLOAD_HASH, nonce, "idem_xtenant_01",
        ]) as any,
      ),
    ).rejects.toThrow(/Cross-Tenant Access Denied/);
  }, 60000);

  it("preserves the amount > 0 invariant: insufficient funds are rejected with no mutation", async () => {
    const confId = "70000000-0000-0000-0000-0000000000a7";
    const nonce = n("insufficient");

    await insertConfirmation({
      id: confId, churchId: CHURCH_A, userId: TREASURER,
      action: "fund_transfer", toolName: "propose_fund_transfer", resourceId: null,
      normalized: { from_fund_id: FUND_MAIN, to_fund_id: FUND_MISSION, amount: "999999.00", reason: "too big" },
      hash: PAYLOAD_HASH, nonce,
    });

    await expect(run(confId, "idem_insuff_01", nonce)).rejects.toThrow(/Insufficient Funds/i);
  }, 60000);
});

afterAll(async () => {
  await lab.stop();
  console.log("real-PG lab torn down.");
});

