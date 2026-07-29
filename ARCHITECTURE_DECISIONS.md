# Architecture Decision Records (ADRs)

> **Status:** Active  
> **Last Updated:** 2026-07-29  
> **Owner:** Principal Architect  
> **Scope:** All architecture decisions for Grace Ledger Church Financial OS

---

## ADR-001: TanStack Router for Frontend Routing

### Context

Grace Ledger is a data-heavy financial application with deeply nested routes (church → accounts → transactions), type-safe navigation requirements, and the need for route-level data loading with pending states.

### Problem

Choose a routing solution that provides type safety, nested routing, parallel data loading, and excellent developer experience for a complex financial SPA.

### Options Considered

| Option                     | Pros                                                                                                      | Cons                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **TanStack Router**        | Full type safety, file-based routing, parallel data loading, built-in pending/error states, search params | Smaller community than Next.js                                 |
| **React Router v6**        | Mature, well-known, large ecosystem                                                                       | No type-safe params, no parallel loading, manual data fetching |
| **Next.js App Router**     | SSR/SSG, file-based routing, RSC                                                                          | Overkill for SPA, requires Node server, adds complexity        |
| **React Router v7 (RRv7)** | Improved type safety, loaders                                                                             | Still lacks TanStack's parallel loading and type inference     |

### Decision

**Use TanStack Router with file-based routing.**

### Rationale

1. **Type-safe params and search params** — Route params, search params, and state are fully typed, eliminating an entire class of runtime errors in navigation code.
2. **Parallel data loading** — TanStack Router's loader pattern loads all route data in parallel, critical for dashboard pages that display multiple financial KPIs simultaneously.
3. **Built-in pending/error/skeleton states** — Every route gets automatic pending states, improving perceived performance without manual loading state management.
4. **Search params with validation** — Financial UIs heavily use filters, date ranges, and pagination via URL search params. TanStack Router provides built-in validation via Zod.
5. **File-based routing** — Clear project structure where route files mirror the URL hierarchy.

### Consequences

- **Positive:** Type-safe navigation reduces runtime errors. Routes are self-documenting via file structure.
- **Positive:** Parallel data loading improves perceived performance on dashboard views.
- **Negative:** Smaller community than React Router; team must learn TanStack-specific patterns.
- **Negative:** SSR is not leveraged (SPA-only).

### Future Considerations

- If SSR becomes necessary (e.g., for SEO on public pages), consider migrating to a TanStack Router + TanStack Start combination.
- Monitor TanStack Router's ecosystem growth for integration patterns.

---

## ADR-002: Supabase for Backend & Data Platform

### Context

Grace Ledger needs a backend platform providing authentication, PostgreSQL database, file storage, real-time subscriptions, and edge functions — all essential for a church financial system.

### Problem

Choose a backend platform that balances developer velocity (critical for an early-stage product), operational simplicity, and production capabilities for a financial application.

### Options Considered

| Option                          | Pros                                                                    | Cons                                                                  |
| ------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Supabase**                    | PostgreSQL, Auth, Storage, Realtime, Functions, generous free tier, RLS | Vendor lock-in risk, RLS-only security isn't enough for finance       |
| **Custom Express/Node Backend** | Full control, no vendor lock-in                                         | Requires building every service from scratch, more operational burden |
| **Firebase**                    | Mature, real-time, serverless                                           | Firestore (NoSQL) is wrong for accounting, vendor lock-in extreme     |
| **Appwrite**                    | Open-source, self-hostable                                              | Smaller ecosystem, less mature financial tooling                      |
| **Railway/Neon + Auth0**        | Best-in-class DB + best-in-class auth                                   | Integration complexity, higher cost                                   |

### Decision

**Use Supabase as the primary BaaS, supplemented by a thin Express API layer for financial operations.**

### Rationale

1. **PostgreSQL as the database** — Accounting requires relational integrity, transactions, and SQL. Supabase provides managed PostgreSQL.
2. **Authentication included** — Built-in auth with email/password, session management, and RLS integration reduces backend code.
3. **Realtime subscriptions** — Useful for live-updating dashboards and collaborative data entry.
4. **Storage** — File storage for receipts and attachments with RLS integration.
5. **Generous free tier** — Enables zero-cost hosting during development and early production.
6. **RLS for baseline access control** — Row-level security provides a first line of defense.

