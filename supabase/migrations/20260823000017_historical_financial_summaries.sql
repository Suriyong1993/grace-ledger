-- ==============================================================================
-- Grace Ledger — Migration 017: Historical Financial Summaries Schema & Seed
-- Author: Principal Engineer
-- Target: PostgreSQL 16/17 / Supabase
-- Purpose:
--   Stores aggregate historical financial data (Jan-Jul 2569 / 2026) for reporting,
--   trend visualization, and period comparison without polluting the live General Ledger.
-- Invariants:
--   1. Live Cutover Date is 2026-08-01. Historical records are strictly read-only / preview.
--   2. No live transactions, splits, journal entries, or fund balances are modified.
--   3. All records are immutable with NUMERIC(14,2) monetary precision.
--   4. March 2569 closing balance discrepancy is preserved and flagged with DATA_REVIEW_REQUIRED.
--   5. Idempotency enforced via UNIQUE constraints on (church_id, fiscal_year, month/week_date, source_document).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HISTORICAL MONTHLY SUMMARIES TABLE
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS historical_monthly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  fiscal_year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  month_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'historical' CHECK (status IN ('historical', 'historical_partial')),
  data_through DATE,
  income_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  cash_income NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  online_income NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  expense_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  net NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  opening_balance_reported NUMERIC(14,2),
  closing_balance_reported NUMERIC(14,2),
  data_quality_flag TEXT NOT NULL DEFAULT 'VERIFIED' CHECK (data_quality_flag IN ('VERIFIED', 'DATA_REVIEW_REQUIRED', 'ESTIMATED')),
  data_quality_notes TEXT,
  source TEXT NOT NULL DEFAULT 'historical_import',
  source_document TEXT NOT NULL DEFAULT 'church_financial_report_2569_jan_jul',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  import_batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  is_immutable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_historical_monthly UNIQUE (church_id, fiscal_year, month, source_document)
);

CREATE INDEX IF NOT EXISTS idx_hist_monthly_church_year ON historical_monthly_summaries(church_id, fiscal_year, month);

-- ------------------------------------------------------------------------------
-- 2. HISTORICAL WEEKLY SUMMARIES TABLE
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS historical_weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  fiscal_year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  week_date DATE NOT NULL,
  income_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  cash_income NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  online_income NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  expense_total NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  net NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  source TEXT NOT NULL DEFAULT 'historical_import',
  source_document TEXT NOT NULL DEFAULT 'church_financial_report_2569_jan_jul',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  import_batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  is_immutable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_historical_weekly UNIQUE (church_id, fiscal_year, week_date, source_document)
);

CREATE INDEX IF NOT EXISTS idx_hist_weekly_church_date ON historical_weekly_summaries(church_id, fiscal_year, week_date);

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE historical_monthly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_weekly_summaries ENABLE ROW LEVEL SECURITY;

