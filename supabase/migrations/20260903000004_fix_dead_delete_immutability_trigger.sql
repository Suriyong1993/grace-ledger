-- ==============================================================================
-- Grace Ledger — Migration: Fix dead DELETE-immutability trigger branch
-- Target: PostgreSQL 17 / Supabase
-- Description:
--   fn_validate_transaction_split_lifecycle() has always contained a
--   TG_OP = 'DELETE' guard that raises on deleting a non-draft transaction,
--   but trg_validate_transaction_status was wired BEFORE UPDATE only —
--   the DELETE branch has never once fired. RLS (p_transactions_delete)
--   independently and correctly restricts DELETE to status='draft' for
--   ordinary app users, so this was not exploitable through the app; it
--   only left service-role/superuser direct DB access without the
--   trigger-level backstop the function's own logic implies it has.
--
--   Rewires the trigger to BEFORE UPDATE OR DELETE. A bare `RETURN NEW` is
--   wrong for a DELETE trigger — NEW is always NULL on DELETE, and a
--   BEFORE DELETE trigger returning NULL silently cancels the delete with
--   no error — so every delete, including legitimate draft deletes, would
--   have silently no-op'ed. Branches to `RETURN OLD` for TG_OP = 'DELETE'
--   instead. No other logic changes; UPDATE behavior is unchanged.
-- ==============================================================================

CREATE OR REPLACE FUNCTION fn_validate_transaction_split_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_split_total NUMERIC(14,2);
  v_split_count INTEGER;
BEGIN
  -- 1. Lock down rejected & voided transactions completely
  IF (TG_OP = 'UPDATE' AND OLD.status = 'rejected') THEN
    RAISE EXCEPTION 'Immutable Ledger: Rejected transactions are permanently locked and cannot be modified.';
  END IF;

  IF (TG_OP = 'DELETE' AND OLD.status IN ('rejected', 'voided', 'posted', 'approved', 'pending_approval')) THEN
    RAISE EXCEPTION 'Immutable Ledger: Transactions in state % cannot be deleted.', OLD.status;
  END IF;

  -- 2. Validate split sum parity on transition from draft to any advanced state
  IF (TG_OP = 'UPDATE' AND NEW.status IN ('pending_approval', 'approved', 'posted') AND OLD.status = 'draft') THEN
    SELECT COALESCE(SUM(amount), 0), COUNT(*)
    INTO v_split_total, v_split_count
    FROM transaction_splits
    WHERE transaction_id = NEW.id;

    IF v_split_count = 0 THEN
      RAISE EXCEPTION 'Transaction split validation failed: Transaction must have at least one split.';
    END IF;

    IF v_split_total <> NEW.amount THEN
      RAISE EXCEPTION 'Transaction split validation failed: Sum of splits (฿%) does not match transaction amount (฿%).', v_split_total, NEW.amount;
    END IF;
  END IF;

  -- 3. Protect non-draft transactions from direct modification of core financial fields
  IF (TG_OP = 'UPDATE' AND OLD.status IN ('pending_approval', 'approved', 'posted', 'voided', 'rejected')) THEN
    -- Allow revision request (pending_approval -> draft) or terminal reject (pending_approval -> rejected) or approve (pending_approval -> approved)
    IF NOT (OLD.status = 'pending_approval' AND NEW.status IN ('draft', 'rejected', 'approved')) THEN
      IF (NEW.amount <> OLD.amount OR NEW.account_id <> OLD.account_id OR NEW.direction <> OLD.direction) THEN
        RAISE EXCEPTION 'Immutable Ledger: Financial attributes of % transactions cannot be modified directly.', OLD.status;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_transaction_status ON transactions;
CREATE TRIGGER trg_validate_transaction_status
  BEFORE UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION fn_validate_transaction_split_lifecycle();
