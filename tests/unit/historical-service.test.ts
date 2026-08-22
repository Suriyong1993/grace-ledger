import { describe, it, expect, vi, beforeEach } from "vitest";
import { HistoricalService, LIVE_CUTOVER_DATE } from "../../src/lib/reports/historical-service";
import { Money } from "../../src/lib/money";

// Mock raw DB data conforming to migration 017 seed
const mockMonthlyRows = [
  {
    id: "m-01",
    church_id: "church-uuid-1",
    fiscal_year: 2569,
    month: 1,
    month_name: "มกราคม",
    status: "historical",
    data_through: "2026-01-31",
    income_total: "17180.00",
    cash_income: "7930.00",
    online_income: "9250.00",
    expense_total: "7814.00",
    net: "9366.00",
    opening_balance_reported: null,
    closing_balance_reported: null,
    data_quality_flag: "VERIFIED",
    data_quality_notes: "Verified against primary report",
    source: "historical_import",
    source_document: "church_financial_report_2569_jan_jul",
    imported_at: "2026-08-23T00:00:00Z",
    import_batch_id: "batch-uuid-1",
    is_immutable: true,
  },
  {
    id: "m-02",
    church_id: "church-uuid-1",
    fiscal_year: 2569,
    month: 2,
    month_name: "กุมภาพันธ์",
    status: "historical",
    data_through: "2026-02-28",
    income_total: "16672.00",
    cash_income: "6472.00",
    online_income: "10200.00",
    expense_total: "11367.00",
    net: "5305.00",
    opening_balance_reported: "9366.00",
    closing_balance_reported: "14671.00",
    data_quality_flag: "VERIFIED",
    data_quality_notes: "Verified against primary report",
    source: "historical_import",
    source_document: "church_financial_report_2569_jan_jul",
    imported_at: "2026-08-23T00:00:00Z",
    import_batch_id: "batch-uuid-1",
    is_immutable: true,
  },
  {
    id: "m-03",
    church_id: "church-uuid-1",
    fiscal_year: 2569,
    month: 3,
    month_name: "มีนาคม",
    status: "historical",
    data_through: "2026-03-31",
    income_total: "27130.00",
    cash_income: "12280.00",
    online_income: "14850.00",
    expense_total: "24816.00",
    net: "2314.00",
    opening_balance_reported: null,
    closing_balance_reported: "2314.00",
    data_quality_flag: "DATA_REVIEW_REQUIRED",
    data_quality_notes: "March 2569 opening/closing balance basis differs from February cumulative balance. Reported closing is 2314.00 vs expected cumulative 16985.00.",
    source: "historical_import",
    source_document: "church_financial_report_2569_jan_jul",
    imported_at: "2026-08-23T00:00:00Z",
    import_batch_id: "batch-uuid-1",
    is_immutable: true,
  },
  {
    id: "m-04",
    church_id: "church-uuid-1",
    fiscal_year: 2569,
    month: 4,
    month_name: "เมษายน",
    status: "historical",
    data_through: "2026-04-30",
    income_total: "45305.00",
    cash_income: "26355.00",
    online_income: "18950.00",
    expense_total: "45134.00",
    net: "171.00",
    opening_balance_reported: "2314.00",
    closing_balance_reported: "2485.00",
    data_quality_flag: "VERIFIED",
    data_quality_notes: "Verified against primary report",
    source: "historical_import",
    source_document: "church_financial_report_2569_jan_jul",
    imported_at: "2026-08-23T00:00:00Z",
    import_batch_id: "batch-uuid-1",
    is_immutable: true,
  },
  {
    id: "m-05",
    church_id: "church-uuid-1",
    fiscal_year: 2569,
    month: 5,
    month_name: "พฤษภาคม",
    status: "historical",
    data_through: "2026-05-31",
    income_total: "19531.00",
    cash_income: "6131.00",
    online_income: "13400.00",
    expense_total: "28066.00",
    net: "-8535.00",
    opening_balance_reported: "2485.00",
    closing_balance_reported: "-6050.00",
    data_quality_flag: "VERIFIED",
    data_quality_notes: "Verified against primary report",
    source: "historical_import",
    source_document: "church_financial_report_2569_jan_jul",
    imported_at: "2026-08-23T00:00:00Z",
    import_batch_id: "batch-uuid-1",
    is_immutable: true,
  },
  {
    id: "m-06",
    church_id: "church-uuid-1",
    fiscal_year: 2569,
    month: 6,
    month_name: "มิถุนายน",
    status: "historical",
    data_through: "2026-06-30",
    income_total: "14120.00",
    cash_income: "4470.00",
    online_income: "9650.00",
    expense_total: "23177.00",
    net: "-9057.00",
    opening_balance_reported: "-6050.00",
    closing_balance_reported: "-15107.00",
    data_quality_flag: "VERIFIED",
    data_quality_notes: "Verified against primary report",
    source: "historical_import",
    source_document: "church_financial_report_2569_jan_jul",
    imported_at: "2026-08-23T00:00:00Z",
    import_batch_id: "batch-uuid-1",
    is_immutable: true,
  },
  {
    id: "m-07",
    church_id: "church-uuid-1",
    fiscal_year: 2569,
    month: 7,
    month_name: "กรกฎาคม",
    status: "historical_partial",
    data_through: "2026-07-19",
    income_total: "13345.00",
    cash_income: "5145.00",
    online_income: "8200.00",
    expense_total: "5791.00",
    net: "7554.00",
    opening_balance_reported: "-15107.00",
    closing_balance_reported: "-7553.00",
    data_quality_flag: "VERIFIED",
    data_quality_notes: "Partial month data through 2026-07-19",
    source: "historical_import",
    source_document: "church_financial_report_2569_jan_jul",
    imported_at: "2026-08-23T00:00:00Z",
    import_batch_id: "batch-uuid-1",
    is_immutable: true,
  },
];

