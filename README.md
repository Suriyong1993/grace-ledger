# Grace Ledger v2 — Church Accounting & Financial Controls Platform

[![Production Status](https://img.shields.io/badge/Production--Ready-100%25-brightgreen.svg)](#production-readiness)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-blue.svg)](https://react.dev/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle--ORM-0.45-orange.svg)](https://orm.drizzle.team/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)

Grace Ledger v2 is a modern, enterprise-grade church accounting platform designed for strict financial integrity, double-entry bookkeeping, segregated approval workflows, and immutable per-church audit trails.

---

## Key Features & Architectural Highlights

- **Double-Entry Accounting Engine:** Every financial transaction creates balanced debits and credits across assets, liabilities, equity, income, and expenses.
- **Tenant Isolation & RLS:** Multi-tenant architecture with mandatory `church_id` scoping and Row Level Security (RLS).
- **Per-Church Audit Trail:** SHA-256 hash chaining on all audit entries per church to guarantee tampering detection.
- **Segregation of Duties & Dual Approval:** Automated financial controls preventing self-approval and requiring dual `super_admin` approval for transactions exceeding ฿50,000.
- **In-Memory & Cloud Database Compatibility:** Embedded PGlite WebAssembly PostgreSQL engine for instant zero-dependency testing, seamlessly switching to managed Supabase / PostgreSQL in production.
- **Secure AI OCR Proxy:** Server-side proxy (`/api/ai/parse-document`, `/api/ai/parse-church-form`) for Fireworks AI (Kimi-K3) and Google Gemini 2.0 Flash to parse receipts, bank slips, and handwritten church forms without exposing API keys to the browser.

---

## Tech Stack

- **Frontend:** React 19, TanStack Router, TanStack Start, Tailwind CSS v4, shadcn/ui, Lucide Icons, Framer Motion
- **Backend:** TanStack Start (SSR), Express/Nitro API server, Drizzle ORM
- **Database Engine:** PostgreSQL 16 (Supabase compatible) / PGlite (in-memory test engine)
- **Authentication & Security:** JWT sessions + Supabase Auth, Argon2/bcrypt password hashing, httpOnly cookies
- **AI Vision OCR:** Fireworks AI (`kimi-k3`), Google Gemini (`gemini-2.0-flash`)

---

## Quick Start & Local Development

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0

### Installation

```bash
# Install dependencies
npm install
```

### Environment Configuration

Copy `.env.example` to `.env.local` and set required environment variables:

```bash
cp .env.example .env.local
```

Example `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
NODE_ENV=development
APP_URL=http://localhost:3000
FIREWORKS_API_KEY=fw_your-api-key-here
JWT_SECRET=super_secret_jwt_signing_key_for_environment_2026_grace_ledger_v2
```

### Development Commands

```bash
# Start local dev server
npm run dev

# Run TypeScript typecheck
npm run typecheck

# Run linter
npm run lint

# Format code with Prettier
npm run format

# Run full test suite (PGlite in-memory Postgres)
npm test

# Build production bundle
npm run build
```

---

## Test Infrastructure

Integration and domain tests run against an embedded **PGlite WebAssembly PostgreSQL** engine in Node.js. No local Docker daemon or external Postgres installation is required to execute tests.

```bash
# Run all tests (51 assertions)
npm test
```

All 51 test cases cover:

1. Monetary domain calculations & formatting
2. Validation schemas & password strength requirements
3. Role-based authorization & approval threshold rules
4. Balanced journal entry creation & unbalanced entry rejection
5. Fund balance management & non-equity account linkage rejection
6. Fiscal period opening & draft entry lock enforcement
7. Inter-fund transfers & reconciliation creation
8. Audit log creation & SHA-256 hash chain verification

---

## Production Deployment

### Option 1: Docker (Recommended for Dedicated/Cloud Servers)

Use the included production [docker-compose.yml](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/docker-compose.yml):

```bash
# 1. Create production .env file
cp .env.example .env

# 2. Build and start containers
docker compose up -d --build
```

### Option 2: Vercel + Supabase Managed Cloud

1. Connect the repository to Vercel.
2. In Vercel Project Settings > Environment Variables, configure:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `FIREWORKS_API_KEY`
   - `JWT_SECRET`
   - `APP_URL`
3. Execute SQL migrations `001_init_schema.sql` through `008_create_missing_tables.sql` in the Supabase SQL Editor.
4. Enable Supabase Point-In-Time Recovery (PITR) in Supabase Project Settings.

---

## Security Policy

- **No Secrets in Client Code:** Server-side environment variables (`FIREWORKS_API_KEY`, `JWT_SECRET`) are never prefixed with `VITE_` and are kept strictly within server proxy endpoints.
- **Tenant Isolation:** All queries filter on `church_id` enforced by Row Level Security (RLS) policies.
- **Immutable Audit Trail:** Audit logs are insert-only. Verification of hash integrity is available via `AuditService.verifyChain()`.
