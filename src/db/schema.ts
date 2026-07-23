/**
 * Grace Ledger v2 — Database Schema
 * 
 * Based on DATABASE_V2.md with critical fixes applied:
 * - CF-1: Unified approval authority (AUTHORIZATION_MODEL.md position: treasurer CANNOT approve)
 * - CF-2: Dual approval with approval_1_id/approval_2_id columns (no race condition)
 * - CF-3: Per-church hash chains (church_id on audit_log)
 * - CF-4: Tenant isolation with church_id on every table
 * - CF-6: Year-end closing support with closing entry type
 * - MF-4: Token version (tok_ver) for instant session revocation
 * - MF-6: opening_balance added to reconciliations
 * - MF-9: All monetary values use DECIMAL(18,2)
 * - MF-11: Chart of accounts includes 3-3005 Opening Balance Equity
 * - MF-12: password_changed_at properly used for forced password change
 * - MF-15: Entry numbers assigned at APPROVAL time
 * - mF-4: DISCREPANCY state added to offering_count_sheets
 * - mF-6: deleted_at column for soft delete
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  date,
  timestamp,
  decimal,
  uniqueIndex,
  index,
  check,
  foreignKey,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================================
// Enums
// ============================================================================

export const accountTypeEnum = pgEnum("account_type", [
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
]);

export const normalBalanceEnum = pgEnum("normal_balance", ["debit", "credit"]);

export const entryTypeEnum = pgEnum("entry_type", [
  "offering",
  "expense",
  "income",
  "transfer",
  "opening",
  "adjustment",
  "void",
  "closing",
]);

export const entryStatusEnum = pgEnum("entry_status", [
  "draft",
  "pending",
  "approved",
  "rejected",
  "voided",
]);

export const lineTypeEnum = pgEnum("line_type", ["debit", "credit"]);

export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "pastor",
  "treasurer",
  "finance_staff",
  "auditor",
  "viewer",
]);

export const periodStatusEnum = pgEnum("period_status", [
  "open",
  "closed",
  "reconciled",
]);

export const countSheetStatusEnum = pgEnum("count_sheet_status", [
  "counting",
  "discrepancy",
  "in_review",
  "reconciled",
  "locked",
]);

export const budgetPeriodTypeEnum = pgEnum("budget_period_type", [
  "annual",
  "monthly",
  "department",
  "project",
]);

export const budgetStatusEnum = pgEnum("budget_status", [
  "draft",
  "pending",
  "approved",
  "rejected",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "active",
  "paused",
  "completed",
]);

export const memberStatusEnum = pgEnum("member_status", ["active", "inactive"]);

// ============================================================================
// Churches (CF-4: tenant isolation)
// ============================================================================

export const churches = pgTable("churches", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  taxId: varchar("tax_id", { length: 20 }),
  fiscalYearStart: integer("fiscal_year_start").notNull().default(1),
  currency: varchar("currency", { length: 3 }).notNull().default("THB"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
});

// ============================================================================
// Users & Auth
// ============================================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    churchId: uuid("church_id")
      .notNull()
      .references(() => churches.id),
    name: varchar("name", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    mfaSecret: varchar("mfa_secret", { length: 64 }),
    avatarColor: varchar("avatar_color", { length: 7 }),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    tokenVersion: integer("token_version").notNull().default(1), // MF-4: instant session revocation
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("idx_users_church_name").on(table.churchId, table.name).where(sql`${table.isActive} = true`),
  ]
);

export const userSessions = pgTable("user_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_sessions_user").on(table.userId),
  index("idx_sessions_token").on(table.tokenHash),
  index("idx_sessions_expires").on(table.expiresAt),
]);

// ============================================================================
// Chart of Accounts (MF-11: includes 3-3005 Opening Balance Equity)
// ============================================================================

export const chartOfAccounts = pgTable("chart_of_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  accountCode: varchar("account_code", { length: 20 }).notNull(),
  accountName: varchar("account_name", { length: 255 }).notNull(),
  accountType: accountTypeEnum("account_type").notNull(),
  parentId: uuid("parent_id"),
  isActive: boolean("is_active").notNull().default(true),
  isContra: boolean("is_contra").notNull().default(false),
  normalBalance: normalBalanceEnum("normal_balance").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  tfrsCode: varchar("tfrs_code", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_coa_church_code").on(table.churchId, table.accountCode),
  index("idx_coa_account_type").on(table.accountType),
  index("idx_coa_parent_id").on(table.parentId),
  index("idx_coa_active").on(table.isActive).where(sql`${table.isActive} = true`),
]);

// ============================================================================
// Funds
// ============================================================================

export const funds = pgTable("funds", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  accountId: uuid("account_id")
    .notNull()
    .references(() => chartOfAccounts.id),
  fundCode: varchar("fund_code", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  isRestricted: boolean("is_restricted").notNull().default(false),
  openingBalance: decimal("opening_balance", { precision: 18, scale: 2 }).notNull().default("0.00"),
  currentBalance: decimal("current_balance", { precision: 18, scale: 2 }).notNull().default("0.00"),
  lastCalculatedAt: timestamp("last_calculated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_funds_church_code").on(table.churchId, table.fundCode),
  index("idx_funds_active").on(table.isActive).where(sql`${table.isActive} = true`),
]);

// ============================================================================
// Fiscal Periods
// ============================================================================

export const fiscalPeriods = pgTable("fiscal_periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  fiscalYear: integer("fiscal_year").notNull(),
  periodNumber: integer("period_number").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: periodStatusEnum("status").notNull().default("open"),
  closedBy: uuid("closed_by").references(() => users.id),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  reopenedBy: uuid("reopened_by").references(() => users.id),
  reopenedAt: timestamp("reopened_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("idx_fp_church_year_period").on(table.churchId, table.fiscalYear, table.periodNumber),
  index("idx_fp_status").on(table.status),
  check("chk_period_number", sql`${table.periodNumber} BETWEEN 1 AND 12`),
  check("chk_end_after_start", sql`${table.endDate} >= ${table.startDate}`),
]);

// ============================================================================
// Journal Entries (CF-2: approval_1_id/approval_2_id; MF-15: numbers at approval)
// ============================================================================

export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  entryNumber: varchar("entry_number", { length: 30 }),
  entryType: entryTypeEnum("entry_type").notNull(),
  postingDate: date("posting_date").notNull(),
  description: text("description"),
  status: entryStatusEnum("status").notNull().default("draft"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  // CF-2: Dual approval columns — prevent race condition
  approval1Id: uuid("approval_1_id").references(() => users.id),
  approval2Id: uuid("approval_2_id").references(() => users.id),
  rejectionReason: text("rejection_reason"),
  voidParentId: uuid("void_parent_id"),
  fundId: uuid("fund_id")
    .notNull()
    .references(() => funds.id),
  referenceDocument: varchar("reference_document", { length: 255 }),
  totalDebit: decimal("total_debit", { precision: 18, scale: 2 }).notNull().default("0.00"),
  totalCredit: decimal("total_credit", { precision: 18, scale: 2 }).notNull().default("0.00"),
  fiscalYear: integer("fiscal_year").notNull(),
  fiscalPeriod: integer("fiscal_period").notNull(),
  // mF-6: Soft delete support
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_journal_entries_number").on(table.entryNumber).where(sql`${table.entryNumber} IS NOT NULL`),
  index("idx_je_posting_date").on(table.postingDate),
  index("idx_je_status").on(table.status),
  index("idx_je_fund").on(table.fundId),
  index("idx_je_church_fiscal").on(table.churchId, table.fiscalYear, table.fiscalPeriod),
  index("idx_je_entry_type").on(table.entryType),
  index("idx_je_created_by_status").on(table.createdBy, table.status),
  index("idx_je_approval_1").on(table.approval1Id, table.postingDate),
  check("chk_balanced", sql`${table.totalDebit} = ${table.totalCredit}`),
  check("chk_positive_totals", sql`${table.totalDebit} > 0 AND ${table.totalCredit} > 0`),
  // CF-1: Enforced at DB level — creator cannot be approver 1
  check("chk_no_self_approve_1", sql`${table.approval1Id} IS NULL OR ${table.approval1Id} <> ${table.createdBy}`),
  // CF-2: Two approvers must be different
  check("chk_no_same_approvers", sql`${table.approval2Id} IS NULL OR ${table.approval1Id} IS NULL OR ${table.approval1Id} <> ${table.approval2Id}`),
  // DB constraint: rejection_reason not null when rejected
  check("chk_rejection_reason", sql`${table.status} <> 'rejected' OR ${table.rejectionReason} IS NOT NULL`),
  // approval needed when status = approved
  check("chk_approved_has_approver", sql`${table.status} <> 'approved' OR ${table.approval1Id} IS NOT NULL`),
]);

// ============================================================================
// Journal Entry Lines
// ============================================================================

export const journalEntryLines = pgTable("journal_entry_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  journalEntryId: uuid("journal_entry_id")
    .notNull()
    .references(() => journalEntries.id),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  accountId: uuid("account_id")
    .notNull()
    .references(() => chartOfAccounts.id),
  lineType: lineTypeEnum("line_type").notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  fundId: uuid("fund_id")
    .notNull()
    .references(() => funds.id),
  memberId: uuid("member_id"),
  departmentId: uuid("department_id"),
  projectId: uuid("project_id"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_jel_entry").on(table.journalEntryId),
  index("idx_jel_account").on(table.accountId),
  index("idx_jel_fund").on(table.fundId),
  index("idx_jel_member").on(table.memberId),
  index("idx_jel_project").on(table.projectId, table.lineType),
  index("idx_jel_department").on(table.departmentId, table.lineType),
  check("chk_line_amount_positive", sql`${table.amount} > 0`),
]);

// ============================================================================
// General Ledger (CF-4: church_id; partitioned by fiscal_year)
// ============================================================================

export const generalLedger = pgTable("general_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  accountId: uuid("account_id")
    .notNull()
    .references(() => chartOfAccounts.id),
  postingDate: date("posting_date").notNull(),
  journalEntryId: uuid("journal_entry_id")
    .notNull()
    .references(() => journalEntries.id),
  journalLineId: uuid("journal_line_id")
    .notNull()
    .references(() => journalEntryLines.id),
  fundId: uuid("fund_id")
    .notNull()
    .references(() => funds.id),
  debitAmount: decimal("debit_amount", { precision: 18, scale: 2 }).notNull().default("0.00"),
  creditAmount: decimal("credit_amount", { precision: 18, scale: 2 }).notNull().default("0.00"),
  runningBalance: decimal("running_balance", { precision: 18, scale: 2 }).notNull(),
  fiscalYear: integer("fiscal_year").notNull(),
  fiscalPeriod: integer("fiscal_period").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_gl_journal_line").on(table.journalLineId),
  index("idx_gl_church_account_date").on(table.churchId, table.accountId, table.postingDate),
  index("idx_gl_church_fund_date").on(table.churchId, table.fundId, table.postingDate),
  index("idx_gl_entry").on(table.journalEntryId),
  index("idx_gl_church_fiscal").on(table.churchId, table.fiscalYear, table.fiscalPeriod),
]);

// ============================================================================
// Offering Count Sheets (mF-4: DISCREPANCY state added)
// ============================================================================

export const offeringCountSheets = pgTable("offering_count_sheets", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  date: date("date").notNull(),
  counter1Id: uuid("counter_1_id")
    .notNull()
    .references(() => users.id),
  counter1Amount: decimal("counter_1_amount", { precision: 18, scale: 2 }).notNull().default("0.00"),
  counter2Id: uuid("counter_2_id")
    .notNull()
    .references(() => users.id),
  counter2Amount: decimal("counter_2_amount", { precision: 18, scale: 2 }).notNull().default("0.00"),
  counter3Id: uuid("counter_3_id").references(() => users.id),
  counter3Amount: decimal("counter_3_amount", { precision: 18, scale: 2 }),
  reconciledAmount: decimal("reconciled_amount", { precision: 18, scale: 2 }),
  status: countSheetStatusEnum("status").notNull().default("counting"),
  lockedBy: uuid("locked_by").references(() => users.id),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
}, (table) => [
  index("idx_ocs_church_date").on(table.churchId, table.date),
  index("idx_ocs_status").on(table.status),
  check("chk_counters_different_12", sql`${table.counter1Id} <> ${table.counter2Id}`),
  check("chk_counters_different_13", sql`${table.counter1Id} <> ${table.counter3Id} OR ${table.counter3Id} IS NULL`),
  check("chk_counters_different_23", sql`${table.counter2Id} <> ${table.counter3Id} OR ${table.counter3Id} IS NULL`),
  check("chk_counter_amounts_positive", sql`${table.counter1Amount} >= 0 AND ${table.counter2Amount} >= 0`),
]);

// ============================================================================
// Offering Categories
// ============================================================================

export const offeringCategories = pgTable("offering_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }),
  icon: varchar("icon", { length: 50 }),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  accountId: uuid("account_id")
    .notNull()
    .references(() => chartOfAccounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
}, (table) => [
  index("idx_oc_active").on(table.isActive).where(sql`${table.isActive} = true`),
]);

// ============================================================================
// Reconciliations (MF-6: opening_balance column added)
// ============================================================================

export const reconciliations = pgTable("reconciliations", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  periodId: uuid("period_id")
    .notNull()
    .references(() => fiscalPeriods.id),
  fundId: uuid("fund_id")
    .notNull()
    .references(() => funds.id),
  openingBalance: decimal("opening_balance", { precision: 18, scale: 2 }).notNull(),
  systemBalance: decimal("system_balance", { precision: 18, scale: 2 }).notNull(),
  actualBalance: decimal("actual_balance", { precision: 18, scale: 2 }).notNull(),
  variance: decimal("variance", { precision: 18, scale: 2 }).notNull(),
  explanation: text("explanation"),
  isReconciled: boolean("is_reconciled").notNull().default(false),
  previousReconciliationId: uuid("previous_reconciliation_id"),
  reconciledBy: uuid("reconciled_by")
    .notNull()
    .references(() => users.id),
  reconciledAt: timestamp("reconciled_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_rec_church_period_fund").on(table.churchId, table.periodId, table.fundId),
  index("idx_rec_period").on(table.periodId),
  index("idx_rec_fund").on(table.fundId),
]);

// ============================================================================
// Budgets
// ============================================================================

export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  name: varchar("name", { length: 255 }).notNull(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => chartOfAccounts.id),
  fundId: uuid("fund_id")
    .notNull()
    .references(() => funds.id),
  periodType: budgetPeriodTypeEnum("period_type").notNull(),
  fiscalYear: integer("fiscal_year").notNull(),
  fiscalPeriod: integer("fiscal_period"),
  departmentId: uuid("department_id"),
  projectId: uuid("project_id"),
  budgetedAmount: decimal("budgeted_amount", { precision: 18, scale: 2 }).notNull().default("0.00"),
  status: budgetStatusEnum("status").notNull().default("draft"),
  approvedBy: uuid("approved_by").references(() => users.id),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
}, (table) => [
  index("idx_budgets_church_fiscal").on(table.churchId, table.fiscalYear, table.fiscalPeriod),
  index("idx_budgets_status").on(table.status),
  index("idx_budgets_account").on(table.accountId),
  check("chk_budget_amount", sql`${table.budgetedAmount} >= 0`),
  check(
    "chk_budget_period",
    sql`(
      (${table.periodType} = 'annual' AND ${table.fiscalPeriod} IS NULL AND ${table.departmentId} IS NULL AND ${table.projectId} IS NULL) OR
      (${table.periodType} = 'monthly' AND ${table.fiscalPeriod} IS NOT NULL AND ${table.departmentId} IS NULL AND ${table.projectId} IS NULL) OR
      (${table.periodType} = 'department' AND ${table.fiscalPeriod} IS NULL AND ${table.departmentId} IS NOT NULL AND ${table.projectId} IS NULL) OR
      (${table.periodType} = 'project' AND ${table.fiscalPeriod} IS NULL AND ${table.departmentId} IS NULL AND ${table.projectId} IS NOT NULL)
    )`
  ),
]);

// ============================================================================
// Members
// ============================================================================

export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  familyName: varchar("family_name", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  departmentId: uuid("department_id"),
  status: memberStatusEnum("status").notNull().default("active"),
  joinedAt: date("joined_at"),
  consentGiven: boolean("consent_given").notNull().default(false),
  consentDate: date("consent_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
}, (table) => [
  index("idx_members_status").on(table.status).where(sql`${table.status} = 'active'`),
  index("idx_members_name").on(table.lastName, table.firstName),
  uniqueIndex("idx_members_email").on(table.email).where(sql`${table.email} IS NOT NULL`),
]);

// ============================================================================
// Departments & Projects
// ============================================================================

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  budgetAmount: decimal("budget_amount", { precision: 18, scale: 2 }).notNull().default("0.00"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  status: projectStatusEnum("status").notNull().default("planning"),
  departmentId: uuid("department_id").references(() => departments.id),
  ownerId: uuid("owner_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
}, (table) => [
  index("idx_projects_status").on(table.status),
]);

// ============================================================================
// Audit Log (CF-3: per-church hash chain; append-only)
// ============================================================================

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: uuid("entity_id"),
  userId: uuid("user_id").references(() => users.id),
  userName: varchar("user_name", { length: 255 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  beforeState: text("before_state"), // JSONB stored as text for portability
  afterState: text("after_state"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  correlationId: uuid("correlation_id").notNull(),
  // CF-3: Per-church hash chain — no global serialization
  previousHash: varchar("previous_hash", { length: 64 }),
  currentHash: varchar("current_hash", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // CF-3: Indexed per church for per-church chain verification
  index("idx_audit_church_created").on(table.churchId, table.createdAt),
  index("idx_audit_entity").on(table.entityType, table.entityId),
  index("idx_audit_user").on(table.userId),
  index("idx_audit_event").on(table.eventType),
  index("idx_audit_correlation").on(table.correlationId),
]);

// ============================================================================
// Attachments
// ============================================================================

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: integer("file_size").notNull(),
  contentType: varchar("content_type", { length: 100 }).notNull(),
  storagePath: varchar("storage_path", { length: 500 }).notNull(),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_attachments_entity").on(table.entityType, table.entityId),
  check("chk_file_size", sql`${table.fileSize} <= 10485760`),
]);

// ============================================================================
// App Settings (per church)
// ============================================================================

export const appSettings = pgTable("app_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  churchName: varchar("church_name", { length: 255 }).notNull(),
  churchAddress: text("church_address"),
  taxId: varchar("tax_id", { length: 20 }),
  fiscalYearStart: integer("fiscal_year_start").notNull().default(1),
  idleTimeoutMin: integer("idle_timeout_min").notNull().default(15),
  sessionMaxHours: integer("session_max_hours").notNull().default(8),
  currency: varchar("currency", { length: 3 }).notNull().default("THB"),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("chk_fiscal_month", sql`${table.fiscalYearStart} BETWEEN 1 AND 12`),
  check("chk_idle_timeout", sql`${table.idleTimeoutMin} >= 1`),
  check("chk_session_max", sql`${table.sessionMaxHours} >= 1`),
]);

// ============================================================================
// Inter-fund Loans
// ============================================================================

export const interFundLoans = pgTable("inter_fund_loans", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id),
  journalEntryId: uuid("journal_entry_id")
    .notNull()
    .references(() => journalEntries.id),
  fromFundId: uuid("from_fund_id")
    .notNull()
    .references(() => funds.id),
  toFundId: uuid("to_fund_id")
    .notNull()
    .references(() => funds.id),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  expectedRepaymentDate: date("expected_repayment_date"),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
  status: varchar("status", { length: 20 }).notNull().default("outstanding"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});