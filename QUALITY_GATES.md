# Engineering Quality Gates

> **Status:** Active  
> **Last Updated:** 2026-07-29  
> **Owner:** Principal Architect  
> **Scope:** All code merged into Grace Ledger must pass these gates

---

## Overview

Every Pull Request must satisfy the following quality gates before merge. Gates are organized by domain and assigned a mandatory status. **Critical** gates block merge if failed. **Required** gates must pass within one iteration. **Recommended** gates are best-effort but strongly encouraged.

---

## Gate 1: Code Quality

| #     | Gate                                                    | Status      | Enforcement                                                   |
| ----- | ------------------------------------------------------- | ----------- | ------------------------------------------------------------- |
| CQ-1  | No dead code (unused variables, imports, functions)     | Critical    | ESLint `no-unused-vars`                                       |
| CQ-2  | No commented-out code in production files               | Critical    | ESLint `no-commented-out-code`                                |
| CQ-3  | No `console.log()` in production code                   | Required    | ESLint `no-console`                                           |
| CQ-4  | All functions have explicit return types                | Required    | TypeScript `@typescript-eslint/explicit-function-return-type` |
| CQ-5  | No magic numbers or strings — use named constants       | Required    | ESLint `no-magic-numbers`                                     |
| CQ-6  | Maximum function complexity: cyclomatic complexity ≤ 10 | Required    | ESLint `complexity`                                           |
| CQ-7  | Maximum function length: ≤ 50 lines                     | Recommended | ESLint `max-lines-per-function`                               |
| CQ-8  | No `any` types — use `unknown` and narrow               | Critical    | TypeScript `no-explicit-any`                                  |
| CQ-9  | All error paths are handled (no silent catch blocks)    | Critical    | ESLint `no-empty`                                             |
| CQ-10 | Single responsibility — files have one clear purpose    | Required    | Code review                                                   |

---

## Gate 2: TypeScript

| #     | Gate                                                            | Status      | Enforcement                            |
| ----- | --------------------------------------------------------------- | ----------- | -------------------------------------- | -------- | ------ |
| TS-1  | `strict: true` in tsconfig.json                                 | Critical    | TypeScript compiler                    |
| TS-2  | No `@ts-ignore` or `@ts-expect-error` without documented reason | Required    | ESLint `ban-ts-comment`                |
| TS-3  | All API responses have typed interfaces/schemas                 | Critical    | TypeScript + Zod                       |
| TS-4  | Route params and search params are typed via TanStack Router    | Required    | TypeScript                             |
| TS-5  | No implicit `any` in function parameters                        | Critical    | TypeScript `noImplicitAny`             |
| TS-6  | All React components have typed props interface                 | Required    | TypeScript                             |
| TS-7  | Nullable values use `T                                          | null`not`T  | undefined` (consistent convention)     | Required | ESLint |
| TS-8  | Discriminated unions for state machines (loading/error/success) | Recommended | Code review                            |
| TS-9  | Generic constraints use `extends` instead of `any`              | Required    | TypeScript                             |
| TS-10 | `as` type assertions are documented with rationale              | Required    | ESLint `no-unnecessary-type-assertion` |

---

## Gate 3: Testing

| #    | Gate                                                                   | Status      | Enforcement       |
| ---- | ---------------------------------------------------------------------- | ----------- | ----------------- |
| T-1  | All new features include at least unit tests                           | Critical    | CI check          |
| T-2  | Test coverage does not decrease from baseline                          | Required    | CI coverage gate  |
| T-3  | All bug fixes include a regression test                                | Critical    | Code review       |
| T-4  | Financial calculation logic has property-based tests                   | Required    | Code review       |
| T-5  | All API endpoints have integration tests                               | Required    | CI                |
| T-6  | Error scenarios are tested (network failure, auth failure, validation) | Required    | Code review       |
| T-7  | Snapshots are reviewed in PR, not blindly accepted                     | Required    | Code review       |
| T-8  | Tests mock external services (Supabase, AI APIs)                       | Required    | Code review       |
| T-9  | Test names describe behavior, not implementation                       | Recommended | Code review       |
| T-10 | No `test.only` or `describe.only` in committed code                    | Critical    | ESLint / CI check |

---

## Gate 4: Security

