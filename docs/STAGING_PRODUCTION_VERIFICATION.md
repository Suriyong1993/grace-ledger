# STAGING & PRODUCTION VERIFICATION RUNBOOK

## 1. Automated Regression & Quality Gates

Run the following test matrix before any deployment:

```bash
# 1. Typecheck: Zero compiler errors
npm run typecheck

# 2. Build: Clean production assets
npm run build

# 3. Test: All 49 test suites pass 100%
npm test
```

---

## 2. Live Smoke Test Checklist

- [ ] **Auth Flow**: Log in as Treasurer $\rightarrow$ JWT issued with `church_id` claim.
- [ ] **Transaction Draft**: Create transaction draft $\rightarrow$ Ensure `posted` balance is unchanged.
- [ ] **Action Proposal**: Request fund transfer proposal $\rightarrow$ Modal displays exact SHA-256 payload hash with 5-minute countdown.
- [ ] **Execution Lock**: Confirm action $\rightarrow$ Database transaction atomically commits transfer and locks confirmation status to `consumed`.
- [ ] **Replay Attempt**: Click confirmation button a second time $\rightarrow$ Rejection with `INVALID_CONFIRMATION` or identical idempotent replay.
- [ ] **Cross-Tenant Probe**: Attempt query with manipulated church UUID $\rightarrow$ Returns 0 rows.

---

## 3. SLA & Latency Budgets

| Operation Class | Target P95 Latency | SLA Threshold | Alert Action |
| :--- | :--- | :--- | :--- |
| **Financial READ Tool** | $< 350\text{ ms}$ | $< 800\text{ ms}$ | P3 Performance Warning |
| **DRAFT Creation** | $< 200\text{ ms}$ | $< 500\text{ ms}$ | P3 Performance Warning |
| **ACTION PROPOSAL** | $< 400\text{ ms}$ | $< 1,000\text{ ms}$ | P2 Security/Perf Review |
| **Atomic Financial Action Execution** | $< 150\text{ ms}$ | $< 500\text{ ms}$ | P1 High Priority Incident |
| **Audit Stream Ingestion** | $< 50\text{ ms}$ | $< 200\text{ ms}$ | P2 Logging Degradation |
