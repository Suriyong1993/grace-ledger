export type Role = "super_admin" | "admin";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "ผู้ดูแลระบบ",
  admin: "ผู้ดูแล",
};

export interface User {
  id: string;
  name: string;
  role: Role;
  email?: string;
  churchId?: string;
  avatarColor?: string;
}

export type TxStatus = "draft" | "pending" | "approved" | "rejected" | "voided";
export const STATUS_LABEL: Record<TxStatus, string> = {
  draft: "ร่าง",
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
  voided: "ยกเลิก",
};

export interface Income {
  id: string;
  date: string;
  categoryId: string;
  amount: number;
  fundId: string;
  description?: string;
  attachmentName?: string;
  attachmentDataUrl?: string;
  attachmentStoragePath?: string;
  attachmentType?: string;
  attachmentSize?: number;
  createdBy: string;
  approvedBy?: string;
  status: TxStatus;
  source?: "manual" | "line";
  lineMessageId?: string;
}

export interface Expense {
  id: string;
  date: string;
  categoryId: string;
  amount: number;
  fundId: string;
  description?: string;
  attachmentName?: string;
  attachmentDataUrl?: string;
  attachmentStoragePath?: string;
  attachmentType?: string;
  attachmentSize?: number;
  createdBy: string;
  approvedBy?: string;
  status: TxStatus;
  vendor?: string;
  source?: "manual" | "line";
  lineMessageId?: string;
}

export interface OfferingCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OfferingSubcategory {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PaymentChannel = "cash" | "bank" | "qr";
export const CHANNEL_LABEL: Record<PaymentChannel, string> = {
  cash: "เงินสด",
  bank: "ออนไลน์",
  qr: "QR Payment",
};

export interface Offering {
  id: string;
  date: string;
  categoryId: string;
  subcategoryId?: string;
  channel: PaymentChannel;
  amount: number;
  memberId?: string;
  fundId: string;
  note?: string;
  createdBy: string;
}

export interface Fund {
  id: string;
  name: string;
  fundCode?: string;
  accountId?: string;
  isRestricted?: boolean;
  openingBalance: number;
  currentBalance?: number;
  description?: string;
  isActive?: boolean;
  createdAt: string;
}

export type BudgetPeriod = "annual" | "monthly" | "department" | "project";
export interface Budget {
  id: string;
  name: string;
  period: BudgetPeriod;
  year: number;
  month?: number;
  department?: string;
  projectId?: string;
  amount: number;
  used: number;
  note?: string;
}

export type ProjectStatus = "planning" | "active" | "paused" | "completed";
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "วางแผน",
  active: "กำลังดำเนินการ",
  paused: "พักไว้",
  completed: "เสร็จสิ้น",
};
export interface Project {
  id: string;
  name: string;
  budget: number;
  used: number;
  progress: number;
  ownerId?: string;
  startDate: string;
  endDate?: string;
  status: ProjectStatus;
  description?: string;
}

export interface Member {
  id: string;
  name: string;
  family?: string;
  department?: string;
  phone?: string;
  email?: string;
  status: "active" | "inactive";
  joinedAt?: string;
}

export type CategoryKind = "income" | "expense";
export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  icon?: string;
}

export interface AuditLog {
  id: string;
  at: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
}

export interface Settings {
  churchName: string;
  address?: string;
  taxId?: string;
  fiscalYearStart: number; // month 1-12
  idleTimeoutMin: number;
  currency: "THB";
}

export interface LineUser {
  id: string;
  churchId: string;
  lineUserId: string;
  userId?: string;
  linkedAt: string;
}
