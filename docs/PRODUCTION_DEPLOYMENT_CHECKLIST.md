# GRACE LEDGER — PRODUCTION DEPLOYMENT CHECKLIST

## 1. Zero-Trust Security Pre-Flight

- [x] **Strict Server Boundary**: AI Tool Executor enforces server-defined `ai_agent_id = 'grace_ai_v1'`, overriding any client or prompt injection.
- [x] **No Direct Financial Execution for AI**: Grace AI capabilities are strictly constrained to `READ | DRAFT | ACTION_PROPOSAL`.
- [x] **Atomic Financial Execution Endpoint**: Financial actions are only committed via `execute_confirmed_financial_action` (Migration 016) in a single database transaction.
- [x] **Server-Side Confirmation State**: Confirmations are signed with canonical SHA-256 payload hashes, 5-minute TTL, single-use `consumed` lock, and crypto nonces.
- [x] **Tenant & RBAC Isolation**: All tables and RPCs enforce `church_id` filtering and RBAC role checks (`super_admin` / `treasurer` required for execution).
- [x] **Sensitive Giving Protection**: Member Giving tools require authorized roles + mandatory audit access reason.

---

## 2. Database Migration Deployment Order

Migrations must be run sequentially against PostgreSQL 17+:

1. `supabase/migrations/001_core_schema.sql` (Foundational church, profile, account, category, fund, transaction tables)
2. `supabase/migrations/002_rbac_and_rls.sql` (Multi-tenant RLS policies and user roles)
3. `supabase/migrations/003_audit_logging.sql` (Audit log schema and triggers)
4. `supabase/migrations/004_approval_workflow.sql` (Approval thresholds and review workflow)
5. `supabase/migrations/005_sunday_offering.sql` (Sunday offering sessions and items)
6. `supabase/migrations/006_cash_denomination.sql` (Cash denomination breakdowns)
7. `supabase/migrations/007_variance_and_reconciliation.sql` (Variance resolution and audit)
8. `supabase/migrations/008_reports_and_analytics.sql` (Financial statements & reports RPCs)
9. `supabase/migrations/009_members_and_giving.sql` (Pledges, envelopes, and giving history)
10. `supabase/migrations/010_budgets_and_funds.sql` (Fund budgeting and transfers)
11. `supabase/migrations/011_ai_governance.sql` (AI tool governance logs)
12. `supabase/migrations/012_production_hardening.sql` (Indexes and constraints)
13. `supabase/migrations/013_offering_session_items_category_nullable.sql` (Fix offering item category nullability)
14. `supabase/migrations/014_idempotency_keys.sql` (Financial idempotency engine)
15. `supabase/migrations/015_action_confirmations.sql` (Server-backed action confirmation storage)
16. `supabase/migrations/016_financial_action_execution_orchestrator.sql` (Atomic confirmed action executor)

---

## 3. Environment Configuration Validation

| Variable Name | Environment | Required Scope |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Client / Frontend | Public HTTPS endpoint |
| `VITE_SUPABASE_ANON_KEY` | Client / Frontend | Public Anonymous JWT Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server / Backend / Edge | **STRICTLY SERVER-SIDE ONLY** (Never expose to client or Hermes) |

---

## 4. Post-Deployment Verification Commands

```bash
# 1. Typecheck entire codebase (0 errors required)
npm run typecheck

# 2. Build production bundle (0 errors required)
npm run build

# 3. Execute all 43 test suites (100% pass required)
npm test
```
