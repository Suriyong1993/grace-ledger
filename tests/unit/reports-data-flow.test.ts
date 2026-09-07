// @vitest-environment jsdom
/**
 * Reports — data integration, separate from UI state.
 *
 * The question here is not "does the tab light up" (covered in
 * reports-page-interaction.test.ts) but "does the period the user picked
 * reach the data layer as the right query, and does the right response win
 * when several are in flight".
 *
 * The services are replaced with recorders so the period -> date-range
 * mapping and the request ordering are observable. No Supabase is reachable
 * from here, so nothing below claims a real query ran.
 */
import { describe, it, expect, vi } from "vitest";
import { ReportsPage } from "../../src/pages/ReportsPage";

const CHURCH = "church-abc";

interface Recorder {
  live: Array<{ churchId: string; start: string; end: string }>;
  monthly: Array<{ churchId: string; month: number; year: number }>;
}

/**
 * @param resolver lets a test control when each live request settles, which
 * is how out-of-order responses are reproduced deterministically.
 */
const mountPage = (
  resolver?: (start: string) => Promise<any>,
): { page: any; calls: Recorder } => {
  const calls: Recorder = { live: [], monthly: [] };
  const page: any = new ReportsPage(null as any, CHURCH);

  page.reportsService = {
    getStatementOfFinancialPosition: (
      churchId: string,
      start: string,
      end: string,
    ) => {
      calls.live.push({ churchId, start, end });
      return resolver
        ? resolver(start)
        : Promise.resolve({ success: true, data: { period: start } });
    },
  };
  page.historicalService = {
    getMonthlySummaryByMonth: (churchId: string, month: number, year: number) => {
      calls.monthly.push({ churchId, month, year });
      return Promise.resolve({ success: true, data: { month } });
    },
    getWeeklySummaries: () => Promise.resolve({ success: true, data: [] }),
    getMonthlySummaries: () => Promise.resolve({ success: true, data: [] }),
    getGrandTotals: () => Promise.resolve({ success: true, data: null }),
  };
  page.loadLeadership = vi.fn().mockResolvedValue(undefined);

  return { page, calls };
};

/**
 * loadData awaits leadership before issuing the report request, so a gate is
 * not registered synchronously. Wait for it rather than guessing a tick count.
 */
const gateFor = async (
  gates: Record<string, (v: any) => void>,
  key: string,
): Promise<(v: any) => void> => {
  await vi.waitFor(() => expect(typeof gates[key]).toBe("function"));
  return gates[key];
};

describe("ReportsPage — period maps to query parameters", () => {
  it("sends a full-month range for a live period", async () => {
    const { page, calls } = mountPage();
    page.selectPeriod("2026-08");
    await page.loadData();

    expect(calls.live).toHaveLength(1);
    expect(calls.live[0]).toEqual({
      churchId: CHURCH,
      start: "2026-08-01",
      end: "2026-08-31",
    });
  });

  it("computes the correct last day for a 30-day month", async () => {
    const { page, calls } = mountPage();
    page.selectPeriod("2026-09");
    await page.loadData();

    expect(calls.live[0].end).toBe("2026-09-30");
  });

  it("routes a historical period to the historical service, not the live one", async () => {
    const { page, calls } = mountPage();
    page.selectPeriod("2026-03");
    await page.loadData();

    expect(calls.monthly).toHaveLength(1);
    expect(calls.monthly[0].month).toBe(3);
    expect(calls.live).toHaveLength(0);
  });

  it("passes the church id every request is scoped by", async () => {
    const { page, calls } = mountPage();
    page.selectPeriod("2026-08");
    await page.loadData();

    expect(calls.live[0].churchId).toBe(CHURCH);
  });
});

