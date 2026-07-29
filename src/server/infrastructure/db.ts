/**
 * Grace Ledger v2 — Database Connection
 * Drizzle ORM client for PostgreSQL (Supabase compatible)
 * Includes in-memory PGlite support for isolated integration testing without external Postgres daemon.
 */

import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import * as schema from "@/db/schema";

const isTest = Boolean(process.env.VITEST) || process.env.NODE_ENV === "test";

let dbInstance: any;

if (isTest && !process.env.DATABASE_URL) {
  const pglite = new PGlite();

  // 1. Setup auth schema & extensions stub
  await pglite.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$ SELECT null::uuid $$ LANGUAGE sql;
  `);

  // 2. Create Enums
  const enums = [
    "CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'income', 'expense');",
    "CREATE TYPE normal_balance AS ENUM ('debit', 'credit');",
    "CREATE TYPE entry_type AS ENUM ('offering', 'expense', 'income', 'transfer', 'opening', 'adjustment', 'void', 'closing');",
    "CREATE TYPE entry_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'voided');",
    "CREATE TYPE line_type AS ENUM ('debit', 'credit');",
    "CREATE TYPE user_role AS ENUM ('super_admin', 'admin');",
    "CREATE TYPE period_status AS ENUM ('open', 'closed', 'reconciled');",
    "CREATE TYPE count_sheet_status AS ENUM ('counting', 'discrepancy', 'in_review', 'reconciled', 'locked');",
    "CREATE TYPE budget_period_type AS ENUM ('annual', 'monthly', 'department', 'project');",
    "CREATE TYPE budget_status AS ENUM ('draft', 'pending', 'approved', 'rejected');",
    "CREATE TYPE project_status AS ENUM ('planning', 'active', 'paused', 'completed');",
    "CREATE TYPE member_status AS ENUM ('active', 'inactive');",
    "CREATE TYPE payment_channel AS ENUM ('cash', 'bank', 'qr');",
    "CREATE TYPE tx_status AS ENUM ('draft', 'pending', 'approved', 'rejected');",
    "CREATE TYPE category_kind AS ENUM ('income', 'expense');",
  ];

  for (const statement of enums) {
    try {
      await pglite.exec(statement);
    } catch {
      /* ignore if existing */
    }
  }

  // 3. Create Tables matching src/db/schema.ts exactly
  const tables = [
    `CREATE TABLE IF NOT EXISTS churches (
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
    );`,

    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      role user_role NOT NULL DEFAULT 'admin',
      password_hash VARCHAR(255) NOT NULL,
      mfa_enabled BOOLEAN NOT NULL DEFAULT false,
      mfa_secret VARCHAR(64),
      avatar_color VARCHAR(7),
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      token_version INTEGER NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      version INTEGER NOT NULL DEFAULT 1
    );`,

    `CREATE TABLE IF NOT EXISTS user_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS chart_of_accounts (
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
    );`,

    `CREATE TABLE IF NOT EXISTS funds (
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
      sort_order INTEGER NOT NULL DEFAULT 0,
      last_calculated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      version INTEGER NOT NULL DEFAULT 1,
      UNIQUE(church_id, fund_code)
    );`,

    `CREATE TABLE IF NOT EXISTS fiscal_periods (
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
      UNIQUE(church_id, fiscal_year, period_number)
    );`,

    `CREATE TABLE IF NOT EXISTS journal_entries (
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
      void_parent_id UUID,
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
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS journal_entry_lines (
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS general_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
      posting_date DATE NOT NULL,
      journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
      journal_line_id UUID NOT NULL REFERENCES journal_entry_lines(id) ON DELETE CASCADE,
      fund_id UUID NOT NULL REFERENCES funds(id),
      debit_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      credit_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      running_balance DECIMAL(18,2) NOT NULL,
      fiscal_year INTEGER NOT NULL,
      fiscal_period INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS offering_count_sheets (
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
      version INTEGER NOT NULL DEFAULT 1
    );`,

    `CREATE TABLE IF NOT EXISTS offering_categories (
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
    );`,

    `CREATE TABLE IF NOT EXISTS reconciliations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      period_id UUID NOT NULL REFERENCES fiscal_periods(id),
      fund_id UUID NOT NULL REFERENCES funds(id),
      opening_balance DECIMAL(18,2) NOT NULL,
      system_balance DECIMAL(18,2) NOT NULL,
      actual_balance DECIMAL(18,2) NOT NULL,
      variance DECIMAL(18,2) NOT NULL,
      explanation TEXT,
      is_reconciled BOOLEAN NOT NULL DEFAULT false,
      previous_reconciliation_id UUID,
      reconciled_by UUID NOT NULL REFERENCES users(id),
      reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS departments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      budget_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      start_date DATE NOT NULL,
      end_date DATE,
      status project_status NOT NULL DEFAULT 'planning',
      department_id UUID REFERENCES departments(id),
      owner_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      version INTEGER NOT NULL DEFAULT 1
    );`,

    `CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      event_type VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id UUID,
      user_id UUID REFERENCES users(id),
      user_name VARCHAR(255) NOT NULL,
      action VARCHAR(50) NOT NULL,
      before_state TEXT,
      after_state TEXT,
      ip_address VARCHAR(45),
      user_agent TEXT,
      correlation_id UUID NOT NULL,
      previous_hash VARCHAR(64),
      current_hash VARCHAR(64) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      entity_type VARCHAR(50) NOT NULL,
      entity_id UUID NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_size INTEGER NOT NULL,
      content_type VARCHAR(100) NOT NULL,
      storage_path VARCHAR(500) NOT NULL,
      uploaded_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS entry_number_counters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      entry_type entry_type NOT NULL,
      fiscal_year INTEGER NOT NULL,
      last_number INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(church_id, entry_type, fiscal_year)
    );`,

    `CREATE TABLE IF NOT EXISTS inter_fund_loans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      journal_entry_id UUID NOT NULL REFERENCES journal_entries(id),
      from_fund_id UUID NOT NULL REFERENCES funds(id),
      to_fund_id UUID NOT NULL REFERENCES funds(id),
      amount DECIMAL(18,2) NOT NULL,
      expected_repayment_date DATE,
      interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      status VARCHAR(20) NOT NULL DEFAULT 'outstanding',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS line_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      line_user_id VARCHAR(255) NOT NULL UNIQUE,
      user_id UUID REFERENCES users(id),
      linked_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS budgets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
      fund_id UUID NOT NULL REFERENCES funds(id),
      period_type budget_period_type NOT NULL,
      fiscal_year INTEGER NOT NULL,
      fiscal_period INTEGER,
      department_id UUID REFERENCES departments(id),
      project_id UUID REFERENCES projects(id),
      budgeted_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      status budget_status NOT NULL DEFAULT 'draft',
      approved_by UUID REFERENCES users(id),
      created_by UUID NOT NULL REFERENCES users(id),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      version INTEGER NOT NULL DEFAULT 1
    );`,

    `CREATE TABLE IF NOT EXISTS members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      family_name VARCHAR(100),
      phone VARCHAR(50),
      email VARCHAR(255),
      address TEXT,
      department_id UUID REFERENCES departments(id),
      status member_status NOT NULL DEFAULT 'active',
      joined_at DATE,
      consent_given BOOLEAN NOT NULL DEFAULT false,
      consent_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      version INTEGER NOT NULL DEFAULT 1
    );`,

    `CREATE TABLE IF NOT EXISTS app_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
      church_name VARCHAR(255) NOT NULL,
      church_address TEXT,
      tax_id VARCHAR(20),
      fiscal_year_start INTEGER NOT NULL DEFAULT 1,
      idle_timeout_min INTEGER NOT NULL DEFAULT 15,
      session_max_hours INTEGER NOT NULL DEFAULT 8,
      currency VARCHAR(3) NOT NULL DEFAULT 'THB',
      updated_by UUID REFERENCES users(id),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
  ];

  for (const tableSql of tables) {
    await pglite.exec(tableSql);
  }

  dbInstance = drizzlePglite(pglite, { schema });
} else {
  const { Pool } = pg;
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/grace_ledger",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  dbInstance = drizzleNodePg(pool, { schema });
}

export type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;
export const db: Database = dbInstance as Database;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
