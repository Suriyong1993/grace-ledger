export type UserRole =
  | "super_admin"
  | "pastor"
  | "treasurer"
  | "finance_staff"
  | "approver"
  | "counter"
  | "member";

export type PermissionAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "approve"
  | "export";

export type Resource =
  | "churches"
  | "accounts"
  | "funds"
  | "categories"
  | "transactions"
  | "transaction_splits"
  | "fund_transfers"
  | "offering_sessions"
  | "cash_count"
  | "approvals"
  | "budgets"
  | "members"
  | "member_giving"
  | "audit_logs"
  | "reports";

/**
 * RBAC Permission Definition Table
 */
const ROLE_PERMISSIONS: Record<
  UserRole,
  Partial<Record<Resource, PermissionAction[]>>
> = {
  super_admin: {
    churches: ["create", "read", "update", "delete", "export"],
    accounts: ["create", "read", "update", "delete", "export"],
    funds: ["create", "read", "update", "delete", "export"],
    categories: ["create", "read", "update", "delete", "export"],
    transactions: ["create", "read", "update", "delete", "approve", "export"],
    transaction_splits: ["create", "read", "update", "delete", "export"],
    fund_transfers: ["create", "read", "update", "approve", "export"],
    offering_sessions: ["create", "read", "update", "delete", "approve", "export"],
    cash_count: ["create", "read", "update", "approve", "export"],
    approvals: ["create", "read", "update", "approve", "export"],
    budgets: ["create", "read", "update", "delete", "export"],
    members: ["create", "read", "update", "delete", "export"],
    member_giving: ["create", "read", "update", "delete", "export"], // Access is still logged
    audit_logs: ["read", "export"],
    reports: ["read", "export"],
  },

  pastor: {
    churches: ["read"],
    accounts: ["read", "export"],
    funds: ["read", "export"],
    categories: ["read"],
    transactions: ["read", "approve", "export"],
    transaction_splits: ["read", "export"],
    fund_transfers: ["read", "approve", "export"],
    offering_sessions: ["read", "approve", "export"],
    cash_count: ["read", "approve"],
    approvals: ["read", "approve"],
    budgets: ["read", "export"],
    members: ["read", "export"],
    member_giving: ["read", "export"], // Strictly logged via RPC
    audit_logs: ["read", "export"],
    reports: ["read", "export"],
  },

  treasurer: {
    churches: ["read"],
    accounts: ["create", "read", "update", "export"],
    funds: ["create", "read", "update", "export"],
    categories: ["create", "read", "update", "export"],
    transactions: ["create", "read", "update", "approve", "export"],
    transaction_splits: ["create", "read", "update", "export"],
    fund_transfers: ["create", "read", "approve", "export"],
    offering_sessions: ["create", "read", "update", "approve", "export"],
    cash_count: ["create", "read", "update", "approve", "export"],
    approvals: ["read", "approve"],
    budgets: ["create", "read", "update", "export"],
    members: ["create", "read", "update", "export"],
    member_giving: ["create", "read", "update", "export"], // Strictly logged via RPC
    audit_logs: ["read", "export"],
    reports: ["read", "export"],
  },

  finance_staff: {
    churches: ["read"],
    accounts: ["read"],
    funds: ["read"],
    categories: ["read"],
    transactions: ["create", "read", "update"], // Draft update only
    transaction_splits: ["create", "read", "update"],
    fund_transfers: ["read"],
    offering_sessions: ["create", "read", "update"],
    cash_count: ["create", "read"],
    approvals: ["read"],
    budgets: ["read"],
    members: ["create", "read"],
    member_giving: [], // Prohibited
    audit_logs: [],    // Prohibited
    reports: ["read"],
  },

  approver: {
    churches: ["read"],
    accounts: ["read"],
    funds: ["read"],
    categories: ["read"],
    transactions: ["read"],
    transaction_splits: ["read"],
    fund_transfers: ["read", "approve"],
    offering_sessions: ["read"],
    cash_count: ["read"],
    approvals: ["read", "approve"],
    budgets: ["read"],
    members: [],
    member_giving: [], // Prohibited
    audit_logs: [],    // Prohibited
    reports: ["read"],
  },

  counter: {
    churches: ["read"],
    accounts: [],
    funds: ["read"],
    categories: [],
    transactions: [],
    transaction_splits: [],
    fund_transfers: [],
    offering_sessions: ["read", "update"], // Count & Sign only
    cash_count: ["create", "read", "update"],
    approvals: [],
    budgets: [],
    members: [],
    member_giving: [], // Prohibited
    audit_logs: [],    // Prohibited
    reports: [],
  },

  member: {
    churches: ["read"],
    accounts: [],
    funds: ["read"],
    categories: [],
    transactions: [],
    transaction_splits: [],
    fund_transfers: [],
    offering_sessions: [],
    cash_count: [],
    approvals: [],
    budgets: [],
    members: [],
    member_giving: [], // Prohibited from church-wide records
    audit_logs: [],
    reports: [],
  },
};

/**
 * Check if a role has permission to perform an action on a resource
 */
export function can(
  role: UserRole,
  action: PermissionAction,
  resource: Resource
): boolean {
  const perms = ROLE_PERMISSIONS[role]?.[resource];
  if (!perms) return false;
  return perms.includes(action);
}

/**
 * Assert permission, throwing error if unauthorized
 */
export function assertPermission(
  role: UserRole,
  action: PermissionAction,
  resource: Resource
): void {
  if (!can(role, action, resource)) {
    throw new Error(
      `Access Denied: Role "${role}" is not authorized to "${action}" on "${resource}".`
    );
  }
}

/**
 * Check if role is authorized to execute irreversible financial mutations
 */
export function canExecuteFinancialAction(role: UserRole): boolean {
  return role === "super_admin" || role === "treasurer";
}

