/**
 * Calendar-period boundaries for ledger queries.
 *
 * One implementation, used by both the page that asks "this month" and the
 * service that is handed a "YYYY-MM". A month boundary that is wrong by a day
 * silently drops or double-counts transactions, so it gets a single owner
 * rather than a copy per caller.
 */

/** First and last calendar day of a month, as `YYYY-MM-DD` strings. */
export interface MonthBounds {
  start: string;
  end: string;
}

const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * Bounds of the calendar month containing `month`.
 *
 * Accepts a `Date` (uses its local calendar month) or a `"YYYY-MM"` string.
 * Throws on a malformed string: callers wrap this in a result type, so a bad
 * period surfaces as an error rather than as a silently wrong total.
 *
 * `new Date(year, monthIndex + 1, 0)` is day zero of the following month, i.e.
 * the last day of this one. That is correct for February, for leap years and
 * for the 30-day months without a lookup table.
 */
export function monthBounds(month: Date | string): MonthBounds {
  let year: number;
  let monthIndex: number;

  if (typeof month === "string") {
    const parsed = /^(\d{4})-(\d{2})$/.exec(month);
    if (!parsed) {
      throw new Error(`monthBounds: expected "YYYY-MM", received "${month}"`);
    }
    year = Number(parsed[1]);
    monthIndex = Number(parsed[2]) - 1;
    if (monthIndex < 0 || monthIndex > 11) {
      throw new Error(`monthBounds: month out of range in "${month}"`);
    }
  } else {
    year = month.getFullYear();
    monthIndex = month.getMonth();
  }

  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const mm = pad(monthIndex + 1);

  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${pad(lastDay)}`,
  };
}
