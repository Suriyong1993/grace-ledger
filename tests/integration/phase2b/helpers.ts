// Grace Ledger — Phase 2B real-PostgreSQL concurrency test helpers.
//
// Built on top of scripts/pg-lab.mjs's PgLab.openSession(), which hands back
// an INDEPENDENT physical connection (its own backend PID). Every scenario in
// the Phase 2B matrix needs at least two such independent sessions plus a
// third, privileged "monitor" connection that reads pg_stat_activity /
// pg_blocking_pids() to prove blocking actually happened, rather than
// inferring it from wall-clock timing.

import type { PgLab } from "../../../scripts/pg-lab.mjs";

// @types/pg isn't installed; scripts/pg-lab.d.mts imports pg's real Client
// type but is exempted from checking by tsconfig's skipLibCheck. This file
// is a regular .ts source file (not exempt), so it declares only the
// subset of the pg.Client surface actually used here.
export interface PgClientLike {
  query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  end(): Promise<void>;
}

export interface Session {
  client: PgClientLike;
  pid: number;
}

/** Opens four independent physical connections — sessA, sessB, monitor,
 * setup — runs `fn`, then ALWAYS tears all four down (even if `fn` throws,
 * e.g. from a failed `expect()` on a genuine defect finding — the whole
 * point of this suite is to let those throw rather than hide them, so
 * cleanup must not depend on `fn` returning normally). sessA/sessB are the
 * two contended actors; monitor is a privileged, uninvolved observer used
 * only to read pg_stat_activity / pg_blocking_pids() and post-state
 * snapshots; setup drives fixtures to their starting lifecycle state before
 * the actual race begins. */
export async function withSessions<T>(
  lab: PgLab,
  fn: (
    sessA: Session,
    sessB: Session,
    monitor: Session,
    setup: Session,
  ) => Promise<T>,
): Promise<T> {
  const sessA = await lab.openSession();
  const sessB = await lab.openSession();
  const monitor = await lab.openSession();
  const setup = await lab.openSession();
  try {
    return await fn(sessA, sessB, monitor, setup);
  } finally {
    await rollback(sessA);
    await rollback(sessB);
    await rollback(setup);
    await sessA.client.end();
    await sessB.client.end();
    await monitor.client.end();
    await setup.client.end();
  }
}

/** Begin an explicit transaction impersonating one Supabase user, with the
 * mandatory lock/statement timeouts from the Phase 2B spec. SET LOCAL / a
 * transaction-scoped set_config both auto-revert on COMMIT or ROLLBACK, so
 * no manual RESET is required. */
export async function beginAsUser(
  session: Session,
  userId: string,
  role: "authenticated" | "service_role" = "authenticated",
): Promise<void> {
  const c = session.client;
  await c.query("BEGIN");
  await c.query("SET lock_timeout = '5s'");
  await c.query("SET statement_timeout = '10s'");
  const jwt = JSON.stringify({ sub: userId, role });
  await c.query("SELECT set_config('request.jwt.claims', $1, true)", [jwt]);
  await c.query(
    `SET LOCAL ROLE ${role === "service_role" ? "service_role" : "authenticated"}`,
  );
}

export async function commit(session: Session): Promise<void> {
  await session.client.query("COMMIT");
}

export async function rollback(session: Session): Promise<void> {
  try {
    await session.client.query("ROLLBACK");
  } catch {
    /* connection may already be idle */
  }
}

export interface PgErrorLike {
  message: string;
  code?: string;
}

/** Run a query, returning either the row result or the captured Postgres
 * error (SQLSTATE + message) — never throwing. Used so a scenario can keep
 * going and record BOTH branches as real evidence instead of aborting. */
export async function tryQuery<T = any>(
  session: Session,
  sql: string,
  params: unknown[] = [],
): Promise<{ ok: true; rows: T[] } | { ok: false; error: PgErrorLike }> {
  try {
    const { rows } = await session.client.query(sql, params);
    return { ok: true, rows };
  } catch (err) {
    const e = err as { message: string; code?: string };
    return { ok: false, error: { message: e.message, code: e.code } };
  }
}

/** One-shot RPC call as a given user: begin, call, commit on success /
 * rollback on error. For fixture state advancement (e.g. submit + approve a
 * transaction before the actual concurrency scenario runs), not for the
 * scenario's own contended calls — those need beginAsUser/commit/rollback
 * called explicitly so locks can be held open across a barrier. */
