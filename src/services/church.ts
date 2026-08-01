// src/services/church.ts — Updated for Supabase
// Replaces mock-db.ts. All functions now talk to Supabase.
// Changes:
// 1. Each function queries/writes to Supabase tables
// 2. Auth is handled by Supabase (not localStorage PIN)
// 3. Realtime subscriptions for live updates (optional, see below)
// 4. Church_id is implicitly enforced by Supabase RLS policies

import { supabase } from "./supabaseClient";
import { deleteAttachment } from "./storage";
import { now } from "@/lib/format";
import {
  apiCreateIncome,
  apiDeleteIncome,
  apiApproveIncome,
  apiRejectIncome,
  apiCreateExpense,
  apiDeleteExpense,
  apiApproveExpense,
  apiRejectExpense,
  apiCreateOfferingFinancial,
  apiDeleteOfferingFinancial,
  apiCreateFund,
  apiCreateTransfer,
} from "./api";
import type {
  AuditLog,
  Budget,
  Category,
  Expense,
  Fund,
  Income,
  Member,
  Offering,
  OfferingCategory,
  OfferingSubcategory,
  Project,
  Settings,
  TxStatus,
  User,
} from "@/lib/types";

// Helper to get current user's church_id (cached per session)
let cachedChurchId: string | null = null;
let cachedUserId: string | null = null;

export async function getChurchId(): Promise<string> {
  if (cachedChurchId) return cachedChurchId;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await supabase
    .from("users")
    .select("church_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!userData) throw new Error("User not registered in any church");
  const id: string = userData.church_id;
  cachedChurchId = id;
  return id;
}

// Current user's public.users.id (NOT the auth.users id).
// created_by/approved_by/user_id columns reference users(id), so the auth uid
// must never be written to those columns.
export async function getCurrentUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!userData) throw new Error("User not registered in any church");
  const id: string = userData.id;
  cachedUserId = id;
  return id;
}

export function clearChurchIdCache() {
  cachedChurchId = null;
  cachedUserId = null;
}

// ── Users ────────────────────────────────────────────────────────

export async function listUsers(): Promise<User[]> {
  const churchId = await getChurchId();
  return listUsersByChurch(churchId);
}

export async function listUsersByChurch(churchId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("church_id", churchId)
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return (data || []) as User[];
}

// ── Categories ────────────────────────────────────────────────────

export async function listCategories(): Promise<Category[]> {
  const churchId = await getChurchId();
  return listCategoriesByChurch(churchId);
}

export async function listCategoriesByChurch(churchId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("church_id", churchId)
    .order("sort_order");

  if (error) throw error;
  return (data || []) as Category[];
}

// ── Funds ─────────────────────────────────────────────────────────

export async function listFunds(): Promise<Fund[]> {
  const churchId = await getChurchId();
  return listFundsByChurch(churchId);
}

export async function listFundsByChurch(churchId: string): Promise<Fund[]> {
  const { data, error } = await supabase
    .from("funds")
    .select("*")
    .eq("church_id", churchId)
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw error;
  return (data || []) as Fund[];
}

/**
 * Create a fund transfer through the server API.
 * The server handles journal entries, balance updates, and audit logging.
 */
export async function transferFund(fromId: string, toId: string, amount: number, _by: User) {
  const result = await apiCreateTransfer({
    fromFundId: fromId,
    toFundId: toId,
    amount: amount,
    description: `Transfer ${amount} from fund ${fromId} to ${toId}`,
    postingDate: new Date().toISOString().split("T")[0],
    fiscalYear: new Date().getFullYear(),
    fiscalPeriod: new Date().getMonth() + 1,
  });
  return result;
}

/**
 * Create a fund through the server API.
 * The server handles audit logging and category setup.
 */
export async function createFund(
  input: Omit<Fund, "id" | "createdAt" | "currentBalance">,
  _by: User,
) {
  const result = await apiCreateFund({
    fundCode: input.fundCode,
    name: input.name,
    accountId: input.accountId,
    description: input.description,
    isRestricted: input.isRestricted,
    openingBalance: input.openingBalance,
  });
  return result as Fund;
}

// ── Income ────────────────────────────────────────────────────────

export async function listIncome(): Promise<Income[]> {
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from("incomes")
    .select("*")
    .eq("church_id", churchId)
    .order("date", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data || []) as Income[];
}

export async function createIncome(
  input: Omit<Income, "id" | "createdBy" | "status" | "createdAt"> & { status?: TxStatus },
  _by: User,
) {
  const result = await apiCreateIncome(input as unknown as Record<string, unknown>);
  return result as Income;
}

export async function deleteIncome(id: string, _by: User) {
  await apiDeleteIncome(id);
}

export async function approveIncome(id: string, _by: User) {
  const result = await apiApproveIncome(id);
  return result;
}

// ── Expense ───────────────────────────────────────────────────────

