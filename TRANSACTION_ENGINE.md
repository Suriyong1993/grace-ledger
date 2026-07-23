# Grace Ledger v2 — Transaction Engine

**Version:** 2.0
**Date:** 22 July 2026

---

## Table of Contents

1. [Transaction Lifecycle](#1-transaction-lifecycle)
2. [State Machine Implementation](#2-state-machine-implementation)
3. [Approval Workflow Engine](#3-approval-workflow-engine)
4. [Concurrency Control](#4-concurrency-control)
5. [Sequential Transaction Numbering](#5-sequential-transaction-numbering)
6. [Batch Operations](#6-batch-operations)
7. [Error Recovery & Idempotency](#7-error-recovery--idempotency)

---

## 1. Transaction Lifecycle

### 1.1 Lifecycle States

Every financial transaction in Grace Ledger v2 is a journal entry that flows through a defined state machine:

```
DRAFT ──submit()──→ PENDING ──approve()──→ APPROVED ──void()──→ VOIDED
  │                    │                      │
  │                    └──reject()──→ REJECTED ──resubmit()──→ DRAFT
  │                                                        │
  └──softDelete()──→ (SOFT_DELETED)                        │
                                                           │
REJECTED ──softDelete()──→ (SOFT_DELETED)
```

### 1.2 State Definitions

| State | Description | Can Edit? | Can Delete? | Next States |
|-------|-------------|-----------|-------------|-------------|
| `draft` | In-progress entry, not yet submitted | Yes (creator only) | Yes (soft delete) | `pending`, `deleted` |
| `pending` | Submitted for approval | No | No | `approved`, `rejected` |
| `approved` | Approved and posted to GL | No | No | `voided` |
| `rejected` | Declined by approver | No | Yes (soft delete) | `draft` (resubmit) |
| `voided` | Reversed — terminal state | No | No | None (terminal) |
| `deleted` | Soft-deleted — recoverable for 30 days | No | No | None (can be restored) |

---

## 2. State Machine Implementation

### 2.1 State Machine Service

```typescript
// src/server/services/transaction-state-machine.ts

export type TransactionState = 'draft' | 'pending' | 'approved' | 'rejected' | 'voided';
export type TransactionEvent =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'resubmit'
  | 'void'
  | 'soft_delete';

interface StateTransition {
  from: TransactionState | TransactionState[];
  to: TransactionState;
  event: TransactionEvent;
  guard?: (entry: JournalEntry, actor: User) => Promise<void> | void;
  action?: (entry: JournalEntry, actor: User, reason?: string) => Promise<void>;
}

export class TransactionStateMachine {
  private readonly transitions: StateTransition[] = [
    // Submit: draft → pending
    {
      from: 'draft',
      to: 'pending',
      event: 'submit',
      guard: async (entry, actor) => {
        // Creator must be the one submitting
        if (entry.createdBy !== actor.id) {
          throw new ForbiddenError('Only the creator can submit this entry');
        }
        // Period must be open
        await this.periodService.assertPeriodOpen(entry.fiscalYear, entry.fiscalPeriod);
      },
    },

    // Approve: pending → approved
    {
      from: 'pending',
      to: 'approved',
      event: 'approve',
      guard: async (entry, actor) => {
        // No self-approval
        if (entry.createdBy === actor.id) {
          throw new SelfApprovalError('Cannot approve own transaction');
        }
        // Actor must have approval permission
        await this.authService.assertPermission(actor.id, 'journal.approve');
        // Dual approval check is handled in ApprovalService, not here
      },
      action: async (entry, actor) => {
        await this.journalRepo.updateStatus(entry.id, 'approved', actor.id);
        await this.auditService.recordApproval(entry, actor);
      },
    },

    // Reject: pending → rejected
    {
      from: 'pending',
      to: 'rejected',
      event: 'reject',
      guard: async (entry, actor) => {
        await this.authService.assertPermission(actor.id, 'journal.approve');
      },
      action: async (entry, actor, reason) => {
        if (!reason || reason.trim().length < 10) {
          throw new ValidationError('Rejection reason must be at least 10 characters');
        }
        await this.journalRepo.updateStatus(entry.id, 'rejected');
        await this.journalRepo.setRejectionReason(entry.id, reason);
        await this.auditService.recordRejection(entry, actor, reason);
      },
    },

    // Resubmit: rejected → draft
    {
      from: 'rejected',
      to: 'draft',
      event: 'resubmit',
      guard: async (entry, actor) => {
        if (entry.createdBy !== actor.id) {
          throw new ForbiddenError('Only the creator can resubmit');
        }
      },
    },

    // Void: approved → voided (creates reversing entry)
    {
      from: 'approved',
      to: 'voided',
      event: 'void',
      guard: async (entry, actor) => {
        await this.authService.assertPermission(actor.id, 'journal.void');
      },
      action: async (entry, actor, reason) => {
        if (!reason || reason.trim().length < 10) {
          throw new ValidationError('Void reason must be at least 10 characters');
        }
        // Create reversing entry — handled by JournalService.voidEntry()
        await this.journalService.voidEntry(entry.id, reason, actor.id);
        await this.auditService.recordVoid(entry, actor, reason);
      },
    },

    // Soft delete: draft|rejected → deleted
    {
      from: ['draft', 'rejected'],
      to: 'deleted',
      event: 'soft_delete',
      guard: async (entry, actor) => {
        if (entry.createdBy !== actor.id) {
          throw new ForbiddenError('Only the creator can delete this entry');
        }
      },
      action: async (entry, actor) => {
        await this.journalRepo.softDelete(entry.id, actor.id);
        await this.auditService.recordDeletion(entry, actor);
      },
    },
  ];

  async transition(
    entry: JournalEntry,
    event: TransactionEvent,
    actor: User,
    reason?: string,
  ): Promise<JournalEntry> {
    const validTransition = this.transitions.find(
      t =>
        (Array.isArray(t.from) ? t.from.includes(entry.status) : t.from === entry.status) &&
        t.event === event,
    );

    if (!validTransition) {
      throw new InvalidTransitionError(
        `Cannot '${event}' from state '${entry.status}'. ` +
        `Valid events from '${entry.status}': ${this.getValidEvents(entry.status).join(', ')}`,
      );
    }

    // Run guard check
    if (validTransition.guard) {
      await validTransition.guard(entry, actor);
    }

    // Execute transition action
    if (validTransition.action) {
      await validTransition.action(entry, actor, reason);
    }

    // Return updated entry
    return this.journalRepo.findById(entry.id);
  }

  getValidEvents(state: TransactionState): TransactionEvent[] {
    return this.transitions
      .filter(t =>
        Array.isArray(t.from) ? t.from.includes(state) : t.from === state,
      )
      .map(t => t.event);
  }

  getValidNextStates(state: TransactionState): TransactionState[] {
    return this.transitions
      .filter(t =>
        Array.isArray(t.from) ? t.from.includes(state) : t.from === state,
      )
      .map(t => t.to);
  }
}
```

### 2.2 State Validation on Route Handlers

```typescript
// Each server function checks the state machine before mutating
export const approveEntry = createServerFn(
  'POST',
  '/api/v1/journal/:id/approve',
  async (params) => {
    const session = await validateSession();
    const user = await authorize(session.userId, 'journal.approve');

    const entry = await journalRepo.findById(params.id);
    if (!entry) throw new NotFoundError('Journal entry not found');

    // State machine transition
    const updated = await stateMachine.transition(entry, 'approve', user);

    return { data: updated };
  },
);
```

---

## 3. Approval Workflow Engine

### 3.1 Tiered Approval

```typescript
// src/server/services/approval.service.ts
export class ApprovalService {
  private readonly TIER_1_THRESHOLD = 5000;    // ฿5,000
  private readonly TIER_2_THRESHOLD = 50000;   // ฿50,000

  /**
   * Determines the required approval tier for a given amount.
   */
  getApprovalTier(amount: Money): 'tier1' | 'tier2' | 'tier3' {
    const baht = amount.toNumber();
    if (baht < this.TIER_1_THRESHOLD) return 'tier1';
    if (baht < this.TIER_2_THRESHOLD) return 'tier2';
    return 'tier3';
  }

  /**
   * Checks if a user has sufficient approval authority for the amount.
   */
  async canApprove(user: User, amount: Money): Promise<boolean> {
    const tier = this.getApprovalTier(amount);

    switch (tier) {
      case 'tier1': // < ฿5,000
        return ['super_admin', 'pastor', 'treasurer'].includes(user.role);

      case 'tier2': // ฿5,000 – ฿50,000
        return ['super_admin', 'pastor'].includes(user.role);

      case 'tier3': // > ฿50,000
        // Requires super_admin involvement (either alone or as co-approver)
        return user.role === 'super_admin';
    }
  }

  /**
   * Full approval check including self-approval, permissions, and tier.
   */
  async approve(entryId: string, approverId: string): Promise<JournalEntry> {
    const entry = await this.journalRepo.findById(entryId);
    const approver = await this.userRepo.findById(approverId);

    // 1. State check
    if (entry.status !== 'pending') {
      throw new InvalidTransitionError('Entry is not pending approval');
    }

    // 2. Self-approval check
    if (entry.createdBy === approverId) {
      throw new SelfApprovalError('Cannot approve own transaction');
    }

    // 3. Permission check
    if (!(await this.canApprove(approver, entry.totalDebit))) {
      throw new ForbiddenError(
        `Role '${approver.role}' cannot approve transactions of this amount`,
      );
    }

    // 4. Tier 3: dual approval logic
    if (this.getApprovalTier(entry.totalDebit) === 'tier3') {
      return this.handleTier3Approval(entry, approver);
    }

    // 5. Single approval: complete it
    return this.completeApproval(entry, approver);
  }

  private async handleTier3Approval(
    entry: JournalEntry,
    approver: User,
  ): Promise<JournalEntry> {
    // Tier 3 requires two approvers
    // First approver must be pastor; second must be super_admin
    // OR super_admin alone can do single approval

    if (approver.role === 'super_admin') {
      // Super admin can approve tier 3 alone
      return this.completeApproval(entry, approver);
    }

    if (approver.role === 'pastor') {
      // Pastor is first approver — record and keep pending
      await this.journalRepo.recordFirstApproval(entry.id, approver.id);
      const updated = await this.journalRepo.findById(entry.id);

      // Notify all super_admins that dual approval is needed
      await this.notificationService.notifyDualApprovalNeeded(entry.id);

      return updated; // Still pending
    }

    throw new ForbiddenError('Only pastor or super_admin can approve tier 3 transactions');
  }

  private async completeApproval(
    entry: JournalEntry,
    approver: User,
  ): Promise<JournalEntry> {
    return await this.db.transaction(async (tx) => {
      await this.journalRepo.updateStatus(tx, entry.id, 'approved', approver.id);
      await this.auditService.recordApproval(tx, entry, approver);
      return this.journalRepo.findById(tx, entry.id);
    });
  }
}
```

### 3.2 Approval Notification

```typescript
// Notifications triggered on approval events
export class ApprovalNotificationService {
  async notifyApprovalNeeded(entry: JournalEntry): Promise<void> {
    const approvers = await this.findEligibleApprovers(entry.totalDebit);

    for (const approver of approvers) {
      await this.createNotification({
        userId: approver.id,
        type: 'approval_required',
        title: `รายการรออนุมัติ: ${entry.description}`,
        body: `จำนวน ${entry.totalDebit.format()} — ${entry.entryNumber}`,
        actionUrl: `/journal/${entry.id}`,
      });
    }
  }

  async notifyApprovalComplete(entry: JournalEntry, creatorId: string): Promise<void> {
    await this.createNotification({
      userId: creatorId,
      type: 'approved',
      title: `รายการอนุมัติแล้ว: ${entry.description}`,
      body: `รายการ ${entry.entryNumber} จำนวน ${entry.totalDebit.format()}`,
      actionUrl: `/journal/${entry.id}`,
    });
  }

  async notifyRejected(
    entry: JournalEntry,
    creatorId: string,
    reason: string,
  ): Promise<void> {
    await this.createNotification({
      userId: creatorId,
      type: 'rejected',
      title: `รายการถูกปฏิเสธ: ${entry.description}`,
      body: `เหตุผล: ${reason}`,
      actionUrl: `/journal/${entry.id}`,
    });
  }
}
```

---

## 4. Concurrency Control

### 4.1 Optimistic Locking

Every mutable entity has a `version` column. The application checks the version before updating to detect concurrent modifications.

```typescript
// src/server/repositories/journal.repository.ts
export class PostgresJournalRepository {
  async updateStatus(
    tx: Transaction,
    entryId: string,
    newStatus: TransactionState,
    approvedById?: string,
  ): Promise<void> {
    const result = await tx
      .update(journalEntries)
      .set({
        status: newStatus,
        approvedBy: approvedById ?? null,
        approvedAt: newStatus === 'approved' ? new Date() : null,
        updatedAt: new Date(),
        version: sql`version + 1`,
      })
      .where(
        and(
          eq(journalEntries.id, entryId),
          eq(journalEntries.version, entry.version), // Optimistic lock check
        ),
      );

    if (result.rowCount === 0) {
      throw new ConcurrencyConflictError(
        'This record was modified by another user. Please refresh and try again.',
      );
    }
  }
}
```

### 4.2 Conflict Resolution

```typescript
// Client-side conflict handling
export function useOptimisticMutation<T>(
  mutationFn: (input: T) => Promise<T>,
) {
  const toast = useToast();

  return useMutation({
    mutationFn,
    onError: (error: APIError) => {
      if (error.code === 'CONFLICT') {
        toast.error(
          'มีผู้อื่นแก้ไขข้อมูลนี้ในเวลาเดียวกัน กรุณารีเฟรชและลองอีกครั้ง',
          { duration: 8000 },
        );
        // Invalidate queries to get fresh data
        queryClient.invalidateQueries();
      }
    },
    retry: (failureCount, error) => {
      // Don't retry conflicts — user needs to resolve
      if (error instanceof ConcurrencyConflictError) return false;
      return failureCount < 3;
    },
  });
}
```

### 4.3 Database Isolation Level

Financial transactions (journal entry creation + GL posting) use `SERIALIZABLE` isolation:

```typescript
async createEntry(input: CreateJournalEntryInput, userId: string): Promise<JournalEntry> {
  return await this.db.transaction(async (tx) => {
    // Set serializable isolation for financial integrity
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);

    // ... create entry, post to GL, update balances, audit ...

    return entry;
  }, {
    isolationLevel: 'serializable',
    retry: {
      maxRetries: 3,
      onRetry: (attempt) => {
        logger.warn({ event: 'transaction_retry', attempt });
      },
    },
  });
}
```

---

## 5. Sequential Transaction Numbering

### 5.1 Number Generator

```typescript
// src/server/services/sequence.service.ts
export class SequenceService {
  /**
   * Generates the next sequential number for a given prefix and year.
   * Uses a PostgreSQL sequence to guarantee no gaps.
   */
  async nextEntryNumber(
    entryType: EntryType,
    fiscalYear: number,
  ): Promise<string> {
    const prefix = {
      'offering': 'OFF',
      'expense': 'EXP',
      'income': 'INC',
      'transfer': 'TRF',
      'opening': 'OPN',
      'adjustment': 'ADJ',
      'void': 'VOID',
    }[entryType];

    const sequenceName = `seq_${prefix}_${fiscalYear}`;

    // Ensure the sequence exists
    await this.ensureSequence(sequenceName, prefix, fiscalYear);

    // Get next value (atomic, no gaps)
    const result = await this.db.execute<{ nextval: number }>(
      sql`SELECT nextval(${sequenceName}) AS nextval`,
    );

    const sequence = result.rows[0].nextval;
    return `${prefix}-${fiscalYear}-${String(sequence).padStart(4, '0')}`;
  }

  private async ensureSequence(
    sequenceName: string,
    prefix: string,
    fiscalYear: number,
  ): Promise<void> {
    await this.db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = ${sequenceName}
        ) THEN
          CREATE SEQUENCE ${sql.identifier(sequenceName)} START 1;
        END IF;
      END
      $$;
    `);
  }

  /**
   * Detects gaps in the sequence — audit tool, not runtime check.
   */
  async detectGaps(
    entryType: EntryType,
    fiscalYear: number,
  ): Promise<number[]> {
    const prefix = {
      'offering': 'OFF',
      'expense': 'EXP',
      'income': 'INC',
      'transfer': 'TRF',
    }[entryType];

    const result = await this.db.execute<{ entry_number: string }>(
      sql`SELECT entry_number FROM journal_entries
          WHERE entry_type = ${entryType}
          AND fiscal_year = ${fiscalYear}
          AND status != 'deleted'
          ORDER BY entry_number`,
    );

    // Parse sequence numbers and find gaps
    const numbers = result.rows
      .map(r => parseInt(r.entry_number.split('-')[2], 10))
      .sort((a, b) => a - b);

    const gaps: number[] = [];
    for (let i = 1; i < numbers[numbers.length - 1]; i++) {
      if (!numbers.includes(i)) {
        gaps.push(i);
      }
    }

    return gaps; // These represent voided or deleted entries
  }
}
```

---

## 6. Batch Operations

### 6.1 Sunday Count Sheet Batch Create

```typescript
export class BatchTransactionService {
  /**
   * Creates multiple offering journal entries atomically.
   * All succeed or all fail — no partial creations.
   */
  async createOfferingsFromCountSheet(
    countSheet: OfferingCountSheet,
    offeringRows: CountSheetRow[],
    userId: string,
  ): Promise<JournalEntry[]> {
    return await this.db.transaction(async (tx) => {
      const entries: JournalEntry[] = [];

      for (const row of offeringRows) {
        const category = await this.offeringCategoryRepo.findById(row.categoryId);
        const assetAccount = row.channel === 'cash' ? '1-1001' : '1-1002';

        const entry = await this.journalService.createEntryWithinTransaction(
          tx,
          {
            entryType: 'offering',
            postingDate: countSheet.date,
            description: `เงินถวายวันที่ ${countSheet.date}: ${category.name}`,
            fundId: row.fundId,
            fiscalYear: this.getFiscalYear(countSheet.date),
            fiscalPeriod: this.getFiscalPeriod(countSheet.date),
            lines: [
              {
                accountId: assetAccount,
                lineType: 'debit',
                amount: row.amount,
                fundId: row.fundId,
                memberId: row.memberId,
                description: row.note,
              },
              {
                accountId: category.accountId,
                lineType: 'credit',
                amount: row.amount,
                fundId: row.fundId,
                memberId: row.memberId,
                description: category.name,
              },
            ],
          },
          userId,
          { skipApproval: false },
        );

        entries.push(entry);
      }

      // Lock the count sheet after all entries are created
      await this.countSheetRepo.lock(tx, countSheet.id, userId);

      return entries;
    }, {
      isolationLevel: 'serializable',
    });
  }
}
```

### 6.2 Bulk Approval

```typescript
async bulkApprove(entryIds: string[], approverId: string): Promise<{
  approved: string[];
  failed: { entryId: string; reason: string }[];
}> {
  const approved: string[] = [];
  const failed: { entryId: string; reason: string }[] = [];

  for (const entryId of entryIds) {
    try {
      await this.approvalService.approve(entryId, approverId);
      approved.push(entryId);
    } catch (error) {
      failed.push({
        entryId,
        reason: error instanceof DomainError ? error.message : 'Unknown error',
      });
    }
  }

  return { approved, failed };
}
```

---

## 7. Error Recovery & Idempotency

### 7.1 Idempotency Keys

All mutation endpoints accept an optional `idempotency_key` header. The server stores the key + response for 24 hours, preventing duplicate operations.

```typescript
// src/server/middleware/idempotency.middleware.ts
export async function idempotencyMiddleware(
  ctx: ServerFnContext,
  next: () => Promise<unknown>,
): Promise<unknown> {
  const key = ctx.headers.get('x-idempotency-key');
  if (!key) return next();

  // Check if this key was already processed
  const cached = await idempotencyRepo.findResponse(key);
  if (cached) {
    logger.info({ event: 'idempotency_cache_hit', key });
    return cached.response;
  }

  // Execute the operation
  const response = await next();

  // Cache the response
  await idempotencyRepo.storeResponse(key, response, 24 * 60 * 60); // 24 hours

  return response;
}
```

### 7.2 Transaction Rollback

All financial operations are wrapped in database transactions. If any step fails:

- All database changes within the transaction are rolled back
- No partial journal entries can exist
- No unbalanced ledger postings can persist

```typescript
try {
  const result = await this.db.transaction(async (tx) => {
    // Step 1: Create journal entry
    // Step 2: Post to GL
    // Step 3: Update fund balance
    // Step 4: Create audit record
    // If any step fails → entire transaction rolls back
  });
  return result;
} catch (error) {
  logger.error({
    event: 'transaction_rollback',
    error: error.message,
    correlationId: ctx.correlationId,
  });
  throw error;
}
```

---

*The transaction engine enforces the state machine, approval workflow, and concurrency control for every financial operation in Grace Ledger v2. No transaction can bypass these controls.*