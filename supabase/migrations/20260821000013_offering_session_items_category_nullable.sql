-- ==============================================================================
-- Grace Ledger — Migration 013: offering_session_items.category_id -> nullable
-- Target: PostgreSQL 17 / Supabase
--
-- Context:
--   Migration 010 (20260819000010_offering_core_schema_repair.sql) created
--   offering_session_items with `category_id UUID NOT NULL`. No layer of the
--   application was ever updated to collect a category on a Sunday Offering
--   item: OfferingEntryForm has no category field, OfferingSession types
--   declare categoryId as optional, and offering-service.ts always sends
--   `category_id: item.categoryId || null`. No church seeds a default
--   category either. The result: create_offering_session has always failed
--   with a NOT NULL violation (Postgres 23502) for every real submission —
--   the Sunday Offering flow could not be completed through the UI.
--
--   Found via a real-browser, real-login end-to-end run (not the Node-side
--   scripts, which insert test rows directly and always supplied a
--   category_id, masking this).
--
-- Decision: category on an offering item is optional going forward. Revert
-- the column to the behaviour migration 001 originally declared (nullable),
-- rather than retrofitting a required category picker into the entry form.
-- ==============================================================================

ALTER TABLE offering_session_items
  ALTER COLUMN category_id DROP NOT NULL;

COMMENT ON COLUMN offering_session_items.category_id IS
  'Optional. Sunday Offering items are recorded by fund and channel; a category is not required to create or post a session.';
