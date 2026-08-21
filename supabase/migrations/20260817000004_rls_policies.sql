-- ==============================================================================
-- Grace Ledger — Migration 004: Row-Level Security (RLS) Policies
-- Author: Principal Engineer
-- Target: PostgreSQL 16 / Supabase
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENABLE RLS ON ALL TABLES
-- ------------------------------------------------------------------------------

ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offering_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_giving_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. CHURCHES & PROFILES
-- ------------------------------------------------------------------------------

-- Churches: Users can only see their own active church
DROP POLICY IF EXISTS p_churches_select ON churches;
CREATE POLICY p_churches_select ON churches
  FOR SELECT TO authenticated
  USING (id = current_user_church_id());

DROP POLICY IF EXISTS p_churches_update ON churches;
CREATE POLICY p_churches_update ON churches
  FOR UPDATE TO authenticated
  USING (has_church_access(id, 'super_admin'))
  WITH CHECK (has_church_access(id, 'super_admin'));

-- Profiles: Users see profiles in their own church
DROP POLICY IF EXISTS p_profiles_select ON profiles;
CREATE POLICY p_profiles_select ON profiles
  FOR SELECT TO authenticated
  USING (has_church_access(church_id, 'member'));

DROP POLICY IF EXISTS p_profiles_update ON profiles;
CREATE POLICY p_profiles_update ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR has_church_access(church_id, 'super_admin'))
  WITH CHECK (church_id = current_user_church_id());

-- User Roles: Read by church members, managed by super_admin
DROP POLICY IF EXISTS p_user_roles_select ON user_roles;
CREATE POLICY p_user_roles_select ON user_roles
  FOR SELECT TO authenticated
  USING (has_church_access(church_id, 'member'));

DROP POLICY IF EXISTS p_user_roles_manage ON user_roles;
CREATE POLICY p_user_roles_manage ON user_roles
  FOR ALL TO authenticated
  USING (has_church_access(church_id, 'super_admin'))
  WITH CHECK (has_church_access(church_id, 'super_admin'));

-- ------------------------------------------------------------------------------
-- 3. FINANCIAL MASTER DATA (Accounts, Funds, Categories)
-- ------------------------------------------------------------------------------

-- Accounts
DROP POLICY IF EXISTS p_accounts_select ON accounts;
CREATE POLICY p_accounts_select ON accounts
  FOR SELECT TO authenticated
  USING (has_church_access(church_id, 'finance_staff'));

DROP POLICY IF EXISTS p_accounts_manage ON accounts;
CREATE POLICY p_accounts_manage ON accounts
  FOR ALL TO authenticated
  USING (has_church_access(church_id, 'treasurer'))
  WITH CHECK (church_id = current_user_church_id() AND has_church_access(church_id, 'treasurer'));

-- Funds
DROP POLICY IF EXISTS p_funds_select ON funds;
CREATE POLICY p_funds_select ON funds
  FOR SELECT TO authenticated
  USING (has_church_access(church_id, 'finance_staff'));

DROP POLICY IF EXISTS p_funds_manage ON funds;
CREATE POLICY p_funds_manage ON funds
  FOR ALL TO authenticated
  USING (has_church_access(church_id, 'treasurer'))
  WITH CHECK (church_id = current_user_church_id() AND has_church_access(church_id, 'treasurer'));

-- Categories
DROP POLICY IF EXISTS p_categories_select ON categories;
CREATE POLICY p_categories_select ON categories
  FOR SELECT TO authenticated
  USING (has_church_access(church_id, 'finance_staff'));

DROP POLICY IF EXISTS p_categories_manage ON categories;
CREATE POLICY p_categories_manage ON categories
  FOR ALL TO authenticated
  USING (has_church_access(church_id, 'treasurer'))
  WITH CHECK (church_id = current_user_church_id() AND has_church_access(church_id, 'treasurer'));

-- ------------------------------------------------------------------------------
-- 4. FINANCIAL LEDGER (Transactions, Splits, Transfers)
-- ------------------------------------------------------------------------------

-- Transactions: Finance staff can read/insert, edit drafts only
DROP POLICY IF EXISTS p_transactions_select ON transactions;
CREATE POLICY p_transactions_select ON transactions
  FOR SELECT TO authenticated
  USING (has_church_access(church_id, 'finance_staff'));

DROP POLICY IF EXISTS p_transactions_insert ON transactions;
CREATE POLICY p_transactions_insert ON transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    church_id = current_user_church_id() 
    AND has_church_access(church_id, 'finance_staff')
  );

DROP POLICY IF EXISTS p_transactions_update_draft ON transactions;
CREATE POLICY p_transactions_update_draft ON transactions
  FOR UPDATE TO authenticated
  USING (
    church_id = current_user_church_id() 
    AND has_church_access(church_id, 'finance_staff')
    AND (status = 'draft' OR has_church_access(church_id, 'treasurer'))
  )
  WITH CHECK (church_id = current_user_church_id());

