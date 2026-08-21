-- ==============================================================================
-- Grace Ledger — Migration 010: Sunday Offering Core Schema Evolution (Repair)
-- Author: Principal Engineer
-- Target: PostgreSQL 17 / Supabase
--
-- Context:
--   Corrective migration following the no-op placeholder 20260818165549.
--   Safely evolves existing offering_sessions and creates M3 child tables.
--
-- Invariants Enforced:
--   1. Safe schema evolution on existing offering_sessions (no table drop/recreate)
--   2. Channel separation: expected_cash, expected_transfer, expected_qr, expected_total
--   3. Unique session identity: (church_id, service_date, service_name)
--   4. Dual counters: counter1_id <> counter2_id
--   5. Physical cash count: denomination bills (1000/500/100/50/20) + coins
--   6. Immutable revision history for expected amount corrections
--   7. One offering session -> One canonical financial transaction (idx_offering_financial_tx)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EVOLVE EXISTING OFFERING_SESSIONS TABLE
-- ------------------------------------------------------------------------------

-- Add channel-separated expected amounts
ALTER TABLE offering_sessions ADD COLUMN IF NOT EXISTS expected_cash_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE offering_sessions ADD COLUMN IF NOT EXISTS expected_transfer_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE offering_sessions ADD COLUMN IF NOT EXISTS expected_qr_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE offering_sessions ADD COLUMN IF NOT EXISTS expected_total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00;

-- Add physical cash count and variance columns
ALTER TABLE offering_sessions ADD COLUMN IF NOT EXISTS counted_cash_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE offering_sessions ADD COLUMN IF NOT EXISTS cash_variance_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE offering_sessions ADD COLUMN IF NOT EXISTS variance_status TEXT NOT NULL DEFAULT 'zero_match';

-- Add linked ledger transaction columns (populated when status = 'posted')
ALTER TABLE offering_sessions ADD COLUMN IF NOT EXISTS financial_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL;
ALTER TABLE offering_sessions ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;
ALTER TABLE offering_sessions ADD COLUMN IF NOT EXISTS posted_by UUID REFERENCES profiles(id) ON DELETE RESTRICT;

-- Evolve status column to TEXT with CHECK constraint for full state machine evolution (including 'counted')
ALTER TABLE offering_sessions ALTER COLUMN status DROP DEFAULT;
ALTER TABLE offering_sessions ALTER COLUMN status TYPE TEXT USING status::TEXT;
ALTER TABLE offering_sessions ALTER COLUMN status SET DEFAULT 'draft';

-- Safe backfill for any existing rows if present
UPDATE offering_sessions
SET 
  expected_cash_amount = COALESCE(expected_amount, 0.00),
  expected_total_amount = COALESCE(expected_amount, 0.00),
  counted_cash_amount = COALESCE(counted_amount, 0.00),
  cash_variance_amount = COALESCE(variance_amount, 0.00)
WHERE expected_total_amount = 0.00 AND expected_amount > 0.00;

