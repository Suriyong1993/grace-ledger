-- ==============================================================================
-- Grace Ledger — Migration 018: Historical RLS Hardening
-- Purpose: Standardize RLS policies for historical tables using has_church_access()
-- ==============================================================================

-- 1. Standardize RLS Policy for historical_monthly_summaries
DROP POLICY IF EXISTS "historical_monthly_read_church_members" ON historical_monthly_summaries;
DROP POLICY IF EXISTS p_historical_monthly_select ON historical_monthly_summaries;
CREATE POLICY p_historical_monthly_select ON historical_monthly_summaries
  FOR SELECT TO authenticated
  USING (has_church_access(church_id, 'member'));

-- 2. Standardize RLS Policy for historical_weekly_summaries
DROP POLICY IF EXISTS "historical_weekly_read_church_members" ON historical_weekly_summaries;
DROP POLICY IF EXISTS p_historical_weekly_select ON historical_weekly_summaries;
CREATE POLICY p_historical_weekly_select ON historical_weekly_summaries
  FOR SELECT TO authenticated
  USING (has_church_access(church_id, 'member'));
