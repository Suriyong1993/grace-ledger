-- Provision Test Churches
INSERT INTO churches (id, name, currency) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Church A - Grace Alpha', 'THB'),
  ('22222222-2222-2222-2222-222222222222', 'Church B - Grace Beta', 'THB')
ON CONFLICT (id) DO NOTHING;

-- Provision Auth Users
INSERT INTO auth.users (id, email, role, aud) VALUES
  ('aaaaaaaa-1111-1111-1111-111111111111', 'pastor_a@grace.org', 'authenticated', 'authenticated'),
  ('aaaaaaaa-2222-2222-2222-222222222222', 'treasurer_a@grace.org', 'authenticated', 'authenticated'),
  ('aaaaaaaa-3333-3333-3333-333333333333', 'staff_a@grace.org', 'authenticated', 'authenticated'),
  ('aaaaaaaa-4444-4444-4444-444444444444', 'member_a@grace.org', 'authenticated', 'authenticated'),
  ('bbbbbbbb-1111-1111-1111-111111111111', 'pastor_b@grace.org', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Provision Profiles
INSERT INTO profiles (id, church_id, email, full_name, is_active) VALUES
  ('aaaaaaaa-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'pastor_a@grace.org', 'Pastor A', true),
  ('aaaaaaaa-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'treasurer_a@grace.org', 'Treasurer A', true),
  ('aaaaaaaa-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'staff_a@grace.org', 'Staff A', true),
  ('aaaaaaaa-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'member_a@grace.org', 'Member A', true),
  ('bbbbbbbb-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'pastor_b@grace.org', 'Pastor B', true)
ON CONFLICT (id) DO UPDATE SET church_id = EXCLUDED.church_id, is_active = true;

-- Provision User Roles
INSERT INTO user_roles (user_id, church_id, role) VALUES
  ('aaaaaaaa-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'pastor'),
  ('aaaaaaaa-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'treasurer'),
  ('aaaaaaaa-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'finance_staff'),
  ('aaaaaaaa-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'member'),
  ('bbbbbbbb-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'pastor')
ON CONFLICT DO NOTHING;

-- Provision Test Accounts & Funds for Church A & Church B
INSERT INTO accounts (id, church_id, name, type, current_balance) VALUES
  ('acc11111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Main Account A', 'bank', 100000.00),
  ('acc22222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Main Account B', 'bank', 50000.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO funds (id, church_id, name, current_balance) VALUES
  ('f00d1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'General Fund A', 100000.00),
  ('f00d2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'General Fund B', 50000.00)
ON CONFLICT (id) DO NOTHING;

-- Provision Test Member & Giving Record for Church A
INSERT INTO members (id, church_id, full_name, email) VALUES
  ('ee111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Panida Giving A', 'panida@grace.org')
ON CONFLICT (id) DO NOTHING;

INSERT INTO member_giving_records (id, church_id, member_id, amount, giving_type, payment_method, given_at, created_by) VALUES
  ('99111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'ee111111-1111-1111-1111-111111111111', 5000.00, 'tithe', 'bank_transfer', now(), 'aaaaaaaa-2222-2222-2222-222222222222')
ON CONFLICT (id) DO NOTHING;
