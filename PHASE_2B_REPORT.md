# Phase 2B — Real PostgreSQL Concurrency Test Suite

**Status: PHASE 2B = VERIFIED (real PostgreSQL 17 execution completed). Production SQL NOT modified.**

Executed against an embedded, throwaway PostgreSQL 17 instance (`@embedded-postgres/windows-x64`,
server version `17.6.1.155`), booted fresh by `scripts/pg-lab.mjs`, with every migration in
`supabase/migrations/` applied in order. Three genuinely independent physical connections (own
backend PID each) were used per concurrency scenario: two contended actors + one privileged
monitor reading `pg_stat_activity` / `pg_blocking_pids()`. No production SQL file was edited to
make any test pass — five scenarios below **fail on purpose**, documenting a real defect.

## A. Changed Files

| File                                                    | Type                  | Purpose                                                                                                                                                                                                                   |
| ------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/integration/phase2b-real-pg-concurrency.test.ts` | new (test)            | The 15-scenario Phase 2B matrix (A–L)                                                                                                                                                                                     |
| `tests/integration/phase2b/helpers.ts`                  | new (test helper)     | `raceOnLock`, `waitForBlocked`, `beginAsUser`/`commit`/`rollback`, snapshotting, structured report printer, results ledger                                                                                                |
| `tests/integration/phase2b/fixtures.ts`                 | new (test fixture)    | Shared church/users/account/funds + draft-transaction seeding                                                                                                                                                             |
| `scripts/pg-lab.mjs`                                    | modified (test infra) | Added `PgLab.openSession()` — opens an independent physical connection (own backend PID) against the same lab instance, required for genuine concurrency (the existing single `lab.client` cannot represent two sessions) |
| `scripts/pg-lab.d.mts`                                  | modified (test infra) | Declared the new `openSession()` method                                                                                                                                                                                   |

No file under `supabase/migrations/`, no RPC, no trigger, no RLS policy was changed.

## B. Test Inventory

15 scenarios, matching the required matrix exactly: A, B, C, C2, C3, D, E, E2, F, G, H, I, J, K, L.
Every scenario boots the same lab instance (module-level, once) — see "Infrastructure note" below.

## C. Real PostgreSQL Evidence (condensed; full structured per-test blocks were printed to stdout

during the run — `Test ID / Session A / Session B / Blocking / Lock Evidence / Final State /
Invariant / Mechanism / Overall`, exactly as specified)

**A — Post vs Post.** Txn in `approved`. Session A's `post_transaction()` acquires `FOR UPDATE` on
the `transactions` row; Session B's concurrent `post_transaction()` call genuinely blocks
(`pg_blocking_pids(B) = [A's pid]`, `wait_event=transactionid`, `wait_event_type=Lock`). After A
commits, B unblocks and is rejected: `Invalid State Transition: ... (current status: posted)`,
SQLSTATE `P0001`. Final: `status=posted`, `split_sum=amount`, account credited exactly once.

**B — Post vs UPDATE Split.** No blocking observed (a plain `UPDATE` of a non-FK column on
`transaction_splits` never touches the parent `transactions` row lock). Session B's
`UPDATE transaction_splits SET amount = amount + 100` **succeeds**, both before and after A's post
commits. **Defect** — see Finding #1.

**C — Post vs INSERT Split (A first).** Session B's `INSERT INTO transaction_splits (...)` blocks
(`pg_blocking_pids(B) = [A's pid]`) — confirmed real PostgreSQL FK behavior: inserting a
referencing row acquires an implicit `FOR KEY SHARE` lock on the referenced (`transactions`) row,
which conflicts with A's `FOR UPDATE`. After A commits (posted), B's insert proceeds and commits.
**Defect** — the extra split silently breaks `split_sum == amount` on an already-posted
transaction; see Finding #1.

**C2 — INSERT starts before Post.** Reversed roles: B's `INSERT` opens first and is held
open (uncommitted); A's `post_transaction()` then blocks on B (`pg_blocking_pids(A) = [B's pid]`)
— confirms the FK lock direction is genuinely reversible, not assumed. B commits; A unblocks and
is correctly rejected: `Integrity Error: Split sum (฿1010.00) does not match transaction amount
(฿1000.00)`, SQLSTATE `P0001`. Txn stays `approved`; no partial mutation.

**C3 — INSERT commits before Post (no blocking).** B inserts and commits fully before A even
starts. A's fresh read-committed `SUM()` sees the extra split and correctly rejects with the same
`Integrity Error`. Distinct from C2 (`blocking.observed=false`), same outcome — `post_transaction`'s
built-in split-sum check is a real, working safety net.

**D — Approve vs UPDATE Split.** Same shape as B, one lifecycle stage earlier (`pending_approval`).
No blocking; Session B's split `UPDATE` succeeds both before and after A's `approve_transaction()`
commits. **Defect**, same root cause as B.

**E — Approve vs INSERT Split.** Same shape as C. B's `INSERT` blocks on A's `FOR UPDATE`
(`pg_blocking_pids(B) = [A's pid]`); after A commits (`approved`), B's insert proceeds. **Defect**
— extra split survives into `approved` (would only be caught later, if/when posted).

**E2 — INSERT starts before Approve.** Reversed, mirrors C2: A's `approve_transaction()` blocks on
B's held insert; B commits; A unblocks and is correctly rejected with the same `Integrity Error`
check inside `approve_transaction`. Txn stays `pending_approval`.

**F — Post vs Void.** Txn `approved`. A's `post_transaction()` and B's `void_transaction()` both
request `FOR UPDATE` on the same `transactions` row — B genuinely blocks
(`pg_blocking_pids(B) = [A's pid]`). A commits (posted); B unblocks, re-evaluates its own
precondition (now true — `status = posted`), and succeeds, creating a reversal. Final: original
`status = voided`, `audit_logs` shows `POST_TRANSACTION` then `VOID_TRANSACTION`. No double
finalization, no invalid terminal state.

**G — Opposite Transfers.** Two independent treasurers fire `transfer_funds(MAIN→MISSION, 1000)`
and `transfer_funds(MISSION→MAIN, 400)` truly concurrently (`Promise.all`, no artificial hold). No
`40P01`. Both complete. `FUND_MAIN` 501500.00 → 500900.00, `FUND_MISSION` 501500.00 → 502100.00 —
conservation holds exactly (net −600 / +600). Migration `20260828121608`'s ascending-fund-UUID
lock ordering (regardless of transfer direction) prevents the classic opposite-direction deadlock.

**H — Post vs Transfer (shared funds).** Txn `approved` with splits on `FUND_MAIN` +
`FUND_MISSION`; Session B's `transfer_funds(FUND_MAIN→FUND_MISSION, 300)` genuinely blocks on
Session A's held `post_transaction()` (`pg_blocking_pids(B) = [A's pid]`) — real resource overlap
between `post_transaction`'s plain `UPDATE funds` and `transfer_funds`'s explicit `FOR UPDATE`,
confirmed empirically rather than assumed from a hypothetical lock-order diagram. After A commits,
B proceeds against the post-commit balances. No lost update: `mainAfter = mainBefore + 1000 − 300`,
`missionAfter = missionBefore + 1000 + 300`, exactly.

**I — State Immutability Matrix.** For every lifecycle state (`draft, pending_approval, approved,
posted, rejected, voided`), direct `UPDATE` / `INSERT` / `DELETE` on `transaction_splits` (as a
`finance_staff` user) were attempted. **All 18 cells succeeded — including `rejected` and
`voided`**, the two states the codebase's own comments describe as "permanently locked." Root
cause confirmed by reading `supabase/migrations/20260817000003…` and
`…20260818000006_governance_semantics_and_terminal_rejection.sql`: the immutability trigger
(`fn_validate_transaction_split_lifecycle`) is attached only to the `transactions` table (`BEFORE
UPDATE ON transactions`); `transaction_splits` has no `BEFORE` trigger at all, and its RLS
policies (`p_splits_update` / `p_splits_insert` / `p_splits_delete`,
`supabase/migrations/20260817000004_rls_policies.sql`) check only
`has_church_access(church_id, 'finance_staff')` — never the parent transaction's status. **Defect**
— see Finding #1 (this is the general case; B/D/C/E are specific concurrent instances of it).

**J — Deadlock Detection (positive control).** Deliberately inverted lock order on raw `funds` rows
(bypassing `transfer_funds`'s own ordering) between two independent sessions: A locks
`FUND_MAIN` then requests `FUND_MISSION`; B locks `FUND_MISSION` then requests `FUND_MAIN`. Real
`SQLSTATE 40P01` observed on B (`deadlock detected`); A committed normally. Confirms both
PostgreSQL's detector and this suite's evidence-capture path actually work — the contrast with G
(no deadlock, because `transfer_funds` itself enforces one global lock order) is now demonstrated
rather than assumed.

**K — State Machine Verification.** 18 real RPC calls executed: full happy path
(`draft→pending_approval→approved→posted→voided`), the terminal-rejection path
(`draft→pending_approval→rejected`, then confirmed **even a no-op raw `UPDATE transactions SET
description = description`** is rejected once `status = rejected` — full lockdown, not just
against the approval RPCs), and the revision loop
(`draft→pending_approval→(revision)→draft→pending_approval→approved`). Every illegal transition
(re-submit, self-approve by creator, re-approve, void-before-posted, re-post, re-void,
approve-after-reject) was rejected with `SQLSTATE P0001`. All 18/18 outcomes matched the coded
policy exactly.

**L — Audit Trail.** Classification: **IMPLEMENTED** (not merely required-on-paper). One
submit→approve→post lifecycle produced 9 `audit_logs` rows: purpose-built `APPROVAL` entries
(`SUBMIT_FOR_APPROVAL`, `APPROVE_TRANSACTION`) and a `FINANCIAL` entry (`POST_TRANSACTION`) from
the RPCs themselves, plus blanket `DATA_CHANGE` CDC rows (`fn_audit_log_change`, attached to
`transactions`, `transaction_splits`, `fund_transfers`, `funds`, `accounts`) from every underlying
`INSERT`/`UPDATE`. Because `transaction_splits` carries this CDC trigger too, the B/D/I split
mutations **are** forensically traceable even though not prevented — a mitigating factor weighed
into Finding #1's severity below.

## D. PASS/FAIL Matrix

```
A   PASS
B   FAIL   (real defect — see Finding #1)
C   FAIL   (real defect — see Finding #1)
C2  PASS
C3  PASS
D   FAIL   (real defect — see Finding #1)
E   FAIL   (real defect — see Finding #1)
E2  PASS
F   PASS
G   PASS
H   PASS
I   FAIL   (real defect — see Finding #1)
J   PASS
K   PASS
L   PASS
```

10 PASS, 5 FAIL, 0 NOT VERIFIED. Every FAIL is a genuine, reproduced `expect()` failure against
real PostgreSQL — none is a hypothetical or a softened assertion, and all five map to the same
underlying root cause (Finding #1).

## E. Findings

### Finding #1 — CRITICAL: `transaction_splits` has no immutability enforcement at all

> **RESOLVED 2026-09-03.** `supabase/migrations/20260903000000_split_immutability_guard.sql` implements
> this fix: a `BEFORE INSERT OR UPDATE OR DELETE` guard trigger plus a SECURITY DEFINER locking lookup
> (the definer is mandatory — see `DECISIONS.md` → D10 for the RLS-vs-locking-clause behavior that makes
> an invoker-side `FOR KEY SHARE` read silently return 0 rows for finance_staff). Scenarios B/C/D/E/I
> now assert the policy and pass; C2/C3/E2 run their out-of-band INSERT in the lab owner context so the
> second-line integrity nets stay verified. 15/15 green.

**Scenarios:** B, C, D, E, I (5 of 15).
**Observed:** Direct `UPDATE` / `INSERT` / `DELETE` on `transaction_splits` succeeds in _every_
lifecycle state, including `posted`, `rejected`, and `voided` — the states the schema's own code
comments call "permanently locked" / "immutable ledger."
**Root cause:** The `BEFORE UPDATE`/`DELETE` trigger that enforces immutability
(`fn_validate_transaction_split_lifecycle` / `trg_validate_transaction_status`) is attached **only**
to the `transactions` table. `transaction_splits` has just the blanket `AFTER` CDC audit trigger
(`trg_audit_transaction_splits`) — which records the change but never blocks it. Its RLS policies
(`p_splits_update`, `p_splits_insert`, `p_splits_delete`) check `has_church_access(church_id,
'finance_staff')` only — they never inspect the parent transaction's `status`.
**Impact:** Any user holding `finance_staff` (the _lowest_ ledger-write role — creators of drafts,
not just treasurers) can silently rewrite or delete individual fund-level ledger entries on a
transaction that has already been posted, approved, or even formally rejected, without going
through `void_transaction()`, without triggering `submit_transaction`'s split-sum check again, and
without any RPC-level guard rejecting it. `post_transaction`'s own split-sum integrity check (the
thing that correctly caught C2/C3/E2) only runs _at post time_ — it cannot protect a transaction
that is already posted.
**Mitigating factor:** every such mutation is still captured by the CDC `DATA_CHANGE` audit trail
(Finding L), so it is forensically discoverable after the fact — this is a prevention gap, not a
total blind spot.
**Recommended fix (not applied — production SQL was explicitly out of scope for Phase 2B):** add a
`BEFORE INSERT OR UPDATE OR DELETE` trigger on `transaction_splits` that looks up the parent
transaction's `status` and rejects the write unless `status = 'draft'` (mirroring the RLS-vs-status
pattern already used correctly on `transactions` itself), and/or extend `p_splits_update` /
`p_splits_insert` / `p_splits_delete`'s `USING`/`WITH CHECK` clauses to join `transactions` and
require `status = 'draft'`.

### Finding #2 — MEDIUM: duplicate, ambiguous `transfer_funds` overload (schema drift)

> **RESOLVED 2026-09-03.** The 5-arg overload is dropped by
> `supabase/migrations/20260903000001_drop_ambiguous_transfer_funds_overload.sql` after re-verifying every
> caller uses the 6-arg form (`DECISIONS.md` → D10).

**Not one of the lettered scenarios** — surfaced while building G/H's raw-SQL test calls, and
independently confirmed by reading the migrations.
**Observed:** `SELECT transfer_funds($1,$2,$3,300.00,'note')` (5 positional args) fails with
`function transfer_funds(unknown, unknown, unknown, numeric, unknown) is not unique`, SQLSTATE
`42725`.
**Root cause:** `supabase/migrations/20260817000003_financial_rpcs_and_triggers.sql` defines
`transfer_funds(UUID, UUID, UUID, NUMERIC, TEXT DEFAULT NULL)` — 5 declared parameters.
`…20260821000014_idempotency_and_action_confirmations.sql` later adds
`transfer_funds(UUID, UUID, UUID, NUMERIC, TEXT DEFAULT NULL, TEXT DEFAULT NULL)` — 6 declared
parameters. Because `CREATE OR REPLACE FUNCTION` only replaces a function with the _exact same_
parameter list, these are two distinct, coexisting overloads — the original 5-parameter version was
never dropped. A 5-argument call is a valid match for _both_ (the 6-param version's 6th argument
has a default), so PostgreSQL cannot resolve it.
**Impact in this codebase today:** the two real call sites were checked —
`src/lib/funds/funds-service.ts` calls via PostgREST with **named** JSON parameters (always
including `p_idempotency_key`, even as `null`), and
`supabase/migrations/20260828121517_fix_execute_confirmed_financial_action.sql`'s internal call
passes all 6 positional arguments explicitly. Neither hits the ambiguity, so this is currently
**dormant**, not exploited in production — but it will break the moment anything (a script, a new
RPC, a future migration, direct `psql` access) calls `transfer_funds` with exactly 5 positional
arguments, and it is dead, confusing schema state regardless.
**Recommended fix (not applied):** `DROP FUNCTION transfer_funds(UUID, UUID, UUID, NUMERIC, TEXT);`
in a new migration, once confirmed no caller depends on the 5-arg form.

### Finding #3 — LOW: void's reversal transaction is created directly in a terminal state

**Not one of the lettered scenarios** — noted while reading `void_transaction()` for scenario F.
**Observed:** the hardened `void_transaction()`
(`…20260818000006_governance_semantics_and_terminal_rejection.sql`) inserts the reversing
transaction with `status = 'voided'` literally, in the `INSERT` statement itself — it never passes
through `draft → pending_approval → approved → posted` like every other ledger row. This is
intentional (a reversal has no approval workflow of its own) but means a `transactions` row can
exist whose entire life started at a terminal state, which is worth a one-line code comment for the
next engineer reading the state machine, since scenario K's enumeration assumes all rows begin at
`draft`.
**Impact:** cosmetic/documentation only — no invariant is broken; the reversal's `posted_at` and
balances are still correct and immediately reflected.

## F. Phase Gate Decision

```
READY FOR PHASE 2C
```

**Reasoning:** every required scenario (A–L, including C2/C3 and E2's reversed-ordering variants,
and J's positive deadlock control) executed against real PostgreSQL 17 with genuine independent
connections and real `pg_blocking_pids()` evidence — nothing here is a "NOT VERIFIED" or a
hypothetical result. Locking, deadlock avoidance, the state machine, and the financial-invariant
self-checks inside `post_transaction`/`approve_transaction` all hold up under real concurrent load
(A, C2, C3, E2, F, G, H, J, K all PASS). Phase 2C may proceed, **provided Finding #1 (transaction_splits
immutability) is tracked and fixed before or alongside whatever Phase 2C builds on top of the
ledger** — it is a real, reproducible gap, not a Phase 2B test artifact, and any Phase 2C work that
assumes "posted/rejected/voided transactions are immutable" (a reasonable assumption given the
`transactions` table's own trigger) should not build on `transaction_splits` without accounting for
it. Finding #2 should be cleaned up opportunistically; Finding #3 needs no action.

## Infrastructure note: single test file, single lab boot

`scripts/pg-lab.mjs` registers Postgres via a **fixed-name** Windows service + local account
(`gl_pg_lab`, `gl_pg_lab_runner`). Two `PgLab` instances booting concurrently — which is exactly
what vitest's default parallel-file worker pool would attempt with multiple real-PG test files —
would collide on that shared name (one boot's `cleanupLeftovers()` can tear down another's live
server mid-test). All 15 Phase 2B scenarios therefore live in one file/module
(`tests/integration/phase2b-real-pg-concurrency.test.ts`), sharing one `PgLab.start()`, running
sequentially within it (vitest's normal in-file behavior) — this is a deliberate infra decision, not
an oversight, and it is why the file is longer than this repo's usual ~800-line guideline.

## Verification performed

- `npx tsc --noEmit` — clean for every Phase 2B file (the 6 remaining repo-wide errors are
  pre-existing, in `src/pages/ApprovalsPage.ts` and `tests/unit/approvals-page-ui.test.ts`, from an
  unrelated uncommitted UI session already present in `git status` before this task started — not
  touched, not caused by this work).
- `npx vitest run tests/integration/phase2b-real-pg-concurrency.test.ts` — 15 tests, 10 passed / 5
  failed exactly as documented above, 0 unhandled errors, clean lab teardown.
- `npx vitest run` (full suite) — no regressions attributable to Phase 2B: the pre-existing
  `tests/unit/transactions-page-ui.test.ts` failures were confirmed, by re-running with Phase 2B's
  changes stashed, to already exist independent of this work (same unrelated uncommitted UI
  session).