export async function runRpc<T = any>(
  session: Session,
  userId: string,
  sql: string,
  params: unknown[] = [],
): Promise<{ ok: true; rows: T[] } | { ok: false; error: PgErrorLike }> {
  await beginAsUser(session, userId);
  const result = await tryQuery<T>(session, sql, params);
  if (result.ok) {
    await commit(session);
  } else {
    await rollback(session);
  }
  return result;
}

export interface BlockingEvidence {
  observed: boolean;
  blockingPids: number[];
  waitEventType: string | null;
  waitEvent: string | null;
  state: string | null;
  query: string | null;
}

/**
 * Poll pg_stat_activity from an independent MONITOR connection until the
 * target pid reports at least one blocking pid via pg_blocking_pids(), or
 * the bounded timeout elapses. This is the only acceptable evidence of
 * "blocked" per the Phase 2B spec — never inferred from a bare setTimeout.
 */
export async function waitForBlocked(
  monitor: Session,
  targetPid: number,
  timeoutMs = 4000,
): Promise<BlockingEvidence> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { rows } = await monitor.client.query(
      `SELECT pg_blocking_pids(pid) AS blocking_pids, wait_event_type, wait_event, state, query
       FROM pg_stat_activity WHERE pid = $1`,
      [targetPid],
    );
    const row = rows[0];
    if (
      row &&
      Array.isArray(row.blocking_pids) &&
      row.blocking_pids.length > 0
    ) {
      return {
        observed: true,
        blockingPids: row.blocking_pids,
        waitEventType: row.wait_event_type,
        waitEvent: row.wait_event,
        state: row.state,
        query: row.query,
      };
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  return {
    observed: false,
    blockingPids: [],
    waitEventType: null,
    waitEvent: null,
    state: null,
    query: null,
  };
}

/** Wait until the target pid is no longer present in pg_stat_activity in a
 * blocked wait state (i.e. it finished or errored out) — bounded polling. */
export async function waitForUnblocked(
  monitor: Session,
  targetPid: number,
  timeoutMs = 4000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { rows } = await monitor.client.query(
      `SELECT pg_blocking_pids(pid) AS blocking_pids FROM pg_stat_activity WHERE pid = $1`,
      [targetPid],
    );
    const row = rows[0];
    if (
      !row ||
      !Array.isArray(row.blocking_pids) ||
      row.blocking_pids.length === 0
    )
      return true;
    await new Promise((r) => setTimeout(r, 40));
  }
  return false;
}

export interface RaceLeg {
  session: Session;
  userId: string;
  sql: string;
  params?: unknown[];
}

export interface RaceOutcome {
  ok: boolean;
  rows?: any[];
  error?: PgErrorLike;
}

export interface RaceResult {
  first: RaceOutcome;
  second: RaceOutcome;
  blocking: BlockingEvidence;
}

/**
 * Deterministic two-actor lock race, the core primitive for most of the
 * Phase 2B matrix: `first` begins and runs to completion, holding whatever
 * row locks it acquired (uncommitted); `second` begins and fires
 * concurrently (expected — not assumed — to block on those locks); an
 * independent monitor connection polls pg_blocking_pids() for real evidence;
 * `first` then commits (or rolls back on error), unblocking `second`, whose
 * outcome is captured and itself committed/rolled back.
 */
export async function raceOnLock(
  monitor: Session,
  first: RaceLeg,
  second: RaceLeg,
  blockTimeoutMs = 4000,
): Promise<RaceResult> {
  await beginAsUser(first.session, first.userId);
  const firstResult = await tryQuery(
    first.session,
    first.sql,
    first.params ?? [],
  );

  await beginAsUser(second.session, second.userId);
  const secondPromise = tryQuery(
    second.session,
    second.sql,
    second.params ?? [],
  );

  const blocking = await waitForBlocked(
    monitor,
    second.session.pid,
    blockTimeoutMs,
  );

  if (firstResult.ok) await commit(first.session);
  else await rollback(first.session);

  const secondResult = await secondPromise;
  if (secondResult.ok) await commit(second.session);
  else await rollback(second.session);

  return {
    first: firstResult.ok
      ? { ok: true, rows: firstResult.rows }
      : { ok: false, error: firstResult.error },
    second: secondResult.ok
      ? { ok: true, rows: secondResult.rows }
      : { ok: false, error: secondResult.error },
    blocking,
  };
}

