/**
 * Unit Tests — Transaction Filtering Utilities
 *
 * Tests the transaction filtering logic extracted from RecentTransactionsTable.
 * Uses vitest with node environment (no DOM required).
 *
 * Run: npx vitest run src/lib/__tests__/transaction-utils.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  filterTransactions,
  countByStatus,
  type TransactionRowData,
} from "@/lib/transaction-utils";

const SAMPLE_TXS: TransactionRowData[] = [
  { id: "1", kind: "income", date: "2024-01-15", amount: 1000, status: "approved" },
  { id: "2", kind: "expense", date: "2024-01-14", amount: 500, status: "pending" },
  { id: "3", kind: "income", date: "2024-01-13", amount: 2000, status: "approved" },
  { id: "4", kind: "expense", date: "2024-01-12", amount: 300, status: "rejected" },
  { id: "5", kind: "expense", date: "2024-01-11", amount: 700, status: "pending" },
  { id: "6", kind: "income", date: "2024-01-10", amount: 1500, status: "draft" },
];

describe("Transaction Utils", () => {
  // ── filterTransactions ──────────────────────────────────────────

  describe("filterTransactions", () => {
    it("returns all when filter is 'all'", () => {
      const result = filterTransactions(SAMPLE_TXS, "all");
      expect(result).toHaveLength(6);
    });

    it("filters only income", () => {
      const result = filterTransactions(SAMPLE_TXS, "income");
      expect(result).toHaveLength(3);
      expect(result.every((tx) => tx.kind === "income")).toBe(true);
    });

    it("filters only expense", () => {
      const result = filterTransactions(SAMPLE_TXS, "expense");
      expect(result).toHaveLength(3);
      expect(result.every((tx) => tx.kind === "expense")).toBe(true);
    });

    it("filters only pending", () => {
      const result = filterTransactions(SAMPLE_TXS, "pending");
      expect(result).toHaveLength(2);
      expect(result.every((tx) => tx.status === "pending")).toBe(true);
    });

    it("returns empty array for empty input", () => {
      expect(filterTransactions([], "all")).toHaveLength(0);
      expect(filterTransactions([], "income")).toHaveLength(0);
    });

    it("preserves order", () => {
      const result = filterTransactions(SAMPLE_TXS, "all");
      expect(result.map((tx) => tx.id)).toEqual(["1", "2", "3", "4", "5", "6"]);
    });
  });

  // ── countByStatus ───────────────────────────────────────────────

  describe("countByStatus", () => {
    it("counts all statuses correctly", () => {
      const counts = countByStatus(SAMPLE_TXS);
      expect(counts.approved).toBe(2);
      expect(counts.pending).toBe(2);
      expect(counts.rejected).toBe(1);
      expect(counts.draft).toBe(1);
      expect(counts.voided).toBe(0);
    });

    it("returns zero counts for empty array", () => {
      const counts = countByStatus([]);
      expect(counts.draft).toBe(0);
      expect(counts.pending).toBe(0);
      expect(counts.approved).toBe(0);
      expect(counts.rejected).toBe(0);
      expect(counts.voided).toBe(0);
    });

    it("total matches array length", () => {
      const counts = countByStatus(SAMPLE_TXS);
      const total = Object.values(counts).reduce((s, n) => s + n, 0);
      expect(total).toBe(SAMPLE_TXS.length);
    });
  });
});
