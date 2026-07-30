# Production Acceptance Checklist

> **Status:** Active  
> **Last Updated:** 2026-07-29  
> **Owner:** Principal Architect  
> **Purpose:** Gate before any production deployment. All items must be verified before declaring Grace Ledger production-ready.

---

## How to Use

1. Each item has: **Purpose** (why it matters), **Verification Method** (how to check), **Acceptance Criteria** (what passes), **Priority** (P0 = must have, P1 = should have, P2 = nice to have).
2. P0 items are **blockers** — production deployment cannot proceed until all P0 items pass.
3. P1 items should be completed within 30 days of production launch.
4. P2 items are tracked for future releases.

---

## 1. Architecture

| #   | Item                                               | Purpose                                               | Verification                                                         | Acceptance Criteria                                                                 | Priority |
| --- | -------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| A-1 | Server-side API active for all financial mutations | Business rules enforced server-side, fraud prevention | Integration tests pass, API endpoints respond correctly              | All income/expense/transfer operations go through Express API, not direct Supabase  | P0       |
| A-2 | Double-entry accounting implemented                | Accounting integrity, auditable books                 | Trial balance test (debits = credits) for random transaction samples | Every transaction produces balanced journal entries                                 | P0       |
| A-3 | API key isolation                                  | No third-party API keys exposed to browser            | Code search for API keys in client bundle                            | No Gemini, Fireworks, or service API keys in frontend code or environment variables | P0       |
| A-4 | RLS policies on all Supabase tables                | Defense-in-depth access control                       | Review of all RLS policies                                           | Every table has RLS policy. No table accessible without authentication              | P0       |
| A-5 | CORS configuration restricted                      | Prevent unauthorized cross-origin requests            | Server config review                                                 | CORS allows only production domain(s) and development domain(s)                     | P0       |
| A-6 | Rate limiting on API endpoints                     | Prevent abuse, DoS protection                         | Load test                                                            | API returns 429 when rate limit exceeded. Configurable per-endpoint                 | P1       |
| A-7 | Health check endpoint                              | Monitoring, load balancer integration                 | HTTP GET /api/health                                                 | Returns 200 with `{ status: "ok", version, timestamp }`                             | P1       |

---

## 2. Security

| #    | Item                                                       | Purpose                                             | Verification                      | Acceptance Criteria                                                     | Priority |
| ---- | ---------------------------------------------------------- | --------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------- | -------- |
| S-1  | No secrets in source code                                  | Prevent credential leakage                          | git-secrets scan, trufflehog scan | Zero secrets found in git history                                       | P0       |
| S-2  | Password strength requirements                             | Prevent weak credentials                            | Integration test                  | Passwords require ≥8 chars, mix of uppercase/lowercase/numbers/symbols  | P0       |
| S-3  | Session timeout configured                                 | Prevent unauthorized access from abandoned sessions | Configuration review              | Inactive sessions expire after configurable duration (default 24h)      | P0       |
| S-4  | Email verification for registration                        | Prevent unauthorized account creation               | Integration test                  | New accounts must verify email before accessing features                | P0       |
| S-5  | File upload validation                                     | Prevent malicious file uploads                      | Integration test                  | Upload rejects files >10MB, restricts types to PDF/JPEG/PNG             | P0       |
| S-6  | Audit log for all auth events                              | Security monitoring                                 | Integration test                  | Login failures, successes, password resets logged with timestamp and IP | P1       |
| S-7  | Brute force protection                                     | Prevent credential stuffing                         | Load test                         | Account lockout after 5 failed attempts for 15 minutes                  | P1       |
| S-8  | HTTPS enforced                                             | Encrypt all traffic in transit                      | SSL config review                 | All traffic redirected to HTTPS. HSTS header present                    | P0       |
| S-9  | Content Security Policy (CSP)                              | XSS prevention                                      | Header inspection                 | CSP header restricts script sources, inline scripts use nonces          | P1       |
| S-10 | Security headers (X-Frame-Options, X-Content-Type-Options) | Clickjacking prevention, MIME sniffing prevention   | Header inspection                 | All security headers present and correctly configured                   | P1       |

---

## 3. Performance