| #    | Gate                                                 | Status   | Enforcement              |
| ---- | ---------------------------------------------------- | -------- | ------------------------ |
| S-1  | No secrets, API keys, or tokens in source code       | Critical | git-secrets / trufflehog |
| S-2  | All user input is validated server-side              | Critical | Code review              |
| S-3  | RLS policies exist for every Supabase table          | Critical | Drizzle schema review    |
| S-4  | No SQL injection vectors (use parameterized queries) | Critical | Drizzle/Supabase client  |
| S-5  | API endpoints validate JWT/session tokens            | Critical | Integration test         |
| S-6  | No self-approval of financial transactions           | Critical | Business rule test       |
| S-7  | Attachment uploads enforce file type and size limits | Critical | Server-side validation   |
| S-8  | Rate limiting on auth endpoints (login, signup)      | Required | Implementation required  |
| S-9  | CORS configuration is restrictive (not `*`)          | Critical | Server config            |
| S-10 | Input sanitization for XSS prevention in text fields | Required | Zod schemas              |
| S-11 | All financial mutations are logged in audit trail    | Critical | Service layer test       |
| S-12 | Soft delete for financial records, never hard delete | Critical | Schema + service test    |

---

## Gate 5: Performance

| #   | Gate                                                         | Status      | Enforcement            |
| --- | ------------------------------------------------------------ | ----------- | ---------------------- |
| P-1 | No N+1 queries in data fetching                              | Critical    | Code review            |
| P-2 | Database queries use appropriate indexes                     | Required    | EXPLAIN ANALYZE review |
| P-3 | API responses are paginated for list endpoints               | Required    | Implementation         |
| P-4 | TanStack Query staleTime/gcTime are configured appropriately | Required    | Code review            |
| P-5 | Bundle size impact is assessed for new dependencies          | Required    | Bundle analysis        |
| P-6 | Images are optimized (responsive sizes, WebP/AVIF)           | Required    | Implementation         |
| P-7 | No unnecessary re-renders in React component trees           | Recommended | React DevTools         |

---

## Gate 6: Accessibility

| #   | Gate                                                                 | Status      | Enforcement                |
| --- | -------------------------------------------------------------------- | ----------- | -------------------------- |
| A-1 | All form inputs have associated labels                               | Critical    | axe-core / lint            |
| A-2 | All images have descriptive alt text                                 | Required    | ESLint `jsx-a11y/alt-text` |
| A-3 | Interactive elements are keyboard accessible                         | Required    | axe-core                   |
| A-4 | Color contrast meets WCAG AA minimum (4.5:1)                         | Required    | axe-core                   |
| A-5 | Focus indicators are visible (not removed)                           | Required    | axe-core                   |
| A-6 | Error messages are associated with their inputs via aria-describedby | Required    | axe-core                   |
| A-7 | Loading states announce changes to screen readers                    | Recommended | Manual test                |
| A-8 | Modal/dialog focus is trapped and restored on close                  | Required    | axe-core                   |

---

## Gate 7: Documentation

| #   | Gate                                                             | Status      | Enforcement |
| --- | ---------------------------------------------------------------- | ----------- | ----------- |
| D-1 | Public API endpoints are documented (OpenAPI/Swagger)            | Required    | CI check    |
| D-2 | New environment variables are documented in `.env.example`       | Critical    | Code review |
| D-3 | Database schema changes include migration files                  | Critical    | CI check    |
| D-4 | Complex business logic includes inline comments explaining "why" | Required    | Code review |
| D-5 | Component props are documented with JSDoc                        | Recommended | Code review |
| D-6 | README is updated for new features or configuration changes      | Required    | Code review |
| D-7 | ADRs are created for significant architectural decisions         | Critical    | Code review |

---

## Gate 8: API Design

| #     | Gate                                                                              | Status      | Enforcement           |
| ----- | --------------------------------------------------------------------------------- | ----------- | --------------------- |
| API-1 | All API responses have consistent shape (`{ data, error }`)                       | Required    | Code review           |
| API-2 | HTTP methods are semantically correct (GET/read, POST/create, PUT/update, DELETE) | Required    | Code review           |
| API-3 | Error responses include descriptive messages and error codes                      | Required    | Code review           |
| API-4 | Endpoints use plural nouns (`/api/expenses`, not `/api/getExpenses`)              | Required    | Code review           |
| API-5 | API versioning is implemented (`/api/v1/...`)                                     | Required    | Route design          |
| API-6 | Pagination uses cursor-based or offset-limit with defaults                        | Required    | Code review           |
| API-7 | Idempotency key support for financial mutations                                   | Recommended | Design discussion     |
| API-8 | Rate limit headers are returned (X-RateLimit-\*)                                  | Required    | Server implementation |

---

## Gate 9: Database

