export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRoleEnum =
  | "super_admin"
  | "pastor"
  | "treasurer"
  | "finance_staff"
  | "approver"
  | "counter"
  | "member";

export type AccountTypeEnum =
  | "bank"
  | "cash_drawer"
  | "petty_cash"
  | "electronic_wallet";

export type TransactionDirectionEnum = "income" | "expense" | "transfer";

export type TransactionStatusEnum =
  | "draft"
  | "pending_approval"
  | "approved"
  | "posted"
  | "rejected"
  | "voided";

export type TransferStatusEnum =
  | "pending"
  | "completed"
  | "rejected"
  | "cancelled";

export type OfferingSessionStatusEnum =
  | "draft"
  | "counting"
  | "variance_review"
  | "confirmed"
  | "posted"
  | "voided";

export type AuditCategoryEnum =
  | "DATA_CHANGE"
  | "ACCESS"
  | "SECURITY"
  | "APPROVAL"
  | "FINANCIAL";

export interface Database {
  public: {
    Tables: {
      churches: {
        Row: {
          id: string;
          name: string;
          currency: string;
          tax_id: string | null;
          address: string | null;
          phone: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          currency?: string;
          tax_id?: string | null;
          address?: string | null;
          phone?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          currency?: string;
          tax_id?: string | null;
          address?: string | null;
          phone?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };

      profiles: {
        Row: {
          id: string;
          church_id: string;
          email: string;
          full_name: string;
          display_name: string | null;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          church_id: string;
          email: string;
          full_name: string;
          display_name?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          church_id?: string;
          email?: string;
          full_name?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      user_roles: {
        Row: {
          id: string;
          user_id: string;
          church_id: string;
          role: UserRoleEnum;
          granted_at: string;
          granted_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          church_id: string;
          role: UserRoleEnum;
          granted_at?: string;
          granted_by?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          church_id?: string;
          role?: UserRoleEnum;
          granted_at?: string;
          granted_by?: string | null;
        };
      };

      accounts: {
        Row: {
          id: string;
          church_id: string;
          name: string;
          type: AccountTypeEnum;
          account_number: string | null;
          bank_name: string | null;
          current_balance: string; // NUMERIC(14,2) formatted as string
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          church_id: string;
          name: string;
          type?: AccountTypeEnum;
          account_number?: string | null;
          bank_name?: string | null;
          current_balance?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          church_id?: string;
          name?: string;
          type?: AccountTypeEnum;
          account_number?: string | null;
          bank_name?: string | null;
          current_balance?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      funds: {
        Row: {
          id: string;
          church_id: string;
          name: string;
          description: string | null;
          target_amount: string | null;
          current_balance: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          church_id: string;
          name: string;
          description?: string | null;
          target_amount?: string | null;
          current_balance?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          church_id?: string;
          name?: string;
          description?: string | null;
          target_amount?: string | null;
          current_balance?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      categories: {
        Row: {
          id: string;
          church_id: string;
          name: string;
          direction: TransactionDirectionEnum;
          default_fund_id: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          church_id: string;
          name: string;
          direction: TransactionDirectionEnum;
          default_fund_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          church_id?: string;
          name?: string;
          direction?: TransactionDirectionEnum;
          default_fund_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };

      transactions: {
        Row: {
          id: string;
          church_id: string;
          account_id: string;
          amount: string;
          direction: TransactionDirectionEnum;
          status: TransactionStatusEnum;
          description: string;
          reference_number: string | null;
          posted_at: string | null;
          created_by: string;
          approved_by: string | null;
          approved_at: string | null;
          rejected_by: string | null;
          rejected_at: string | null;
          rejection_reason: string | null;
          is_reversal: boolean;
          reversal_of_id: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          church_id: string;
          account_id: string;
          amount: string;
          direction: TransactionDirectionEnum;
          status?: TransactionStatusEnum;
          description: string;
          reference_number?: string | null;
          posted_at?: string | null;
          created_by: string;
          approved_by?: string | null;
          approved_at?: string | null;
          rejected_by?: string | null;
          rejected_at?: string | null;
          rejection_reason?: string | null;
          is_reversal?: boolean;
          reversal_of_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          church_id?: string;
          account_id?: string;
          amount?: string;
          direction?: TransactionDirectionEnum;
          status?: TransactionStatusEnum;
          description?: string;
          reference_number?: string | null;
          posted_at?: string | null;
          created_by?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          rejected_by?: string | null;
          rejected_at?: string | null;
          rejection_reason?: string | null;
          is_reversal?: boolean;
          reversal_of_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };

      transaction_splits: {
        Row: {
          id: string;
          transaction_id: string;
          church_id: string;
          fund_id: string;
          category_id: string | null;
          amount: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          church_id: string;
          fund_id: string;
          category_id?: string | null;
          amount: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          church_id?: string;
          fund_id?: string;
          category_id?: string | null;
          amount?: string;
          note?: string | null;
          created_at?: string;
        };
      };

      fund_transfers: {
        Row: {
          id: string;
          church_id: string;
          from_fund_id: string;
          to_fund_id: string;
          amount: string;
          note: string | null;
          status: TransferStatusEnum;
          created_by: string;
          approved_by: string | null;
          transaction_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          church_id: string;
          from_fund_id: string;
          to_fund_id: string;
          amount: string;
          note?: string | null;
          status?: TransferStatusEnum;
          created_by: string;
          approved_by?: string | null;
          transaction_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          church_id?: string;
          from_fund_id?: string;
          to_fund_id?: string;
          amount?: string;
          note?: string | null;
          status?: TransferStatusEnum;
          created_by?: string;
          approved_by?: string | null;
          transaction_id?: string | null;
          created_at?: string;
        };
      };

      member_giving_records: {
        Row: {
          id: string;
          church_id: string;
          member_id: string;
          offering_session_id: string | null;
          amount: string;
          giving_type: string;
          payment_method: string;
          given_at: string;
          confidential_note: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          church_id: string;
          member_id: string;
          offering_session_id?: string | null;
          amount: string;
          giving_type?: string;
          payment_method?: string;
          given_at: string;
          confidential_note?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          church_id?: string;
          member_id?: string;
          offering_session_id?: string | null;
          amount?: string;
          giving_type?: string;
          payment_method?: string;
          given_at?: string;
          confidential_note?: string | null;
          created_by?: string;
          created_at?: string;
        };
      };

      audit_logs: {
        Row: {
          id: string;
          church_id: string;
          category: AuditCategoryEnum;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          before_state: Json | null;
          after_state: Json | null;
          metadata: Json;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          church_id: string;
          category?: AuditCategoryEnum;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          before_state?: Json | null;
          after_state?: Json | null;
          metadata?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          church_id?: string;
          category?: AuditCategoryEnum;
          actor_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          before_state?: Json | null;
          after_state?: Json | null;
          metadata?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };

      historical_monthly_summaries: {
        Row: {
          id: string;
          church_id: string;
          fiscal_year: number;
          month: number;
          month_name: string;
          status: "historical" | "historical_partial";
          data_through: string | null;
          income_total: string | number;
          cash_income: string | number;
          online_income: string | number;
          expense_total: string | number;
          net: string | number;
          opening_balance_reported: string | number | null;
          closing_balance_reported: string | number | null;
          data_quality_flag: "VERIFIED" | "DATA_REVIEW_REQUIRED" | "ESTIMATED";
          data_quality_notes: string | null;
          source: string;
          source_document: string;
          imported_at: string;
          import_batch_id: string;
          is_immutable: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          church_id: string;
          fiscal_year: number;
          month: number;
          month_name: string;
          status?: "historical" | "historical_partial";
          data_through?: string | null;
          income_total?: string | number;
          cash_income?: string | number;
          online_income?: string | number;
          expense_total?: string | number;
          net?: string | number;
          opening_balance_reported?: string | number | null;
          closing_balance_reported?: string | number | null;
          data_quality_flag?: "VERIFIED" | "DATA_REVIEW_REQUIRED" | "ESTIMATED";
          data_quality_notes?: string | null;
          source?: string;
          source_document?: string;
          imported_at?: string;
          import_batch_id?: string;
          is_immutable?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          church_id?: string;
          fiscal_year?: number;
          month?: number;
          month_name?: string;
          status?: "historical" | "historical_partial";
          data_through?: string | null;
          income_total?: string | number;
          cash_income?: string | number;
          online_income?: string | number;
          expense_total?: string | number;
          net?: string | number;
          opening_balance_reported?: string | number | null;
          closing_balance_reported?: string | number | null;
          data_quality_flag?: "VERIFIED" | "DATA_REVIEW_REQUIRED" | "ESTIMATED";
          data_quality_notes?: string | null;
          source?: string;
          source_document?: string;
          imported_at?: string;
          import_batch_id?: string;
          is_immutable?: boolean;
          created_at?: string;
        };
      };

      historical_weekly_summaries: {
        Row: {
          id: string;
          church_id: string;
          fiscal_year: number;
          month: number;
          week_date: string;
          income_total: string | number;
          cash_income: string | number;
          online_income: string | number;
          expense_total: string | number;
          net: string | number;
          source: string;
          source_document: string;
          imported_at: string;
          import_batch_id: string;
          is_immutable: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          church_id: string;
          fiscal_year: number;
          month: number;
          week_date: string;
          income_total?: string | number;
          cash_income?: string | number;
          online_income?: string | number;
          expense_total?: string | number;
          net?: string | number;
          source?: string;
          source_document?: string;
          imported_at?: string;
          import_batch_id?: string;
          is_immutable?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          church_id?: string;
          fiscal_year?: number;
          month?: number;
          week_date?: string;
          income_total?: string | number;
          cash_income?: string | number;
          online_income?: string | number;
          expense_total?: string | number;
          net?: string | number;
          source?: string;
          source_document?: string;
          imported_at?: string;
          import_batch_id?: string;
          is_immutable?: boolean;
          created_at?: string;
        };
      };
    };

    Functions: {
      current_user_church_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      current_user_has_role: {
        Args: { p_required_role: UserRoleEnum };
        Returns: boolean;
      };
      has_church_access: {
        Args: { p_church_id: string; p_minimum_role?: UserRoleEnum };
        Returns: boolean;
      };
      submit_transaction: {
        Args: {
          p_transaction_id: string;
        };
        Returns: string;
      };
      approve_transaction: {
        Args: {
          p_transaction_id: string;
          p_note?: string | null;
        };
        Returns: string;
      };
      request_transaction_revision: {
        Args: {
          p_transaction_id: string;
          p_revision_note: string;
        };
        Returns: string;
      };
      reject_transaction_terminal: {
        Args: {
          p_transaction_id: string;
          p_rejection_reason: string;
        };
        Returns: string;
      };
      reject_transaction: {
        Args: {
          p_transaction_id: string;
          p_rejection_reason: string;
        };
        Returns: string;
      };
      post_transaction: {
        Args: {
          p_transaction_id: string;
        };
        Returns: string;
      };
      transfer_funds: {
        Args: {
          p_church_id: string;
          p_from_fund_id: string;
          p_to_fund_id: string;
          p_amount: string;
          p_note?: string;
        };
        Returns: string;
      };
      void_transaction: {
        Args: {
          p_transaction_id: string;
          p_reason: string;
        };
        Returns: string;
      };
      get_member_giving_history: {
        Args: {
          p_member_id: string;
          p_reason: string;
        };
        Returns: Database["public"]["Tables"]["member_giving_records"]["Row"][];
      };
    };
  };
}