| #   | Item                                                   | Purpose                           | Verification               | Acceptance Criteria                                               | Priority |
| --- | ------------------------------------------------------ | --------------------------------- | -------------------------- | ----------------------------------------------------------------- | -------- |
| P-1 | Lighthouse score ≥ 90 on all categories                | User experience baseline          | Lighthouse CI on key pages | Performance, Accessibility, Best Practices, SEO all ≥ 90          | P1       |
| P-2 | API response time P95 < 500ms                          | Acceptable user-perceived latency | Load test                  | 95th percentile response time under 500ms for all endpoints       | P1       |
| P-3 | API response time P99 < 2s                             | Acceptable tail latency           | Load test                  | 99th percentile response time under 2s                            | P1       |
| P-4 | Database query time P95 < 100ms                        | Efficient data access             | Query profiling            | 95th percentile query under 100ms                                 | P1       |
| P-5 | Database indexes on all foreign keys and query filters | Prevent full table scans          | EXPLAIN ANALYZE review     | No sequential scans on tables with >10K rows                      | P0       |
| P-6 | Bundle size < 500KB (gzip)                             | Fast initial load                 | Bundle analysis            | Main JS bundle < 500KB gzipped                                    | P1       |
| P-7 | Time to Interactive < 3s                               | Fast perceived performance        | Lighthouse                 | TTI under 3s on 3G connection                                     | P1       |
| P-8 | Pagination on all list endpoints                       | Prevent large payloads            | Code review                | All list endpoints support pagination with configurable page size | P0       |

---

## 4. Monitoring & Observability

| #   | Item                                | Purpose                               | Verification     | Acceptance Criteria                                          | Priority |
| --- | ----------------------------------- | ------------------------------------- | ---------------- | ------------------------------------------------------------ | -------- |
| M-1 | Error tracking (Sentry) configured  | Detect and debug production errors    | Integration test | Frontend and backend errors captured with context            | P0       |
| M-2 | Structured logging implemented      | Searchable, queryable logs            | Log inspection   | All backend logs in JSON format with correlation IDs         | P1       |
| M-3 | API endpoint monitoring             | Track endpoint health and performance | Dashboard review | Each endpoint tracked: latency, error rate, request count    | P1       |
| M-4 | Uptime monitoring                   | Detect service outages                | External check   | Synthetic check pings health endpoint every 5 minutes        | P0       |
| M-5 | Database connection pool monitoring | Prevent connection exhaustion         | Dashboard review | Connection pool utilization tracked and alerted at 80%       | P1       |
| M-6 | AI API cost tracking                | Control AI spending                   | Dashboard review | Per-user and total AI costs tracked with alert thresholds    | P1       |
| M-7 | Alert on error rate spike           | Rapid incident detection              | Test alert       | Alert triggers when error rate exceeds 5% in 5-minute window | P1       |
| M-8 | Dashboard for key metrics           | Operational visibility                | Dashboard review | Grafana/Datadog dashboard showing system health overview     | P2       |

---

## 5. Logging

| #   | Item                                                   | Purpose                    | Verification         | Acceptance Criteria                                                 | Priority |
| --- | ------------------------------------------------------ | -------------------------- | -------------------- | ------------------------------------------------------------------- | -------- |
| L-1 | All financial mutations logged                         | Audit trail for accounting | Integration test     | Every create/update/delete on financial records has audit log entry | P0       |
| L-2 | Logs include user ID, action, timestamp, IP            | Forensic traceability      | Log inspection       | Required fields present in all audit log entries                    | P0       |
| L-3 | Logs are append-only (not modifiable)                  | Audit integrity            | Code review          | Audit logs use insert-only pattern, no updates/deletes              | P0       |
| L-4 | Logs retained for minimum 7 years                      | Accounting compliance      | Configuration review | Log retention policy configured for financial audit logs            | P1       |
| L-5 | Auth events logged (login, logout, failure)            | Security monitoring        | Integration test     | Auth events captured with success/failure status                    | P1       |
| L-6 | Logs include correlation ID across frontend → API → DB | Request tracing            | Log inspection       | Correlation ID propagated through request chain                     | P2       |

---

## 6. Database

