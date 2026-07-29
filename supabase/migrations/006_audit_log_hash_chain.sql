-- 006_audit_log_hash_chain.sql
-- Adds SHA-256 hash chain columns to audit_log for tamper-evident audit trail.
--
-- CRITICAL (CF-3): Per-church hash chain enables independent chain verification
-- without global serialization bottlenecks.
--
-- New columns:
--   event_type     — qualified event name (e.g. "income.created", "expense.updated")
--   entity_type    — entity type discriminator (e.g. "income", "expense", "journal_entry")
--   before_state   — JSON snapshot of entity state BEFORE mutation (null for creates)
--   after_state    — JSON snapshot of entity state AFTER mutation
--   correlation_id — groups related audit events (e.g. create + approve = same correlation)
--   previous_hash  — SHA-256 of the previous audit entry in this church's chain
--   current_hash   — SHA-256 of this entry (tamper-evident)
--
-- DESIGN DECISION: Legacy entries DO NOT get backfilled hashes.
--   Reasoning: The hash is computed from a JSON payload with deterministic key ordering.
--   PostgreSQL's jsonb_build_object reorders keys alphabetically, but the server's
--   AuditService.verifyChain() uses JavaScript JSON.stringify which preserves insertion
--   order. These produce different hash outputs for identical data, making backfill
--   impossible without duplicating JS serialization logic in SQL.
--
--   Solution: current_hash and previous_hash remain NULL for pre-migration entries.
--   AuditService.verifyChain() skips hash verification for entries WHERE current_hash IS NULL.
--   New server-generated entries (post-activation) will have proper hashes.
--
-- Existing columns (entity, details) are preserved for backward compatibility.
-- All statements are idempotent — safe to re-run.

-- ============================================================================
-- 1. Add new columns (all additive, no drops)
-- ============================================================================

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS before_state TEXT,
  ADD COLUMN IF NOT EXISTS after_state TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS current_hash VARCHAR(64);

-- ============================================================================
-- 2. Backfill event_type from existing data for historical entries
--    (This is a partial backfill — entity + "." + action maps to event_type)
-- ============================================================================

UPDATE audit_log
SET event_type = CASE
  WHEN action = 'create' THEN entity || '.created'
  WHEN action = 'update' THEN entity || '.updated'
  WHEN action = 'delete' THEN entity || '.deleted'
  WHEN action = 'approve' THEN entity || '.approved'
  WHEN action = 'reject' THEN entity || '.rejected'
  ELSE entity || '.' || action
END
WHERE event_type IS NULL;

-- Backfill entity_type from entity (discriminator field)
UPDATE audit_log
SET entity_type = entity
WHERE entity_type IS NULL AND entity IS NOT NULL;

-- Backfill correlation_id with a generated UUID for entries that don't have one
UPDATE audit_log
SET correlation_id = gen_random_uuid()
WHERE correlation_id IS NULL;

-- ============================================================================
-- 3. Make NOT NULL where possible (skip current_hash — nullable for legacy entries)
--    event_type, correlation_id: all existing rows now have values → safe to enforce
--    current_hash: NULL for legacy entries → AuditService.verifyChain() handles this
-- ============================================================================

ALTER TABLE audit_log
  ALTER COLUMN event_type SET NOT NULL,
  ALTER COLUMN correlation_id SET NOT NULL;

-- ============================================================================
-- 4. Add performance indexes for the new columns
--    Note: idx_audit_user and idx_audit_correlation replace the general-purpose
--    idx_audit_church index with more targeted query paths.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON audit_log(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity_type ON audit_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
