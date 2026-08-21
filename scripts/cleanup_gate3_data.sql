-- ==============================================================================
-- CLEANUP GATE 3 TEST DATA ONLY
-- Target: Real Supabase database (grace-ledger-test)
-- Scope: ONLY entities belonging to GATE3_TEST churches
-- ==============================================================================

DO $$
DECLARE
  v_church_a UUID := '33333333-3333-3333-3333-111111111111';
  v_church_b UUID := '33333333-3333-3333-3333-222222222222';
BEGIN
  -- 1. Delete transaction splits & transactions
  DELETE FROM transaction_splits WHERE church_id IN (v_church_a, v_church_b);
  DELETE FROM transactions WHERE church_id IN (v_church_a, v_church_b);

  -- 2. Delete fund transfers
  DELETE FROM fund_transfers WHERE church_id IN (v_church_a, v_church_b);

  -- 3. Delete categories, funds, accounts
  DELETE FROM categories WHERE church_id IN (v_church_a, v_church_b);
  DELETE FROM funds WHERE church_id IN (v_church_a, v_church_b);
  DELETE FROM accounts WHERE church_id IN (v_church_a, v_church_b);

  -- 4. Delete audit logs for test churches
  DELETE FROM audit_logs WHERE church_id IN (v_church_a, v_church_b);

  -- 5. Delete roles & profiles
  DELETE FROM user_roles WHERE church_id IN (v_church_a, v_church_b);
  DELETE FROM profiles WHERE church_id IN (v_church_a, v_church_b);

  -- 6. Delete auth users created for test
  DELETE FROM auth.users WHERE id IN (
    '33333333-aaaa-1111-1111-111111111111',
    '33333333-aaaa-2222-2222-222222222222',
    '33333333-aaaa-3333-3333-333333333333',
    '33333333-aaaa-4444-4444-444444444444',
    '33333333-aaaa-5555-5555-555555555555',
    '33333333-bbbb-3333-3333-333333333333'
  );

  -- 7. Delete churches
  DELETE FROM churches WHERE id IN (v_church_a, v_church_b);

  RAISE NOTICE 'Gate 3 test data cleaned up successfully.';
END $$;