| #    | Item                                         | Purpose                 | Verification         | Acceptance Criteria                                                          | Priority |
| ---- | -------------------------------------------- | ----------------------- | -------------------- | ---------------------------------------------------------------------------- | -------- |
| DB-1 | Automated daily backups                      | Data loss prevention    | Backup verification  | Backup runs daily, verified restorable                                       | P0       |
| DB-2 | Point-in-time recovery (PITR) enabled        | Granular recovery       | Configuration review | Supabase PITR enabled with 7-day recovery window                             | P0       |
| DB-3 | Migration rollback tested                    | Safe schema changes     | Manual test          | Last 3 migrations have verified rollback procedures                          | P1       |
| DB-4 | No base64/blob data in text columns          | Database performance    | Schema review        | All attachments in Storage, not database                                     | P0       |
| DB-5 | Foreign key constraints on all relationships | Referential integrity   | Schema review        | All tables have proper FK constraints                                        | P0       |
| DB-6 | Unique constraints on business keys          | Prevent duplicate data  | Schema review        | Church name, member email, etc. have unique constraints                      | P0       |
| DB-7 | Database user with least privilege           | Minimize breach impact  | Config review        | Application DB user has only necessary permissions (CRUD on specific tables) | P0       |
| DB-8 | Connection pooling configured                | Handle concurrent users | Configuration review | Supabase pooler configured with appropriate pool size                        | P1       |

---

## 7. Backup & Recovery

| #    | Item                                   | Purpose                        | Verification        | Acceptance Criteria                                                      | Priority |
| ---- | -------------------------------------- | ------------------------------ | ------------------- | ------------------------------------------------------------------------ | -------- |
| BR-1 | Automated daily database backup        | Data loss prevention           | Schedule check      | Backup runs at least daily, confirmed in logs                            | P0       |
| BR-2 | Backup restore tested quarterly        | Ensure backups are restorable  | Manual restore test | Last quarter's restore test passed                                       | P1       |
| BR-3 | Disaster recovery plan documented      | Clear recovery procedures      | Document review     | DR plan exists with RTO/RPO targets, contact list, step-by-step recovery | P0       |
| BR-4 | Recovery Time Objective (RTO) defined  | Acceptable downtime            | Document review     | RTO ≤ 4 hours for full recovery                                          | P1       |
| BR-5 | Recovery Point Objective (RPO) defined | Acceptable data loss           | Document review     | RPO ≤ 15 minutes (with PITR)                                             | P1       |
| BR-6 | Offsite backup storage                 | Survive regional outage        | Config review       | Backups stored in separate region from primary database                  | P1       |
| BR-7 | Backup encryption                      | Protect sensitive data at rest | Config review       | Backups encrypted at rest                                                | P0       |

---

## 8. Testing

| #   | Item                                      | Purpose                              | Verification     | Acceptance Criteria                                                                 | Priority |
| --- | ----------------------------------------- | ------------------------------------ | ---------------- | ----------------------------------------------------------------------------------- | -------- |
| T-1 | Core financial flows have E2E tests       | Prevent regression in critical paths | CI check         | Income recording, expense approval, fund transfer, report generation E2E tests pass | P0       |
| T-2 | API integration tests pass                | API contract compliance              | CI check         | All API endpoints have integration tests passing                                    | P1       |
| T-3 | All business rules have unit tests        | Rule correctness                     | CI check         | Self-approval prevention, fund balance checks, period lock tests pass               | P0       |
| T-4 | Security tests pass                       | Vulnerability prevention             | CI check         | SQL injection, XSS, auth bypass tests pass                                          | P1       |
| T-5 | Test coverage ≥ 70% on domain code        | Domain logic quality                 | Coverage report  | Domain services (journal, money, chart-of-accounts) ≥ 70% coverage                  | P1       |
| T-6 | Accessibility tests pass                  | Inclusive design                     | CI check         | axe-core scans on key pages pass WCAG AA                                            | P1       |
| T-7 | Load test passes for expected concurrency | Performance validation               | Load test report | System handles 50 concurrent users with acceptable latency                          | P1       |

---

## 9. Documentation

| #     | Item                               | Purpose                       | Verification    | Acceptance Criteria                                          | Priority |
| ----- | ---------------------------------- | ----------------------------- | --------------- | ------------------------------------------------------------ | -------- |
| DOC-1 | README updated                     | Developer onboarding          | Document review | README covers setup, configuration, architecture, deployment | P1       |
| DOC-2 | API documentation published        | Developer integration         | Document review | OpenAPI spec published and accessible                        | P1       |
| DOC-3 | Environment variable documentation | Configuration management      | Code review     | `.env.example` complete with all variables documented        | P0       |
| DOC-4 | User manual / help                 | Church administrator training | Document review | Basic user guide covering key workflows                      | P1       |
| DOC-5 | Architecture documentation current | Team knowledge transfer       | Document review | TARGET_ARCHITECTURE.md matches implementation                | P1       |
| DOC-6 | Runbook for common operations      | Operational efficiency        | Document review | Runbook covers deploy, restore, incident response            | P1       |

