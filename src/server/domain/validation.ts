/**
 * Grace Ledger v2 — Zod Validation Schemas
 *
 * Server-side validation for all API inputs.
 * Every endpoint validates request bodies against these schemas.
 */

import { z } from "zod";
import type { AccountType, NormalBalance, EntryType, EntryStatus, LineType, UserRole } from "./types";

// ============================================================================
// Money validation
// ============================================================================

export const moneySchema = z
  .string()
  .regex(/^\d{1,15}(\.\d{2})$/, "Amount must be a decimal string with 2 decimal places (e.g. '100.50')")
  .describe("Monetary amount in baht as string with 2 decimal places");

// ============================================================================
// Auth schemas
// ============================================================================

export const loginSchema = z.object({
  churchName: z.string().min(1, "Church name is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
});

// ============================================================================
// Journal entry schemas
// ============================================================================

export const journalLineSchema = z.object({
  accountId: z.string().uuid(),
  lineType: z.enum(["debit", "credit"] as const),
  amount: moneySchema,
  fundId: z.string().uuid(),
  memberId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
});

export const createJournalEntrySchema = z.object({
  entryType: z.enum(["offering", "expense", "income", "transfer", "opening", "adjustment", "closing"] as const),
  postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  description: z.string().min(3, "Description must be at least 3 characters").max(1000),
  fundId: z.string().uuid(),
  fiscalYear: z.number().int().min(2020).max(2100),
  fiscalPeriod: z.number().int().min(1).max(12),
  lines: z.array(journalLineSchema).min(2, "At least 2 lines required"),
  referenceDocument: z.string().max(255).optional(),
});

export const approveEntrySchema = z.object({
  entryId: z.string().uuid(),
});

export const rejectEntrySchema = z.object({
  entryId: z.string().uuid(),
  reason: z.string().min(10, "Rejection reason must be at least 10 characters").max(1000),
});

export const voidEntrySchema = z.object({
  entryId: z.string().uuid(),
  reason: z.string().min(10, "Void reason must be at least 10 characters").max(1000),
});

export const submitForApprovalSchema = z.object({
  entryId: z.string().uuid(),
});

// ============================================================================
// Fiscal period schemas
// ============================================================================

export const closePeriodSchema = z.object({
  periodId: z.string().uuid(),
});

export const reopenPeriodSchema = z.object({
  periodId: z.string().uuid(),
});

// ============================================================================
// Fund schemas
// ============================================================================

export const createFundSchema = z.object({
  fundCode: z.string().min(1).max(20).regex(/^[A-Z0-9_]+$/, "Fund code must be uppercase alphanumeric"),
  name: z.string().min(1).max(255),
  accountId: z.string().uuid(),
  description: z.string().max(1000).optional(),
  isRestricted: z.boolean().optional(),
  openingBalance: moneySchema.optional(),
});

export const updateFundSchema = z.object({
  fundId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
  isRestricted: z.boolean().optional(),
});

// ============================================================================
// Fund transfer schema
// ============================================================================

export const fundTransferSchema = z.object({
  fromFundId: z.string().uuid(),
  toFundId: z.string().uuid(),
  amount: moneySchema,
  description: z.string().min(3).max(1000),
  postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fiscalYear: z.number().int().min(2020).max(2100),
  fiscalPeriod: z.number().int().min(1).max(12),
});

// ============================================================================
// Reconciliation schema
// ============================================================================

export const createReconciliationSchema = z.object({
  periodId: z.string().uuid(),
  fundId: z.string().uuid(),
  actualBalance: moneySchema,
  explanation: z.string().min(3).max(2000).optional(),
});

// ============================================================================
// Offering count sheet schema
// ============================================================================

export const createCountSheetSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  counter2Id: z.string().uuid(),
  counter3Id: z.string().uuid().optional(),
});

export const submitCountSchema = z.object({
  countSheetId: z.string().uuid(),
  amount: moneySchema,
});