### Consequences

- **Positive:** Rapid development with auth, DB, storage, and real-time out of the box.
- **Positive:** PostgreSQL (not NoSQL) preserves relational integrity for financial data.
- **Negative:** Anon key is exposed to the client — RLS is the only protection at the DB level.
- **Negative:** Business rules (no self-approval, fund balance checks, period locks) require server-side enforcement beyond RLS.
- **Mitigation:** A thin Express/Bun API layer handles all mutations with business rule validation, while Supabase handles auth, storage, and real-time reads.

### Future Considerations

- If Supabase becomes cost-prohibitive at scale, the Drizzle schema + Express API are database-agnostic and can migrate to any PostgreSQL provider (Neon, RDS, etc.).
- Consider Supabase Branching for production schema migrations.

---

## ADR-003: Drizzle ORM for Database Schema & Migrations

### Context

Grace Ledger uses PostgreSQL via Supabase. The team needs an ORM that provides type-safe queries, schema management, and migration generation.

### Problem

Choose a PostgreSQL ORM that provides type safety, migration management, and excellent developer experience for a complex financial schema.

### Options Considered

| Option                    | Pros                                                                   | Cons                                                             |
| ------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Drizzle ORM**           | Type-safe, SQL-like API, fast migrations, lightweight, drizzle-kit CLI | Smaller ecosystem than Prisma, newer                             |
| **Prisma**                | Mature, great DX, migration system, Prisma Studio                      | Schema DSL (not SQL), slow introspection, generated client bloat |
| **Kysely**                | Type-safe, pure SQL, no DSL                                            | No migration system, no schema management                        |
| **Raw SQL / postgres.js** | Full control, fastest                                                  | No type safety, no migrations, error-prone                       |
| **Supabase JS Client**    | Deep integration with RLS                                              | Not a full ORM, limited to Supabase features                     |

### Decision

**Use Drizzle ORM for schema definition and migrations, with Supabase JS client for frontend reads.**

### Rationale

1. **Type-safe queries** — Drizzle provides full TypeScript type safety for SQL queries, catching schema mismatches at compile time.
2. **SQL-like API** — Drizzle's API mirrors SQL closely, making it easy for developers with SQL knowledge to write efficient queries.
3. **Lightweight** — No code generation step, no Prisma Engine binary. Fast install and CI.
4. **drizzle-kit** — Push and pull migrations, generate SQL, introspect existing databases.
5. **Supabase compatibility** — Drizzle works with any PostgreSQL, including Supabase's managed instance.

### Consequences

- **Positive:** Type-safe database access prevents runtime SQL errors.
- **Positive:** SQL-like syntax means devs use existing SQL knowledge.
- **Positive:** Migrations are plain SQL files, auditable and reviewable.
- **Negative:** Smaller ecosystem than Prisma — fewer blog posts, tutorials, and community solutions.
- **Negative:** Drizzle's relational API is less intuitive than Prisma's include/nesting.

### Future Considerations

- If the team struggles with Drizzle's relational query API, consider using Drizzle for schema/migrations only and Kysely for queries.
- Monitor Drizzle's adoption — it's growing rapidly and may become the standard TypeScript ORM.

---

## ADR-004: Server-Side Express/Bun API for Financial Operations

### Context

The current codebase has a complete Express/Bun backend (`src/server/`) with double-entry accounting logic, fund management, period closing, and audit services. However, the frontend bypasses it entirely and calls Supabase directly.

### Problem

Grace Ledger is a financial application. Direct client-to-database calls cannot enforce business rules, maintain transaction integrity, or prevent fraud. A server-side layer is mandatory for accounting operations.

### Options Considered

| Option                                    | Pros                                                                                | Cons                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Activate existing Express/Bun backend** | Domain logic already exists, double-entry already implemented, audit service exists | Requires wiring, testing, and deployment                                  |
| **Supabase Edge Functions**               | Serverless, no separate deployment, TypeScript                                      | Cold starts, 10s timeout limit too short for complex operations, no state |
| **Custom API with Hono/Fastify**          | Lightweight, fast, TypeScript                                                       | Requires building everything from scratch                                 |
| **Supabase RPC Functions (SQL)**          | Runs in-database, transactional, fast                                               | Complex business logic in SQL is hard to maintain and test                |

