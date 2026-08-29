import { describe, it, expect } from "vitest";
import { monthBounds } from "../../src/lib/period";

describe("monthBounds — calendar-month boundaries", () => {
  it("ends February on the 28th in a common year", () => {
    expect(monthBounds("2026-02")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });

  it("ends February on the 29th in a leap year", () => {
    expect(monthBounds("2028-02")).toEqual({
      start: "2028-02-01",
      end: "2028-02-29",
    });
    // 2000 is a leap year (divisible by 400); 1900 is not (divisible by 100).
    expect(monthBounds("2000-02").end).toBe("2000-02-29");
    expect(monthBounds("1900-02").end).toBe("1900-02-28");
  });

  it("ends 30-day months on the 30th", () => {
    for (const m of ["04", "06", "09", "11"]) {
      expect(monthBounds(`2026-${m}`).end).toBe(`2026-${m}-30`);
    }
  });

  it("ends 31-day months on the 31st", () => {
    for (const m of ["01", "03", "05", "07", "08", "10", "12"]) {
      expect(monthBounds(`2026-${m}`).end).toBe(`2026-${m}-31`);
    }
  });

  it("accepts a Date and uses its local calendar month", () => {
    expect(monthBounds(new Date(2026, 1, 15))).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
    // The last instant of a month must still resolve to that month.
    expect(monthBounds(new Date(2026, 3, 30, 23, 59, 59))).toEqual({
      start: "2026-04-01",
      end: "2026-04-30",
    });
  });

  it("always zero-pads, so the strings sort and compare as dates", () => {
    const { start, end } = monthBounds("2026-09");
    expect(start).toBe("2026-09-01");
    expect(end).toBe("2026-09-30");
    expect(start <= end).toBe(true);
  });

  it("throws on a malformed period instead of returning a silently wrong window", () => {
    // Callers wrap this in a result type, so a bad period surfaces as an error
    // rather than as a total computed over the wrong range.
    expect(() => monthBounds("2026-2")).toThrow(/YYYY-MM/);
    expect(() => monthBounds("not-a-month")).toThrow(/YYYY-MM/);
    expect(() => monthBounds("2026-13")).toThrow(/out of range/);
    expect(() => monthBounds("2026-00")).toThrow(/out of range/);
  });
});