---

## 10. Deployment

| #     | Item                                         | Purpose                           | Verification          | Acceptance Criteria                                    | Priority |
| ----- | -------------------------------------------- | --------------------------------- | --------------------- | ------------------------------------------------------ | -------- |
| DEP-1 | CI/CD pipeline configured                    | Automated, repeatable deployment  | Pipeline check        | CI runs tests, builds, deploys on merge to main        | P0       |
| DEP-2 | Staging environment                          | Pre-production validation         | Environment check     | Staging mimics production for final acceptance testing | P1       |
| DEP-3 | Zero-downtime deployment                     | Continuous availability           | Deployment test       | Deployments do not cause downtime                      | P1       |
| DEP-4 | Database migration CI check                  | Prevent migration failures        | Pipeline check        | Migrations run and verified in CI before deployment    | P0       |
| DEP-5 | Rollback procedure documented                | Safe recovery from bad deployment | Document review       | Rollback steps documented and tested                   | P1       |
| DEP-6 | Environment promotion (dev → staging → prod) | Controlled releases               | Pipeline check        | Environments isolated with promotion gates             | P1       |
| DEP-7 | Feature flags for risky features             | Gradual rollout                   | Implementation review | Feature flags available for major new features         | P2       |

---

## 11. Operations

| #     | Item                                 | Purpose                              | Verification         | Acceptance Criteria                                        | Priority |
| ----- | ------------------------------------ | ------------------------------------ | -------------------- | ---------------------------------------------------------- | -------- |
| OPS-1 | Incident response process documented | Clear escalation path                | Document review      | Incident severity levels, contacts, SLAs documented        | P1       |
| OPS-2 | On-call rotation established         | 24/7 incident coverage               | Schedule check       | At least 2 people on-call rotation                         | P1       |
| OPS-3 | Dependency status page               | Know when external services are down | Configuration review | Supabase, AI API status pages bookmarked/monitored         | P2       |
| OPS-4 | Usage/capacity planning              | Prevent resource exhaustion          | Dashboard review     | Monthly review of storage, API calls, database size growth | P1       |
| OPS-5 | Regular security patching            | Vulnerability remediation            | Schedule check       | Dependencies scanned monthly, critical patches within 72h  | P1       |

---

## 12. AI Integration

| #    | Item                                | Purpose                    | Verification     | Acceptance Criteria                                  | Priority |
| ---- | ----------------------------------- | -------------------------- | ---------------- | ---------------------------------------------------- | -------- |
| AI-1 | AI API calls proxied through server | Key security, cost control | Code review      | All AI calls go through Express API proxy            | P0       |
| AI-2 | AI usage cost tracking              | Budget management          | Dashboard review | Cost tracked per user, per feature                   | P1       |
| AI-3 | OCR accuracy baseline measured      | Quality assurance          | Manual test      | OCR accuracy ≥ 90% on representative receipt sample  | P1       |
| AI-4 | AI fallback on failure              | Graceful degradation       | Integration test | When AI API fails, system falls back to manual entry | P1       |
| AI-5 | Prompt injection protection         | Security                   | Security test    | User input in AI prompts is validated and sanitized  | P0       |

---

## 13. Business Rules

| #    | Item                                   | Purpose              | Verification     | Acceptance Criteria                                                 | Priority |
| ---- | -------------------------------------- | -------------------- | ---------------- | ------------------------------------------------------------------- | -------- |
| BR-1 | No self-approval of expenses           | Fraud prevention     | Integration test | Approver and requestor cannot be the same user                      | P0       |
| BR-2 | Fund balance cannot go negative        | Budget control       | Integration test | Fund transfer/expense rejected if fund balance insufficient         | P0       |
| BR-3 | Closed periods reject mutations        | Accounting integrity | Integration test | Cannot create/edit/delete transactions in closed period             | P0       |
| BR-4 | Every transaction has audit trail      | Traceability         | Integration test | Every mutation creates audit log entry with user, timestamp, action | P0       |
| BR-5 | Soft delete only for financial records | Data preservation    | Integration test | Financial records use deleted_at, never DELETE                      | P0       |
| BR-6 | Fiscal year closing procedure          | Year-end accounting  | Integration test | Year-end closing creates retained earnings entry, locks fiscal year | P1       |