| #    | Gate                                                                          | Status      | Enforcement      |
| ---- | ----------------------------------------------------------------------------- | ----------- | ---------------- |
| DB-1 | All schema changes have corresponding Drizzle migration files                 | Critical    | CI check         |
| DB-2 | New columns have sensible defaults or are nullable for backward compatibility | Required    | Migration review |
| DB-3 | Indexes are added for foreign keys and frequent query columns                 | Required    | Migration review |
| DB-4 | No base64 or binary data in text columns                                      | Critical    | Schema review    |
| DB-5 | Timestamps use `timestamp with time zone` (timestamptz)                       | Required    | Schema review    |
| DB-6 | Soft delete columns include `deleted_at` timestamp                            | Required    | Schema review    |
| DB-7 | Unique constraints enforce data integrity at DB level                         | Required    | Schema review    |
| DB-8 | Foreign key constraints have ON DELETE behavior specified                     | Required    | Schema review    |
| DB-9 | Migrations are reversible (have `down` migration or are additive-only)        | Recommended | Migration review |

---

## Gate 10: AI Integration

| #    | Gate                                                               | Status   | Enforcement    |
| ---- | ------------------------------------------------------------------ | -------- | -------------- |
| AI-1 | All AI API calls go through server-side proxy — never from browser | Critical | Code review    |
| AI-2 | AI API keys are stored in server environment variables only        | Critical | Secret scan    |
| AI-3 | AI responses are validated before display to users                 | Required | Code review    |
| AI-4 | OCR results are cached to avoid redundant API calls                | Required | Implementation |
| AI-5 | AI calls include timeout and error fallback                        | Required | Implementation |
| AI-6 | AI usage is logged with token count and cost                       | Required | Implementation |
| AI-7 | Prompt injection prevention for user-supplied inputs to AI         | Critical | Code review    |
| AI-8 | Rate limiting for AI endpoints per user/API key                    | Required | Implementation |

---

## Gate 11: Deployment

| #     | Gate                                                                        | Status   | Enforcement       |
| ----- | --------------------------------------------------------------------------- | -------- | ----------------- |
| DEP-1 | Build completes without errors                                              | Critical | CI                |
| DEP-2 | All migrations run successfully                                             | Critical | CI                |
| DEP-3 | Environment variables are documented and present                            | Critical | Deployment check  |
| DEP-4 | Health check endpoint returns 200                                           | Critical | Deployment check  |
| DEP-5 | Rollback plan exists for the deployment                                     | Required | Deployment review |
| DEP-6 | Database backup is taken before schema migrations                           | Critical | Operations        |
| DEP-7 | Deployment is staged (staging → production) with verification at each stage | Required | CI/CD pipeline    |
| DEP-8 | Version tag is applied to the release                                       | Required | CI                |

---

## Gate 12: Accounting Integrity

| #     | Gate                                                               | Status   | Enforcement           |
| ----- | ------------------------------------------------------------------ | -------- | --------------------- |
| ACC-1 | Every income/expense creates balanced double-entry journal entries | Critical | Service layer test    |
| ACC-2 | Fund balances are calculated from journal entries, not independent | Critical | Integration test      |
| ACC-3 | Period-closed transactions are immutable (reject modifications)    | Critical | Service layer test    |
| ACC-4 | All financial mutations include audit log entries                  | Critical | Service layer test    |
| ACC-5 | Trial balance always equals zero (debits = credits)                | Critical | Integration test      |
| ACC-6 | No hard deletes on financial records — soft delete only            | Critical | Schema + service test |
| ACC-7 | Approver cannot be the same person as requestor                    | Critical | Business rule test    |
| ACC-8 | Approval workflow requires minimum 2-party approval for expenses   | Required | Business rule test    |

---

## PR Merge Requirements

A PR may merge only when:

```
ALL Critical gates PASS
ALL Required gates PASS  (or have documented exception)
Recommended gates: at least 80% pass rate
```

## Exception Process

1. Gate exceptions require written approval from the Principal Architect or CTO.
2. Exceptions are documented in the PR description with rationale and timeline for resolution.
3. Exceptions auto-expire after 30 days and must be renewed.

## Automation

| Tool                         | Purpose                                         |
| ---------------------------- | ----------------------------------------------- |
| **ESLint**                   | Code quality, TypeScript rules, import ordering |
| **Prettier**                 | Consistent formatting                           |
| **TypeScript strict**        | Type safety                                     |
| **Jest/Vitest**              | Unit and integration tests                      |
| **Playwright**               | E2E tests                                       |
| **axe-core**                 | Accessibility audit                             |
| **git-secrets / trufflehog** | Secret detection                                |
| **Drizzle Kit**              | Migration validation                            |
| **Bundle analyzer**          | Bundle size impact                              |
| **OpenAPI diff**             | API contract changes                            |
