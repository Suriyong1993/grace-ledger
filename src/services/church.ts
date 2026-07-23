/**
 * Domain service layer. Phase 1 uses a localStorage-backed mock DB.
 * Swap the bodies to call `http.get/post/...` when a real backend arrives.
 */
import { loadDb, logAudit, newId, updateDb } from "@/lib/mock-db";
import { now } from "@/lib/format";
import { delay } from "./api";
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
} from "@/lib/types";

// users
export async function listUsers(): Promise<User[]> {
  await delay(60);
  return [...loadDb().users];
}
export async function updateUserPin(id: string, pin: string) {
  await delay(60);
  updateDb((db) => {
    const u = db.users.find((x) => x.id === id);
    if (u) u.pin = pin;
  });
}

// categories
export async function listCategories(): Promise<Category[]> {
  await delay(30);
  return [...loadDb().categories];
}

// funds
export async function listFunds(): Promise<Fund[]> {
  await delay(60);
  return [...loadDb().funds];
}
export async function createFund(input: Omit<Fund, "id" | "createdAt">, by: User) {
  await delay(120);
  const id = newId("f");
  updateDb((db) => {
    db.funds.push({ ...input, id, createdAt: now() });
  });
  logAudit({
    userId: by.id,
    userName: by.name,
    action: "create",
    entity: "fund",
    entityId: id,
    details: input.name,
  });
  return id;
}
export async function transferFund(fromId: string, toId: string, amount: number, by: User) {
  await delay(150);
  const t = now();
  updateDb((db) => {
    db.expenses.unshift({
      id: newId("e"),
      date: t.slice(0, 10),
      categoryId: "c-oth-e",
      amount,
      fundId: fromId,
      description: `โอนไปยังกองทุน`,
      createdBy: by.id,
      status: "approved",
    });
    db.incomes.unshift({
      id: newId("i"),
      date: t.slice(0, 10),
      categoryId: "c-oth-i",
      amount,
      fundId: toId,
      description: `รับโอนจากกองทุน`,
      createdBy: by.id,
      status: "approved",
    });
  });
  logAudit({
    userId: by.id,
    userName: by.name,
    action: "transfer",
    entity: "fund",
    details: `${fromId} → ${toId} ${amount}`,
  });
}

// income
export async function listIncome(): Promise<Income[]> {
  await delay(80);
  return [...loadDb().incomes].sort((a, b) => b.date.localeCompare(a.date));
}
export async function createIncome(
  input: Omit<Income, "id" | "createdBy" | "status"> & { status?: TxStatus },
  by: User,
) {
  await delay(120);
  const id = newId("i");
  updateDb((db) => {
    db.incomes.unshift({ ...input, id, createdBy: by.id, status: input.status ?? "pending" });
  });
  logAudit({
    userId: by.id,
    userName: by.name,
    action: "create",
    entity: "income",
    entityId: id,
    details: `${input.amount}`,
  });
  return id;
}
export async function deleteIncome(id: string, by: User) {
  await delay(80);
  updateDb((db) => {
    db.incomes = db.incomes.filter((x) => x.id !== id);
  });
  logAudit({ userId: by.id, userName: by.name, action: "delete", entity: "income", entityId: id });
}
export async function approveIncome(id: string, by: User) {
  await delay(80);
  updateDb((db) => {
    const it = db.incomes.find((x) => x.id === id);
    if (it) {
      it.status = "approved";
      it.approvedBy = by.id;
    }
  });
  logAudit({ userId: by.id, userName: by.name, action: "approve", entity: "income", entityId: id });
}

// expense
export async function listExpense(): Promise<Expense[]> {
  await delay(80);
  return [...loadDb().expenses].sort((a, b) => b.date.localeCompare(a.date));
}
export async function createExpense(
  input: Omit<Expense, "id" | "createdBy" | "status"> & { status?: TxStatus },
  by: User,
) {
  await delay(120);
  const id = newId("e");
  updateDb((db) => {
    db.expenses.unshift({ ...input, id, createdBy: by.id, status: input.status ?? "pending" });
  });
  logAudit({
    userId: by.id,
    userName: by.name,
    action: "create",
    entity: "expense",
    entityId: id,
    details: `${input.amount}`,
  });
  return id;
}
export async function deleteExpense(id: string, by: User) {
  await delay(80);
  updateDb((db) => {
    db.expenses = db.expenses.filter((x) => x.id !== id);
  });
  logAudit({ userId: by.id, userName: by.name, action: "delete", entity: "expense", entityId: id });
}
export async function setExpenseStatus(id: string, status: TxStatus, by: User) {
  await delay(80);
  updateDb((db) => {
    const it = db.expenses.find((x) => x.id === id);
    if (it) {
      it.status = status;
      if (status === "approved") it.approvedBy = by.id;
    }
  });
  logAudit({ userId: by.id, userName: by.name, action: status, entity: "expense", entityId: id });
}

