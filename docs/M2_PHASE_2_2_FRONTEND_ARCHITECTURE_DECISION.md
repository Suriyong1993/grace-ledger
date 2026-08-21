# Architecture Decision Record (ADR): M2 Phase 2.2 — Frontend Application Shell & Routing Architecture

**Project:** Grace Ledger  
**Milestone:** M2 — Core Financial Workflows  
**Sub-Phase:** Phase 2.2 — Application Integration  
**Date:** 2026-08-18  
**Status:** **PROPOSED & PENDING PRODUCT OWNER APPROVAL (STOPPED BEFORE IMPLEMENTATION)**  

---

## 1. Context & Problem Statement

Milestones M1 Foundation, M2 Phase 1 (Transaction Core), and M2 Phase 2.1 (Governance Semantics) have been verified on real Supabase PostgreSQL 17 with 100% test pass rates (73 unit tests, 11 real database integration tests).

However, an audit of the frontend repository reveals:
1. There is no active SPA entry point (`index.html`, `src/main.ts`, or `src/App.ts`) in the repository root.
2. The UI components in `src/components/approvals/` (`ApprovalsQueueView`, `ApprovalDecisionSheet`, `ProjectedBalanceCard`, `RejectionModal`, `StatusBadge`) are pure, verified TypeScript modules but are not yet mounted to a top-level browser runtime.
3. A complete UI Kit and layout shell exists in `design-system-extracted/ui_kits/grace-ledger/` (`Sidebar.jsx`, `Topbar.jsx`, `Dashboard.jsx`, `Approvals.jsx`) and `mockups-extracted/` with CSS tokens in `design-system-extracted/tokens/`.

Before writing code, we must make a formal architecture decision to establish the **smallest safe application shell and routing mechanism** without creating unnecessary abstractions or introducing unneeded dependencies.

---

## 2. Repository Investigation Findings

A comprehensive scan of the repository discovered:
- **`package.json`**: Configured with Vite (`"dev": "vite"`, `"build": "tsc --noEmit"`), TypeScript 5.8, `@supabase/supabase-js`, `decimal.js`, `zod`, and `vitest`. No third-party routing framework (`react-router`, `tanstack-router`, etc.) is installed.
- **`design-system-extracted/ui_kits/grace-ledger/`**: Contains an established HTML/JS application prototype where an `App` shell coordinates navigation across `Sidebar`, `Topbar`, `Dashboard`, `IncomeEntry`, and `Approvals`.
- **`design-system-extracted/tokens/`**: Contains complete, structured CSS design tokens (`colors.css`, `typography.css`, `spacing.css`, `radius.css`, `shadows.css`, `motion.css`, `fonts.css`, `base.css`).
- **`mockups-extracted/`**: Contains mobile and responsive layout specifications matching the product requirements (Thai typography via Sarabun, Arabic numerals with Inter `.num-display`, tabular financial alignment).

---

## 3. Evaluation of Architectural Options

### Option A: Minimal Vite SPA with React + External Router Library
- **Description**: Install `react-router` or `@tanstack/react-router`, setup router configuration, and mount components.
- **Pros**: Standard ecosystem practice for large SPAs.
- **Cons**: Adds new npm dependencies; high complexity for a 3-route workflow; introduces unnecessary abstractions at this early milestone.
- **Verdict**: **Rejected (Too Heavy)**.

### Option B: Reuse Discovered Prototype Runtime As-Is (Babel standalone script tags)
- **Description**: Copy `design-system-extracted/ui_kits/grace-ledger/index.html` with unbundled CDN script tags and in-browser Babel compilation.
- **Pros**: Direct reuse of prototype files.
- **Cons**: Not type-safe, does not integrate with Vite bundler, difficult to unit test with Vitest, and unsuitable for production financial applications.
- **Verdict**: **Rejected (Unsafe / Lacks Type Safety)**.

### Option C: Minimal Native Vite Application Shell with Lightweight Client Router (SELECTED)
- **Description**:
  1. Create a clean `index.html` entrypoint for Vite.
  2. Create `src/styles/app.css` importing the canonical design tokens from `design-system-extracted/tokens/`.
  3. Implement a zero-dependency, type-safe client router (`src/router.ts`) supporting hash/path navigation (`/`, `/approvals`, `/approvals/:id`).
  4. Create an Application Shell (`src/components/layout/AppShell.ts`) adapting the proven `Sidebar` + `Topbar` structure from `design-system-extracted/ui_kits/grace-ledger/`.
  5. Connect `ApprovalsPage` to the verified `ApprovalsService` and live Supabase client.
- **Pros**:
  - **Zero extra dependencies** (uses existing Vite + TypeScript).
  - **100% Type-safe** and fully testable in Vitest.
  - Reuses the canonical Design System tokens and UI layout without visual divergence.
  - Future-proof: Easily extensible to M2 Phase 3 (Direct Post), M3 (Offerings), and M4 (Reports).
- **Verdict**: **ACCEPTED (Smallest Safe Option)**.

---

## 4. Architectural Decision: Option C (Minimal Safe Shell + Native Router)

```text
index.html (Vite Entrypoint)
  ↓
src/main.ts (Bootstrap)
  ↓
src/router.ts (Lightweight Route Matcher)
  ├── "/"              → DashboardPage (KPIs, Recent Activity, Pending Alert Badge)
  ├── "/approvals"     → ApprovalsPage (Queue Inbox, Filters, Projected Balance Summaries)
  └── "/approvals/:id" → ApprovalDecisionSheet (Detail, Two-Person Guard, Action Trio)
  ↓
AppShell (Sidebar + Topbar + Content Area)
  ↓
ApprovalsService
  ↓
Real Supabase PostgreSQL 17 (RPCs & RLS)
```

