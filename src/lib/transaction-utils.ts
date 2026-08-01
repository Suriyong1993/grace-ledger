/**
 * Transaction filtering utilities — extracted from RecentTransactionsTable.tsx
 *
 * Pure functions for filtering transaction rows.
 * Separated from the React component so they can be unit-tested
 * without a DOM environment.
 */

import type { TxStatus } from "@/lib/types";

export type TxFilter = "all" | "income" | "expense" | "pending";

export interface TransactionRowData {
  id: string;
  kind: "income" | "expense";
  date: string;
  amount: number;
  description?: string;
  categoryName?: string;
  vendor?: string;
  status: TxStatus;
  createdBy?: string;
}

/**
 * Filter transactions by the selected filter type.
 * - "all" → return all transactions
 * - "income" → only income transactions
 * - "expense" → only expense transactions
 * - "pending" → only transactions with status "pending"
 */
export function filterTransactions(
  transactions: TransactionRowData[],
  filter: TxFilter,
): TransactionRowData[] {
  switch (filter) {
    case "income":
      return transactions.filter((tx) => tx.kind === "income");
    case "expense":
      return transactions.filter((tx) => tx.kind === "expense");
    case "pending":
      return transactions.filter((tx) => tx.status === "pending");
    case "all":
    default:
      return transactions;
  }
}

/**
 * Count transactions by status.
 */
export function countByStatus(transactions: TransactionRowData[]): Record<TxStatus, number> {
  const counts: Record<TxStatus, number> = {
    draft: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    voided: 0,
  };
  for (const tx of transactions) {
    counts[tx.status]++;
  }
  return counts;
}
