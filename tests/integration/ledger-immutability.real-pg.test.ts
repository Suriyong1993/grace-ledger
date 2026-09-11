import { afterAll, describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PgLab } from "../../scripts/pg-lab.mjs";
import { handleRealPgBootFailure } from "./real-pg-boot";

// REAL-PostgreSQL integration test: the AUTHORIZATION BOUNDARY itself.
//
// Everything else in tests/ that mentions RLS or RBAC verifies a TypeScript
// simulation (rpc-and-rls.test.ts is explicitly a "DOMAIN LOGIC SIMULATION",
// full-security-e2e.test.ts drives a hand-written mock Supabase client) or a
// single RPC. None of them ask PostgreSQL what it actually does. This suite
// does, for two reasons:
//
//   1. A client-side permission check is never the security boundary. The only
//      boundary is RLS + the triggers/RPCs, and only a real server can prove
//      what they allow.
//   2. The audit of 2026-09-11 reproduced four CRITICAL/HIGH defects here
//      first (see migration 20260911000001_ledger_immutability_hardening.sql):
//      fabricated fund/account balances, an unguarded transactions.status that
//      allowed posted -> draft -> DELETE, and free rewriting of a posted
//      record's description/metadata/posted_at/approved_by. Each is pinned
//      below as a regression test, alongside the controls that prove the
//      sanctioned RPC path still works.
//
// Method: `lab.asUser(id, "authenticated", ...)` sets request.jwt.claims and
// SET ROLE authenticated — the same session a PostgREST request runs under.
// Fixtures are written by the superuser connection so seeding is never itself
// blocked by the policies under test.
//
// Reading the assertions: RLS does not raise on a filtered read or write, it
// silently returns/affects zero rows. So "no access" is asserted as
// `rows.length === 0` / `rowCount === 0`, and "blocked by a guard" is asserted
// as a rejected promise carrying the guard's SQLSTATE. Both are checked
// together with the post-state, so a silent no-op can never be mistaken for a
// successful attack or a successful feature.

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../supabase/migrations",
);

const lab = new PgLab();
let booted = false;

// Two tenants, so every isolation assertion has a real foreign row to reach for.
const CHURCH_A = "10000000-0000-0000-0000-00000000a001";
const CHURCH_B = "10000000-0000-0000-0000-00000000b001";

const SUPER_A = "20000000-0000-0000-0000-00000000a001";
const PASTOR_A = "20000000-0000-0000-0000-00000000a002";
const TREASURER_A = "20000000-0000-0000-0000-00000000a003";
const TREASURER2_A = "20000000-0000-0000-0000-00000000a004";
const FINANCE_A = "20000000-0000-0000-0000-00000000a005";
const MEMBER_A = "20000000-0000-0000-0000-00000000a006";
const TREASURER_B = "20000000-0000-0000-0000-00000000b001";
/** A UUID that is not in profiles at all — the "no session" caller. */
const STRANGER = "20000000-0000-0000-0000-00000000ffff";

const ACCOUNT_A = "30000000-0000-0000-0000-00000000a001";
const FUND_MAIN_A = "40000000-0000-0000-0000-00000000a001";
const FUND_MISSION_A = "40000000-0000-0000-0000-00000000a002";
const ACCOUNT_B = "30000000-0000-0000-0000-00000000b001";
const FUND_B = "40000000-0000-0000-0000-00000000b001";
const DONOR_A = "50000000-0000-0000-0000-00000000a001";

// Funds and accounts start at ZERO, matching the invariant
// reconcile_fund_balances() documents ("Funds start at 0.00 and ONLY financial
// RPCs move balances"). Seeding an opening balance here instead would make the
// final no-drift assertion meaningless, because a non-ledger-backed balance is
// exactly the drift that function reports.
const START_BALANCE = "0.00";

/** Sequential, deterministic transaction ids (the fixtures must be stable). */
let txnSeq = 0;
function nextTxnId(): string {
  txnSeq += 1;
  return `60000000-0000-0000-0000-${String(txnSeq).padStart(12, "0")}`;
}

