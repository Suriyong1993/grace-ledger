/**
 * Grace Ledger v2 — Authorization & Permissions
 *
 * CRITICAL FIX (CF-1): Unified approval authority.
 * Treasurer CANNOT approve transactions (AUTHORIZATION_MODEL.md position).
 * Approval flows:
 *   < ฿5,000: Pastor only
 *   5,000–50,000: Pastor
 *   > 50,000: Pastor + Super Admin (dual)
 *
 * CRITICAL FIX (CF-2): Dual approval via approval_1_id/approval_2_id.
 *
 * All permission checks are server-side only. Client-side hiding is UX only.
 */

import type { UserRole } from "@/server/domain/types";

// ============================================================================
// Permission Literals
// ============================================================================

export const PERMISSIONS = {
  // Journal permissions
  "journal.write": "Create journal entries (draft)",
  "journal.approve": "Approve journal entries",
  "journal.void": "Void approved journal entries",
  "journal.read": "View journal entries",

  // Offering permissions
  "offering.create": "Create offering records",
  "offering.approve": "Approve offerings",
  "offering.count": "Participate in Sunday count sheets",
  "offering.lock": "Lock count sheets (generates journal entries)",

  // Expense permissions
  "expense.create": "Create expense entries",
  "expense.approve": "Approve expenses",

  // Income permissions
  "income.create": "Create income entries",
  "income.approve": "Approve income entries",

  // Fund permissions
  "fund.read": "View fund balances",
  "fund.transfer": "Transfer between funds",
  "fund.manage": "Create/edit/close funds",

  // Period permissions
  "period.close": "Close fiscal periods",
  "period.reopen": "Reopen closed periods",
  "period.reconcile": "Create reconciliation records",

  // Audit permissions
  "audit.read": "View audit log",

  // Report permissions
  "report.view": "View financial reports",
  "report.export": "Export financial data",

  // Member permissions
  "member.read": "View member list",
  "member.write": "Create/edit members",
  "member.pii": "View member PII (phone, email, address)",

  // Budget permissions
  "budget.write": "Create/edit budgets",
  "budget.approve": "Approve budgets",

  // Settings permissions
  "settings.read": "View system settings",
  "settings.write": "Modify system settings",

  // User management
  "user.manage": "Create/edit/deactivate users",

  // Project permissions
  "project.write": "Create/edit projects",
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ============================================================================
// Permission Matrix
// ============================================================================
// Simplified: super_admin (full access), admin (operational access, no settings)

const MATRIX: Record<UserRole, Set<Permission>> = {
  super_admin: new Set([
    "journal.write",
    "journal.approve",
    "journal.void",
    "journal.read",
    "offering.create",
    "offering.approve",
    "offering.count",
    "offering.lock",
    "expense.create",
    "expense.approve",
    "income.create",
    "income.approve",
    "fund.read",
    "fund.transfer",
    "fund.manage",
    "period.close",
    "period.reopen",
    "period.reconcile",
    "audit.read",
    "report.view",
    "report.export",
    "member.read",
    "member.write",
    "member.pii",
    "budget.write",
    "budget.approve",
    "settings.read",
    "settings.write",
    "user.manage",
    "project.write",
  ]),

  admin: new Set([
    "journal.write",
    "journal.approve",
    "journal.read",
    "offering.create",
    "offering.approve",
    "offering.count",
    "offering.lock",
    "expense.create",
    "expense.approve",
    "income.create",
    "income.approve",
    "fund.read",
    "fund.transfer",
    "audit.read",
    "report.view",
    "report.export",
    "member.read",
    "member.write",
    "member.pii",
    "budget.write",
    "budget.approve",
    "settings.read",
    "project.write",
  ]),
};

// ============================================================================
// Approval Thresholds
// ============================================================================

export interface ApprovalThreshold {
  maxAmount: number; // in baht
  requiredApprovers: UserRole[];
  requiresDualApproval: boolean;
}

export const APPROVAL_THRESHOLDS: ApprovalThreshold[] = [
  {
    maxAmount: 5000,
    requiredApprovers: ["admin"],
    requiresDualApproval: false,
  },
  {
    maxAmount: 50000,
    requiredApprovers: ["admin"],
    requiresDualApproval: false,
  },
  {
    maxAmount: Infinity,
    requiredApprovers: ["super_admin"],
    requiresDualApproval: true,
  },
];

/** Determine the required approval tier for a given amount in baht */
export function getApprovalThreshold(amountInBaht: number): ApprovalThreshold {
  for (const threshold of APPROVAL_THRESHOLDS) {
    if (amountInBaht <= threshold.maxAmount) {
      return threshold;
    }
  }
  return APPROVAL_THRESHOLDS[APPROVAL_THRESHOLDS.length - 1];
}

// ============================================================================
// Authorization Functions
// ============================================================================

/** Check if a role has a specific permission */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return MATRIX[role]?.has(permission) ?? false;
}

/** Check if a user can approve a given amount */
export function canApproveAmount(role: UserRole, amountInBaht: number): boolean {
  // Both super_admin and admin can approve
  if (role !== "admin" && role !== "super_admin") {
    return false;
  }

  const threshold = getApprovalThreshold(amountInBaht);
  return threshold.requiredApprovers.includes(role);
}

/** Returns the number of approvers required for a given amount */
export function requiredApproverCount(amountInBaht: number): number {
  const threshold = getApprovalThreshold(amountInBaht);
  return threshold.requiresDualApproval ? 2 : 1;
}

/** List all permissions for a role */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return [...(MATRIX[role] ?? new Set())];
}