export async function listExpense(): Promise<Expense[]> {
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("church_id", churchId)
    .order("date", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data || []) as Expense[];
}

export async function createExpense(
  input: Omit<Expense, "id" | "createdBy" | "status" | "createdAt"> & { status?: TxStatus },
  _by: User,
) {
  const result = await apiCreateExpense(input as unknown as Record<string, unknown>);
  return result as Expense;
}

export async function deleteExpense(id: string, _by: User) {
  await apiDeleteExpense(id);
}

/**
 * Set expense status via server API.
 * Accepts optional rejectReason for rejections.
 * The server handles self-approval prevention, journal entry creation (on approve),
 * and audit logging automatically.
 */
export async function setExpenseStatus(
  id: string,
  status: TxStatus,
  _by: User,
  rejectReason?: string,
) {
  if (status === "approved") {
    return apiApproveExpense(id);
  }
  if (status === "rejected") {
    return apiRejectExpense(id, rejectReason ?? "Rejected");
  }
  throw new Error(`Unsupported status transition: ${status}`);
}

// ── Offering ──────────────────────────────────────────────────────

export async function listOffering(): Promise<Offering[]> {
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from("offerings")
    .select("*")
    .eq("church_id", churchId)
    .order("date", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data || []) as Offering[];
}

export async function createOffering(
  input: Omit<Offering, "id" | "createdBy" | "createdAt">,
  _by: User,
) {
  const result = await apiCreateOfferingFinancial(input as unknown as Record<string, unknown>);
  return result as Offering;
}

export async function deleteOffering(id: string, _by: User) {
  await apiDeleteOfferingFinancial(id);
}

// ── Offering Categories ────────────────────────────────────────────

export async function listOfferingCategories(): Promise<OfferingCategory[]> {
  const churchId = await getChurchId();
  return listOfferingCategoriesByChurch(churchId);
}

export async function listOfferingCategoriesByChurch(
  churchId: string,
): Promise<OfferingCategory[]> {
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
  input: Pick<OfferingCategory, "name" | "color" | "icon"> & { description?: string },
  by: User,
) {
  const churchId = await getChurchId();

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
  await logAudit(by.id, by.name, "create", "category", data.id, input.name);
  return data as OfferingCategory;
}

export async function updateOfferingCategory(
  id: string,
  input: Partial<
    Pick<OfferingCategory, "name" | "color" | "icon" | "description" | "sortOrder" | "isActive">
  >,
  by: User,
) {
  const churchId = await getChurchId();

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
  await logAudit(by.id, by.name, "update", "category", id);
  return data;
}

export async function deleteOfferingCategory(id: string, by: User) {
  const churchId = await getChurchId();

  const { error } = await supabase
    .from("offering_categories")
    .delete()
    .eq("id", id)
    .eq("church_id", churchId);

  if (error) throw error;
  await logAudit(by.id, by.name, "delete", "category", id);
}

export async function reorderOfferingCategories(orderedIds: string[], by: User) {
  const churchId = await getChurchId();

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("offering_categories")
      .update({ sort_order: i + 1 })
      .eq("id", orderedIds[i])
      .eq("church_id", churchId);

    if (error) throw error;
  }

  await logAudit(by.id, by.name, "reorder", "category");
}

// ── Offering Subcategories ────────────────────────────────────────

export async function listOfferingSubcategories(
  categoryId?: string,
): Promise<OfferingSubcategory[]> {
  const churchId = await getChurchId();

  let query = supabase.from("offering_subcategories").select("*").eq("church_id", churchId);

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query.order("sort_order");
  if (error) throw error;
  return (data || []) as OfferingSubcategory[];
}

export async function createOfferingSubcategory(
  input: Pick<OfferingSubcategory, "categoryId" | "name"> & { description?: string },
  by: User,
) {
  const churchId = await getChurchId();

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
  await logAudit(by.id, by.name, "create", "subcategory", data.id, input.name);
  return data as OfferingSubcategory;
}

export async function updateOfferingSubcategory(
  id: string,
  input: Partial<Pick<OfferingSubcategory, "name" | "description" | "sortOrder" | "isActive">>,
  by: User,
) {
  const churchId = await getChurchId();

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
  await logAudit(by.id, by.name, "update", "subcategory", id);
  return data;
}

export async function deleteOfferingSubcategory(id: string, by: User) {
  const churchId = await getChurchId();

  const { error } = await supabase
    .from("offering_subcategories")
    .delete()
    .eq("id", id)
    .eq("church_id", churchId);

  if (error) throw error;
  await logAudit(by.id, by.name, "delete", "subcategory", id);
}

// ── Budget ────────────────────────────────────────────────────────

export async function listBudget(): Promise<Budget[]> {
  const churchId = await getChurchId();

  const { data, error } = await supabase.from("budgets").select("*").eq("church_id", churchId);

  if (error) throw error;
  return (data || []) as Budget[];
}