// offering
export async function listOffering(): Promise<Offering[]> {
  await delay(80);
  return [...loadDb().offerings].sort((a, b) => b.date.localeCompare(a.date));
}
export async function createOffering(input: Omit<Offering, "id" | "createdBy">, by: User) {
  await delay(120);
  const id = newId("o");
  updateDb((db) => {
    db.offerings.unshift({ ...input, id, createdBy: by.id });
  });
  logAudit({
    userId: by.id,
    userName: by.name,
    action: "create",
    entity: "offering",
    entityId: id,
    details: `${input.amount}`,
  });
  return id;
}
export async function deleteOffering(id: string, by: User) {
  await delay(80);
  updateDb((db) => {
    db.offerings = db.offerings.filter((x) => x.id !== id);
  });
  logAudit({
    userId: by.id,
    userName: by.name,
    action: "delete",
    entity: "offering",
    entityId: id,
  });
}

// budget
export async function listBudget(): Promise<Budget[]> {
  await delay(60);
  return [...loadDb().budgets];
}

// projects
export async function listProjects(): Promise<Project[]> {
  await delay(60);
  return [...loadDb().projects];
}
export async function createProject(input: Omit<Project, "id" | "used" | "progress">, by: User) {
  await delay(120);
  const id = newId("p");
  updateDb((db) => {
    db.projects.push({ ...input, id, used: 0, progress: 0 });
  });
  logAudit({
    userId: by.id,
    userName: by.name,
    action: "create",
    entity: "project",
    entityId: id,
    details: input.name,
  });
  return id;
}

// members
export async function listMembers(): Promise<Member[]> {
  await delay(60);
  return [...loadDb().members];
}
export async function createMember(input: Omit<Member, "id">, by: User) {
  await delay(120);
  const id = newId("m");
  updateDb((db) => {
    db.members.push({ ...input, id });
  });
  logAudit({
    userId: by.id,
    userName: by.name,
    action: "create",
    entity: "member",
    entityId: id,
    details: input.name,
  });
  return id;
}
export async function deleteMember(id: string, by: User) {
  await delay(80);
  updateDb((db) => {
    db.members = db.members.filter((x) => x.id !== id);
  });
  logAudit({ userId: by.id, userName: by.name, action: "delete", entity: "member", entityId: id });
}

// audit
export async function listAudit() {
  await delay(60);
  return [...loadDb().audit];
}

// settings
export async function getSettings(): Promise<Settings> {
  await delay(30);
  return { ...loadDb().settings };
}
export async function saveSettings(s: Settings, by: User) {
  await delay(100);
  updateDb((db) => {
    db.settings = s;
  });
  logAudit({ userId: by.id, userName: by.name, action: "update", entity: "settings" });
}

// ── Offering Categories ──────────────────────────────────────────

