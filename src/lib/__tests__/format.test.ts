/**
 * Unit Tests — Format Utilities
 *
 * Tests the formatting functions used across the app.
 * Uses vitest with node environment (no DOM required).
 *
 * Run: npx vitest run src/lib/__tests__/format.test.ts
 */

import { describe, it, expect } from "vitest";
import { thb, num, fmtDate, today } from "@/lib/format";

describe("Format Utils", () => {
  // ── thb (Thai Baht formatter) ────────────────────────────────

  describe("thb", () => {
    it("formats whole number", () => {
      const result = thb(1000);
      expect(result).toContain("1,000");
    });

    it("formats decimal number", () => {
      const result = thb(1000.5);
      expect(result).toContain("1,000.50");
    });

    it("formats zero", () => {
      const result = thb(0);
      expect(result).toContain("0.00");
    });

    it("handles NaN safely", () => {
      const result = thb(NaN);
      expect(result).toContain("0.00");
    });

    it("handles Infinity safely", () => {
      const result = thb(Infinity);
      expect(result).toContain("0.00");
    });

    it("formats large number with commas", () => {
      const result = thb(1234567.89);
      expect(result).toContain("1,234,567.89");
    });
  });

  // ── num (number formatter) ───────────────────────────────────

  describe("num", () => {
    it("formats whole number with commas", () => {
      expect(num(1234567)).toBe("1,234,567");
    });

    it("formats zero", () => {
      expect(num(0)).toBe("0");
    });

    it("handles NaN safely", () => {
      expect(num(NaN)).toBe("0");
    });
  });

  // ── fmtDate ──────────────────────────────────────────────────

  describe("fmtDate", () => {
    it("formats ISO date string", () => {
      const result = fmtDate("2024-01-15");
      expect(result).toContain("2567");
    });

    it("formats Date object", () => {
      const result = fmtDate(new Date("2024-01-15"));
      expect(result).toContain("2567");
    });
  });

  // ── today ────────────────────────────────────────────────────

  describe("today", () => {
    it("returns YYYY-MM-DD format", () => {
      const result = today();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
