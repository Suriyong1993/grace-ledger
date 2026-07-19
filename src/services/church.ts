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
  updateDb((db) => { db.funds.push({ ...input, id, createdAt: now() }); });
  logAudit({ userId: by.id, userName: by.name, action: "create", entity: "fund", entityId: id, details: input.name });
  return id;
}
export async function transferFund(fromId: string, toId: string, amount: number, by: User) {
  await delay(150);
  const t = now();
  updateDb((db) => {
    db.expenses.unshift({ id: newId("e"), date: t.slice(0, 10), categoryId: "c-oth-e", amount, fundId: fromId, description: `โอนไปยังกองทุน`, createdBy: by.id, status: "approved" });
    db.incomes.unshift({ id: newId("i"), date: t.slice(0, 10), categoryId: "c-oth-i", amount, fundId: toId, description: `รับโอนจากกองทุน`, createdBy: by.id, status: "approved" });
  });
  logAudit({ userId: by.id, userName: by.name, action: "transfer", entity: "fund", details: `${fromId} → ${toId} ${amount}` });
}

// income
export async function listIncome(): Promise<Income[]> {
  await delay(80);
  return [...loadDb().incomes].sort((a, b) => b.date.localeCompare(a.date));
}
export async function createIncome(input: Omit<Income, "id" | "createdBy" | "status"> & { status?: TxStatus }, by: User) {
  await delay(120);
  const id = newId("i");
  updateDb((db) => { db.incomes.unshift({ ...input, id, createdBy: by.id, status: input.status ?? "pending" }); });
  logAudit({ userId: by.id, userName: by.name, action: "create", entity: "income", entityId: id, details: `${input.amount}` });
  return id;
}
export async function deleteIncome(id: string, by: User) {
  await delay(80);
  updateDb((db) => { db.incomes = db.incomes.filter((x) => x.id !== id); });
  logAudit({ userId: by.id, userName: by.name, action: "delete", entity: "income", entityId: id });
}
export async function approveIncome(id: string, by: User) {
  await delay(80);
  updateDb((db) => {
    const it = db.incomes.find((x) => x.id === id);
    if (it) { it.status = "approved"; it.approvedBy = by.id; }
  });
  logAudit({ userId: by.id, userName: by.name, action: "approve", entity: "income", entityId: id });
}

// expense
export async function listExpense(): Promise<Expense[]> {
  await delay(80);
  return [...loadDb().expenses].sort((a, b) => b.date.localeCompare(a.date));
}
export async function createExpense(input: Omit<Expense, "id" | "createdBy" | "status"> & { status?: TxStatus }, by: User) {
  await delay(120);
  const id = newId("e");
  updateDb((db) => { db.expenses.unshift({ ...input, id, createdBy: by.id, status: input.status ?? "pending" }); });
  logAudit({ userId: by.id, userName: by.name, action: "create", entity: "expense", entityId: id, details: `${input.amount}` });
  return id;
}
export async function deleteExpense(id: string, by: User) {
  await delay(80);
  updateDb((db) => { db.expenses = db.expenses.filter((x) => x.id !== id); });
  logAudit({ userId: by.id, userName: by.name, action: "delete", entity: "expense", entityId: id });
}
export async function setExpenseStatus(id: string, status: TxStatus, by: User) {
  await delay(80);
  updateDb((db) => {
    const it = db.expenses.find((x) => x.id === id);
    if (it) { it.status = status; if (status === "approved") it.approvedBy = by.id; }
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
  updateDb((db) => { db.offerings.unshift({ ...input, id, createdBy: by.id }); });
  logAudit({ userId: by.id, userName: by.name, action: "create", entity: "offering", entityId: id, details: `${input.amount}` });
  return id;
}
export async function deleteOffering(id: string, by: User) {
  await delay(80);
  updateDb((db) => { db.offerings = db.offerings.filter((x) => x.id !== id); });
  logAudit({ userId: by.id, userName: by.name, action: "delete", entity: "offering", entityId: id });
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
  updateDb((db) => { db.projects.push({ ...input, id, used: 0, progress: 0 }); });
  logAudit({ userId: by.id, userName: by.name, action: "create", entity: "project", entityId: id, details: input.name });
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
  updateDb((db) => { db.members.push({ ...input, id }); });
  logAudit({ userId: by.id, userName: by.name, action: "create", entity: "member", entityId: id, details: input.name });
  return id;
}
export async function deleteMember(id: string, by: User) {
  await delay(80);
  updateDb((db) => { db.members = db.members.filter((x) => x.id !== id); });
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
  updateDb((db) => { db.settings = s; });
  logAudit({ userId: by.id, userName: by.name, action: "update", entity: "settings" });
}