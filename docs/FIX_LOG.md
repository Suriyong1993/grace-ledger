# FIX_LOG.md — Grace Ledger Schema-Drift & Fake-Data Fix

**Date:** 2026-08-28
**Baseline:** 57 test files / 473 tests (all green), tsc clean
**After:** 58 test files / 480 tests (all green), tsc clean (+1 integration file, +7 real-PG tests)

---

## Step 1 — Confirm Schema Drift

**Evidence script:** `scripts/verify-schema-drift.mjs` (CREATED, 117 lines)

| Probe | SQL Tested | Result |
|---|---|---|
| A | `INSERT INTO idempotency_keys(... started_at ...)` | `ERROR 42703: column "started_at" of relation "idempotency_keys" does not exist` |
| B | `SELECT target_budget FROM funds` | `ERROR 42703: column "target_budget" does not exist` |
| Control | `SELECT target_amount FROM funds` | Returns `0` (real column is `target_amount numeric`) |

All 19 migrations applied cleanly — drift is silent at CREATE-time.

---

## Step 2 — Fix `execute_confirmed_financial_action` RPC

**New migration:** `supabase/migrations/20260825000022_fix_execute_confirmed_financial_action.sql` (261 lines)

**8 defects fixed:**
1. `idempotency_keys` INSERT referenced nonexistent `started_at` + missing NOT NULL `operation` → now `operation 'execute_confirmed_financial_action'`
2. Completion UPDATE removed `completed_at` (nonexistent column)
3. `transactions.category_id` reference removed (category lives on `transaction_splits`)
4. `transaction_splits.description` → `note`
5. Negative split amounts → delegation to canonical `post_transaction`/`void_transaction` (positive splits)
6. Transfer branch delegated to canonical `transfer_funds` RPC (writes `fund_transfers`)
7. Audit category `'FINANCIAL_EXECUTION'` (invalid enum) → `'FINANCIAL'`
8. `operation` column NOT NULL constraint fix

**Integration test:** `tests/integration/execute-confirmed-financial-action.real-pg.test.ts` (359 lines, 7/7 pass on real PG 17)

| Test | What it proves |
|---|---|
| post | Confirmed txn posted, balances correct, audit `EXECUTE_POST_TRANSACTION`/`FINANCIAL`, idempotency completed |
| transfer | `fund_transfers` row + balance deltas, audit `EXECUTE_FUND_TRANSFER` |
| replay | Same idempotency key → no double-mutation |
| tamper | Wrong nonce → P0005; wrong hash → P0006 |
| cross-user | TREASURER2 (different user) → `Cross-User Access Denied` |
| cross-tenant | Church B treasury → `Cross-Tenant Access Denied` |
| invariant | Insufficient funds rejected |

**Infrastructure:** `scripts/pg-lab.mjs` + `scripts/pg-lab.d.mts` + `scripts/grant-logon-as-service.ps1` (boot PG 17 via embedded-postgres under unprivileged local Windows service)

---

## Step 3 — `target_budget` → `target_amount` Everywhere

| File | Lines Changed | What |
|---|---|---|
| `src/lib/funds/funds-service.ts` | ~60-90, 120-140, 180-200 | Schema fields, `FundModel.target_amount`, select/map, create/update payloads |
| `src/lib/reports/reports-service.ts` | ~80-100 | `FundBalanceReportItem.target_amount`, select/map |
| `src/lib/ai/secure-tool-executor.ts` | ~150-170 | `get_fund_balance` select + map |
| `src/lib/ai/tools-registry.ts` | ~40-50 | `outputSchema` field name |
| `src/pages/FundsPage.ts` | ~170-195 | `targetAmount: Money \| null`, select `target_amount`, removed fake `(idx+1)*100000` |
| `tests/unit/funds-service.test.ts` | fixtures | `target_amount` in mock data |
| `tests/unit/secure-tool-executor.test.ts` | fixtures | `target_amount` in mock data |
| `tests/unit/reports-service.test.ts` | fixtures | `target_amount` in mock data |
| `tests/unit/grace-ai-read.test.ts` | fixtures | `target_amount` in mock data |
| `tests/unit/grace-ai-drawer.test.ts` | fixtures | `target_amount` in mock data |
| `tests/unit/grace-ai-draft.test.ts` | fixtures | `target_amount` in mock data |

**Verification:** `grep -r "target_budget\|targetBudget" src/ tests/` → 0 hits (only evidence script intentionally references it)

---

## Step 4 — Remove Fake Data

### FundsPage (`src/pages/FundsPage.ts`, 305 lines)
- Removed fake `(idx+1)*100000` for `targetAmount`
- Shows real `target_amount` from DB; shows "ไม่ระบุ" when null
- Progress bar hidden when no target

