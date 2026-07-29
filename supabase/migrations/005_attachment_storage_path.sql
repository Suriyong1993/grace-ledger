-- Grace Ledger v2 — Migration 005: Attachment Storage Path
-- Adds attachment_storage_path column to incomes and expenses tables
-- so that the Supabase Storage path is persisted alongside the public URL.
-- This enables proper storage cleanup on delete operations.

-- ============================================================================
-- Incomes
-- ============================================================================

ALTER TABLE incomes
  ADD COLUMN IF NOT EXISTS attachment_storage_path VARCHAR(500);

-- ============================================================================
-- Expenses
-- ============================================================================

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS attachment_storage_path VARCHAR(500);