### Decision

**Activate and expand the existing `src/server/` Express/Bun backend as the mutation API (Bun Runtime).**

### Rationale

1. **Domain logic already written** — `journal.ts`, `chart-of-accounts.ts`, `money.ts`, `fund.service.ts`, `transfer.service.ts`, `period.service.ts`, `audit.service.ts` are complete and tested.
2. **Double-entry accounting** — Proper journal entries with debit/credit pairs, contra accounts, and running balances require server-side enforcement.
3. **Transaction integrity** — Financial operations must be atomic. Multiple Supabase calls from the client cannot be wrapped in a database transaction.
4. **Audit trail enforcement** — Every financial mutation must create an audit log entry atomically. This cannot be enforced client-side.
5. **Fraud prevention** — Rules like "no self-approval of expenses" and "fund balance checks" must be server-side.
6. **Bun runtime** — Fast cold starts, TypeScript-native, good for API servers.

### Consequences

- **Positive:** All business rules enforced server-side before any database write.
- **Positive:** Existing domain code is reused, not rewritten.
- **Positive:** Proper transaction boundaries for financial operations.
- **Negative:** Additional deployment complexity (two services instead of one).
- **Negative:** API must be secured with JWT tokens from Supabase Auth session.
- **Mitigation:** The Express API validates Supabase JWT tokens in middleware before processing requests.

### Future Considerations

- If load increases, the API layer can be scaled independently of the frontend.
- The API can be extended to serve as a public REST API for external integrations (banking APIs, third-party tools).

---

## ADR-005: Double-Entry Accounting System

### Context

Grace Ledger is a church financial management system. Proper accounting requires double-entry bookkeeping — every transaction has equal debits and credits that balance.

### Problem

The current implementation treats income and expenses as simple single-entry records. Fund balances are calculated client-side by summing amounts, which is incorrect for accounting purposes.

### Options Considered

| Option                                             | Pros                                                         | Cons                                                       |
| -------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| **Double-Entry (Full)**                            | GAAP-compliant, audit trail, error detection, balanced books | More complex schema, more complex UI                       |
| **Single-Entry Plus (Current)**                    | Simple, easy to understand                                   | No audit trail, no balance enforcement, incorrect for GAAP |
| **Hybrid: Single-Entry UI + Double-Entry Backend** | Simple UX, proper accounting                                 | Translation layer adds complexity                          |

### Decision

**Implement hybrid approach: single-entry-style UI with double-entry accounting in the backend.**

### Rationale

1. **User experience** — Church administrators are not accountants. The UI presents a simple income/expense register. The backend converts each entry into proper debit/credit journal entries.
2. **Accounting integrity** — Double-entry provides automatic error detection (transactions always balance), audit trail, and fund balance correctness.
3. **Domain code exists** — `src/server/domain/journal.ts`, `chart-of-accounts.ts`, and `money.ts` already implement the double-entry model.
4. **Chart of Accounts** — The system already defines account types (Asset, Liability, Equity, Income, Expense) and contra accounts.

### Accounting Model

```
Income Entry:        Debit  Bank Account    ฿1,000
                     Credit Income Account   ฿1,000

Expense Entry:       Debit  Expense Account   ฿500
                     Credit Bank Account       ฿500

Fund Transfer:       Debit  Destination Fund  ฿200
                     Credit Source Fund        ฿200
```

### Consequences

- **Positive:** GAAP-compliant accounting that can be audited by professional accountants.
- **Positive:** Automatic balance detection — if a transaction doesn't balance, it's rejected before hitting the database.
- **Positive:** Reuse of existing domain code.
- **Negative:** More complex query logic for balance reports (must sum journal entries, not single table).
- **Negative:** Translation layer between UI and backend adds development time.

### Future Considerations

- Consider exposing a read-only journal view for power users and auditors.
- Fiscal year close procedures must include retained earnings calculation.

---

## ADR-006: AI Proxy Architecture

### Context

Grace Ledger uses AI features for receipt scanning (OCR), voucher categorization, and offering sheet parsing. These require calls to external AI APIs (Gemini, Fireworks).

### Problem

Frontend applications should not call AI APIs directly. API keys would be exposed to the client browser, and there's no rate limiting, caching, or error handling.

### Options Considered

