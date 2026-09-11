-- ==============================================================================
-- Grace Ledger — Migration: Ledger immutability hardening
-- Target: PostgreSQL 17 / Supabase
--
-- AUDIT 2026-09-11. Four defects, each REPRODUCED against a real PostgreSQL 17
-- instance (scripts/pg-lab.mjs + tests/integration/ledger-immutability.real-pg
-- .test.ts) before this migration existed, and each re-verified after.
--
-- The client is not the security boundary, so none of these were blocked by
-- RLS or by the client-side guards in transactions-service.ts /
-- funds-service.ts. Any treasurer-role session — a compromised browser, a raw
-- PostgREST PATCH, a script using a legitimately issued JWT — could do all of
-- it. Everything below was recorded by the CDC audit trigger, so it is
-- forensically traceable; it was simply not prevented.
--
-- F1 (CRITICAL) funds.current_balance was directly writable.
--      `UPDATE funds SET current_balance = 999999999.99` succeeded for any
--      treasurer, fabricating a fund balance with no ledger entry behind it.
--      p_funds_manage is FOR ALL USING has_church_access(..,'treasurer') and
--      funds had only an AFTER audit trigger (records, never blocks).
--      This also breaks the invariant reconcile_fund_balances() documents:
--      "Funds start at 0.00 and ONLY financial RPCs move balances."
--
-- F2 (CRITICAL) accounts.current_balance — same defect, same cause
--      (p_accounts_manage FOR ALL, only trg_audit_accounts after it).
--
-- F3 (CRITICAL) transactions.status was not guarded at all.
--      fn_validate_transaction_split_lifecycle() protects amount / account_id /
--      direction on non-draft rows and locks 'rejected', but it never constrains
--      the status column itself. Confirmed for a POSTED transaction:
--        posted -> draft     succeeded
--        posted -> voided    succeeded, WITHOUT the reversing mirror entry that
--                            void_transaction() writes and WITHOUT unwinding the
--                            fund/account balances -> silent loss of money
--                            conservation
--        posted -> rejected  succeeded, bypassing reject_transaction_terminal()
--      Chained with RLS p_transactions_delete (USING status='draft'), posted ->
--      draft -> DELETE destroyed a posted financial record and CASCADEd its
--      splits. That is the loss of immutable financial history.
--
-- F4 (HIGH) every non-financial column of a POSTED transaction was writable:
--      description, metadata, posted_at, approved_by, created_by,
--      reference_number, transaction_date. Rewriting posted_at falsifies which
--      accounting period a posted entry lands in (reports-service and the
--      historical summaries read it); rewriting approved_by falsifies who
--      authorised the payment and defeats the Two-Person Rule's evidence.
--
-- DESIGN — follows the pattern migration 20260903000000_split_immutability_guard
-- .sql already established, so the exemption semantics are identical to the
-- split guard's and are already proven by the Phase 2B suite:
--
--   * The trigger functions stay SECURITY INVOKER and exempt any current_user
--     that is not 'authenticated'/'anon'. Every function that legitimately
--     writes these columns (post_transaction, approve_transaction,
--     submit_transaction, reject_transaction[_terminal],
--     request_transaction_revision, void_transaction, transfer_funds,
--     post_offering_to_ledger, execute_confirmed_financial_action) is
--     SECURITY DEFINER owned by postgres — verified against pg_proc — so it
--     runs as a non-end-user current_user and keeps working untouched.
--     service_role stays exempt too, exactly as in the split guard.
--   * Status transitions are NEVER written directly by an end user, in any
--     state, including draft -> pending_approval. The RPCs are the only door,
--     which keeps the Two-Person Rule, split-parity and balance effects
--     attached to every transition.
--   * A non-draft transaction is read-only for end users: any UPDATE at all is
--     rejected rather than a per-column allowlist, so a column added later
--     cannot silently become writable.
--
-- Backwards compatible and additive:
--   * No existing migration, function, policy, trigger or column is modified.
--   * No data is touched. Rows already falsified by F1-F4 are NOT rewritten —
--     silently altering historical financial data is exactly what this
--     migration exists to prevent. Use reconcile_fund_balances(p_church_id) to
--     list balance drift for a human treasurer to resolve, and read the
--     audit_logs CDC trail (before_state/after_state) for the rest.
--   * The application never writes these columns from the client:
--     funds-service.ts UpdateFundSchema allows only name / description /
--     target_amount / is_active and createFund() inserts current_balance
--     "0.00"; transactions-service.ts updateTransaction() refuses any status
--     other than 'draft' and sends only description / transaction_date /
--     account_id / amount; nothing in src/ writes accounts at all. So no
--     working feature is removed.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. F1 + F2 — balances move only through the financial RPCs
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_enforce_balance_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Server-side definer / service contexts are the only sanctioned writers of
  -- a stored balance (post_transaction, transfer_funds, void_transaction,
  -- post_offering_to_ledger). Mirrors fn_enforce_split_immutability().
  IF current_user NOT IN ('authenticated', 'anon') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  -- DELETE is deliberately left alone: a fund or account that still carries
  -- ledger entries is already protected by its ON DELETE RESTRICT foreign
  -- keys, and removing a never-used record is legitimate treasurer
  -- housekeeping that p_funds_manage / p_accounts_manage grant on purpose.
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A new fund/account always starts at zero. An opening balance is a
    -- ledger event, not a typed number: it must arrive as a posted
    -- transaction (or be set by an administrator through service_role).
    IF NEW.current_balance <> 0 THEN
      RAISE EXCEPTION
        'Immutable Ledger: % must be created with a zero balance; record an opening balance as a posted transaction instead.',
        TG_TABLE_NAME
        USING ERRCODE = 'GL007';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.current_balance IS DISTINCT FROM OLD.current_balance THEN
    RAISE EXCEPTION
      'Immutable Ledger: %.current_balance (฿% -> ฿%) is derived from the ledger and cannot be written directly; post, void or transfer through the financial RPCs.',
      TG_TABLE_NAME, OLD.current_balance, NEW.current_balance
      USING ERRCODE = 'GL007';
  END IF;

  -- Re-parenting a balance-bearing record to another church would move money
  -- across the tenant boundary even though the amount never changed.
  IF NEW.church_id IS DISTINCT FROM OLD.church_id THEN
    RAISE EXCEPTION
      'Immutable Ledger: %.church_id cannot be changed; balances belong to the church that recorded them.',
      TG_TABLE_NAME
      USING ERRCODE = 'GL007';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_fund_balance_immutability ON funds;
