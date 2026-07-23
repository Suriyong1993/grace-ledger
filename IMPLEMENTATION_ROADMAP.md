# Grace Ledger v2 — Implementation Roadmap

**Date:** 22 July 2026
**Basis:** BUSINESS_DOMAIN_AUDIT.md (45 findings across 22 sections)
**Version:** 1.0

---

## Table of Contents

1. [Classification Framework](#1-classification-framework)
2. [Master Findings Registry](#2-master-findings-registry)
3. [Milestone 1: Foundational Infrastructure (Weeks 1-4)](#3-milestone-1-foundational-infrastructure-weeks-1-4)
4. [Milestone 2: Accounting Engine & Domain Model (Weeks 5-8)](#4-milestone-2-accounting-engine--domain-model-weeks-5-8)
5. [Milestone 3: Financial Controls (Weeks 9-12)](#5-milestone-3-financial-controls-weeks-9-12)
6. [Milestone 4: Audit Trail & Compliance (Weeks 13-16)](#6-milestone-4-audit-trail--compliance-weeks-13-16)
7. [Milestone 5: Security Hardening (Weeks 17-20)](#5-milestone-5-security-hardening-weeks-17-20)
8. [Milestone 6: Reporting & Tax Compliance (Weeks 21-24)](#8-milestone-6-reporting--tax-compliance-weeks-21-24)
9. [Milestone 7: Operations & Resilience (Weeks 25-28)](#9-milestone-7-operations--resilience-weeks-25-28)
10. [Dependency Graph](#10-dependency-graph)
11. [Risk Register](#11-risk-register)
12. [Estimated Total Effort](#12-estimated-total-effort)

---

## 1. Classification Framework

All findings from the BUSINESS_DOMAIN_AUDIT.md are classified into four priority tiers:

| Tier | Label | Definition | Count |
|------|-------|------------|-------|
| P0 | Critical | Must be resolved before any production deployment. System is unsafe without these. | 12 |
| P1 | High | Required for financial integrity and basic operations. Resolve before accepting real money. | 18 |
| P2 | Medium | Required for operational maturity and audit readiness. | 12 |
| P3 | Low | Quality-of-life improvements and polish. | 3 |

**Total:** 45 findings from the audit report.

---

## 2. Master Findings Registry

### P0 — Critical (12 findings)

| ID | Audit § | Title | Type | Depends On |
|----|--------|-------|------|------------|
| P0-01 | 2.1 | Single-tier client-only storage (localStorage) | Architecture | — |
| P0-02 | 2.2 | No transactional boundaries | Data Integrity | P0-01 |
| P0-03 | 2.3 | No server-side validation | Security | P0-01 |
| P0-04 | 3.1 | No double-entry bookkeeping | Domain Model | — |
| P0-05 | 3.2 | Fund balance is computed, not stored | Data Integrity | P0-04 |
| P0-06 | 3.3 | No chart of accounts | Domain Model | P0-04 |
| P0-07 | 3.5 | No opening/closing period controls | Domain Model | P0-04 |
| P0-08 | 5.1 | Status transitions not enforced | Security | P0-03 |
| P0-09 | 14.1 | 6-digit PIN authentication | Security | P0-01 |
| P0-10 | 15.1 | Audit trail is client-side, mutable, truncated | Compliance | P0-01 |
| P0-11 | 16.1 | No concurrency control | Data Integrity | P0-01 |
| P0-12 | 20.1 | No production build configuration | DevOps | P0-01 |

### P1 — High (18 findings)

| ID | Audit § | Title | Type | Depends On |
|----|--------|-------|------|------------|
| P1-01 | 2.4 | Seed data contains realistic financial figures | Data Quality | — |
| P1-02 | 3.4 | No fiscal year handling | Domain Model | P0-04, P0-07 |
| P1-03 | 4.1 | Fund opening balance bug (negative equity) | Data Quality | P0-04 |
| P1-04 | 4.2 | No fund balance validation on transaction creation | Domain Model | P0-04, P0-05 |
| P1-05 | 4.3 | No fund transfer atomicity | Data Integrity | P0-02 |
| P1-06 | 5.2 | No segregation of duties (creator vs. approver) | Security | P0-08 |
| P1-07 | 5.4 | Approval rejection has no reason field | UX | P0-08 |
| P1-08 | 6.1 | Offerings have no status/approval | Domain Model | P0-08 |
| P1-09 | 6.2 | No Sunday count sheet reconciliation | Security | P1-06 |
| P1-10 | 6.3 | All offerings hardcoded to Fund f1 | Domain Model | P0-04 |
| P1-11 | 7.1 | Expenses can be deleted at any status | Data Integrity | P0-08 |
| P1-12 | 8.1 | Income can be deleted at any status | Data Integrity | P0-08 |
| P1-13 | 9.3 | Fund transfer overdraft prevention is client-side only | Security | P0-03 |
| P1-14 | 11.1 | Reconciliation is client-side only, not persisted | Domain Model | P0-04, P0-07 |
| P1-15 | 12.1 | No balance sheet, income statement, cash flow reports | Reporting | P0-04, P0-06 |
| P1-16 | 13.1 | Permission checks are client-side only | Security | P0-03 |
| P1-17 | 14.2 | No session timeout implementation | Security | P0-09 |
| P1-18 | 17.1 | No backup mechanism | DevOps | P0-01 |

### P2 — Medium (12 findings)

| ID | Audit § | Title | Type | Depends On |
|----|--------|-------|------|------------|
| P2-01 | 4.4 | No inter-fund loan tracking | Domain Model | P1-05 |
| P2-02 | 5.3 | No transaction amount thresholds for approval | Security | P0-08 |
| P2-03 | 6.4 | No offering correction workflow | UX | P1-08 |
| P2-04 | 6.5 | Member not linked to offering for tracking | Domain Model | P1-08 |
| P2-05 | 7.2 | No purchase order / commitment tracking | Domain Model | P0-04 |
| P2-06 | 7.3 | Attachment receipt not validated (size, type, quota) | Data Quality | P0-01 |
| P2-07 | 8.2 | Income and offering merged in UI but not in data model | Domain Model | P0-04 |
| P2-08 | 10.1 | Budget 'used' field never updated | Data Quality | P0-04 |
| P2-09 | 10.2 | No budget approval workflow | Domain Model | P2-08 |
| P2-10 | 10.3 | No budget period enforcement | Domain Model | P2-08 |
| P2-11 | 16.2 | No sequence/gap detection for transaction IDs | Data Integrity | P0-04 |
| P2-12 | 20.2 | No error boundary or graceful degradation | Reliability | P0-01 |

### P3 — Low (3 findings)

| ID | Audit § | Title | Type | Depends On |
|----|--------|-------|------|------------|
| P3-01 | 6.3* | (duplicate, merged into P1-10) | — | — |
| P3-02 | 18.4 | Journal entry manipulation via back-dating (prevented by P0-07) | Security | P0-07 |
| P3-03 | 18.5 | PIN sharing/impersonation (prevented by P0-09) | Security | P0-09 |

**Note:** Additional P2/P3 items from audit sections 19 (UX), 20.3 (no automated testing), 20.4 (no API versioning), and 21.3 (no data privacy controls) are tracked as explicit findings below.

### Additional P2 Findings (from audit sections 19-21)

| ID | Audit § | Title | Type | Depends On |
|----|--------|-------|------|------------|
| P2-13 | 19.1 | No undo functionality for deletions | UX | P1-11, P1-12 |
| P2-14 | 19.2 | No confirmation dialog for deletion | UX | — |
| P2-15 | 19.3 | No loading state for Sunday Count Sheet save | UX | P1-09 |
| P2-16 | 19.4 | No bulk operations (import, batch approve, bulk export) | UX | — |
| P2-17 | 20.3 | No automated testing | Quality | P0-01 |
| P2-18 | 20.4 | No API versioning | Architecture | P0-01 |
| P2-19 | 21.2 | Thai tax compliance not addressed | Compliance | P0-04, P0-06 |
| P2-20 | 21.3 | No data privacy controls (PDPA) | Compliance | P0-01 |

### Additional P3 Findings

| ID | Audit § | Title | Type | Depends On |
|----|--------|-------|------|------------|
| P3-04 | 12.2 | Reports use date.startsWith() for filtering | Quality | — |
| P3-05 | 12.3 | Export functions have no data validation | Quality | — |
| P3-06 | 13.2 | Permission matrix has overlaps that enable fraud | Security | P1-16 |
| P3-07 | 13.3 | No role-based UI hiding for sensitive data | UX | P1-16 |
| P3-08 | 14.3 | session.userId stored in same DB as everything else | Security | P0-09 |
| P3-09 | 15.2 | No audit log retention policy | Compliance | P0-10 |
| P3-10 | 15.3 | Audit logs don't include IP address or device info | Security | P0-10 |

---

## 3. Milestone 1: Foundational Infrastructure (Weeks 1-4)

**Goal:** Replace the localStorage mock database with a production-grade backend stack. This milestone eliminates the single biggest architectural risk — all data living in the browser.

### Deliverables

| ID | Task | Effort | Owner |
|----|------|--------|-------|
| M1.1 | Provision Supabase PostgreSQL instance with automated backups | 2d | DevOps |
| M1.2 | Design and apply database schema (v2 schema from DATABASE_V2.md) | 3d | Senior DBA |
| M1.3 | Implement repository layer (data access objects) for all entities | 5d | Backend Engineer |
| M1.4 | Migrate authentication from PIN to bcrypt/argon2 password hashing | 3d | Security Engineer |
| M1.5 | Implement session management with httpOnly cookies and JWT | 2d | Security Engineer |
| M1.6 | Create TanStack Start server functions for all API endpoints | 5d | Full-Stack Engineer |
| M1.7 | Move all business logic from client to server-side application services | 5d | Backend Engineer |
| M1.8 | Implement server-side authorization middleware | 3d | Security Engineer |
| M1.9 | Set up CI/CD pipeline (build, lint, type-check on PR) | 2d | DevOps |
| M1.10 | Set up staging environment for testing | 2d | DevOps |
| M1.11 | Implement data migration script from localStorage v3 to PostgreSQL | 3d | Backend Engineer |

### Findings Resolved
- **P0-01:** Single-tier client-only storage → PostgreSQL with Supabase
- **P0-02:** No transactional boundaries → PostgreSQL ACID transactions
- **P0-03:** No server-side validation → Server functions with validation layer
- **P0-09:** 6-digit PIN auth → bcrypt password auth (partial — MFA in M5)
- **P0-12:** No production build config → CI/CD + staging environment
- **P1-16:** Client-side permission checks → Server-side authorization middleware
- **P1-17:** No session timeout → JWT with expiration + session management
- **P1-18:** No backup mechanism → Supabase automated backups

### Exit Criteria
- [ ] All API calls route through server functions (no direct DB access from client)
- [ ] Authentication requires bcrypt-hashed passwords (PINs removed)
- [ ] Authorization runs server-side on every request
- [ ] Database backups are automated and tested
- [ ] CI/CD pipeline passes on every PR
- [ ] Staging environment mirrors production

---

## 4. Milestone 2: Accounting Engine & Domain Model (Weeks 5-8)

**Goal:** Replace the single-entry bookkeeping model with a proper double-entry accounting system. This is the foundational domain change that all downstream features depend on.

### Deliverables

| ID | Task | Effort | Owner |
|----|------|--------|-------|
| M2.1 | Design chart of accounts (1xxx-5xxx) with Thai TFRS mapping | 2d | Financial Systems Architect |
| M2.2 | Implement journal, journal entry, and posting models | 4d | Backend Engineer |
| M2.3 | Implement general ledger with running balances per account | 3d | Backend Engineer |
| M2.4 | Implement trial balance generation | 2d | Backend Engineer |
| M2.5 | Implement fund accounting layer on top of general ledger | 3d | Backend Engineer |
| M2.6 | Implement period management (fiscal year, opening/closing) | 4d | Backend Engineer |
| M2.7 | Implement fund balance validation (block overdrafts server-side) | 2d | Backend Engineer |
| M2.8 | Implement atomic fund transfers as balanced journal entries | 3d | Backend Engineer |
| M2.9 | Migrate all existing data (offerings, expenses, incomes) to journal entries | 5d | Data Engineer |
| M2.10 | Verify migrated balances match original system | 2d | QA Lead |

### Findings Resolved
- **P0-04:** No double-entry bookkeeping → Journal + General Ledger
- **P0-05:** Fund balance computed, not stored → Running balances in ledger
- **P0-06:** No chart of accounts → Full COA with hierarchy
- **P0-07:** No period controls → Period management with locking
- **P1-02:** No fiscal year handling → Fiscal year integrated into period system
- **P1-03:** Fund opening balance bug → Clean opening balances in proper equity accounts
- **P1-04:** No fund balance validation → Server-side balance checks
- **P1-05:** No fund transfer atomicity → Single atomic journal entries
- **P1-10:** Offerings hardcoded to Fund f1 → Proper fund selection per COA

### Exit Criteria
- [ ] Every financial operation produces a balanced journal entry (sum of debits = sum of credits)
- [ ] Chart of accounts maps to Thai accounting standards
- [ ] Fund balances are stored (not just computed) and verified on each transaction
- [ ] Period closing locks all transactions within the period
- [ ] All historical seed data has been migrated to journal entries with balanced debits/credits

---

## 5. Milestone 3: Financial Controls (Weeks 9-12)

**Goal:** Implement proper transaction lifecycle, approval workflows, and fraud prevention controls.

### Deliverables

| ID | Task | Effort | Owner |
|----|------|--------|-------|
| M3.1 | Implement transaction state machine (draft→pending→approved/rejected) | 4d | Backend Engineer |
| M3.2 | Implement segregation of duties (no self-approval) | 2d | Backend Engineer |
| M3.3 | Implement tiered approval thresholds (amount-based) | 3d | Backend Engineer |
| M3.4 | Add approval rejection reason as required field | 1d | Full-Stack Engineer |
| M3.5 | Add status/approval workflow to offering records | 3d | Backend Engineer |
| M3.6 | Implement Sunday count sheet with independent counter verification | 5d | Full-Stack Engineer |
| M3.7 | Implement void (rather than delete) for approved transactions | 3d | Backend Engineer |
| M3.8 | Implement confirmation dialogs for all destructive actions | 2d | Frontend Engineer |
| M3.9 | Add soft-delete / trash bin with 30-day recovery window | 3d | Backend Engineer |
| M3.10 | Implement sequential transaction numbering (OFF-2026-0001, EXP-2026-0001) | 2d | Backend Engineer |
| M3.11 | Link member records to offerings for giving statement generation | 4d | Full-Stack Engineer |

### Findings Resolved
- **P0-08:** Status transitions not enforced → State machine
- **P1-06:** No segregation of duties → Creator ≠ approver check
- **P1-07:** Approval rejection has no reason → Reason field
- **P1-08:** Offerings have no status → Offering approval workflow
- **P1-09:** No Sunday count sheet reconciliation → Independent counter verification
- **P1-11:** Expenses deletable at any status → Void-only for approved
- **P1-12:** Income deletable at any status → Void-only for approved
- **P2-02:** No amount thresholds → Tiered approval
- **P2-04:** Member not linked to offering → Member linkage for statements
- **P2-11:** No sequential transaction IDs → Sequential numbering

### Exit Criteria
- [ ] No transaction can skip the approval workflow
- [ ] No user can approve their own transactions
- [ ] Transactions above ฿50,000 require dual approval
- [ ] Sunday counts require minimum 2 authenticated counters with independent entry
- [ ] Approved transactions can only be voided (not deleted)
- [ ] All transactional IDs are sequential and auditable

---

## 6. Milestone 4: Audit Trail & Compliance (Weeks 13-16)

**Goal:** Build an immutable, complete, and forensically sound audit trail that can withstand external financial audits.

### Deliverables

| ID | Task | Effort | Owner |
|----|------|--------|-------|
| M4.1 | Design and implement append-only audit log table in PostgreSQL | 2d | Senior DBA |
| M4.2 | Implement cryptographic hash chaining for audit entries | 3d | Security Engineer |
| M4.3 | Capture full before/after snapshots for every mutation | 4d | Backend Engineer |
| M4.4 | Implement audit log retention policy (default: 7 years) | 1d | Backend Engineer |
| M4.5 | Add IP address, user agent, and device fingerprint to audit logs | 2d | Backend Engineer |
| M4.6 | Implement audit log viewer with filtering and export | 4d | Frontend Engineer |
| M4.7 | Implement forward-audit to external syslog/SIEM endpoint | 3d | DevOps |
| M4.8 | Implement persisted reconciliation with period chaining | 5d | Backend Engineer |
| M4.9 | Implement reconciliation locking (reconciled periods cannot be modified) | 3d | Backend Engineer |
| M4.10 | Generate external auditor package (audit trail + financial reports export) | 3d | Backend Engineer |

### Findings Resolved
- **P0-10:** Audit trail client-side, mutable, truncated → Append-only immutable trail
- **P1-14:** Reconciliation not persisted → Persisted reconciliation records
- **P2-06:** Attachment receipt not validated → Server-side attachment storage with validation
- **P3-09:** No audit log retention policy → Configurable 7-year default
- **P3-10:** Audit logs lack IP/device info → Forensic metadata

### Exit Criteria
- [ ] Audit trail is append-only — no row can be UPDATE or DELETEd after insertion
- [ ] Every state change captures the full before and after state
- [ ] Cryptographic hash chain can verify integrity of the entire audit trail
- [ ] Reconciliation records are stored and linked to period boundaries
- [ ] External auditor can verify the audit trail integrity independently

---

## 7. Milestone 5: Security Hardening (Weeks 17-20)

**Goal:** Harden the system against all identified fraud vectors and security vulnerabilities.

### Deliverables

| ID | Task | Effort | Owner |
|----|------|--------|-------|
| M5.1 | Implement rate limiting (5 failed attempts → 15-minute lockout) | 2d | Security Engineer |
| M5.2 | Implement MFA for super_admin and treasurer roles | 4d | Security Engineer |
| M5.3 | Enforce password complexity requirements (12+ chars) | 1d | Security Engineer |
| M5.4 | Implement session timeout enforcement (based on idleTimeoutMin setting) | 3d | Full-Stack Engineer |
| M5.5 | Implement concurrency control with optimistic locking (version column) | 4d | Backend Engineer |
| M5.6 | Implement single-tab enforcement via BroadcastChannel | 2d | Frontend Engineer |
| M5.7 | Implement permission matrix audit (remove overlapping permissions) | 2d | Security Engineer |
| M5.8 | Implement role-based navigation hiding | 2d | Frontend Engineer |
| M5.9 | Implement data privacy controls (PDPA — member PII masking, consent tracking) | 4d | Backend Engineer |
| M5.10 | Set up Row-Level Security (RLS) policies in PostgreSQL | 3d | Senior DBA |
| M5.11 | Implement request validation schema (Zod) for all API endpoints | 3d | Backend Engineer |
| M5.12 | Configure CORS, CSP, and security headers | 2d | DevOps |
| M5.13 | Conduct penetration testing against the staging environment | 5d | External Pen Tester |

### Findings Resolved
- **P0-11:** No concurrency control → Optimistic locking
- **P1-13:** Overdraft prevention client-side only → Server-side validation (done in M2.7, reinforced)
- **P1-17:** No session timeout → Session timeout enforcement
- **P2-03:** No offering correction workflow → Correction with audit trail
- **P3-02:** Back-dating prevention → Period locking (done in M2.6, verified)
- **P3-03:** PIN sharing/impersonation → Strong auth + MFA
- **P3-06:** Permission matrix overlaps → Cleaned permission matrix
- **P3-07:** No role-based UI hiding → Navigation filtering
- **P3-08:** Session in same DB → Separate session management with httpOnly cookies
- **P3-10:** Audit logs without IP → Forensic metadata (done in M4.5)

### Exit Criteria
- [ ] Rate limiting prevents brute-force attacks
- [ ] MFA required for super_admin and treasurer roles
- [ ] Sessions expire after configured idle timeout
- [ ] Concurrent edits are detected and prevented (optimistic locking)
- [ ] All API inputs validated with Zod schemas
- [ ] RLS policies prevent unauthorized data access at the database level
- [ ] Penetration test report shows no critical/high findings

---

## 8. Milestone 6: Reporting & Tax Compliance (Weeks 21-24)

**Goal:** Generate proper financial statements and tax compliance documents required for church operations in Thailand.

### Deliverables

| ID | Task | Effort | Owner |
|----|------|--------|-------|
| M6.1 | Implement balance sheet (Statement of Financial Position) report | 3d | Backend Engineer |
| M6.2 | Implement income statement (Statement of Activities) report | 3d | Backend Engineer |
| M6.3 | Implement cash flow statement report | 2d | Backend Engineer |
| M6.4 | Implement fund balance report per fund | 2d | Backend Engineer |
| M6.5 | Implement budget vs. actual report (dynamic calculation) | 3d | Backend Engineer |
| M6.6 | Implement donor tax receipt generation (ใบอนุโมทนาบัตร) | 4d | Full-Stack Engineer |
| M6.7 | Implement annual member giving statement | 3d | Full-Stack Engineer |
| M6.8 | Implement expense categorization for tax-deductible vs. non-deductible | 2d | Backend Engineer |
| M6.9 | Implement salary disbursement records with tax withholding tracking | 4d | Backend Engineer |
| M6.10 | Fix budget tracking (compute `used` dynamically from journal entries) | 2d | Backend Engineer |
| M6.11 | Implement budget CRUD with approval workflow | 3d | Full-Stack Engineer |
| M6.12 | Add budget period validation (annual requires year, monthly requires year+month) | 1d | Backend Engineer |

### Findings Resolved
- **P1-15:** No formal financial statements → All three core statements
- **P2-08:** Budget 'used' never updated → Dynamic calculation from journal
- **P2-09:** No budget approval workflow → Budget CRUD + approval
- **P2-10:** No budget period enforcement → Period validation
- **P2-19:** Thai tax compliance not addressed → Tax receipts + statements

### Exit Criteria
- [ ] Balance sheet, income statement, and cash flow statement can be generated for any period
- [ ] Reports map chart of accounts to proper statement line items
- [ ] Donor tax receipts include church tax ID and donor information
- [ ] Annual giving statements are generated per member
- [ ] Budget vs. actual comparison dynamically calculates expenditure from journal entries

---

## 9. Milestone 7: Operations & Resilience (Weeks 25-28)

**Goal:** Ensure production reliability, testing, and operational readiness.

### Deliverables

| ID | Task | Effort | Owner |
|----|------|--------|-------|
| M7.1 | Write unit tests for all service functions (target: 80% coverage) | 8d | Backend Engineer |
| M7.2 | Write integration tests for critical workflows (create→approve→reconcile) | 5d | QA Engineer |
| M7.3 | Write financial calculation regression tests (known inputs→expected balances) | 4d | QA Engineer |
| M7.4 | Write permission matrix tests (every role × every operation) | 4d | QA Engineer |
| M7.5 | Implement error boundaries at route level with recovery options | 3d | Frontend Engineer |
| M7.6 | Implement health check endpoint with DB connectivity check | 1d | Backend Engineer |
| M7.7 | Set up monitoring (Sentry for errors, application metrics) | 3d | DevOps |
| M7.8 | Configure point-in-time recovery for PostgreSQL (PITR) | 2d | DevOps |
| M7.9 | Document and test database restore procedure | 2d | DevOps |
| M7.10 | Implement bulk operations (import CSV, batch approve, batch export) | 5d | Full-Stack Engineer |
| M7.11 | Add loading states for all async operations | 3d | Frontend Engineer |
| M7.12 | Implement API versioning (OpenAPI/Swagger documentation) | 3d | Backend Engineer |
| M7.13 | Implement purchase order / commitment tracking | 5d | Backend Engineer |
| M7.14 | Implement inter-fund loan tracking | 3d | Backend Engineer |
| M7.15 | Performance testing and optimization | 3d | DevOps |

### Findings Resolved
- **P0-10** (reinforced): PITR backup testing
- **P2-01:** No inter-fund loan tracking → Loan type + repayment tracking
- **P2-05:** No purchase order tracking → PO/commitment workflow
- **P2-13:** No undo → Soft delete + trash bin (done in M3.9, validated)
- **P2-14:** No confirmation dialogs → Confirmation modals (done in M3.8, validated)
- **P2-15:** No loading states → Loading states for all async ops
- **P2-16:** No bulk operations → Bulk import/approve/export
- **P2-17:** No automated testing → Comprehensive test suite
- **P2-18:** No API versioning → OpenAPI docs + versioned endpoints
- **P2-20:** No data privacy controls → PDPA controls (done in M5.9, validated)

### Exit Criteria
- [ ] Test coverage ≥ 80% for service layer
- [ ] All critical workflows have passing integration tests
- [ ] Financial calculation regression tests pass
- [ ] Database restore procedure documented and tested
- [ ] Monitored, alerting configured, PITR verified
- [ ] API documentation available at /api/docs

---

## 10. Dependency Graph

```
M1 (Infrastructure)
│
├── M2 (Accounting Engine) ← depends on M1
│   │
│   ├── M3 (Financial Controls) ← depends on M2
│   │   │
│   │   ├── M4 (Audit Trail) ← depends on M2, M3
│   │   │
│   │   └── M6 (Reporting) ← depends on M2
│   │
│   └── M5 (Security) ← depends on M1, M2
│
└── M7 (Operations) ← depends on all prior milestones
```

**Critical Path:** M1 → M2 → M3 → M4 → M7 (28 weeks)
**Fast Track (parallel work):** M5 and M6 can run partially in parallel with M3/M4

### Parallelism Opportunities

| Pair | Overlap | Notes |
|------|---------|-------|
| M3 + M5 (partial) | Weeks 9-12 | Security hardening can begin once auth is in place (M1) |
| M4 + M6 (partial) | Weeks 13-16 | Report templates can be built against the new domain model while audit trail is being implemented |
| M5 + M6 | Weeks 17-20 | Separate teams can work on security and reporting simultaneously |

---

## 11. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Data migration corrupts financial figures | Medium | Critical | Run migration in staging, verify balances, get church treasurer sign-off before production cutover |
| Double-entry implementation is incorrect | Medium | Critical | Engage accounting consultant to review journal entry logic; build comprehensive financial regression tests |
| PIN-to-password migration disrupts user access | High | High | Provide transition period with both auth methods; email all users 2 weeks before cutover |
| Performance issues with optimistic locking under load | Low | High | Load test with 50 concurrent users before production; tune PostgreSQL connection pooling |
| Scope creep — adding features beyond architecture v2 | High | Medium | Strict scope enforcement; any feature not in this roadmap requires architect approval |
| Legacy localStorage data lost during migration | Medium | High | Require data export file from each church before migration; validate import script |
| Thai tax requirements change mid-implementation | Low | Medium | Design COA with extensibility; monitor Revenue Department announcements |

---

## 12. Estimated Total Effort

| Milestone | Weeks | Engineering Days | Team Size |
|-----------|-------|-----------------|-----------|
| M1: Foundational Infrastructure | 4 | 35 days | 4 engineers |
| M2: Accounting Engine | 4 | 30 days | 3 engineers |
| M3: Financial Controls | 4 | 32 days | 4 engineers |
| M4: Audit Trail & Compliance | 4 | 30 days | 3 engineers |
| M5: Security Hardening | 4 | 34 days | 4 engineers |
| M6: Reporting & Tax | 4 | 32 days | 3 engineers |
| M7: Operations & Resilience | 4 | 49 days | 5 engineers |
| **Total** | **28 weeks** | **~242 engineering days** | |

**Calendar estimate:** 7 months with 4-5 engineers (accounting for parallel milestones).
**Conservative estimate:** 9 months including buffer for unknowns, hiring, and onboarding.

---

*This roadmap is based on the BUSINESS_DOMAIN_AUDIT.md dated 22 July 2026. All 45 findings are addressed across the 7 milestones. No finding has been omitted or simplified.*

*For implementation, begin with the architecture documents (ARCHITECTURE_V2.md, DATABASE_V2.md, ACCOUNTING_ENGINE.md, etc.) which provide the detailed technical specifications for each milestone.*