-- ==============================================================================
-- Grace Ledger — Migration 008: Validate member_id church membership for giving records
-- Author: Audit Fix (2026-09-04)
-- Target: PostgreSQL 17 / Supabase
--
-- Invariant: When inserting a member_giving_record, the member_id must belong
--            to the same church as the inserting treasurer.
--            Prevents accidental (or intentional) data entry against the wrong member.
-- ==============================================================================

DROP POLICY IF EXISTS p_member_giving_insert ON member_giving_records;
CREATE POLICY p_member_giving_insert ON member_giving_records
  FOR INSERT TO authenticated
  WITH CHECK (
    church_id = current_user_church_id() 
    AND has_church_access(church_id, 'treasurer')
    AND EXISTS (
      SELECT 1 FROM members m 
      WHERE m.id = member_giving_records.member_id 
      AND m.church_id = current_user_church_id()
    )
  );
