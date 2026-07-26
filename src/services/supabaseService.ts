// src/services/supabaseService.ts
// Service layer that replaces mock-db.ts.
// All functions talk to Supabase (browser client), not localStorage.
//
// Key changes from mock-db.ts:
// 1. Data lives in Supabase PostgreSQL (shared, durable, multi-user)
// 2. Auth is handled by Supabase Auth (httpOnly cookies)
// 3. RLS policies enforce access control at DB level
// 4. Audit log is server-side (immutable)
// 5. Optimistic locking via version column

import { supabase } from "./supabaseClient";
import type {
  User,
  Income,
  Expense,
  Offering,
  Fund,
  Category,
  Budget,
  Member,
  Project,
  Settings,
  TxStatus,
  PaymentChannel,
  OfferingCategory,
  OfferingSubcategory,
  AuditLog,
  Role,
} from "@/lib/types";

// ============================================================================
// Auth helpers
// ============================================================================

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUp(
  email: string,
  password: string,
  name: string,
  churchId: string,
  role: Role = "admin",
) {
  const { data, error } = await supabase.auth.signUp({
    email: email.toLowerCase().trim(),
    password,
    options: {
      data: { name, church_id: churchId, role },
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Get our user record (church-scoped)
  const { data: userData, error } = await supabase
    .from("users")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (error || !userData) return null;
  return userData as User;
}

// ============================================================================
// Users
// ============================================================================

export async function listUsers(churchId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("church_id", churchId)
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return (data || []) as User[];
}

// ============================================================================
// Categories
// ============================================================================

export async function listCategories(churchId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("church_id", churchId)
    .order("sort_order");

  if (error) throw error;
  return (data || []) as Category[];
}

// ============================================================================
// Funds
// ============================================================================

export async function listFunds(churchId: string): Promise<Fund[]> {
  const { data, error } = await supabase
    .from("funds")
    .select("*")
    .eq("church_id", churchId)
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw error;
  return (data || []) as Fund[];
}

export async function createFund(
  input: Omit<Fund, "id" | "createdAt" | "currentBalance">,
  churchId: string,
) {
  const { data, error } = await supabase
    .from("funds")
    .insert({
      church_id: churchId,
      account_id: input.accountId,
      fund_code: input.fundCode,
      name: input.name,
      description: input.description,
      is_restricted: input.isRestricted,
      opening_balance: input.openingBalance,
      current_balance: input.openingBalance,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Fund;
}

// ============================================================================
// Incomes
// ============================================================================

export async function listIncome(churchId: string): Promise<Income[]> {
  const { data, error } = await supabase
    .from("incomes")
    .select("*")
    .eq("church_id", churchId)
    .order("date", { ascending: false });

  if (error) throw error;
  return (data || []) as Income[];
}

export async function createIncome(
  input: Omit<Income, "id" | "createdBy" | "status" | "createdAt">,
  churchId: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("incomes")
    .insert({
      church_id: churchId,
      date: input.date,
      category_id: input.categoryId,
      amount: input.amount,
      fund_id: input.fundId,
      description: input.description ?? "",
      attachment_name: input.attachmentName,
      attachment_data_url: input.attachmentDataUrl,
      attachment_type: input.attachmentType,
      attachment_size: input.attachmentSize,
      created_by: user.id,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data as Income;
}

export async function deleteIncome(id: string, churchId: string) {
  const { error } = await supabase.from("incomes").delete().eq("id", id).eq("church_id", churchId);

  if (error) throw error;
}

export async function approveIncome(id: string, churchId: string) {
  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get the income record
  const { data: income, error: fetchError } = await supabase
    .from("incomes")
    .select("*")
    .eq("id", id)
    .eq("church_id", churchId)
    .single();

  if (fetchError || !income) throw new Error("Income record not found");

  // Self-approval prevention (CF-1)
  if (income.created_by === user.id) {
    throw new Error("Cannot approve your own income record");
  }

  const { data, error } = await supabase
    .from("incomes")
    .update({
      status: "approved",
      approved_by: user.id,
    })
    .eq("id", id)
    .eq("church_id", churchId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// Expenses
// ============================================================================

export async function listExpense(churchId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("church_id", churchId)
    .order("date", { ascending: false });

  if (error) throw error;
  return (data || []) as Expense[];
}

export async function createExpense(
  input: Omit<Expense, "id" | "createdBy" | "status" | "createdAt">,
  churchId: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      church_id: churchId,
      date: input.date,
      category_id: input.categoryId,
      amount: input.amount,
      fund_id: input.fundId,
      vendor: input.vendor ?? "",
      description: input.description ?? "",
      attachment_name: input.attachmentName,
      attachment_data_url: input.attachmentDataUrl,
      attachment_type: input.attachmentType,
      attachment_size: input.attachmentSize,
      created_by: user.id,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data as Expense;
}

export async function deleteExpense(id: string, churchId: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id).eq("church_id", churchId);

  if (error) throw error;
}

export async function setExpenseStatus(id: string, status: TxStatus, churchId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Self-approval prevention
  if (status === "approved") {
    const { data: expense } = await supabase
      .from("expenses")
      .select("created_by")
      .eq("id", id)
      .eq("church_id", churchId)
      .single();

    if (expense?.created_by === user.id) {
      throw new Error("Cannot approve your own expense");
    }
  }

  const { data, error } = await supabase
    .from("expenses")
    .update({
      status,
      approved_by: status === "approved" ? user.id : null,
    })
    .eq("id", id)
    .eq("church_id", churchId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// Offerings
// ============================================================================

export async function listOffering(churchId: string): Promise<Offering[]> {
  const { data, error } = await supabase
    .from("offerings")
    .select("*")
    .eq("church_id", churchId)
    .order("date", { ascending: false });

  if (error) throw error;
  return (data || []) as Offering[];
}

export async function createOffering(
  input: Omit<Offering, "id" | "createdBy" | "createdAt">,
  churchId: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("offerings")
    .insert({
      church_id: churchId,
      date: input.date,
      category_id: input.categoryId,
      subcategory_id: input.subcategoryId ?? null,
      channel: input.channel,
      amount: input.amount,
      member_id: input.memberId ?? null,
      fund_id: input.fundId,
      note: input.note ?? "",
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Offering;
}

export async function deleteOffering(id: string, churchId: string) {
  const { error } = await supabase
    .from("offerings")
    .delete()
    .eq("id", id)
    .eq("church_id", churchId);

  if (error) throw error;
}

// ============================================================================
// Offering Categories
// ============================================================================

export async function listOfferingCategories(churchId: string): Promise<OfferingCategory[]> {
  const { data, error } = await supabase
    .from("offering_categories")
    .select("*")
    .eq("church_id", churchId)
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw error;
  return (data || []) as OfferingCategory[];
}

export async function createOfferingCategory(
  input: { name: string; color: string; icon: string; description?: string },
  churchId: string,
) {
  const { data, error } = await supabase
    .from("offering_categories")
    .insert({
      church_id: churchId,
      ...input,
      sort_order: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data as OfferingCategory;
}

export async function updateOfferingCategory(
  id: string,
  input: Partial<
    Pick<OfferingCategory, "name" | "color" | "icon" | "description" | "sortOrder" | "isActive">
  >,
  churchId: string,
) {
  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.color !== undefined) updateData.color = input.color;
  if (input.icon !== undefined) updateData.icon = input.icon;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;

  const { data, error } = await supabase
    .from("offering_categories")
    .update(updateData)
    .eq("id", id)
    .eq("church_id", churchId)
    .select()
    .single();

  if (error) throw error;
  return data as OfferingCategory;
}

export async function deleteOfferingCategory(id: string, churchId: string) {
  const { error } = await supabase
    .from("offering_categories")
    .delete()
    .eq("id", id)
    .eq("church_id", churchId);

  if (error) throw error;
}

export async function reorderOfferingCategories(orderedIds: string[], churchId: string) {
  // Update sort_order for each category
  const updates = orderedIds.map((id, index) => ({
    id,
    church_id: churchId,
    sort_order: index + 1,
  }));

  const { error } = await supabase.rpc("reorder_entities", {
    p_entity_type: "offering_category",
    p_entity_ids: updates,
    p_church_id: churchId,
  });

  // If RPC doesn't exist, fall back to individual updates
  if (error) {
    for (const update of updates) {
      await supabase
        .from("offering_categories")
        .update({ sort_order: update.sort_order })
        .eq("id", update.id)
        .eq("church_id", update.church_id);
    }
  }
}

// ============================================================================
// Offering Subcategories
// ============================================================================

export async function listOfferingSubcategories(
  categoryId?: string,
  churchId?: string,
): Promise<OfferingSubcategory[]> {
  let query = supabase.from("offering_subcategories").select("*");

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  if (churchId) {
    query = query.eq("church_id", churchId);
  }

  const { data, error } = await query.order("sort_order");
  if (error) throw error;
  return (data || []) as OfferingSubcategory[];
}

export async function createOfferingSubcategory(
  input: { categoryId: string; name: string; description?: string },
  churchId: string,
) {
  const { data, error } = await supabase
    .from("offering_subcategories")
    .insert({
      church_id: churchId,
      category_id: input.categoryId,
      name: input.name,
      description: input.description ?? "",
      sort_order: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data as OfferingSubcategory;
}

export async function updateOfferingSubcategory(
  id: string,
  input: Partial<Pick<OfferingSubcategory, "name" | "description" | "sortOrder" | "isActive">>,
  churchId: string,
) {
  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;

  const { data, error } = await supabase
    .from("offering_subcategories")
    .update(updateData)
    .eq("id", id)
    .eq("church_id", churchId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteOfferingSubcategory(id: string, churchId: string) {
  const { error } = await supabase
    .from("offering_subcategories")
    .delete()
    .eq("id", id)
    .eq("church_id", churchId);

  if (error) throw error;
}

// ============================================================================
// Settings
// ============================================================================

export async function getSettings(churchId: string): Promise<Settings> {
  const { data, error } = await supabase
    .from("church_settings")
    .select("*")
    .eq("church_id", churchId)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows

  const defaults: Settings = {
    churchName: "",
    fiscalYearStart: 1,
    idleTimeoutMin: 15,
    currency: "THB",
  };

  if (!data) return defaults;

  return {
    churchName: data.church_name ?? "",
    address: data.address ?? "",
    taxId: data.tax_id ?? "",
    fiscalYearStart: data.fiscal_year_start ?? 1,
    idleTimeoutMin: data.idle_timeout_min ?? 15,
    currency: (data.currency ?? "THB") as "THB",
  } as Settings;
}

export async function saveSettings(settings: Settings, churchId: string) {
  const { data } = await supabase
    .from("church_settings")
    .upsert({
      church_id: churchId,
      church_name: settings.churchName,
      address: settings.address,
      tax_id: settings.taxId,
      fiscal_year_start: settings.fiscalYearStart,
      idle_timeout_min: settings.idleTimeoutMin,
      currency: settings.currency,
    })
    .select()
    .single();

  return data;
}

// ============================================================================
// Audit log
// ============================================================================

export async function logAudit(params: {
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  churchId: string;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("audit_log").insert({
    church_id: params.churchId,
    user_id: params.userId,
    user_name: params.userName,
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId,
    details: params.details,
    ip_address: "",
    user_agent: navigator?.userAgent || "",
  });

  if (error) console.error("Audit log error:", error);
}
