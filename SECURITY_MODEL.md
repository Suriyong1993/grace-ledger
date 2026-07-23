# Grace Ledger v2 — Security Model

**Version:** 2.0
**Date:** 22 July 2026

---

## Table of Contents

1. [Threat Model](#1-threat-model)
2. [Authentication Architecture](#2-authentication-architecture)
3. [Session Management](#3-session-management)
4. [Password Policy](#4-password-policy)
5. [Multi-Factor Authentication](#5-multi-factor-authentication)
6. [Rate Limiting & Brute-Force Protection](#6-rate-limiting--brute-force-protection)
7. [Authorization Architecture](#7-authorization-architecture)
8. [Data Protection](#8-data-protection)
9. [Network Security](#9-network-security)
10. [Fraud Prevention Controls](#10-fraud-prevention-controls)
11. [Incident Response](#11-incident-response)

---

## 1. Threat Model

### 1.1 Threat Actors

| Actor | Motivation | Capability | Primary Targets |
|-------|-----------|------------|-----------------|
| External attacker | Financial gain, data theft | Medium | Credentials, financial data, member PII |
| Malicious insider (staff) | Fraud, embezzlement | High (authorized access) | Cash handling, false expenses, fund transfers |
| Accidental insider | Human error | Low | Data deletion, incorrect entries |
| Auditor bypass | Covering fraud | High (authorized access) | Audit log deletion, period manipulation |
| Physical access attacker | Credential theft | Low-Medium | Unlocked sessions, PIN/password theft |

### 1.2 Trust Boundaries

```
[Browser/Client] ─── UNTRUSTED ───▶ [Server Functions]
                                        │
[Server Functions] ─── TRUSTED ───▶ [Domain Services]
                                        │
[Domain Services] ─── TRUSTED ───▶ [Repository Layer]
                                        │
[Repository] ─── TRUSTED (service_role) ───▶ [PostgreSQL]
```

### 1.3 Key Security Properties

| Property | Mechanism |
|----------|-----------|
| Confidentiality | Encryption at rest (Supabase), TLS in transit, RLS at DB |
| Integrity | Double-entry balance enforcement, hash-chained audit trail, CHECK constraints |
| Availability | Automated backups, PITR, multi-region (Supabase) |
| Non-repudiation | Immutable audit trail, cryptographic signing |
| Authentication | bcrypt passwords, httpOnly JWT sessions, TOTP MFA |
| Authorization | RBAC middleware, RLS at database, permission matrix |

---

## 2. Authentication Architecture

### 2.1 Login Flow

```
1. User submits username + password over HTTPS
2. Server retrieves user record by username
3. Server verifies password against bcrypt hash (constant-time comparison)
4. On match:
   a. Reset failed_attempts counter
   b. If MFA enabled → return MFA challenge (don't issue session yet)
   c. If MFA not enabled → generate JWT, set httpOnly cookie, return user DTO
5. On mismatch:
   a. Increment failed_attempts
   b. If failed_attempts >= 5 → set locked_until = now() + 15 minutes
   c. Return generic "Invalid credentials" (no user enumeration)
6. All login attempts (success + failure) logged to audit trail
```

### 2.2 Password Hashing

```typescript
// src/server/auth/password.ts
import { hash, verify } from 'argon2';

export class PasswordService {
  private readonly ARGON2_OPTIONS = {
    type: argon2id,       // Hybrid (most resistant to GPU/side-channel attacks)
    memoryCost: 65536,    // 64 MB
    timeCost: 3,          // 3 iterations
    parallelism: 4,       // 4 threads
  };

  async hashPassword(plaintext: string): Promise<string> {
    return hash(plaintext, this.ARGON2_OPTIONS);
  }

  async verifyPassword(hash: string, plaintext: string): Promise<boolean> {
    return verify(hash, plaintext);  // Constant-time comparison built-in
  }
}
```

### 2.3 Credential Storage

| Field | Storage | Notes |
|-------|---------|-------|
| `password_hash` | PostgreSQL `users` table | argon2id hash only — never plaintext |
| `mfa_secret` | PostgreSQL `users` table | Encrypted at rest by Supabase; decrypted only for MFA verification |
| `token_hash` | `user_sessions` table | SHA-256 hash of JWT — actual JWT only in httpOnly cookie |

---

## 3. Session Management

### 3.1 JWT Configuration

```typescript
// JWT payload
interface SessionPayload {
  sub: string;        // User ID
  role: Role;         // User role (for quick checks)
  sid: string;        // Session ID (for revocation)
  iat: number;        // Issued at
  exp: number;        // Expiration
}

// Cookie configuration
{
  name: 'gl_session',
  httpOnly: true,       // Inaccessible to JavaScript
  secure: true,         // HTTPS only
  sameSite: 'strict',   // CSRF protection
  path: '/',
  maxAge: 8 * 60 * 60, // 8 hours (configurable)
}
```

### 3.2 Idle Timeout

```typescript
// Idle timeout enforcement
export class SessionService {
  private readonly IDLE_CHECK_INTERVAL_MS = 60_000; // Check every 60 seconds

  async validateSession(token: string): Promise<SessionPayload> {
    const payload = this.verifyJWT(token);
    const session = await this.sessionRepo.findById(payload.sid);

    if (!session) throw new UnauthorizedError('Session not found');
    if (new Date() > new Date(session.expiresAt)) throw new UnauthorizedError('Session expired');

    const idleMs = Date.now() - new Date(session.lastActivityAt).getTime();
    const idleTimeoutMs = (await this.settingsRepo.get()).idleTimeoutMin * 60 * 1000;

    if (idleMs > idleTimeoutMs) {
      await this.sessionRepo.delete(session.id);
      throw new UnauthorizedError('Session timed out due to inactivity');
    }

    // Update last activity
    await this.sessionRepo.updateActivity(session.id);
    return payload;
  }
}
```

### 3.3 Session Lifecycle

| Event | Action |
|-------|--------|
| Login | Create session record, set httpOnly cookie |
| Each request (with idle check passing) | Update `last_activity_at` |
| Idle timeout exceeded | Delete session, force logout |
| Manual logout | Delete session, clear cookie |
| Password changed | Delete ALL sessions for user (force re-login everywhere) |
| Admin deactivates user | Delete ALL sessions for user |
| Session max age exceeded | Session expires, cookie invalidated |

---

## 4. Password Policy

### 4.1 Requirements

| Requirement | Value |
|------------|-------|
| Minimum length | 12 characters |
| Character classes | Uppercase + lowercase + digit + symbol (all required) |
| Maximum age | 90 days (configurable) |
| Password history | Last 5 passwords cannot be reused |
| Minimum age | 1 day before allowed to change again |

### 4.2 Validation

```typescript
// src/server/schemas/password.schema.ts
export const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Must contain at least one digit')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one symbol')
  .refine(
    async (pwd) => !(await isCommonPassword(pwd)),
    'Password is too common — please choose a stronger one'
  );
```

---

## 5. Multi-Factor Authentication

### 5.1 MFA Flow (TOTP)

```
1. User with MFA enabled logs in with username + password
2. System returns { mfa_required: true, temporary_token: "..." }
3. Client prompts for 6-digit TOTP code
4. Client submits { temporary_token, totp_code }
5. Server verifies TOTP against stored secret
6. On success → issue JWT session, set cookie
7. On failure → increment failed MFA counter, log attempt
```

### 5.2 MFA Enforcement

| Role | MFA Required |
|------|-------------|
| super_admin | Yes (mandatory) |
| treasurer | Yes (mandatory) |
| pastor | Recommended (not forced) |
| finance_staff | Recommended (not forced) |
| auditor | Optional |
| viewer | Optional |

### 5.3 Backup Codes

- 8 single-use backup codes generated on MFA enrollment
- Each code is bcrypt-hashed and stored
- Used codes are marked as consumed
- User can regenerate backup codes (invalidating all previous)

---

## 6. Rate Limiting & Brute-Force Protection

### 6.1 Login Rate Limiting

| Scope | Limit | Window | Action on Exceed |
|-------|-------|--------|-----------------|
| Per user (failed attempts) | 5 | Rolling | Account locked 15 minutes |
| Per IP (failed attempts) | 20 | 15 minutes | IP blocked 1 hour |
| Per user (all logins) | 30 | 1 hour | Temporary throttle |
| Global (all logins) | 100 | 1 minute | WAF-level throttling |

### 6.2 Account Lockout

```typescript
export class LoginRateLimiter {
  async checkLoginAttempt(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);

    if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      const remaining = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
      throw new AccountLockedError(
        `Account is locked. Try again in ${remaining} minutes.`,
      );
    }

    // Reset lock if it has expired
    if (user.lockedUntil && new Date() >= new Date(user.lockedUntil)) {
      await this.userRepo.resetLock(userId);
    }
  }

  async recordFailedAttempt(userId: string): Promise<void> {
    const user = await this.userRepo.incrementFailedAttempts(userId);

    if (user.failedAttempts >= 5) {
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      await this.userRepo.lockAccount(userId, lockedUntil);

      // Log security event
      await this.auditRepo.recordSecurityEvent({
        eventType: 'account_locked',
        userId,
        reason: '5 consecutive failed login attempts',
      });

      throw new AccountLockedError('Account locked for 15 minutes due to multiple failed attempts.');
    }
  }

  async recordSuccessfulLogin(userId: string): Promise<void> {
    await this.userRepo.resetFailedAttempts(userId);
  }
}
```

### 6.3 API Rate Limiting

```typescript
// Rate limit configuration
const RATE_LIMITS = {
  'auth.login': { window: 60_000, max: 10 },      // 10/minute
  'auth.mfa': { window: 60_000, max: 5 },           // 5/minute
  'journal.create': { window: 60_000, max: 30 },    // 30/minute
  'reports.generate': { window: 300_000, max: 10 }, // 10/5min
  'export': { window: 300_000, max: 5 },            // 5/5min
  'settings.update': { window: 300_000, max: 3 },   // 3/5min
};
```

---

## 7. Authorization Architecture

See AUTHORIZATION_MODEL.md for the complete authorization design.

### 7.1 Enforcement Layers

```
Request → TanStack Server Function
  → Auth Middleware [Layer 1 - Session validation]
    → Permission Middleware [Layer 2 - RBAC check]
      → Input Validation [Layer 3 - Zod]
        → Application Service
          → Domain Layer [Layer 4 - Business rule enforcement]
            → Repository
              → PostgreSQL RLS [Layer 5 - Database-level enforcement]
```

### 7.2 Permission Check Pattern

```typescript
// Server function middleware
export function requirePermission(...permissions: Permission[]) {
  return async (ctx: ServerFnContext) => {
    const session = await validateSession(ctx);
    const user = await getUserById(session.sub);

    for (const perm of permissions) {
      if (!PERMISSION_MATRIX[user.role].includes(perm)) {
        throw new ForbiddenError(
          `User '${user.name}' lacks permission '${perm}'`
        );
      }
    }

    return { session, user };
  };
}
```

---

## 8. Data Protection

### 8.1 Data at Rest

| Data Type | Protection |
|-----------|-----------|
| Database | Supabase encrypted storage (AES-256) |
| Passwords | argon2id hash |
| MFA secrets | Encrypted column (Supabase Vault or pgcrypto) |
| Attachments | Supabase Storage (encrypted at rest) |
| Backups | Encrypted (Supabase managed) |

### 8.2 Data in Transit

| Path | Protection |
|------|-----------|
| Browser ↔ Server | TLS 1.3 |
| Server ↔ Database | TLS (Supabase internal) |
| Server ↔ Storage | TLS (Supabase internal) |
| Audit forward → SIEM | TLS + mTLS |

### 8.3 PII Handling

| Field | Classification | Access Control |
|-------|---------------|----------------|
| User name | Internal | All authenticated users |
| User password hash | Secret | Never exposed via API |
| Member name | PII | Authenticated users (role-dependent) |
| Member phone | PII | super_admin, pastor, treasurer, finance_staff only |
| Member email | PII | super_admin, pastor, treasurer, finance_staff only |
| Member address | PII | super_admin, pastor, treasurer only |
| Church tax ID | Confidential | super_admin, pastor, treasurer, auditor |
| Financial amounts | Confidential | All authenticated users |

### 8.4 PII Masking

```typescript
// API response DTO masks PII based on role
export function toMemberDTO(member: Member, viewerRole: Role): MemberDTO {
  const canViewPII = ['super_admin', 'pastor', 'treasurer', 'finance_staff'].includes(viewerRole);

  return {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    familyName: member.familyName,
    phone: canViewPII ? member.phone : undefined,
    email: canViewPII ? member.email : undefined,
    address: canViewPII ? member.address : undefined,
    departmentId: member.departmentId,
    status: member.status,
    // Always mask: viewer/auditor see only ID and status
  };
}
```

---

## 9. Network Security

### 9.1 Security Headers

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 9.2 CORS Configuration

```typescript
const CORS_ORIGINS = [
  process.env.APP_URL,              // Production
  'http://localhost:5173',          // Development
  'https://staging.graceledger.app', // Staging
];

const corsConfig = {
  origin: CORS_ORIGINS,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,                 // Required for httpOnly cookies
  maxAge: 86400,                     // 24 hours
};
```

---

## 10. Fraud Prevention Controls

### 10.1 Cash Skimming Prevention

| Control | Mechanism |
|---------|-----------|
| Independent counter verification | Minimum 2 authenticated users, independent entry |
| Counter reconciliation | System compares amounts; discrepancy > ฿100 requires recount |
| Count sheet locking | Locked by pastor/super_admin; generates journal entries automatically |
| Physical deposit matching | Reconciliation against actual bank deposit |
| Audit logging | All count activities logged (who entered, when, amounts) |

### 10.2 Fictitious Expense Prevention

| Control | Mechanism |
|---------|-----------|
| Segregation of duties | Creator ≠ Approver |
| Approval thresholds | >฿50,000 requires dual approval |
| Receipt requirement | Attachment mandatory above ฿5,000 |
| Vendor verification | Vendor name recorded; vendor history visible |
| Void-only for approved | Cannot delete — only void with reversals |
| Audit trail | Full before/after state capture |

### 10.3 Fund Transfer Fraud Prevention

| Control | Mechanism |
|---------|-----------|
| Transfer approval | >฿10,000 requires approval |
| Atomicity | Single journal entry (both sides together) |
| Overdraft prevention | Server-side balance check before posting |
| Transfer purpose | Mandatory description field |
| Loan tracking | Inter-fund loans tracked with repayment terms |

### 10.4 Back-Dating Prevention

| Control | Mechanism |
|---------|-----------|
| Date validation | Cannot post > 30 days in the past |
| Period locking | Closed periods block transactions |
| Reconciliation locking | Reconciled periods are sealed |
| Audit trail | Posting timestamp independently recorded |

### 10.5 Anomaly Detection (Future Phase)

| Signal | Threshold |
|--------|-----------|
| Unusual transaction amount | > 3 standard deviations from user's average |
| Off-hours activity | Transactions outside 08:00-20:00 local time |
| Rapid transactions | > 10 entries in 1 minute |
| New vendor + large amount | First-time vendor > ฿5,000 |
| Round-dollar amounts | Exact ฿100, ฿1,000 amounts (potential structuring) |

---

## 11. Incident Response

### 11.1 Security Incident Classification

| Severity | Examples | Response Time |
|----------|---------|--------------|
| Critical | Confirmed data breach, audit trail tampering, fund theft | 1 hour |
| High | Account compromise (treasurer/super_admin), RLS bypass | 4 hours |
| Medium | Brute-force attack, suspicious activity pattern | 24 hours |
| Low | Failed login spike, port scan | 48 hours |

### 11.2 Response Procedure

1. **Detect:** Sentry alert, SIEM alert, auditor report, or user report
2. **Contain:** Revoke compromised sessions, lock affected accounts, take snapshot of system state
3. **Investigate:** Query audit trail, review IP logs, analyze hash chain integrity
4. **Remediate:** Fix vulnerability, restore from backup if needed, verify financial integrity via trial balance
5. **Report:** Notify church leadership, document incident, update security controls
6. **Verify:** External audit of the incident period, verify no financial data was altered

### 11.3 Security Contacts

- Super Admin: designated church IT admin
- System Owner: church board / pastor
- Breach Notification: within 72 hours per PDPA requirements

---

*This security model is built on defense-in-depth. Every control has at least two layers of enforcement. No single compromised layer can defeat the entire system.*