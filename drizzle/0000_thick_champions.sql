CREATE TYPE "public"."account_type" AS ENUM('asset', 'liability', 'equity', 'income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."budget_period_type" AS ENUM('annual', 'monthly', 'department', 'project');--> statement-breakpoint
CREATE TYPE "public"."budget_status" AS ENUM('draft', 'pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."count_sheet_status" AS ENUM('counting', 'discrepancy', 'in_review', 'reconciled', 'locked');--> statement-breakpoint
CREATE TYPE "public"."entry_status" AS ENUM('draft', 'pending', 'approved', 'rejected', 'voided');--> statement-breakpoint
CREATE TYPE "public"."entry_type" AS ENUM('offering', 'expense', 'income', 'transfer', 'opening', 'adjustment', 'void', 'closing');--> statement-breakpoint
CREATE TYPE "public"."line_type" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."normal_balance" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."period_status" AS ENUM('open', 'closed', 'reconciled');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('planning', 'active', 'paused', 'completed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'pastor', 'treasurer', 'finance_staff', 'auditor', 'viewer');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"church_name" varchar(255) NOT NULL,
	"church_address" text,
	"tax_id" varchar(20),
	"fiscal_year_start" integer DEFAULT 1 NOT NULL,
	"idle_timeout_min" integer DEFAULT 15 NOT NULL,
	"session_max_hours" integer DEFAULT 8 NOT NULL,
	"currency" varchar(3) DEFAULT 'THB' NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_fiscal_month" CHECK ("app_settings"."fiscal_year_start" BETWEEN 1 AND 12),
	CONSTRAINT "chk_idle_timeout" CHECK ("app_settings"."idle_timeout_min" >= 1),
	CONSTRAINT "chk_session_max" CHECK ("app_settings"."session_max_hours" >= 1)
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"storage_path" varchar(500) NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_file_size" CHECK ("attachments"."file_size" <= 10485760)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid,
	"user_id" uuid,
	"user_name" varchar(255) NOT NULL,
	"action" varchar(50) NOT NULL,
	"before_state" text,
	"after_state" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"correlation_id" uuid NOT NULL,
	"previous_hash" varchar(64),
	"current_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"account_id" uuid NOT NULL,
	"fund_id" uuid NOT NULL,
	"period_type" "budget_period_type" NOT NULL,
	"fiscal_year" integer NOT NULL,
	"fiscal_period" integer,
	"department_id" uuid,
	"project_id" uuid,
	"budgeted_amount" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"status" "budget_status" DEFAULT 'draft' NOT NULL,
	"approved_by" uuid,
	"created_by" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "chk_budget_amount" CHECK ("budgets"."budgeted_amount" >= 0),
	CONSTRAINT "chk_budget_period" CHECK ((
      ("budgets"."period_type" = 'annual' AND "budgets"."fiscal_period" IS NULL AND "budgets"."department_id" IS NULL AND "budgets"."project_id" IS NULL) OR
      ("budgets"."period_type" = 'monthly' AND "budgets"."fiscal_period" IS NOT NULL AND "budgets"."department_id" IS NULL AND "budgets"."project_id" IS NULL) OR
      ("budgets"."period_type" = 'department' AND "budgets"."fiscal_period" IS NULL AND "budgets"."department_id" IS NOT NULL AND "budgets"."project_id" IS NULL) OR
      ("budgets"."period_type" = 'project' AND "budgets"."fiscal_period" IS NULL AND "budgets"."department_id" IS NULL AND "budgets"."project_id" IS NOT NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"account_code" varchar(20) NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"account_type" "account_type" NOT NULL,
	"parent_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_contra" boolean DEFAULT false NOT NULL,
	"normal_balance" "normal_balance" NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"tfrs_code" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "churches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"tax_id" varchar(20),
	"fiscal_year_start" integer DEFAULT 1 NOT NULL,
	"currency" varchar(3) DEFAULT 'THB' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiscal_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"fiscal_year" integer NOT NULL,
	"period_number" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "period_status" DEFAULT 'open' NOT NULL,
	"closed_by" uuid,
	"closed_at" timestamp with time zone,
	"reopened_by" uuid,
	"reopened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "chk_period_number" CHECK ("fiscal_periods"."period_number" BETWEEN 1 AND 12),
	CONSTRAINT "chk_end_after_start" CHECK ("fiscal_periods"."end_date" >= "fiscal_periods"."start_date")
);
--> statement-breakpoint
CREATE TABLE "funds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"fund_code" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_restricted" boolean DEFAULT false NOT NULL,
	"opening_balance" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"current_balance" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"last_calculated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "general_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"posting_date" date NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"journal_line_id" uuid NOT NULL,
	"fund_id" uuid NOT NULL,
	"debit_amount" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"credit_amount" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"running_balance" numeric(18, 2) NOT NULL,
	"fiscal_year" integer NOT NULL,
	"fiscal_period" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inter_fund_loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"from_fund_id" uuid NOT NULL,
	"to_fund_id" uuid NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"expected_repayment_date" date,
	"interest_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"status" varchar(20) DEFAULT 'outstanding' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"entry_number" varchar(30),
	"entry_type" "entry_type" NOT NULL,
	"posting_date" date NOT NULL,
	"description" text,
	"status" "entry_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"approval_1_id" uuid,
	"approval_2_id" uuid,
	"rejection_reason" text,
	"void_parent_id" uuid,
	"fund_id" uuid NOT NULL,
	"reference_document" varchar(255),
	"total_debit" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"total_credit" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"fiscal_year" integer NOT NULL,
	"fiscal_period" integer NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"posted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_balanced" CHECK ("journal_entries"."total_debit" = "journal_entries"."total_credit"),
	CONSTRAINT "chk_positive_totals" CHECK ("journal_entries"."total_debit" > 0 AND "journal_entries"."total_credit" > 0),
	CONSTRAINT "chk_no_self_approve_1" CHECK ("journal_entries"."approval_1_id" IS NULL OR "journal_entries"."approval_1_id" <> "journal_entries"."created_by"),
	CONSTRAINT "chk_no_same_approvers" CHECK ("journal_entries"."approval_2_id" IS NULL OR "journal_entries"."approval_1_id" IS NULL OR "journal_entries"."approval_1_id" <> "journal_entries"."approval_2_id"),
	CONSTRAINT "chk_rejection_reason" CHECK ("journal_entries"."status" <> 'rejected' OR "journal_entries"."rejection_reason" IS NOT NULL),
	CONSTRAINT "chk_approved_has_approver" CHECK ("journal_entries"."status" <> 'approved' OR "journal_entries"."approval_1_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "journal_entry_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"church_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"line_type" "line_type" NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"fund_id" uuid NOT NULL,
	"member_id" uuid,
	"department_id" uuid,
	"project_id" uuid,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_line_amount_positive" CHECK ("journal_entry_lines"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"family_name" varchar(100),
	"phone" varchar(20),
	"email" varchar(255),
	"address" text,
	"department_id" uuid,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"joined_at" date,
	"consent_given" boolean DEFAULT false NOT NULL,
	"consent_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offering_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(7),
	"icon" varchar(50),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offering_count_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"date" date NOT NULL,
	"counter_1_id" uuid NOT NULL,
	"counter_1_amount" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"counter_2_id" uuid NOT NULL,
	"counter_2_amount" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"counter_3_id" uuid,
	"counter_3_amount" numeric(18, 2),
	"reconciled_amount" numeric(18, 2),
	"status" "count_sheet_status" DEFAULT 'counting' NOT NULL,
	"locked_by" uuid,
	"locked_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "chk_counters_different_12" CHECK ("offering_count_sheets"."counter_1_id" <> "offering_count_sheets"."counter_2_id"),
	CONSTRAINT "chk_counters_different_13" CHECK ("offering_count_sheets"."counter_1_id" <> "offering_count_sheets"."counter_3_id" OR "offering_count_sheets"."counter_3_id" IS NULL),
	CONSTRAINT "chk_counters_different_23" CHECK ("offering_count_sheets"."counter_2_id" <> "offering_count_sheets"."counter_3_id" OR "offering_count_sheets"."counter_3_id" IS NULL),
	CONSTRAINT "chk_counter_amounts_positive" CHECK ("offering_count_sheets"."counter_1_amount" >= 0 AND "offering_count_sheets"."counter_2_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"budget_amount" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" "project_status" DEFAULT 'planning' NOT NULL,
	"department_id" uuid,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"fund_id" uuid NOT NULL,
	"opening_balance" numeric(18, 2) NOT NULL,
	"system_balance" numeric(18, 2) NOT NULL,
	"actual_balance" numeric(18, 2) NOT NULL,
	"variance" numeric(18, 2) NOT NULL,
	"explanation" text,
	"is_reconciled" boolean DEFAULT false NOT NULL,
	"previous_reconciliation_id" uuid,
	"reconciled_by" uuid NOT NULL,
	"reconciled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"church_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret" varchar(64),
	"avatar_color" varchar(7),
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"token_version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_reopened_by_users_id_fk" FOREIGN KEY ("reopened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funds" ADD CONSTRAINT "funds_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funds" ADD CONSTRAINT "funds_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "general_ledger" ADD CONSTRAINT "general_ledger_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "general_ledger" ADD CONSTRAINT "general_ledger_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "general_ledger" ADD CONSTRAINT "general_ledger_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "general_ledger" ADD CONSTRAINT "general_ledger_journal_line_id_journal_entry_lines_id_fk" FOREIGN KEY ("journal_line_id") REFERENCES "public"."journal_entry_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "general_ledger" ADD CONSTRAINT "general_ledger_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inter_fund_loans" ADD CONSTRAINT "inter_fund_loans_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inter_fund_loans" ADD CONSTRAINT "inter_fund_loans_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inter_fund_loans" ADD CONSTRAINT "inter_fund_loans_from_fund_id_funds_id_fk" FOREIGN KEY ("from_fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inter_fund_loans" ADD CONSTRAINT "inter_fund_loans_to_fund_id_funds_id_fk" FOREIGN KEY ("to_fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_approval_1_id_users_id_fk" FOREIGN KEY ("approval_1_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_approval_2_id_users_id_fk" FOREIGN KEY ("approval_2_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offering_categories" ADD CONSTRAINT "offering_categories_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offering_categories" ADD CONSTRAINT "offering_categories_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offering_count_sheets" ADD CONSTRAINT "offering_count_sheets_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offering_count_sheets" ADD CONSTRAINT "offering_count_sheets_counter_1_id_users_id_fk" FOREIGN KEY ("counter_1_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offering_count_sheets" ADD CONSTRAINT "offering_count_sheets_counter_2_id_users_id_fk" FOREIGN KEY ("counter_2_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offering_count_sheets" ADD CONSTRAINT "offering_count_sheets_counter_3_id_users_id_fk" FOREIGN KEY ("counter_3_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offering_count_sheets" ADD CONSTRAINT "offering_count_sheets_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_period_id_fiscal_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."fiscal_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_reconciled_by_users_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attachments_entity" ON "attachments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_church_created" ON "audit_log" USING btree ("church_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_entity" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_user" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_event" ON "audit_log" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_audit_correlation" ON "audit_log" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "idx_budgets_church_fiscal" ON "budgets" USING btree ("church_id","fiscal_year","fiscal_period");--> statement-breakpoint
CREATE INDEX "idx_budgets_status" ON "budgets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_budgets_account" ON "budgets" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coa_church_code" ON "chart_of_accounts" USING btree ("church_id","account_code");--> statement-breakpoint
CREATE INDEX "idx_coa_account_type" ON "chart_of_accounts" USING btree ("account_type");--> statement-breakpoint
CREATE INDEX "idx_coa_parent_id" ON "chart_of_accounts" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_coa_active" ON "chart_of_accounts" USING btree ("is_active") WHERE "chart_of_accounts"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_fp_church_year_period" ON "fiscal_periods" USING btree ("church_id","fiscal_year","period_number");--> statement-breakpoint
CREATE INDEX "idx_fp_status" ON "fiscal_periods" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_funds_church_code" ON "funds" USING btree ("church_id","fund_code");--> statement-breakpoint
CREATE INDEX "idx_funds_active" ON "funds" USING btree ("is_active") WHERE "funds"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_gl_journal_line" ON "general_ledger" USING btree ("journal_line_id");--> statement-breakpoint
CREATE INDEX "idx_gl_church_account_date" ON "general_ledger" USING btree ("church_id","account_id","posting_date");--> statement-breakpoint
CREATE INDEX "idx_gl_church_fund_date" ON "general_ledger" USING btree ("church_id","fund_id","posting_date");--> statement-breakpoint
CREATE INDEX "idx_gl_entry" ON "general_ledger" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "idx_gl_church_fiscal" ON "general_ledger" USING btree ("church_id","fiscal_year","fiscal_period");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_journal_entries_number" ON "journal_entries" USING btree ("entry_number") WHERE "journal_entries"."entry_number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_je_posting_date" ON "journal_entries" USING btree ("posting_date");--> statement-breakpoint
CREATE INDEX "idx_je_status" ON "journal_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_je_fund" ON "journal_entries" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX "idx_je_church_fiscal" ON "journal_entries" USING btree ("church_id","fiscal_year","fiscal_period");--> statement-breakpoint
CREATE INDEX "idx_je_entry_type" ON "journal_entries" USING btree ("entry_type");--> statement-breakpoint
CREATE INDEX "idx_je_created_by_status" ON "journal_entries" USING btree ("created_by","status");--> statement-breakpoint
CREATE INDEX "idx_je_approval_1" ON "journal_entries" USING btree ("approval_1_id","posting_date");--> statement-breakpoint
CREATE INDEX "idx_jel_entry" ON "journal_entry_lines" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "idx_jel_account" ON "journal_entry_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_jel_fund" ON "journal_entry_lines" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX "idx_jel_member" ON "journal_entry_lines" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_jel_project" ON "journal_entry_lines" USING btree ("project_id","line_type");--> statement-breakpoint
CREATE INDEX "idx_jel_department" ON "journal_entry_lines" USING btree ("department_id","line_type");--> statement-breakpoint
CREATE INDEX "idx_members_status" ON "members" USING btree ("status") WHERE "members"."status" = 'active';--> statement-breakpoint
CREATE INDEX "idx_members_name" ON "members" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_members_email" ON "members" USING btree ("email") WHERE "members"."email" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_oc_active" ON "offering_categories" USING btree ("is_active") WHERE "offering_categories"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_ocs_church_date" ON "offering_count_sheets" USING btree ("church_id","date");--> statement-breakpoint
CREATE INDEX "idx_ocs_status" ON "offering_count_sheets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rec_church_period_fund" ON "reconciliations" USING btree ("church_id","period_id","fund_id");--> statement-breakpoint
CREATE INDEX "idx_rec_period" ON "reconciliations" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "idx_rec_fund" ON "reconciliations" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_token" ON "user_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_church_name" ON "users" USING btree ("church_id","name") WHERE "users"."is_active" = true;