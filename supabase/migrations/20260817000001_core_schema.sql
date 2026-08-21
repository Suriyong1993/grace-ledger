-- ==============================================================================
-- Grace Ledger — Migration 001: Core Database Schema & Constraints
-- Author: Principal Engineer
-- Target: PostgreSQL 16 / Supabase
-- Invariants Enforced:
--   1. Strict NUMERIC(14,2) for all financial quantities (No floating point)
--   2. fund_id NOT NULL on all transaction_splits (Fund Accounting Invariant)
--   3. Foreign Key referential integrity with ON DELETE RESTRICT on ledger records
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. ENUMS
-- ------------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE user_role_enum AS ENUM (
    'super_admin',
    'pastor',
    'treasurer',
    'finance_staff',
    'approver',
    'counter',
    'member'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE account_type_enum AS ENUM (
    'bank',
    'cash_drawer',
    'petty_cash',
    'electronic_wallet'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_direction_enum AS ENUM (
    'income',
    'expense',
    'transfer'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status_enum AS ENUM (
    'draft',
    'pending_approval',
    'posted',
    'rejected',
    'voided'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transfer_status_enum AS ENUM (
    'pending',
    'completed',
    'rejected',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE offering_session_status_enum AS ENUM (
    'draft',
    'counting',
    'variance_review',
    'confirmed',
    'posted',
    'voided'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE audit_category_enum AS ENUM (
    'DATA_CHANGE',
    'ACCESS',
    'SECURITY',
    'APPROVAL',
    'FINANCIAL'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 2. TENANT & USER TABLES
-- ------------------------------------------------------------------------------

-- Churches: Multi-tenant anchor
CREATE TABLE IF NOT EXISTS churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'THB',
  tax_id TEXT,
  address TEXT,
  phone TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles: Connected 1:1 to auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY, -- references auth.users(id) in Supabase
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_church_id ON profiles(church_id);

-- User Roles: RBAC assignments
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  role user_role_enum NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT uq_user_church_role UNIQUE (user_id, church_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_lookup ON user_roles(user_id, church_id, role);

-- ------------------------------------------------------------------------------
-- 3. FINANCIAL MASTER DATA (Accounts, Funds, Categories)
-- ------------------------------------------------------------------------------

-- Accounts: Custody accounts (Bank accounts, cash drawers)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  type account_type_enum NOT NULL DEFAULT 'bank',
  account_number TEXT,
  bank_name TEXT,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_account_name_non_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_accounts_church_id ON accounts(church_id);

-- Funds: Church fund envelopes (General, Building, Mission, Youth)
-- "Every single Baht belongs to exactly one designated fund at all times"
CREATE TABLE IF NOT EXISTS funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  target_amount NUMERIC(14,2),
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_fund_name_non_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT chk_fund_target_positive CHECK (target_amount IS NULL OR target_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_funds_church_id ON funds(church_id);

-- Categories: Income and expense classification
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  direction transaction_direction_enum NOT NULL,
  default_fund_id UUID REFERENCES funds(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_category_name_non_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_categories_church_id ON categories(church_id);

-- ------------------------------------------------------------------------------
-- 4. FINANCIAL LEDGER (Transactions, Splits, Transfers)
-- ------------------------------------------------------------------------------

-- Transactions: Transaction Header
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL,
  direction transaction_direction_enum NOT NULL,
  status transaction_status_enum NOT NULL DEFAULT 'draft',
  description TEXT NOT NULL,
  reference_number TEXT,
  posted_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  is_reversal BOOLEAN NOT NULL DEFAULT false,
  reversal_of_id UUID REFERENCES transactions(id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_transaction_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_transaction_desc_non_empty CHECK (length(trim(description)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_transactions_church_status ON transactions(church_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_posted_at ON transactions(church_id, posted_at);
CREATE INDEX IF NOT EXISTS idx_transactions_reversal ON transactions(reversal_of_id);

-- Transaction Splits: Canonical Fund-Level Ledger Entries
CREATE TABLE IF NOT EXISTS transaction_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_split_fund_not_null CHECK (fund_id IS NOT NULL),
  CONSTRAINT chk_split_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_splits_txn_id ON transaction_splits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_splits_fund_id ON transaction_splits(church_id, fund_id);

-- Fund Transfers: Inter-fund atomic movements
CREATE TABLE IF NOT EXISTS fund_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  from_fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  to_fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL,
  note TEXT,
  status transfer_status_enum NOT NULL DEFAULT 'completed',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  transaction_id UUID REFERENCES transactions(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_transfer_funds_different CHECK (from_fund_id <> to_fund_id),
  CONSTRAINT chk_transfer_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_transfers_church_id ON fund_transfers(church_id);

-- ------------------------------------------------------------------------------
-- 5. SUNDAY OFFERINGS & SENSITIVE MEMBER GIVING
-- ------------------------------------------------------------------------------

-- Offering Sessions: Sunday collection & dual counting sessions
CREATE TABLE IF NOT EXISTS offering_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  service_date DATE NOT NULL,
  service_name TEXT NOT NULL DEFAULT 'Sunday Morning Worship',
  expected_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  counted_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  variance_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  status offering_session_status_enum NOT NULL DEFAULT 'draft',
  counter1_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  counter2_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  counter1_signed_at TIMESTAMPTZ,
  counter2_signed_at TIMESTAMPTZ,
  variance_reason TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_counters_different CHECK (counter1_id IS NULL OR counter2_id IS NULL OR counter1_id <> counter2_id),
  CONSTRAINT chk_expected_amount_non_negative CHECK (expected_amount >= 0),
  CONSTRAINT chk_counted_amount_non_negative CHECK (counted_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_offering_sessions_church ON offering_sessions(church_id, service_date);

-- Members: Church congregants directory
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  member_code TEXT,
  household_name TEXT,
  joined_date DATE,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_member_name_non_empty CHECK (length(trim(full_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_members_church_name ON members(church_id, full_name);

-- Member Giving Records: Highly Confidential tithes & designated offerings
CREATE TABLE IF NOT EXISTS member_giving_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  offering_session_id UUID REFERENCES offering_sessions(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  giving_type TEXT NOT NULL DEFAULT 'tithe', -- 'tithe', 'general', 'mission', 'building', 'special'
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer', -- 'bank_transfer', 'cash', 'qr_promptpay'
  given_at DATE NOT NULL,
  confidential_note TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_member_giving_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_giving_church_member ON member_giving_records(church_id, member_id, given_at);

-- ------------------------------------------------------------------------------
-- 6. IMMUTABLE AUDIT LOGS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  category audit_category_enum NOT NULL DEFAULT 'DATA_CHANGE',
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_church_created ON audit_logs(church_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