async function seed() {
  const c = lab.client!;
  await c.query(`INSERT INTO churches (id, name) VALUES ($1,'Church A'),($2,'Church B')`, [
    CHURCH_A,
    CHURCH_B,
  ]);
  await c.query(
    `INSERT INTO profiles (id, church_id, email, full_name) VALUES
       ($1,$2,'super@a.local','Super A'),
       ($3,$2,'pastor@a.local','Pastor A'),
       ($4,$2,'treasurer@a.local','Treasurer A'),
       ($5,$2,'treasurer2@a.local','Treasurer 2 A'),
       ($6,$2,'finance@a.local','Finance A'),
       ($7,$2,'member@a.local','Member A'),
       ($8,$9,'treasurer@b.local','Treasurer B')`,
    [SUPER_A, CHURCH_A, PASTOR_A, TREASURER_A, TREASURER2_A, FINANCE_A, MEMBER_A, TREASURER_B, CHURCH_B],
  );
  await c.query(
    `INSERT INTO user_roles (user_id, church_id, role) VALUES
       ($1,$2,'super_admin'),
       ($3,$2,'pastor'),
       ($4,$2,'treasurer'),
       ($5,$2,'treasurer'),
       ($6,$2,'finance_staff'),
       ($7,$2,'member'),
       ($8,$9,'treasurer')`,
    [SUPER_A, CHURCH_A, PASTOR_A, TREASURER_A, TREASURER2_A, FINANCE_A, MEMBER_A, TREASURER_B, CHURCH_B],
  );
  await c.query(
    `INSERT INTO accounts (id, church_id, name, type, current_balance) VALUES
       ($1,$2,'Cash Drawer A','cash_drawer',$3),
       ($4,$5,'Cash Drawer B','cash_drawer',$3)`,
    [ACCOUNT_A, CHURCH_A, START_BALANCE, ACCOUNT_B, CHURCH_B],
  );
  await c.query(
    `INSERT INTO funds (id, church_id, name, current_balance) VALUES
       ($1,$2,'General Fund',$3),
       ($4,$2,'Mission Fund',0.00),
       ($5,$6,'Church B Fund',$3)`,
    [FUND_MAIN_A, CHURCH_A, START_BALANCE, FUND_MISSION_A, FUND_B, CHURCH_B],
  );
  await c.query(`INSERT INTO members (id, church_id, full_name) VALUES ($1,$2,'Donor A')`, [
    DONOR_A,
    CHURCH_A,
  ]);
  await c.query(
    `INSERT INTO member_giving_records (church_id, member_id, amount, given_at, created_by, confidential_note)
     VALUES ($1,$2,250.00,CURRENT_DATE,$3,'confidential')`,
    [CHURCH_A, DONOR_A, TREASURER_A],
  );
  await c.query(
    `INSERT INTO audit_logs (church_id, category, actor_id, action, entity_type)
     VALUES ($1,'FINANCIAL',$2,'SEED','transactions')`,
    [CHURCH_A, TREASURER_A],
  );
}

/** Insert a draft transaction + parity-correct split as the superuser fixture. */
async function seedDraft(
  amount = "500.00",
  opts: { churchId?: string; createdBy?: string; fundId?: string } = {},
): Promise<string> {
  const id = nextTxnId();
  const churchId = opts.churchId ?? CHURCH_A;
  const createdBy = opts.createdBy ?? FINANCE_A;
  const fundId = opts.fundId ?? FUND_MAIN_A;
  const accountId = churchId === CHURCH_A ? ACCOUNT_A : ACCOUNT_B;
  const c = lab.client!;
  await c.query(
    `INSERT INTO transactions
       (id, church_id, account_id, amount, direction, status, description, created_by, reference_number)
     VALUES ($1,$2,$3,$4,'income','draft','Seed offering',$5,$6)`,
    [id, churchId, accountId, amount, createdBy, `REF-${txnSeq}`],
  );
  await c.query(
    `INSERT INTO transaction_splits (transaction_id, church_id, fund_id, amount)
     VALUES ($1,$2,$3,$4)`,
    [id, churchId, fundId, amount],
  );
  return id;
}

/** draft -> pending_approval -> approved -> posted, through the real RPCs only. */
async function driveToPosted(id: string): Promise<void> {
  await as(FINANCE_A, "SELECT submit_transaction($1)", [id]);
  await as(TREASURER_A, "SELECT approve_transaction($1,$2)", [id, "approved by treasurer"]);
  await as(TREASURER_A, "SELECT post_transaction($1)", [id]);
}