| Option                       | Pros                                                            | Cons                                         |
| ---------------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| **Server-side AI Proxy**     | API keys stay server-side, rate limiting, caching, cost control | Additional development effort                |
| **Client-side direct calls** | Simple to implement                                             | API keys exposed, no cost control            |
| **Supabase Edge Functions**  | Serverless, key isolation                                       | 10s timeout, no streaming for long OCR tasks |

### Decision

**Route all AI calls through the Express/Bun API server, which acts as an AI Gateway.**

### Rationale

1. **API key security** — Gemini and Fireworks API keys are stored server-side only.
2. **Rate limiting** — Prevent accidental or malicious overuse of expensive AI API calls.
3. **Cost tracking** — Log every AI call with token count and cost for budget management.
4. **Caching** — Cache OCR results for identical receipts to reduce API costs.
5. **Error handling** — Retry logic, fallback models, and graceful degradation server-side.
6. **Prompt injection defense** — Server-side validation of OCR inputs before they reach AI APIs.

### Consequences

- **Positive:** API keys never exposed to browser.
- **Positive:** AI costs are measurable and controllable.
- **Positive:** OCR results can be cached, reducing latency for repeated scans.
- **Negative:** Additional latency as all AI requests proxy through the server.
- **Negative:** Additional server load for AI processing.

### Future Considerations

- Implement a cost dashboard showing per-user AI usage.
- Consider model fallback chains (Gemini → Fireworks → local model) for resilience.
- Evaluate on-device AI for sensitive OCR data (receipts may contain personal information).

---

## ADR-007: Supabase Storage Over Base64 Attachments

### Context

Receipts and document attachments are currently stored as base64-encoded strings in the database. This is a well-known anti-pattern.

### Problem

Base64 storage in PostgreSQL causes massive database bloat, slow queries, expensive backups, and poor performance.

### Options Considered

| Option                             | Pros                                                     | Cons                                                 |
| ---------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| **Supabase Storage**               | RLS integration, CDN, image transformations, no DB bloat | Additional API calls to manage                       |
| **Base64 in DB (Current)**         | Simple, no external dependencies                         | 33% size overhead, DB bloat, slow backups, expensive |
| **S3 Direct (Cloudflare R2, AWS)** | Cheapest, most scalable                                  | Additional service, no RLS integration               |
| **Local Filesystem**               | Zero cost                                                | Not scalable, not available on serverless            |

### Decision

**Migrate all attachment storage to Supabase Storage buckets.**

### Rationale

1. **Database performance** — Removing base64 blobs reduces database size by 50-80%, improving query performance and backup speed.
2. **Cost** — Supabase Storage is cheaper than equivalent database storage.
3. **RLS integration** — Storage bucket policies integrate with Supabase Auth RLS for access control.
4. **CDN delivery** — Images served via CDN for faster loading.
5. **Image transformations** — Supabase Storage supports automatic image resizing and optimization.

### Consequences

- **Positive:** Database size reduces dramatically.
- **Positive:** Faster queries on financial tables.
- **Positive:** Faster and cheaper backups.
- **Positive:** CDN-powered image delivery for receipt thumbnails.
- **Negative:** Requires migration script to move existing attachments.
- **Negative:** Additional API call pattern for storage operations.

### Future Considerations

- Implement attachment cleanup job for orphaned files (deleted records but storage files remain).
- Consider Cloudflare R2 as a cheaper alternative if storage costs grow significantly.

---

## ADR-008: Domain-Driven Design (DDD) for Business Logic

### Context

Grace Ledger's business domain — church financial management — has complex rules around tithing, fund accounting, budget periods, and fiscal years that must be modeled accurately.

### Problem

The current implementation mixes business logic across services, routes, and UI components without a clear domain model. This leads to duplicated logic, inconsistent rules, and maintenance challenges.

### Options Considered

| Option                                         | Pros                                                   | Cons                               |
| ---------------------------------------------- | ------------------------------------------------------ | ---------------------------------- |
| **Domain-Driven Design (Current src/server/)** | Clear domain boundaries, testable, ubiquitous language | Learning curve for team            |
| **Anemic Model (Current frontend approach)**   | Simple, fast to implement                              | Business logic leaks everywhere    |
| **Transaction Script pattern**                 | Straightforward for CRUD                               | Doesn't scale to complex rules     |
| **Active Record**                              | Simple ORM pattern                                     | Mixes persistence and domain logic |

