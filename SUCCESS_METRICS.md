# Success Metrics & KPIs

> **Status:** Active  
> **Last Updated:** 2026-07-29  
> **Owner:** Principal Architect  
> **Purpose:** Define measurable targets for every dimension of Grace Ledger's production operation

---

## How to Use

- **Target** — The goal value for production operation
- **Measurement Method** — How the metric is collected
- **Alert Threshold** — When to trigger a notification
- **Review Frequency** — How often the metric is reviewed (daily/weekly/monthly)

---

## 1. System Reliability

| #    | Metric                          | Target                             | Measurement Method                                    | Alert Threshold              | Review Frequency |
| ---- | ------------------------------- | ---------------------------------- | ----------------------------------------------------- | ---------------------------- | ---------------- |
| SR-1 | **Uptime (API)**                | ≥ 99.9% (8.7h downtime/year)       | External health check pinging /api/health every 5 min | < 99.5% in any 30-day window | Monthly          |
| SR-2 | **Uptime (Database)**           | ≥ 99.95%                           | Supabase status dashboard, external check             | < 99.9%                      | Monthly          |
| SR-3 | **Error Rate (API)**            | < 1% of all requests               | Sentry / API monitoring                               | > 5% in 5-minute window      | Daily            |
| SR-4 | **Error Rate (Frontend)**       | < 0.1% of page views               | Sentry frontend tracking                              | > 1% in 1-hour window        | Daily            |
| SR-5 | **Mean Time to Detect (MTTD)**  | < 15 minutes                       | Sentry alert response time                            | > 30 minutes                 | Monthly          |
| SR-6 | **Mean Time to Resolve (MTTR)** | < 2 hours for P0 incidents         | Incident management tracking                          | > 4 hours                    | Monthly          |
| SR-7 | **SLO attainment**              | ≥ 99.5% over 30-day rolling window | Composite metric from SR-1 through SR-6               | < 99%                        | Weekly           |

---

## 2. Performance

| #       | Metric                             | Target     | Measurement Method              | Alert Threshold    | Review Frequency |
| ------- | ---------------------------------- | ---------- | ------------------------------- | ------------------ | ---------------- |
| PERF-1  | **API P95 response time**          | < 500ms    | API monitoring middleware       | > 1s for 5 minutes | Daily            |
| PERF-2  | **API P99 response time**          | < 2s       | API monitoring middleware       | > 3s for 5 minutes | Daily            |
| PERF-3  | **Database query P95 time**        | < 100ms    | Supabase query performance logs | > 500ms            | Weekly           |
| PERF-4  | **Lighthouse Performance score**   | ≥ 90       | Lighthouse CI on key pages      | < 80               | Weekly           |
| PERF-5  | **Lighthouse Accessibility score** | ≥ 95       | Lighthouse CI on key pages      | < 85               | Weekly           |
| PERF-6  | **Time to Interactive (TTI)**      | < 3s on 3G | Lighthouse simulated throttling | > 5s               | Per deployment   |
| PERF-7  | **First Contentful Paint (FCP)**   | < 1.5s     | Lighthouse / RUM                | > 3s               | Per deployment   |
| PERF-8  | **Largest Contentful Paint (LCP)** | < 2.5s     | Lighthouse / RUM                | > 4s               | Per deployment   |
| PERF-9  | **Cumulative Layout Shift (CLS)**  | < 0.1      | Lighthouse / RUM                | > 0.25             | Per deployment   |
| PERF-10 | **Bundle size (gzipped)**          | < 500KB    | Bundle analyzer in CI           | > 700KB            | Per PR           |

---

## 3. Security

