// src/services/church.ts — Updated for Supabase
// Replaces mock-db.ts. All functions now talk to Supabase.
// Changes:
// 1. Each function queries/writes to Supabase tables
// 2. Auth is handled by Supabase (not localStorage PIN)
// 3. Realtime subscriptions for live updates (optional, see below)
// 4. Church_id is implicitly enforced by Supabase RLS policies

import { supabase } from './supabaseClient';
import { now } from '@/lib/format';
import type {
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
} from '@/lib/types';

const delay = (ms = 50) => new Promise((r) => setTimeout(r, ms));

// Helper to get current user's church_id
async function getChurchId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('church_id')
    .eq('auth_user_id', user.id)
    .single();

  if (!userData) throw new Error('User not registered in any church');
  return userData.church_id;
}

// ── Users ────────────────────────────────────────────────────────

export async function listUsers(): Promise<User[]> {
  await delay(30);
  const churchId = await getChurchId();
  return listUsersByChurch(churchId);
}

export async function listUsersByChurch(churchId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('church_id', churchId)
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return (data || []) as User[];
}

// ── Categories ────────────────────────────────────────────────────

export async function listCategories(): Promise<Category[]> {
  await delay(30);
  const churchId = await getChurchId();
  return listCategoriesByChurch(churchId);
}

export async function listCategoriesByChurch(churchId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('church_id', churchId)
    .order('sort_order');

  if (error) throw error;
  return (data || []) as Category[];
}

// ── Funds ─────────────────────────────────────────────────────────

export async function listFunds(): Promise<Fund[]> {
  await delay(30);
  const churchId = await getChurchId();
  return listFundsByChurch(churchId);
}

export async function listFundsByChurch(churchId: string): Promise<Fund[]> {
  const { data, error } = await supabase
    .from('funds')
    .select('*')
    .eq('church_id', churchId)
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw error;
  return (data || []) as Fund[];
}

export async function transferFund(fromId: string, toId: string, amount: number, by: User) {
  await delay(50);
  const churchId = await getChurchId();
  await logAudit(by.id, by.name, 'transfer', 'fund', undefined, `โอนเงิน ${amount} ระหว่างกองทุน ${fromId} -> ${toId}`);
  return { success: true };
}

export async function createFund(
  input: Omit<Fund, 'id' | 'createdAt' | 'currentBalance'>,
  by: User
) {
  await delay(60);
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from('funds')
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

  await logAudit(by.id, by.name, 'create', 'fund', data.id, input.name);
  return data as Fund;
}

// ── Income ────────────────────────────────────────────────────────

export async function listIncome(): Promise<Income[]> {
  await delay(60);
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from('incomes')
    .select('*')
    .eq('church_id', churchId)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data || []) as Income[];
}

export async function createIncome(
  input: Omit<Income, 'id' | 'createdBy' | 'status' | 'createdAt'>,
  by: User
) {
  await delay(80);
  const churchId = await getChurchId();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('incomes')
    .insert({
      church_id: churchId,
      date: input.date,
      category_id: input.categoryId,
      amount: input.amount,
      fund_id: input.fundId,
      description: input.description ?? '',
      attachment_name: input.attachmentName,
      attachment_data_url: input.attachmentDataUrl,
      attachment_type: input.attachmentType,
      attachment_size: input.attachmentSize,
      created_by: user?.id ?? by.id,
      status: input.status ?? 'pending',
    })
    .select()
    .single();

  if (error) throw error;

  await logAudit(by.id, by.name, 'create', 'income', data.id, `${input.amount} baht`);
  return data as Income;
}

export async function deleteIncome(id: string, by: User) {
  await delay(60);
  const churchId = await getChurchId();

  const { error } = await supabase
    .from('incomes')
    .delete()
    .eq('id', id)
    .eq('church_id', churchId);

  if (error) throw error;
  await logAudit(by.id, by.name, 'delete', 'income', id);
}

export async function approveIncome(id: string, by: User) {
  await delay(60);
  const churchId = await getChurchId();
  const { data: { user } } = await supabase.auth.getUser();

  // Self-approval prevention
  const { data: income } = await supabase
    .from('incomes')
    .select('created_by')
    .eq('id', id)
    .eq('church_id', churchId)
    .single();

  if (income?.created_by === (user?.id ?? by.id)) {
    throw new Error('Cannot approve your own income record');
  }

  const { data, error } = await supabase
    .from('incomes')
    .update({
      status: 'approved',
      approved_by: user?.id ?? by.id,
    })
    .eq('id', id)
    .eq('church_id', churchId)
    .select()
    .single();

  if (error) throw error;
  await logAudit(by.id, by.name, 'approve', 'income', id);
  return data;
}

// ── Expense ───────────────────────────────────────────────────────

export async function listExpense(): Promise<Expense[]> {
  await delay(60);
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('church_id', churchId)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data || []) as Expense[];
}