### Decision

**Adopt a Domain-Driven Design approach for financial operations, as already partially implemented in `src/server/`.**

### Rationale

1. **Ubiquitous language** — Terms like "Offering", "Tithe", "Fund Transfer", "Fiscal Period", "Budget Line" have precise meanings in church accounting. DDD encodes these in code.
2. **Bounded contexts** — Clearly separate "Accounting" (journals, ledgers), "Membership" (members, donors), "Operations" (events, projects), and "AI" (OCR, categorization).
3. **Aggregate roots** — `JournalEntry`, `Fund`, `FiscalPeriod` as aggregates ensure transactional consistency.
4. **Domain events** — `IncomeRecorded`, `ExpenseApproved`, `PeriodClosed` events drive audit logging and notifications.

### Domain Structure

```
src/server/domain/
  types.ts              — Shared domain types (ChurchId, UserId, Money)
  money.ts              — Money value object with currency, formatting, arithmetic
  journal.ts            — JournalEntry aggregate, debit/credit rules
  chart-of-accounts.ts  — Chart of Accounts, account types, hierarchy
  validation.ts         — Domain validation rules
```

### Consequences

- **Positive:** Business rules are encapsulated, testable, and consistent.
- **Positive:** Ubiquitous language improves communication between developers and domain experts (church administrators).
- **Positive:** Existing domain code in `src/server/` is fully reusable.
- **Negative:** Requires team training on DDD concepts.
- **Negative:** More upfront design effort compared to CRUD-only approach.

### Future Considerations

- Extract domain events into a dedicated event bus for loose coupling.
- Consider CQRS if reporting queries become complex enough to warrant separate read models.

---

## ADR-009: Current Folder Structure

### Context

The project's folder structure must support clear separation of concerns, scalability, and ease of navigation for a growing team.

### Problem

Design a folder structure that clearly separates frontend, backend, domain, infrastructure, and configuration while remaining navigable.

### Decision

**Retain the current folder structure with minor refinements.**

### Current Structure

```
grace-ledger/
├── src/
│   ├── routes/           — TanStack Router route files (file-based routing)
│   ├── components/       — Reusable UI components
│   │   ├── layout/       — App shell, navigation, topbar
│   │   └── shared/       — Shared UI components
│   ├── hooks/            — Custom React hooks
│   ├── services/         — Client-side API services (Supabase, AI)
│   ├── lib/              — Utility functions, types, config
│   ├── db/               — Drizzle schema definitions
│   ├── server/           — Express/Bun backend
│   │   ├── domain/       — Domain models (DDD)
│   │   ├── services/     — Backend services
│   │   ├── api/          — API routes and middleware
│   │   ├── auth/         — Authentication logic
│   │   ├── infrastructure/ — DB connection, config
│   │   └── __tests__/    — Backend tests
│   └── styles.css        — Global styles
├── drizzle/              — Drizzle migration files
├── supabase/             — Supabase Edge Functions and migrations
├── components.json       — shadcn/ui configuration
├── .env.example          — Environment template
├── docker-compose.yml    — Container setup
└── Dockerfile            — App container
```

### Rationale

1. **Separation of concerns** — Frontend (routes, components, hooks) is cleanly separated from backend (server/domain, server/services, server/api).
2. **File-based routing** — Route files mirror URL structure, making navigation intuitive.
3. **Domain isolation** — Business logic lives in `server/domain/` and `server/services/`, independent of infrastructure.
4. **Drizzle migrations** — Separate `drizzle/` directory for migration files, keeping them out of source.
5. **Supabase artifacts** — Edge Functions and SQL migrations in `supabase/` directory.

### Consequences

- **Positive:** Clear separation between frontend and backend concerns.
- **Positive:** DDD domain code is isolated from infrastructure.
- **Positive:** File-based routing makes route discovery trivial.
- **Negative:** The `src/services/` (client) and `src/server/services/` (backend) naming is confusing — consider renaming client services to `src/api/` or `src/clients/`.

### Future Refinements

1. Rename `src/services/` → `src/api/` or `src/clients/` to distinguish from `src/server/services/`.
2. Add `src/features/` directory for feature-specific components (e.g., `src/features/offerings/`, `src/features/expenses/`).
3. Add `src/config/` for environment and application configuration.
4. Add `src/types/` for shared TypeScript types.

