# Grace Ledger v2 — Engineering Backlog

Generated: 2026-08-01
Architecture Score: 62/100 (Grade C+) — NOT production-ready

---

## P0 — Production Blockers

### P0-1: Missing API Route Handlers
**Severity:** Critical | **Effort:** Medium | **Area:** Backend

Several route modules referenced in `src/server/api/routes.ts` do not exist on disk:
- `journal.routes.ts` — exists and is functional
- `fund.routes.ts` — exists and is functional
- `period.routes.ts` — exists and is functional
- `transfer.routes.ts` — exists and is functional
- `reconciliation.routes.ts` — exists and is functional
- `audit.routes.ts` — exists and is functional
- `seed.routes.ts` — exists and is functional
- `offering.routes.ts` — exists and is functional
- `settings.routes.ts` — exists and is functional
- `chart.routes.ts` — exists and is functional
- `ai-proxy.routes.ts` — exists and is functional
- `health.routes.ts` — exists and is functional
- `income.routes.ts` — exists and is functional
- `expense.routes.ts` — exists and is functional
- `budget.routes.ts` — exists and is functional
- `offering-financial.routes.ts` — exists and is functional
- `auth.routes.ts` — exists and is functional

All 17 route modules exist. No missing route handlers.

### P0-2: No CI/CD Pipeline [COMPLETED]
**Severity:** Critical | **Effort:** Low | **Area:** DevOps

GitHub Actions workflows configured:
1. `.github/workflows/ci.yml` — runs lint, typecheck, and test suites with Postgres service container on PRs/main.
2. `.github/workflows/deploy.yml` — deploys to Vercel on main branch merges.

### P0-3: Missing Production Environment Configuration [COMPLETED]
**Severity:** Critical | **Effort:** Low | **Area:** DevOps/Config

`.env.example` template created with all required environment variables (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `OPENROUTER_API_KEY`, etc.) and clear configuration documentation.

### P0-4: No Test Coverage for Route Layer [COMPLETED]
**Severity:** Critical | **Effort:** Medium | **Area:** Testing

Added `src/server/__tests__/routes.test.ts` — 45 integration tests calling `handleApiRequest()` directly across every registered route module, covering auth boundary (401), permission boundary (403), and happy-path dispatch (200/201).

Found and fixed a real bug in the process: `POST /ai/parse-document` and `POST /ai/parse-church-form` had no authentication check at all — fixed by adding `requireAuth()`.

**Known gap, not fixed here:** `income.service.ts`, `expense.service.ts`, and the offering-financial service use the raw Supabase admin client instead of Drizzle, unlike the rest of the route layer — their handlers can't be integration-tested without real `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` credentials, which aren't configured in this environment or in `.github/workflows/ci.yml`. Only their auth-dispatch boundary is tested. Follow-up: either add Supabase test credentials to CI, or migrate these three services onto Drizzle.

### P0-5: Frontend Uses Direct Supabase Reads for Mutations (Bypasses Business Rules) [COMPLETED]
**Severity:** Critical | **Effort:** High | **Area:** Architecture

Of the 6 functions originally flagged, `createOffering`/`deleteOffering`/`createOfferingCategory`/`updateOfferingCategory`/`deleteOfferingCategory`/`reorderOfferingCategories` were already migrated to the server API in a prior session. `createProject`, `createMember`, and `saveSettings` were fixed in this pass — all three now call the server API (`apiCreateProject`, `apiCreateMember`, `apiUpdateSettings`), which already existed with proper auth, permission checks, and audit logging; only the `church.ts` call sites needed rewiring.

Note: `createProject`, `createMember`, and `saveSettings` have zero callers anywhere in the current frontend UI — this was closing a latent gap, not fixing live broken functionality.

---

## P1 — High Priority

### P1-1: Incomplete Offering Financial Route Handler
**Severity:** High | **Effort:** Medium | **Area:** Backend

`offering-financial.routes.ts` exists but the `POST /offering-financial` handler has a critical bug: it tries to create a journal entry using `input.fundId` as the `accountId` for the debit line, but `fundId` is a fund UUID, not a chart-of-accounts UUID. The debit line should use the fund's linked equity account ID.

**Action:** Fix the journal entry creation in `offering-financial.routes.ts` to look up the fund's `accountId` from the `funds` table before creating the journal entry.

### P1-2: Budget Route Handler Missing `period` Field Mapping
**Severity:** High | **Effort:** Low | **Area:** Backend

In `budget.routes.ts`, the `POST /budget` handler maps `input.period === "monthly"` to `periodType: "monthly"`, but the schema allows `"annual"`, `"monthly"`, `"department"`, `"project"`. The `annual` case falls through to `"annual"` correctly, but the `department` and `project` cases are not handled — they also map to `"annual"` instead of their correct types.