const mockWeeklyRows = [
  // January (4 weeks)
  { id: "w-01", church_id: "church-uuid-1", fiscal_year: 2569, month: 1, week_date: "2026-01-04", income_total: "4730.00", cash_income: "1930.00", online_income: "2800.00", expense_total: "1536.00", net: "3194.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-02", church_id: "church-uuid-1", fiscal_year: 2569, month: 1, week_date: "2026-01-11", income_total: "4160.00", cash_income: "1960.00", online_income: "2200.00", expense_total: "2587.00", net: "1573.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-03", church_id: "church-uuid-1", fiscal_year: 2569, month: 1, week_date: "2026-01-18", income_total: "3540.00", cash_income: "1190.00", online_income: "2350.00", expense_total: "0.00", net: "3540.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-04", church_id: "church-uuid-1", fiscal_year: 2569, month: 1, week_date: "2026-01-25", income_total: "4750.00", cash_income: "2850.00", online_income: "1900.00", expense_total: "3691.00", net: "1059.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  // February (4 weeks)
  { id: "w-05", church_id: "church-uuid-1", fiscal_year: 2569, month: 2, week_date: "2026-02-01", income_total: "3290.00", cash_income: "990.00", online_income: "2300.00", expense_total: "4710.00", net: "-1420.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-06", church_id: "church-uuid-1", fiscal_year: 2569, month: 2, week_date: "2026-02-08", income_total: "3460.00", cash_income: "960.00", online_income: "2500.00", expense_total: "1615.00", net: "1845.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-07", church_id: "church-uuid-1", fiscal_year: 2569, month: 2, week_date: "2026-02-15", income_total: "5722.00", cash_income: "2922.00", online_income: "2800.00", expense_total: "2873.00", net: "2849.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-08", church_id: "church-uuid-1", fiscal_year: 2569, month: 2, week_date: "2026-02-22", income_total: "4200.00", cash_income: "1600.00", online_income: "2600.00", expense_total: "2169.00", net: "2031.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  // March (5 weeks)
  { id: "w-09", church_id: "church-uuid-1", fiscal_year: 2569, month: 3, week_date: "2026-03-01", income_total: "5242.00", cash_income: "1642.00", online_income: "3600.00", expense_total: "14797.00", net: "-9555.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-10", church_id: "church-uuid-1", fiscal_year: 2569, month: 3, week_date: "2026-03-08", income_total: "5930.00", cash_income: "3430.00", online_income: "2500.00", expense_total: "1712.00", net: "4218.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-11", church_id: "church-uuid-1", fiscal_year: 2569, month: 3, week_date: "2026-03-15", income_total: "4170.00", cash_income: "1070.00", online_income: "3100.00", expense_total: "2620.00", net: "1550.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-12", church_id: "church-uuid-1", fiscal_year: 2569, month: 3, week_date: "2026-03-22", income_total: "7390.00", cash_income: "4490.00", online_income: "2900.00", expense_total: "3170.00", net: "4220.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-13", church_id: "church-uuid-1", fiscal_year: 2569, month: 3, week_date: "2026-03-29", income_total: "4398.00", cash_income: "1648.00", online_income: "2750.00", expense_total: "2517.00", net: "1881.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  // April (4 weeks)
  { id: "w-14", church_id: "church-uuid-1", fiscal_year: 2569, month: 4, week_date: "2026-04-05", income_total: "23920.00", cash_income: "21020.00", online_income: "2900.00", expense_total: "15951.00", net: "7969.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-15", church_id: "church-uuid-1", fiscal_year: 2569, month: 4, week_date: "2026-04-12", income_total: "4385.00", cash_income: "1085.00", online_income: "3300.00", expense_total: "8206.00", net: "-3821.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-16", church_id: "church-uuid-1", fiscal_year: 2569, month: 4, week_date: "2026-04-19", income_total: "4640.00", cash_income: "1390.00", online_income: "3250.00", expense_total: "13625.00", net: "-8985.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-17", church_id: "church-uuid-1", fiscal_year: 2569, month: 4, week_date: "2026-04-26", income_total: "12360.00", cash_income: "2860.00", online_income: "9500.00", expense_total: "7352.00", net: "5008.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  // May (5 weeks)
  { id: "w-18", church_id: "church-uuid-1", fiscal_year: 2569, month: 5, week_date: "2026-05-03", income_total: "2605.00", cash_income: "1055.00", online_income: "1550.00", expense_total: "9740.00", net: "-7135.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-19", church_id: "church-uuid-1", fiscal_year: 2569, month: 5, week_date: "2026-05-10", income_total: "5041.00", cash_income: "1141.00", online_income: "3900.00", expense_total: "2087.00", net: "2954.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-20", church_id: "church-uuid-1", fiscal_year: 2569, month: 5, week_date: "2026-05-17", income_total: "2250.00", cash_income: "650.00", online_income: "1600.00", expense_total: "1635.00", net: "615.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-21", church_id: "church-uuid-1", fiscal_year: 2569, month: 5, week_date: "2026-05-24", income_total: "3745.00", cash_income: "2345.00", online_income: "1400.00", expense_total: "14604.00", net: "-10859.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-22", church_id: "church-uuid-1", fiscal_year: 2569, month: 5, week_date: "2026-05-31", income_total: "5890.00", cash_income: "940.00", online_income: "4950.00", expense_total: "0.00", net: "5890.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  // June (4 weeks)
  { id: "w-23", church_id: "church-uuid-1", fiscal_year: 2569, month: 6, week_date: "2026-06-07", income_total: "2110.00", cash_income: "610.00", online_income: "1500.00", expense_total: "2060.00", net: "50.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-24", church_id: "church-uuid-1", fiscal_year: 2569, month: 6, week_date: "2026-06-14", income_total: "3070.00", cash_income: "1020.00", online_income: "2050.00", expense_total: "2250.00", net: "820.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-25", church_id: "church-uuid-1", fiscal_year: 2569, month: 6, week_date: "2026-06-21", income_total: "3230.00", cash_income: "1930.00", online_income: "1300.00", expense_total: "3590.00", net: "-360.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-26", church_id: "church-uuid-1", fiscal_year: 2569, month: 6, week_date: "2026-06-28", income_total: "5710.00", cash_income: "910.00", online_income: "4800.00", expense_total: "15277.00", net: "-9567.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  // July (3 weeks through 2026-07-19)
  { id: "w-27", church_id: "church-uuid-1", fiscal_year: 2569, month: 7, week_date: "2026-07-05", income_total: "3719.00", cash_income: "2219.00", online_income: "1500.00", expense_total: "2156.00", net: "1563.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-28", church_id: "church-uuid-1", fiscal_year: 2569, month: 7, week_date: "2026-07-12", income_total: "6515.00", cash_income: "1715.00", online_income: "4800.00", expense_total: "2225.00", net: "4290.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
  { id: "w-29", church_id: "church-uuid-1", fiscal_year: 2569, month: 7, week_date: "2026-07-19", income_total: "3111.00", cash_income: "1211.00", online_income: "1900.00", expense_total: "1410.00", net: "1701.00", source: "historical_import", source_document: "church_financial_report_2569_jan_jul", imported_at: "2026-08-23T00:00:00Z", import_batch_id: "b1", is_immutable: true },
];

function createMockSupabaseClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === "historical_monthly_summaries") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockMonthlyRows, error: null }),
          maybeSingle: vi.fn().mockImplementation(() => {
            return Promise.resolve({ data: mockMonthlyRows[2], error: null }); // March row for test
          }),
        };
      }
      if (table === "historical_weekly_summaries") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockWeeklyRows, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
    }),
  } as any;
}

