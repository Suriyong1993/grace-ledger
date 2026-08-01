/**
 * Unit Tests — Gauge Utility Functions
 *
 * Tests the budget gauge calculation logic extracted from DashboardGaugeChart.
 * Uses vitest with node environment (no DOM required).
 *
 * Run: npx vitest run src/lib/__tests__/gauge-utils.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  calculateGaugePercentage,
  calculateGaugeArc,
  getGaugeStatusLabel,
} from "@/lib/gauge-utils";

describe("Gauge Utils", () => {
  // ── calculateGaugePercentage ──────────────────────────────────

  describe("calculateGaugePercentage", () => {
    it("calculates 0% when nothing used", () => {
      expect(calculateGaugePercentage(2500000, 0)).toBe(0);
    });

    it("calculates 50% when half used", () => {
      expect(calculateGaugePercentage(2500000, 1250000)).toBe(50);
    });

    it("calculates 100% when fully used", () => {
      expect(calculateGaugePercentage(2500000, 2500000)).toBe(100);
    });

    it("clamps to 100% when over budget", () => {
      expect(calculateGaugePercentage(2500000, 3000000)).toBe(100);
    });

    it("returns 0 when total budget is 0", () => {
      expect(calculateGaugePercentage(0, 500)).toBe(0);
    });

    it("returns 0 when total budget is negative", () => {
      expect(calculateGaugePercentage(-100, 500)).toBe(0);
    });

    it("rounds to nearest integer", () => {
      expect(calculateGaugePercentage(3, 1)).toBe(33);
    });

    it("handles very large budgets", () => {
      expect(calculateGaugePercentage(100000000, 50000000)).toBe(50);
    });
  });

  // ── calculateGaugeArc ─────────────────────────────────────────

  describe("calculateGaugeArc", () => {
    it("returns correct structure", () => {
      const result = calculateGaugeArc({ totalBudget: 1000, usedBudget: 500 });
      expect(result).toHaveProperty("percentage");
      expect(result).toHaveProperty("radius");
      expect(result).toHaveProperty("strokeWidth");
      expect(result).toHaveProperty("halfCircumference");
      expect(result).toHaveProperty("strokeDashoffset");
    });

    it("radius is always 70", () => {
      const result = calculateGaugeArc({ totalBudget: 1000, usedBudget: 500 });
      expect(result.radius).toBe(70);
    });

    it("strokeWidth is always 14", () => {
      const result = calculateGaugeArc({ totalBudget: 1000, usedBudget: 500 });
      expect(result.strokeWidth).toBe(14);
    });

    it("halfCircumference ≈ 219.9 (π × 70)", () => {
      const result = calculateGaugeArc({ totalBudget: 1000, usedBudget: 500 });
      expect(result.halfCircumference).toBeCloseTo(219.9, 1);
    });

    it("strokeDashoffset = halfCircumference when 0%", () => {
      const result = calculateGaugeArc({ totalBudget: 1000, usedBudget: 0 });
      expect(result.percentage).toBe(0);
      expect(result.strokeDashoffset).toBeCloseTo(result.halfCircumference, 1);
    });

    it("strokeDashoffset = 0 when 100%", () => {
      const result = calculateGaugeArc({ totalBudget: 1000, usedBudget: 1000 });
      expect(result.percentage).toBe(100);
      expect(result.strokeDashoffset).toBeCloseTo(0, 1);
    });

    it("strokeDashoffset = halfCircumference/2 when 50%", () => {
      const result = calculateGaugeArc({ totalBudget: 1000, usedBudget: 500 });
      expect(result.percentage).toBe(50);
      expect(result.strokeDashoffset).toBeCloseTo(result.halfCircumference * 0.5, 1);
    });
  });

  // ── getGaugeStatusLabel ──────────────────────────────────────

  describe("getGaugeStatusLabel", () => {
    it("returns ปกติ for 0%", () => {
      expect(getGaugeStatusLabel(0)).toBe("ปกติ");
    });

    it("returns ปกติ for 69%", () => {
      expect(getGaugeStatusLabel(69)).toBe("ปกติ");
    });

    it("returns ใกล้เต็ม for 70%", () => {
      expect(getGaugeStatusLabel(70)).toBe("ใกล้เต็ม");
    });

    it("returns ใกล้เต็ม for 89%", () => {
      expect(getGaugeStatusLabel(89)).toBe("ใกล้เต็ม");
    });

    it("returns เกินงบ for 90%", () => {
      expect(getGaugeStatusLabel(90)).toBe("เกินงบ");
    });

    it("returns เกินงบ for 100%", () => {
      expect(getGaugeStatusLabel(100)).toBe("เกินงบ");
    });
  });
});
