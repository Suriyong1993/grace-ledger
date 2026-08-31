-- ==============================================================================
-- Grace Ledger — Migration 017: Two-Person Rule on Direct Posting
--
-- Closes the segregation-of-duties gap in `post_transaction`: previously a
-- treasurer could post their OWN draft directly (`draft -> posted`), bypassing
-- approval entirely. Direct posting itself remains available for treasurers
-- (per docs/M2_PHASE_2_UI_CONTRACT.md), but never for the draft's creator —
-- a second person must now review the draft, either by approving it or by
-- performing the direct post. Mirrors TransactionLifecycle in
-- src/lib/transactions/lifecycle.ts; enforced here because the database is
-- the final, unbypassable security boundary.
--
-- Also flags direct posts in the audit trail
-- (`APPROVAL_BYPASS: DIRECT_POST_BY_TREASURER` safeguard from the UI contract)
-- so monthly elder oversight reports can distinguish them from approved posts.
-- ==============================================================================

CREATE OR REPLACE FUNCTION post_transaction(p_transaction_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_txn transactions%ROWTYPE;
  v_split_sum NUMERIC(14,2);
  v_account accounts%ROWTYPE;
  v_is_direct_post BOOLEAN;
BEGIN
  -- 1. Fetch and lock transaction
  SELECT * INTO v_txn FROM transactions WHERE id = p_transaction_id FOR UPDATE;

  IF v_txn.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  -- 2. Authorize caller (Treasurer or Admin only)
  IF NOT has_church_access(v_txn.church_id, 'treasurer') THEN
    RAISE EXCEPTION 'Unauthorized: Only treasurers or administrators may post transactions to the ledger.';
  END IF;

  -- 3. Verify status (Must be approved, or draft if direct posting by treasurer with valid splits)
  IF v_txn.status NOT IN ('approved', 'draft') THEN
    RAISE EXCEPTION 'Invalid State Transition: Only approved transactions (or draft by treasurer) can be posted (current status: %).', v_txn.status;
  END IF;

  -- 3b. TWO-PERSON RULE on direct posting (Segregation of Duties):
  -- the creator of a draft cannot bypass approval by posting it themselves.
  -- Someone other than the creator must review the draft first (approve it)
  -- or perform the direct post.
  v_is_direct_post := (v_txn.status = 'draft');
  IF v_is_direct_post AND v_txn.created_by = auth.uid() THEN
    RAISE EXCEPTION 'Segregation of Duties Violation: The creator of a draft cannot directly post it. Submit it for approval instead.';
  END IF;

  -- 4. Verify split sum matches amount
  SELECT COALESCE(SUM(amount), 0) INTO v_split_sum
  FROM transaction_splits
  WHERE transaction_id = p_transaction_id;

  IF v_split_sum <> v_txn.amount THEN
    RAISE EXCEPTION 'Integrity Error: Split sum (฿%) does not match transaction amount (฿%).', v_split_sum, v_txn.amount;
  END IF;

  -- 5. Lock account
  SELECT * INTO v_account FROM accounts WHERE id = v_txn.account_id FOR UPDATE;
  IF v_account.id IS NULL OR v_account.church_id <> v_txn.church_id THEN
    RAISE EXCEPTION 'Invalid Account: Transaction account does not belong to church.';
  END IF;

  -- 6. Lock and mutate fund balances & account balance
  IF v_txn.direction = 'income' THEN
    -- Credit Account
    UPDATE accounts
    SET current_balance = current_balance + v_txn.amount, updated_at = now()
    WHERE id = v_txn.account_id;

    -- Credit Funds
    UPDATE funds f
    SET current_balance = f.current_balance + s.split_sum, updated_at = now()
    FROM (
      SELECT fund_id, SUM(amount) AS split_sum
      FROM transaction_splits
      WHERE transaction_id = p_transaction_id
      GROUP BY fund_id
    ) s
    WHERE f.id = s.fund_id;

  ELSIF v_txn.direction = 'expense' THEN
    -- Debit Account
    UPDATE accounts
    SET current_balance = current_balance - v_txn.amount, updated_at = now()
    WHERE id = v_txn.account_id;

    -- Debit Funds
    UPDATE funds f
    SET current_balance = f.current_balance - s.split_sum, updated_at = now()
    FROM (
      SELECT fund_id, SUM(amount) AS split_sum
      FROM transaction_splits
      WHERE transaction_id = p_transaction_id
      GROUP BY fund_id
    ) s
    WHERE f.id = s.fund_id;
  END IF;

  -- 7. Update transaction status to posted
  UPDATE transactions
  SET
    status = 'posted',
    posted_at = now(),
    updated_at = now()
  WHERE id = p_transaction_id;

  -- 8. Record FINANCIAL audit log
  -- Direct posts carry the APPROVAL_BYPASS flag required by
  -- docs/M2_PHASE_2_UI_CONTRACT.md so oversight reports can surface them.
  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_txn.church_id, 'FINANCIAL', auth.uid(), 'POST_TRANSACTION', 'transactions', p_transaction_id,
    jsonb_build_object(
      'amount', v_txn.amount,
      'direction', v_txn.direction,
      'account_id', v_txn.account_id,
      'posted_at', now(),
      'direct_post', v_is_direct_post,
      'approval_bypass', CASE WHEN v_is_direct_post THEN 'DIRECT_POST_BY_TREASURER' ELSE NULL END
    )
  );

  RETURN p_transaction_id;
END;
$$;
