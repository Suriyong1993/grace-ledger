/**
 * Grace Ledger v2 — Domain Types
 * Shared type definitions used across the domain layer.
 */

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type NormalBalance = "debit" | "credit";
export type EntryType = "offering" | "expense" | "income" | "transfer" | "opening" | "adjustment" | "void" | "closing";
export type EntryStatus = "draft" | "pending" | "approved" | "rejected" | "voided";
export type LineType = "debit" | "credit";
export type UserRole = "super_admin" | "pastor" | "treasurer" | "finance_staff" | "auditor" | "viewer";
export type PeriodStatus = "open" | "closed" | "reconciled";
export type CountSheetStatus = "counting" | "discrepancy" | "in_review" | "reconciled" | "locked";
export type BudgetPeriodType = "annual" | "monthly" | "department" | "project";
export type BudgetStatus = "draft" | "pending" | "approved" | "rejected";
export type ProjectStatus = "planning" | "active" | "paused" | "completed";
export type MemberStatus = "active" | "inactive";
export type PaymentChannel = "cash" | "bank" | "qr";