-- Read policy: authenticated members can view historical data of their church
DO $$ BEGIN
  CREATE POLICY "historical_monthly_read_church_members" ON historical_monthly_summaries
    FOR SELECT USING (
      church_id IN (SELECT church_id FROM profiles WHERE id = auth.uid())
      OR auth.role() = 'service_role'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "historical_weekly_read_church_members" ON historical_weekly_summaries
    FOR SELECT USING (
      church_id IN (SELECT church_id FROM profiles WHERE id = auth.uid())
      OR auth.role() = 'service_role'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 4. SEED HISTORICAL DATA FOR ALL EXISTING CHURCHES
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  c RECORD;
  batch_id UUID;
BEGIN
  FOR c IN SELECT id FROM churches LOOP
    batch_id := gen_random_uuid();

    -- 4.1 Insert Monthly Summaries (Jan - Jul 2569)
    -- Month 1: มกราคม
    INSERT INTO historical_monthly_summaries (
      church_id, fiscal_year, month, month_name, status, data_through,
      income_total, cash_income, online_income, expense_total, net,
      opening_balance_reported, closing_balance_reported,
      data_quality_flag, data_quality_notes, source, source_document, import_batch_id
    ) VALUES (
      c.id, 2569, 1, 'มกราคม', 'historical', '2026-01-31',
      17180.00, 7930.00, 9250.00, 7814.00, 9366.00,
      NULL, NULL,
      'VERIFIED', 'Verified against primary report', 'historical_import', 'church_financial_report_2569_jan_jul', batch_id
    ) ON CONFLICT (church_id, fiscal_year, month, source_document) DO NOTHING;

    -- Month 2: กุมภาพันธ์
    INSERT INTO historical_monthly_summaries (
      church_id, fiscal_year, month, month_name, status, data_through,
      income_total, cash_income, online_income, expense_total, net,
      opening_balance_reported, closing_balance_reported,
      data_quality_flag, data_quality_notes, source, source_document, import_batch_id
    ) VALUES (
      c.id, 2569, 2, 'กุมภาพันธ์', 'historical', '2026-02-28',
      16672.00, 6472.00, 10200.00, 11367.00, 5305.00,
      9366.00, 14671.00,
      'VERIFIED', 'Verified against primary report', 'historical_import', 'church_financial_report_2569_jan_jul', batch_id
    ) ON CONFLICT (church_id, fiscal_year, month, source_document) DO NOTHING;

    -- Month 3: มีนาคม (Preserve discrepancy & flag)
    INSERT INTO historical_monthly_summaries (
      church_id, fiscal_year, month, month_name, status, data_through,
      income_total, cash_income, online_income, expense_total, net,
      opening_balance_reported, closing_balance_reported,
      data_quality_flag, data_quality_notes, source, source_document, import_batch_id
    ) VALUES (
      c.id, 2569, 3, 'มีนาคม', 'historical', '2026-03-31',
      27130.00, 12280.00, 14850.00, 24816.00, 2314.00,
      NULL, 2314.00,
      'DATA_REVIEW_REQUIRED', 'March 2569 opening/closing balance basis differs from February cumulative balance. Reported closing is 2314.00 vs expected cumulative 16985.00.',
      'historical_import', 'church_financial_report_2569_jan_jul', batch_id
    ) ON CONFLICT (church_id, fiscal_year, month, source_document) DO NOTHING;

    -- Month 4: เมษายน
    INSERT INTO historical_monthly_summaries (
      church_id, fiscal_year, month, month_name, status, data_through,
      income_total, cash_income, online_income, expense_total, net,
      opening_balance_reported, closing_balance_reported,
      data_quality_flag, data_quality_notes, source, source_document, import_batch_id
    ) VALUES (
      c.id, 2569, 4, 'เมษายน', 'historical', '2026-04-30',
      45305.00, 26355.00, 18950.00, 45134.00, 171.00,
      2314.00, 2485.00,
      'VERIFIED', 'Verified against primary report', 'historical_import', 'church_financial_report_2569_jan_jul', batch_id
    ) ON CONFLICT (church_id, fiscal_year, month, source_document) DO NOTHING;

    -- Month 5: พฤษภาคม
    INSERT INTO historical_monthly_summaries (
      church_id, fiscal_year, month, month_name, status, data_through,
      income_total, cash_income, online_income, expense_total, net,
      opening_balance_reported, closing_balance_reported,
      data_quality_flag, data_quality_notes, source, source_document, import_batch_id
    ) VALUES (
      c.id, 2569, 5, 'พฤษภาคม', 'historical', '2026-05-31',
      19531.00, 6131.00, 13400.00, 28066.00, -8535.00,
      2485.00, -6050.00,
      'VERIFIED', 'Verified against primary report', 'historical_import', 'church_financial_report_2569_jan_jul', batch_id
    ) ON CONFLICT (church_id, fiscal_year, month, source_document) DO NOTHING;

    -- Month 6: มิถุนายน
    INSERT INTO historical_monthly_summaries (
      church_id, fiscal_year, month, month_name, status, data_through,
      income_total, cash_income, online_income, expense_total, net,
      opening_balance_reported, closing_balance_reported,
      data_quality_flag, data_quality_notes, source, source_document, import_batch_id
    ) VALUES (
      c.id, 2569, 6, 'มิถุนายน', 'historical', '2026-06-30',
      14120.00, 4470.00, 9650.00, 23177.00, -9057.00,
      -6050.00, -15107.00,
      'VERIFIED', 'Verified against primary report', 'historical_import', 'church_financial_report_2569_jan_jul', batch_id
    ) ON CONFLICT (church_id, fiscal_year, month, source_document) DO NOTHING;

    -- Month 7: กรกฎาคม (Partial data through 2026-07-19)
    INSERT INTO historical_monthly_summaries (
      church_id, fiscal_year, month, month_name, status, data_through,
      income_total, cash_income, online_income, expense_total, net,
      opening_balance_reported, closing_balance_reported,
      data_quality_flag, data_quality_notes, source, source_document, import_batch_id
    ) VALUES (
      c.id, 2569, 7, 'กรกฎาคม', 'historical_partial', '2026-07-19',
      13345.00, 5145.00, 8200.00, 5791.00, 7554.00,
      -15107.00, -7553.00,
      'VERIFIED', 'Partial month data through 2026-07-19', 'historical_import', 'church_financial_report_2569_jan_jul', batch_id
    ) ON CONFLICT (church_id, fiscal_year, month, source_document) DO NOTHING;

    -- 4.2 Insert Weekly Summaries (29 entries across Jan - Jul 2569)
    -- January 2569
    INSERT INTO historical_weekly_summaries (church_id, fiscal_year, month, week_date, income_total, cash_income, online_income, expense_total, net, import_batch_id)
    VALUES
      (c.id, 2569, 1, '2026-01-04', 4730.00, 1930.00, 2800.00, 1536.00, 3194.00, batch_id),
      (c.id, 2569, 1, '2026-01-11', 4160.00, 1960.00, 2200.00, 2587.00, 1573.00, batch_id),
      (c.id, 2569, 1, '2026-01-18', 3540.00, 1190.00, 2350.00, 0.00, 3540.00, batch_id),
      (c.id, 2569, 1, '2026-01-25', 4750.00, 2850.00, 1900.00, 3691.00, 1059.00, batch_id)
    ON CONFLICT (church_id, fiscal_year, week_date, source_document) DO NOTHING;

    -- February 2569
    INSERT INTO historical_weekly_summaries (church_id, fiscal_year, month, week_date, income_total, cash_income, online_income, expense_total, net, import_batch_id)
    VALUES
      (c.id, 2569, 2, '2026-02-01', 3290.00, 990.00, 2300.00, 4710.00, -1420.00, batch_id),
      (c.id, 2569, 2, '2026-02-08', 3460.00, 960.00, 2500.00, 1615.00, 1845.00, batch_id),
      (c.id, 2569, 2, '2026-02-15', 5722.00, 2922.00, 2800.00, 2873.00, 2849.00, batch_id),
      (c.id, 2569, 2, '2026-02-22', 4200.00, 1600.00, 2600.00, 2169.00, 2031.00, batch_id)
    ON CONFLICT (church_id, fiscal_year, week_date, source_document) DO NOTHING;

    -- March 2569
    INSERT INTO historical_weekly_summaries (church_id, fiscal_year, month, week_date, income_total, cash_income, online_income, expense_total, net, import_batch_id)
    VALUES
      (c.id, 2569, 3, '2026-03-01', 5242.00, 1642.00, 3600.00, 14797.00, -9555.00, batch_id),
      (c.id, 2569, 3, '2026-03-08', 5930.00, 3430.00, 2500.00, 1712.00, 4218.00, batch_id),
      (c.id, 2569, 3, '2026-03-15', 4170.00, 1070.00, 3100.00, 2620.00, 1550.00, batch_id),
      (c.id, 2569, 3, '2026-03-22', 7390.00, 4490.00, 2900.00, 3170.00, 4220.00, batch_id),
      (c.id, 2569, 3, '2026-03-29', 4398.00, 1648.00, 2750.00, 2517.00, 1881.00, batch_id)
    ON CONFLICT (church_id, fiscal_year, week_date, source_document) DO NOTHING;

    -- April 2569
    INSERT INTO historical_weekly_summaries (church_id, fiscal_year, month, week_date, income_total, cash_income, online_income, expense_total, net, import_batch_id)
    VALUES
      (c.id, 2569, 4, '2026-04-05', 23920.00, 21020.00, 2900.00, 15951.00, 7969.00, batch_id),
      (c.id, 2569, 4, '2026-04-12', 4385.00, 1085.00, 3300.00, 8206.00, -3821.00, batch_id),
      (c.id, 2569, 4, '2026-04-19', 4640.00, 1390.00, 3250.00, 13625.00, -8985.00, batch_id),
      (c.id, 2569, 4, '2026-04-26', 12360.00, 2860.00, 9500.00, 7352.00, 5008.00, batch_id)
    ON CONFLICT (church_id, fiscal_year, week_date, source_document) DO NOTHING;

    -- May 2569
    INSERT INTO historical_weekly_summaries (church_id, fiscal_year, month, week_date, income_total, cash_income, online_income, expense_total, net, import_batch_id)
    VALUES
      (c.id, 2569, 5, '2026-05-03', 2605.00, 1055.00, 1550.00, 9740.00, -7135.00, batch_id),
      (c.id, 2569, 5, '2026-05-10', 5041.00, 1141.00, 3900.00, 2087.00, 2954.00, batch_id),
      (c.id, 2569, 5, '2026-05-17', 2250.00, 650.00, 1600.00, 1635.00, 615.00, batch_id),
      (c.id, 2569, 5, '2026-05-24', 3745.00, 2345.00, 1400.00, 14604.00, -10859.00, batch_id),
      (c.id, 2569, 5, '2026-05-31', 5890.00, 940.00, 4950.00, 0.00, 5890.00, batch_id)
    ON CONFLICT (church_id, fiscal_year, week_date, source_document) DO NOTHING;

    -- June 2569
    INSERT INTO historical_weekly_summaries (church_id, fiscal_year, month, week_date, income_total, cash_income, online_income, expense_total, net, import_batch_id)
    VALUES
      (c.id, 2569, 6, '2026-06-07', 2110.00, 610.00, 1500.00, 2060.00, 50.00, batch_id),
      (c.id, 2569, 6, '2026-06-14', 3070.00, 1020.00, 2050.00, 2250.00, 820.00, batch_id),
      (c.id, 2569, 6, '2026-06-21', 3230.00, 1930.00, 1300.00, 3590.00, -360.00, batch_id),
      (c.id, 2569, 6, '2026-06-28', 5710.00, 910.00, 4800.00, 15277.00, -9567.00, batch_id)
    ON CONFLICT (church_id, fiscal_year, week_date, source_document) DO NOTHING;

    -- July 2569 (Partial: 3 Sundays)
    INSERT INTO historical_weekly_summaries (church_id, fiscal_year, month, week_date, income_total, cash_income, online_income, expense_total, net, import_batch_id)
    VALUES
      (c.id, 2569, 7, '2026-07-05', 3719.00, 2219.00, 1500.00, 2156.00, 1563.00, batch_id),
      (c.id, 2569, 7, '2026-07-12', 6515.00, 1715.00, 4800.00, 2225.00, 4290.00, batch_id),
      (c.id, 2569, 7, '2026-07-19', 3111.00, 1211.00, 1900.00, 1410.00, 1701.00, batch_id)
    ON CONFLICT (church_id, fiscal_year, week_date, source_document) DO NOTHING;

    -- 4.3 Audit Log for Data Provenance
    INSERT INTO audit_logs (
      church_id, category, action, entity_type, metadata
    ) VALUES (
      c.id,
      'DATA_CHANGE',
      'HISTORICAL_FINANCIAL_IMPORT',
      'historical_import',
      jsonb_build_object(
        'import_type', 'historical',
        'source_document', 'church_financial_report_2569_jan_jul',
        'fiscal_year', 2569,
        'periods_imported', '2026-01 to 2026-07-19',
        'monthly_records_count', 7,
        'weekly_records_count', 29,
        'grand_totals', jsonb_build_object(
          'income', 153283.00,
          'expense', 146165.00,
          'net', 7118.00,
          'cash_income', 68783.00,
          'online_income', 84500.00
        ),
        'batch_id', batch_id
      )
    );

  END LOOP;
END $$;
