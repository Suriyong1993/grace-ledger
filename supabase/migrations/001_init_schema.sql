-- Grace Ledger v2 — Supabase Migration
-- Run in Supabase SQL Editor or via `supabase db push`
-- Generated from Drizzle schema (src/db/schema.ts)

-- ============================================================================
-- Enums
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
    CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'income', 'expense');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'normal_balance') THEN
    CREATE TYPE normal_balance AS ENUM ('debit', 'credit');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entry_type') THEN
    CREATE TYPE entry_type AS ENUM ('offering', 'expense', 'income', 'transfer', 'opening', 'adjustment', 'void', 'closing');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entry_status') THEN
    CREATE TYPE entry_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'voided');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'line_type') THEN
    CREATE TYPE line_type AS ENUM ('debit', 'credit');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('super_admin', 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'period_status') THEN
    CREATE TYPE period_status AS ENUM ('open', 'closed', 'reconciled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'count_sheet_status') THEN
    CREATE TYPE count_sheet_status AS ENUM ('counting', 'discrepancy', 'in_review', 'reconciled', 'locked');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_period_type') THEN
    CREATE TYPE budget_period_type AS ENUM ('annual', 'monthly', 'department', 'project');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_status') THEN
    CREATE TYPE budget_status AS ENUM ('draft', 'pending', 'approved', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
    CREATE TYPE project_status AS ENUM ('planning', 'active', 'paused', 'completed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_status') THEN
    CREATE TYPE member_status AS ENUM ('active', 'inactive');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_channel') THEN
    CREATE TYPE payment_channel AS ENUM ('cash', 'bank', 'qr');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_status') THEN
    CREATE TYPE tx_status AS ENUM ('draft', 'pending', 'approved', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'category_kind') THEN
    CREATE TYPE category_kind AS ENUM ('income', 'expense');
  END IF;
END $$;

-- ============================================================================
-- Churches (tenant isolation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  tax_id VARCHAR(20),
  fiscal_year_start INTEGER NOT NULL DEFAULT 1,
  currency VARCHAR(3) NOT NULL DEFAULT 'THB',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

-- ============================================================================
-- Users & Auth (supabase auth.users is the source of truth for auth)
-- ============================================================================

-- We store church-specific user data here, linked to auth.users via email
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role user_role NOT NULL DEFAULT 'admin',
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  mfa_secret VARCHAR(64),
  avatar_color VARCHAR(7),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  token_version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_church_name ON users(church_id, name) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

-- Session tracking
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- ============================================================================
-- Chart of Accounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  account_code VARCHAR(20) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_type account_type NOT NULL,
  parent_id UUID REFERENCES chart_of_accounts(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_contra BOOLEAN NOT NULL DEFAULT false,
  normal_balance normal_balance NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  tfrs_code VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,

  UNIQUE(church_id, account_code)
);

CREATE INDEX IF NOT EXISTS idx_coa_church_active ON chart_of_accounts(church_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_coa_account_type ON chart_of_accounts(church_id, account_type);
CREATE INDEX IF NOT EXISTS idx_coa_parent ON chart_of_accounts(church_id, parent_id);

-- ============================================================================
-- Funds
-- ============================================================================

CREATE TABLE IF NOT EXISTS funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  fund_code VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_restricted BOOLEAN NOT NULL DEFAULT false,
  opening_balance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  current_balance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,

  UNIQUE(church_id, fund_code)
);

CREATE INDEX IF NOT EXISTS idx_funds_church_active ON funds(church_id, is_active) WHERE is_active = true;

-- ============================================================================
-- Fiscal Periods
-- ============================================================================

CREATE TABLE IF NOT EXISTS fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  period_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status period_status NOT NULL DEFAULT 'open',
  closed_by UUID REFERENCES users(id),
  closed_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES users(id),
  reopened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,

  UNIQUE(church_id, fiscal_year, period_number),
  CHECK (period_number BETWEEN 1 AND 12),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_fp_status ON fiscal_periods(church_id, status);

-- ============================================================================
-- Journal Entries (CF-2: dual approval, MF-15: numbers at approval)
-- ============================================================================

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  entry_number VARCHAR(30),
  entry_type entry_type NOT NULL,
  posting_date DATE NOT NULL,
  description TEXT,
  status entry_status NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES users(id),
  approval_1_id UUID REFERENCES users(id),
  approval_2_id UUID REFERENCES users(id),
  rejection_reason TEXT,
  void_parent_id UUID REFERENCES journal_entries(id),
  fund_id UUID NOT NULL REFERENCES funds(id),
  reference_document VARCHAR(255),
  total_debit DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  total_credit DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  fiscal_year INTEGER NOT NULL,
  fiscal_period INTEGER NOT NULL,
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  posted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (total_debit = total_credit),
  CHECK (total_debit > 0 AND total_credit > 0),
  CHECK (approval_1_id IS NULL OR approval_1_id <> created_by),
  CHECK (approval_2_id IS NULL OR approval_1_id IS NULL OR approval_1_id <> approval_2_id),
  CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL),
  CHECK (status <> 'approved' OR approval_1_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_je_posting_date ON journal_entries(church_id, posting_date);
CREATE INDEX IF NOT EXISTS idx_je_status ON journal_entries(church_id, status);
CREATE INDEX IF NOT EXISTS idx_je_fund ON journal_entries(church_id, fund_id);
CREATE INDEX IF NOT EXISTS idx_je_church_fiscal ON journal_entries(church_id, fiscal_year, fiscal_period);
CREATE INDEX IF NOT EXISTS idx_je_entry_type ON journal_entries(church_id, entry_type);
CREATE INDEX IF NOT EXISTS idx_je_approval_1 ON journal_entries(church_id, approval_1_id, posting_date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_je_entry_number ON journal_entries(church_id, entry_number) WHERE entry_number IS NOT NULL;

-- ============================================================================
-- Journal Entry Lines
-- ============================================================================

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  line_type line_type NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  fund_id UUID NOT NULL REFERENCES funds(id),
  member_id UUID,
  department_id UUID,
  project_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_jel_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines(church_id, account_id);
CREATE INDEX IF NOT EXISTS idx_jel_fund ON journal_entry_lines(church_id, fund_id);

-- ============================================================================
-- General Ledger (partitioned by fiscal_year)
-- ============================================================================

CREATE TABLE IF NOT EXISTS general_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  posting_date DATE NOT NULL,
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id),
  journal_line_id UUID NOT NULL REFERENCES journal_entry_lines(id),
  fund_id UUID NOT NULL REFERENCES funds(id),
  debit_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  credit_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  running_balance DECIMAL(18,2) NOT NULL,
  fiscal_year INTEGER NOT NULL,
  fiscal_period INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gl_journal_line ON general_ledger(journal_line_id);
CREATE INDEX IF NOT EXISTS idx_gl_church_account_date ON general_ledger(church_id, account_id, posting_date);
CREATE INDEX IF NOT EXISTS idx_gl_church_fund_date ON general_ledger(church_id, fund_id, posting_date);
CREATE INDEX IF NOT EXISTS idx_gl_entry ON general_ledger(journal_entry_id);

-- ============================================================================
-- Offering Count Sheets (mF-4: DISCREPANCY state)
-- ============================================================================

CREATE TABLE IF NOT EXISTS offering_count_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  counter_1_id UUID NOT NULL REFERENCES users(id),
  counter_1_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  counter_2_id UUID NOT NULL REFERENCES users(id),
  counter_2_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  counter_3_id UUID REFERENCES users(id),
  counter_3_amount DECIMAL(18,2),
  reconciled_amount DECIMAL(18,2),
  status count_sheet_status NOT NULL DEFAULT 'counting',
  locked_by UUID REFERENCES users(id),
  locked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,

  CHECK (counter_1_id <> counter_2_id),
  CHECK (counter_1_id <> counter_3_id OR counter_3_id IS NULL),
  CHECK (counter_2_id <> counter_3_id OR counter_3_id IS NULL),
  CHECK (counter_1_amount >= 0 AND counter_2_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ocs_church_date ON offering_count_sheets(church_id, date);
CREATE INDEX IF NOT EXISTS idx_ocs_status ON offering_count_sheets(church_id, status);

-- ============================================================================
-- Offering Categories
-- ============================================================================

CREATE TABLE IF NOT EXISTS offering_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7),
  icon VARCHAR(50),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_oc_active ON offering_categories(church_id, is_active) WHERE is_active = true;

-- ============================================================================
-- Offering Subcategories
-- ============================================================================

CREATE TABLE IF NOT EXISTS offering_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES offering_categories(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

-- ============================================================================
-- Offerings (transactions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category_id UUID NOT NULL REFERENCES offering_categories(id),
  subcategory_id UUID REFERENCES offering_subcategories(id),
  channel payment_channel NOT NULL DEFAULT 'cash',
  amount DECIMAL(18,2) NOT NULL,
  member_id UUID,
  fund_id UUID NOT NULL REFERENCES funds(id),
  note TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offering_church_date ON offerings(church_id, date);
CREATE INDEX IF NOT EXISTS idx_offering_category ON offerings(church_id, category_id);
CREATE INDEX IF NOT EXISTS idx_offering_fund ON offerings(church_id, fund_id);

-- ============================================================================
-- Incomes
-- ============================================================================

CREATE TABLE IF NOT EXISTS incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category_id VARCHAR(20) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  fund_id UUID NOT NULL REFERENCES funds(id),
  description TEXT,
  attachment_name VARCHAR(255),
  attachment_data_url TEXT,
  attachment_type VARCHAR(100),
  attachment_size INTEGER,
  created_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  status tx_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_income_church_date ON incomes(church_id, date);
CREATE INDEX IF NOT EXISTS idx_income_status ON incomes(church_id, status);

-- ============================================================================
-- Expenses
-- ============================================================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category_id VARCHAR(20) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  fund_id UUID NOT NULL REFERENCES funds(id),
  vendor VARCHAR(120),
  description TEXT,
  attachment_name VARCHAR(255),
  attachment_data_url TEXT,
  attachment_type VARCHAR(100),
  attachment_size INTEGER,
  created_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  status tx_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_church_date ON expenses(church_id, date);
CREATE INDEX IF NOT EXISTS idx_expense_status ON expenses(church_id, status);

-- ============================================================================
-- Budgets
-- ============================================================================

CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  period_type budget_period_type NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER CHECK (month BETWEEN 1 AND 12),
  department VARCHAR(100),
  project_id UUID,
  amount DECIMAL(18,2) NOT NULL,
  used DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Members
-- ============================================================================

CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  family VARCHAR(255),
  department VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  status member_status NOT NULL DEFAULT 'active',
  joined_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_church ON members(church_id);

-- ============================================================================
-- Projects
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  budget DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  used DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  progress INTEGER NOT NULL DEFAULT 0,
  owner_id UUID REFERENCES users(id),
  start_date DATE,
  end_date DATE,
  status project_status NOT NULL DEFAULT 'planning',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Audit Log (server-side, immutable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  user_name VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id VARCHAR(50),
  details TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_church ON audit_log(church_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(church_id, entity, entity_id);

-- ============================================================================
-- Settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS church_settings (
  church_id UUID PRIMARY KEY REFERENCES churches(id) ON DELETE CASCADE,
  church_name VARCHAR(255),
  address TEXT,
  tax_id VARCHAR(20),
  fiscal_year_start INTEGER NOT NULL DEFAULT 1,
  idle_timeout_min INTEGER NOT NULL DEFAULT 15,
  currency VARCHAR(3) NOT NULL DEFAULT 'THB',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Row Level Security Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE general_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE offering_count_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE offering_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE offering_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's church_id
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
DROP TRIGGER IF EXISTS trg_churches_updated_at ON churches;
CREATE TRIGGER trg_churches_updated_at BEFORE UPDATE ON churches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_coa_updated_at ON chart_of_accounts;
CREATE TRIGGER trg_coa_updated_at BEFORE UPDATE ON chart_of_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_funds_updated_at ON funds;
CREATE TRIGGER trg_funds_updated_at BEFORE UPDATE ON funds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_fp_updated_at ON fiscal_periods;
CREATE TRIGGER trg_fp_updated_at BEFORE UPDATE ON fiscal_periods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_je_updated_at ON journal_entries;
CREATE TRIGGER trg_je_updated_at BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_ocs_updated_at ON offering_count_sheets;
CREATE TRIGGER trg_ocs_updated_at BEFORE UPDATE ON offering_count_sheets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_oc_updated_at ON offering_categories;
CREATE TRIGGER trg_oc_updated_at BEFORE UPDATE ON offering_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_settings_updated_at ON church_settings;
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON church_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- User Login List View (for PIN-based login screen)
-- Joins users table with auth.users to expose email for Supabase Auth
-- ============================================================================

CREATE OR REPLACE VIEW user_login_list AS
SELECT
  u.id,
  u.name,
  u.role,
  au.email
FROM users u
JOIN auth.users au ON au.id = u.auth_user_id
WHERE u.is_active = true
ORDER BY u.name;