export const lockCountSheetSchema = z.object({
  countSheetId: z.string().uuid(),
  reconciledAmount: moneySchema,
  fundId: z.string().uuid(),
  fiscalYear: z.number().int().min(2020).max(2100),
  fiscalPeriod: z.number().int().min(1).max(12),
});

// ============================================================================
// Budget schema
// ============================================================================

export const createBudgetSchema = z.object({
  name: z.string().min(1).max(255),
  accountId: z.string().uuid(),
  fundId: z.string().uuid(),
  periodType: z.enum(["annual", "monthly", "department", "project"] as const),
  fiscalYear: z.number().int().min(2020).max(2100),
  fiscalPeriod: z.number().int().min(1).max(12).optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  budgetedAmount: moneySchema,
  notes: z.string().max(2000).optional(),
});

// ============================================================================
// Member schema
// ============================================================================

export const createMemberSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  familyName: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(255).optional(),
  address: z.string().max(500).optional(),
  departmentId: z.string().uuid().optional(),
  joinedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateMemberSchema = createMemberSchema.partial().extend({
  memberId: z.string().uuid(),
  status: z.enum(["active", "inactive"] as const).optional(),
});

// ============================================================================
// Project schema
// ============================================================================

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  budgetAmount: moneySchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  departmentId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
});

// ============================================================================
// Chart of Accounts schema
// ============================================================================

export const createAccountSchema = z.object({
  accountCode: z.string().min(1).max(20),
  accountName: z.string().min(1).max(255),
  accountType: z.enum(["asset", "liability", "equity", "income", "expense"] as const),
  parentId: z.string().uuid().optional().nullable(),
  isContra: z.boolean().optional(),
  normalBalance: z.enum(["debit", "credit"] as const),
  description: z.string().max(1000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  tfrsCode: z.string().max(20).optional(),
});

// ============================================================================
// Query/pagination schemas
// ============================================================================

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const journalQuerySchema = paginationSchema.extend({
  status: z.enum(["draft", "pending", "approved", "rejected", "voided"] as const).optional(),
  entryType: z.enum(["offering", "expense", "income", "transfer", "opening", "adjustment", "void", "closing"] as const).optional(),
  fundId: z.string().uuid().optional(),
  fiscalYear: z.coerce.number().int().optional(),
  fiscalPeriod: z.coerce.number().int().min(1).max(12).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const auditQuerySchema = paginationSchema.extend({
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  eventType: z.string().optional(),
  action: z.string().optional(),
});

// ============================================================================
// Settings schema
// ============================================================================

export const updateSettingsSchema = z.object({
  churchName: z.string().min(1).max(255).optional(),
  churchAddress: z.string().max(500).optional().nullable(),
  taxId: z.string().max(20).optional().nullable(),
  fiscalYearStart: z.number().int().min(1).max(12).optional(),
  idleTimeoutMin: z.number().int().min(1).optional(),
  sessionMaxHours: z.number().int().min(1).optional(),
  currency: z.enum(["THB"] as const).optional(),
});

// ============================================================================
// Type exports
// ============================================================================

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type ApproveEntryInput = z.infer<typeof approveEntrySchema>;
export type RejectEntryInput = z.infer<typeof rejectEntrySchema>;
export type VoidEntryInput = z.infer<typeof voidEntrySchema>;
export type CreateFundInput = z.infer<typeof createFundSchema>;
export type UpdateFundInput = z.infer<typeof updateFundSchema>;
export type FundTransferInput = z.infer<typeof fundTransferSchema>;
export type CreateReconciliationInput = z.infer<typeof createReconciliationSchema>;
export type CreateCountSheetInput = z.infer<typeof createCountSheetSchema>;
export type SubmitCountInput = z.infer<typeof submitCountSchema>;
export type LockCountSheetInput = z.infer<typeof lockCountSheetSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type JournalQueryInput = z.infer<typeof journalQuerySchema>;
export type AuditQueryInput = z.infer<typeof auditQuerySchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;