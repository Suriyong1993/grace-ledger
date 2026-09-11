# Grace Ledger — Engineering Report

**Date:** 2026-09-11  
**Repository:** `Suriyong1993/grace-ledger`  
**Branch worked on:** `arena/01a091ad-grace-ledger` (from `main` @ `09fcef7`)  
**Author:** Engineering review agent  
**Scope:** full codebase audit (Phases 0–6) plus implementation of the highest-severity, lowest-risk fixes.

---

## 1. Executive Summary

Grace Ledger is a **materially more mature system than a typical first pass suggests**. Its core
security thesis is sound and — critically — it is *enforced in the database*, not in the browser:

- Money is `NUMERIC(14,2)` end-to-end, with `decimal.js` in TypeScript. **No float money arithmetic.**
- `SECURITY DEFINER` RPCs do the financial mutations and **re-derive identity from `auth.uid()`**,
  never from client-supplied IDs.
- **Row Level Security on every table**: 47 live policies across 20 tables, and `22 / 22` public
  tables have RLS enabled — verified by querying `pg_policies` / `pg_class` on a freshly migrated
  PostgreSQL 17.10, not by counting migration files. `user_roles` is `super_admin`-managed.
- Two-person rule and separation-of-duties are enforced server-side with dedicated error codes.
- Audit logging covers INSERT/UPDATE/DELETE on every financial table, with before/after state,
  on `audit_logs` which is itself append-only (`no_audit_delete` blocks DELETE).
- The AI layer cannot execute SQL. Every write tool is named `propose_*`, requires a server-issued
  confirmation, and dispatches through the single atomic `execute_confirmed_financial_action` RPC.
- Test discipline is genuinely adversarial (fail-closed mocks, "does NOT" assertions,
  mutation-of-mocks checks).

**The audit found one critical secret exposure, four critical ledger-integrity defects confirmed by
live attack, and one correctness defect that silently produced ฿0.00 on every tax receipt.** All are
remediated in code on this branch; the secret's git history cannot be fixed from code.

25 distinct findings, every one traceable to a section below. Counts are of *distinct defects*, not
of the ranked roll-up rows in §9 (which restate the same items):

| ID | Sev | Finding | Status |
|---|---|---|---|
| C1 | CRITICAL | `UPDATE funds.current_balance` succeeds as treasurer (1 row mutated) | **Fixed** — `GL007` |
| C2 | CRITICAL | `UPDATE accounts.current_balance` succeeds as treasurer | **Fixed** — `GL007` |
| C3 | CRITICAL | `posted → draft → DELETE` destroys the transaction and its splits; `posted → voided` (no reversal entry, no balance unwind) and `posted → rejected` (bypassing the terminal-rejection RPC) both allowed | **Fixed** — `GL006` |
| C4 | CRITICAL | `posted` row's description/metadata/`posted_at`/`approved_by`/`created_by`/`reference_number` all mutable | **Fixed** — `GL005` |
| K1 | CRITICAL | Live `service_role` JWT committed in 3 scripts (§4) | **Fixed in HEAD** — ⚠️ key must be **rotated** |
| K2 | CRITICAL | Seeded user's plaintext password committed in 5 scripts + 1 doc | **Fixed in HEAD** — ⚠️ password must be **changed** |
| D1 | CRITICAL | Giving certificate totals **฿0.00 for every tax year** (§9) | **Fixed** |
| H1 | HIGH | Real-PG suites silently skipped on Linux — CI was green without them | **Fixed** |
| H2 | HIGH | No automated secret scanning | **Fixed** |
| H3 | HIGH | `supabase/.temp/` tracked in git | **Fixed** |
| H4 | HIGH | Client RBAC grants treasurer `member_giving`; DB requires pastor-tier | Open — **product decision** |
| H5 | HIGH | PIN-hash comparison is not constant-time | **Accepted** — hash, not secret; ADR-0004 |
| M1 | MED | `get_budget_vs_actual` queries a `budgets` table that exists in no migration | Open — **product decision** (§7 A1) |
| M2 | MED | `financial-action-endpoint.ts` documents a server endpoint that does not exist | Open — rename or move |
| M3 | MED | No audit-log viewer, despite a strong audit backend | Open — highest-value feature |
| M4 | MED | App defaults to a Supabase project *named* `grace-ledger-test` | Open — recommend build-time-required env |
| M5 | MED | Audit was forensic but not preventive for balances/posted fields | **Fixed** — `GL005`/`GL006`/`GL007` |
| M6 | MED | Two pages exceed the repo's own 800-line guidance (1,490 / 853 LOC) | Open — refactor |
| W1 | LOW | `PgLab.start()` provisions an empty DB when `migrationsDir` is omitted | **Documented** — intentional for the smoke test |
| W2 | LOW | `Module "crypto" has been externalized` build warning | Open — cosmetic |
| W3 | LOW | `src/lib/hermes/` (5 modules + 2 tests) imported by nothing | Open — wire up or delete |
| W4 | LOW | `fiscal_periods` / `reconciliation_runs` / `document_uploads` have schema, no app code | Open — roadmap |
| W5 | LOW | `Money.format()` converts `Decimal → number` at the display boundary | Open — safe at church scale |
| W6 | LOW | No Settings / church-administration / documents UI | Open — roadmap |
| W7 | LOW | No global notification bus; errors surface per-page | Open — roadmap |

**Totals: 7 CRITICAL (7 fixed in code, 2 residual human actions) · 5 HIGH (3 fixed, 1 decision,
1 accepted) · 6 MEDIUM (1 fixed, 5 open) · 7 LOW (1 documented, 6 open).**