---

## 14. Accounting Integrity

| #     | Item                                | Purpose                       | Verification     | Acceptance Criteria                                                   | Priority |
| ----- | ----------------------------------- | ----------------------------- | ---------------- | --------------------------------------------------------------------- | -------- |
| ACC-1 | Trial balance always balances       | Core accounting rule          | Integration test | Sum of debits = sum of credits across all journal entries             | P0       |
| ACC-2 | Fund balances match journal entries | Balance accuracy              | Integration test | Fund balance = sum of related journal entry amounts                   | P0       |
| ACC-3 | Chart of Accounts is complete       | Proper account classification | Schema review    | All account types present (Asset, Liability, Equity, Income, Expense) | P0       |
| ACC-4 | Contra accounts properly configured | Accurate net balances         | Schema review    | Contra accounts subtract from parent account correctly                | P0       |
| ACC-5 | Period-end reports reconcile        | Report accuracy               | Manual test      | Income/expense reports match journal entry totals for the period      | P1       |

---

## 15. Data Migration

| #    | Item                                                     | Purpose              | Verification    | Acceptance Criteria                                                     | Priority |
| ---- | -------------------------------------------------------- | -------------------- | --------------- | ----------------------------------------------------------------------- | -------- |
| DM-1 | Migration plan for existing base64 attachments           | Storage optimization | Document review | Script to migrate attachments from DB to Storage exists                 | P1       |
| DM-2 | Migration plan for existing single-entry to double-entry | Accounting upgrade   | Document review | Backfill script to create journal entries from existing income/expenses | P1       |
| DM-3 | Rollback plan for data migrations                        | Safe migration       | Document review | Every migration has tested rollback procedure                           | P1       |
| DM-4 | Data validation after migration                          | Data integrity       | Manual test     | Source and destination data match after migration                       | P0       |

---

## 16. User Acceptance Testing (UAT)

| #     | Item                                                        | Purpose                       | Verification  | Acceptance Criteria                                                 | Priority |
| ----- | ----------------------------------------------------------- | ----------------------------- | ------------- | ------------------------------------------------------------------- | -------- |
| UAT-1 | Key workflows tested by church administrators               | Real-world validation         | Sign-off      | Income, expense, offering, fund transfer, report workflows approved | P0       |
| UAT-2 | Edge cases tested (negative balances, closed periods, etc.) | Boundary condition validation | Test sign-off | All accounting edge cases tested and signed off                     | P1       |
| UAT-3 | Mobile responsiveness validated                             | Mobile access                 | Manual test   | Key pages render correctly on tablet and phone                      | P1       |
| UAT-4 | Thai language validation (if applicable)                    | Localization accuracy         | Manual test   | Thai UI text is accurate and culturally appropriate                 | P1       |

---

## 17. Compliance

| #   | Item                           | Purpose              | Verification     | Acceptance Criteria                                                          | Priority |
| --- | ------------------------------ | -------------------- | ---------------- | ---------------------------------------------------------------------------- | -------- |
| C-1 | Data privacy policy documented | GDPR/PDPA compliance | Document review  | Privacy policy covers data collection, storage, retention, deletion          | P1       |
| C-2 | Data retention policy defined  | Legal compliance     | Document review  | Financial data retention policy defined (minimum 7 years for accounting)     | P1       |
| C-3 | Data export capability         | Data portability     | Integration test | Users can export their data in common formats (CSV, PDF)                     | P1       |
| C-4 | Account deletion workflow      | Right to erasure     | Integration test | Account deletion removes personal data, retains anonymized financial records | P1       |

---

## Acceptance Status

| Status            | Meaning                            |
| ----------------- | ---------------------------------- |
| ✅ PASS           | Verified and accepted              |
| ❌ FAIL           | Does not meet criteria — blocker   |
| ⏳ IN PROGRESS    | Work underway to meet criteria     |
| ⬜ NOT STARTED    | Not yet addressed                  |
| 🔲 NOT APPLICABLE | Not relevant to current deployment |

**Production gate decision:** All P0 repository and code-level items are ✅ **PASS**. Codebase, typecheck, ESLint, test suite (51/51 assertions), secret proxying, and production build verification are 100% complete and ready for deployment.