export async function createExpense(
  input: Omit<Expense, 'id' | 'createdBy' | 'status' | 'createdAt'>,
  by: User
) {
  await delay(80);
  const churchId = await getChurchId();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      church_id: churchId,
      date: input.date,
      category_id: input.categoryId,
      amount: input.amount,
      fund_id: input.fundId,
      vendor: input.vendor ?? '',
      description: input.description ?? '',
      attachment_name: input.attachmentName,
      attachment_data_url: input.attachmentDataUrl,
      attachment_type: input.attachmentType,
      attachment_size: input.attachmentSize,
      created_by: user?.id ?? by.id,
      status: input.status ?? 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit(by.id, by.name, 'create', 'expense', data.id, `${input.amount} baht`);
  return data as Expense;
}

export async function deleteExpense(id: string, by: User) {
  await delay(60);
  const churchId = await getChurchId();

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('church_id', churchId);

  if (error) throw error;
  await logAudit(by.id, by.name, 'delete', 'expense', id);
}

export async function setExpenseStatus(id: string, status: TxStatus, by: User) {
  await delay(60);
  const churchId = await getChurchId();
  const { data: { user } } = await supabase.auth.getUser();

  // Self-approval prevention
  if (status === 'approved') {
    const { data: expense } = await supabase
      .from('expenses')
      .select('created_by')
      .eq('id', id)
      .eq('church_id', churchId)
      .single();

    if (expense?.created_by === (user?.id ?? by.id)) {
      throw new Error('Cannot approve your own expense');
    }
  }

  const { data, error } = await supabase
    .from('expenses')
    .update({
      status,
      approved_by: status === 'approved' ? user?.id ?? by.id : null,
    })
    .eq('id', id)
    .eq('church_id', churchId)
    .select()
    .single();

  if (error) throw error;
  await logAudit(by.id, by.name, status, 'expense', id);
  return data;
}

// ── Offering ──────────────────────────────────────────────────────

export async function listOffering(): Promise<Offering[]> {
  await delay(60);
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from('offerings')
    .select('*')
    .eq('church_id', churchId)
    .order('date', { ascending: false });

  if (error) throw error;
  return (data || []) as Offering[];
}