CREATE TRIGGER trg_enforce_fund_balance_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON funds
  FOR EACH ROW
  EXECUTE FUNCTION fn_enforce_balance_immutability();

DROP TRIGGER IF EXISTS trg_enforce_account_balance_immutability ON accounts;
CREATE TRIGGER trg_enforce_account_balance_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION fn_enforce_balance_immutability();

-- ------------------------------------------------------------------------------
-- 2. F3 + F4 — a transaction's lifecycle and its final state are RPC-only
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_enforce_transaction_ledger_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- RLS (p_transactions_delete) already limits end-user deletes to drafts;
    -- this is the backstop for the posted -> draft -> DELETE chain in F3 and
    -- for any future widening of that policy.
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION
        'Immutable Ledger: a % transaction cannot be deleted; reverse it with void_transaction() so the correcting entry stays on the ledger.',
        OLD.status
        USING ERRCODE = 'GL006';
    END IF;
    RETURN OLD;
  END IF;

  -- F3: status is written only by the lifecycle RPCs, in every state. Each of
  -- them carries the authorization, Two-Person Rule, split-parity and balance
  -- effects that a bare UPDATE silently drops.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION
      'Immutable Ledger: transaction status cannot be changed directly (% -> %); use submit_transaction, approve_transaction, request_transaction_revision, reject_transaction_terminal, post_transaction or void_transaction.',
      OLD.status, NEW.status
      USING ERRCODE = 'GL005';
  END IF;

  -- F4: once a transaction leaves draft it is a final accounting record.
  -- Rejecting any UPDATE (not a per-column allowlist) keeps this true for
  -- columns added later.
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION
      'Immutable Ledger: a % transaction is final and cannot be edited; reverse it with void_transaction() and post a correction.',
      OLD.status
      USING ERRCODE = 'GL006';
  END IF;

  -- Draft rows stay fully editable, but the tenant anchor never moves.
  IF NEW.church_id IS DISTINCT FROM OLD.church_id THEN
    RAISE EXCEPTION
      'Immutable Ledger: transactions.church_id cannot be changed.'
      USING ERRCODE = 'GL006';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_transaction_ledger_immutability ON transactions;
CREATE TRIGGER trg_enforce_transaction_ledger_immutability
  BEFORE UPDATE OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION fn_enforce_transaction_ledger_immutability();
