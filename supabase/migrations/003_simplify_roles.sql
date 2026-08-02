-- 003_simplify_roles.sql
-- Simplify roles to super_admin and admin only
-- Add email column to users table
-- Create user_login_list view for PIN-based login

-- 1. Add email column if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 2. Update any existing users with old roles to 'admin'
UPDATE users SET role = 'admin' WHERE role NOT IN ('super_admin', 'admin');

-- 3. Create or replace user_login_list view
DROP VIEW IF EXISTS user_login_list CASCADE;
CREATE OR REPLACE VIEW user_login_list AS
SELECT
  u.id,
  u.name,
  u.role,
  au.email
FROM users u
JOIN auth.users au ON au.id = u.auth_user_id
WHERE u.is_active = true
ORDER BY u.name;

-- 4. Update RLS policies to use simplified roles
DROP POLICY IF EXISTS audit_read ON audit_log;
DROP POLICY IF EXISTS audit_read ON audit_log;
CREATE POLICY audit_read ON audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- 5. Update church_read policy for simplified roles
DROP POLICY IF EXISTS church_read ON churches;
DROP POLICY IF EXISTS church_read ON churches;
CREATE POLICY church_read ON churches
  FOR SELECT USING (id = get_current_user_church_id() OR EXISTS (
    SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role IN ('super_admin')
  ));