/**
 * The subset of node-postgres' result surface used here. @types/pg is not a
 * dependency (scripts/pg-lab.d.mts relies on skipLibCheck), so the client's
 * return type does not survive into this file — declaring it keeps the
 * assertions below type-checked instead of silently `unknown`.
 */
interface PgQueryResult<R = any> {
  rows: R[];
  rowCount: number;
}

/** Run SQL as a simulated authenticated Supabase session. */
function as<R = any>(
  userId: string,
  sql: string,
  params: unknown[] = [],
): Promise<PgQueryResult<R>> {
  return lab.asUser(userId, "authenticated", () =>
    lab.client!.query(sql, params),
  ) as Promise<PgQueryResult<R>>;
}

/** Run SQL as the unauthenticated `anon` role. */
function asAnon<R = any>(sql: string, params: unknown[] = []): Promise<PgQueryResult<R>> {
  return lab.asUser(STRANGER, "anon", () =>
    lab.client!.query(sql, params),
  ) as Promise<PgQueryResult<R>>;
}

async function one<R = any>(sql: string, params: unknown[] = []): Promise<R> {
  const res = (await lab.client!.query(sql, params)) as PgQueryResult<R>;
  return res.rows[0];
}

const fundBalance = (id: string) =>
  one<{ current_balance: string }>("SELECT current_balance FROM funds WHERE id=$1", [id]).then(
    (r) => r.current_balance,
  );
const accountBalance = (id: string) =>
  one<{ current_balance: string }>(
    "SELECT current_balance FROM accounts WHERE id=$1",
    [id],
  ).then((r) => r.current_balance);
const txnRow = (id: string) =>
  one<any>(
    `SELECT status, amount, description, metadata, posted_at, approved_by, created_by,
            reference_number, transaction_date
     FROM transactions WHERE id=$1`,
    [id],
  );

try {
  await lab.start({ migrationsDir });
  await seed();
  booted = true;
} catch (err) {
  booted = handleRealPgBootFailure(err, [
    "# SKIPPED: ledger-immutability + authorization matrix (real PostgreSQL 17)",
    "# This suite did NOT run. RLS tenant isolation, the append-only audit",
    "# log, PIN-credential secrecy and the ledger immutability guards would",
    "# all ship unverified while this stays skipped.",
  ]);
}

