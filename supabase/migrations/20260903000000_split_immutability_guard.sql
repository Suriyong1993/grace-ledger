-- Grace Ledger — Split immutability guard (Phase 2B Finding #1, CRITICAL)
--
-- PHASE_2B_REPORT.md Finding #1: transaction_splits had no immutability
-- enforcement at all. Its only trigger was the AFTER CDC audit trigger
-- (trg_audit_transaction_splits — records, never blocks), and its RLS
-- policies (p_splits_insert/update/delete) check church access only. As a
-- result, direct INSERT/UPDATE/DELETE as `authenticated` on splits of a
-- pending_approval/approved/posted/rejected/voided transaction succeeded,
-- silently breaking split_sum == amount (Phase 2B scenarios B/C/D/E/I).
--
-- Design (two pieces, both needed):
--
-- 1. fn_lock_transaction_status_for_split_guard — SECURITY DEFINER lookup
--    that locks the parent transactions row (FOR KEY SHARE, the same lock
--    strength the FK check already takes, so no new contention) and returns
--    its status. It MUST be the definer that runs this read: as
--    `authenticated`, a locking-clause read on transactions additionally
--    applies the UPDATE policy's USING clause, which rejects non-draft rows
--    for finance_staff — the guard would silently read NULL and allow the
--    write (observed in the Phase 2B lab: plain SELECT sees the row,
--    FOR KEY SHARE returns 0 rows). Running it as the definer bypasses RLS
--    for the lock while the caller's church scoping is preserved via
--    current_user_church_id(); an unknown/cross-church parent returns NULL
--    and the trigger fails closed.
--
-- 2. trg_enforce_split_immutability — BEFORE row trigger on
--    transaction_splits rejecting direct end-user writes unless the parent
--    transaction is still 'draft'. The trigger itself stays
--    SECURITY INVOKER so the exemption below can use current_user:
--    server-side writers (SECURITY DEFINER RPCs such as void_transaction's
--    reversal-entry split copy, and service_role) run as a non-end-user
--    current_user and keep working — mirroring how RLS policies here are
--    written TO authenticated while service_role bypasses.
--
-- The FOR KEY SHARE lock makes the status check atomic against a concurrent
-- submit/approve/post that moves the parent out of 'draft' while the split
-- statement is blocked on the parent row (Phase 2B scenarios C/E).
--
-- No existing migration is modified.

CREATE OR REPLACE FUNCTION fn_lock_transaction_status_for_split_guard(
  p_transaction_id UUID
)
RETURNS transaction_status_enum
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.status
  FROM transactions t
  WHERE t.id = p_transaction_id
    AND t.church_id = current_user_church_id()
  FOR KEY SHARE
$$;

CREATE OR REPLACE FUNCTION fn_enforce_split_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status transaction_status_enum;
BEGIN
  -- Server-side definer / service contexts are the only sanctioned writers
  -- to non-draft splits (e.g. void_transaction's reversal entry copy).
  IF current_user NOT IN ('authenticated', 'anon') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_status := fn_lock_transaction_status_for_split_guard(OLD.transaction_id);
    IF v_status IS NULL OR v_status <> 'draft' THEN
      RAISE EXCEPTION
        'Immutable Ledger: transaction_splits of a % transaction cannot be deleted directly (only draft transactions may change splits).',
        COALESCE(v_status::text, 'unavailable');
    END IF;
    RETURN OLD;
  END IF;

  v_status := fn_lock_transaction_status_for_split_guard(NEW.transaction_id);
  IF v_status IS NULL OR v_status <> 'draft' THEN
    RAISE EXCEPTION
      'Immutable Ledger: transaction_splits of a % transaction cannot be inserted or modified directly (only draft transactions may change splits).',
      COALESCE(v_status::text, 'unavailable');
  END IF;

  -- Re-parenting a split is a write to BOTH parents: reject when either side
  -- is non-draft (the NEW side was already checked above).
  IF TG_OP = 'UPDATE' AND NEW.transaction_id IS DISTINCT FROM OLD.transaction_id THEN
    v_status := fn_lock_transaction_status_for_split_guard(OLD.transaction_id);
    IF v_status IS NULL OR v_status <> 'draft' THEN
      RAISE EXCEPTION
        'Immutable Ledger: transaction_splits cannot be re-parented off a % transaction.',
        COALESCE(v_status::text, 'unavailable');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_split_immutability ON transaction_splits;
CREATE TRIGGER trg_enforce_split_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON transaction_splits
  FOR EACH ROW
  EXECUTE FUNCTION fn_enforce_split_immutability();
