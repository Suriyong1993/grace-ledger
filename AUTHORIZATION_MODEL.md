# Grace Ledger v2 — Authorization Model

**Version:** 2.0
**Date:** 22 July 2026

---

## Table of Contents

1. [Role Definitions](#1-role-definitions)
2. [Permission Matrix](#2-permission-matrix)
3. [Permission Definitions](#3-permission-definitions)
4. [Enforcement Architecture](#4-enforcement-architecture)
5. [Row-Level Security Policies](#5-row-level-security-policies)
6. [Self-Approval Prevention](#6-self-approval-prevention)
7. [Transaction Limits per Role](#7-transaction-limits-per-role)
8. [Permission Audit & Review](#8-permission-audit--review)

---

## 1. Role Definitions

| Role          | Code            | Description                                                   | Access Level               |
| ------------- | --------------- | ------------------------------------------------------------- | -------------------------- |
| Super Admin   | `super_admin`   | Full system access; manages users and settings                | All permissions            |
| Pastor        | `pastor`        | Senior church leader; approves transactions and views reports | Approval + view            |
| Treasurer     | `treasurer`     | Manages day-to-day finance; creates transactions              | Write + cannot approve own |
| Finance Staff | `finance_staff` | Data entry; creates transactions                              | Write (limited)            |
| Auditor       | `auditor`       | External/internal reviewer; read-only access to audit trail   | Read-only                  |
| Viewer        | `viewer`        | Read-only access to non-sensitive data                        | Read-only (limited)        |

### 1.1 Role Hierarchy

```
super_admin
  ├── pastor       (approval authority)
  │     └── treasurer   (operational write)
  │           └── finance_staff   (limited write)
  ├── auditor      (independent — read-only, audit log access)
  └── viewer       (minimal read-only)
```

**Note:** Roles do not inherit permissions. Each role has an explicit set of permissions defined in the matrix. The hierarchy above illustrates typical organizational authority, not code-level inheritance.

---

## 2. Permission Matrix

### 2.1 Full Matrix

| Permission                    | super_admin | pastor | treasurer | finance_staff | auditor | viewer |
| ----------------------------- | :---------: | :----: | :-------: | :-----------: | :-----: | :----: |
| **Journal & Transactions**    |             |        |           |               |         |        |
| `journal.write`               |     ✅      |   ❌   |    ✅     |      ✅       |   ❌    |   ❌   |
| `journal.approve`             |     ✅      |   ✅   |    ❌     |      ❌       |   ❌    |   ❌   |
| `journal.void`                |     ✅      |   ✅   |    ❌     |      ❌       |   ❌    |   ❌   |
| `journal.read`                |     ✅      |   ✅   |    ✅     |      ✅       |   ✅    |   ✅   |
| **Offering**                  |             |        |           |               |         |        |
| `offering.write`              |     ✅      |   ❌   |    ✅     |      ✅       |   ❌    |   ❌   |
| `offering.approve`            |     ✅      |   ✅   |    ❌     |      ❌       |   ❌    |   ❌   |
| `offering.read`               |     ✅      |   ✅   |    ✅     |      ✅       |   ✅    |   ✅   |
| `offering.count_sheet`        |     ✅      |   ❌   |    ✅     |      ✅       |   ❌    |   ❌   |
| `offering.count_sheet.lock`   |     ✅      |   ✅   |    ❌     |      ❌       |   ❌    |   ❌   |
| **Expense**                   |             |        |           |               |         |        |
| `expense.write`               |     ✅      |   ❌   |    ✅     |      ✅       |   ❌    |   ❌   |
| `expense.approve`             |     ✅      |   ✅   |    ❌     |      ❌       |   ❌    |   ❌   |
| `expense.read`                |     ✅      |   ✅   |    ✅     |      ✅       |   ✅    |   ✅   |
| **Income**                    |             |        |           |               |         |        |
| `income.write`                |     ✅      |   ❌   |    ✅     |      ✅       |   ❌    |   ❌   |
| `income.approve`              |     ✅      |   ✅   |    ❌     |      ❌       |   ❌    |   ❌   |
| `income.read`                 |     ✅      |   ✅   |    ✅     |      ✅       |   ✅    |   ✅   |
| **Funds**                     |             |        |           |               |         |        |
| `fund.create`                 |     ✅      |   ❌   |    ✅     |      ❌       |   ❌    |   ❌   |
| `fund.transfer`               |     ✅      |   ❌   |    ✅     |      ❌       |   ❌    |   ❌   |
| `fund.read`                   |     ✅      |   ✅   |    ✅     |      ✅       |   ✅    |   ✅   |
| **Chart of Accounts**         |             |        |           |               |         |        |
| `coa.write`                   |     ✅      |   ❌   |    ❌     |      ❌       |   ❌    |   ❌   |
| `coa.read`                    |     ✅      |   ✅   |    ✅     |      ✅       |   ✅    |   ✅   |
| **Period Management**         |             |        |           |               |         |        |
| `period.close`                |     ✅      |   ❌   |    ✅     |      ❌       |   ❌    |   ❌   |
| `period.reopen`               |     ✅      |   ❌   |    ❌     |      ❌       |   ✅    |   ❌   |
| `period.read`                 |     ✅      |   ✅   |    ✅     |      ✅       |   ✅    |   ✅   |
| **Reconciliation**            |             |        |           |               |         |        |
| `reconciliation.write`        |     ✅      |   ❌   |    ✅     |      ❌       |   ❌    |   ❌   |
| `reconciliation.read`         |     ✅      |   ✅   |    ✅     |      ✅       |   ✅    |   ✅   |
| **Budget**                    |             |        |           |               |         |        |
| `budget.write`                |     ✅      |   ✅   |    ✅     |      ❌       |   ❌    |   ❌   |
| `budget.approve`              |     ✅      |   ✅   |    ❌     |      ❌       |   ❌    |   ❌   |
| `budget.read`                 |     ✅      |   ✅   |    ✅     |      ✅       |   ✅    |   ✅   |
| **Reports**                   |             |        |           |               |         |        |
| `reports.financial`           |     ✅      |   ✅   |    ✅     |      ✅       |   ✅    |   ❌   |
| `reports.member_giving`       |     ✅      |   ✅   |    ✅     |      ❌       |   ❌    |   ❌   |
| `reports.export`              |     ✅      |   ✅   |    ✅     |      ❌       |   ✅    |   ❌   |
| **Members**                   |             |        |           |               |         |        |
| `member.write`                |     ✅      |   ✅   |    ✅     |      ✅       |   ❌    |   ❌   |
| `member.read`                 |     ✅      |   ✅   |    ✅     |      ✅       |   ✅    |   ✅   |
| `member.read_pii`             |     ✅      |   ✅   |    ✅     |      ✅       |   ❌    |   ❌   |
| **Projects**                  |             |        |           |               |         |        |
| `project.write`               |     ✅      |   ✅   |    ✅     |      ❌       |   ❌    |   ❌   |
| `project.read`                |     ✅      |   ✅   |    ✅     |      ✅       |   ✅    |   ✅   |
| **Audit Trail**               |             |        |           |               |         |        |
| `audit.read`                  |     ✅      |   ✅   |    ❌     |      ❌       |   ✅    |   ❌   |
| `audit.export`                |     ✅      |   ❌   |    ❌     |      ❌       |   ✅    |   ❌   |
| **Settings**                  |             |        |           |               |         |        |
| `settings.write`              |     ✅      |   ❌   |    ❌     |      ❌       |   ❌    |   ❌   |
| `settings.read`               |     ✅      |   ✅   |    ✅     |      ✅       |   ✅    |   ❌   |
| **User Management**           |             |        |           |               |         |        |
| `user.create`                 |     ✅      |   ❌   |    ❌     |      ❌       |   ❌    |   ❌   |
| `user.update`                 |     ✅      |   ❌   |    ❌     |      ❌       |   ❌    |   ❌   |
| `user.read`                   |     ✅      |   ✅   |    ✅     |      ✅       |   ✅    |   ❌   |
| **Profile**                   |             |        |           |               |         |        |
| `profile.update_own`          |     ✅      |   ✅   |    ✅     |      ✅       |   ✅    |   ✅   |
| `profile.update_own_password` |     ✅      |   ✅   |    ✅     |      ✅       |   ✅    |   ✅   |

### 2.2 Permission Count by Role

| Role          | Permissions |
| ------------- | ----------- |
| super_admin   | 40          |
| pastor        | 20          |
| treasurer     | 17          |
| finance_staff | 10          |
| auditor       | 9           |
| viewer        | 6           |

---

## 3. Permission Definitions

| Permission                    | CRUD Mapping                                                    | Scope                           |
| ----------------------------- | --------------------------------------------------------------- | ------------------------------- |
| `journal.write`               | Create journal entries (expenses, income, offerings, transfers) | All funds user can access       |
| `journal.approve`             | Approve or reject pending journal entries                       | Entries created by others only  |
| `journal.void`                | Void approved journal entries                                   | Requires void reason            |
| `journal.read`                | View journal entries and GL                                     | All entries                     |
| `offering.write`              | Record individual offerings                                     | All funds                       |
| `offering.approve`            | Approve/reject pending offerings                                | Offerings created by others     |
| `offering.read`               | View offering records                                           | All offerings                   |
| `offering.count_sheet`        | Create and edit Sunday count sheets                             | Count sheets                    |
| `offering.count_sheet.lock`   | Lock count sheets (generates journal entries)                   | Count sheets                    |
| `expense.write`               | Create expense records                                          | All funds                       |
| `expense.approve`             | Approve/reject pending expenses                                 | Expenses created by others      |
| `expense.read`                | View expense records                                            | All expenses                    |
| `income.write`                | Create income records                                           | All funds                       |
| `income.approve`              | Approve/reject pending income                                   | Income created by others        |
| `income.read`                 | View income records                                             | All income                      |
| `fund.create`                 | Create new funds                                                | All funds                       |
| `fund.transfer`               | Transfer between funds                                          | All active funds                |
| `fund.read`                   | View fund details and balances                                  | All funds                       |
| `coa.write`                   | Modify chart of accounts                                        | All accounts                    |
| `coa.read`                    | View chart of accounts                                          | All accounts                    |
| `period.close`                | Close fiscal periods                                            | All periods                     |
| `period.reopen`               | Reopen closed periods                                           | Closed (not reconciled) periods |
| `period.read`                 | View period status                                              | All periods                     |
| `reconciliation.write`        | Create reconciliation records                                   | All funds                       |
| `reconciliation.read`         | View reconciliation history                                     | All records                     |
| `budget.write`                | Create and edit budgets                                         | All budgets                     |
| `budget.approve`              | Approve/reject budget proposals                                 | Budgets created by others       |
| `budget.read`                 | View budgets and utilization                                    | All budgets                     |
| `reports.financial`           | Generate financial statements                                   | All reports                     |
| `reports.member_giving`       | Generate member giving statements                               | All members                     |
| `reports.export`              | Export data (PDF, Excel, CSV)                                   | All exportable data             |
| `member.write`                | Create and edit member records                                  | All members                     |
| `member.read`                 | View member records (non-PII)                                   | All members                     |
| `member.read_pii`             | View member PII (phone, email, address)                         | All members                     |
| `project.write`               | Create and edit projects                                        | All projects                    |
| `project.read`                | View project details                                            | All projects                    |
| `audit.read`                  | View audit trail                                                | All audit entries               |
| `audit.export`                | Export audit trail                                              | All audit entries               |
| `settings.write`              | Modify system settings                                          | Global                          |
| `settings.read`               | View system settings                                            | Global                          |
| `user.create`                 | Create new users                                                | All users                       |
| `user.update`                 | Modify user accounts (role, status)                             | All users                       |
| `user.read`                   | View user list                                                  | All users                       |
| `profile.update_own`          | Update own profile (name, etc.)                                 | Self                            |
| `profile.update_own_password` | Change own password                                             | Self                            |

---

## 4. Enforcement Architecture

### 4.1 Enforcement Layers

```
┌──────────────────────────────────────────────────────┐
│ LAYER 1: UI Navigation Filtering                      │
│ Sidebar items hidden if user.can(requiredPermission)  │
│ NOTE: This is UX only — not security                  │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│ LAYER 2: Server Function Middleware                   │
│ requirePermission('journal.write')                     │
│ → Checks session → Checks role matrix → Allows/Denies │
│ THIS IS THE PRIMARY ENFORCEMENT LAYER                 │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│ LAYER 3: Domain Business Rules                        │
│ Self-approval check, amount limits, fund access       │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│ LAYER 4: Row-Level Security (PostgreSQL)              │
│ Defense-in-depth: even if app layer is bypassed       │
└──────────────────────────────────────────────────────┘
```

### 4.2 Middleware Implementation

```typescript
// src/server/auth/permissions.ts
export const PERMISSION_MATRIX: Record<Role, Permission[]> = {
  super_admin: [
    "journal.write",
    "journal.approve",
    "journal.void",
    "journal.read",
    "offering.write",
    "offering.approve",
    "offering.read",
    "offering.count_sheet",
    "offering.count_sheet.lock",
    "expense.write",
    "expense.approve",
    "expense.read",
    "income.write",
    "income.approve",
    "income.read",
    "fund.create",
    "fund.transfer",
    "fund.read",
    "coa.write",
    "coa.read",
    "period.close",
    "period.reopen",
    "period.read",
    "reconciliation.write",
    "reconciliation.read",
    "budget.write",
    "budget.approve",
    "budget.read",
    "reports.financial",
    "reports.member_giving",
    "reports.export",
    "member.write",
    "member.read",
    "member.read_pii",
    "project.write",
    "project.read",
    "audit.read",
    "audit.export",
    "settings.write",
    "settings.read",
    "user.create",
    "user.update",
    "user.read",
    "profile.update_own",
    "profile.update_own_password",
  ],
  pastor: [
    "journal.approve",
    "journal.void",
    "journal.read",
    "offering.approve",
    "offering.read",
    "offering.count_sheet.lock",
    "expense.approve",
    "expense.read",
    "income.approve",
    "income.read",
    "fund.read",
    "coa.read",
    "period.read",
    "reconciliation.read",
    "budget.write",
    "budget.approve",
    "budget.read",
    "reports.financial",
    "reports.member_giving",
    "reports.export",
    "member.write",
    "member.read",
    "member.read_pii",
    "project.write",
    "project.read",
    "audit.read",
    "settings.read",
    "user.read",
    "profile.update_own",
    "profile.update_own_password",
  ],
  treasurer: [
    "journal.write",
    "journal.read",
    "offering.write",
    "offering.read",
    "offering.count_sheet",
    "expense.write",
    "expense.read",
    "income.write",
    "income.read",
    "fund.create",
    "fund.transfer",
    "fund.read",
    "coa.read",
    "period.close",
    "period.read",
    "reconciliation.write",
    "reconciliation.read",
    "budget.write",
    "budget.read",
    "reports.financial",
    "reports.member_giving",
    "reports.export",
    "member.write",
    "member.read",
    "member.read_pii",
    "project.write",
    "project.read",
    "settings.read",
    "user.read",
    "profile.update_own",
    "profile.update_own_password",
  ],
  finance_staff: [
    "journal.write",
    "journal.read",
    "offering.write",
    "offering.read",
    "offering.count_sheet",
    "expense.write",
    "expense.read",
    "income.write",
    "income.read",
    "fund.read",
    "coa.read",
    "period.read",
    "reconciliation.read",
    "budget.read",
    "reports.financial",
    "member.write",
    "member.read",
    "member.read_pii",
    "project.read",
    "settings.read",
    "profile.update_own",
    "profile.update_own_password",
  ],
  auditor: [
    "journal.read",
    "offering.read",
    "expense.read",
    "income.read",
    "fund.read",
    "coa.read",
    "period.read",
    "period.reopen",
    "reconciliation.read",
    "budget.read",
    "reports.financial",
    "reports.export",
    "member.read",
    "project.read",
    "audit.read",
    "audit.export",
    "settings.read",
    "user.read",
    "profile.update_own",
    "profile.update_own_password",
  ],
  viewer: [
    "journal.read",
    "offering.read",
    "expense.read",
    "income.read",
    "fund.read",
    "member.read",
    "profile.update_own",
    "profile.update_own_password",
  ],
};

// Authorization middleware
export function authorize(userId: string, ...requiredPermissions: Permission[]): Promise<User> {
  const user = await userRepo.findById(userId);
  if (!user || !user.isActive) {
    throw new ForbiddenError("User account is not active");
  }

  const userPermissions = PERMISSION_MATRIX[user.role];

  for (const perm of requiredPermissions) {
    if (!userPermissions.includes(perm)) {
      logger.warn({
        event: "authorization_denied",
        userId,
        userRole: user.role,
        requiredPermission: perm,
      });
      throw new ForbiddenError(
        `Permission denied: '${perm}' is not granted to role '${user.role}'`,
      );
    }
  }

  return user;
}
```

### 4.3 Client-Side Permission Hook

```typescript
// src/hooks/use-permission.ts
export function usePermission() {
  const { user } = useAuth();

  const can = useCallback(
    (perm: Permission): boolean => {
      if (!user) return false;
      return PERMISSION_MATRIX[user.role].includes(perm);
    },
    [user],
  );

  const cannot = useCallback((perm: Permission): boolean => !can(perm), [can]);

  return { can, cannot };
}

// Usage in components:
// const { can } = usePermission();
// {can('journal.write') && <CreateButton />}
```

---

## 5. Row-Level Security Policies

### 5.1 Database-Level Authorization

```sql
-- Application sets current user ID for each connection
-- SET app.current_user_id = 'uuid-of-user';

-- Journal entries: users can read all but only write their own
CREATE POLICY journal_read ON journal_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = current_setting('app.current_user_id')::uuid
      AND role IN ('super_admin', 'pastor', 'treasurer', 'finance_staff', 'auditor', 'viewer')
    )
  );

-- Audit log: only auditor, pastor, super_admin can read
CREATE POLICY audit_read ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = current_setting('app.current_user_id')::uuid
      AND role IN ('super_admin', 'pastor', 'auditor')
    )
  );

-- Members: PII filtering at DB level
CREATE POLICY members_read ON members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = current_setting('app.current_user_id')::uuid
    )
  );
-- Note: PII filtering is done at the application layer,
-- but RLS ensures no unauthorized row access even if app-layer fails.
```

---

## 6. Self-Approval Prevention

### 6.1 Enforcement

```typescript
// src/server/services/approval.service.ts
export class ApprovalService {
  async approve(journalEntryId: string, approverId: string): Promise<void> {
    const entry = await this.journalRepo.findById(journalEntryId);

    if (entry.status !== "pending") {
      throw new InvalidTransitionError("Entry is not pending approval");
    }

    // CRITICAL: Self-approval check
    if (entry.createdBy === approverId) {
      throw new SelfApprovalError(
        `User cannot approve their own transaction. Entry was created by the same user.`,
      );
    }

    // Amount threshold check
    const approver = await this.userRepo.findById(approverId);
    const amount = entry.totalDebit;

    if (amount.toNumber() > 50000 && approver.role !== "super_admin") {
      // Dual approval required — check if this is the second approver
      if (entry.approvedBy && entry.approvedBy !== approverId) {
        // This is the second approver
      } else {
        // Need dual approval — record first approval, keep pending
        await this.journalRepo.recordFirstApproval(entry.id, approverId);
        return; // Entry stays pending for second approval
      }
    }

    // Single approval or dual-complete: approve
    await this.journalRepo.approve(entry.id, approverId);
  }
}
```

---

## 7. Transaction Limits per Role

### 7.1 Approval Limits

| Role        | Max Single Transaction | Notes                                            |
| ----------- | ---------------------- | ------------------------------------------------ |
| super_admin | Unlimited              | Single approval sufficient at any amount         |
| pastor      | ฿50,000                | Above this → requires super_admin as co-approver |
| treasurer   | Cannot approve         | Treasurer creates; pastor/super_admin approves   |

### 7.2 Transfer Limits

| Role        | Max Single Transfer | Max Daily Transfer |
| ----------- | ------------------- | ------------------ |
| super_admin | Unlimited           | Unlimited          |
| treasurer   | ฿100,000            | ฿500,000           |

### 7.3 Count Sheet Limits

| Role          | Can Count? | Can Lock? |
| ------------- | ---------- | --------- |
| super_admin   | Yes        | Yes       |
| pastor        | Yes        | Yes       |
| treasurer     | Yes        | No        |
| finance_staff | Yes        | No        |
| auditor       | No         | No        |
| viewer        | No         | No        |

---

## 8. Permission Audit & Review

### 8.1 Permission Change Logging

All permission-related actions are logged to the immutable audit trail:

- User role changes (who changed, from → to)
- User creation/deactivation
- Permission matrix modifications (if configurable — not in v2.0)
- Settings changes that affect authorization (thresholds, limits)

### 8.2 Periodic Review

| Review                          | Frequency | Reviewer              |
| ------------------------------- | --------- | --------------------- |
| User role audit                 | Quarterly | Super Admin + Auditor |
| Permission matrix review        | Annually  | External Auditor      |
| Failed authorization log review | Monthly   | Security review       |
| Self-approval attempt detection | Real-time | Alert → Auditor       |

### 8.3 Authorization Failure Monitoring

```typescript
// Log and alert on authorization failures
onAuthorizationDenied(userId: string, requiredPermission: Permission): void {
  logger.warn({
    event: 'authorization_denied',
    userId,
    requiredPermission,
  });

  // If same user has 5+ denials in 10 minutes → security alert
  const recentDenials = await this.countRecentDenials(userId, 10 * 60 * 1000);
  if (recentDenials >= 5) {
    await this.alertSecurityTeam({
      event: 'potential_privilege_escalation_attempt',
      userId,
      recentDenials,
    });
  }
}
```

---

_This authorization model implements the principle of least privilege. Each role has exactly the permissions needed for their function, and no more. Authorization is enforced server-side at multiple layers, with the client-side UI visibility as UX convenience only._
