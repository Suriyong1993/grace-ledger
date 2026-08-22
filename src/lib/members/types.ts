import { Money } from "../money";

export interface Member {
  id: string;
  churchId: string;
  fullName: string;
  memberCode: string | null;
  householdName: string | null;
  joinedDate: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GivingRecord {
  id: string;
  churchId: string;
  memberId: string;
  offeringSessionId: string | null;
  amount: Money;
  givingType: string;
  paymentMethod: string;
  givenAt: string;
  confidentialNote: string | null;
  createdBy: string;
  createdAt: string;
}

export interface MemberServiceError {
  code: string;
  message: string;
  details?: string;
}

export type MemberServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: MemberServiceError };