export async function listOfferingCategories(): Promise<OfferingCategory[]> {
  await delay(30);
  return [...(loadDb().offeringCategories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getOfferingCategory(id: string): Promise<OfferingCategory | undefined> {
  await delay(20);
  return loadDb().offeringCategories?.find((c) => c.id === id);
}

export async function createOfferingCategory(
  input: Pick<OfferingCategory, "name" | "color" | "icon"> & { description?: string },
  by: User,
): Promise<string> {
  await delay(120);
  const id = newId("cat");
  const ts = now();
  const cats = loadDb().offeringCategories ?? [];
  const maxOrder = cats.reduce((m, c) => Math.max(m, c.sortOrder), 0);
  updateDb((db) => {
    (db.offeringCategories ??= []).push({
      id,
      ...input,
      description: input.description ?? "",
      sortOrder: maxOrder + 1,
      isActive: true,
      createdAt: ts,
      updatedAt: ts,
    });
  });
  logAudit({
    userId: by.id,
    userName: by.name,
    action: "create",
    entity: "category",
    entityId: id,
    details: input.name,
  });
  return id;
}

export async function updateOfferingCategory(
  id: string,
  input: Partial<
    Pick<OfferingCategory, "name" | "color" | "icon" | "description" | "sortOrder" | "isActive">
  >,
  by: User,
) {
  await delay(100);
  updateDb((db) => {
    const cat = (db.offeringCategories ?? []).find((c) => c.id === id);
    if (cat) {
      Object.assign(cat, input, { updatedAt: now() });
    }
  });
  logAudit({
    userId: by.id,
    userName: by.name,
    action: "update",
    entity: "category",
    entityId: id,
  });
}

export async function deleteOfferingCategory(id: string, by: User) {
  await delay(100);
  updateDb((db) => {
    db.offeringCategories = (db.offeringCategories ?? []).filter((c) => c.id !== id);
    db.offeringSubcategories = (db.offeringSubcategories ?? []).filter((s) => s.categoryId !== id);
    // Reassign offerings in this category to "อื่น ๆ" in cat-special
    db.offerings = db.offerings.map((o) =>
      o.categoryId === id ? { ...o, categoryId: "cat-special", subcategoryId: "sub-other" } : o,
    );
  });
  logAudit({
    userId: by.id,
    userName: by.name,
    action: "delete",
    entity: "category",
    entityId: id,
  });
}

export async function reorderOfferingCategories(orderedIds: string[], by: User) {
  await delay(80);
  updateDb((db) => {
    (db.offeringCategories ?? []).forEach((c) => {
      const idx = orderedIds.indexOf(c.id);
      if (idx >= 0) c.sortOrder = idx + 1;
    });
  });
  logAudit({ userId: by.id, userName: by.name, action: "reorder", entity: "category" });
}

// ── Offering Subcategories ───────────────────────────────────────

export async function listOfferingSubcategories(
  categoryId?: string,
): Promise<OfferingSubcategory[]> {
  await delay(30);
  const all = loadDb().offeringSubcategories ?? [];
  const filtered = categoryId ? all.filter((s) => s.categoryId === categoryId) : all;
  return filtered.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function createOfferingSubcategory(
  input: Pick<OfferingSubcategory, "categoryId" | "name"> & { description?: string },
  by: User,
): Promise<string> {
  await delay(120);
  const id = newId("sub");
  const ts = now();
  const subs = loadDb().offeringSubcategories ?? [];
  const maxOrder = subs
    .filter((s) => s.categoryId === input.categoryId)
    .reduce((m, s) => Math.max(m, s.sortOrder), 0);
  updateDb((db) => {
    (db.offeringSubcategories ??= []).push({
      id,
      ...input,
      description: input.description ?? "",
      sortOrder: maxOrder + 1,
      isActive: true,
      createdAt: ts,
      updatedAt: ts,
    });
  });
  logAudit({
    userId: by.id,
    userName: by.name,
    action: "create",
    entity: "subcategory",
    entityId: id,
    details: input.name,
  });
  return id;
}

export async function updateOfferingSubcategory(
  id: string,
  input: Partial<Pick<OfferingSubcategory, "name" | "description" | "sortOrder" | "isActive">>,
  by: User,
) {
  await delay(100);
  updateDb((db) => {
    const sub = (db.offeringSubcategories ?? []).find((s) => s.id === id);
    if (sub) {
      Object.assign(sub, input, { updatedAt: now() });
    }
  });
  logAudit({
    userId: by.id,
    userName: by.name,
    action: "update",
    entity: "subcategory",
    entityId: id,
  });
}

export async function deleteOfferingSubcategory(id: string, by: User) {
  await delay(100);
  updateDb((db) => {
    db.offeringSubcategories = (db.offeringSubcategories ?? []).filter((s) => s.id !== id);
    // Set subcategory to null so the offering still belongs to its category
    db.offerings = db.offerings.map((o) =>
      o.subcategoryId === id ? { ...o, subcategoryId: undefined } : o,
    );
  });
  logAudit({
    userId: by.id,
    userName: by.name,
    action: "delete",
    entity: "subcategory",
    entityId: id,
  });
}