| #     | Metric                                    | Target                | Measurement Method          | Alert Threshold                                           | Review Frequency |
| ----- | ----------------------------------------- | --------------------- | --------------------------- | --------------------------------------------------------- | ---------------- |
| SEC-1 | **Authentication failures (rate)**        | < 5 per user per hour | Auth service logging        | > 5 failures per user in 15 min                           | Real-time alert  |
| SEC-2 | **API calls without valid session**       | 0 (blocked)           | API middleware              | Any non-authenticated request reaching protected endpoint | Real-time alert  |
| SEC-3 | **Secrets detected in source code**       | 0                     | git-secrets scan per commit | Any detection                                             | Blocking (CI)    |
| SEC-4 | **Dependency vulnerabilities (critical)** | 0                     | Dependabot / npm audit      | Any critical CVE                                          | Weekly scan      |
| SEC-5 | **RLS policy violations**                 | 0                     | Supabase audit logs         | Any RLS bypass attempt                                    | Weekly review    |
| SEC-6 | **SQL injection attempts blocked**        | 100% blocked          | WAF / API middleware        | Any successful injection                                  | Real-time alert  |
| SEC-7 | **Failed login attempts per IP**          | < 20 per hour         | Auth logging                | > 20 per hour                                             | Real-time alert  |

---

## 4. Accounting Integrity

| #    | Metric                             | Target              | Measurement Method                         | Alert Threshold                                 | Review Frequency      |
| ---- | ---------------------------------- | ------------------- | ------------------------------------------ | ----------------------------------------------- | --------------------- |
| AI-1 | **Trial balance discrepancy**      | 0 (always balanced) | Daily reconciliation job                   | Any imbalance > ฿0                              | Daily automated check |
| AI-2 | **Orphaned journal entries**       | 0                   | Database integrity check                   | Any orphaned entry                              | Weekly                |
| AI-3 | **Unbalanced fund transfers**      | 0                   | Fund balance reconciliation                | Any fund where balance ≠ sum of journal entries | Daily automated check |
| AI-4 | **Transactions in closed periods** | 0 (blocked)         | Service layer enforcement                  | Any attempt to mutate closed period             | Real-time alert       |
| AI-5 | **Audit log completeness**         | 100%                | Compare mutation count vs audit log count  | Any mutation without audit entry                | Daily automated check |
| AI-6 | **Hard-deleted financial records** | 0                   | Database trigger / soft-delete enforcement | Any DELETE on financial tables                  | Real-time alert       |
| AI-7 | **Self-approved transactions**     | 0                   | Business rule enforcement                  | Any approval where approver = requestor         | Real-time alert       |

---

## 5. Data Quality

| #    | Metric                         | Target             | Measurement Method   | Alert Threshold                          | Review Frequency |
| ---- | ------------------------------ | ------------------ | -------------------- | ---------------------------------------- | ---------------- |
| DQ-1 | **Incomplete required fields** | < 1% of records    | Data validation scan | > 5%                                     | Weekly           |
| DQ-2 | **Duplicate records**          | 0                  | Deduplication scan   | Any detected duplicates                  | Weekly           |
| DQ-3 | **Orphaned attachments**       | 0                  | Storage cleanup job  | Any file in storage without DB reference | Monthly          |
| DQ-4 | **Schema migration rollbacks** | 0 failed rollbacks | Migration CI status  | Any rollback failure                     | Per migration    |

---

## 6. OCR Accuracy

| #     | Metric                                | Target                          | Measurement Method                            | Alert Threshold | Review Frequency |
| ----- | ------------------------------------- | ------------------------------- | --------------------------------------------- | --------------- | ---------------- |
| OCR-1 | **Receipt field extraction accuracy** | ≥ 90%                           | Manual validation sample (100 receipts/month) | < 80%           | Monthly          |
| OCR-2 | **Receipt categorization accuracy**   | ≥ 85%                           | Manual validation sample                      | < 75%           | Monthly          |
| OCR-3 | **OCR processing time P95**           | < 5 seconds per receipt         | AI service monitoring                         | > 10s           | Weekly           |
| OCR-4 | **OCR failure rate**                  | < 5%                            | AI service monitoring                         | > 10%           | Daily            |
| OCR-5 | **Manual correction rate**            | < 20% of OCR-processed receipts | Track "user edited" flag on receipts          | > 30%           | Monthly          |

---

## 7. AI Cost

