-- Grace Ledger v2 — Migration 0001: Composite Indexes
-- Adds critical composite indexes for common query patterns identified during
-- the Production-Grade Codebase Review.

-- ============================================================================
-- 1. Journal Entries: Index for filtering by church + status (common dashboard query)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_je_church_status
  ON journal_entries (church_id, status)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. Journal Entries: Index for filtering by church + fiscal year + fiscal period
--    (Already exists as idx_je_church_fiscal, but adding with WHERE deleted_at)
-- ============================================================================
DROP INDEX IF EXISTS idx_je_church_fiscal;
CREATE INDEX idx_je_church_fiscal
  ON journal_entries (church_id, fiscal_year, fiscal_period)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. Audit Log: Index for entity lookups (entity_type + entity_id)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_audit_entity_type_id
  ON audit_log (entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

-- ============================================================================
-- 4. Journal Entry Lines: Index for fund + line type (budget/report queries)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_jel_fund_line_type
  ON journal_entry_lines (fund_id, line_type);

-- ============================================================================
-- 5. Journal Entry Lines: Index for church-scoped lookups
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_jel_church
  ON journal_entry_lines (church_id);

-- ============================================================================
-- 6. General Ledger: Index for church + fiscal year + fund
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_gl_church_fiscal_fund
  ON general_ledger (church_id, fiscal_year, fiscal_period, fund_id);

-- ============================================================================
-- 7. Offering Count Sheets: Index for church + date + status
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ocs_church_date_status
  ON offering_count_sheets (church_id, date, status);

-- ============================================================================
-- 8. User Sessions: Index for cleanup queries (expired sessions by church)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_sessions_church_expires
  ON user_sessions (church_id, expires_at);

-- ============================================================================
-- 9. Funds: Index for church + active status
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_funds_church_active
  ON funds (church_id, is_active)
  WHERE is_active = true;

-- ============================================================================
-- 10. Chart of Accounts: Index for church + type sorting
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_coa_church_type_order
  ON chart_of_accounts (church_id, account_type, sort_order);
