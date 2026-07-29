## Summary

This PR fixes the top 7 priority issues identified in the comprehensive code audit. All changes are verified with a clean build.

## What changed

### Security (5 fixes)

| #   | Issue                                                                            | Fix                                                                                   |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | auth-login — missing `is_active` in SELECT caused 403 on every login             | Added `is_active` to column list                                                      |
| 2   | get-church — `select('*, churches(*)')` with SERVICE_ROLE leaked `password_hash` | Replaced with explicit safe column selection                                          |
| 3   | auth-register — endpoint was public, no auth required                            | Now requires Bearer token + super_admin role validation; church_id mismatch rejection |
| 4   | seed endpoint — POST /api/seed had no auth guard                                 | Added `requireSession()` middleware                                                   |
| 5   | CORS — wildcard `*` on all edge functions                                        | Restricted to APP_URL + localhost origins via dynamic resolver                        |

### Data Persistence (2 fixes)

| #   | Issue                                                                    | Fix                                                                                        |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 6   | mock-db — `saveDb()` stored all financial data in localStorage as JSON   | Now only persists metadata subset (session, settings, users); removed `pin` from seed data |
| 7   | dashboard realtime — `churchId=""` caused subscriptions to silently skip | Added `churchId` state fetched from `users` table via `useEffect`                          |

### Type Alignment (bonus)

- Aligned `Role` / `TxStatus` / `PaymentChannel` across frontend and server
- Added `voided` variant to `StatusBadge`
- Removed `pin` from `User` interface

### Fixes applied during work

- Fixed `replace_all` collateral damage in auth-register/get-church where import statement was mangled to `import { corsHeaders(req) }`

## Testing

- [x] Build passes (`npm run build`)
- [x] TypeScript compiles cleanly
- [x] All edge function endpoints updated and syntax-verified
- [x] Dashboard realtime subscriptions now receive churchId correctly

## Notes for reviewer

- The CORS module was changed from a constant to a function (`corsHeaders(req?: Request)`) — all 4 edge functions were updated to pass `req`
- auth-register now requires a valid session from an existing super_admin — no more anonymous user creation
- mock-db change only affects localStorage persistence; in-memory DB remains unchanged for backward compat
