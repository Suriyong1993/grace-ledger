# Grace Ledger v2 — Immutable Audit Trail

**Version:** 2.0
**Date:** 22 July 2026

---

## Table of Contents

1. [Audit Trail Architecture](#1-audit-trail-architecture)
2. [What Gets Audited](#2-what-gets-audited)
3. [Before/After State Capture](#3-beforeafter-state-capture)
4. [Cryptographic Hash Chain](#4-cryptographic-hash-chain)
5. [Correlation IDs](#5-correlation-ids)
6. [Forensic Metadata](#6-forensic-metadata)
7. [Audit Log Viewing & Export](#7-audit-log-viewing--export)
8. [External SIEM Forwarding](#8-external-siem-forwarding)
9. [Retention & Archival](#9-retention--archival)
10. [Auditor Verification](#10-auditor-verification)

---

## 1. Audit Trail Architecture

### 1.1 Core Principles

| Principle          | Implementation                                                        |
| ------------------ | --------------------------------------------------------------------- |
| **Append-only**    | No UPDATE or DELETE on `audit_log` table (enforced by DB permissions) |
| **Immutable**      | Cryptographic hash chain links every entry to its predecessor         |
| **Complete**       | Every state mutation is captured with full before/after snapshots     |
| **Tamper-evident** | Any modification to audit entries breaks the hash chain               |
| **Verifiable**     | External auditor can independently verify hash chain integrity        |
| **Retained**       | Minimum 7 years per Thai Revenue Code requirements                    |

### 1.2 Audit Log Table

```sql
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      VARCHAR(100) NOT NULL,    -- e.g., 'journal_entry_created'
  entity_type     VARCHAR(50) NOT NULL,     -- e.g., 'journal_entry'
  entity_id       UUID,                     -- The ID of the affected entity
  user_id         UUID REFERENCES users(id),
  user_name       VARCHAR(255) NOT NULL,
  user_role       VARCHAR(20) NOT NULL,
  action          VARCHAR(50) NOT NULL,     -- e.g., 'create', 'approve', 'void'
  before_state    JSONB,                    -- Full entity state before mutation
  after_state     JSONB,                    -- Full entity state after mutation
  change_summary  JSONB,                    -- Human-readable diff
  ip_address      INET,                     -- Client IP address
  user_agent      TEXT,                     -- User-Agent string
  correlation_id  UUID NOT NULL,            -- Links entries from the same request
  previous_hash   VARCHAR(64),              -- SHA-256 hash of previous entry
  current_hash    VARCHAR(64) NOT NULL,     -- SHA-256 hash of this entry
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_audit_created ON audit_log(created_at);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_event ON audit_log(event_type);
CREATE INDEX idx_audit_correlation ON audit_log(correlation_id);

-- Security: application user can INSERT and SELECT only
-- GRANT INSERT, SELECT ON audit_log TO app_user;
-- REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM app_user;
```

### 1.3 Audit Recording Flow

```
Domain Mutation Request
  → Business logic executes in DB transaction
    → Before state captured (deep clone of entity)
    → Mutation applied
    → After state captured (deep clone of modified entity)
    → Audit entry created within same transaction
    → Previous hash retrieved from most recent audit entry
    → Current hash = SHA-256(previous_hash || current_entry_json)
    → Audit entry inserted
  → Transaction commits
  → Both the business change AND the audit record are durable
```

**Critical invariant:** The audit entry is created in the same database transaction as the business mutation. If the business mutation rolls back, the audit entry rolls back too. If it commits, both commit atomically.

---

## 2. What Gets Audited

### 2.1 Complete Audit Coverage

| Entity               | Audited Actions                                    | Before State?    | After State?     |
| -------------------- | -------------------------------------------------- | ---------------- | ---------------- |
| Journal Entry        | create, submit, approve, reject, void, soft_delete | Yes              | Yes              |
| Journal Entry Line   | (audited as part of parent journal entry)          | Yes              | Yes              |
| General Ledger Entry | (audited as part of journal entry posting)         | N/A              | N/A              |
| Fund                 | create, update_balance, deactivate                 | Yes              | Yes              |
| Offering Count Sheet | create, counter_submit, reconcile, lock            | Yes              | Yes              |
| Budget               | create, update, approve, reject                    | Yes              | Yes              |
| Member               | create, update, deactivate                         | Yes              | Yes              |
| Member Consent       | grant, revoke                                      | Yes              | Yes              |
| User                 | create, update_role, deactivate, password_change   | Yes (excl. hash) | Yes (excl. hash) |
| Period               | close, reopen                                      | Yes              | Yes              |
| Reconciliation       | create                                             | N/A              | Yes              |
| Settings             | update                                             | Yes              | Yes              |
| Chart of Accounts    | create, update, deactivate                         | Yes              | Yes              |
| Attachment           | upload, delete                                     | No               | Yes              |
| Login/Logout         | login_success, login_failed, logout                | N/A              | N/A              |
| Session              | create, expire, revoke                             | N/A              | N/A              |

### 2.2 What is NOT Audited

- **Read operations:** SELECT queries are NOT audited (would be excessive)
- **Internal calculations:** Trial balance, report generation (not mutations)
- **Cache operations:** TanStack Query cache updates
- **Health checks:** /api/health endpoints

---

## 3. Before/After State Capture

### 3.1 State Snapshot Mechanism

```typescript
// src/server/middleware/audit.middleware.ts
export class AuditInterceptor {
  /**
   * Wraps a mutation operation and captures full before/after state.
   */
  async auditMutation<T>(
    params: {
      eventType: string;
      entityType: string;
      entityId?: string;
      action: string;
      userId: string;
      userName: string;
      userRole: string;
      correlationId: string;
      ipAddress: string;
      userAgent: string;
    },
    mutation: () => Promise<T>,
    beforeStateProvider?: () => Promise<Record<string, unknown> | null>,
  ): Promise<T> {
    // 1. Capture before state (if applicable)
    let beforeState: Record<string, unknown> | null = null;
    if (beforeStateProvider) {
      beforeState = await beforeStateProvider();
    }

    // 2. Execute the mutation (within the caller's transaction)
    const result = await mutation();

    // 3. Build change summary
    let changeSummary: Record<string, unknown> | null = null;
    if (beforeState && result) {
      changeSummary = this.buildChangeSummary(beforeState, result as Record<string, unknown>);
    }

    // 4. Generate hash chain
    const previousHash = await this.auditRepo.getLatestHash();
    const currentEntry = {
      eventType: params.eventType,
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      userName: params.userName,
      action: params.action,
      beforeState,
      afterState: this.sanitizeState(result),
      changeSummary,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      correlationId: params.correlationId,
      createdAt: new Date().toISOString(),
    };
    const currentHash = this.computeHash(previousHash, JSON.stringify(currentEntry));

    // 5. Insert audit record
    await this.auditRepo.insert({
      ...params,
      beforeState: beforeState ? JSON.stringify(beforeState) : null,
      afterState: result ? JSON.stringify(this.sanitizeState(result)) : null,
      changeSummary: changeSummary ? JSON.stringify(changeSummary) : null,
      previousHash,
      currentHash,
    });

    return result;
  }

  /**
   * Sanitizes state before storing — removes sensitive fields.
   */
  private sanitizeState(state: unknown): Record<string, unknown> | null {
    if (!state || typeof state !== "object") return null;

    const sanitized = { ...(state as Record<string, unknown>) };

    // NEVER store in audit log:
    const REDACT_FIELDS = [
      "password_hash",
      "mfa_secret",
      "pin",
      "attachmentDataUrl", // base64 content — too large
      "attachment_data_url",
    ];

    for (const field of REDACT_FIELDS) {
      if (field in sanitized) {
        sanitized[field] = "[REDACTED]";
      }
    }

    // Truncate large fields to prevent bloating
    const MAX_FIELD_LENGTH = 10000;
    for (const key of Object.keys(sanitized)) {
      if (
        typeof sanitized[key] === "string" &&
        (sanitized[key] as string).length > MAX_FIELD_LENGTH
      ) {
        sanitized[key] = `[TRUNCATED: ${(sanitized[key] as string).length} chars]`;
      }
    }

    return sanitized;
  }

  /**
   * Builds a human-readable diff summarizing what changed.
   */
  private buildChangeSummary(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Record<string, unknown> {
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    for (const key of Object.keys(after)) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes[key] = { from: before[key], to: after[key] };
      }
    }

    return { changedFields: Object.keys(changes), changes };
  }
}
```

### 3.2 Usage in Services

```typescript
// Example: Using the audit interceptor in JournalService
async createEntry(input: CreateJournalEntryInput, userId: string): Promise<JournalEntry> {
  return await this.audit.auditMutation(
    {
      eventType: 'journal_entry_created',
      entityType: 'journal_entry',
      action: 'create',
      userId,
      userName: this.getUserName(userId),
      userRole: this.getUserRole(userId),
      correlationId: this.getCorrelationId(),
      ipAddress: this.getRequestIP(),
      userAgent: this.getRequestUserAgent(),
    },
    async () => {
      // The actual business logic
      return this.db.transaction(async (tx) => {
        const entry = await this.journalRepo.create(tx, input);
        await this.ledgerRepo.post(tx, entry);
        await this.fundRepo.updateBalance(tx, entry.fundId);
        return entry;
      });
    },
    // No before state (it's a create)
  );
}

// Example: Approving an entry (has before state)
async approve(entryId: string, approverId: string): Promise<JournalEntry> {
  return await this.audit.auditMutation(
    {
      eventType: 'journal_entry_approved',
      entityType: 'journal_entry',
      entityId: entryId,
      action: 'approve',
      userId: approverId,
      // ... other metadata
    },
    async () => {
      const entry = await this.journalRepo.approve(entryId, approverId);
      return entry;
    },
    // Before state provider: fetches the entry before approval
    async () => {
      const entry = await this.journalRepo.findById(entryId);
      return this.serializeEntity(entry);
    },
  );
}
```

---

## 4. Cryptographic Hash Chain

### 4.1 Hash Chain Algorithm

```typescript
// src/server/services/audit-hash.service.ts
import { createHash } from "crypto";

export class AuditHashService {
  /**
   * Computes the SHA-256 hash of an audit entry, chained to the previous hash.
   *
   * current_hash = SHA-256(previous_hash || serialized_entry)
   *
   * The "||" denotes concatenation.
   */
  computeHash(previousHash: string | null, serializedEntry: string): string {
    const input = previousHash ? previousHash + serializedEntry : serializedEntry;

    return createHash("sha256").update(input, "utf8").digest("hex");
  }

  /**
   * Verifies the integrity of the entire audit trail.
   * Returns the list of entries with broken hashes, if any.
   */
  async verifyAuditTrailIntegrity(): Promise<AuditIntegrityReport> {
    const entries = await this.auditRepo.findAllOrderedByDate();
    const brokenEntries: string[] = [];
    let previousHash: string | null = null;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Recompute the expected hash
      const entryData = this.serializeForHashing(entry);
      const expectedHash = this.computeHash(previousHash, entryData);

      if (expectedHash !== entry.currentHash) {
        brokenEntries.push(entry.id);
      }

      // Verify the previous_hash field matches
      if (entry.previousHash !== previousHash && i > 0) {
        brokenEntries.push(`${entry.id} (broken previous_hash link)`);
      }

      previousHash = entry.currentHash;
    }

    return {
      totalEntries: entries.length,
      brokenEntries,
      isIntegrityIntact: brokenEntries.length === 0,
      verifiedAt: new Date(),
      firstEntryDate: entries[0]?.createdAt ?? null,
      lastEntryDate: entries[entries.length - 1]?.createdAt ?? null,
    };
  }

  /**
   * Serializes an audit entry for hashing.
   * Must be deterministic — same fields, same order, every time.
   */
  private serializeForHashing(entry: AuditLogEntry): string {
    return JSON.stringify({
      eventType: entry.eventType,
      entityType: entry.entityType,
      entityId: entry.entityId,
      userId: entry.userId,
      userRole: entry.userRole,
      action: entry.action,
      beforeState: entry.beforeState,
      afterState: entry.afterState,
      changeSummary: entry.changeSummary,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      correlationId: entry.correlationId,
      previousHash: entry.previousHash,
      createdAt: entry.createdAt.toISOString(),
    });
  }
}
```

### 4.2 Verifier Endpoint

```typescript
// GET /api/v1/audit/verify-integrity
// Accessible only by auditor and super_admin roles
export const verifyAuditIntegrity = createServerFn(
  "GET",
  "/api/v1/audit/verify-integrity",
  async () => {
    const session = await validateSession();
    await authorize(session.userId, "audit.read");

    const report = await auditHashService.verifyAuditTrailIntegrity();

    // Log the verification attempt itself
    await auditRepo.insert({
      eventType: "audit_integrity_verification",
      entityType: "audit_log",
      action: "verify",
      userId: session.userId,
      userName: session.userName,
      userRole: session.userRole,
      correlationId: crypto.randomUUID(),
      afterState: JSON.stringify(report),
      currentHash: auditHashService.computeHash(
        null,
        JSON.stringify({
          report,
          verifiedBy: session.userId,
          verifiedAt: new Date().toISOString(),
        }),
      ),
    });

    return { data: report };
  },
);
```

---

## 5. Correlation IDs

### 5.1 Request Tracing

Every API request is assigned a unique `correlation_id` (UUID v7). This ID is:

- Generated at the API gateway layer
- Passed through all service calls, repository calls, and audit entries
- Returned in the response headers (`x-correlation-id`)
- Logged in every structured log entry

```typescript
// Correlation ID middleware
export function createCorrelationId(req: Request): string {
  // Prefer incoming header (for distributed tracing)
  const incoming = req.headers.get("x-correlation-id");
  if (incoming && isValidUUID(incoming)) return incoming;

  return generateUUIDv7(); // Time-ordered UUID
}

// In a server function:
const correlationId = createCorrelationId(ctx.request);

// Passed to all downstream services:
await journalService.createEntry(input, userId, { correlationId });

// All audit entries from one request share the same correlation_id
// This allows: "Show me everything that happened in request X"
```

### 5.2 Correlation ID Query

```sql
-- Reconstruct everything that happened in a single request
SELECT
  event_type,
  entity_type,
  action,
  created_at
FROM audit_log
WHERE correlation_id = 'uuid-of-request'
ORDER BY created_at;
```

---

## 6. Forensic Metadata

### 6.1 Captured Metadata

Every audit entry includes:

| Field            | Source          | Purpose                            |
| ---------------- | --------------- | ---------------------------------- |
| `user_id`        | JWT session     | Who performed the action           |
| `user_name`      | Database        | Human-readable identity            |
| `user_role`      | JWT session     | What permissions they had          |
| `ip_address`     | Request headers | Network origin                     |
| `user_agent`     | Request headers | Client device/browser              |
| `correlation_id` | Request context | Request tracing                    |
| `created_at`     | Server clock    | When (server's authoritative time) |

### 6.2 Device Fingerprint (Future Enhancement)

For M6+, add a `device_fingerprint` field:

```typescript
const fingerprint = createHash("sha256")
  .update(`${ip_address}:${user_agent}:${session_id}`)
  .digest("hex");
```

---

## 7. Audit Log Viewing & Export

### 7.1 Audit Viewer (UI)

The audit page (`_app.audit.tsx`) provides:

- Chronological log entries (newest first)
- Filter by: date range, entity type, event type, user, correlation ID
- Drill-down: click an entry to see full before/after state
- Highlight: entries with `change_summary` showing what changed
- Export: selected entries to PDF/CSV for external auditor

### 7.2 Export Format

```typescript
export interface AuditExportRow {
  id: string;
  timestamp: string; // ISO 8601
  eventType: string;
  entityType: string;
  entityId: string;
  user: string; // "name (role)"
  action: string;
  changeDescription: string; // Human-readable from change_summary
  beforeState: string; // Pretty-printed JSON
  afterState: string;
  ipAddress: string;
  correlationId: string;
  hashVerified: boolean; // Was this entry's hash verified at export time?
}
```

---

## 8. External SIEM Forwarding

### 8.1 Forwarding Architecture

```
Grace Ledger Server
  → Audit log inserted into PostgreSQL
  → AuditForwarder service reads from audit_log (poll or trigger)
  → Formats as syslog (RFC 5424) or JSON
  → Forwards to external SIEM via TLS
  → External SIEM stores independently
```

### 8.2 SIEM Configuration

```typescript
// src/server/infrastructure/siem-forward.ts
export class SIEMForwarder {
  private readonly SIEM_ENDPOINT = process.env.SIEM_ENDPOINT;
  private readonly SIEM_TOKEN = process.env.SIEM_API_TOKEN;

  async forward(auditEntry: AuditLogEntry): Promise<void> {
    if (!this.SIEM_ENDPOINT) return; // Optional feature

    const payload = {
      timestamp: auditEntry.createdAt.toISOString(),
      source: "grace-ledger",
      host: process.env.APP_URL,
      event: {
        type: auditEntry.eventType,
        entity: auditEntry.entityType,
        entityId: auditEntry.entityId,
        action: auditEntry.action,
        user: {
          id: auditEntry.userId,
          name: auditEntry.userName,
          role: auditEntry.userRole,
        },
        metadata: {
          ipAddress: auditEntry.ipAddress,
          userAgent: auditEntry.userAgent,
          correlationId: auditEntry.correlationId,
        },
        hash: auditEntry.currentHash,
      },
    };

    await fetch(this.SIEM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.SIEM_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
  }
}
```

### 8.3 Why Forward to SIEM?

The external SIEM provides:

- **Independent copy:** Even if the PostgreSQL database is compromised, SIEM has a copy
- **Tamper comparison:** SIEM hash chain can be compared against source database
- **Alerting:** SIEM can alert on suspicious patterns (e.g., audit log deletions at DB level)
- **Long-term retention:** SIEM may have longer retention than operational database

---

## 9. Retention & Archival

### 9.1 Retention Policy

| Period      | Action                                                          |
| ----------- | --------------------------------------------------------------- |
| 0 – 7 years | Audit log remains in operational database (active query access) |
| 7+ years    | Audit log archived to cold storage (S3 Glacier)                 |
| Permanent   | For journal entries — never deleted (linked records must exist) |

### 9.2 Archival Process

```typescript
async archiveOldAuditLogs(beforeYear: number): Promise<void> {
  // 1. Export audit entries older than the cutoff to JSONL file
  const oldEntries = await this.auditRepo.findOlderThan(beforeYear);

  // 2. Upload to cold storage
  const archiveKey = `audit-archives/${beforeYear}/audit-log-${beforeYear}.jsonl`;
  await this.storageService.upload(archiveKey, JSON.stringify(oldEntries));

  // 3. Verify the archive (re-download and validate hash chain)
  const archived = await this.storageService.download(archiveKey);
  const verified = await this.verifyArchivedIntegrity(archived);

  if (!verified) {
    throw new AuditArchiveError('Archive integrity verification failed');
  }

  // 4. Mark entries as archived (do NOT delete)
  await this.auditRepo.markAsArchived(beforeYear, archiveKey);

  // 5. Log the archival operation
  await this.auditRepo.insert({
    eventType: 'audit_archived',
    entityType: 'audit_log',
    action: 'archive',
    afterState: JSON.stringify({ beforeYear, archiveKey, entryCount: oldEntries.length }),
    currentHash: this.hashService.computeHash(null, JSON.stringify({ beforeYear, archiveKey })),
  });
}
```

---

## 10. Auditor Verification

### 10.1 External Auditor Toolkit

External auditors can verify the audit trail independently:

**Option 1: API Endpoint**

```
GET /api/v1/audit/verify-integrity
→ { isIntegrityIntact: true, totalEntries: 15432, ... }
```

**Option 2: Audit Export with Hash Verification**

```
GET /api/v1/audit/export?from=2026-01-01&to=2026-12-31
→ JSONL file with hash chain metadata
→ Auditor can run independent hash verification script
```

**Option 3: Independent Verifier Script**

```bash
#!/bin/bash
# verify-audit-chain.sh
# Provided to external auditors for independent verification
# Usage: ./verify-audit-chain.sh audit-export-2026.jsonl

PREVIOUS_HASH=""
LINE_NUMBER=0
INTEGRITY_OK=true

while IFS= read -r line; do
  LINE_NUMBER=$((LINE_NUMBER + 1))

  # Extract previous_hash and current_hash from JSON
  ENTRY_PREV_HASH=$(echo "$line" | jq -r '.previousHash // empty')
  ENTRY_CURR_HASH=$(echo "$line" | jq -r '.currentHash')

  # Remove hash fields for re-computation
  ENTRY_FOR_HASH=$(echo "$line" | jq 'del(.previousHash, .currentHash)' | jq -c .)

  # Re-compute expected hash
  if [ -z "$PREVIOUS_HASH" ]; then
    EXPECTED_HASH=$(echo -n "$ENTRY_FOR_HASH" | sha256sum | cut -d' ' -f1)
  else
    EXPECTED_HASH=$(echo -n "${PREVIOUS_HASH}${ENTRY_FOR_HASH}" | sha256sum | cut -d' ' -f1)
  fi

  if [ "$EXPECTED_HASH" != "$ENTRY_CURR_HASH" ]; then
    echo "INTEGRITY BROKEN at line $LINE_NUMBER"
    echo "  Expected: $EXPECTED_HASH"
    echo "  Got:      $ENTRY_CURR_HASH"
    INTEGRITY_OK=false
    break
  fi

  # Verify previous_hash link
  if [ -n "$ENTRY_PREV_HASH" ] && [ "$ENTRY_PREV_HASH" != "$PREVIOUS_HASH" ]; then
    echo "CHAIN BROKEN at line $LINE_NUMBER"
    echo "  Expected previous: $PREVIOUS_HASH"
    echo "  Got previous:      $ENTRY_PREV_HASH"
    INTEGRITY_OK=false
    break
  fi

  PREVIOUS_HASH="$ENTRY_CURR_HASH"
done < "$1"

if [ "$INTEGRITY_OK" = true ]; then
  echo "✅ Audit trail integrity VERIFIED ($LINE_NUMBER entries)"
  exit 0
else
  echo "❌ Audit trail integrity COMPROMISED"
  exit 1
fi
```

### 10.2 What Auditors Can Verify

| Verification                                | Method                                                         |
| ------------------------------------------- | -------------------------------------------------------------- |
| No entries have been inserted retroactively | Hash chain integrity check                                     |
| No entries have been modified               | Hash chain integrity check                                     |
| No entries have been deleted                | Sequential completeness check (gap detection)                  |
| A specific transaction's audit trail        | Drill-down by entity_id                                        |
| A user's complete activity history          | Filter by user_id                                              |
| Financial state at any point in time        | Replay audit log from beginning + verify against trial balance |

---

## Appendix A: Audit Event Type Catalog

### A.1 Journal Entry Events

| Event Type                | Action      | Before         | After                     |
| ------------------------- | ----------- | -------------- | ------------------------- |
| `journal_entry_created`   | create      | null           | Full entry                |
| `journal_entry_submitted` | submit      | draft entry    | pending entry             |
| `journal_entry_approved`  | approve     | pending entry  | approved entry            |
| `journal_entry_rejected`  | reject      | pending entry  | rejected entry            |
| `journal_entry_voided`    | void        | approved entry | voided entry + void entry |
| `journal_entry_deleted`   | soft_delete | entry          | entry (marked deleted)    |

### A.2 Fund Events

| Event Type             | Action     | Before      | After         |
| ---------------------- | ---------- | ----------- | ------------- |
| `fund_created`         | create     | null        | fund          |
| `fund_balance_updated` | update     | old balance | new balance   |
| `fund_deactivated`     | deactivate | active fund | inactive fund |

### A.3 Period Events

| Event Type        | Action | Before        | After                          |
| ----------------- | ------ | ------------- | ------------------------------ |
| `period_closed`   | close  | open period   | closed period + fund snapshots |
| `period_reopened` | reopen | closed period | open period                    |

### A.4 Authentication Events

| Event Type         | Action          | Before              | After                 |
| ------------------ | --------------- | ------------------- | --------------------- |
| `login_success`    | login           | null                | session created       |
| `login_failed`     | login_failed    | null                | failed_attempts count |
| `logout`           | logout          | session             | session deleted       |
| `account_locked`   | lock            | unlocked user       | locked user           |
| `password_changed` | password_change | old hash (redacted) | new hash (redacted)   |
| `mfa_enrolled`     | mfa_enable      | mfa_disabled        | mfa_enabled           |

### A.5 System Events

| Event Type                 | Action  | Before       | After               |
| -------------------------- | ------- | ------------ | ------------------- |
| `settings_updated`         | update  | old settings | new settings        |
| `audit_integrity_verified` | verify  | null         | verification report |
| `audit_archived`           | archive | null         | archive metadata    |

---

_The audit trail is the central pillar of Grace Ledger v2's trustworthiness. It is immutable, cryptographically verifiable, and sufficient for external financial audits. Without a trustworthy audit trail, a financial system is nothing._
