-- ==============================================================================
-- Grace Ledger — Migration 021: Pin the PIN helper search_path
--
-- `auth_pin_lockout_interval` and `auth_pin_is_acceptable` are pure, own no
-- data, and are not SECURITY DEFINER, so a mutable search_path could not be
-- used to reach anything. Supabase's `function_search_path_mutable` advisor
-- flags them anyway, and pinning costs nothing — the point is that the advisor
-- stays quiet about the objects this feature owns, so a real finding later is
-- not lost in known noise.
-- ==============================================================================

ALTER FUNCTION auth_pin_lockout_interval(INTEGER) SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION auth_pin_is_acceptable(TEXT)       SET search_path = pg_catalog, pg_temp;
