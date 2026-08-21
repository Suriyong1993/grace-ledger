-- ==============================================================================
-- Grace Ledger — Migration 012: Sunday Offering Row Level Security Policies
-- Author: Principal Engineer
-- Target: PostgreSQL 17 / Supabase
--
-- Security Enforced:
--   1. Strict multi-tenant church isolation across all offering tables
--   2. Role-based visibility: counters view active sessions; staff/treasurers manage
--   3. Revisions table is append-only for treasurers/super_admins
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. OFFERING_SESSIONS RLS POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE offering_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_offering_sessions_select ON offering_sessions;
CREATE POLICY p_offering_sessions_select ON offering_sessions
  FOR SELECT TO authenticated
  USING (
    has_church_access(church_id, 'counter') OR 
    has_church_access(church_id, 'finance_staff') OR 
    has_church_access(church_id, 'pastor') OR 
    has_church_access(church_id, 'treasurer') OR 
    has_church_access(church_id, 'super_admin')
  );

DROP POLICY IF EXISTS p_offering_sessions_manage ON offering_sessions;
CREATE POLICY p_offering_sessions_manage ON offering_sessions
  FOR ALL TO authenticated
  USING (
    has_church_access(church_id, 'finance_staff') OR 
    has_church_access(church_id, 'treasurer') OR 
    has_church_access(church_id, 'super_admin')
  )
  WITH CHECK (
    church_id = current_user_church_id() AND (
      has_church_access(church_id, 'finance_staff') OR 
      has_church_access(church_id, 'treasurer') OR 
      has_church_access(church_id, 'super_admin')
    )
  );

-- ------------------------------------------------------------------------------
-- 2. OFFERING_SESSION_ITEMS RLS POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE offering_session_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_offering_session_items_select ON offering_session_items;
CREATE POLICY p_offering_session_items_select ON offering_session_items
  FOR SELECT TO authenticated
  USING (
    has_church_access(church_id, 'counter') OR 
    has_church_access(church_id, 'finance_staff') OR 
    has_church_access(church_id, 'pastor') OR 
    has_church_access(church_id, 'treasurer') OR 
    has_church_access(church_id, 'super_admin')
  );

DROP POLICY IF EXISTS p_offering_session_items_manage ON offering_session_items;
CREATE POLICY p_offering_session_items_manage ON offering_session_items
  FOR ALL TO authenticated
  USING (
    has_church_access(church_id, 'finance_staff') OR 
    has_church_access(church_id, 'treasurer') OR 
    has_church_access(church_id, 'super_admin')
  )
  WITH CHECK (
    church_id = current_user_church_id() AND (
      has_church_access(church_id, 'finance_staff') OR 
      has_church_access(church_id, 'treasurer') OR 
      has_church_access(church_id, 'super_admin')
    )
  );

-- ------------------------------------------------------------------------------
-- 3. OFFERING_CASH_COUNTS RLS POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE offering_cash_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_offering_cash_counts_select ON offering_cash_counts;
CREATE POLICY p_offering_cash_counts_select ON offering_cash_counts
  FOR SELECT TO authenticated
  USING (
    has_church_access(church_id, 'counter') OR 
    has_church_access(church_id, 'finance_staff') OR 
    has_church_access(church_id, 'pastor') OR 
    has_church_access(church_id, 'treasurer') OR 
    has_church_access(church_id, 'super_admin')
  );

DROP POLICY IF EXISTS p_offering_cash_counts_manage ON offering_cash_counts;
CREATE POLICY p_offering_cash_counts_manage ON offering_cash_counts
  FOR ALL TO authenticated
  USING (
    has_church_access(church_id, 'counter') OR 
    has_church_access(church_id, 'finance_staff') OR 
    has_church_access(church_id, 'treasurer') OR 
    has_church_access(church_id, 'super_admin')
  )
  WITH CHECK (
    church_id = current_user_church_id() AND (
      has_church_access(church_id, 'counter') OR 
      has_church_access(church_id, 'finance_staff') OR 
      has_church_access(church_id, 'treasurer') OR 
      has_church_access(church_id, 'super_admin')
    )
  );

-- ------------------------------------------------------------------------------
-- 4. OFFERING_SESSION_REVISIONS RLS POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE offering_session_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_offering_session_revisions_select ON offering_session_revisions;
CREATE POLICY p_offering_session_revisions_select ON offering_session_revisions
  FOR SELECT TO authenticated
  USING (
    has_church_access(church_id, 'counter') OR 
    has_church_access(church_id, 'finance_staff') OR 
    has_church_access(church_id, 'pastor') OR 
    has_church_access(church_id, 'treasurer') OR 
    has_church_access(church_id, 'super_admin')
  );

DROP POLICY IF EXISTS p_offering_session_revisions_insert ON offering_session_revisions;
CREATE POLICY p_offering_session_revisions_insert ON offering_session_revisions
  FOR INSERT TO authenticated
  WITH CHECK (
    church_id = current_user_church_id() AND (
      has_church_access(church_id, 'treasurer') OR 
      has_church_access(church_id, 'super_admin')
    )
  );
