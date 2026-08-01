/**
 * Unit Tests — Money Value Object
 *
 * Tests the core financial calculation logic.
 * Uses vitest with node environment (no DOM required).
 *
 * Run: npx vitest run src/lib/__tests__/money.test.ts
 */

import { describe, it, expect } from "vitest";
import { Money } from "@/lib/money";

describe("Money — Value Object", () => {
  // ── Creation ──────────────────────────────────────────────────

  describe("fromBaht", () => {
    it("creates from whole baht string", () => {
      const m = Money.fromBaht("100");
      expect(m.toBahtString()).toBe("100.00");
      expect(m.toNumber()).toBe(100);
    });

    it("creates from decimal baht string", () => {
      const m = Money.fromBaht("100.50");
      expect(m.toBahtString()).toBe("100.50");
      expect(m.toNumber()).toBe(100.5);
    });

    it("creates from zero", () => {
      const m = Money.fromBaht("0");
      expect(m.isZero()).toBe(true);
    });

    it("creates negative amount", () => {
      const m = Money.fromBaht("-50.25");
      expect(m.isNegative()).toBe(true);
      expect(m.toBahtString()).toBe("-50.25");
    });
  });

  describe("fromSatang", () => {
    it("creates from integer satang", () => {
      const m = Money.fromSatang(10000);
      expect(m.toBahtString()).toBe("100.00");
    });

    it("creates from bigint satang", () => {
      const m = Money.fromSatang(10000n);
      expect(m.toBahtString()).toBe("100.00");
    });
  });

  describe("zero", () => {
    it("creates zero baht", () => {
      expect(Money.zero().isZero()).toBe(true);
    });
  });

  // ── Arithmetic ───────────────────────────────────────────────

  describe("add", () => {
    it("adds two positive amounts", () => {
      const a = Money.fromBaht("100.50");
      const b = Money.fromBaht("50.25");
      expect(a.add(b).toBahtString()).toBe("150.75");
    });

    it("adds zero", () => {
      const a = Money.fromBaht("100");
      expect(a.add(Money.zero()).toBahtString()).toBe("100.00");
    });

    it("handles carry (99 + 1 satang)", () => {
      const a = Money.fromBaht("0.99");
      const b = Money.fromBaht("0.01");
      expect(a.add(b).toBahtString()).toBe("1.00");
    });
  });

  describe("subtract", () => {
    it("subtracts two positive amounts", () => {
      const a = Money.fromBaht("100.50");
      const b = Money.fromBaht("30.25");
      expect(a.subtract(b).toBahtString()).toBe("70.25");
    });

    it("produces negative result", () => {
      const a = Money.fromBaht("50");
      const b = Money.fromBaht("100");
      expect(a.subtract(b).isNegative()).toBe(true);
      expect(a.subtract(b).toBahtString()).toBe("-50.00");
    });
  });

  describe("multiply", () => {
    it("multiplies by integer factor", () => {
      const m = Money.fromBaht("100.50");
      expect(m.multiply(3).toBahtString()).toBe("301.50");
    });

    it("throws on non-integer factor", () => {
      const m = Money.fromBaht("100");
      expect(() => m.multiply(1.5)).toThrow("integer factors");
    });
  });

  describe("abs", () => {
    it("returns absolute of negative", () => {
      const m = Money.fromBaht("-50.25");
      expect(m.abs().toBahtString()).toBe("50.25");
    });

    it("returns same for positive", () => {
      const m = Money.fromBaht("50.25");
      expect(m.abs().toBahtString()).toBe("50.25");
    });
  });
});
