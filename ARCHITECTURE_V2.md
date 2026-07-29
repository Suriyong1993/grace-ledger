# Grace Ledger v2 — System Architecture

**Version:** 2.0
**Date:** 22 July 2026
**Status:** Draft — For Review

---

## Table of Contents

1. [Architectural Principles](#1-architectural-principles)
2. [System Overview](#2-system-overview)
3. [Layered Architecture](#3-layered-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Component Architecture](#5-component-architecture)
6. [Data Flow](#6-data-flow)
7. [Deployment Architecture](#7-deployment-architecture)
8. [Cross-Cutting Concerns](#8-cross-cutting-concerns)
9. [API Design Standards](#9-api-design-standards)
10. [Error Handling Strategy](#10-error-handling-strategy)
11. [Performance Architecture](#11-performance-architecture)
12. [Monitoring & Observability](#12-monitoring--observability)

---

## 1. Architectural Principles

### 1.1 Server-Side Authority

**Principle:** No business logic shall execute on the client. The browser is an untrusted execution environment.

**Implementation:**

- All financial calculations execute in server functions (TanStack Start server-side functions)
- Every API request passes through authorization middleware before reaching domain logic
- Client-side state is purely presentational — derived from server responses
- Input validation occurs at two layers: client (for UX) and server (for security)

### 1.2 Double-Entry Accounting Integrity

**Principle:** Every financial operation must produce a balanced journal entry. `Σ debits = Σ credits` is a system invariant enforced at the database level.

**Implementation:**

- Journal entries are created atomically within a single database transaction
- The posting engine validates balance equality before committing
- A CHECK constraint on the journal_entry table enforces `debit_total = credit_total`
- Trial balance queries verify zero net balance across the chart of accounts as a monitoring check

### 1.3 Immutable Audit Trail

**Principle:** Once recorded, no audit record can be modified or deleted. Audit integrity is cryptographically verifiable.

**Implementation:**

- Audit log table has REVOKE INSERT, GRANT SELECT permissions — no UPDATE/DELETE possible
- Each entry contains `sha256(previous_entry_hash || current_entry_json)`
- External verification endpoint allows auditors to validate the hash chain independently
- Snapshots capture full before/after state of any entity mutation

### 1.4 Defense in Depth

**Principle:** Every security boundary is enforced at multiple layers, not just one.

**Implementation:**
| Layer | Enforcement |
|-------|-------------|
| Network | WAF, Rate limiting, CORS |
| Application | Auth middleware, Zod validation, Role checks |
| Database | Row-Level Security (RLS), Column-level grants |
| Audit | External SIEM forward, Hash chain |

### 1.5 Single Source of Truth

**Principle:** Every piece of financial data has exactly one authoritative representation.

**Implementation:**

- Fund balances are stored in the `general_ledger` table, not computed ad-hoc
- Period close snapshots are stored independently for historical audit
- Cached balances are invalidated atomically with the transactions that update them
- No derived value is used as a source of truth — it's always verified against stored balances

---

## 2. System Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              React 19 + TanStack Start                 │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌─────────┐ │  │
│  │  │ shadcn/ │ │ Radix UI │ │ Recharts   │ │ Lucide  │ │  │
│  │  │ ui      │ │          │ │            │ │ React   │ │  │
│  │  └─────────┘ └──────────┘ └────────────┘ └─────────┘ │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │           TanStack Router (file-based)           │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │           TanStack Query (server state)           │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
───────────────────────────────────────────────────────────────
                      │ HTTPS + httpOnly Cookies
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              TanStack Start Server Functions           │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────┐             │  │
│  │  │ Auth MW  │ │ Rate     │ │ Validation │             │  │
│  │  │          │ │ Limiter  │ │ (Zod)      │             │  │
│  │  └─────────┘ └──────────┘ └────────────┘             │  │
│  └───────────────────────────────────────────────────────┘  │
───────────────────────────────────────────────────────────────
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Application Services                   │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌─────────┐ │  │
│  │  │ Journal │ │ Period   │ │ Reconci-   │ │ Report  │ │  │
│  │  │ Service │ │ Service  │ │ liation    │ │ Service │ │  │
│  │  └─────────┘ └──────────┘ └────────────┘ └─────────┘ │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌─────────┐ │  │
│  │  │ Budget  │ │ Member   │ │ Approval   │ │ Auth    │ │  │
│  │  │ Service │ │ Service  │ │ Service    │ │ Service │ │  │
│  │  └─────────┘ └──────────┘ └────────────┘ └─────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
───────────────────────────────────────────────────────────────
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      DOMAIN LAYER                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Domain Model                         │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌─────────┐ │  │
│  │  │ Chart   │ │ Journal  │ │ General    │ │ Fund    │ │  │
│  │  │ of Accts│ │ Entry    │ │ Ledger     │ │ Account │ │  │
│  │  └─────────┘ └──────────┘ └────────────┘ └─────────┘ │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌─────────┐ │  │
│  │  │ Period  │ │ Reconcile│ │ Transaction │ │ Budget  │ │  │
│  │  │         │ │          │ │ Lifecycle   │ │         │ │  │
│  │  └─────────┘ └──────────┘ └────────────┘ └─────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
───────────────────────────────────────────────────────────────
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    PERSISTENCE LAYER                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              PostgreSQL 16 + Supabase                   │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │  Row-Level Security (RLS)                         │ │  │
│  │  │  ACID Transactions                                │ │  │
│  │  │  Point-in-Time Recovery (PITR)                    │ │  │
│  │  │  Audit Log Table (append-only)                    │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │  Supabase Storage (attachments, receipts)          │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Request Flow

```
User Action → React Component → TanStack Query Mutation
  → Server Function (TanStack Start)
    → Auth Middleware (validate session, check permissions)
      → Input Validation (Zod schema)
        → Application Service (orchestrate business logic)
          → Domain Layer (enforce rules, create journal entries)
            → Repository Layer (data access)
              → PostgreSQL (ACID transaction)
                → Audit Log Interceptor (append audit entry)
          ← Return result
        ← Return domain response DTO
      ← Return API response
    ← Return serialized data
  ← Update TanStack Query cache
← React re-renders with new data
```

---

## 3. Layered Architecture

### 3.1 Presentation Layer (Client)

**Location:** `src/routes/`, `src/components/`

**Responsibilities:**

- Render UI components using shadcn/ui + Radix primitives
- Handle user input and form state (React Hook Form)
- Display data received from server functions
- Trigger server mutations via TanStack Query
- Handle optimistic UI updates for non-financial operations only

**Constraints:**

- NEVER execute financial calculations
- NEVER store financial data beyond UI cache
- NEVER contain authorization logic beyond UI hiding
- NEVER call repository methods directly

### 3.2 API Gateway Layer

**Location:** `src/routes/api/` (TanStack Start server functions)

**Responsibilities:**

- Authenticate every request (session validation via httpOnly JWT cookie)
- Authorize every request (permission check against role matrix)
- Rate limit per user and per IP
- Validate input shapes using Zod schemas
- Transform domain errors to HTTP responses

**Server Function Pattern:**

```typescript
// src/routes/api/v1/journal.server.ts
export const createJournalEntry = createServerFn(
  "POST",
  "/api/v1/journal",
  async (input: CreateJournalEntryInput) => {
    const session = await validateSession();
    await authorize(session.userId, "journal.write");
    const validated = createJournalEntrySchema.parse(input);
    const result = await journalService.createEntry(validated, session.userId);
    return result;
  },
);
```

### 3.3 Application Service Layer

**Location:** `src/server/services/`

**Responsibilities:**

- Orchestrate complex operations spanning multiple domain objects
- Manage transactions across multiple repositories
- Coordinate approval workflows and event notifications
- Generate report data from domain queries

**Example — Journal Service:**

```typescript
// src/server/services/journal.service.ts
export class JournalService {
  constructor(
    private journalRepo: JournalRepository,
    private ledgerRepo: GeneralLedgerRepository,
    private auditRepo: AuditRepository,
  ) {}

  async createEntry(input: CreateJournalEntryInput, userId: string): Promise<JournalEntry> {
    // 1. Validate debit/credit balance
    // 2. Validate all account IDs exist
    // 3. Validate period is open
    // 4. Create journal entry with lines within DB transaction
    // 5. Post to general ledger (update running balances)
    // 6. Audit the operation
    // 7. Return created entry
  }
}
```

### 3.4 Domain Layer

**Location:** `src/server/domain/`

**Responsibilities:**

- Define domain entities, value objects, and aggregates
- Implement business rules and invariants
- Define domain events

**Key Aggregates:**

- `JournalAggregate` — Journal entry + lines + balancing
- `PeriodAggregate` — Period opening/closing, balance carrying
- `ReconciliationAggregate` — Reconciliation with period chaining
- `ApprovalAggregate` — Transaction state machine, approver chains

### 3.5 Repository Layer

**Location:** `src/server/repositories/`

**Responsibilities:**

- Abstract database access behind interfaces
- Implement CRUD operations with proper transaction handling
- Implement Row-Level Security compliant queries

**Pattern:**

```typescript
// src/server/repositories/journal.repository.ts
export interface JournalRepository {
  create(tx: Transaction, entry: JournalEntry): Promise<string>;
  findById(id: string): Promise<JournalEntry | null>;
  findByPeriod(periodId: string): Promise<JournalEntry[]>;
  findByAccount(accountId: string, from: Date, to: Date): Promise<JournalEntry[]>;
}

export class PostgresJournalRepository implements JournalRepository {
  // Implementation using Drizzle ORM
}
```

### 3.6 Infrastructure Layer

**Location:** `src/server/infrastructure/`

**Responsibilities:**

- Database connection management and pooling
- File storage (receipts, attachments)
- External integrations (email, SMS, SIEM forward)
- Logging and metrics

---

## 4. Technology Stack

### 4.1 Selected Technologies

| Layer              | Technology                | Version | Justification                                |
| ------------------ | ------------------------- | ------- | -------------------------------------------- |
| Frontend Framework | React                     | 19.x    | Current project base                         |
| Meta Framework     | TanStack Start            | 1.x     | Current project base; SSR + server functions |
| Routing            | TanStack Router           | 1.x     | File-based routing; type-safe                |
| Server State       | TanStack Query            | 5.x     | Current project base                         |
| Styling            | Tailwind CSS              | 4.x     | Current project base                         |
| UI Components      | shadcn/ui + Radix         | Latest  | Current project base                         |
| Forms              | React Hook Form + Zod     | Latest  | Current project base                         |
| Charts             | Recharts                  | Latest  | Current project base                         |
| Icons              | Lucide React              | Latest  | Current project base                         |
| Build              | Vite                      | 6.x     | Current project base                         |
| Package Manager    | Bun                       | Latest  | Current project base                         |
| Database           | PostgreSQL                | 16.x    | ACID; RLS; PITR; Supabase managed            |
| ORM                | Drizzle ORM               | Latest  | Type-safe; SQL-like; migration support       |
| Auth               | Supabase Auth (modified)  | Latest  | Managed; JWT; httpOnly cookies               |
| File Storage       | Supabase Storage          | Latest  | S3-compatible; RLS                           |
| Monitoring         | Sentry                    | Latest  | Error tracking                               |
| Logging            | Pino                      | Latest  | Structured JSON logging                      |
| CI/CD              | GitHub Actions            | —       | Project hosted on GitHub                     |
| Hosting            | Supabase + Vercel/Railway | —       | Managed; Edge functions                      |

### 4.2 Technology Decision Rationale

**Why PostgreSQL over Firebase/MongoDB:**

- ACID transactions required for double-entry bookkeeping
- Row-Level Security enables defense-in-depth authorization
- Point-in-Time Recovery for audit compliance
- Referential integrity constraints to prevent orphan records
- DECIMAL type for exact financial calculations (no floating point)

**Why Drizzle ORM over Prisma:**

- Closer to SQL; easier to write complex financial queries
- Lighter weight; fewer abstraction layers to debug
- Better TypeScript type inference for financial aggregates
- Migration approach is more explicit and auditable

**Why TanStack Start over Next.js:**

- Current project is already on TanStack Start
- Server functions provide a natural boundary for server-side logic
- Type-safe routing integrated with the router

---

## 5. Component Architecture

### 5.1 Directory Structure (v2)

```
src/
├── routes/                          # File-based routing + server functions
│   ├── __root.tsx                   # Root layout
│   ├── _app.tsx                     # Authenticated app shell
│   ├── _app.dashboard.tsx           # Dashboard
│   ├── _app.journal.tsx             # Journal entries
│   ├── _app.ledger.tsx              # General ledger view
│   ├── _app.coa.tsx                 # Chart of accounts management
│   ├── _app.offering.tsx            # Offering entry + Sunday count
│   ├── _app.expense.tsx             # Expense entry
│   ├── _app.income.tsx              # Income entry
│   ├── _app.funds.tsx               # Fund management
│   ├── _app.transfers.tsx           # Fund transfers
│   ├── _app.reconciliation.tsx      # Reconciliation (persisted)
│   ├── _app.budget.tsx              # Budget management
│   ├── _app.reports.tsx             # Financial statements
│   ├── _app.members.tsx             # Member database
│   ├── _app.audit.tsx               # Audit trail viewer
│   ├── _app.settings.tsx            # System settings
│   ├── _app.profile.tsx             # User profile
│   ├── _app.projects.tsx            # Project management
│   ├── auth.tsx                     # Login page
│   ├── index.tsx                    # Landing/redirect
│   └── api/                         # Server functions
│       └── v1/
│           ├── auth.server.ts
│           ├── journal.server.ts
│           ├── accounts.server.ts
│           ├── funds.server.ts
│           ├── offerings.server.ts
│           ├── expenses.server.ts
│           ├── periods.server.ts
│           ├── reconciliation.server.ts
│           ├── budget.server.ts
│           ├── reports.server.ts
│           ├── members.server.ts
│           ├── audit.server.ts
│           └── settings.server.ts
│
├── server/                          # Server-side code
│   ├── domain/                      # Domain models & business rules
│   │   ├── chart-of-accounts.ts
│   │   ├── journal.ts
│   │   ├── general-ledger.ts
│   │   ├── fund-accounting.ts
│   │   ├── period.ts
│   │   ├── reconciliation.ts
│   │   ├── approval.ts
│   │   ├── budget.ts
│   │   └── events.ts               # Domain events
│   │
│   ├── services/                    # Application services
│   │   ├── journal.service.ts
│   │   ├── period.service.ts
│   │   ├── reconciliation.service.ts
│   │   ├── approval.service.ts
│   │   ├── report.service.ts
│   │   ├── budget.service.ts
│   │   ├── member.service.ts
│   │   └── auth.service.ts
│   │
│   ├── repositories/                # Data access
│   │   ├── journal.repo.ts
│   │   ├── ledger.repo.ts
│   │   ├── account.repo.ts
│   │   ├── fund.repo.ts
│   │   ├── offering.repo.ts
│   │   ├── expense.repo.ts
│   │   ├── period.repo.ts
│   │   ├── reconciliation.repo.ts
│   │   ├── budget.repo.ts
│   │   ├── member.repo.ts
│   │   ├── audit.repo.ts
│   │   └── user.repo.ts
│   │
│   ├── infrastructure/              # External integrations
│   │   ├── db.ts                    # Database connection + Drizzle client
│   │   ├── storage.ts              # Supabase Storage client
│   │   └── siem-forward.ts         # Audit log SIEM export
│   │
│   ├── auth/                        # Authentication & authorization
│   │   ├── session.ts              # Session validation
│   │   ├── permissions.ts          # Permission matrix
│   │   ├── rbac.ts                 # Role-based access control
│   │   └── mfa.ts                  # MFA service
│   │
│   ├── middleware/                   # Server function middleware
│   │   ├── auth.middleware.ts
│   │   ├── audit.middleware.ts
│   │   └── validation.middleware.ts
│   │
│   └── schemas/                     # Zod validation schemas
│       ├── journal.schema.ts
│       ├── offering.schema.ts
│       ├── expense.schema.ts
│       ├── period.schema.ts
│       └── ...
│
├── components/                      # UI components
│   ├── ui/                          # shadcn/ui base
│   ├── layout/                      # App shell, sidebar, navbar
│   ├── shared/                      # StatCard, MoneyText, etc.
│   ├── journal/                     # Journal-specific components
│   ├── reconciliation/              # Reconciliation components
│   ├── reports/                     # Report templates
│   └── forms/                       # Reusable form fields
│
├── hooks/                           # Client-side hooks
├── lib/                             # Shared utilities
│   ├── format.ts                    # Currency, date formatting
│   ├── constants.ts                 # App constants
│   └── utils.ts                     # General utilities
│
├── styles.css                       # Global styles
├── router.tsx                       # Route tree
├── routeTree.gen.ts                 # Generated routes
├── server.ts                        # SSR handler
└── start.ts                         # Dev server
```

---

## 6. Data Flow

### 6.1 Financial Transaction Flow

```
1. User fills form (e.g., expense entry)
2. React Hook Form validates client-side
3. TanStack Query mutation calls server function
4. Server function:
   a. Validates session (JWT from httpOnly cookie)
   b. Checks permission (e.g., 'expense.write')
   c. Validates input (Zod schema)
   d. Calls JournalService.createExpense():
      i.   Opens DB transaction
      ii.  Creates JournalEntry with debit/credit lines
      iii. Validates Σ debits = Σ credits
      iv.  Posts to General Ledger (updates running balances)
      v.   Checks fund balance (if overdraft → block + error)
      vi.  Applies approval state machine
      vii. Captures before/after state for audit
      viii.Inserts immutable audit log entry
      ix.  Commits transaction
   e. Returns created expense DTO
6. TanStack Query invalidates relevant cache keys
7. React re-renders with updated data
```

### 6.2 Report Generation Flow

```
1. User selects report type + date range
2. Server function:
   a. Validates session + permission
   b. Calls ReportService.generateXXX(from, to):
      i.   Queries general ledger for period range
      ii.  Aggregates by COA category
      iii. Maps to report line items
      iv.  Retrieves prior period data (comparatives)
      v.   Retrieves budget data (vs. actual)
      vi.  Returns structured report DTO
3. Client renders using Recharts + HTML tables
4. Export (PDF/Excel/CSV) on demand via server function
```

### 6.3 Reconciliation Flow

```
1. User navigates to reconciliation, selects period
2. Server function returns:
   - Period opening balance (from previous reconciliation)
   - All journal entries in period (summarized by fund)
   - System-calculated closing balance per fund
3. User enters actual balance per fund (from bank statement/cash count)
4. System calculates variance
5. User provides explanation for any variance
6. On submit:
   a. Server validates period is open for reconciliation
   b. Creates ReconciliationRecord (immutable)
   c. Chains to prior period's reconciliation
   d. Locks period (no further transactions allowed)
   e. Stores reconciliation snapshot
   f. Audit logs the reconciliation
```

---

## 7. Deployment Architecture

### 7.1 Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     CDN (Cloudflare)                     │
│              Static Assets + Edge Caching                │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Application Host (Vercel / Railway)          │
│  ┌───────────────────────────────────────────────────┐  │
│  │         TanStack Start Server (Node.js)             │  │
│  │  ┌─────────────┐  ┌──────────────────────────────┐ │  │
│  │  │ SSR Render  │  │ Server Functions (API)       │ │  │
│  │  └─────────────┘  └──────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase Cloud                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │           PostgreSQL 16 (Primary)                   │  │
│  │  ┌──────────────────────────────────────┐         │  │
│  │  │  RLS Policies                         │         │  │
│  │  │  Audit Log Table (append-only)        │         │  │
│  │  └──────────────────────────────────────┘         │  │
│  │  ┌──────────────────────────────────────┐         │  │
│  │  │  PITR (Point-in-Time Recovery)        │         │  │
│  │  │  Daily Full Backup + WAL Archiving    │         │  │
│  │  └──────────────────────────────────────┘         │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │           Supabase Storage (S3-compatible)           │  │
│  │  ┌──────────────────────────────────────┐         │  │
│  │  │  Receipts / Attachments                │         │  │
│  │  │  Exports (PDF, Excel, CSV)            │         │  │
│  │  └──────────────────────────────────────┘         │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│               External Services                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Sentry   │  │ SIEM     │  │ Email (Resend/SES)    │  │
│  │ (Errors) │  │ (Audit)  │  │ (Notifications)      │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Environment Strategy

| Environment | Purpose                | Data                                       |
| ----------- | ---------------------- | ------------------------------------------ |
| Development | Local development      | Docker PostgreSQL + seed data              |
| Staging     | Pre-production testing | Anonymized copy of production (daily sync) |
| Production  | Live church operations | Real financial data                        |

### 7.3 Backup Strategy

| Backup Type                | Frequency  | Retention                 |
| -------------------------- | ---------- | ------------------------- |
| Full database backup       | Daily      | 30 days                   |
| WAL archiving (PITR)       | Continuous | 7 days                    |
| Backup to secondary region | Weekly     | 90 days                   |
| Annual archive             | Yearly     | 7+ years (tax compliance) |

---

## 8. Cross-Cutting Concerns

### 8.1 Authentication

- **Method:** Password-based with bcrypt hashing (argon2id recommended)
- **Session:** httpOnly, Secure, SameSite=Strict JWT cookie
- **Expiry:** Configurable via Settings (default: 8 hours active, 15 min idle)
- **MFA:** TOTP-based for super_admin and treasurer roles
- **Rate Limiting:** 5 failed attempts → 15-minute lockout per user

### 8.2 Authorization

- **Framework:** Role-Based Access Control (RBAC)
- **Enforcement Points:** Server function middleware, RLS policies
- **Permission Model:** See AUTHORIZATION_MODEL.md

### 8.3 Audit Logging

- **Scope:** Every state mutation in the domain layer
- **Format:** Before/after snapshots, user, timestamp, IP, user agent
- **Integrity:** Cryptographic hash chain (SHA-256)
- **Storage:** Append-only table; forward to SIEM
- **Retention:** 7 years minimum

### 8.4 Error Handling

- **Server errors:** Structured JSON with error code, message, and correlation ID
- **Client errors:** Display toast notification; log to Sentry
- **Financial errors:** Block operation, return specific error code (INSUFFICIENT_FUNDS, PERIOD_CLOSED, etc.)
- **Validation errors:** Return field-level errors from Zod

### 8.5 Concurrency

- **Strategy:** Optimistic locking (version column on all mutable entities)
- **Conflict resolution:** Retry with fresh data; user resolves
- **Detection:** `UPDATE ... WHERE version = :expected_version`; check rows affected

---

## 9. API Design Standards

### 9.1 Endpoint Naming

All server functions are organized under `/api/v1/`:

| Resource        | Create                        | Read (list)              | Read (single)              | Update                 | Delete/Void                |
| --------------- | ----------------------------- | ------------------------ | -------------------------- | ---------------------- | -------------------------- |
| Journal Entries | POST `/journal`               | GET `/journal?from=&to=` | GET `/journal/:id`         | —                      | POST `/journal/:id/void`   |
| Accounts (COA)  | POST `/accounts`              | GET `/accounts`          | GET `/accounts/:id`        | PATCH `/accounts/:id`  | DELETE `/accounts/:id`     |
| Funds           | POST `/funds`                 | GET `/funds`             | GET `/funds/:id`           | PATCH `/funds/:id`     | POST `/funds/:id/close`    |
| Offerings       | POST `/offerings`             | GET `/offerings`         | GET `/offerings/:id`       | PATCH `/offerings/:id` | POST `/offerings/:id/void` |
| Expenses        | POST `/expenses`              | GET `/expenses`          | GET `/expenses/:id`        | —                      | POST `/expenses/:id/void`  |
| Periods         | POST `/periods/:id/close`     | GET `/periods`           | GET `/periods/:id`         | —                      | POST `/periods/:id/reopen` |
| Reconciliations | POST `/reconciliations`       | GET `/reconciliations`   | GET `/reconciliations/:id` | —                      | —                          |
| Budgets         | POST `/budgets`               | GET `/budgets`           | GET `/budgets/:id`         | PATCH `/budgets/:id`   | DELETE `/budgets/:id`      |
| Reports         | POST `/reports/balance-sheet` | —                        | —                          | —                      | —                          |
| Members         | POST `/members`               | GET `/members`           | GET `/members/:id`         | PATCH `/members/:id`   | DELETE `/members/:id`      |

### 9.2 Response Format

```typescript
// Success
{
  "data": T,
  "meta"?: {
    "total": number,
    "page": number,
    "pageSize": number
  }
}

// Error
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Fund 'General Fund' has insufficient balance: ฿5,000.00 available, ฿10,000.00 requested",
    "correlationId": "ck_abc123",
    "details"?: Record<string, string[]>  // Field-level errors
  }
}
```

### 9.3 Error Codes

| Code                    | HTTP Status | Meaning                           |
| ----------------------- | ----------- | --------------------------------- |
| VALIDATION_ERROR        | 400         | Input validation failed           |
| UNAUTHORIZED            | 401         | Missing or invalid session        |
| FORBIDDEN               | 403         | Insufficient permissions          |
| NOT_FOUND               | 404         | Entity not found                  |
| CONFLICT                | 409         | Optimistic lock conflict          |
| INSUFFICIENT_FUNDS      | 422         | Fund balance too low              |
| PERIOD_CLOSED           | 422         | Period is closed for transactions |
| PERIOD_ALREADY_CLOSED   | 422         | Period is already closed          |
| RECONCILIATION_REQUIRED | 422         | Prior period not reconciled       |
| SELF_APPROVAL           | 422         | Cannot approve own transaction    |
| INVALID_TRANSITION      | 422         | Status transition not allowed     |
| RATE_LIMITED            | 429         | Too many requests                 |
| INTERNAL_ERROR          | 500         | Unexpected error                  |

---

## 10. Error Handling Strategy

### 10.1 Server-Side

```typescript
// Domain errors as typed exceptions
export class InsufficientFundsError extends DomainError {
  constructor(
    public readonly fundId: string,
    public readonly fundName: string,
    public readonly available: Money,
    public readonly requested: Money,
  ) {
    super(
      "INSUFFICIENT_FUNDS",
      `Fund '${fundName}' has insufficient balance: ${available.format()} available, ${requested.format()} requested`,
    );
  }
}

// Server function catches domain errors and transforms to HTTP responses
function handleServerError(error: unknown): APIErrorResponse {
  if (error instanceof DomainError) {
    return {
      error: { code: error.code, message: error.message, correlationId: getCorrelationId() },
    };
  }
  if (error instanceof ZodError) {
    return {
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        correlationId: getCorrelationId(),
        details: error.flatten().fieldErrors,
      },
    };
  }
  // Unexpected error
  Sentry.captureException(error);
  return {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      correlationId: getCorrelationId(),
    },
  };
}
```

### 10.2 Client-Side

```typescript
// TanStack Query mutation with error handling
const createExpense = useMutation({
  mutationFn: (input: CreateExpenseInput) => api.createExpense(input),
  onError: (error: APIError) => {
    switch (error.code) {
      case "INSUFFICIENT_FUNDS":
        toast.error(`กองทุนมียอดคงเหลือไม่เพียงพอ: ${error.message}`);
        break;
      case "PERIOD_CLOSED":
        toast.error("ไม่สามารถบันทึกรายการได้: งวดบัญชีปิดแล้ว");
        break;
      default:
        toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
  },
});
```

---

## 11. Performance Architecture

### 11.1 Query Optimization

- **General Ledger:** Partitioned by fiscal_year for efficient period queries
- **Indexing Strategy:** See DATABASE_V2.md
- **Report Generation:** Materialized views for frequently used aggregations
- **Pagination:** Cursor-based for all list endpoints (not offset-based)
- **Caching:** TanStack Query cache on client; Redis (optional) for report cache

### 11.2 Financial Calculation Performance

- Running balances stored, not computed — O(1) balance reads
- Trial balance: Aggregated from general_ledger with indexed date ranges
- Period close: Single transaction that snapshots balances (not recalculated)
- Reports: Built from materialized views refreshed on period close

### 11.3 Attachment Handling

- Max file size: 10MB per attachment
- Stored in Supabase Storage (S3-compatible) — never in database
- Thumbnails generated server-side for image previews
- Signed URLs with 1-hour expiry for secure access

---

## 12. Monitoring & Observability

### 12.1 Metrics

| Metric                    | Source        | Alert Threshold  |
| ------------------------- | ------------- | ---------------- |
| API latency (p95)         | Server        | > 2s             |
| Database query time (p95) | Drizzle logs  | > 500ms          |
| Error rate                | Sentry        | > 1% of requests |
| Failed login attempts     | Auth logs     | > 10/min         |
| Fund overdraft events     | Domain events | Any occurrence   |
| Period close failures     | Domain events | Any occurrence   |
| Backup failures           | Supabase      | Any failure      |
| Reconciliation mismatches | Domain events | Any occurrence   |
| PITR lag                  | Supabase      | > 1 hour         |

### 12.2 Logging

```typescript
// Structured JSON logging with Pino
logger.info({
  event: "journal_entry_created",
  journalId: entry.id,
  userId: userId,
  amount: entry.totalAmount.toNumber(),
  accountCount: entry.lines.length,
  correlationId: ctx.correlationId,
});
```

### 12.3 Health Check

```
GET /api/health
→ {
    "status": "ok",
    "checks": {
      "database": "ok",
      "storage": "ok",
      "migrations": "current"
    },
    "version": "2.0.0",
    "uptime": 123456
  }
```

---

_This architecture document is the authoritative reference for Grace Ledger v2 system design. All implementation decisions must align with the principles and patterns described here. Deviations require architecture review._

_Next: See DATABASE_V2.md for the database schema design, and ACCOUNTING_ENGINE.md for the double-entry accounting domain model._
