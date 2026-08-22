-- =====================================================================
-- Migration 014: Server/Database-Enforced Financial Idempotency (Hardened v3)
-- Architecture Decision: Option A (church_id + user_id + idempotency_key)
-- Strict In-Flight Concurrency Protection (Fail-Closed, Zero Blind Takeover)
-- =====================================================================

-- 1. Create idempotency status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'idempotency_status_enum') THEN
    CREATE TYPE idempotency_status_enum AS ENUM ('started', 'completed', 'failed');
  END IF;
END $$;

-- 2. Create idempotency_keys table with Option A User Scope
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status idempotency_status_enum NOT NULL DEFAULT 'started',
  response_body JSONB,
  resource_id UUID,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT uq_church_user_idempotency_key UNIQUE (church_id, user_id, idempotency_key),
  CONSTRAINT chk_idempotency_key_non_empty CHECK (length(trim(idempotency_key)) > 0),
  CONSTRAINT chk_payload_hash_non_empty CHECK (length(trim(payload_hash)) > 0),
  CONSTRAINT chk_operation_non_empty CHECK (length(trim(operation)) > 0)
);

-- 3. Indexes for fast lookup and TTL cleanup
CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON idempotency_keys(church_id, user_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- 4. Enable RLS on idempotency_keys
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

-- 5. Strict Zero-Trust RLS Policies (Option A: User-Isolated Access)
CREATE POLICY p_idempotency_select ON idempotency_keys
  FOR SELECT
  USING (
    (user_id = auth.uid() AND has_church_access(church_id, 'finance_staff')) OR
    current_user_has_role('super_admin')
  );

CREATE POLICY p_idempotency_insert ON idempotency_keys
  FOR INSERT WITH CHECK (false);

CREATE POLICY p_idempotency_update ON idempotency_keys
  FOR UPDATE USING (false) WITH CHECK (false);

CREATE POLICY p_idempotency_delete ON idempotency_keys
  FOR DELETE USING (false);

-- 6. RPC: acquire_idempotency_record
-- Strict fail-closed semantics:
-- - 'completed' -> Replay
-- - 'started'   -> REJECT with 40001 (In-flight concurrent request; zero blind takeover)
-- - 'failed'    -> Allow Retry (Reset to 'started')
CREATE OR REPLACE FUNCTION acquire_idempotency_record(
  p_church_id UUID,
  p_idempotency_key TEXT,
  p_operation TEXT,
  p_payload_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_existing RECORD;
BEGIN
  -- 1. Authenticate caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not authenticated' USING ERRCODE = '28000';
  END IF;

  -- 2. Validate church tenant access
  IF NOT has_church_access(p_church_id, 'finance_staff') THEN
    RAISE EXCEPTION 'Access Denied: User does not have access to church %', p_church_id USING ERRCODE = '42501';
  END IF;

  -- 3. Validate inputs
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'Invalid Idempotency Key: key cannot be empty' USING ERRCODE = '22023';
  END IF;

  IF p_payload_hash IS NULL OR length(trim(p_payload_hash)) = 0 THEN
    RAISE EXCEPTION 'Invalid Payload Hash: hash cannot be empty' USING ERRCODE = '22023';
  END IF;

  -- 4. Attempt to insert new record
  BEGIN
    INSERT INTO idempotency_keys (
      church_id,
      user_id,
      idempotency_key,
      operation,
      payload_hash,
      status,
      created_at,
      expires_at
    ) VALUES (
      p_church_id,
      v_user_id,
      trim(p_idempotency_key),
      trim(p_operation),
      trim(p_payload_hash),
      'started',
      now(),
      now() + interval '24 hours'
    );

    RETURN jsonb_build_object(
      'action', 'execute',
      'idempotency_key', p_idempotency_key
    );

  EXCEPTION WHEN unique_violation THEN
    -- Conflict on (church_id, user_id, idempotency_key): lock row and inspect
    SELECT * INTO v_existing
    FROM idempotency_keys
    WHERE church_id = p_church_id AND user_id = v_user_id AND idempotency_key = trim(p_idempotency_key)
    FOR UPDATE;

    -- A. Verify Payload and Operation binding
    IF v_existing.payload_hash <> trim(p_payload_hash) OR v_existing.operation <> trim(p_operation) THEN
      RAISE EXCEPTION 'Idempotency Conflict: Same idempotency key used with different payload or operation' USING ERRCODE = 'P0001';
    END IF;

    -- B. Handle based on explicit state
    IF v_existing.status = 'completed' THEN
      -- Replay cached result
      RETURN jsonb_build_object(
        'action', 'replay',
        'is_replay', true,
        'response_body', v_existing.response_body,
        'resource_id', v_existing.resource_id
      );
    ELSIF v_existing.status = 'started' THEN
      -- Request is actively in-flight: REJECT to prevent duplicate concurrent mutation
      RAISE EXCEPTION 'Concurrent Request: An identical request with this idempotency key is currently processing' USING ERRCODE = '40001';
    ELSIF v_existing.status = 'failed' THEN
      -- Explicitly marked failed: Reset to started to permit clean retry
      UPDATE idempotency_keys
      SET
        status = 'started',
        response_body = NULL,
        resource_id = NULL,
        error_message = NULL,
        created_at = now(),
        expires_at = now() + interval '24 hours'
      WHERE id = v_existing.id;

      RETURN jsonb_build_object(
        'action', 'execute',
        'idempotency_key', p_idempotency_key,
        'is_retry', true
      );
    END IF;
  END;
END;
$$;

-- 7. RPC: complete_idempotency_record
CREATE OR REPLACE FUNCTION complete_idempotency_record(
  p_church_id UUID,
  p_idempotency_key TEXT,
  p_response_body JSONB,
  p_resource_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE idempotency_keys
  SET
    status = 'completed',
    response_body = p_response_body,
    resource_id = p_resource_id,
    error_message = NULL
  WHERE church_id = p_church_id AND user_id = v_user_id AND idempotency_key = trim(p_idempotency_key);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Idempotency Key Not Found for church % and user %', p_church_id, v_user_id USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- 8. RPC: mark_idempotency_failed
-- Explicitly transitions a started idempotency record to 'failed' on error
CREATE OR REPLACE FUNCTION mark_idempotency_failed(
  p_church_id UUID,
  p_idempotency_key TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE idempotency_keys
  SET
    status = 'failed',
    error_message = p_error_message
  WHERE church_id = p_church_id AND user_id = v_user_id AND idempotency_key = trim(p_idempotency_key);
END;
$$;

-- 9. Upgraded Atomic Idempotent transfer_funds RPC
-- Check + Mutation + Idempotency Record occur in a SINGLE ATOMIC TRANSACTION
CREATE OR REPLACE FUNCTION transfer_funds(
  p_church_id UUID,
  p_from_fund_id UUID,
  p_to_fund_id UUID,
  p_amount NUMERIC(14,2),
  p_note TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transfer_id UUID;
  v_from_balance NUMERIC(14,2);
  v_from_fund_church UUID;
  v_to_fund_church UUID;
  v_payload_hash TEXT;
  v_existing RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not authenticated.' USING ERRCODE = '28000';
  END IF;

  -- 1. Authorization check
  IF NOT has_church_access(p_church_id, 'treasurer') THEN
    RAISE EXCEPTION 'Unauthorized: Only treasurers or administrators may transfer funds.' USING ERRCODE = '42501';
  END IF;

  -- 2. Domain validations
  IF p_from_fund_id = p_to_fund_id THEN
    RAISE EXCEPTION 'Invalid Transfer: Source fund and destination fund must be different.' USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid Transfer: Transfer amount must be strictly greater than zero.' USING ERRCODE = '22023';
  END IF;

  -- 3. Idempotency handling within single transaction
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    v_payload_hash := md5(p_church_id::text || ':' || p_from_fund_id::text || ':' || p_to_fund_id::text || ':' || p_amount::text || ':' || coalesce(p_note, ''));

    SELECT * INTO v_existing
    FROM idempotency_keys
    WHERE church_id = p_church_id AND user_id = v_user_id AND idempotency_key = trim(p_idempotency_key)
    FOR UPDATE;

    IF FOUND THEN
      IF v_existing.payload_hash <> v_payload_hash THEN
        RAISE EXCEPTION 'Idempotency Conflict: Same idempotency key used with different parameters' USING ERRCODE = 'P0001';
      END IF;

      IF v_existing.status = 'completed' THEN
        -- Return already completed transfer_id directly
        RETURN v_existing.resource_id;
      END IF;
    END IF;
  END IF;

  -- 4. Verify funds and acquire row locks
  SELECT church_id, current_balance 
  INTO v_from_fund_church, v_from_balance 
  FROM funds 
  WHERE id = p_from_fund_id AND is_active = true 
  FOR UPDATE;

  IF v_from_fund_church IS NULL OR v_from_fund_church <> p_church_id THEN
    RAISE EXCEPTION 'Invalid Transfer: Source fund does not exist or does not belong to church.' USING ERRCODE = '22023';
  END IF;

  SELECT church_id INTO v_to_fund_church 
  FROM funds 
  WHERE id = p_to_fund_id AND is_active = true 
  FOR UPDATE;

  IF v_to_fund_church IS NULL OR v_to_fund_church <> p_church_id THEN
    RAISE EXCEPTION 'Invalid Transfer: Destination fund does not exist or does not belong to church.' USING ERRCODE = '22023';
  END IF;

  -- 5. Check available balance
  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient Funds: Source fund balance (฿%) is less than requested transfer (฿%).', v_from_balance, p_amount USING ERRCODE = '22023';
  END IF;

  -- 6. Insert transfer record
  INSERT INTO fund_transfers (
    church_id, from_fund_id, to_fund_id, amount, note, status, created_by
  ) VALUES (
    p_church_id, p_from_fund_id, p_to_fund_id, p_amount, p_note, 'completed', v_user_id
  ) RETURNING id INTO v_transfer_id;

  -- 7. Update fund balances atomically
  UPDATE funds SET current_balance = current_balance - p_amount, updated_at = now() WHERE id = p_from_fund_id;
  UPDATE funds SET current_balance = current_balance + p_amount, updated_at = now() WHERE id = p_to_fund_id;

  -- 8. Record audit log entry
  INSERT INTO audit_logs (
    church_id, actor_id, action, category, entity_type, entity_id, before_state, after_state, metadata
  ) VALUES (
    p_church_id,
    v_user_id,
    'FUND_TRANSFER',
    'FINANCIAL',
    'fund_transfers',
    v_transfer_id,
    jsonb_build_object('from_fund_balance', v_from_balance),
    jsonb_build_object('from_fund_balance', v_from_balance - p_amount),
    jsonb_build_object('amount', p_amount, 'from_fund_id', p_from_fund_id, 'to_fund_id', p_to_fund_id, 'idempotency_key', p_idempotency_key)
  );

  -- 9. Persist completed idempotency record if key provided
  IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
    INSERT INTO idempotency_keys (
      church_id, user_id, idempotency_key, operation, payload_hash, status, resource_id, response_body
    ) VALUES (
      p_church_id, v_user_id, trim(p_idempotency_key), 'transfer_funds', v_payload_hash, 'completed', v_transfer_id, jsonb_build_object('transfer_id', v_transfer_id)
    )
    ON CONFLICT (church_id, user_id, idempotency_key)
    DO UPDATE SET
      status = 'completed',
      resource_id = v_transfer_id,
      response_body = jsonb_build_object('transfer_id', v_transfer_id);
  END IF;

  RETURN v_transfer_id;
END;
$$;
