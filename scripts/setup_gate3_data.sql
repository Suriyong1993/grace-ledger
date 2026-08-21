-- ==============================================================================
-- GATE 3 — FINANCIAL REALITY TEST SEED DATA
-- Dedicated Isolated Test Data with GATE3_TEST_* prefixes
-- ==============================================================================

-- 1. Churches
INSERT INTO churches (id, name, currency) VALUES
  ('33333333-3333-3333-3333-111111111111', 'GATE3_TEST_Church_A', 'THB'),
  ('33333333-3333-3333-3333-222222222222', 'GATE3_TEST_Church_B', 'THB')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, currency = EXCLUDED.currency;

-- 2. Auth Users & Profiles (Simulated Supabase Auth IDs)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
VALUES 
  ('33333333-aaaa-1111-1111-111111111111', 'gate3_superadmin@test.com', 'dummy_hash', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated'),
  ('33333333-aaaa-2222-2222-222222222222', 'gate3_pastor_a@test.com', 'dummy_hash', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated'),
  ('33333333-aaaa-3333-3333-333333333333', 'gate3_treasurer_a@test.com', 'dummy_hash', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated'),
  ('33333333-aaaa-4444-4444-444444444444', 'gate3_staff_a@test.com', 'dummy_hash', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated'),
  ('33333333-aaaa-5555-5555-555555555555', 'gate3_member_a@test.com', 'dummy_hash', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated'),
  ('33333333-bbbb-3333-3333-333333333333', 'gate3_treasurer_b@test.com', 'dummy_hash', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, church_id, email, full_name) VALUES
  ('33333333-aaaa-1111-1111-111111111111', '33333333-3333-3333-3333-111111111111', 'gate3_superadmin@test.com', 'GATE3_TEST_SuperAdmin'),
  ('33333333-aaaa-2222-2222-222222222222', '33333333-3333-3333-3333-111111111111', 'gate3_pastor_a@test.com', 'GATE3_TEST_PastorA'),
  ('33333333-aaaa-3333-3333-333333333333', '33333333-3333-3333-3333-111111111111', 'gate3_treasurer_a@test.com', 'GATE3_TEST_TreasurerA'),
  ('33333333-aaaa-4444-4444-444444444444', '33333333-3333-3333-3333-111111111111', 'gate3_staff_a@test.com', 'GATE3_TEST_FinanceStaffA'),
  ('33333333-aaaa-5555-5555-555555555555', '33333333-3333-3333-3333-111111111111', 'gate3_member_a@test.com', 'GATE3_TEST_MemberA'),
  ('33333333-bbbb-3333-3333-333333333333', '33333333-3333-3333-3333-222222222222', 'gate3_treasurer_b@test.com', 'GATE3_TEST_TreasurerB')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, church_id = EXCLUDED.church_id;

-- 3. RBAC Roles
INSERT INTO user_roles (user_id, church_id, role) VALUES
  ('33333333-aaaa-1111-1111-111111111111', '33333333-3333-3333-3333-111111111111', 'super_admin'),
  ('33333333-aaaa-2222-2222-222222222222', '33333333-3333-3333-3333-111111111111', 'pastor'),
  ('33333333-aaaa-3333-3333-333333333333', '33333333-3333-3333-3333-111111111111', 'treasurer'),
  ('33333333-aaaa-4444-4444-444444444444', '33333333-3333-3333-3333-111111111111', 'finance_staff'),
  ('33333333-aaaa-5555-5555-555555555555', '33333333-3333-3333-3333-111111111111', 'member'),
  ('33333333-bbbb-3333-3333-333333333333', '33333333-3333-3333-3333-222222222222', 'treasurer')
ON CONFLICT (user_id, church_id, role) DO NOTHING;

-- 4. Accounts
INSERT INTO accounts (id, church_id, name, type, current_balance) VALUES
  ('33333333-acc1-1111-1111-111111111111', '33333333-3333-3333-3333-111111111111', 'GATE3_TEST_Bank_A', 'bank', 100000.00),
  ('33333333-acc2-2222-2222-222222222222', '33333333-3333-3333-3333-222222222222', 'GATE3_TEST_Bank_B', 'bank', 50000.00)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, current_balance = EXCLUDED.current_balance;

-- 5. Funds
INSERT INTO funds (id, church_id, name, current_balance) VALUES
  ('33333333-f001-1111-1111-111111111111', '33333333-3333-3333-3333-111111111111', 'GATE3_TEST_General_Fund', 50000.00),
  ('33333333-f002-1111-1111-111111111111', '33333333-3333-3333-3333-111111111111', 'GATE3_TEST_Building_Fund', 10000.00),
  ('33333333-f003-1111-1111-111111111111', '33333333-3333-3333-3333-111111111111', 'GATE3_TEST_Mission_Fund', 5000.00),
  ('33333333-f004-1111-1111-111111111111', '33333333-3333-3333-3333-111111111111', 'GATE3_TEST_Concurrency_Fund', 10000.00),
  ('33333333-f005-1111-1111-111111111111', '33333333-3333-3333-3333-111111111111', 'GATE3_TEST_Small_Fund', 1000.00),
  ('33333333-f006-2222-2222-222222222222', '33333333-3333-3333-3333-222222222222', 'GATE3_TEST_ChurchB_Fund', 20000.00)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, current_balance = EXCLUDED.current_balance;

-- 6. Categories
INSERT INTO categories (id, church_id, name, direction, default_fund_id) VALUES
  ('33333333-c001-1111-1111-111111111111', '33333333-3333-3333-3333-111111111111', 'GATE3_TEST_Tithes', 'income', '33333333-f001-1111-1111-111111111111'),
  ('33333333-c002-1111-1111-111111111111', '33333333-3333-3333-3333-111111111111', 'GATE3_TEST_Ministry_Exp', 'expense', '33333333-f001-1111-1111-111111111111')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, direction = EXCLUDED.direction;
