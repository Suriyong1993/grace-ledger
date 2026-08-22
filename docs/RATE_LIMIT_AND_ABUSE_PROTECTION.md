# RATE LIMITING & ABUSE PROTECTION ARCHITECTURE

## 1. Architectural Principles

Grace AI and Financial Endpoints must be protected from high-frequency brute-forcing, spamming, and denial-of-service attempts.

### Threat Vectors & Mitigations

| Threat Vector | Mitigation Strategy | Enforcement Layer |
| :--- | :--- | :--- |
| **Confirmation Nonce Brute-Force** | 5-minute TTL + 128-bit cryptographic nonces + 5 attempts/minute rate limit | API Gateway / Edge Function |
| **AI Tool Prompt Flooding** | Per-user rate limit (20 requests/min for READ, 5/min for PROPOSAL) | Secure AI Tool Executor |
| **Financial Replay Spamming** | Distributed `idempotency_keys` with atomic uniqueness checks | Database Engine (PostgreSQL) |
| **Cross-Tenant Scraping** | Zero-trust session validation (`auth.uid()`) + RLS enforcement | Supabase RLS / Service Layer |

---

## 2. Token Bucket Implementation Model

For edge deployments (e.g. Cloudflare Workers, Supabase Edge Functions, or Node.js backend), rate limiting is enforced via a Sliding Window Token Bucket algorithm keyed by `user_id` and `church_id`:

```text
Incoming Request
  │
  ▼
Check Token Bucket in Redis / In-Memory Cache
  ├── Exceeded Limit (>20 req/min) ──> 429 Too Many Requests (Retry-After header)
  └── Within Limit (<20 req/min)   ──> Proceed to Secure Tool Executor
```

---

## 3. Dual-Actor Audit Alerting

Any request that triggers 3 consecutive `DENIED` status logs within 60 seconds emits a high-priority security alert in `audit_logs` with severity `WARNING` or `CRITICAL`.
