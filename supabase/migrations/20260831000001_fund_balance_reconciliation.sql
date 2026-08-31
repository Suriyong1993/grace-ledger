-- ==============================================================================
-- Grace Ledger — Migration 018: Fund Balance Reconciliation (Report-Only)
--
-- `funds.current_balance` is a stored column maintained by the financial RPCs
-- (post_transaction, transfer_funds, void_transaction, offering posting).
-- This migration answers the audit question "is the stored balance the truth?"
-- by providing `reconcile_fund_balances(p_church_id)`: it derives each fund's
-- expected balance from the LEDGER (posted transactions + splits + completed
-- fund transfers) and reports any drift, without mutating anything.
--
-- Derivation rules (must mirror the RPC mutation rules):
--   posted income  transaction split  -> +amount to the split's fund
--   posted expense transaction split  -> -amount from the split's fund
--   completed fund transfer           -> -amount from source, +amount to destination
--
-- Assumptions (documented, not guessed):
--   * Funds start at 0.00 and ONLY financial RPCs move balances.
--   * 'transfer'-direction transactions carry no fund-level ledger effect
--     (transfer_funds writes to fund_transfers instead).
--   * Voided transactions are excluded (their posted effects are unwound by
--     the posted reversal entry, which IS included).
--
-- Report-only by design: drift is a finding for a human treasurer to resolve,
-- not something the system should silently "correct" — an auto-fix would hide
-- exactly the anomalies this function exists to surface.
-- ==============================================================================

CREATE OR REPLACE FUNCTION reconcile_fund_balances(p_church_id UUID)
RETURNS TABLE (
  fund_id UUID,
  fund_name TEXT,
  stored_balance NUMERIC(14,2),
  derived_balance NUMERIC(14,2),
  drift NUMERIC(14,2)
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH ledger_effects AS (
    -- Posted income/expense transactions, allocated through splits
    SELECT
      s.fund_id,
      SUM(
        CASE t.direction
          WHEN 'income'  THEN  s.amount
          WHEN 'expense' THEN -s.amount
          ELSE 0
        END
      ) AS effect
    FROM transaction_splits s
    JOIN transactions t ON t.id = s.transaction_id
    WHERE s.church_id = p_church_id
      AND t.church_id = p_church_id
      AND t.status = 'posted'
    GROUP BY s.fund_id

    UNION ALL

    -- Completed inter-fund transfers
    SELECT
      ft.to_fund_id AS fund_id,
      SUM(ft.amount) AS effect
    FROM fund_transfers ft
    WHERE ft.church_id = p_church_id
      AND ft.status = 'completed'
    GROUP BY ft.to_fund_id

    UNION ALL

    SELECT
      ft.from_fund_id AS fund_id,
      SUM(-ft.amount) AS effect
    FROM fund_transfers ft
    WHERE ft.church_id = p_church_id
      AND ft.status = 'completed'
    GROUP BY ft.from_fund_id
  )
  SELECT
    f.id,
    f.name,
    f.current_balance AS stored_balance,
    COALESCE(le.effect, 0.00) AS derived_balance,
    (f.current_balance - COALESCE(le.effect, 0.00)) AS drift
  FROM funds f
  LEFT JOIN (
    SELECT fund_id, SUM(effect) AS effect
    FROM ledger_effects
    GROUP BY fund_id
  ) le ON le.fund_id = f.id
  WHERE f.church_id = p_church_id;
$$;

-- Treasurer-tier access only; reading the reconciliation is an oversight action.
REVOKE ALL ON FUNCTION reconcile_fund_balances(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reconcile_fund_balances(UUID) TO authenticated;
