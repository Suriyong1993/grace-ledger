# REAL_PROJECT_BASELINE.md

Generated from direct inspection of `/home/user/grace-ledger` (branch `claude/project-review-7kx4jh`,
remote `Suriyong1993/grace-ledger`, HEAD `4ca92e6`). No historical prompt content used — everything
below was verified by reading files, running `npm test` / `npm run build`, and grepping the tree.

## Database

**Tables (11, single migration set, no duplicates/conflicts):**
`churches`, `profiles`, `user_roles`, `accounts`, `funds`, `categories`, `transactions`,
`transaction_splits`, `fund_transfers`, `offering_sessions`, `offering_session_items`,
`offering_cash_counts`, `offering_session_revisions`, `members`, `member_giving_records`,
`audit_logs` — **PASS**, all present, one definition each.

**Idempotency (`idempotency_keys`), Confirmation (`action_confirmations`):** **MISSING**. No table,
no migration, no reference anywhere in the repo.

## Migrations (11 files, `20260817000001` → `20260821000013`)

Sequential, no gaps, no duplicate timestamps, later migrations correctly `DROP POLICY IF EXISTS`
before recreating (verified for offering RLS). **PASS** — clean migration history for what exists.
Nothing in `20260821000014`/`15` or beyond — confirms REAL-04/06 would be genuinely new work, not
recovery.

## RPCs (22 functions, all `SECURITY DEFINER`-style server functions)

`current_user_church_id`, `current_user_has_role`, `has_church_access`, `fn_audit_log_change`,
`fn_validate_transaction_split_lifecycle`, `fn_validate_offering_session_lifecycle`,
`submit_transaction`, `approve_transaction`, `reject_transaction`, `reject_transaction_terminal`,
`request_transaction_revision`, `post_transaction`, `void_transaction`, `transfer_funds`,
`create_offering_session`, `start_cash_count`, `record_cash_count`, `confirm_offering_session`,
`revise_offering_expected_amount`, `resolve_offering_variance`, `post_offering_to_ledger`,
`get_member_giving_history`.
**PASS** for the transaction/offering domain this app currently covers. **MISSING**: any RPC for
funds CRUD-beyond-transfer, member CRUD, reports, or anything AI/confirmation/idempotency-related.

## RLS

Every table has church-scoped `USING`/`WITH CHECK` policies; `member_giving_records` blocks direct
`SELECT` (`USING (false)`) and routes through `get_member_giving_history`; `audit_logs` blocks all
client-side writes (`USING (false)` on insert/update/delete) — only reachable via
`fn_audit_log_change` triggers. **PASS**.

## RBAC

`src/lib/rbac.ts` — client-side permission table for 7 roles × 15 resources, used for UI
gating only (real enforcement is DB-side RLS + RPC role checks, confirmed above). **PASS** as a UI
convenience layer; correctly not treated as the security boundary.

## Services (`src/lib/`)

- `transactions/` — lifecycle, approvals-service, split-engine, projected-balance-engine — **PASS**
- `offering/` — offering-service, lifecycle, denomination-engine, variance-engine — **PASS**
- `funds/` — **MISSING** (no dedicated service; fund reads happen inline in offering/transaction code, transfers exist only via `transfer_funds` RPC + `fund-transfers` inside transactions lib)
- `members/` — **MISSING** (no service layer; only the RPC `get_member_giving_history` exists, no member CRUD)
- `reports/` — **MISSING** entirely
- `ai/` — **MISSING** entirely (confirmed again this pass: zero files, zero symbols)

## Pages / UI (`src/pages`, `src/components`)

Pages: Login, Dashboard, Approvals (+ detail), Offering (list/new/detail) — **PASS** for these four.
**MISSING**: Transactions page (separate from Approvals), Funds page, Members page, Reports page,
any AI/Copilot UI, any Confirmation UI, any Hermes/Telegram surface.
Router (`src/router.ts`) only defines routes for `/`, `/approvals`, `/approvals/:id`, `/offerings`,
`/offerings/new`, `/offerings/:id` — consistent with the page list, no dead/orphaned routes.

## Tests

22 files / 165 tests, all passing (`npm test`). Covers money, RBAC, split engine, transaction
lifecycle, offering lifecycle/variance/denomination, approvals, RLS/RPC contract shape,
DB migration integration tests (via `pg-mem`), UI component render tests. **PASS**. No test file
touches AI, confirmation, idempotency, or Hermes — consistent with those being unbuilt.

## Build

`npm run build` (`tsc --noEmit`) — clean, zero errors. **PASS**.

## Mock / Fallback Data

Grepped `mock|fixture|placeholder|fake data|hardcod` across `src/`: only legitimate HTML
`placeholder="..."` input attributes and one `RejectionModal` variable literally named
`placeholder` for modal copy — no fake-data-as-production-fallback pattern found. **PASS**.

One real finding, unrelated to mocking: `src/lib/supabase/client.ts` hardcodes a default Supabase
project URL and **anon** key directly in source (not a secret leak — anon keys are meant to be
public and are RLS-protected — but it means the app can't point at a different environment without
a code change; no `import.meta.env` usage exists anywhere in `src/`). **AT RISK** (config hygiene,
not a security hole).

## AI (Grace AI)

**MISSING** entirely — no types, no tool registry, no executor, no READ/DRAFT/PROPOSAL, no
Copilot UI. Reconfirmed with fresh grep this pass, zero hits.

## Hermes / Telegram

**MISSING** entirely — no code, no config, no references anywhere in the repo or docs.

## Summary Table

| Area | Status |
|---|---|
| Core schema / migrations | PASS |
| RPCs (transactions + offering domain) | PASS |
| RLS | PASS |
| RBAC (client-side gating) | PASS |
| Transaction + Offering services | PASS |
| Funds service | MISSING |
| Members service | MISSING |
| Reports | MISSING |
| Idempotency (general/AI-scoped) | MISSING |
| Confirmation system | MISSING |
| AI layer (types/registry/executor/READ/DRAFT/PROPOSAL) | MISSING |
| Copilot / Confirmation UI | MISSING |
| Hermes / Telegram | MISSING |
| Supabase client config (hardcoded creds) | AT RISK |
| Tests | PASS (165/165) |
| Build/typecheck | PASS |
| Mock-as-fallback data | PASS (none found) |
