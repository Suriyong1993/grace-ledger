import { Money } from "../money";
import { UserRole } from "../rbac";

export type TransactionStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "posted"
  | "rejected"
  | "voided";

export type TransactionDirection = "income" | "expense" | "transfer";

export interface TransactionSplit {
  id?: string;
  transactionId?: string;
  churchId: string;
  fundId: string;
  fundName?: string;
  fundBalance?: Money;
  categoryId?: string | null;
  amount: Money;
  note?: string | null;
  createdAt?: string;
}

export interface Transaction {
  id: string;
  churchId: string;
  accountId: string;
  amount: Money;
  direction: TransactionDirection;
  status: TransactionStatus;
  description: string;
  referenceNumber?: string | null;
  postedAt?: string | null;
  createdBy: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  isReversal: boolean;
  reversalOfId?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  splits?: TransactionSplit[];
}

export interface CreateTransactionDraftInput {
  churchId: string;
  accountId: string;
  amount: string | number | Money;
  direction: TransactionDirection;
  description: string;
  referenceNumber?: string | null;
  createdBy: string;
  metadata?: Record<string, any>;
  splits?: Array<{
    fundId: string;
    categoryId?: string | null;
    amount: string | number | Money;
    note?: string | null;
  }>;
}

export interface SplitParityResult {
  isValid: boolean;
  transactionAmount: Money;
  allocatedSum: Money;
  remainingUnallocated: Money;
  difference: Money;
  error?: string;
}

export interface WorkflowActor {
  userId: string;
  churchId: string;
  roles: UserRole[];
}

export interface PendingApprovalItem {
  id: string;
  churchId: string;
  accountId: string;
  accountName?: string;
  amount: Money;
  direction: TransactionDirection;
  status: TransactionStatus;
  description: string;
  referenceNumber?: string | null;
  createdBy: string;
  creatorName?: string;
  creatorInitials?: string;
  createdAt: string;
  hasReceipt: boolean;
  receiptUrl?: string | null;
  splits: TransactionSplit[];
  isCreator: boolean;
  rejectionReason?: string | null;
  rejectionType?: "revision_requested" | "rejected" | null;
}

export interface ProjectedFundBalanceResult {
  fundId: string;
  fundName: string;
  currentPostedBalance: Money;
  approvedUnpostedImpact: Money;
  evaluatingTransactionImpact: Money;
  projectedBalance: Money;
  isDeficit: boolean;
  deficitAmount?: Money;
}

export interface ApprovalDecisionInput {
  transactionId: string;
  note?: string | null;
}

export interface RevisionDecisionInput {
  transactionId: string;
  revisionNote: string;
}

export interface TerminalRejectionInput {
  transactionId: string;
  rejectionReason: string;
}

export interface RejectionDecisionInput {
  transactionId: string;
  rejectionReason: string;
  rejectionType?: "revision_requested" | "rejected";
}

export interface ApprovalServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    isStaleState?: boolean;
    isTwoPersonViolation?: boolean;
  };
}