---

## ADR-010: TanStack Query for Server State Management

### Context

Grace Ledger's frontend makes numerous API calls for financial data, members, funds, and settings. Managing loading/error/caching state manually is error-prone.

### Problem

Choose a data-fetching strategy that provides caching, deduplication, background refetching, and optimistic updates for a data-heavy financial application.

### Options Considered

| Option                           | Pros                                                             | Cons                                      |
| -------------------------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| **TanStack Query (React Query)** | Caching, dedup, background refetch, optimistic updates, devtools | Bundle size (~15KB)                       |
| **SWR**                          | Lightweight, simple                                              | Less feature-rich, no optimistic updates  |
| **RTK Query**                    | Full-featured, Redux integration                                 | Tied to Redux, heavy                      |
| **useEffect + fetch**            | No dependencies                                                  | Manual caching, no dedup, race conditions |

### Decision

**Use TanStack Query (already implemented) for all server state.**

### Rationale

1. **Already implemented** — The codebase already uses TanStack Query. No migration needed.
2. **Automatic caching** — Financial data is read frequently but changes infrequently. Caching reduces redundant API calls.
3. **Background refetching** — Ensures data freshness without manual refresh.
4. **Optimistic updates** — Critical for good UX in financial entry forms.
5. **Query invalidation** — After a mutation, related queries are automatically invalidated and refetched.

### Consequences

- **Positive:** Reduced boilerplate for loading/error states.
- **Positive:** Automatic cache invalidation keeps data consistent.
- **Positive:** Devtools aid debugging during development.
- **Negative:** Must be careful with staleTime for financial data — too aggressive caching shows stale balances.

### Future Considerations

- Use `staleTime: 30_000` for financial balances (30 seconds) to balance freshness with caching.
- Use `gcTime: 5 * 60 * 1000` for reference data (members, categories) that rarely changes.

---

## ADR-011: react-hook-form + Zod for Form Management

### Context

Financial data entry forms (income, expense, offerings, fund transfers) require complex validation, conditional fields, and excellent user experience.

### Problem

Choose a form management library that provides performant validation, TypeScript integration, and complex form support.

### Options Considered

| Option                      | Pros                                                                 | Cons                                                 |
| --------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| **react-hook-form + Zod**   | Performant (uncontrolled), schema validation, TypeScript integration | Learning curve for complex forms                     |
| **Formik**                  | Mature, well-known                                                   | Performance issues with large forms, more re-renders |
| **Final Form**              | Good performance                                                     | Smaller ecosystem                                    |
| **Zod alone (no form lib)** | Lightweight                                                          | Manual form state management                         |

### Decision

**Use react-hook-form + Zod (already implemented).**

### Rationale

1. **Already implemented** — The codebase consistently uses this pattern across all forms.
2. **Performance** — Uncontrolled inputs minimize re-renders, important for complex financial forms.
3. **Zod validation** — Schema validation is type-safe and composable. Validation logic is reusable between frontend and backend.
4. **Error handling** — Built-in error states map directly to Zod validation errors.

### Consequences

- **Positive:** Consistent form pattern across all features.
- **Positive:** Type-safe validation prevents invalid data submission.
- **Positive:** Good performance even with complex financial forms.
- **Negative:** Nested form fields require additional work with react-hook-form.

### Future Considerations

- Consider `@hookform/resolvers/zod` for tighter integration between react-hook-form and Zod schemas.
- Extract common validation schemas to `src/lib/validation/` for reuse between frontend and backend.

---

## ADR-012: shadcn/ui + Tailwind CSS + Framer Motion for UI

### Context

Grace Ledger needs a professional, accessible, and maintainable UI system for a financial application used by church administrators.

### Problem

Choose a UI component library that provides accessible, customizable, and professional-looking components for a financial dashboard application.

### Options Considered

| Option                       | Pros                                                                    | Cons                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **shadcn/ui + Tailwind CSS** | Copy-paste components, full customization, Radix primitives, accessible | Less out-of-box than full library                                    |
| **MUI (Material UI)**        | Mature, comprehensive                                                   | Heavy bundle, Material Design may not fit, styling overrides complex |
| **Ant Design**               | Comprehensive, good for data-heavy apps                                 | Chinese-language centric, complex customization                      |
| **Chakra UI**                | Good DX, accessible                                                     | Smaller ecosystem, less performant                                   |
| **Radix + custom**           | Full control, accessible                                                | More work to build components                                        |