describe.runIf(booted)("Authorization boundary — RLS and roles (real PostgreSQL 17)", () => {
  it("anon: every financial table reads back zero rows", async () => {
    for (const table of [
      "churches",
      "profiles",
      "user_roles",
      "accounts",
      "funds",
      "categories",
      "transactions",
      "transaction_splits",
      "fund_transfers",
      "offering_sessions",
      "members",
      "member_giving_records",
      "audit_logs",
      "auth_pins",
      "auth_pin_probes",
    ]) {
      const res = await asAnon(`SELECT * FROM ${table}`);
      expect(res.rows.length, `anon must see no rows in ${table}`).toBe(0);
    }
  });

  it("anon: cannot insert a transaction or a fund", async () => {
    const txn = await asAnon(
      `INSERT INTO transactions (church_id, account_id, amount, direction, status, description, created_by)
       VALUES ($1,$2,1.00,'income','draft','anon probe',$3) RETURNING id`,
      [CHURCH_A, ACCOUNT_A, TREASURER_A],
    ).then(
      (r) => ({ ok: true, rows: r.rows }),
      (e) => ({ ok: false, code: e.code }),
    );
    // Either RLS rejects the row (42501) or it inserts zero visible rows.
    expect(txn.ok === false || (txn as any).rows.length === 0).toBe(true);
  });

  it("cross-church: treasurer B cannot read or write church A", async () => {
    expect((await as(TREASURER_B, `SELECT * FROM transactions WHERE church_id=$1`, [CHURCH_A])).rows.length).toBe(0);
    expect((await as(TREASURER_B, `SELECT * FROM funds WHERE church_id=$1`, [CHURCH_A])).rows.length).toBe(0);
    expect((await as(TREASURER_B, `SELECT * FROM accounts WHERE church_id=$1`, [CHURCH_A])).rows.length).toBe(0);
    expect((await as(TREASURER_B, `SELECT * FROM profiles WHERE church_id=$1`, [CHURCH_A])).rows.length).toBe(0);
    expect((await as(TREASURER_B, `SELECT * FROM audit_logs WHERE church_id=$1`, [CHURCH_A])).rows.length).toBe(0);
    expect((await as(TREASURER_B, `SELECT * FROM members WHERE church_id=$1`, [CHURCH_A])).rows.length).toBe(0);

    // Writes are filtered to zero rows, and church A's money does not move.
    const upd = await as(TREASURER_B, `UPDATE funds SET name='hijacked' WHERE id=$1`, [FUND_MAIN_A]);
    expect(upd.rowCount).toBe(0);
    const name = await one<{ name: string }>("SELECT name FROM funds WHERE id=$1", [FUND_MAIN_A]);
    expect(name.name).toBe("General Fund");

    // Control: treasurer B does see their own church.
    expect((await as(TREASURER_B, `SELECT * FROM funds WHERE church_id=$1`, [CHURCH_B])).rows.length).toBe(1);
  });

  it("cross-church: a split cannot be attached to a foreign church's transaction", async () => {
    const id = await seedDraft();
    await expect(
      as(TREASURER_A, `UPDATE transactions SET church_id=$1 WHERE id=$2`, [CHURCH_B, id]),
    ).rejects.toThrow(/church_id cannot be changed|row-level security/i);
    expect((await txnRow(id)).status).toBe("draft");
  });

  it("roles: a member cannot read the ledger, and finance_staff cannot read the audit log", async () => {
    expect((await as(MEMBER_A, `SELECT * FROM transactions`)).rows.length).toBe(0);
    expect((await as(MEMBER_A, `SELECT * FROM accounts`)).rows.length).toBe(0);
    expect((await as(MEMBER_A, `SELECT * FROM audit_logs`)).rows.length).toBe(0);
    // A member may see their own church's fund names (p_funds_select is
    // finance_staff-gated, so this is zero too) — pinned so a widening shows up.
    expect((await as(MEMBER_A, `SELECT * FROM funds`)).rows.length).toBe(0);

    expect((await as(FINANCE_A, `SELECT * FROM audit_logs`)).rows.length).toBe(0);
    expect((await as(TREASURER_A, `SELECT * FROM transactions`)).rows.length).toBeGreaterThan(0);
    expect((await as(PASTOR_A, `SELECT * FROM audit_logs`)).rows.length).toBeGreaterThan(0);
  });

  it("member giving stays confidential: direct reads return zero rows for every role", async () => {
    for (const user of [TREASURER_A, PASTOR_A, SUPER_A, FINANCE_A]) {
      expect(
        (await as(user, `SELECT * FROM member_giving_records`)).rows.length,
        `${user} must not read member_giving_records directly`,
      ).toBe(0);
    }
    // The sanctioned door is the SECURITY DEFINER RPC — and the database
    // gates it at PASTOR tier, not treasurer.
    const viaRpc = await as(PASTOR_A, `SELECT * FROM get_member_giving_history($1,$2)`, [
      DONOR_A,
      "annual audit review",
    ]);
    expect(viaRpc.rows.length).toBe(1);
    // The confidential note is readable through the RPC by design (it is the
    // sanctioned, logged door) — pin that the raw table stays closed above.
    expect(viaRpc.rows[0].confidential_note).toBe("confidential");

    // DIVERGENCE FROM THE CLIENT RBAC TABLE: src/lib/rbac.ts grants treasurer
    // member_giving:["create","read","update","export"], and MembersPage /
    // members-service.ts call this RPC for that role — but has_church_access(..,
    // 'pastor') excludes treasurer, so the call fails. Pinned here so the
    // mismatch stays visible instead of surfacing as a blank giving history.
    await expect(
      as(TREASURER_A, `SELECT * FROM get_member_giving_history($1,$2)`, [
        DONOR_A,
        "annual audit review",
      ]),
    ).rejects.toThrow(/Only Pastors or designated Finance Leaders/i);

    // A too-short justification is refused even for a pastor.
    await expect(
      as(PASTOR_A, `SELECT * FROM get_member_giving_history($1,$2)`, [DONOR_A, "x"]),
    ).rejects.toThrow(/justification reason/i);
  });

  it("audit log is append-only from the application tier, even for super_admin", async () => {
    const before = await one<{ n: string }>("SELECT count(*)::text AS n FROM audit_logs");

    const ins = await as(
      SUPER_A,
      `INSERT INTO audit_logs (church_id, category, actor_id, action, entity_type)
       VALUES ($1,'SECURITY',$2,'TAMPER','transactions') RETURNING id`,
      [CHURCH_A, SUPER_A],
    ).then(
      () => "inserted",
      (e) => e.code,
    );
    expect(ins).toBe("42501");

    expect((await as(SUPER_A, `UPDATE audit_logs SET action='TAMPERED'`)).rowCount).toBe(0);
    expect((await as(SUPER_A, `DELETE FROM audit_logs`)).rowCount).toBe(0);

    const after = await one<{ n: string }>("SELECT count(*)::text AS n FROM audit_logs");
    expect(after.n).toBe(before.n);
  });

  it("privilege escalation: no role can grant itself a stronger role", async () => {
    const attempts: Array<[string, string, string]> = [
      [TREASURER_A, CHURCH_A, "super_admin"],
      [MEMBER_A, CHURCH_A, "treasurer"],
      [FINANCE_A, CHURCH_A, "approver"],
      // Cross-tenant grant: treasurer B tries to join church A.
      [TREASURER_B, CHURCH_A, "treasurer"],
    ];
    for (const [user, church, role] of attempts) {
      const selfId = user;
      const res = await as(
        user,
        `INSERT INTO user_roles (user_id, church_id, role) VALUES ($1,$2,$3) RETURNING id`,
        [selfId, church, role],
      ).then(
        () => "inserted",
        (e) => e.code,
      );
      expect(res, `${user} must not grant ${role}`).toBe("42501");
    }
    // And nobody silently acquired a second role.
    const n = await one<{ n: string }>(
      "SELECT count(*)::text AS n FROM user_roles WHERE user_id=$1",
      [TREASURER_A],
    );
    expect(n.n).toBe("1");
  });

  it("profiles: no self-insert, no tenant hop, no deactivating a colleague", async () => {
    const fresh = "20000000-0000-0000-0000-00000000aaaa";
    await expect(
      as(MEMBER_A, `INSERT INTO profiles (id, church_id, email, full_name) VALUES ($1,$2,'x@a.local','X')`, [
        fresh,
        CHURCH_A,
      ]),
    ).rejects.toThrow(/row-level security/i);

    // Moving yourself to another church would carry every policy with you.
    // USING (id = auth.uid()) lets a treasurer target their own row, so this
    // reaches WITH CHECK (church_id = current_user_church_id()) and is
    // rejected outright rather than filtered to zero rows.
    await expect(
      as(TREASURER_A, `UPDATE profiles SET church_id=$1 WHERE id=$2 RETURNING id`, [
        CHURCH_B,
        TREASURER_A,
      ]),
    ).rejects.toThrow(/row-level security/i);
    expect((await one<any>("SELECT church_id FROM profiles WHERE id=$1", [TREASURER_A])).church_id).toBe(
      CHURCH_A,
    );

    // A treasurer cannot disable the pastor who approves their work.
    expect((await as(TREASURER_A, `UPDATE profiles SET is_active=false WHERE id=$1`, [PASTOR_A])).rowCount).toBe(0);
    expect((await one<any>("SELECT is_active FROM profiles WHERE id=$1", [PASTOR_A])).is_active).toBe(true);

    // Control: a super_admin can, which proves the zeros above are the policy
    // and not a broken fixture.
    expect((await as(SUPER_A, `UPDATE profiles SET is_active=false WHERE id=$1 RETURNING id`, [PASTOR_A])).rowCount).toBe(1);
    await lab.client!.query(`UPDATE profiles SET is_active=true WHERE id=$1`, [PASTOR_A]);
  });

  it("PIN credentials are unreadable and unverifiable from the client tier", async () => {
    expect((await as(TREASURER_A, `SELECT * FROM auth_pins`)).rows.length).toBe(0);
    expect((await as(SUPER_A, `SELECT * FROM auth_pins`)).rows.length).toBe(0);
    expect((await as(TREASURER_A, `SELECT * FROM auth_pin_probes`)).rows.length).toBe(0);

    // verify_and_consume_pin is service-role only: for `authenticated` it does
    // not exist (privileges revoked), so it cannot be called to burn or
    // discover another profile's PIN.
    await expect(
      as(TREASURER_A, `SELECT verify_and_consume_pin($1,$2)`, [PASTOR_A, "123456"]),
    ).rejects.toThrow(/does not exist|permission denied/i);
  });

  it("fund transfers are RPC-only: no direct insert, update or delete", async () => {
    const ins = await as(
      TREASURER_A,
      `INSERT INTO fund_transfers (church_id, from_fund_id, to_fund_id, amount, created_by)
       VALUES ($1,$2,$3,10.00,$4) RETURNING id`,
      [CHURCH_A, FUND_MAIN_A, FUND_MISSION_A, TREASURER_A],
    ).then(
      () => "inserted",
      (e) => e.code,
    );
    expect(ins).toBe("42501");

    // Give the source fund a real, ledger-backed balance first (funds start at
    // zero), then transfer through the RPC and try to rewrite the result.
    const funding = await seedDraft("100.00");
    await driveToPosted(funding);
    expect(await fundBalance(FUND_MAIN_A)).toBe("100.00");

    await as(TREASURER_A, `SELECT transfer_funds($1,$2,$3,$4,$5,NULL)`, [
      CHURCH_A,
      FUND_MAIN_A,
      FUND_MISSION_A,
      "100.00",
      "mission allocation",
    ]);
    expect((await as(TREASURER_A, `UPDATE fund_transfers SET amount=0.01`)).rowCount).toBe(0);
    expect((await as(TREASURER_A, `DELETE FROM fund_transfers`)).rowCount).toBe(0);
    expect(await fundBalance(FUND_MISSION_A)).toBe("100.00");
    expect(await fundBalance(FUND_MAIN_A)).toBe("0.00");
  });
});

