import { Money } from "../money";

/**
 * Sunday Offering Session Status Lifecycle:
 * draft -> counting -> counted / variance_review -> confirmed -> posted (or voided)
 */
export type OfferingSessionStatus =
  | "draft"
  | "counting"
  | "counted"
  | "variance_review"
  | "confirmed"
  | "posted"
  | "voided";

/**
 * Payment Channels for Giving
 */
export type OfferingPaymentChannel = "cash" | "bank_transfer" | "qr_code" | "other";

/**
 * Source types for offering envelopes/slips
 */
export type OfferingSourceType = "envelopes" | "bags" | "manual_aggregate" | "electronic_slip";

/**
 * Variance Status Enum
 */
export type VarianceStatus =
  | "none"
  | "zero_match"
  | "variance_detected"
  | "recounted"
  | "explained"
  | "acknowledged";

/**
 * Variance Resolution Actions
 */
export type VarianceResolutionAction = "recount" | "explain";

/**
 * Denomination specification for Thai Baht cash counts
 */
export interface CashDenominations {
  b1000: number; // 1,000 THB bills
  b500: number;  // 500 THB bills
  b100: number;  // 100 THB bills
  b50: number;   // 50 THB bills
  b20: number;   // 20 THB bills
  coins: Money;  // Total coin amount in Money
}

export interface DenominationBreakdownItem {
  denomination: number;
  count: number;
  total: Money;
}

export interface DenominationCalculationResult {
  billTotal: Money;
  coinTotal: Money;
  grandTotal: Money;
  breakdown: {
    b1000: DenominationBreakdownItem;
    b500: DenominationBreakdownItem;
    b100: DenominationBreakdownItem;
    b50: DenominationBreakdownItem;
    b20: DenominationBreakdownItem;
    coins: { total: Money };
  };
}

/**
 * Offering Session Item (Channel x Fund breakdown)
 */
export interface OfferingItem {
  id?: string;
  offeringSessionId?: string;
  churchId?: string;
  fundId: string;
  fundName?: string;
  categoryId?: string | null;
  categoryName?: string;
  paymentChannel: OfferingPaymentChannel;
  sourceType: OfferingSourceType;
  amount: Money;
  donorName?: string | null;
  notes?: string | null;
}

/**
 * Physical Cash Count Record
 */
export interface CashCount {
  id?: string;
  offeringSessionId: string;
  churchId?: string;
  b1000: number;
  b500: number;
  b100: number;
  b50: number;
  b20: number;
  coins: Money;
  totalCashCounted: Money;
  countedBy1: string;
  countedBy1Name?: string;
  countedBy2: string;
  countedBy2Name?: string;
  counter1SignedAt?: string | null;
  counter2SignedAt?: string | null;
  createdAt?: string;
}

/**
 * Offering Session Revision (Immutable Audit Record)
 */
export interface OfferingRevision {
  id?: string;
  offeringSessionId: string;
  churchId?: string;
  revisionNumber: number;
  previousCashAmount: Money;
  newCashAmount: Money;
  previousTotalAmount: Money;
  newTotalAmount: Money;
  revisionReason: string;
  revisedBy: string;
  revisedByName?: string;
  createdAt?: string;
}

/**
 * Offering Session Header
 */
export interface OfferingSession {
  id: string;
  churchId: string;
  serviceDate: string;
  serviceName: string;
  location?: string | null;
  status: OfferingSessionStatus;
  expectedCashAmount: Money;
  expectedTransferAmount: Money;
  expectedQrAmount: Money;
  expectedTotalAmount: Money;
  countedCashAmount?: Money | null;
  cashVarianceAmount?: Money | null;
  varianceStatus?: VarianceStatus | null;
  varianceReason?: string | null;
  counter1Id?: string | null;
  counter2Id?: string | null;
  counter1Name?: string | null;
  counter2Name?: string | null;
  counter1SignedAt?: string | null;
  counter2SignedAt?: string | null;
  financialTransactionId?: string | null;
  postedAt?: string | null;
  postedBy?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  creatorName?: string | null;
  createdAt?: string;
  updatedAt?: string;
  items?: OfferingItem[];
  cashCount?: CashCount | null;
  revisions?: OfferingRevision[];
}

/**
 * Input DTOs
 */
export interface CreateOfferingSessionInput {
  serviceDate: string;
  serviceName: string;
  items: Array<{
    fundId: string;
    categoryId?: string | null;
    paymentChannel: OfferingPaymentChannel;
    sourceType?: OfferingSourceType;
    amount: string | number | Money;
    donorName?: string | null;
    notes?: string | null;
  }>;
  notes?: string;
}

export interface ReviseOfferingExpectedInput {
  sessionId: string;
  newItems: Array<{
    fundId: string;
    categoryId?: string | null;
    paymentChannel: OfferingPaymentChannel;
    sourceType?: OfferingSourceType;
    amount: string | number | Money;
    donorName?: string | null;
    notes?: string | null;
  }>;
  revisionReason: string;
}

export interface RecordCashCountInput {
  sessionId: string;
  counter1Id: string;
  counter2Id: string;
  denominations: {
    b1000: number;
    b500: number;
    b100: number;
    b50: number;
    b20: number;
    coins: string | number | Money;
  };
}

export interface ResolveVarianceInput {
  sessionId: string;
  action: VarianceResolutionAction;
  explanation?: string;
}

export interface PostOfferingInput {
  sessionId: string;
  cashAccountId: string;
  bankAccountId?: string | null;
}

export interface ChannelTotalsResult {
  cashTotal: Money;
  transferTotal: Money;
  qrTotal: Money;
  otherTotal: Money;
  grandTotal: Money;
}

export interface CashVarianceResult {
  expectedCash: Money;
  countedCash: Money;
  varianceAmount: Money;
  varianceStatus: VarianceStatus;
  isZeroMatch: boolean;
  isShortage: boolean;
  isSurplus: boolean;
  percentage: number;
}

/**
 * Service Layer Return Types
 */
export interface OfferingServiceError {
  code: string;
  message: string;
  details?: any;
  isStaleState?: boolean;
}

export interface OfferingServiceResult<T> {
  success: boolean;
  data?: T;
  error?: OfferingServiceError;
}

export interface PostOfferingResult {
  sessionId: string;
  transactionId: string;
  status: "posted";
  alreadyPosted: boolean;
}
