-- ==============================================================================
-- Grace Ledger — Migration 020: PIN Authentication Foundation
-- Target: PostgreSQL 17 / Supabase
--
-- Scope (Stage 1 — foundation only):
--   * auth_pins            : per-profile PIN credential + lockout state
--   * auth_pin_probes      : lockout state for unknown / foreign profile ids,
--                            so a nonexistent id cannot be told apart from a
--                            real one by watching when lockout starts
--   * verify_and_consume_pin() : service-role-only verification + attempt spend
--   * set_own_pin()            : authenticated self-service PIN set / change
--
-- NON-SCOPE — this migration deliberately does NOT touch:
--   money math, fund balances, transaction lifecycle, posting rules,
--   existing RLS policies, existing RBAC helpers, or any existing table.
--   It is purely additive. Rollback = drop the two tables and four functions.
--
-- Security posture:
--   * PIN stored only as a bcrypt hash (cost 10). No plaintext, no reversible form.
--   * Both tables have RLS ENABLED and ZERO policies -> unreachable by anon and
--     authenticated roles. Privileges are revoked as well, belt and braces.
--   * verify_and_consume_pin is EXECUTE-able by service_role ONLY. It is called
--     from an Edge Function, never from the browser.
--   * pgcrypto lives in the `extensions` schema on Supabase, so every call is
--     schema-qualified and search_path is pinned.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLES
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS auth_pins (
  profile_id       UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  church_id        UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  pin_hash         TEXT NOT NULL,
  failed_attempts  INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  lockout_count    INTEGER NOT NULL DEFAULT 0 CHECK (lockout_count >= 0),
  locked_until     TIMESTAMPTZ,
  requires_reset   BOOLEAN NOT NULL DEFAULT true,
  last_success_at  TIMESTAMPTZ,
  last_failure_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE auth_pins IS
  'Bcrypt PIN credential and lockout state, one row per profile. Never readable by anon or authenticated roles.';

CREATE INDEX IF NOT EXISTS idx_auth_pins_church ON auth_pins(church_id);

-- Lockout ledger for subjects that have NO auth_pins row: unknown ids, ids from
-- another church, inactive profiles, and profiles that were never provisioned.
-- Without this, "the account locks after 5 tries" would itself be the oracle
-- that tells an attacker which ids are real.
CREATE TABLE IF NOT EXISTS auth_pin_probes (
  subject_id       UUID PRIMARY KEY,
  failed_attempts  INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  lockout_count    INTEGER NOT NULL DEFAULT 0 CHECK (lockout_count >= 0),
  locked_until     TIMESTAMPTZ,
  last_failure_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE auth_pin_probes IS
  'Mirror lockout state for profile ids with no PIN row, so unknown ids lock on the same schedule as real ones.';

ALTER TABLE auth_pins       ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_pin_probes ENABLE ROW LEVEL SECURITY;

-- No policies are created on purpose. RLS with zero policies denies every row
-- to every non-owner role.
REVOKE ALL ON TABLE auth_pins       FROM PUBLIC;
REVOKE ALL ON TABLE auth_pins       FROM anon;
REVOKE ALL ON TABLE auth_pins       FROM authenticated;
REVOKE ALL ON TABLE auth_pin_probes FROM PUBLIC;
REVOKE ALL ON TABLE auth_pin_probes FROM anon;
REVOKE ALL ON TABLE auth_pin_probes FROM authenticated;

-- ------------------------------------------------------------------------------
-- 2. INTERNAL HELPERS
-- ------------------------------------------------------------------------------

-- Escalating lockout: 1st lockout 15 min, 2nd 1 hour, 3rd and beyond 24 hours.
CREATE OR REPLACE FUNCTION auth_pin_lockout_interval(p_lockout_count INTEGER)
RETURNS INTERVAL
LANGUAGE sql IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN p_lockout_count <= 1 THEN INTERVAL '15 minutes'
    WHEN p_lockout_count = 2 THEN INTERVAL '1 hour'
    ELSE INTERVAL '24 hours'
  END;
$fn$;

-- A PIN is acceptable only if it is exactly 6 digits and is not one of the
-- shapes a person guesses first: one repeated digit, or a straight run.
CREATE OR REPLACE FUNCTION auth_pin_is_acceptable(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE
AS $fn$
DECLARE
  v_ascending  BOOLEAN := TRUE;
  v_descending BOOLEAN := TRUE;
  i INTEGER;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RETURN FALSE;
  END IF;

  IF p_pin ~ '^(.)\1{5}$' THEN
    RETURN FALSE;
  END IF;

  FOR i IN 2..6 LOOP
    IF ascii(substr(p_pin, i, 1)) <> ascii(substr(p_pin, i - 1, 1)) + 1 THEN
      v_ascending := FALSE;
    END IF;
    IF ascii(substr(p_pin, i, 1)) <> ascii(substr(p_pin, i - 1, 1)) - 1 THEN
      v_descending := FALSE;
    END IF;
  END LOOP;

  RETURN NOT (v_ascending OR v_descending);
END;
$fn$;

-- Spend one failed attempt against a subject that has no PIN row, and report
-- whether that subject is now locked.
CREATE OR REPLACE FUNCTION auth_pin_record_probe(p_subject_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $fn$
DECLARE
  v_row auth_pin_probes;
BEGIN
  INSERT INTO auth_pin_probes (subject_id, failed_attempts, last_failure_at)
  VALUES (p_subject_id, 0, now())
  ON CONFLICT (subject_id) DO NOTHING;

  SELECT * INTO v_row FROM auth_pin_probes WHERE subject_id = p_subject_id FOR UPDATE;

  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN
    RETURN jsonb_build_object('status', 'locked', 'locked_until', v_row.locked_until);
  END IF;

  IF v_row.locked_until IS NOT NULL THEN
    v_row.failed_attempts := 0;
  END IF;

  v_row.failed_attempts := v_row.failed_attempts + 1;

  IF v_row.failed_attempts >= 5 THEN
    v_row.lockout_count := v_row.lockout_count + 1;

    UPDATE auth_pin_probes
       SET failed_attempts = 0,
           lockout_count   = v_row.lockout_count,
           locked_until    = now() + auth_pin_lockout_interval(v_row.lockout_count),
           last_failure_at = now()
     WHERE subject_id = p_subject_id
     RETURNING locked_until INTO v_row.locked_until;

    RETURN jsonb_build_object('status', 'locked', 'locked_until', v_row.locked_until);
  END IF;

  UPDATE auth_pin_probes
     SET failed_attempts = v_row.failed_attempts,
         locked_until    = NULL,
         last_failure_at = now()
   WHERE subject_id = p_subject_id;

  RETURN jsonb_build_object('status', 'invalid');
END;
$fn$;

REVOKE ALL ON FUNCTION auth_pin_record_probe(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_pin_record_probe(UUID) FROM anon;
REVOKE ALL ON FUNCTION auth_pin_record_probe(UUID) FROM authenticated;

-- ------------------------------------------------------------------------------
-- 3. verify_and_consume_pin()
-- ------------------------------------------------------------------------------
--
-- Contract:
--   success -> {"status":"success","user_id":uuid,"email":text,"requires_reset":bool}
--   invalid -> {"status":"invalid"}
--   locked  -> {"status":"locked","locked_until":timestamptz}
--
-- The failure shapes carry no counters and no hint of whether the profile, the
-- church match, or the PIN was the thing that was wrong. Every failure path
-- performs a bcrypt comparison so response time does not sort real profiles
-- from imaginary ones.
--
-- p_church_id is supplied by the server (DEPLOYMENT_CHURCH_ID), never by the
-- browser. A profile from another church takes the same path as a typo.
CREATE OR REPLACE FUNCTION verify_and_consume_pin(
  p_profile_id UUID,
  p_church_id  UUID,
  p_pin        TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $fn$
DECLARE
  -- bcrypt hash of a value no caller can produce; used to burn the same time on
  -- paths where there is no stored hash to compare against.
  c_decoy_hash CONSTANT TEXT :=
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
  v_pin      auth_pins;
  v_profile  RECORD;
  v_matches  BOOLEAN;
BEGIN
  IF p_profile_id IS NULL OR p_church_id IS NULL THEN
    PERFORM extensions.crypt(coalesce(p_pin, ''), c_decoy_hash);
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  -- A malformed PIN can never match a stored hash. Still spend an attempt so a
  -- short PIN is not a free probe.
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    PERFORM extensions.crypt(coalesce(p_pin, ''), c_decoy_hash);
    RETURN auth_pin_record_probe(p_profile_id);
  END IF;

  SELECT p.id, p.email, p.church_id, p.is_active
    INTO v_profile
    FROM profiles p
   WHERE p.id = p_profile_id;

  -- Unknown profile, inactive profile, or a profile belonging to another church.
  -- All three are indistinguishable from here on.
  IF NOT FOUND OR v_profile.is_active IS NOT TRUE OR v_profile.church_id <> p_church_id THEN
    PERFORM extensions.crypt(p_pin, c_decoy_hash);
    RETURN auth_pin_record_probe(p_profile_id);
  END IF;

  SELECT * INTO v_pin FROM auth_pins WHERE profile_id = p_profile_id FOR UPDATE;

  -- Real, active, in-church profile that was never given a PIN.
  IF NOT FOUND THEN
    PERFORM extensions.crypt(p_pin, c_decoy_hash);
    RETURN auth_pin_record_probe(p_profile_id);
  END IF;

  -- A live lockout answers before any comparison. A correct PIN during lockout
  -- neither unlocks the account nor shortens the wait.
  IF v_pin.locked_until IS NOT NULL AND v_pin.locked_until > now() THEN
    PERFORM extensions.crypt(p_pin, c_decoy_hash);
    RETURN jsonb_build_object('status', 'locked', 'locked_until', v_pin.locked_until);
  END IF;

  -- Lockout expired: the counter starts clean, the escalation level does not.
  IF v_pin.locked_until IS NOT NULL THEN
    v_pin.failed_attempts := 0;
  END IF;

  v_matches := extensions.crypt(p_pin, v_pin.pin_hash) = v_pin.pin_hash;

  IF v_matches THEN
    UPDATE auth_pins
       SET failed_attempts = 0,
           locked_until    = NULL,
           lockout_count   = 0,
           last_success_at = now(),
           updated_at      = now()
     WHERE profile_id = p_profile_id;

    INSERT INTO audit_logs (church_id, category, actor_id, action, entity_type, entity_id, metadata)
    VALUES (p_church_id, 'SECURITY', p_profile_id, 'PIN_LOGIN_SUCCESS', 'auth_pins', p_profile_id, '{}'::jsonb);

    RETURN jsonb_build_object(
      'status',         'success',
      'user_id',        p_profile_id,
      'email',          v_profile.email,
      'requires_reset', v_pin.requires_reset
    );
  END IF;

  v_pin.failed_attempts := v_pin.failed_attempts + 1;

  IF v_pin.failed_attempts >= 5 THEN
    v_pin.lockout_count := v_pin.lockout_count + 1;

    UPDATE auth_pins
       SET failed_attempts = 0,
           lockout_count   = v_pin.lockout_count,
           locked_until    = now() + auth_pin_lockout_interval(v_pin.lockout_count),
           last_failure_at = now(),
           updated_at      = now()
     WHERE profile_id = p_profile_id
     RETURNING locked_until INTO v_pin.locked_until;

    INSERT INTO audit_logs (church_id, category, actor_id, action, entity_type, entity_id, metadata)
    VALUES (p_church_id, 'SECURITY', p_profile_id, 'PIN_LOGIN_LOCKED', 'auth_pins', p_profile_id,
            jsonb_build_object('lockout_count', v_pin.lockout_count, 'locked_until', v_pin.locked_until));

    RETURN jsonb_build_object('status', 'locked', 'locked_until', v_pin.locked_until);
  END IF;

  UPDATE auth_pins
     SET failed_attempts = v_pin.failed_attempts,
         locked_until    = NULL,
         last_failure_at = now(),
         updated_at      = now()
   WHERE profile_id = p_profile_id;

  INSERT INTO audit_logs (church_id, category, actor_id, action, entity_type, entity_id, metadata)
  VALUES (p_church_id, 'SECURITY', p_profile_id, 'PIN_LOGIN_FAILED', 'auth_pins', p_profile_id,
          jsonb_build_object('failed_attempts', v_pin.failed_attempts));

  RETURN jsonb_build_object('status', 'invalid');
END;
$fn$;

REVOKE ALL ON FUNCTION verify_and_consume_pin(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION verify_and_consume_pin(UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION verify_and_consume_pin(UUID, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION verify_and_consume_pin(UUID, UUID, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 4. set_own_pin()
-- ------------------------------------------------------------------------------
--
-- Authenticated self-service. Acts on auth.uid() only — the caller cannot name
-- another profile, so this can never overwrite someone else's PIN.
--
--   success         -> {"status":"success"}
--   unauthenticated -> {"status":"unauthenticated"}
--   invalid_current -> {"status":"invalid_current"}
--   locked          -> {"status":"locked","locked_until":timestamptz}
--   weak_pin        -> {"status":"weak_pin"}
--   reused_pin      -> {"status":"reused_pin"}
CREATE OR REPLACE FUNCTION set_own_pin(
  p_current_pin TEXT,
  p_new_pin     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $fn$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile RECORD;
  v_pin     auth_pins;
  v_has_pin BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  SELECT p.id, p.church_id, p.is_active
    INTO v_profile
    FROM profiles p
   WHERE p.id = v_user_id;

  IF NOT FOUND OR v_profile.is_active IS NOT TRUE THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  SELECT * INTO v_pin FROM auth_pins WHERE profile_id = v_user_id FOR UPDATE;
  v_has_pin := FOUND;

  IF v_has_pin AND v_pin.locked_until IS NOT NULL AND v_pin.locked_until > now() THEN
    RETURN jsonb_build_object('status', 'locked', 'locked_until', v_pin.locked_until);
  END IF;

  -- A PIN already in force can only be replaced by someone who knows it. A PIN
  -- flagged requires_reset was handed over by an admin, so the holder replaces
  -- it without repeating it back.
  IF v_has_pin AND v_pin.requires_reset IS NOT TRUE THEN
    IF p_current_pin IS NULL
       OR p_current_pin !~ '^[0-9]{6}$'
       OR extensions.crypt(p_current_pin, v_pin.pin_hash) <> v_pin.pin_hash THEN
      RETURN jsonb_build_object('status', 'invalid_current');
    END IF;
  END IF;

  IF NOT auth_pin_is_acceptable(p_new_pin) THEN
    RETURN jsonb_build_object('status', 'weak_pin');
  END IF;

  IF v_has_pin AND extensions.crypt(p_new_pin, v_pin.pin_hash) = v_pin.pin_hash THEN
    RETURN jsonb_build_object('status', 'reused_pin');
  END IF;

  INSERT INTO auth_pins (profile_id, church_id, pin_hash, failed_attempts,
                         lockout_count, locked_until, requires_reset, updated_at)
  VALUES (v_user_id, v_profile.church_id,
          extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)),
          0, 0, NULL, false, now())
  ON CONFLICT (profile_id) DO UPDATE
     SET pin_hash        = EXCLUDED.pin_hash,
         church_id       = EXCLUDED.church_id,
         failed_attempts = 0,
         lockout_count   = 0,
         locked_until    = NULL,
         requires_reset  = false,
         updated_at      = now();

  DELETE FROM auth_pin_probes WHERE subject_id = v_user_id;

  INSERT INTO audit_logs (church_id, category, actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_profile.church_id, 'SECURITY', v_user_id, 'PIN_SET_SELF', 'auth_pins', v_user_id, '{}'::jsonb);

  RETURN jsonb_build_object('status', 'success');
END;
$fn$;

REVOKE ALL ON FUNCTION set_own_pin(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_own_pin(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION set_own_pin(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION set_own_pin(TEXT, TEXT) TO service_role;