### MembersPage (`src/pages/MembersPage.ts`, 367 lines — FULL REWRITE)
- Real `member_code` from DB (no more `MEM-XXXX` synthesis)
- `group` → "—" (column doesn't exist)
- Removed fake `yearGivingTotal`/`titheCount`/`lastGivenDate` from `created_at`
- Privacy: giving data shown only via `get_member_giving_history` RPC (pastor/finance only)
- Card shows "ประวัติการถวายเป็นข้อมูลส่วนตัว"; modal shows loading/denied/none states

### TransactionsPage (`src/pages/TransactionsPage.ts`, 511 lines)
- Real `direction` column (no keyword guessing)
- Real `reference_number` or "—" (no `TXN-XXXX`)
- Real `transaction_date` (null → "ไม่ระบุวันที่", `dateGroup` "undated")
- Real `created_by` → profile name lookup (no fake "เจ้าหน้าที่การเงิน")
- Real statuses: `draft`/`pending_approval`/`approved`/`posted`/`rejected`/`voided`

---

## Step 5 — Remove Dead Code

| Deleted | Reason |
|---|---|
| `src/components/ai/GraceAiDrawer.ts` | Dead copy; `main.ts` imports `./components/ai-drawer/GraceAiDrawer` |
| `tests/unit/proposal-confirmation-modal.test.tsx` | 2-line placeholder; real test is `.test.ts` (212 lines) |

| Fixed | What |
|---|---|
| `src/components/ai/index.ts` | Removed broken `./GraceAiDrawer` re-export; exports only `./ProposalConfirmationModal` |
| `tests/unit/grace-ai-drawer.test.ts` | Import path → `../../src/components/ai-drawer/GraceAiDrawer` |
| `tests/unit/grace-ai-drawer.test.ts` | All 5 assertions updated to match active component's actual output (IDs, labels, Thai text) |

**Not performed:** `supabase/types.ts` regeneration — requires a live non-production DB (linked project is production/forbidden; hand-editing risks fabrication). Existing `types.ts` already maps `target_amount` correctly.

---

## Step 6 — Minor Fixes

### ReportsPage period-end fix (`src/pages/ReportsPage.ts`, line 100)
- **Before:** `` const periodEnd = `${this.selectedPeriod}-31` `` → invalid for months without 31 days (e.g. Feb → `2026-02-31` → Postgres error)
- **After:**
  ```ts
  const [periodYear, periodMonth] = this.selectedPeriod.split("-").map(Number);
  const lastDay = new Date(periodYear, periodMonth, 0).getDate();
  const periodEnd = `${this.selectedPeriod}-${String(lastDay).padStart(2, "0")}`;
  ```

### OfferingPage inline styles → CSS classes (`src/pages/OfferingPage.ts`, 1094 lines)
All 9 inline `style=` attributes removed. New CSS classes added to `src/styles/app.css`:

| CSS Class | Replaces |
|---|---|
| `.gl-loading-center` | `style="padding: 48px; text-align: center; color: var(--muted-foreground);"` |
| `.gl-loading-center__msg` | `style="font-size: var(--text-base); font-weight: var(--weight-semibold); margin-bottom: 6px;"` |
| `.gl-toast` | Success banner container (income-muted bg, approved border) |
| `.gl-toast__body` | Toast flex row |
| `.gl-toast__close` | Toast dismiss button |
| `.gl-page--flush-bottom` | `style="padding-bottom: 0;"` |
| `.gl-badge--inline` | `style="margin-left: var(--space-2);"` |
| `.gl-empty-center` | `style="text-align: center;"` on empty-state page |
| `.gl-empty-center__msg` | Heading inside empty state |

---

## Step 7 — This File

---

## Test Count Summary

| Metric | Before | After | Delta |
|---|---|---|---|
| Test files | 57 | 58 | +1 (real-PG integration) |
| Tests | 473 | 480 | +7 (real-PG integration) |
| tsc --noEmit | clean | clean | — |
| skipped | 0 | 0 | — |

### Test files updated (Step 5/6 fixes)

| File | Tests | Change |
|---|---|---|
| `tests/unit/grace-ai-drawer.test.ts` | 5/5 pass | Import path fixed; assertions updated for active component |
| `tests/unit/transactions-page-ui.test.ts` | 5/5 pass | Mock data: real `direction`/`reference_number`/`created_by`/`status`; dynamic dates; table-aware mock |
| `tests/unit/members-page-ui.test.ts` | 3/3 pass | Removed fake `MEM-0101`/`฿36,000.00`; tests real `"—"` and loading state |

---

## Financial Invariants Preserved

- [x] Split-sum parity (canonical RPCs enforce)
- [x] Two-person approval (creator ≠ approver)
- [x] `amount > 0` CHECK
- [x] Immutable posted/voided/rejected
- [x] Offering state machine
- [x] No production data touched (local lab only)
- [x] No financial calculations modified
- [x] Audit trail intact (categories corrected from `FINANCIAL_EXECUTION` → `FINANCIAL`)