### Why Option C is the Smallest Safe Change
1. **Zero New Dependencies**: Requires no new packages in `package.json`.
2. **Preserves Working Code**: Fully preserves all 73 verified unit tests and existing service interfaces.
3. **True Design System Fidelity**: Directly consumes CSS variables from `design-system-extracted/tokens/`.
4. **Deterministic Behavior**: URL changes trigger clean DOM updates with proper teardown.

---

## 5. Route Contract & Application Mapping

| URL Route | Page / Controller | Service Method | Supabase Operation |
| :--- | :--- | :--- | :--- |
| **`/`** | `DashboardPage` | `ApprovalsService.getPendingApprovals()` | Reads pending count for *"ต้องการให้คุณตรวจสอบ (X เรื่อง)"* alert banner. |
| **`/approvals`** | `ApprovalsPage` (Queue View) | `ApprovalsService.getPendingApprovals()` | Queries `transactions` + `transaction_splits` + `accounts` (`status = 'pending_approval'`). |
| **`/approvals/:id`** | `ApprovalsPage` (Decision Detail) | `ApprovalsService.approveTransaction()` / `requestRevision()` / `rejectTransactionTerminal()` | Invokes atomic RPCs (`approve_transaction`, `request_transaction_revision`, `reject_transaction_terminal`). |

---

## 6. Security Model & Separation of Duties

1. **No Client-Side Security Reliance**: The UI enforces UX state (e.g., disabling buttons for creator self-approval), but the **database RPCs remain the authoritative security boundary**.
2. **Two-Person Rule**: If `auth.uid() === transaction.created_by`, the "อนุมัติ" button is disabled in UI with a Thai warning banner (*"คุณเป็นผู้สร้างรายการนี้ — ต้องให้ผู้อนุมัติท่านอื่นเป็นผู้พิจารณา"*). If bypassed via API, the database RPC raises exception `P0003`.
3. **No `service_role` Exposure**: Browser client strictly uses `anon` public key and authenticates users via JWT.
4. **Strict RLS**: All queries are constrained by `church_id = current_user_church_id()`.

---

## 7. Clarification on Test Terminology (Integration vs E2E)

Per Product Owner directive, test levels are strictly defined:

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Pure Unit Tests (vitest)                                 │
│    - Mathematical precision (Money, ProjectedBalanceEngine) │
│    - Lifecycle State Machine (canTransition)               │
│    - Split parity rules (SplitEngine)                       │
├─────────────────────────────────────────────────────────────┤
│ 2. Database Integration Tests (Node -> Supabase)            │
│    - Node test scripts (scripts/m2_phase2_1_...mjs)         │
│    - Executes real SQL / RPCs on PostgreSQL 17              │
│    - Validates RLS, Triggers, Two-Person Rule, Audits       │
├─────────────────────────────────────────────────────────────┤
│ 3. E2E Tests (Browser -> DOM -> Service -> Supabase)        │
│    - Real browser session                                   │
│    - User clicks, route navigation, modal inputs, DOM updates│
└─────────────────────────────────────────────────────────────┘
```

> **Rule**: Node-only test scripts that call Supabase directly shall be designated as **Integration Tests**, reserving the term **E2E Tests** exclusively for verified browser-driven workflows.

---

## 8. Files to be Added / Modified in Phase 2.2

### New Files
1. `index.html`: Web application entrypoint referencing fonts and `src/main.ts`.
2. `src/styles/app.css`: Root application stylesheet importing design system tokens (`tokens/base.css`, `colors.css`, `typography.css`, etc.).
3. `src/lib/supabase/client.ts`: Supabase browser client factory.
4. `src/router.ts`: Lightweight, typed client-side router (`initRouter`, `navigate`, `onRoute`).
5. `src/components/layout/AppShell.ts`: Layout shell with Sidebar, Topbar, and dynamic content area.
6. `src/pages/DashboardPage.ts`: Dashboard overview with pending approvals counter.
7. `src/pages/ApprovalsPage.ts`: Page controller integrating queue view, detail decision sheet, and action modals.
8. `src/main.ts`: Application bootstrap mounting `AppShell` into `#app`.
9. `tests/unit/app-router.test.ts`: Unit tests for router path matching and query param extraction.
10. `scripts/m2_phase2_2_integration_test.mjs`: Integration test verifying full service-to-database workflow.

---

## 9. Definition of Done for M2 Phase 2.2

- [ ] Architecture Decision approved by Product Owner.
- [ ] Application entrypoint (`index.html` + `src/main.ts` + `AppShell`) created and verified with `npm run dev`.
- [ ] Routes `/`, `/approvals`, `/approvals/:id` resolve smoothly with zero console errors.
- [ ] Approval Queue displays real pending transactions from live Supabase PostgreSQL 17.
- [ ] Detail view renders hero amount, two-person guard banner, and real-time projected fund balances.
- [ ] "อนุมัติ", "ขอแก้ไข", and "ปฏิเสธ" actions execute successfully against live Supabase RPCs.
- [ ] Concurrency/stale state (`P0001`) displays friendly Thai warning and refresh button.
- [ ] All unit tests pass (`npm test`).
- [ ] `npm run typecheck` and `npm run build` pass with 0 errors.
- [ ] Real database integration test (`scripts/m2_phase2_2_integration_test.mjs`) passes 100%.