| #     | Metric                                | Target                         | Measurement Method      | Alert Threshold          | Review Frequency |
| ----- | ------------------------------------- | ------------------------------ | ----------------------- | ------------------------ | ---------------- |
| AIC-1 | **Monthly AI API cost**               | < $50/month (early production) | Cost tracking dashboard | > $100/month             | Monthly          |
| AIC-2 | **Average cost per receipt scan**     | < $0.05                        | Cost tracking           | > $0.10                  | Weekly           |
| AIC-3 | **AI calls per user per day**         | < 20                           | Usage tracking          | > 50 per user            | Weekly           |
| AIC-4 | **Cache hit rate for OCR**            | > 30%                          | Cache monitoring        | < 10%                    | Monthly          |
| AIC-5 | **Prompt injection attempts blocked** | 100%                           | Security monitoring     | Any successful injection | Real-time alert  |

---

## 8. API Performance

| #     | Metric                                | Target               | Measurement Method      | Alert Threshold | Review Frequency |
| ----- | ------------------------------------- | -------------------- | ----------------------- | --------------- | ---------------- |
| API-1 | **Requests per minute (peak)**        | Baseline measurement | API monitoring          | > 2x baseline   | Monthly          |
| API-2 | **Error rate per endpoint**           | < 1%                 | Per-endpoint monitoring | > 5%            | Daily            |
| API-3 | **P95 latency per critical endpoint** | < 300ms              | Per-endpoint monitoring | > 1s            | Daily            |
| API-4 | **API availability**                  | ≥ 99.9%              | Health check            | < 99.5%         | Monthly          |
| API-5 | **Rate limit hits**                   | < 1% of requests     | Rate limit monitoring   | > 5%            | Weekly           |

---

## 9. Database Performance

| #    | Metric                          | Target                     | Measurement Method    | Alert Threshold   | Review Frequency |
| ---- | ------------------------------- | -------------------------- | --------------------- | ----------------- | ---------------- |
| DB-1 | **Database size growth**        | < 2 GB/month               | Supabase dashboard    | > 5 GB/month      | Weekly           |
| DB-2 | **Connection pool utilization** | < 80%                      | Connection monitoring | > 80%             | Daily            |
| DB-3 | **Slow queries (> 500ms)**      | < 10 per day               | Query log analysis    | > 50 per day      | Weekly           |
| DB-4 | **Table bloat (dead tuples)**   | < 20% of live rows         | VACUUM statistics     | > 30%             | Weekly           |
| DB-5 | **Index usage**                 | > 95% of queries use index | pg_stat_user_indexes  | < 90%             | Monthly          |
| DB-6 | **Backup success rate**         | 100%                       | Backup monitoring     | Any failed backup | Daily alert      |

---

## 10. User Experience

| #    | Metric                                  | Target               | Measurement Method         | Alert Threshold     | Review Frequency |
| ---- | --------------------------------------- | -------------------- | -------------------------- | ------------------- | ---------------- |
| UX-1 | **Page load time (dashboard)**          | < 2s                 | RUM (Real User Monitoring) | > 4s                | Weekly           |
| UX-2 | **Form submission time**                | < 1s                 | RUM                        | > 3s                | Weekly           |
| UX-3 | **Search/query response time**          | < 1s                 | RUM                        | > 3s                | Weekly           |
| UX-4 | **Mobile page load**                    | < 3s on 4G           | Lighthouse throttled       | > 5s                | Per deployment   |
| UX-5 | **Error toast/notification visibility** | 100% of errors shown | Error boundary tracking    | Any unhandled error | Daily            |

---

## 11. Church Operations

| #    | Metric                                | Target                       | Measurement Method | Alert Threshold                  | Review Frequency |
| ---- | ------------------------------------- | ---------------------------- | ------------------ | -------------------------------- | ---------------- |
| CH-1 | **Active churches**                   | Grows over time              | Account tracking   | Decline for 2 consecutive months | Monthly          |
| CH-2 | **Transactions per church per month** | > 50 (active use)            | Usage analytics    | < 10                             | Monthly          |
| CH-3 | **Monthly active users per church**   | > 3                          | Usage analytics    | < 1                              | Monthly          |
| CH-4 | **Offerings recorded per service**    | Matches church service count | Usage analytics    | 0 for active church              | Weekly           |

---

## 12. Operational Efficiency