DROP POLICY IF EXISTS p_transactions_delete ON transactions;
CREATE POLICY p_transactions_delete ON transactions
  FOR DELETE TO authenticated
  USING (
    church_id = current_user_church_id() 
    AND status = 'draft' 
    AND has_church_access(church_id, 'treasurer')
  );

-- Transaction Splits: Follows parent transaction permissions
DROP POLICY IF EXISTS p_splits_select ON transaction_splits;
CREATE POLICY p_splits_select ON transaction_splits
  FOR SELECT TO authenticated
  USING (has_church_access(church_id, 'finance_staff'));

DROP POLICY IF EXISTS p_splits_insert ON transaction_splits;
CREATE POLICY p_splits_insert ON transaction_splits
  FOR INSERT TO authenticated
  WITH CHECK (
    church_id = current_user_church_id() 
    AND has_church_access(church_id, 'finance_staff')
  );

DROP POLICY IF EXISTS p_splits_update ON transaction_splits;
CREATE POLICY p_splits_update ON transaction_splits
  FOR UPDATE TO authenticated
  USING (
    church_id = current_user_church_id() 
    AND has_church_access(church_id, 'finance_staff')
  )
  WITH CHECK (church_id = current_user_church_id());

DROP POLICY IF EXISTS p_splits_delete ON transaction_splits;
CREATE POLICY p_splits_delete ON transaction_splits
  FOR DELETE TO authenticated
  USING (
    church_id = current_user_church_id() 
    AND has_church_access(church_id, 'finance_staff')
  );

-- Fund Transfers: Read by staff, created via transfer_funds RPC
DROP POLICY IF EXISTS p_transfers_select ON fund_transfers;
CREATE POLICY p_transfers_select ON fund_transfers
  FOR SELECT TO authenticated
  USING (has_church_access(church_id, 'finance_staff'));

-- ------------------------------------------------------------------------------
-- 5. OFFERING SESSIONS & MEMBERS
-- ------------------------------------------------------------------------------

-- Offering Sessions: Accessible by counters, staff, treasurers
DROP POLICY IF EXISTS p_offering_sessions_select ON offering_sessions;
CREATE POLICY p_offering_sessions_select ON offering_sessions
  FOR SELECT TO authenticated
  USING (has_church_access(church_id, 'counter') OR has_church_access(church_id, 'finance_staff'));

DROP POLICY IF EXISTS p_offering_sessions_manage ON offering_sessions;
CREATE POLICY p_offering_sessions_manage ON offering_sessions
  FOR ALL TO authenticated
  USING (has_church_access(church_id, 'finance_staff'))
  WITH CHECK (church_id = current_user_church_id() AND has_church_access(church_id, 'finance_staff'));

-- Members: General directory readable by staff, managed by staff/treasurer
DROP POLICY IF EXISTS p_members_select ON members;
CREATE POLICY p_members_select ON members
  FOR SELECT TO authenticated
  USING (has_church_access(church_id, 'finance_staff'));

DROP POLICY IF EXISTS p_members_manage ON members;
CREATE POLICY p_members_manage ON members
  FOR ALL TO authenticated
  USING (has_church_access(church_id, 'treasurer'))
  WITH CHECK (church_id = current_user_church_id() AND has_church_access(church_id, 'treasurer'));

-- ------------------------------------------------------------------------------
-- 6. SENSITIVE MEMBER GIVING (STRICT LOCKOUT)
-- ------------------------------------------------------------------------------

-- Direct SELECT is DENIED for ALL regular client queries.
-- All access MUST flow through get_member_giving_history() RPC.
DROP POLICY IF EXISTS p_member_giving_direct_select ON member_giving_records;
CREATE POLICY p_member_giving_direct_select ON member_giving_records
  FOR SELECT TO authenticated
  USING (false);

DROP POLICY IF EXISTS p_member_giving_insert ON member_giving_records;
CREATE POLICY p_member_giving_insert ON member_giving_records
  FOR INSERT TO authenticated
  WITH CHECK (
    church_id = current_user_church_id() 
    AND has_church_access(church_id, 'treasurer')
  );

-- ------------------------------------------------------------------------------
-- 7. AUDIT LOGS (STRICT IMMUTABILITY & ACCESS RESTRICTION)
-- ------------------------------------------------------------------------------

-- Only Pastors, Auditors, and Admins can view audit logs
DROP POLICY IF EXISTS p_audit_logs_select ON audit_logs;
CREATE POLICY p_audit_logs_select ON audit_logs
  FOR SELECT TO authenticated
  USING (has_church_access(church_id, 'pastor'));

-- Prohibit direct INSERT, UPDATE, and DELETE from all client applications
DROP POLICY IF EXISTS p_audit_logs_insert ON audit_logs;
CREATE POLICY p_audit_logs_insert ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS p_audit_logs_update ON audit_logs;
CREATE POLICY p_audit_logs_update ON audit_logs
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS p_audit_logs_delete ON audit_logs;
CREATE POLICY p_audit_logs_delete ON audit_logs
  FOR DELETE TO authenticated
  USING (false);