describe.runIf(booted)("Ledger immutability — audit findings F1-F4 (real PostgreSQL 17)", () => {
  it("F1: a treasurer cannot fabricate a fund balance", async () => {
    const before = await fundBalance(FUND_MAIN_A);
    await expect(
      as(TREASURER_A, `UPDATE funds SET current_balance=999999999.99 WHERE id=$1 RETURNING current_balance`, [
        FUND_MAIN_A,
      ]),
    ).rejects.toThrow(/derived from the ledger/i);
    expect(await fundBalance(FUND_MAIN_A)).toBe(before);

    // A finance_staff is filtered by RLS before the trigger is even reached.
    expect((await as(FINANCE_A, `UPDATE funds SET current_balance=1.00 WHERE id=$1`, [FUND_MAIN_A])).rowCount).toBe(0);
    expect(await fundBalance(FUND_MAIN_A)).toBe(before);
  });

  it("F2: a treasurer cannot fabricate an account balance", async () => {
    const before = await accountBalance(ACCOUNT_A);
    await expect(
      as(TREASURER_A, `UPDATE accounts SET current_balance=999999999.99 WHERE id=$1 RETURNING current_balance`, [
        ACCOUNT_A,
      ]),
    ).rejects.toThrow(/derived from the ledger/i);
    expect(await accountBalance(ACCOUNT_A)).toBe(before);
  });

  it("F1b: a new fund or account must start at zero — an opening balance is a ledger event", async () => {
    await expect(
      as(TREASURER_A, `INSERT INTO funds (church_id, name, current_balance) VALUES ($1,'Backdated Fund',50000.00) RETURNING id`, [
        CHURCH_A,
      ]),
    ).rejects.toThrow(/zero balance/i);

    // Control: the FundsService.createFund() shape still works exactly as before.
    const created = await as(
      TREASURER_A,
      `INSERT INTO funds (church_id, name, description, current_balance, target_amount, is_active)
       VALUES ($1,'Youth Fund',NULL,'0.00','0.00',true) RETURNING id, current_balance`,
      [CHURCH_A],
    );
    expect(created.rows.length).toBe(1);
    expect(created.rows[0].current_balance).toBe("0.00");
  });

  it("F1c: the fund fields the UI actually edits stay editable", async () => {
    const res = await as(
      TREASURER_A,
      `UPDATE funds SET name='General Fund (renamed)', target_amount=250000.00, description='d', is_active=true
       WHERE id=$1 RETURNING name, target_amount`,
      [FUND_MAIN_A],
    );
    expect(res.rowCount).toBe(1);
    expect(res.rows[0].name).toBe("General Fund (renamed)");
    expect(res.rows[0].target_amount).toBe("250000.00");
    await lab.client!.query(`UPDATE funds SET name='General Fund' WHERE id=$1`, [FUND_MAIN_A]);
  });

  it("F3: a posted transaction cannot be reopened, voided or rejected by writing status", async () => {
    const id = await seedDraft();
    await driveToPosted(id);
    const posted = await txnRow(id);
    expect(posted.status).toBe("posted");

    for (const target of ["draft", "voided", "rejected", "pending_approval", "approved"]) {
      await expect(
        as(TREASURER_A, `UPDATE transactions SET status=$1 WHERE id=$2 RETURNING status`, [target, id]),
        // SQLSTATE GL005 — direct status write.
      ).rejects.toThrow(/cannot be changed directly/i);
    }

    const after = await txnRow(id);
    expect(after.status).toBe("posted");
    // A hand-written 'voided' would have skipped the reversing entry; prove
    // nothing of the sort appeared and the money is still where post put it.
    const reversals = await one<{ n: string }>(
      "SELECT count(*)::text AS n FROM transactions WHERE reversal_of_id=$1",
      [id],
    );
    expect(reversals.n).toBe("0");
  });

  it("F3 chain: a posted transaction cannot be deleted by reopening it first", async () => {
    const id = await seedDraft();
    await driveToPosted(id);

    // Step 1 of the old attack: flip to draft. Now blocked.
    await expect(
      as(TREASURER_A, `UPDATE transactions SET status='draft' WHERE id=$1`, [id]),
    ).rejects.toThrow(/cannot be changed directly/i);

    // Step 2: the delete is refused too — RLS requires status='draft', so it
    // affects zero rows rather than raising.
    const del = await as(TREASURER_A, `DELETE FROM transactions WHERE id=$1 RETURNING id`, [id]);
    expect(del.rowCount).toBe(0);

    const still = await one<{ n: string }>("SELECT count(*)::text AS n FROM transactions WHERE id=$1", [id]);
    expect(still.n).toBe("1");
    const splits = await one<{ n: string }>(
      "SELECT count(*)::text AS n FROM transaction_splits WHERE transaction_id=$1",
      [id],
    );
    expect(splits.n).toBe("1");
    expect((await txnRow(id)).status).toBe("posted");
  });

  it("F4: every descriptive field of a posted transaction is final", async () => {
    const id = await seedDraft();
    await driveToPosted(id);
    const before = await txnRow(id);

    const edits: Array<[string, unknown[]]> = [
      [`UPDATE transactions SET description='Falsified' WHERE id=$1 RETURNING description`, [id]],
      [`UPDATE transactions SET metadata='{"forged":true}'::jsonb WHERE id=$1 RETURNING metadata`, [id]],
      [`UPDATE transactions SET posted_at='2020-01-01' WHERE id=$1 RETURNING posted_at`, [id]],
      [`UPDATE transactions SET approved_by=$1 WHERE id=$2 RETURNING approved_by`, [FINANCE_A, id]],
      [`UPDATE transactions SET created_by=$1 WHERE id=$2 RETURNING created_by`, [TREASURER_A, id]],
      [`UPDATE transactions SET reference_number='REF-FORGED' WHERE id=$1 RETURNING reference_number`, [id]],
      [`UPDATE transactions SET transaction_date='2020-01-01' WHERE id=$1 RETURNING transaction_date`, [id]],
    ];
    for (const [sql, params] of edits) {
      // SQLSTATE GL006 — a final record is read-only.
      await expect(as(TREASURER_A, sql, params)).rejects.toThrow(/is final and cannot be edited/i);
    }

    const after = await txnRow(id);
    expect(after.description).toBe(before.description);
    expect(after.reference_number).toBe(before.reference_number);
    expect(String(after.posted_at)).toBe(String(before.posted_at));
    expect(after.approved_by).toBe(before.approved_by);
    expect(after.created_by).toBe(FINANCE_A);
  });

  it("F4 control: a draft is still editable, but never by writing status", async () => {
    const id = await seedDraft("500.00");

    const res = await as(
      FINANCE_A,
      `UPDATE transactions SET description='Corrected draft', amount=750.00, transaction_date='2026-09-01'
       WHERE id=$1 RETURNING description, amount, transaction_date`,
      [id],
    );
    expect(res.rowCount).toBe(1);
    expect(res.rows[0].description).toBe("Corrected draft");
    expect(res.rows[0].amount).toBe("750.00");

    // Even on a draft, the lifecycle is RPC-only: a client must not be able to
    // self-promote straight to posted and skip the approval workflow.
    for (const target of ["pending_approval", "approved", "posted"]) {
      await expect(
        as(FINANCE_A, `UPDATE transactions SET status=$1 WHERE id=$2`, [target, id]),
      ).rejects.toThrow(/cannot be changed directly/i);
    }
    expect((await txnRow(id)).status).toBe("draft");
  });

  it("control: the sanctioned RPC path still moves money and still refuses self-approval", async () => {
    const fundBefore = await fundBalance(FUND_MAIN_A);
    const acctBefore = await accountBalance(ACCOUNT_A);

    const id = await seedDraft("500.00");
    await driveToPosted(id);

    expect(await fundBalance(FUND_MAIN_A)).toBe(
      (Number(fundBefore) + 500).toFixed(2),
    );
    expect(await accountBalance(ACCOUNT_A)).toBe(
      (Number(acctBefore) + 500).toFixed(2),
    );
    expect((await txnRow(id)).status).toBe("posted");

    // void_transaction() remains the only way to undo a posting, and it writes
    // the reversing mirror entry the hand-written 'voided' would have skipped.
    const reversalId = await as(TREASURER2_A, `SELECT void_transaction($1,$2) AS rid`, [
      id,
      "counting error discovered after posting",
    ]).then((r) => r.rows[0].rid);
    expect(reversalId).toBeTruthy();
    expect(await fundBalance(FUND_MAIN_A)).toBe(fundBefore);
    expect(await accountBalance(ACCOUNT_A)).toBe(acctBefore);

    // The Two-Person Rule still holds through the guard.
    const selfPost = await seedDraft("50.00", { createdBy: TREASURER_A });
    await expect(
      as(TREASURER_A, `SELECT post_transaction($1)`, [selfPost]),
    ).rejects.toThrow(/Segregation of Duties/i);
    expect((await txnRow(selfPost)).status).toBe("draft");
  });

  it("splits of a final transaction remain immutable (regression pin on the existing guard)", async () => {
    const id = await seedDraft();
    await driveToPosted(id);

    await expect(
      as(TREASURER_A, `UPDATE transaction_splits SET amount=1.00 WHERE transaction_id=$1`, [id]),
    ).rejects.toThrow(/Immutable Ledger/i);
    await expect(
      as(TREASURER_A, `INSERT INTO transaction_splits (transaction_id, church_id, fund_id, amount) VALUES ($1,$2,$3,1.00)`, [
        id,
        CHURCH_A,
        FUND_MISSION_A,
      ]),
    ).rejects.toThrow(/Immutable Ledger/i);
    await expect(
      as(TREASURER_A, `DELETE FROM transaction_splits WHERE transaction_id=$1`, [id]),
    ).rejects.toThrow(/Immutable Ledger/i);

    const n = await one<{ n: string; total: string }>(
      "SELECT count(*)::text AS n, SUM(amount)::text AS total FROM transaction_splits WHERE transaction_id=$1",
      [id],
    );
    expect(n.n).toBe("1");
    expect(n.total).toBe("500.00");
  });

  it("reconcile_fund_balances reports no drift for an untampered ledger", async () => {
    const rows = await as(TREASURER_A, `SELECT * FROM reconcile_fund_balances($1)`, [CHURCH_A]);
    // 'General Fund' was renamed and given a target above; its balance is
    // derived from posted ledger effects only, so drift must be zero everywhere.
    for (const row of rows.rows) {
      expect(Number(row.drift), `${row.fund_name} drift`).toBe(0);
    }
  });
});

afterAll(async () => {
  await lab.stop();
  if (booted) console.log("real-PG lab torn down (ledger-immutability).");
});