| #    | Metric                      | Target                               | Measurement Method | Alert Threshold | Review Frequency |
| ---- | --------------------------- | ------------------------------------ | ------------------ | --------------- | ---------------- |
| OE-1 | **Deployment frequency**    | ≥ 1 per week                         | CI/CD tracking     | < 1 per 2 weeks | Monthly          |
| OE-2 | **Deployment failure rate** | < 5%                                 | CI/CD tracking     | > 10%           | Monthly          |
| OE-3 | **Change lead time**        | < 24 hours from commit to production | CI/CD tracking     | > 72 hours      | Monthly          |
| OE-4 | **Failed build rate**       | < 10% of PRs                         | CI tracking        | > 20%           | Monthly          |

---

## 13. Scalability

| #    | Metric                             | Target                        | Measurement Method        | Alert Threshold          | Review Frequency |
| ---- | ---------------------------------- | ----------------------------- | ------------------------- | ------------------------ | ---------------- |
| SC-1 | **Concurrent users supported**     | ≥ 100                         | Load testing              | Degradation at 50 users  | Quarterly        |
| SC-2 | **Database connection pool limit** | Not exceeded                  | Connection monitoring     | Approaching 80% of limit | Weekly           |
| SC-3 | **Storage growth rate**            | Predictable (MB/church/month) | Storage monitoring        | Exponential growth       | Monthly          |
| SC-4 | **API auto-scaling response time** | < 2 minutes to scale up       | Infrastructure monitoring | > 5 minutes              | Monthly          |

---

## 14. Monitoring

| #     | Metric                        | Target                | Measurement Method         | Alert Threshold                 | Review Frequency |
| ----- | ----------------------------- | --------------------- | -------------------------- | ------------------------------- | ---------------- |
| MON-1 | **Alert response time (P0)**  | < 15 minutes          | Incident response tracking | > 30 minutes                    | Monthly          |
| MON-2 | **False positive alert rate** | < 20%                 | Alert review               | > 50%                           | Weekly           |
| MON-3 | **Monitoring coverage**       | 100% of API endpoints | Coverage scan              | Any endpoint without monitoring | Monthly          |
| MON-4 | **Dashboard uptime**          | 99.9%                 | Monitoring system check    | < 99%                           | Monthly          |

---

## 15. Business Success

| #    | Metric                                   | Target                  | Measurement Method | Alert Threshold | Review Frequency |
| ---- | ---------------------------------------- | ----------------------- | ------------------ | --------------- | ---------------- |
| BS-1 | **Church retention rate**                | > 90% annually          | Account tracking   | < 80%           | Quarterly        |
| BS-2 | **User satisfaction (NPS)**              | > 40                    | Survey             | < 20            | Quarterly        |
| BS-3 | **Features adopted per church**          | > 5 of 10 core features | Usage analytics    | < 3             | Monthly          |
| BS-4 | **Data export requests**                 | < 5% of churches        | Support tracking   | > 10%           | Quarterly        |
| BS-5 | **Support tickets per church per month** | < 2                     | Support tracking   | > 5             | Monthly          |

---

## Dashboard

The following dashboard visualizations should be created for operational review:

| Dashboard                   | Metrics                                                | Audience             | Refresh |
| --------------------------- | ------------------------------------------------------ | -------------------- | ------- |
| **Executive Overview**      | Uptime, active churches, error rate, monthly cost      | CTO, Product Manager | Daily   |
| **Accounting Health**       | Trial balance, fund reconciliation, audit completeness | Accountant, Auditor  | Daily   |
| **Security Dashboard**      | Auth failures, RLS violations, dependency CVEs         | CTO, Security Lead   | Weekly  |
| **Performance Dashboard**   | API latency, DB query time, Lighthouse scores          | Engineering          | Weekly  |
| **AI Cost Dashboard**       | Per-feature cost, per-user cost, cache hit rate        | CTO                  | Weekly  |
| **User Activity Dashboard** | Active users, transaction count, feature adoption      | Product Manager      | Weekly  |

---

## Review Cadence

| Frequency     | Review                                                 | Participants          |
| ------------- | ------------------------------------------------------ | --------------------- |
| **Daily**     | Error rate, auth failures, accounting integrity alerts | Engineering on-call   |
| **Weekly**    | Performance, security, AI cost dashboards              | Engineering team      |
| **Monthly**   | All KPIs, SLO attainment, trends                       | Product + Engineering |
| **Quarterly** | Business metrics, NPS, retention, scalability planning | Full team             |