### Decision

**Use shadcn/ui + Tailwind CSS v3 + Framer Motion (already implemented).**

### Rationale

1. **Already implemented** — Consistent usage across the codebase.
2. **Customization** — shadcn components are copied into the project and fully customizable.
3. **Radix UI primitives** — Accessible, WAI-ARIA compliant components under the hood.
4. **Tailwind CSS** — Utility-first CSS for rapid UI development with consistent design tokens.
5. **Framer Motion** — Declarative animations for page transitions, loading states, and micro-interactions that improve the UX of financial workflows.

### Consequences

- **Positive:** Accessible components by default.
- **Positive:** Full visual customization through Tailwind utilities.
- **Positive:** No external CSS-in-JS runtime.
- **Negative:** Component updates require manual patching (no auto-upgrades like MUI).
- **Negative:** shadcn/ui's form patterns must be carefully integrated with react-hook-form.

### Future Considerations

- Create a design system document with Grace Ledger-specific theme tokens.
- Consider Tailwind CSS v4 when stable for improved performance.

---

## ADR-013: Fiscal Period and Year-End Closing

### Context

Accounting systems must support fiscal periods (months/quarters) and year-end closing procedures to lock periods and prevent modifications to closed financial data.

### Problem

The current implementation has no period locking. Any user can modify or delete transactions from any date. This is unacceptable for accounting integrity.

### Decision

**Implement fiscal period management with period locking and year-end closing.**

### Rationale

1. **Accounting integrity** — Once a period is closed, its transactions are immutable. This prevents accidental or intentional alteration of historical financial data.
2. **Audit compliance** — Auditors require assurance that past financial data hasn't been modified.
3. **Period-end reports** — Accurate period-over-period comparison requires clean period boundaries.
4. **Year-end closing** — Transfer net income to retained earnings, close revenue and expense accounts.

### Implementation

- Each fiscal period has an `open`/`closed`/`locked` state.
- Closed periods reject new transactions and modifications.
- Locked periods also prevent reopening (after audit finalization).
- Year-end close creates adjusting entries and starts a new fiscal year.

### Consequences

- **Positive:** Accounting integrity is preserved.
- **Positive:** Audit trail is meaningful — closed periods are provably immutable.
- **Negative:** Users cannot edit past transactions without reopening a period (requires authorized override).
- **Negative:** Period management adds UI complexity.

### Future Considerations

- Implement a "period reopening" workflow with audit trail and authorized approval.
- Support multiple fiscal year conventions (calendar year, fiscal year, church year).

---

## ADR-014: Monitoring and Observability

### Context

As a financial system handling church funds, Grace Ledger requires monitoring for availability, performance, security, and accounting integrity.

### Problem

Choose a monitoring strategy that provides visibility into system health, performance, security events, and accounting anomalies without excessive cost.

### Decision

**Implement a lightweight monitoring stack with Sentry for errors, Prometheus/Grafana for metrics, and structured logging.**

### Rationale

1. **Error tracking** — Sentry captures frontend and backend errors with context (user, route, action) for debugging. (Free tier sufficient for initial production.)
2. **Structured logging** — JSON-formatted logs with correlation IDs across frontend and backend requests.
3. **Key metrics** — API response times, error rates, AI call counts and costs, authentication failures, transaction volumes.
4. **Accounting alerts** — Unbalanced journal entries, unusual transaction patterns, multiple failed login attempts.
5. **Uptime monitoring** — External health check endpoint with notification on downtime.

### Consequences

- **Positive:** Rapid error detection and debugging with Sentry.
- **Positive:** Cost tracking for AI API usage.
- **Positive:** Security event monitoring (auth failures, unusual access patterns).
- **Negative:** Additional infrastructure to maintain.
- **Negative:** Free tiers have limits that may be reached as the system grows.

### Future Considerations

- Upgrade to Sentry Team plan if error volume exceeds free tier.
- Evaluate OpenTelemetry for distributed tracing across frontend → API → Supabase → AI services.
