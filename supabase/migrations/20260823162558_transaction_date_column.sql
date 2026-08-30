-- ==============================================================================
-- Grace Ledger — Migration 019: transactions.transaction_date
-- Purpose:
--   Add the missing effective-date column for the transaction ledger.
--   Accounting requires three distinct timestamps, never conflated:
--     transaction_date = the date the financial event actually happened
--     created_at        = when the draft record was entered into the system
--     posted_at          = when the entry was posted to the General Ledger
--   Application code (transactions-service.ts, reports-service.ts, and
--   related pages) already assumed this column existed; it never did.
--
-- Additive only: no columns dropped or renamed, no existing data touched,
-- no trigger/RPC logic changed (none of them referenced transaction_date).
--
-- Nullable by design: the 15 existing transaction rows in production are
-- all pre-go-live development/QA test fixtures (e.g. "Slice 4 E2E ...",
-- "Stale Concurrency Test", "Youth Camp Registration") with no trustworthy
-- effective financial date. Backfilling them from created_at or posted_at
-- would fabricate false accounting history, so they are deliberately left
-- NULL for manual review rather than guessed. NOT NULL can be enforced
-- once real go-live data makes it safe to do so.
-- ==============================================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS transaction_date DATE;

COMMENT ON COLUMN transactions.transaction_date IS
  'Effective financial date of the transaction (accounting period). Distinct from created_at (record entry time) and posted_at (GL posting time). NULL on legacy rows with no trustworthy effective date — see migration 019 for the 15 pre-go-live test rows this applies to.';
