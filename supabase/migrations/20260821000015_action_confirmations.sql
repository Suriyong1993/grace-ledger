-- =====================================================================
-- Migration 015: Server-Backed Action Confirmations & Canonical Security
-- Enforces Strict Human Confirmation Boundary Before Financial Execution
-- =====================================================================

-- 1. Create confirmation status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'confirmation_status_enum') THEN
    CREATE TYPE confirmation_status_enum AS ENUM ('pending', 'consumed', 'expired', 'cancelled');
  END IF;
END $$;

-- 2. Create action_confirmations table
CREATE TABLE IF NOT EXISTS action_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  resource_id UUID,
  normalized_parameters JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  nonce TEXT NOT NULL,
  status confirmation_status_enum NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at TIMESTAMPTZ,
  consumed_by UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  CONSTRAINT uq_action_confirmation_nonce UNIQUE (church_id, nonce),
  CONSTRAINT chk_payload_hash_len CHECK (length(trim(payload_hash)) = 64),
  CONSTRAINT chk_nonce_non_empty CHECK (length(trim(nonce)) >= 16),
  CONSTRAINT chk_action_non_empty CHECK (length(trim(action)) > 0),
  CONSTRAINT chk_tool_name_non_empty CHECK (length(trim(tool_name)) > 0)
);