**Action:** Fix the period type mapping in `budget.routes.ts`:
```typescript
periodType: input.period as "annual" | "monthly" | "department" | "project",
```

### P1-3: No Project Create/Update/Delete API Routes
**Severity:** High | **Effort:** Medium | **Area:** Backend

The frontend `_app.projects.tsx` calls `listProjects()` and `createProject()` from `@/services/church.ts`, but `createProject()` writes directly to Supabase (bypassing business rules). There are no server-side route handlers for project CRUD.

**Action:** Create `project.routes.ts` with GET/POST/PUT/DELETE handlers that go through the server API layer with proper audit logging and permission checks.

### P1-4: No Member Create/Update/Delete API Routes
**Severity:** High | **Effort:** Medium | **Area:** Backend

Same issue as P1-3. The frontend writes directly to Supabase for member operations.

**Action:** Create `member.routes.ts` with proper server-side handlers.

### P1-5: No Settings API Route (PUT /settings)
**Severity:** High | **Effort:** Medium | **Area:** Backend

The frontend `_app.settings.tsx` calls `saveSettings()` which writes directly to Supabase. There is no `PUT /settings` route handler.

**Action:** Create `settings.routes.ts` with GET/PUT handlers. (Note: `settings.routes.ts` already exists but only has GET and PUT — the frontend doesn't use it.)

### P1-6: Missing `permissions.ts` Permission Matrix Coverage
**Severity:** High | **Effort:** Low | **Area:** Backend

The `permissions.ts` file defines `PERMISSION_MATRIX` and `hasPermission()`, but the route handlers use permission strings like `"journal.read"`, `"journal.write"`, `"journal.approve"`, `"journal.void"`, `"fund.read"`, `"fund.manage"`, `"fund.transfer"`, `"offering.read"`, `"offering.write"`, `"offering.approve"`, `"offering.count"`, `"offering.lock"`, `"audit.read"`, `"settings.read"`, `"settings.write"`, `"period.close"`, `"period.reopen"`, `"period.reconcile"`, `"budget.read"`, `"budget.write"`.

However, the `PERMISSION_MATRIX` in `permissions.ts` only maps `super_admin` and `admin` roles to a flat list of permissions. The `hasPermission()` function checks if the permission string is in the array. This works, but the permission names used in routes don't match the permission names in the matrix.

**Action:** Audit `permissions.ts` to ensure all permission strings used in route handlers are present in the `PERMISSION_MATRIX`. Add missing permissions.

### P1-7: No Rate Limiting on Login Endpoint
**Severity:** High | **Effort:** Low | **Area:** Security

The `auth.routes.ts` `/api/auth/login` endpoint is excluded from CSRF protection but is NOT excluded from rate limiting. However, the rate limiter uses in-memory storage, which doesn't work across multiple server instances.

**Action:** Add login-specific rate limiting (e.g., 5 attempts per minute per IP) with persistent storage (Redis or database-backed).

### P1-8: Frontend Hardcoded Fallback Values
**Severity:** High | **Effort:** Low | **Area:** Frontend

In `_app.dashboard.tsx`, the gauge chart has a hardcoded fallback:
```tsx
totalBudget={annualBudget.total > 0 ? annualBudget.total : 2500000}
```
This 2,500,000 fallback should come from the budget API or app settings, not be hardcoded.

**Action:** Remove hardcoded fallback or fetch it from the settings API.

---

## P2 — Medium Priority

### P2-1: No Password Reset Flow
**Severity:** Medium | **Effort:** Medium | **Area:** Auth

There is no "forgot password" or password reset flow. Users who forget their PIN/password are locked out.

**Action:** Implement password reset via email or admin override.

### P2-2: No Two-Factor Authentication (2FA)
**Severity:** Medium | **Effort:** High | **Area:** Security

The schema has `mfa_enabled` and `mfa_secret` columns on the `users` table, but there is no 2FA implementation in the auth flow.

**Action:** Implement TOTP-based 2FA using the existing `mfa_secret` column.

### P2-3: In-Memory Rate Limiter Not Scalable
**Severity:** Medium | **Effort:** Medium | **Area:** Infrastructure

The rate limiter in `middleware.ts` uses an in-memory `Map`. This doesn't work across multiple server instances and loses data on restart.

**Action:** Move rate limiting to a Redis-backed or database-backed solution.

### P2-4: No Audit Log for Settings Changes
**Severity:** Medium | **Effort:** Low | **Area:** Audit

The `PUT /settings` route handler in `settings.routes.ts` does not call `AuditService.logUpdate()`. Settings changes are not tracked in the audit trail.

**Action:** Add audit logging to the settings update route handler.

### P2-5: No Audit Log for Project/Member CRUD
**Severity:** Medium | **Effort:** Low | **Area:** Audit

The frontend writes to Supabase directly for project and member operations, bypassing the server API and audit logging.

**Action:** Once P1-3 and P1-4 are resolved, ensure all project and member mutations go through the server API with audit logging.

### P2-6: No Export/Import for Chart of Accounts
**Severity:** Medium | **Effort:** Medium | **Area:** Features

There is no way to export or import the chart of accounts. Churches that need to migrate from other accounting software cannot do so easily.

**Action:** Add CSV/JSON export and import for chart of accounts.

### P2-7: No Backup/Restore for Church Data
**Severity:** Medium | **Effort:** Medium | **Area:** Operations

There is no backup or restore functionality. If data is corrupted, there is no recovery path.

**Action:** Implement database backup (pg_dump) and restore functionality, or integrate with Supabase's built-in backup features.

### P2-8: Missing `_app.reports.tsx` Period Selector Persistence
**Severity:** Medium | **Effort:** Low | **Area:** Frontend

The reports page has a period selector (month/quarter/year) but the selection is not persisted in the URL or URL state. If the user refreshes the page, it resets to "month".

**Action:** Persist the period selector state in the URL search params.

---

## P3 — Low Priority

### P3-1: No Unit Tests for Domain Services
**Severity:** Low | **Effort:** High | **Area:** Testing

The existing tests (`backend.test.ts`) are integration tests that require a real database. There are no isolated unit tests for `JournalService`, `FundService`, `PeriodService`, `TransferService`, `ReconciliationService`, `IncomeService`, `ExpenseService`, `AuthService`, `AuditService`, `SeedService`, `MigrationService`, `AttachmentService`.

**Action:** Add unit tests for each domain service using mocked database connections.

### P3-2: No E2E Tests
**Severity:** Low | **Effort:** High | **Area:** Testing

There are no end-to-end tests that simulate a user workflow (login → create income → approve → view dashboard).

**Action:** Add E2E tests using Playwright or Cypress.

### P3-3: No API Documentation
**Severity:** Low | **Effort:** Medium | **Area:** Documentation

There is no OpenAPI/Swagger documentation for the API routes.

**Action:** Add OpenAPI schema generation or a `/api/docs` endpoint.

### P3-4: No Error Boundary for Route-Level Errors
**Severity:** Low | **Effort:** Medium | **Area:** Frontend

The `_app.tsx` has an `ErrorBoundary` component, but individual route pages don't have their own error boundaries. A failure in one route can potentially affect the entire layout.

**Action:** Add route-level error boundaries for critical pages (dashboard, income, expense, etc.).

### P3-5: No Loading States for Settings Page
**Severity:** Low | **Effort:** Low | **Area:** Frontend

The settings page (`_app.settings.tsx`) has no loading skeleton while categories and subcategories are being fetched.

**Action:** Add loading skeletons to the settings page.

### P3-6: No Confirmation for Bulk Operations
**Severity:** Low | **Effort:** Low | **Area:** Frontend

The settings page allows deleting categories and subcategories with an `AlertDialog`, but there is no confirmation for bulk reorder operations or bulk status changes.

**Action:** Add confirmation dialogs for bulk operations.

---

## Architecture Debt Summary

| Category | Count | P0 | P1 | P2 | P3 |
|---|---|---|---|---|---|
| Missing/Incomplete API Routes | 4 | 0 | 3 | 0 | 1 |
| Frontend Bypassing Server API | 1 | 1 | 0 | 1 | 0 |
| Security Issues | 2 | 0 | 2 | 0 | 0 |
| Missing Tests | 3 | 2 | 0 | 0 | 1 |
| CI/CD / DevOps | 1 | 1 | 0 | 0 | 0 |
| Configuration / Environment | 1 | 1 | 0 | 0 | 0 |
| Hardcoded Values | 1 | 0 | 1 | 0 | 0 |
| Audit Gaps | 2 | 0 | 0 | 2 | 0 |
| Documentation | 1 | 0 | 0 | 0 | 1 |
| UX / Polish | 3 | 0 | 0 | 0 | 3 |

---

## Recommended Execution Order

1. **P0-2** (CI/CD) — 1 day, unblocks all future automation
2. **P0-3** (Environment Config) — 0.5 day, unblocks deployment
3. **P0-5** (Frontend Write Bypass) — 3 days, critical architecture fix
4. **P0-4** (Route Layer Tests) — 2 days, unblocks CI quality gates
5. **P1-1** (Offering Financial Bug) — 0.5 day, fixes a data integrity issue
6. **P1-3** (Project Routes) — 1 day, unblocks frontend project management
7. **P1-4** (Member Routes) — 1 day, unblocks frontend member management
8. **P1-6** (Permission Matrix Audit) — 0.5 day, security hardening
9. **P1-7** (Login Rate Limiting) — 0.5 day, security hardening
10. **P1-8** (Hardcoded Fallback) — 0.5 day, removes tech debt

Total estimated effort for P0 + P1: ~12 days