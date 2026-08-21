-- ==============================================================================
-- Grace Ledger — Migration 002: Centralized Security Definer Functions
-- Author: Principal Engineer
-- Target: PostgreSQL 16 / Supabase
-- Purpose:
--   Centralize tenant isolation and RBAC role validation into secured,
--   reusable functions to prevent JWT claim assumptions and logic drift in RLS.
-- ==============================================================================

-- 1. Helper: Resolve active church_id for current authenticated session
CREATE OR REPLACE FUNCTION current_user_church_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT church_id 
  FROM profiles 
  WHERE id = auth.uid() AND is_active = true 
  LIMIT 1;
$$;

-- 2. Helper: Check if current authenticated user has an exact role in their church
CREATE OR REPLACE FUNCTION current_user_has_role(p_required_role user_role_enum)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid() 
      AND ur.church_id = p.church_id
      AND p.is_active = true
      AND (ur.role = p_required_role OR ur.role = 'super_admin')
  );
$$;

-- 3. Helper: Check if current user has access to a specific church with optional minimum role
CREATE OR REPLACE FUNCTION has_church_access(
  p_church_id UUID,
  p_minimum_role user_role_enum DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_church UUID;
  v_user_is_active BOOLEAN;
BEGIN
  -- Unauthenticated sessions have zero access
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Verify user exists, is active, and belongs to the requested church
  SELECT church_id, is_active 
  INTO v_user_church, v_user_is_active 
  FROM profiles 
  WHERE id = auth.uid();

  IF v_user_church IS NULL OR v_user_is_active IS NOT TRUE OR v_user_church <> p_church_id THEN
    RETURN FALSE;
  END IF;

  -- If no specific role is required, basic church membership is sufficient
  IF p_minimum_role IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Validate role hierarchy
  RETURN EXISTS (
    SELECT 1 
    FROM user_roles
    WHERE user_id = auth.uid()
      AND church_id = p_church_id
      AND (
        role = 'super_admin'
        OR (p_minimum_role = 'pastor' AND role IN ('super_admin', 'pastor'))
        OR (p_minimum_role = 'treasurer' AND role IN ('super_admin', 'pastor', 'treasurer'))
        OR (p_minimum_role = 'finance_staff' AND role IN ('super_admin', 'pastor', 'treasurer', 'finance_staff'))
        OR (p_minimum_role = 'approver' AND role IN ('super_admin', 'pastor', 'treasurer', 'approver'))
        OR (p_minimum_role = 'counter' AND role IN ('super_admin', 'treasurer', 'counter'))
        OR (p_minimum_role = 'member' AND role IN ('super_admin', 'pastor', 'treasurer', 'finance_staff', 'approver', 'counter', 'member'))
      )
  );
END;
$$;