-- 3. Indexes for fast lookup and TTL cleanup
CREATE INDEX IF NOT EXISTS idx_confirmations_lookup ON action_confirmations(church_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_confirmations_expires ON action_confirmations(expires_at);

-- 4. Enable RLS on action_confirmations
ALTER TABLE action_confirmations ENABLE ROW LEVEL SECURITY;

-- 5. Strict Zero-Trust RLS Policies
CREATE POLICY p_confirmations_select ON action_confirmations
  FOR SELECT
  USING (
    (user_id = auth.uid() AND has_church_access(church_id, 'finance_staff')) OR
    current_user_has_role('super_admin')
  );

CREATE POLICY p_confirmations_insert ON action_confirmations
  FOR INSERT WITH CHECK (false);

CREATE POLICY p_confirmations_update ON action_confirmations
  FOR UPDATE USING (false) WITH CHECK (false);

CREATE POLICY p_confirmations_delete ON action_confirmations
  FOR DELETE USING (false);

-- 6. RPC: create_action_confirmation
-- Creates a single-use, server-timed confirmation record
CREATE OR REPLACE FUNCTION create_action_confirmation(
  p_church_id UUID,
  p_action TEXT,
  p_tool_name TEXT,
  p_resource_id UUID,
  p_normalized_parameters JSONB,
  p_payload_hash TEXT,
  p_nonce TEXT,
  p_ttl_seconds INTEGER DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_confirmation_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_ttl_seconds INTEGER;
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

  -- 3. Validate Inputs
  IF p_action IS NULL OR length(trim(p_action)) = 0 THEN
    RAISE EXCEPTION 'Invalid Action: action cannot be empty' USING ERRCODE = '22023';
  END IF;

  IF p_tool_name IS NULL OR length(trim(p_tool_name)) = 0 THEN
    RAISE EXCEPTION 'Invalid Tool Name: tool_name cannot be empty' USING ERRCODE = '22023';
  END IF;

  IF p_payload_hash IS NULL OR length(trim(p_payload_hash)) <> 64 THEN
    RAISE EXCEPTION 'Invalid Payload Hash: hash must be 64-char SHA-256 string' USING ERRCODE = '22023';
  END IF;

  IF p_nonce IS NULL OR length(trim(p_nonce)) < 16 THEN
    RAISE EXCEPTION 'Invalid Nonce: nonce must be at least 16 characters' USING ERRCODE = '22023';
  END IF;

  -- Bounded TTL: Minimum 30s, Maximum 600s (Default 300s / 5 minutes)
  v_ttl_seconds := GREATEST(30, LEAST(coalesce(p_ttl_seconds, 300), 600));
  v_expires_at := now() + (v_ttl_seconds || ' seconds')::interval;

  -- 4. Insert confirmation record
  INSERT INTO action_confirmations (
    church_id,
    user_id,
    action,
    tool_name,
    resource_id,
    normalized_parameters,
    payload_hash,
    nonce,
    status,
    expires_at,
    created_at
  ) VALUES (
    p_church_id,
    v_user_id,
    trim(p_action),
    trim(p_tool_name),
    p_resource_id,
    p_normalized_parameters,
    trim(p_payload_hash),
    trim(p_nonce),
    'pending',
    v_expires_at,
    now()
  ) RETURNING id INTO v_confirmation_id;

  RETURN jsonb_build_object(
    'confirmation_id', v_confirmation_id,
    'expires_at', v_expires_at,
    'nonce', p_nonce
  );
END;
$$;

-- 7. RPC: consume_action_confirmation
-- Atomically validates and consumes the confirmation record with row-level locking
CREATE OR REPLACE FUNCTION consume_action_confirmation(
  p_confirmation_id UUID,
  p_church_id UUID,
  p_expected_payload_hash TEXT,
  p_expected_nonce TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_conf RECORD;
BEGIN
  -- 1. Authenticate caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not authenticated' USING ERRCODE = '28000';
  END IF;

  -- 2. Acquire Row Lock on the confirmation record
  SELECT * INTO v_conf
  FROM action_confirmations
  WHERE id = p_confirmation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Confirmation Not Found: Invalid confirmation token' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Validate Tenant Isolation
  IF v_conf.church_id <> p_church_id THEN
    RAISE EXCEPTION 'Cross-Tenant Access Denied: Confirmation token belongs to another church' USING ERRCODE = '42501';
  END IF;

  -- 4. Validate User Isolation
  IF v_conf.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Cross-User Access Denied: Confirmation token belongs to another user' USING ERRCODE = '42501';
  END IF;

  -- 5. Validate Status (Must be 'pending')
  IF v_conf.status = 'consumed' THEN
    RAISE EXCEPTION 'Confirmation Already Consumed: This confirmation token has already been used' USING ERRCODE = 'P0003';
  END IF;

  IF v_conf.status = 'expired' OR v_conf.status = 'cancelled' THEN
    RAISE EXCEPTION 'Confirmation Inactive: This confirmation token is %', v_conf.status USING ERRCODE = 'P0004';
  END IF;

  -- 6. Server-Side TTL Check (PostgreSQL Clock is source of truth)
  IF v_conf.expires_at <= now() THEN
    UPDATE action_confirmations SET status = 'expired' WHERE id = p_confirmation_id;
    RAISE EXCEPTION 'Confirmation Expired: The confirmation token has expired at %', v_conf.expires_at USING ERRCODE = 'P0004';
  END IF;

  -- 7. Nonce Mismatch Check
  IF v_conf.nonce <> trim(p_expected_nonce) THEN
    RAISE EXCEPTION 'Nonce Mismatch: Invalid confirmation security nonce' USING ERRCODE = 'P0005';
  END IF;

  -- 8. Payload Hash Verification (Tamper Protection)
  IF v_conf.payload_hash <> trim(p_expected_payload_hash) THEN
    RAISE EXCEPTION 'Payload Hash Mismatch: Action parameters have been altered or tampered' USING ERRCODE = 'P0006';
  END IF;

  -- 9. Atomic State Transition: pending -> consumed
  UPDATE action_confirmations
  SET
    status = 'consumed',
    consumed_at = now(),
    consumed_by = v_user_id
  WHERE id = p_confirmation_id;

  RETURN jsonb_build_object(
    'status', 'consumed',
    'confirmation_id', v_conf.id,
    'action', v_conf.action,
    'tool_name', v_conf.tool_name,
    'resource_id', v_conf.resource_id,
    'normalized_parameters', v_conf.normalized_parameters,
    'consumed_at', now()
  );
END;
$$;
