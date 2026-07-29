-- 007_users_password_hash.sql
-- Adds password_hash and password_changed_at columns to the users table.
--
-- The frontend currently uses Supabase Auth for email/password authentication.
-- The server-side domain layer has its own authentication system with Argon2
-- password hashing for API-based and PIN-based login flows.
--
-- This migration enables the server auth layer (SessionService + auth routes)
-- to operate against the same database without requiring Supabase Auth.
--
-- Existing frontend auth via Supabase Auth is fully preserved — the password_hash
-- column is only used by the server-side authentication middleware.
--
-- All statements are additive and idempotent.

-- ============================================================================
-- 1. Add password_hash column
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- ============================================================================
-- 2. Add password_changed_at column for forced password change (MF-12)
--    Used by SessionService.validateSession() to detect first-login temp passwords.
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- Backfill password_changed_at for existing users (set to created_at = never changed)
UPDATE users
SET password_changed_at = created_at
WHERE password_changed_at IS NULL;
