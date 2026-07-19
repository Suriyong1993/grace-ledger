export type Role =
  | "super_admin"
  | "pastor"
  | "treasurer"
  | "finance_staff"
  | "auditor"
  | "viewer";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "ผู้ดูแลระบบ",
  pastor: "ศิษยาภิบาล",
  treasurer: "เหรัญญิก",
  finance_staff: "เจ้าหน้าที่การเงิน",
  auditor: "ผู้ตรวจสอบ",
  viewer: "ผู้ชม",
};

export interface User {
  id: string;
  name: string;
  role: Role;
  pin: string; // 6-digit
  avatarColor?: string;
}

export type TxStatus = "draft" | "pending" | "approved" | "rejected";
export const STATUS_LABEL: Record<TxStatus, string> = {
  draft: "ร่าง",
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
};

export interface Income {
  id: string;
  date: string;
  categoryId: string;
  amount: number;
  fundId: string;
  description?: string;
  attachmentName?: string;
  createdBy: string;
  approvedBy?: string;
  status: TxStatus;
}

export interface Expense {
  id: string;
  date: string;
  categoryId: string;
  amount: number;
  fundId: string;
  description?: string;
  attachmentName?: string;
  createdBy: string;
  approvedBy?: string;
  status: TxStatus;
  vendor?: string;
}

export type OfferingType =
  | "sunday"
  | "mission"
  | "building"
  | "special"
  | "youth"
  | "children"
  | "online";

export const OFFERING_LABEL: Record<OfferingType, string> = {
  sunday: "ถวายวันอาทิตย์",
  mission: "ถวายพันธกิจ",
  building: "ถวายก่อสร้าง",
  special: "ถวายพิเศษ",
  youth: "ถวายอนุชน",
  children: "ถวายเด็ก",
  online: "ถวายออนไลน์",
};

export type PaymentChannel = "cash" | "bank" | "qr";
export const CHANNEL_LABEL: Record<PaymentChannel, string> = {
  cash: "เงินสด",
  bank: "โอนธนาคาร",
  qr: "QR Payment",
};

export interface Offering {
  id: string;
  date: string;
  type: OfferingType;
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
  openingBalance: number;
  description?: string;
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