-- Add constraints safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_offering_session_status' AND conrelid = 'offering_sessions'::regclass
  ) THEN
    ALTER TABLE offering_sessions ADD CONSTRAINT chk_offering_session_status 
      CHECK (status IN ('draft', 'counting', 'counted', 'variance_review', 'confirmed', 'posted', 'voided'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_variance_status' AND conrelid = 'offering_sessions'::regclass
  ) THEN
    ALTER TABLE offering_sessions ADD CONSTRAINT chk_variance_status 
      CHECK (variance_status IN ('zero_match', 'variance_detected', 'recounted', 'explained', 'acknowledged'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_expected_cash_non_negative' AND conrelid = 'offering_sessions'::regclass
  ) THEN
    ALTER TABLE offering_sessions ADD CONSTRAINT chk_expected_cash_non_negative 
      CHECK (expected_cash_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_expected_transfer_non_negative' AND conrelid = 'offering_sessions'::regclass
  ) THEN
    ALTER TABLE offering_sessions ADD CONSTRAINT chk_expected_transfer_non_negative 
      CHECK (expected_transfer_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_expected_qr_non_negative' AND conrelid = 'offering_sessions'::regclass
  ) THEN
    ALTER TABLE offering_sessions ADD CONSTRAINT chk_expected_qr_non_negative 
      CHECK (expected_qr_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_expected_total_non_negative' AND conrelid = 'offering_sessions'::regclass
  ) THEN
    ALTER TABLE offering_sessions ADD CONSTRAINT chk_expected_total_non_negative 
      CHECK (expected_total_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_counted_cash_non_negative' AND conrelid = 'offering_sessions'::regclass
  ) THEN
    ALTER TABLE offering_sessions ADD CONSTRAINT chk_counted_cash_non_negative 
      CHECK (counted_cash_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_offering_session_service' AND conrelid = 'offering_sessions'::regclass
  ) THEN
    ALTER TABLE offering_sessions ADD CONSTRAINT uq_offering_session_service 
      UNIQUE (church_id, service_date, service_name);
  END IF;
END $$;

-- Indexes for performance & posting idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_offering_financial_tx 
  ON offering_sessions(financial_transaction_id) 
  WHERE financial_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_offering_sessions_status 
  ON offering_sessions(church_id, status);

-- ------------------------------------------------------------------------------
-- 2. OFFERING SESSION ITEMS (Category, Fund, Channel Breakdown)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS offering_session_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_session_id UUID NOT NULL REFERENCES offering_sessions(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  payment_channel TEXT NOT NULL DEFAULT 'cash' CHECK (payment_channel IN ('cash', 'bank_transfer', 'qr_code', 'other')),
  source_type TEXT NOT NULL DEFAULT 'envelopes' CHECK (source_type IN ('envelopes', 'bags', 'manual_aggregate', 'electronic_slip')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offering_items_session 
  ON offering_session_items(offering_session_id);

CREATE INDEX IF NOT EXISTS idx_offering_items_church_fund 
  ON offering_session_items(church_id, fund_id);

-- ------------------------------------------------------------------------------
-- 3. OFFERING CASH COUNTS (Physical Bills & Coins)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS offering_cash_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_session_id UUID NOT NULL UNIQUE REFERENCES offering_sessions(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  bill_1000 INTEGER NOT NULL DEFAULT 0 CHECK (bill_1000 >= 0),
  bill_500 INTEGER NOT NULL DEFAULT 0 CHECK (bill_500 >= 0),
  bill_100 INTEGER NOT NULL DEFAULT 0 CHECK (bill_100 >= 0),
  bill_50 INTEGER NOT NULL DEFAULT 0 CHECK (bill_50 >= 0),
  bill_20 INTEGER NOT NULL DEFAULT 0 CHECK (bill_20 >= 0),
  coins_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (coins_amount >= 0),
  total_cash_counted NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (total_cash_counted >= 0),
  counted_by_1 UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  counted_by_2 UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  counted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_cash_count_counters_different CHECK (counted_by_1 <> counted_by_2)
);

CREATE INDEX IF NOT EXISTS idx_offering_cash_counts_session 
  ON offering_cash_counts(offering_session_id);

-- ------------------------------------------------------------------------------
-- 4. OFFERING SESSION REVISIONS (Immutable History of Expected Revisions)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS offering_session_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_session_id UUID NOT NULL REFERENCES offering_sessions(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  revision_number INTEGER NOT NULL DEFAULT 1,
  previous_cash_amount NUMERIC(14,2) NOT NULL,
  new_cash_amount NUMERIC(14,2) NOT NULL,
  previous_total_amount NUMERIC(14,2) NOT NULL,
  new_total_amount NUMERIC(14,2) NOT NULL,
  revision_reason TEXT NOT NULL CHECK (length(trim(revision_reason)) >= 5),
  revised_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offering_revisions_session 
  ON offering_session_revisions(offering_session_id, revision_number);