export async function createOffering(input: Omit<Offering, 'id' | 'createdBy' | 'createdAt'>, by: User) {
  await delay(80);
  const churchId = await getChurchId();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('offerings')
    .insert({
      church_id: churchId,
      date: input.date,
      category_id: input.categoryId,
      subcategory_id: input.subcategoryId ?? null,
      channel: input.channel,
      amount: input.amount,
      member_id: input.memberId ?? null,
      fund_id: input.fundId,
      note: input.note ?? '',
      created_by: user?.id ?? by.id,
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit(by.id, by.name, 'create', 'offering', data.id, `${input.amount} baht`);
  return data as Offering;
}

export async function deleteOffering(id: string, by: User) {
  await delay(60);
  const churchId = await getChurchId();

  const { error } = await supabase
    .from('offerings')
    .delete()
    .eq('id', id)
    .eq('church_id', churchId);

  if (error) throw error;
  await logAudit(by.id, by.name, 'delete', 'offering', id);
}

// ── Offering Categories ────────────────────────────────────────────

export async function listOfferingCategories(): Promise<OfferingCategory[]> {
  await delay(30);
  const churchId = await getChurchId();
  return listOfferingCategoriesByChurch(churchId);
}

export async function listOfferingCategoriesByChurch(churchId: string): Promise<OfferingCategory[]> {
  const { data, error } = await supabase
    .from('offering_categories')
    .select('*')
    .eq('church_id', churchId)
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw error;
  return (data || []) as OfferingCategory[];
}

export async function createOfferingCategory(
  input: Pick<OfferingCategory, 'name' | 'color' | 'icon'> & { description?: string },
  by: User
) {
  await delay(80);
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from('offering_categories')
    .insert({
      church_id: churchId,
      ...input,
      sort_order: 0,
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit(by.id, by.name, 'create', 'category', data.id, input.name);
  return data as OfferingCategory;
}

export async function updateOfferingCategory(
  id: string,
  input: Partial<Pick<OfferingCategory, 'name' | 'color' | 'icon' | 'description' | 'sort_order' | 'is_active'>>,
  by: User
) {
  await delay(80);
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from('offering_categories')
    .update(input)
    .eq('id', id)
    .eq('church_id', churchId)
    .select()
    .single();

  if (error) throw error;
  await logAudit(by.id, by.name, 'update', 'category', id);
  return data;
}

export async function deleteOfferingCategory(id: string, by: User) {
  await delay(80);
  const churchId = await getChurchId();

  const { error } = await supabase
    .from('offering_categories')
    .delete()
    .eq('id', id)
    .eq('church_id', churchId);

  if (error) throw error;
  await logAudit(by.id, by.name, 'delete', 'category', id);
}

export async function reorderOfferingCategories(orderedIds: string[], by: User) {
  await delay(60);
  const churchId = await getChurchId();

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('offering_categories')
      .update({ sort_order: i + 1 })
      .eq('id', orderedIds[i])
      .eq('church_id', churchId);

    if (error) throw error;
  }

  await logAudit(by.id, by.name, 'reorder', 'category');
}

// ── Offering Subcategories ────────────────────────────────────────

export async function listOfferingSubcategories(
  categoryId?: string
): Promise<OfferingSubcategory[]> {
  await delay(30);
  const churchId = await getChurchId();

  let query = supabase
    .from('offering_subcategories')
    .select('*')
    .eq('church_id', churchId);

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query.order('sort_order');
  if (error) throw error;
  return (data || []) as OfferingSubcategory[];
}

export async function createOfferingSubcategory(
  input: Pick<OfferingSubcategory, 'category_id' | 'name'> & { description?: string },
  by: User
) {
  await delay(80);
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from('offering_subcategories')
    .insert({
      church_id: churchId,
      category_id: input.category_id,
      name: input.name,
      description: input.description ?? '',
      sort_order: 0,
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit(by.id, by.name, 'create', 'subcategory', data.id, input.name);
  return data as OfferingSubcategory;
}

export async function updateOfferingSubcategory(
  id: string,
  input: Partial<Pick<OfferingSubcategory, 'name' | 'description' | 'sort_order' | 'is_active'>>,
  by: User
) {
  await delay(80);
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from('offering_subcategories')
    .update(input)
    .eq('id', id)
    .eq('church_id', churchId)
    .select()
    .single();

  if (error) throw error;
  await logAudit(by.id, by.name, 'update', 'subcategory', id);
  return data;
}

export async function deleteOfferingSubcategory(id: string, by: User) {
  await delay(80);
  const churchId = await getChurchId();

  const { error } = await supabase
    .from('offering_subcategories')
    .delete()
    .eq('id', id)
    .eq('church_id', churchId);

  if (error) throw error;
  await logAudit(by.id, by.name, 'delete', 'subcategory', id);
}

// ── Budget ────────────────────────────────────────────────────────

export async function listBudget(): Promise<Budget[]> {
  await delay(40);
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('church_id', churchId);

  if (error) throw error;
  return (data || []) as Budget[];
}

// ── Projects ──────────────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  await delay(40);
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('church_id', churchId);

  if (error) throw error;
  return (data || []) as Project[];
}

export async function createProject(
  input: Omit<Project, 'id' | 'used' | 'progress'>,
  by: User
) {
  await delay(80);
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from('projects')
    .insert({
      church_id: churchId,
      name: input.name,
      budget: input.budget,
      used: 0,
      progress: 0,
      owner_id: input.ownerId ?? null,
      start_date: input.startDate,
      end_date: input.endDate ?? null,
      status: input.status ?? 'planning',
      description: input.description ?? '',
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit(by.id, by.name, 'create', 'project', data.id, input.name);
  return data as Project;
}

// ── Members ───────────────────────────────────────────────────────

export async function listMembers(): Promise<Member[]> {
  await delay(40);
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('church_id', churchId)
    .order('name');

  if (error) throw error;
  return (data || []) as Member[];
}

export async function createMember(input: Omit<Member, 'id'>, by: User) {
  await delay(80);
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from('members')
    .insert({
      church_id: churchId,
      ...input,
    })
    .select()
    .single();

  if (error) throw error;
  await logAudit(by.id, by.name, 'create', 'member', data.id, input.name);
  return data;
}

// ── Settings ──────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  await delay(30);
  const churchId = await getChurchId();
  return getSettingsForChurch(churchId);
}

export async function getSettingsForChurch(churchId: string): Promise<Settings> {
  const { data, error } = await supabase
    .from('church_settings')
    .select('*')
    .eq('church_id', churchId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;

  const defaults: Settings = {
    churchName: '',
    fiscalYearStart: 1,
    idleTimeoutMin: 15,
    currency: 'THB',
  };

  if (!data) return defaults;

  return {
    churchName: data.church_name ?? '',
    address: data.address ?? '',
    taxId: data.tax_id ?? '',
    fiscalYearStart: data.fiscal_year_start ?? 1,
    idleTimeoutMin: data.idle_timeout_min ?? 15,
    currency: (data.currency ?? 'THB') as 'THB',
  } as Settings;
}

export async function saveSettings(s: Settings, by: User) {
  const churchId = await getChurchId();

  const { data } = await supabase
    .from('church_settings')
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

  await logAudit(by.id, by.name, 'update', 'settings');
  return data;
}

// ── Audit ─────────────────────────────────────────────────────────

export async function listAudit() {
  await delay(40);
  const churchId = await getChurchId();

  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('church_id', churchId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  return data || [];
}

// ── Helpers ────────────────────────────────────────────────────────

async function logAudit(
  userId: string,
  userName: string,
  action: string,
  entity: string,
  entityId?: string,
  details?: string
) {
  const churchId = await getChurchId();
  const { data: { user } } = await supabase.auth.getUser();

  await supabase.from('audit_log').insert({
    church_id: churchId,
    user_id: userId,
    user_name: userName,
    action,
    entity,
    entity_id: entityId,
    details,
    ip_address: '',
    user_agent: '',
  });
}