// ── Projects ──────────────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  const churchId = await getChurchId();

  const { data, error } = await supabase.from("projects").select("*").eq("church_id", churchId);

  if (error) throw error;
  return (data || []) as Project[];
}

export async function createProject(input: Omit<Project, "id" | "used" | "progress">, by: User) {
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from("projects")
    .insert({
      church_id: churchId,
      name: input.name,
      budget: input.budget,
      used: 0,
      progress: 0,
      owner_id: input.ownerId ?? null,
      start_date: input.startDate,
      end_date: input.endDate ?? null,
      status: input.status ?? "planning",
      description: input.description ?? "",
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit(by.id, by.name, "create", "project", data.id, input.name);
  return data as Project;
}

// ── Members ───────────────────────────────────────────────────────

export async function listMembers(): Promise<Member[]> {
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("church_id", churchId)
    .order("name");

  if (error) throw error;
  return (data || []) as Member[];
}

export async function createMember(input: Omit<Member, "id">, by: User) {
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from("members")
    .insert({
      church_id: churchId,
      ...input,
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit(by.id, by.name, "create", "member", data.id, input.name);
  return data;
}

// ── Settings ──────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  const churchId = await getChurchId();
  return getSettingsForChurch(churchId);
}

export async function getSettingsForChurch(churchId: string): Promise<Settings> {
  const { data, error } = await supabase
    .from("church_settings")
    .select("*")
    .eq("church_id", churchId)
    .single();

  if (error && error.code !== "PGRST116") throw error;

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

export async function saveSettings(s: Settings, by: User) {
  const churchId = await getChurchId();

  const { data } = await supabase
    .from("church_settings")
    .upsert({
      church_id: churchId,
      church_name: s.churchName,
      address: s.address,
      tax_id: s.taxId,
      fiscal_year_start: s.fiscalYearStart,
      idle_timeout_min: s.idleTimeoutMin,
      currency: s.currency,
    })
    .select()
    .single();

  await logAudit(by.id, by.name, "update", "settings");
  return data;
}

// ── Audit ─────────────────────────────────────────────────────────

/**
 * Map snake_case Supabase audit_log row to camelCase AuditLog type.
 * The audit_log table stores columns like created_at, user_id, user_name,
 * but the frontend AuditLog interface uses camelCase (at, userId, userName).
 */
function transformAuditLog(row: Record<string, unknown>): AuditLog {
  return {
    id: row.id as string,
    at: row.created_at as string,
    userId: row.user_id as string,
    userName: row.user_name as string,
    action: row.action as string,
    entity: row.entity as string,
    entityId: (row.entity_id as string) ?? undefined,
    details: (row.details as string) ?? undefined,
  };
}

export async function listAudit() {
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from("audit_log")
    .select("id, created_at, user_id, user_name, action, entity, entity_id, details")
    .eq("church_id", churchId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  return (data || []).map(transformAuditLog);
}

// ── Helpers ────────────────────────────────────────────────────────

async function logAudit(
  userId: string,
  userName: string,
  action: string,
  entity: string,
  entityId?: string,
  details?: string,
) {
  const churchId = await getChurchId();

  await supabase.from("audit_log").insert({
    church_id: churchId,
    user_id: userId,
    user_name: userName,
    action,
    entity,
    entity_id: entityId,
    details,
    ip_address: "",
    user_agent: "",
  });
}

// ── LINE Integration ──────────────────────────────────────────────

export async function linkLineUser(lineUserId: string, by: User) {
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from("line_users")
    .upsert(
      {
        church_id: churchId,
        line_user_id: lineUserId,
        user_id: by.id,
        linked_at: new Date().toISOString(),
      },
      { onConflict: "line_user_id" },
    )
    .select()
    .single();

  if (error) throw error;
  await logAudit(by.id, by.name, "link", "line_user", data.id, lineUserId);
  return data;
}

export async function unlinkLineUser(by: User) {
  const churchId = await getChurchId();

  const { error } = await supabase
    .from("line_users")
    .delete()
    .eq("church_id", churchId)
    .eq("user_id", by.id);

  if (error) throw error;
  await logAudit(by.id, by.name, "unlink", "line_user");
}

export async function getLineUserStatus(): Promise<{ linked: boolean; lineUserId?: string }> {
  let churchId: string;
  let userId: string;
  try {
    churchId = await getChurchId();
    userId = await getCurrentUserId();
  } catch {
    return { linked: false };
  }

  const { data } = await supabase
    .from("line_users")
    .select("line_user_id")
    .eq("church_id", churchId)
    .eq("user_id", userId)
    .single();

  return data ? { linked: true, lineUserId: data.line_user_id } : { linked: false };
}

export async function listLineUsers() {
  const churchId = await getChurchId();
  const { data, error } = await supabase.from("line_users").select("*").eq("church_id", churchId);
  if (error) return [];
  return data || [];
}
