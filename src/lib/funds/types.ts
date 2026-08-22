import { Money } from "../money";

export interface Fund {
  id: string;
  churchId: string;
  name: string;
  description: string | null;
  targetAmount: Money | null;
  currentBalance: Money;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FundTransferInput {
  churchId: string;
  fromFundId: string;
  toFundId: string;
  amount: string | number | Money;
  note?: string | null;
}

export interface FundServiceError {
  code: string;
  message: string;
  details?: string;
}

export type FundServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: FundServiceError };