describe("ReportsPage — overlapping requests", () => {
  it("ignores a stale response that arrives after a newer request", async () => {
    // 2026-08 resolves slowly; 2026-09 is requested after it and resolves first.
    const gates: Record<string, (v: any) => void> = {};
    const { page, calls } = mountPage(
      (start) =>
        new Promise((resolve) => {
          gates[start] = resolve;
        }),
    );

    page.selectPeriod("2026-08");
    const first = page.loadData();
    page.selectPeriod("2026-09");
    const second = page.loadData();

    // Newer request settles first, then the stale one comes back late.
    (await gateFor(gates, "2026-09-01"))({ success: true, data: { period: "2026-09" } });
    await second;
    (await gateFor(gates, "2026-08-01"))({ success: true, data: { period: "2026-08" } });
    await first;

    expect(calls.live).toHaveLength(2);
    // The late August response must not have overwritten September.
    expect(page.getSelectedPeriod()).toBe("2026-09");
    expect(page.statement).toEqual({ period: "2026-09" });
  });

  it("a stale failure does not raise an error over fresh data", async () => {
    const gates: Record<string, (v: any) => void> = {};
    const { page } = mountPage(
      (start) =>
        new Promise((resolve) => {
          gates[start] = resolve;
        }),
    );

    page.selectPeriod("2026-08");
    const first = page.loadData();
    page.selectPeriod("2026-09");
    const second = page.loadData();

    (await gateFor(gates, "2026-09-01"))({ success: true, data: { period: "2026-09" } });
    await second;
    (await gateFor(gates, "2026-08-01"))({ success: false, error: "โหลดไม่สำเร็จ" });
    await first;

    expect(page.errorMessage).toBeNull();
    expect(page.statement).toEqual({ period: "2026-09" });
  });

  it("a stale response does not clear the spinner owned by the newer request", async () => {
    const gates: Record<string, (v: any) => void> = {};
    const { page } = mountPage(
      (start) =>
        new Promise((resolve) => {
          gates[start] = resolve;
        }),
    );

    page.selectPeriod("2026-08");
    const first = page.loadData();
    page.selectPeriod("2026-09");
    const second = page.loadData();

    (await gateFor(gates, "2026-08-01"))({ success: true, data: { period: "2026-08" } });
    await first;

    // September is still in flight, so the page must still read as loading.
    expect(page.isLoading).toBe(true);

    (await gateFor(gates, "2026-09-01"))({ success: true, data: { period: "2026-09" } });
    await second;
    expect(page.isLoading).toBe(false);
  });

  it("rapid switching across many tabs settles on the last one chosen", async () => {
    const { page, calls } = mountPage();

    for (const p of ["2026-08", "2026-03", "2026-09", "2026-02", "2026-08"]) {
      page.selectPeriod(p);
      void page.loadData();
    }
    await vi.waitFor(() => expect(page.isLoading).toBe(false));

    expect(page.getSelectedPeriod()).toBe("2026-08");
    expect(calls.live.at(-1)!.start).toBe("2026-08-01");
  });
});

describe("ReportsPage — error handling and recovery", () => {
  it("records an error when the data layer reports failure", async () => {
    const { page } = mountPage(() =>
      Promise.resolve({ success: false, error: "ไม่สามารถโหลดงบการเงินได้" }),
    );
    page.selectPeriod("2026-08");
    await page.loadData();

    expect(page.errorMessage).toBe("ไม่สามารถโหลดงบการเงินได้");
    expect(page.renderHtml()).toContain("ไม่สามารถโหลดงบการเงินได้");
  });

  it("recovers when a thrown connection fault is followed by a good load", async () => {
    let fail = true;
    const { page } = mountPage(() => {
      if (fail) return Promise.reject(new Error("network down"));
      return Promise.resolve({ success: true, data: { period: "ok" } });
    });

    page.selectPeriod("2026-08");
    await page.loadData();
    expect(page.errorMessage).toBeTruthy();

    fail = false;
    page.selectPeriod("2026-08");
    await page.loadData();

    expect(page.errorMessage).toBeNull();
    expect(page.statement).toEqual({ period: "ok" });
  });

  it("handles an empty result without inventing an error", async () => {
    const { page } = mountPage(() =>
      Promise.resolve({ success: true, data: null }),
    );
    page.selectPeriod("2026-08");
    await page.loadData();

    expect(page.errorMessage).toBeNull();
    expect(page.statement).toBeNull();
    expect(() => page.renderHtml()).not.toThrow();
  });
});
