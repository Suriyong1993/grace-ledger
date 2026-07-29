-- 008_create_missing_tables.sql
-- Creates tables defined in Drizzle schema but missing from the live database.
--
-- These tables are required for:
--   1. entry_number_counters  — Atomic entry number assignment (race condition fix)
--   2. attachments            — Metadata for Supabase Storage file references
--   3. inter_fund_loans       — Tracking loans between church-designated funds
--
-- All statements use IF NOT EXISTS — safe to re-run.

-- ============================================================================
-- 1. Entry Number Counters (MF-15: numbers at approval time)
--    RACE CONDITION FIX: Atomic counter table instead of MAX() + 1
--    Used by JournalService.assignEntryNumber()
-- ============================================================================

CREATE TABLE IF NOT EXISTS entry_number_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  entry_type entry_type NOT NULL,
  fiscal_year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(church_id, entry_type, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_enc_church_type_year ON entry_number_counters(church_id, entry_type, fiscal_year);

-- ============================================================================
-- 2. Attachments (metadata for Supabase Storage uploaded files)
--    Referenced by Phase 1 Task 1 storage migration.
--    Each row corresponds to a file stored in Supabase Storage bucket.
-- ============================================================================

CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_file_size CHECK (file_size <= 10485760) -- 10MB max
);

CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);

-- ============================================================================
-- 3. Inter-fund Loans
--    Tracks temporary loans between designated church funds.
--    Each loan must reference a journal entry for audit trail integrity.
-- ============================================================================

CREATE TABLE IF NOT EXISTS inter_fund_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id),
  from_fund_id UUID NOT NULL REFERENCES funds(id),
  to_fund_id UUID NOT NULL REFERENCES funds(id),
  amount DECIMAL(18,2) NOT NULL,
  expected_repayment_date DATE,
  interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'outstanding',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ifl_church ON inter_fund_loans(church_id);
CREATE INDEX IF NOT EXISTS idx_ifl_from_fund ON inter_fund_loans(from_fund_id);
CREATE INDEX IF NOT EXISTS idx_ifl_to_fund ON inter_fund_loans(to_fund_id);
CREATE INDEX IF NOT EXISTS idx_ifl_status ON inter_fund_loans(status);

-- ============================================================================
-- 4. Notify PostgREST to reload schema cache
-- ============================================================================

NOTIFY pgrst, 'reload schema';
