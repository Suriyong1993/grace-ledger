-- 004_categories_funds_sort_rls.sql
-- Fixes verified schema mismatches between frontend (src/services/church.ts) and DB:
--   1. `categories` table was never created (001 created the category_kind enum and
--      incomes/expenses.category_id VARCHAR(20) columns, but omitted the table itself)
--      → GET /rest/v1/categories returned 404.
--   2. `funds.sort_order` missing → listFunds() orders by sort_order → 400.
--   3. RLS enabled on all tables in 001, but several tables have ZERO policies
--      (deny-all) and no table except journal_entries has write policies
--      → reads return empty, all UI writes rejected.
-- All statements are idempotent (safe to re-run). Additive only — no drops of
-- existing tables/columns/data.

-- ============================================================================
-- 1. Categories (income/expense transaction categories)
-- ============================================================================

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(20) NOT NULL,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  kind category_kind NOT NULL,
  icon VARCHAR(50),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,

  PRIMARY KEY (church_id, id)
);

CREATE INDEX IF NOT EXISTS idx_categories_church_kind ON categories(church_id, kind);

-- updated_at trigger (same function as other tables)
DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Referential integrity for existing VARCHAR(20) category codes.
-- Safe: incomes and expenses are empty at time of migration.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_incomes_category') THEN
    ALTER TABLE incomes
      ADD CONSTRAINT fk_incomes_category
      FOREIGN KEY (church_id, category_id) REFERENCES categories(church_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_expenses_category') THEN
    ALTER TABLE expenses
      ADD CONSTRAINT fk_expenses_category
      FOREIGN KEY (church_id, category_id) REFERENCES categories(church_id, id);
  END IF;
END $$;

-- Seed default categories (same codes/names as the original mock-db seed that
-- incomes/expenses.category_id was designed around) for every church.
INSERT INTO categories (church_id, id, name, kind, sort_order)
SELECT ch.id, v.code, v.name, v.kind::category_kind, v.ord
FROM churches ch
CROSS JOIN (VALUES
  ('c-off',   'เงินถวาย',        'income',  1),
  ('c-dnt',   'เงินบริจาค',      'income',  2),
  ('c-int',   'ดอกเบี้ย',        'income',  3),
  ('c-oth-i', 'รายรับอื่น ๆ',    'income',  4),
  ('c-util',  'ค่าสาธารณูปโภค',  'expense', 5),
  ('c-sal',   'เงินเดือน',       'expense', 6),
  ('c-mis',   'งานพันธกิจ',      'expense', 7),
  ('c-mnt',   'ซ่อมบำรุง',       'expense', 8),
  ('c-oth-e', 'รายจ่ายอื่น ๆ',   'expense', 9)
) AS v(code, name, kind, ord)
ON CONFLICT (church_id, id) DO NOTHING;

-- ============================================================================
-- 2. Funds: display ordering used by listFunds()
-- ============================================================================

ALTER TABLE funds ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_funds_church_sort ON funds(church_id, sort_order);

-- ============================================================================
-- 3. RLS policies — church-scoped via existing get_current_user_church_id()
--    Only covers operations the frontend actually performs.
-- ============================================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Categories: read-only from the app
DROP POLICY IF EXISTS categories_read ON categories;
CREATE POLICY categories_read ON categories
  FOR SELECT USING (church_id = get_current_user_church_id());

-- Incomes: create / approve / delete
DROP POLICY IF EXISTS income_insert ON incomes;
CREATE POLICY income_insert ON incomes
  FOR INSERT WITH CHECK (church_id = get_current_user_church_id());
DROP POLICY IF EXISTS income_update ON incomes;
CREATE POLICY income_update ON incomes
  FOR UPDATE USING (church_id = get_current_user_church_id())
  WITH CHECK (church_id = get_current_user_church_id());
DROP POLICY IF EXISTS income_delete ON incomes;
CREATE POLICY income_delete ON incomes
  FOR DELETE USING (church_id = get_current_user_church_id());

-- Expenses: create / set status / delete
DROP POLICY IF EXISTS expense_insert ON expenses;
CREATE POLICY expense_insert ON expenses
  FOR INSERT WITH CHECK (church_id = get_current_user_church_id());
DROP POLICY IF EXISTS expense_update ON expenses;
CREATE POLICY expense_update ON expenses
  FOR UPDATE USING (church_id = get_current_user_church_id())
  WITH CHECK (church_id = get_current_user_church_id());
DROP POLICY IF EXISTS expense_delete ON expenses;
CREATE POLICY expense_delete ON expenses
  FOR DELETE USING (church_id = get_current_user_church_id());

-- Offerings: create / delete
DROP POLICY IF EXISTS offering_insert ON offerings;
CREATE POLICY offering_insert ON offerings
  FOR INSERT WITH CHECK (church_id = get_current_user_church_id());
DROP POLICY IF EXISTS offering_delete ON offerings;
CREATE POLICY offering_delete ON offerings
  FOR DELETE USING (church_id = get_current_user_church_id());

-- Funds: createFund()
DROP POLICY IF EXISTS funds_insert ON funds;
CREATE POLICY funds_insert ON funds
  FOR INSERT WITH CHECK (church_id = get_current_user_church_id());

-- Offering categories & subcategories: fully managed from Settings page
DROP POLICY IF EXISTS oc_read ON offering_categories;
CREATE POLICY oc_read ON offering_categories
  FOR SELECT USING (church_id = get_current_user_church_id());
DROP POLICY IF EXISTS oc_insert ON offering_categories;
CREATE POLICY oc_insert ON offering_categories
  FOR INSERT WITH CHECK (church_id = get_current_user_church_id());
DROP POLICY IF EXISTS oc_update ON offering_categories;
CREATE POLICY oc_update ON offering_categories
  FOR UPDATE USING (church_id = get_current_user_church_id())
  WITH CHECK (church_id = get_current_user_church_id());
DROP POLICY IF EXISTS oc_delete ON offering_categories;
CREATE POLICY oc_delete ON offering_categories
  FOR DELETE USING (church_id = get_current_user_church_id());

DROP POLICY IF EXISTS osc_read ON offering_subcategories;
CREATE POLICY osc_read ON offering_subcategories
  FOR SELECT USING (church_id = get_current_user_church_id());
DROP POLICY IF EXISTS osc_insert ON offering_subcategories;
CREATE POLICY osc_insert ON offering_subcategories
  FOR INSERT WITH CHECK (church_id = get_current_user_church_id());
DROP POLICY IF EXISTS osc_update ON offering_subcategories;
CREATE POLICY osc_update ON offering_subcategories
  FOR UPDATE USING (church_id = get_current_user_church_id())
  WITH CHECK (church_id = get_current_user_church_id());
DROP POLICY IF EXISTS osc_delete ON offering_subcategories;
CREATE POLICY osc_delete ON offering_subcategories
  FOR DELETE USING (church_id = get_current_user_church_id());

-- Budgets: read-only from the app
DROP POLICY IF EXISTS budgets_read ON budgets;
CREATE POLICY budgets_read ON budgets
  FOR SELECT USING (church_id = get_current_user_church_id());

-- Members: list + create
DROP POLICY IF EXISTS members_read ON members;
CREATE POLICY members_read ON members
  FOR SELECT USING (church_id = get_current_user_church_id());
DROP POLICY IF EXISTS members_insert ON members;
CREATE POLICY members_insert ON members
  FOR INSERT WITH CHECK (church_id = get_current_user_church_id());

-- Projects: list + create
DROP POLICY IF EXISTS projects_read ON projects;
CREATE POLICY projects_read ON projects
  FOR SELECT USING (church_id = get_current_user_church_id());
DROP POLICY IF EXISTS projects_insert ON projects;
CREATE POLICY projects_insert ON projects
  FOR INSERT WITH CHECK (church_id = get_current_user_church_id());

-- Church settings: get + upsert (insert-or-update)
DROP POLICY IF EXISTS settings_read ON church_settings;
CREATE POLICY settings_read ON church_settings
  FOR SELECT USING (church_id = get_current_user_church_id());
DROP POLICY IF EXISTS settings_insert ON church_settings;
CREATE POLICY settings_insert ON church_settings
  FOR INSERT WITH CHECK (church_id = get_current_user_church_id());
DROP POLICY IF EXISTS settings_update ON church_settings;
CREATE POLICY settings_update ON church_settings
  FOR UPDATE USING (church_id = get_current_user_church_id())
  WITH CHECK (church_id = get_current_user_church_id());

-- Audit log: append-only from the app (reads already covered by audit_read)
DROP POLICY IF EXISTS audit_insert ON audit_log;
CREATE POLICY audit_insert ON audit_log
  FOR INSERT WITH CHECK (church_id = get_current_user_church_id());

-- ============================================================================
-- 4. Ask PostgREST to reload its schema cache so new table/column are visible
-- ============================================================================

NOTIFY pgrst, 'reload schema';