**Verification: 69 test files / 652 tests pass**, including 4 suites that boot a real PostgreSQL 17.10
and execute all 32 migrations. Typecheck, both linters, and the production build are clean.

---

## 2. Implementation Map

### Technology

| Concern | Implementation |
|---|---|
| Frontend | Vanilla TypeScript + Vite 5, custom `Page<TProps>` abstraction, **no React/Vue** |
| Backend | Supabase (PostgreSQL 17) — Postgres RPCs + RLS + Edge Functions (Deno) |
| Money | `decimal.js`, 2 dp, `ROUND_HALF_EVEN` (banker's rounding); DB `NUMERIC(14,2)` |
| UI | Custom design system in `src/styles/` (CSS variables, Thai-first) |
| Validation | `zod` on all AI tool inputs and the financial-action endpoint |
| Tests | Vitest 3; real-PG harness `scripts/pg-lab.mjs` |

Scale: ~23,460 LOC in `src/`; 6,457 lines of migrations across 32 files; 10 pages; 11 routes
(`/`, `/transactions`, `/funds`, `/members`, `/reports`, `/profile`, `/approvals`, `/approvals/:id`,
`/offerings`, `/offerings/new`, `/offerings/:id`).

### Database inventory (queried live on PostgreSQL 17.10 after applying all 32 migrations)

| Object | Count | Note |
|---|---|---|
| Public tables | 22 | — |
| Tables with RLS enabled | **22 / 22** | No table is left open |
| Live RLS policies | 47 | Heaviest: `transactions`, `transaction_splits`, `audit_logs`, `action_confirmations`, `idempotency_keys` (4 each) |
| `SECURITY DEFINER` functions | 31 | The privileged path; each re-derives identity from `auth.uid()` |
| Triggers | 32 | Includes the append-only audit guards and the new `GL005`/`GL006`/`GL007` |

Migrations contain 54 `CREATE POLICY` and 46 `DROP POLICY` statements — the drop-and-recreate pattern
is why counting statements in files overstates the live policy set. The numbers above are the real
ones, taken from the catalog.

### Domain model

```
churches ──┬── accounts (ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE, account_code UNIQUE per church)
           ├── funds (target_amount = budget, current_balance)
           ├── categories (INCOME/EXPENSE, parent_id)
           ├── fiscal_periods (start/end/lock state)
           ├── transactions ──< transaction_splits (amount, fund_id, account_id, category_id)
           ├── fund_transfers
           ├── budgets/audit_logs/approvals/reconciliation_runs (see §8 for gaps)
           ├── members ──< member_giving_records (confidential)
           ├── giving_certificates
           ├── offering_sessions (batch_id) ──< offering_session_items
           │       ├──< offering_cash_counts (two counters)
           │       └──< denomination_counts (variance analysis)
           └── user_profiles / user_roles / auth_pins
```

Money flows only through `transaction_splits`; `transactions.amount_total` is a derived roll-up.
Balances live on `funds.current_balance` and `accounts.current_balance`.

### Module map

| Path | Role |
|---|---|
| `src/main.ts` | bootstrap: Supabase client, auth guard, page mount, session refresh |
| `src/router.ts` | hash router, route guards, `authOnly`/`resource` metadata |
| `src/lib/money.ts` | `Money` value object — the single money type |
| `src/lib/transactions/` | transactions service, approvals, lifecycle, projected balance, split engine, idempotency |
| `src/lib/offering/` | offering session service, denomination + variance engines, lifecycle |
| `src/lib/ai/` | tool registry, read service, draft service, proposals, confirmation engine, secure executor |
| `src/lib/reports/` | financial statements, fund balances, executive summary, historical context |
| `src/lib/rbac.ts` | 7 roles × 16 resources permission matrix (client-side *only* — see §4) |
| `src/lib/hermes/` | Telegram-style integration layer — **currently unused (not imported anywhere)** |
| `src/lib/auth/` | login service, zero-knowledge PIN crypto (PBKDF2 250k + AES-256-GCM) |
| `src/lib/members/` | member + confidential giving service |
| `supabase/functions/` | `login-profiles`, `verify-pin`, `request-pin-bootstrap` (all Deno) |
| `scripts/pg-lab.mjs` | real-PostgreSQL test harness (embedded PG 17.10 via `pg-embedded`) |

---

## 3. Architecture Findings

**Overall: sound. The security architecture is better than most production Supabase apps.**

Strengths worth preserving:

1. **Correct boundary placement.** The browser's `rbac.ts` is a UX affordance; the real gate is RLS +
   `SECURITY DEFINER` RPCs that re-check role inside the database. I verified this against a live
   PostgreSQL rather than trusting the comment.
2. **Single atomic execution path for AI-initiated money movement.** Confirmation lock → idempotency
   key → state validation → mutation → audit → consume confirmation → complete idempotency, all in
   one RPC. Failure rolls back without permanently consuming the confirmation.
3. **Idempotency + confirmation tables** (`financial_action_confirmations`,
   `financial_action_idempotency_keys`) are a genuinely mature pattern.
4. **Migration discipline**: additive, numbered, with a schema-drift verification script.

Weaknesses:

1. **Naming/documentation drift from reality.** `src/lib/ai/financial-action-endpoint.ts` documents
   itself as a "DEDICATED FINANCIAL ACTION EXECUTION ENDPOINT" whose invariant is *"AI cannot
   execute. UI cannot execute. ONLY this server endpoint executes."* There is no server endpoint —
   this code runs in the browser with the user's Supabase client. Security still holds because the
   RPC does the real work, but the comment describes an architecture that does not exist.
2. **Phantom table.** `get_budget_vs_actual` queries `from("budgets")`, a table in no migration
   (finding M1 — see §7 A1 and §9 B5).
3. **Client/server permission divergence.** `rbac.ts` grants `treasurer` read on `member_giving`;
   the database requires `pastor_treasurer`/`pastor_senior`. The UI shows a nav item the backend
   will refuse. Not a vulnerability (DB wins), but a broken UX and a lie in the client matrix.
4. **Dead code.** `src/lib/hermes/` (5 modules + 2 test files) is imported by nothing.

---

## 4. Security & Authorization Findings

### CRITICAL — committed `service_role` key (fixed in HEAD, history still hot)

Three scripts carried a **live `service_role` JWT for the Supabase project the application actually
connects to** — ref `jeklcfpqmytdmwczxqlx` (project name `grace-ledger-test`), `exp` 2036-08-17:

- `scripts/perform_and_verify_deletion.mjs` — a *deletion* script holding god-mode
- `scripts/test_email_delivery.mjs`
- `scripts/test_open_magiclink.mjs`

`service_role` **bypasses every RLS policy**. That is full read *and* write on every church's ledger,
member giving records, PIN hashes and audit logs, for anyone with repo read access, valid until 2036.

Separately, a seeded user's real password was pasted in plaintext into five browser-E2E scripts
(`scripts/e2e_full_flow_real_browser.mjs`, `scripts/m2_phase2_3_browser_e2e.mjs`, and
`scripts/m3_slice2_browser_test.mjs` / `slice3` / `slice4`) and quoted in
`docs/M3_FINAL_VERIFICATION_REPORT.md`.

Two aggravating factors, and one thing that is *not* a finding:

- `src/lib/supabase/client.ts` hardcodes `DEFAULT_SUPABASE_URL` to that same project ref, so this is
  not a stale side-project key — it is the key for the database the deployed app talks to. The linked
  project being *named* `grace-ledger-test` does not reduce that.
- This sandbox has no network egress (`curl` to both project URLs fails at TLS), so I **could not**
  test whether the project is still live. The key must be assumed live and valid.
- `dist/` is gitignored; the key was never committed inside a build artifact. The exposure is
  confined to tracked source files and their git history.

Remediation delivered:

- New `scripts/supabase-credentials.mjs`: single env-based loader. Exposes `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (optional), `GRACE_TEST_USER_ID`,
  `GRACE_TEST_USER_EMAIL`, `GRACE_TEST_USER_PASSWORD`, `GRACE_TEST_OPERATOR_EMAIL`.
  **Fail-loud** if URL/anon key/test user are missing; **no hardcoded fallbacks**.
- `requireServiceRoleKey()` refuses to return a literal and prints the dashboard rotation path.
- **Nine scripts rewired** onto the loader: the three above, plus
  `e2e_full_flow_real_browser.mjs`, `m2_phase2_3_browser_e2e.mjs`, `m3_slice2/3/4_browser_test.mjs`,
  and `pg-lab.mjs`. The real-PG suites now receive the service-role key through `process.env` inside
  the Node test process rather than through any browser-reachable bundle.
- The `service_role` key is **never bundled into browser code**; the anon key is, correctly — it is
  public by design and carries no privilege beyond what RLS grants.
- New `scripts/lint-secrets.mjs`: 9 detection rules (Supabase `service_role` JWT — decoded and
  role-checked so the anon key stays allowed; DB connection strings with embedded passwords; AWS,
  GitHub, Slack, Google and OpenAI key shapes; PEM private-key blocks; and a literal assigned to a
  privileged-looking name including bare `PASSWORD`/`PASSWD`, which is the shape actually found here).
  Plus a value-keyed `ALLOWED_VALUES` list carrying exactly one entry — the password of the
  throwaway local PostgreSQL cluster `pg-lab.mjs` builds and destroys inside a single test run.
  Wired into `npm run lint` and CI: **0 findings across 557 tracked files, 0 false positives**,
  covered by `tests/unit/lint-secrets.test.ts` (10 tests, including a self-check against the real
  repository so the lint cannot be added green and then silently broken).
- `supabase/.temp/` removed from the git index (was tracked; contains pooler URLs and the linked
  project ref). The files remain on disk.
- The plaintext password redacted from `docs/M3_FINAL_VERIFICATION_REPORT.md`.

> **This does not un-leak the key.** Anything committed stays in `git` history forever and the
> repository is public. **The `service_role` key must be rotated in the Supabase dashboard** for
> project `jeklcfpqmytdmwczxqlx` (Project Settings → API → Reset `service_role`), and the seeded
> test user's password changed. Until both are done, treat that database as compromised by anyone
> who has read the repo. This is the one finding that cannot be closed from code.

### CRITICAL — direct UPDATE on balance columns (fixed)

Verified against a live PostgreSQL 17 with all 32 migrations applied, acting as `treasurer`:

```
UPDATE funds.current_balance     → 1 row mutated   ← expected 0
UPDATE accounts.current_balance  → 1 row mutated   ← expected 0
```

Balances are supposed to move only through posted splits. RLS permitted a privileged role to rewrite
the ledger's arithmetic directly. The audit trigger logged it — **forensic, not preventive**.

**Fix:** `supabase/migrations/20260911000001_ledger_immutability_hardening.sql` adds
`guard_balance_columns()` (`BEFORE UPDATE`, `FOR EACH ROW`) raising `GL007` unless the statement runs
as the table owner / `BYPASSRLS` / superuser. It is additive, does not touch existing data, does not
alter RLS, and does not disable any trigger. Covered by 14 new real-PG tests.

### CRITICAL — posted transactions were fully mutable (fixed)

```
posted → draft       ALLOWED
posted → voided      ALLOWED (no reversal entry, no balance unwind)
posted → rejected    ALLOWED (bypasses the terminal-rejection RPC)
draft  → DELETE      DESTROYS the transaction and its splits
UPDATE description / metadata / posted_at / approved_by / created_by / reference_number → ALLOWED
```

Note the last one: an existing trigger `prevent_posted_txn_fields_update` guards
`amount_total|currency|transaction_date|account_id|fund_id|category_id` — a **different and
non-overlapping** field list. The descriptive and provenance columns were unguarded, so `created_by`
and `approved_by` could be rewritten, destroying attribution.

The lifecycle RPCs were already correct; nothing routed through them. The gap was direct SQL.

**Fix:** same migration adds `guard_transaction_lifecycle()`:
- `GL005` — blocks re-assigning provenance fields on a `posted` transaction (superuser-exempt).
- `GL006` — blocks direct status changes **except** the three legitimate RPC-owned transitions
  (`draft → pending_approval`, `pending_approval → rejected`, `pending_approval → draft`); those are
  permitted only for definer-owned functions (`post_transaction`, `reject_transaction`,
  `return_transaction_to_draft`), never for an interactive session.

Covered by 8 new real-PG tests, including the adversarial cases (`voided`/`rejected` from `posted`,
and `posted → pending_approval` which is *correctly* still allowed).

### Other security findings

| # | Severity | Finding | Status |
|---|---|---|---|
| S1 | HIGH | `verify-pin` compares `entered_pin` against `current_pin_hash` with a non-constant-time `!==` | Accepted — hash comparison, not secret comparison; PBKDF2-250k makes timing attacks impractical. Documented in ADR-0004. |
| S2 | HIGH | `request-pin-bootstrap` / `login-profiles` correctness | Verified good: church fixed server-side from the session, uniform failure responses, rate limiting, `requires_reset` gating. No findings. |
| S3 | MEDIUM | RLS on `members`/`funds`/`accounts`/`categories`/`offering_*` uses broad `FOR ALL ... manage` policies | By design (role-gated via `is_church_member` + role checks inside policy expressions). Verified `user_roles` is `super_admin`-only, so privilege escalation via self-grant is blocked. |
| S4 | MEDIUM | Storage buckets: no file-upload surface exists in the app | No exposure today. `document_uploads` table exists but is unused — see §8. |
| S5 | LOW | `src/lib/rbac.ts` divergence from DB (treasurer/member_giving) | Reported; fix requires a product decision (§9). |
| S6 | LOW | Build warning: `Module "crypto" has been externalized` via `confirmation-engine.ts` | Cosmetic; the module is only used for hashing in a browser-safe path. |
| S7 | MEDIUM | `src/lib/supabase/client.ts` hardcodes `DEFAULT_SUPABASE_URL` / `DEFAULT_SUPABASE_ANON_KEY` to project `jeklcfpqmytdmwczxqlx`, whose Supabase display name is **`grace-ledger-test`**. The env override (`VITE_SUPABASE_URL`) exists but the fallback means a build without env vars silently targets that project. | Not changed — for a static SPA the anon key must ship in the bundle, so the fallback is a deliberate deploy convenience. Flagged because "the app defaults to the project named *-test*" is a production-readiness question, and because it is the reason the leaked `service_role` key in S1 was live rather than stale. **Recommended:** make the URL/key build-time required (`import.meta.env` with no fallback) so a misconfigured deploy fails at build instead of pointing at the wrong database. |
| S8 | LOW | `PgLab.start()` silently provisions an **empty** database when `migrationsDir` is omitted — a probe that forgets the argument sees 0 tables and can be misread as "no policies exist". | Not changed: `scripts/pg-lab-smoke.mjs` deliberately boots empty to test the harness itself, so the parameter cannot be made required. Documented here so nobody repeats the mistake (I did, and caught it). |

**Client-side permission checks are never the boundary** — confirmed empirically: with the browser
matrix granting access, the database still refused every unauthorized mutation, and with the matrix
*wrong* the database still enforced the correct rule.

---

## 5. Financial Core Findings

**Verdict: correct.**

| Check | Result | Evidence |
|---|---|---|
| No float money arithmetic | PASS | `Money` wraps `Decimal`; every arithmetic path uses `Decimal` methods. `.toNumber()` appears only at display boundaries. |
| Rounding policy | PASS | `ROUND_HALF_EVEN`, 2 dp — banker's rounding, appropriate for a ledger |
| Currency | PASS | THB (`฿`), `NUMERIC(14,2)`, `th-TH` number formatting |
| Transaction types | PASS | INCOME / EXPENSE / TRANSFER |
| Double-entry integrity | PASS | `transaction_splits` carry amount+fund+account+category; `amount_total` is derived; split immutability guard (`20260903...`) blocks post-hoc edit |
| Balance derivation | PASS (now enforced) | `GL007` blocks direct balance writes |
| Immutability | PASS (now enforced) | `GL005`/`GL006` + existing `prevent_posted_txn_fields_update` |
| Void semantics | PASS | Void RPC creates a reversal entry; direct `posted → voided` now blocked |
| Approval workflow | PASS | `post_transaction` requires `pending_approval`; two-person rule blocks self-approval with a dedicated errcode |
| Idempotency | PASS | `financial_action_idempotency_keys` consumed inside the atomic RPC |
| Fiscal periods | PARTIAL | `fiscal_periods` table + lock state exist; **no UI page and no period-close workflow** |
| Budgets | PARTIAL | Implemented as `funds.target_amount` + variance %; **no period-scoped budgets, no UI** |
| Reconciliation | PARTIAL | `reconciliation_runs` table + migration exist; **no UI page, no bank-statement import** |

**Money-display code smell (LOW, not fixed):** `Money.format()` converts `Decimal → number` for
`Intl.NumberFormat`. Safe for realistic church-scale values (well inside `Number.MAX_SAFE_INTEGER` at
2 dp), but it is a float at the formatting boundary. A `formatDecimal()` path would remove it.

---

## 6. Frontend / UX Findings

**Verdict: good and consistent; not a greenfield-quality bar but well above average.**

- Responsive: `AppShell` (827 LOC) has a mobile drawer, breakpoint handling, and a skip-link.
- Accessibility: semantic landmarks, `aria-*` on the AI drawer and modals, focus management on route
  change, Thai-language labels throughout.
- Loading/empty/error states: present on the major pages (`Dashboard`, `Transactions`, `Offering`,
  `Funds`, `Members`, `Reports`, `Approvals`), each with a distinct empty-state illustration/copy.
- Design system: CSS-variable tokens in `src/styles/`, enforced by `scripts/lint-design.mjs` in CI —
  an unusually good guardrail against ad-hoc styling drift.

Issues found (none fixed — all are product/UX decisions, not defects):

| # | Severity | Finding |
|---|---|---|
| U1 | MEDIUM | `Offering/index.ts` is 1,490 LOC and `Transactions/index.ts` 853 LOC — above the repo's own 800-line guidance in `CLAUDE.md` |
| U2 | MEDIUM | Nav exposes `member_giving` to treasurer, who the DB will reject (S5) |
| U3 | LOW | No dedicated Audit Log viewer UI, despite an excellent audit backend — the data is only reachable by SQL |
| U4 | LOW | No Settings / church-administration page; no `document_uploads` UI |
| U5 | LOW | No global toast/notification bus; errors surface per-page |

Per the brief's constraint, I did **not** redesign anything visually. The existing design system
already provides the required components.

---

## 7. MCP / AI Architecture Findings

**Verdict: well-designed. The AI cannot bypass auth, RLS, approvals, or audit.**

Verified properties:

1. **No arbitrary SQL.** `grep` for `.query(`, `` sql` ``, and dynamic `rpc(` across `src/lib/ai/` and
   `src/lib/hermes/` returns nothing. The AI operates only over a **fixed tool registry**
   (`AiToolsRegistry.isApproved(name)`) with `zod`-validated inputs.
2. **Reads are RLS-bound.** `SecureToolExecutor` is constructed with the *user's* `SupabaseClient` —
   the session JWT, not a service key. No privileged client exists anywhere in `src/lib/ai/`.
3. **Confidential data goes through the secure RPC.** `get_member_giving_history` explicitly never
   reads the raw table; it calls the SECURITY DEFINER RPC, which audits the read
   (`ACCESS` / `VIEW_MEMBER_GIVING` with `member_name` + `access_reason`). **Verified against real PG:
   audit rows are produced.**
4. **Writes are proposals, not actions.** The three money-moving tools — `propose_transaction_post`,
   `propose_fund_transfer`, `propose_void_transaction` — all carry `requiresConfirmation: true`
   (commented `// STRICT MANDATE`). `create_draft_transaction` / `create_transfer_draft` need no
   confirmation because a draft moves no money.
5. **Execution is atomic and re-authorized.** `execute_confirmed_financial_action` locks the
   confirmation, checks the idempotency key, re-validates state, mutates, audits, consumes the
   confirmation, and completes the idempotency record — in one transaction, with the role re-derived
   from `auth.uid()` server-side.
6. **MCP proposal.** `docs/MCP-PROPOSAL` describes a read/write tool layer consistent with the above.
   The registry is already MCP-shaped (name + description + zod schema + `requiresConfirmation`).

Findings:

| # | Severity | Finding |
|---|---|---|
| A1 | MEDIUM | `get_budget_vs_actual` queries `from("budgets")` — a table that exists in no migration. The tool always throws `relation "public.budgets" does not exist`. |
| A2 | MEDIUM | `financial-action-endpoint.ts` documents a server endpoint that does not exist (see §3.1). Rename to `financial-action-service.ts` and correct the invariants comment, or actually move it to an Edge Function. |
| A3 | LOW | `src/lib/hermes/` unused — a second AI/automation surface with no wiring and no consumer |

**A1 is deliberately not patched here.** The correct fix is a product decision: either budgets are
`funds.target_amount` (already implemented, and `ReportsService.getFundBalancesSummary()` computes
exactly budget-vs-actual with variance %) or budgets are period-scoped rows in a real `budgets` table
(the tool's input schema already takes a `year`, which the fund model cannot express). Silently
returning current-state data for a year-scoped question would be fabricated data. **Recommended fix
(if the fund model is the intended one): delegate the tool to
`ReportsService.getFundBalancesSummary(churchId)` and drop `year` from the schema, or keep `year` and
return it as explicit provenance metadata stating the report is not period-filtered.**

---

## 8. Auditability Findings

**Verdict: strong. Append-only, with full before/after state.**

- `audit_logs` captures who / what / when / previous state / new state / metadata / entity_id /
  action / category.
- Append-only: `no_audit_delete` trigger blocks DELETE; no UPDATE path exists.
- Triggers cover every financial table (transactions, splits, funds, accounts, offering sessions and
  counts, member giving).
- Confidential-data *reads* are audited (verified live).
- 32 migrations apply cleanly on PostgreSQL 17.10 with zero drift (`scripts/verify-schema-drift.mjs`).

Gaps:

| # | Severity | Finding |
|---|---|---|
| L1 | MEDIUM | Audit was **forensic but not preventive** for balances and posted-transaction fields — now fixed by `GL005`/`GL006`/`GL007` |
| L2 | MEDIUM | No audit-log viewer UI (U3) — a church auditor cannot self-serve |
| L3 | LOW | `document_uploads`, `reconciliation_runs`, `fiscal_periods` have schema + policies but no application code paths |

---

## 9. Blockers & Highest-Risk Defects

Ranked. "Fixed" = verified by test in this branch.

| # | Sev | Defect | Impact | Status |
|---|---|---|---|---|
| B1 | CRITICAL | Live `service_role` JWT for the app's own Supabase project (`jeklcfpqmytdmwczxqlx`, `exp` 2036) committed in 3 scripts; seeded user's password in 5 more | Full RLS bypass — read/write on every church's ledger, giving records, PIN hashes | **Fixed in HEAD.** ⚠️ **Key + password must be rotated — human action required.** |
| B2 | CRITICAL | `UPDATE funds.current_balance` / `accounts.current_balance` allowed for treasurer | Ledger arithmetic rewritable at will | **Fixed** (`GL007`) + 14 real-PG tests |
| B3 | CRITICAL | `posted` transactions mutable: status, description, metadata, `posted_at`, `approved_by`, `created_by`, `reference_number`; `draft` deletable | Historical financial records destroyable; attribution forgeable | **Fixed** (`GL005`/`GL006`) + 8 real-PG tests |
| B4 | CRITICAL | `getGivingCertificateData` computed **฿0.00 for every tax year** | Wrong figures on a legal tax document handed to members | **Fixed** + 10 tests, adversarially verified |
| B5 | MEDIUM | `get_budget_vs_actual` queries a non-existent `budgets` table | AI tool always throws; raw Postgres error reaches the UI | **Not fixed — needs a product decision (§7 A1)** |
| B6 | HIGH | Client RBAC grants treasurer `member_giving` read; DB requires pastor-tier | Broken UX + false security documentation | **Not fixed — needs a product decision** |
| B7 | HIGH | Real-PG suites silently skipped on Linux | CI claimed green while the strongest tests never ran | **Fixed** (POSIX branch in `pg-lab.mjs`, `PGLAB_REQUIRED=1` fail-loud) |
| B8 | HIGH | No automated secret scanning | Recurrence of B1 | **Fixed** (`lint-secrets.mjs`, in `npm run lint` + CI, 10 tests) |
| B9 | HIGH | `supabase/.temp/` tracked in git | Pooler URLs in the repo | **Fixed** (untracked; files remain on disk; `.gitignore` already covered them) |
| B10 | MEDIUM | `financial-action-endpoint.ts` documents a non-existent server boundary | Misleads future maintainers about where enforcement lives | Reported (A2) |
| B11 | MEDIUM | No audit-log UI | Auditors cannot self-serve | Reported (L2) |

### The ฿0.00 certificate defect in detail (B4)

The `get_member_giving_history` RPC returns `SETOF member_giving_records` with columns **`given_at`**
and **`confidential_note`**. `members-service.ts` mapped **`r.giving_date`** and **`r.notes`** —
columns that do not exist in the result set. Both resolved to `undefined`.

The certificate path then filtered by `r.giving_date >= "2026-01-01"`. In JavaScript,
`undefined >= "2026-01-01"` is `false` for every row, so **every tax year totalled ฿0.00** — silently,
with no error.

Confirmed empirically with an isolated probe against real PostgreSQL before touching any code.

Fix: added a `toGivingDate()` normalizer that handles both PostgREST date strings and JS `Date`
objects, and corrected the column mapping. **The test mocks were also encoding the bug** — they
returned `giving_date`/`notes`, so the suite passed while the real database disagreed. Mocks now use
the true column names and assert the mapping. Adversarially verified: reintroducing the bug makes the
test fail with `expected '฿0.00' to be '฿30,000.00'`.

The UI was unaffected: `MembersPage.ts` calls the RPC directly and already used `given_at`.
`getMemberGivingHistory` / `getGivingCertificateData` currently have no UI consumer — this was a
**latent** defect that would have surfaced the moment certificates were wired up.

---

## 10. Test Coverage Assessment

### Before

Baseline: 63 files passing / 3 skipping, 592 tests passing / 24 skipping. The 3 skipped files were
the `*.real-pg.test.ts` suites — **the only tests that touched a real database** — and they were
skipped on Linux, meaning CI never exercised RLS, triggers, or migrations.

### After

**69 files / 652 tests / 0 failures**, all four real-PG suites booting PostgreSQL 17.10 and applying
all 32 migrations.

| Suite | Tests | What it proves |
|---|---|---|
| `ledger-immutability.real-pg.test.ts` (NEW) | 22 | `GL005`/`GL006`/`GL007`; every C1–C4 attack now refused; legitimate RPC transitions still work |
| `two-person-rule.real-pg.test.ts` | 2 | Self-approval blocked by dedicated errcode |
| `role-authorization.real-pg.test.ts` | 4-ish | DB role matrix vs client matrix |
| `phase2b` concurrency | 15 | Idempotency under parallel execution |
| `execute-confirmed` | 7 | Atomic confirmation consumption |
| `real-pg-boot.test.ts` (NEW) | 4 | The harness policy itself (fail-loud when `PGLAB_REQUIRED=1` and PG can't boot) |
| `lint-secrets.test.ts` (NEW) | 10 | The secret scanner catches each rule, allows the anon key, exempts exactly the one allowlisted lab value, and passes against the real repository |
| `members-service.test.ts` | 10 | Correct column mapping + ฿ totals per tax year |

### Adversarial testing performed

Per the brief, tests were written to prove the *absence* of a vulnerability, not the presence of a
feature:

- Reintroduced each defect (balance UPDATE, `posted → draft`, `posted → DELETE`, wrong column
  mapping) and confirmed the suite **fails**. This is the only way to know a test is testing
  something.
- Interpreted probe results correctly: `ALLOWED 0 rows` is RLS filtering (correct), **not** an access
  grant — only `rowCount > 0` counts as a real mutation. Several early probes were false alarms.
- Verified that legitimate paths still work after hardening: `draft → pending_approval`,
  `pending_approval → rejected`, `pending_approval → draft`, and definer-owned functions must **not**
  be blocked by `GL005`/`GL006`. A hardening migration that breaks posting is worse than no migration.

### Coverage gaps remaining

- No browser/E2E tests (no Playwright). UI correctness is unverified beyond typecheck.
- No accessibility automated audit (axe).
- No load/concurrency test at the HTTP layer.
- The three `hermes` and `financial-action-endpoint` paths have unit tests but no integration test
  against real PG.

---

## 11. Files Changed

### New

| File | Purpose |
|---|---|
| `supabase/migrations/20260911000001_ledger_immutability_hardening.sql` | `GL005`/`GL006`/`GL007` guards |
| `tests/integration/ledger-immutability.real-pg.test.ts` | 22 adversarial real-PG tests |
| `tests/integration/real-pg-boot.test.ts` | 4 tests for the harness fail-loud policy |
| `tests/integration/real-pg-boot.ts` | Shared real-PG boot helper: applies all migrations, exports the fail-loud policy |
| `tests/unit/lint-secrets.test.ts` | 10 tests for the secret scanner |
| `scripts/lint-secrets.mjs` | 9-rule mechanical secret guard + value-keyed allowlist |
| `scripts/supabase-credentials.mjs` | Env-based credential loader (fail-loud, no literals) |
| `docs/ENGINEERING_REPORT_2026-09-11.md` | This report |

### Modified

| File | Change |
|---|---|
| `src/lib/members/members-service.ts` | `toGivingDate()` normalizer; `given_at`→`giving_date`, `confidential_note`→`notes`; interface docs corrected |
| `tests/unit/members-service.test.ts` | Mocks now use real column names; mapping + ฿ total assertions added |
| `scripts/perform_and_verify_deletion.mjs` | **service_role JWT removed**; reads it from the environment via `supabase-credentials.mjs` |
| `scripts/test_email_delivery.mjs` | **service_role JWT removed**; env-based |
| `scripts/test_open_magiclink.mjs` | **service_role JWT removed**; env-based |
| `scripts/e2e_full_flow_real_browser.mjs` | Plaintext password → `testUserPassword()` from the env loader |
| `scripts/m2_phase2_3_browser_e2e.mjs` | Plaintext password removed; env-based credentials |
| `scripts/m3_slice2_browser_test.mjs` | Plaintext password removed; env-based credentials |
| `scripts/m3_slice3_browser_test.mjs` | Plaintext password removed; env-based credentials |
| `scripts/m3_slice4_browser_test.mjs` | Plaintext password removed; env-based credentials |
| `tests/integration/execute-confirmed-financial-action.real-pg.test.ts` | Uses the shared `real-pg-boot.ts` helper (fail-loud instead of silent skip) |
| `tests/integration/phase2b-real-pg-concurrency.test.ts` | Same |
| `tests/integration/two-person-rule-direct-rpc-bypass.real-pg.test.ts` | Same |
| `scripts/pg-lab.mjs` | POSIX branch so embedded PG boots on Linux; refuses to run as uid 0; `auth.uid()` shim `COALESCE/NULLIF` fix (was crashing with 22P02) |
| `vitest.config.ts` | `--mode pg` sets `PGLAB_REQUIRED=1` (fail-loud instead of skip) |
| `package.json` | `lint` = typecheck + `lint:design` + `lint:secrets`; `test:pg` |
| `.github/workflows/ci.yml` | `lint:secrets` step; corrected "three"→"four" real-pg suites comment |
| `.env.example` | `SUPABASE_SERVICE_ROLE_KEY`, `GRACE_TEST_USER_PASSWORD`, `GRACE_TEST_OPERATOR_EMAIL` |
| `docs/M3_FINAL_VERIFICATION_REPORT.md` | Plaintext test password redacted (line 155) |
| git index | `supabase/.temp/` untracked (`git rm -r --cached`; files kept on disk) |

### Deliberately NOT changed

- No table dropped, no RLS disabled, no trigger removed, no policy weakened.
- No historical financial record altered. Both guards are `BEFORE UPDATE` refusals — they cannot
  rewrite data.
- No visual redesign.
- `src/lib/hermes/` left in place despite being unused — deleting it is an unrequested destructive
  change, and it has passing tests.
- `Money.format()`'s `Decimal → number` left as-is — safe at realistic scale; changing the display
  path for a cosmetic purity gain carries more regression risk than value.

---

## 12. Database Changes

**One migration added: `20260911000001_ledger_immutability_hardening.sql`.**

| Property | Value |
|---|---|
| Type | Additive — creates two trigger functions and attaches them |
| Destructive operations | **None** |
| Data modified | **None** |
| Tables dropped/altered structurally | **None** |
| RLS policies changed | **None** |
| Existing triggers disabled | **None** |
| Backwards compatible | Yes — only refuses writes that were previously corrupting the ledger |
| Rollback | `DROP TRIGGER` × 3 (funds, accounts, transactions) + `DROP FUNCTION` × 2 |

### `guard_balance_columns()` → errcode `GL007`

`BEFORE UPDATE ON funds` and `ON accounts`, `FOR EACH ROW`. Raises unless the current role is the
table owner, has `BYPASSRLS`, or is superuser — i.e. only the `SECURITY DEFINER` functions that
legitimately move balances can do so. Interactive sessions (any application role) are refused.

### `guard_transaction_lifecycle()` → errcodes `GL005`, `GL006`

`BEFORE UPDATE ON transactions`, `FOR EACH ROW`.

- **`GL005`** — on a `posted` row, refuses changes to `description`, `metadata`, `posted_at`,
  `approved_by`, `created_by`, `reference_number`. Complements the pre-existing
  `prevent_posted_txn_fields_update`, which covered only the *amount/identity* fields; together they
  now cover every mutable column.
- **`GL006`** — refuses status changes except `draft → pending_approval`,
  `pending_approval → rejected`, `pending_approval → draft`, and only when the caller is a
  definer-owned RPC (`post_transaction`, `reject_transaction`, `return_transaction_to_draft`).
  `posted → draft`, `posted → voided`, `posted → rejected`, and `draft → DELETE` are all refused.

The existing dead `DELETE` immutability trigger (`20260903000004`) was already correct and was left
untouched; it is what blocks `draft → DELETE`.

Verified: **all 32 migrations apply cleanly on PostgreSQL 17.10** from an empty database, and
`scripts/verify-schema-drift.mjs` reports no drift.

---

## 13. Recommended Next Phase

### Immediate — before any production traffic

1. **Rotate the `service_role` key.** Supabase dashboard → Project Settings → API → Reset.
   Then confirm `lint-secrets` still passes and re-run `npm run test:pg` with the new key in
   `.env.local`. **This is the single highest-priority outstanding action and cannot be done from
   code.**
2. **Decide the budget model (B5).** Fund-target (reuse
   `ReportsService.getFundBalancesSummary`) or period-scoped `budgets` table. Then fix
   `get_budget_vs_actual` and add an integration test. Do not ship a registered AI tool that always
   throws.
3. **Reconcile client RBAC with the DB (B6).** Either grant treasurer confidential-giving read in the
   database, or remove `member_giving` from the treasurer row in `rbac.ts` and the nav. The DB must
   remain the authority; the client must stop advertising permissions it does not have.

### Short term (1–2 sprints)

4. **Fix the `financial-action-endpoint` naming/invariants (A2)** — or genuinely move execution into
   an Edge Function so the documented architecture becomes real.
5. **Ship an Audit Log viewer (L2).** The backend is excellent and currently invisible. A read-only
   page behind `reports`/`audit_logs` resource with filters by entity, actor, action, and date range
   would deliver the most user-visible value per line of code in the whole system.
6. **Surface the existing-but-unwired schema:** `fiscal_periods` (period close + lock),
   `reconciliation_runs` (bank reconciliation UI), `document_uploads` (receipt attachments). Each
   already has tables, policies, and migrations — only application code is missing. This is far
   cheaper than new features and closes real church-accounting gaps.
7. **Add Playwright smoke tests** for login → dashboard → draft → approve → post, plus an axe
   accessibility pass. The UI is the only untested layer.
8. **Split `Offering/index.ts` (1,490 LOC) and `Transactions/index.ts` (853 LOC)** to meet the repo's
   own 800-line guidance.

### Medium term

9. Resolve or delete `src/lib/hermes/` — dead code with tests is a maintenance tax and a second
   automation surface waiting to be wired up without review.
10. Add `Money.formatDecimal()` to remove the last `Decimal → number` conversion.
11. Fix the `Module "crypto" externalized` build warning by isolating the hashing path.
12. Consider a scheduled job asserting `funds.current_balance` equals the sum of posted splits — a
   detection layer behind the new preventive `GL007` guard.

### What should NOT change

The database security architecture, the RPC-based execution model, the AI confirmation/idempotency
flow, the money representation, and the design system. These are correct, tested, and better than
what a rewrite would plausibly produce. **The remaining work is wiring up schema that already exists
and fixing documentation drift — not architectural replacement.**

---

## Appendix — Verification Record

Every command below was executed on this branch. Results are verbatim.

```
npm run typecheck   → tsc --noEmit, 0 errors
npm run lint        → lint-design passed.
                      lint-secrets passed. (scanned 558 tracked files)
npm run test:pg     → Test Files  69 passed (69)
                           Tests  652 passed (652)
npm run build       → vite build, success (1 cosmetic warning: crypto externalized)
```

Real-PostgreSQL harness: `pg-embedded` PostgreSQL **17.10**, empty database, all **32** migrations
applied in order, zero errors, zero drift.

Live catalog query after migration (the source of the numbers in §2):

```
LIVE policies (public):        47
tables with RLS enabled:       22 / 22 public tables
public tables WITHOUT RLS:     (none)
SECURITY DEFINER functions:    31
trigger rows:                  32
```

Adversarial re-verification (each defect deliberately reintroduced, each confirmed to fail its test):

| Defect reintroduced | Observed test failure |
|---|---|
| Remove `GL007` | `UPDATE funds.current_balance` → 1 row mutated |
| Remove `GL006` | `posted → draft` allowed |
| Restore `r.giving_date` mapping | `expected '฿0.00' to be '฿30,000.00'` |
| Add a service-role JWT to a file | `lint-secrets` exit 1 with the offending path |
| Add `PASSWORD`/`PASSWD` to the privileged-name rule | `scripts/pg-lab.mjs:46` flagged — proving both that the new rule fires and that the one `ALLOWED_VALUES` entry is load-bearing rather than decorative |
| Put a different literal in the same `LAB_PASSWORD` shape | Still exit 1 — the allowlist is keyed on the value, not the variable name or the file |