export interface InvariantSnapshot {
  status: string;
  amount: string;
  splitCount: number;
  splitSum: string;
}

/** Snapshot a transaction's status/amount/split-count/split-sum straight
 * from the ledger, using NUMERIC-safe text comparison (never JS floats). */
export async function snapshotTransaction(
  monitor: Session,
  transactionId: string,
): Promise<InvariantSnapshot> {
  const { rows } = await monitor.client.query(
    `SELECT t.status::text AS status, t.amount::text AS amount,
            COUNT(s.id)::int AS split_count,
            COALESCE(SUM(s.amount), 0)::text AS split_sum
     FROM transactions t
     LEFT JOIN transaction_splits s ON s.transaction_id = t.id
     WHERE t.id = $1
     GROUP BY t.status, t.amount`,
    [transactionId],
  );
  const row = rows[0];
  return {
    status: row.status,
    amount: row.amount,
    splitCount: row.split_count,
    splitSum: row.split_sum,
  };
}

export async function fundBalance(
  monitor: Session,
  fundId: string,
): Promise<string> {
  const { rows } = await monitor.client.query(
    `SELECT current_balance::text AS b FROM funds WHERE id = $1`,
    [fundId],
  );
  return rows[0].b;
}

export async function accountBalance(
  monitor: Session,
  accountId: string,
): Promise<string> {
  const { rows } = await monitor.client.query(
    `SELECT current_balance::text AS b FROM accounts WHERE id = $1`,
    [accountId],
  );
  return rows[0].b;
}

export type TestStatus = "PASS" | "FAIL" | "NOT VERIFIED";

export interface ScenarioResult {
  id: string;
  overall: TestStatus;
  notes: string;
}

const RESULTS: ScenarioResult[] = [];

export function recordResult(
  id: string,
  overall: TestStatus,
  notes: string,
): void {
  RESULTS.push({ id, overall, notes });
}

export function getResults(): ScenarioResult[] {
  return RESULTS;
}

/** Emits the structured per-test report block required by the Phase 2B spec
 * (section 10) to stdout, so the raw evidence is visible in CI/test output. */
export function printReport(r: {
  testId: string;
  setup: string;
  sessionA: { action: string; result: string; sqlstate: string | null };
  sessionB?: { action: string; result: string; sqlstate: string | null };
  blocking?: BlockingEvidence;
  lockEvidence?: string;
  finalState: unknown;
  invariant: "PASS" | "FAIL" | "N/A";
  mechanism: string;
  overall: TestStatus;
}): void {
  const lines = [
    "",
    `Test ID: ${r.testId}`,
    `Setup: ${r.setup}`,
    "",
    "Session A:",
    `  action: ${r.sessionA.action}`,
    `  result: ${r.sessionA.result}`,
    `  sqlstate: ${r.sessionA.sqlstate ?? "-"}`,
  ];
  if (r.sessionB) {
    lines.push(
      "",
      "Session B:",
      `  action: ${r.sessionB.action}`,
      `  result: ${r.sessionB.result}`,
      `  sqlstate: ${r.sessionB.sqlstate ?? "-"}`,
    );
  }
  lines.push(
    "",
    "Blocking:",
    `  observed: ${r.blocking ? (r.blocking.observed ? "YES" : "NO") : "N/A"}`,
    `  blocker pid(s): ${r.blocking?.blockingPids?.join(",") || "-"}`,
    `  wait_event: ${r.blocking?.waitEvent ?? "-"}`,
    `  wait_event_type: ${r.blocking?.waitEventType ?? "-"}`,
  );
  if (r.lockEvidence) lines.push("", "Lock Evidence:", `  ${r.lockEvidence}`);
  lines.push(
    "",
    "Final Database State:",
    `  ${JSON.stringify(r.finalState)}`,
    "",
    `Invariant: ${r.invariant}`,
    `Mechanism: ${r.mechanism}`,
    `Overall: ${r.overall}`,
    "",
  );
  console.log(lines.join("\n"));
}