describe("Historical Financial Summaries & Service — Unit Tests", () => {
  let mockSupabase: any;
  let historicalService: HistoricalService;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    historicalService = new HistoricalService(mockSupabase);
  });

  describe("Cutover Date & Boundary Detection", () => {
    it("enforces LIVE_CUTOVER_DATE as 2026-08-01", () => {
      expect(LIVE_CUTOVER_DATE).toBe("2026-08-01");
    });

    it("correctly identifies dates before 2026-08-01 as historical", () => {
      expect(HistoricalService.isHistoricalPeriod("2026-01")).toBe(true);
      expect(HistoricalService.isHistoricalPeriod("2026-07")).toBe(true);
      expect(HistoricalService.isHistoricalPeriod("2026-07-19")).toBe(true);
      expect(HistoricalService.isHistoricalPeriod("2026-07-31")).toBe(true);
    });

    it("correctly identifies dates on or after 2026-08-01 as live accounting", () => {
      expect(HistoricalService.isHistoricalPeriod("2026-08")).toBe(false);
      expect(HistoricalService.isHistoricalPeriod("2026-08-01")).toBe(false);
      expect(HistoricalService.isHistoricalPeriod("2026-09")).toBe(false);
      expect(HistoricalService.isHistoricalPeriod("2027-01")).toBe(false);
    });
  });

  describe("Monthly Summaries Retrieval & Validation", () => {
    it("returns 7 monthly summary records for fiscal year 2569", async () => {
      const res = await historicalService.getMonthlySummaries("church-uuid-1", 2569);
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.length).toBe(7);
    });

    it("preserves March 2569 discrepancy and flags DATA_REVIEW_REQUIRED", async () => {
      const res = await historicalService.getMonthlySummaries("church-uuid-1", 2569);
      const march = res.data?.find((m) => m.month === 3);

      expect(march).toBeDefined();
      expect(march?.monthName).toBe("มีนาคม");
      expect(march?.dataQualityFlag).toBe("DATA_REVIEW_REQUIRED");
      expect(march?.incomeTotal.equals(Money.from("27130.00"))).toBe(true);
      expect(march?.expenseTotal.equals(Money.from("24816.00"))).toBe(true);
      expect(march?.net.equals(Money.from("2314.00"))).toBe(true);
      expect(march?.closingBalanceReported?.equals(Money.from("2314.00"))).toBe(true);
    });

    it("identifies July 2569 as partial month data through 2026-07-19", async () => {
      const res = await historicalService.getMonthlySummaries("church-uuid-1", 2569);
      const july = res.data?.find((m) => m.month === 7);

      expect(july).toBeDefined();
      expect(july?.monthName).toBe("กรกฎาคม");
      expect(july?.status).toBe("historical_partial");
      expect(july?.dataThrough).toBe("2026-07-19");
      expect(july?.incomeTotal.equals(Money.from("13345.00"))).toBe(true);
      expect(july?.expenseTotal.equals(Money.from("5791.00"))).toBe(true);
      expect(july?.net.equals(Money.from("7554.00"))).toBe(true);
    });
  });

  describe("Weekly Breakdown Data Validation", () => {
    it("returns all 29 weekly summary rows", async () => {
      const res = await historicalService.getWeeklySummaries("church-uuid-1", 2569);
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.length).toBe(29);
    });

    it("verifies cash and online income split per week", async () => {
      const res = await historicalService.getWeeklySummaries("church-uuid-1", 2569);
      const firstWeek = res.data?.[0];

      expect(firstWeek?.weekDate).toBe("2026-01-04");
      expect(firstWeek?.incomeTotal.equals(Money.from("4730.00"))).toBe(true);
      expect(firstWeek?.cashIncome.equals(Money.from("1930.00"))).toBe(true);
      expect(firstWeek?.onlineIncome.equals(Money.from("2800.00"))).toBe(true);
      expect(firstWeek?.expenseTotal.equals(Money.from("1536.00"))).toBe(true);
      expect(firstWeek?.net.equals(Money.from("3194.00"))).toBe(true);
    });
  });

  describe("Grand Totals Aggregation & Mathematical Reconciliation", () => {
    it("reconciles exact grand totals Jan-Jul 2569", async () => {
      const res = await historicalService.getGrandTotals("church-uuid-1", 2569);
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();

      const totals = res.data!;
      // Grand totals:
      // Income: 153,283.00
      // Expense: 146,165.00
      // Net: 7,118.00
      // Cash Income: 68,783.00
      // Online Income: 84,500.00
      expect(totals.incomeTotal.equals(Money.from("153283.00"))).toBe(true);
      expect(totals.expenseTotal.equals(Money.from("146165.00"))).toBe(true);
      expect(totals.net.equals(Money.from("7118.00"))).toBe(true);
      expect(totals.cashIncome.equals(Money.from("68783.00"))).toBe(true);
      expect(totals.onlineIncome.equals(Money.from("84500.00"))).toBe(true);
      expect(totals.hasDataReviewRequired).toBe(true);
      expect(totals.monthlyRecordsCount).toBe(7);
      expect(totals.weeklyRecordsCount).toBe(29);
    });

    it("verifies cash + online exactly equals total income", async () => {
      const res = await historicalService.getGrandTotals("church-uuid-1", 2569);
      const totals = res.data!;
      const sum = totals.cashIncome.add(totals.onlineIncome);
      expect(sum.equals(totals.incomeTotal)).toBe(true);
    });
  });

  describe("Isolation & Immutability Guarantee", () => {
    it("never queries live transactions table during historical summary fetching", async () => {
      await historicalService.getMonthlySummaries("church-uuid-1", 2569);
      await historicalService.getWeeklySummaries("church-uuid-1", 2569);
      await historicalService.getGrandTotals("church-uuid-1", 2569);

      // Verify that 'transactions', 'transaction_splits', and 'funds' tables were NOT called
      const calls = mockSupabase.from.mock.calls.map((c: any) => c[0]);
      expect(calls).not.toContain("transactions");
      expect(calls).not.toContain("transaction_splits");
      expect(calls).not.toContain("funds");
    });
  });
});
