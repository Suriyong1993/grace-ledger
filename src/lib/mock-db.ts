import type {
  AuditLog,
  Budget,
  Category,
  Expense,
  Fund,
  Income,
  Member,
  Offering,
  Project,
  Settings,
  User,
} from "./types";
import { now } from "./format";

const KEY = "cfm.db.v1";

export interface DB {
  users: User[];
  categories: Category[];
  funds: Fund[];
  incomes: Income[];
  expenses: Expense[];
  offerings: Offering[];
  budgets: Budget[];
  projects: Project[];
  members: Member[];
  audit: AuditLog[];
  settings: Settings;
  session: { userId: string | null };
}

const uid = () => Math.random().toString(36).slice(2, 10);

function seed(): DB {
  const users: User[] = [
    { id: "u1", name: "ศจ. สมชาย", role: "super_admin", pin: "111111", avatarColor: "#F97316" },
    { id: "u2", name: "ศจ. วิชัย", role: "pastor", pin: "222222", avatarColor: "#F59E0B" },
    { id: "u3", name: "คุณศิริ", role: "treasurer", pin: "333333", avatarColor: "#EAB308" },
    { id: "u4", name: "คุณอรุณ", role: "finance_staff", pin: "444444", avatarColor: "#22C55E" },
    { id: "u5", name: "คุณสมหมาย", role: "auditor", pin: "555555", avatarColor: "#0EA5E9" },
    { id: "u6", name: "ผู้ชม", role: "viewer", pin: "666666", avatarColor: "#A855F7" },
  ];

  const categories: Category[] = [
    { id: "c-off", name: "เงินถวาย", kind: "income" },
    { id: "c-dnt", name: "เงินบริจาค", kind: "income" },
    { id: "c-int", name: "ดอกเบี้ย", kind: "income" },
    { id: "c-oth-i", name: "รายรับอื่น ๆ", kind: "income" },
    { id: "c-util", name: "ค่าสาธารณูปโภค", kind: "expense" },
    { id: "c-sal", name: "เงินเดือน", kind: "expense" },
    { id: "c-mis", name: "งานพันธกิจ", kind: "expense" },
    { id: "c-mnt", name: "ซ่อมบำรุง", kind: "expense" },
    { id: "c-oth-e", name: "รายจ่ายอื่น ๆ", kind: "expense" },
  ];

  const funds: Fund[] = [
    { id: "f1", name: "กองทุนทั่วไป", openingBalance: 250000, createdAt: now() },
    { id: "f2", name: "กองทุนก่อสร้าง", openingBalance: 800000, createdAt: now() },
    { id: "f3", name: "กองทุนพันธกิจ", openingBalance: 120000, createdAt: now() },
    { id: "f4", name: "กองทุนอนุชน", openingBalance: 45000, createdAt: now() },
  ];

  const members: Member[] = Array.from({ length: 24 }, (_, i) => ({
    id: `m${i + 1}`,
    name: `สมาชิก ${i + 1}`,
    family: `ครอบครัว ${(i % 8) + 1}`,
    department: ["ผู้ใหญ่", "อนุชน", "เด็ก", "ผู้สูงอายุ"][i % 4],
    phone: `08${(10000000 + i * 12345).toString().slice(0, 8)}`,
    email: `member${i + 1}@church.local`,
    status: i % 9 === 0 ? "inactive" : "active",
    joinedAt: `202${(i % 4) + 1}-01-15`,
  }));

  const today = new Date();
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  const incomes: Income[] = Array.from({ length: 30 }, (_, i) => ({
    id: `i${i + 1}`,
    date: daysAgo(i * 2),
    categoryId: ["c-off", "c-dnt", "c-int", "c-oth-i"][i % 4],
    amount: 1000 + Math.round(Math.random() * 15000),
    fundId: funds[i % funds.length].id,
    description: "บันทึกรายรับตัวอย่าง",
    createdBy: "u3",
    approvedBy: i % 3 === 0 ? "u1" : undefined,
    status: (["approved", "pending", "approved", "draft"] as const)[i % 4],
  }));

  const expenses: Expense[] = Array.from({ length: 24 }, (_, i) => ({
    id: `e${i + 1}`,
    date: daysAgo(i * 3),
    categoryId: ["c-util", "c-sal", "c-mis", "c-mnt", "c-oth-e"][i % 5],
    amount: 500 + Math.round(Math.random() * 12000),
    fundId: funds[i % funds.length].id,
    description: "บันทึกรายจ่ายตัวอย่าง",
    vendor: ["ร้านค้า A", "การไฟฟ้า", "การประปา", "ผู้รับเหมา"][i % 4],
    createdBy: "u4",
    approvedBy: i % 2 === 0 ? "u1" : undefined,
    status: (["approved", "pending", "approved", "rejected"] as const)[i % 4],
  }));

  const offerings: Offering[] = Array.from({ length: 40 }, (_, i) => ({
    id: `o${i + 1}`,
    date: daysAgo(i),
    type: (["sunday", "mission", "building", "special", "youth", "children", "online"] as const)[i % 7],
    channel: (["cash", "bank", "qr"] as const)[i % 3],
    amount: 200 + Math.round(Math.random() * 5000),
    memberId: members[i % members.length].id,
    fundId: funds[i % funds.length].id,
    createdBy: "u3",
  }));

  const projects: Project[] = [
    { id: "p1", name: "ต่อเติมอาคารนมัสการ", budget: 1500000, used: 620000, progress: 42, startDate: "2025-01-10", status: "active", ownerId: "u2", description: "ขยายพื้นที่นมัสการ" },
    { id: "p2", name: "ค่ายอนุชนฤดูร้อน", budget: 180000, used: 45000, progress: 25, startDate: "2025-03-01", status: "planning", ownerId: "u3" },
    { id: "p3", name: "พันธกิจต่างจังหวัด", budget: 220000, used: 210000, progress: 95, startDate: "2024-11-01", status: "active", ownerId: "u2" },
    { id: "p4", name: "ปรับปรุงห้องเด็ก", budget: 90000, used: 90000, progress: 100, startDate: "2024-06-01", endDate: "2024-09-30", status: "completed", ownerId: "u3" },
  ];

  const year = new Date().getFullYear();
  const budgets: Budget[] = [
    { id: "b1", name: "งบประมาณประจำปี", period: "annual", year, amount: 3000000, used: 1240000 },
    { id: "b2", name: "งบเดือนนี้", period: "monthly", year, month: new Date().getMonth() + 1, amount: 250000, used: 168000 },
    { id: "b3", name: "แผนกอนุชน", period: "department", year, department: "อนุชน", amount: 120000, used: 42000 },
    { id: "b4", name: "แผนกเด็ก", period: "department", year, department: "เด็ก", amount: 80000, used: 61000 },
    { id: "b5", name: "โครงการก่อสร้าง", period: "project", year, projectId: "p1", amount: 1500000, used: 620000 },
  ];

  const audit: AuditLog[] = [
    { id: "a1", at: now(), userId: "u1", userName: "ศจ. สมชาย", action: "login", entity: "auth", details: "เข้าสู่ระบบ" },
    { id: "a2", at: now(), userId: "u3", userName: "คุณศิริ", action: "create", entity: "offering", details: "บันทึกเงินถวายวันอาทิตย์" },
  ];

  const settings: Settings = {
    churchName: "คริสตจักรตัวอย่าง",
    fiscalYearStart: 1,
    idleTimeoutMin: 15,
    currency: "THB",
  };

  return {
    users,
    categories,
    funds,
    incomes,
    expenses,
    offerings,
    budgets,
    projects,
    members,
    audit,
    settings,
    session: { userId: null },
  };
}

let cache: DB | null = null;

export function loadDb(): DB {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = seed();
    return cache;
  }
  const raw = window.localStorage.getItem(KEY);
  if (raw) {
    try {
      cache = JSON.parse(raw) as DB;
      return cache;
    } catch {
      /* fall through to seed */
    }
  }
  cache = seed();
  saveDb();
  return cache;
}

export function saveDb() {
  if (typeof window === "undefined" || !cache) return;
  window.localStorage.setItem(KEY, JSON.stringify(cache));
}

export function updateDb(fn: (db: DB) => void) {
  const db = loadDb();
  fn(db);
  saveDb();
  return db;
}

export function resetDb() {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
  cache = null;
  return loadDb();
}

export function newId(prefix = "") {
  return `${prefix}${uid()}`;
}

export function logAudit(
  entry: Omit<AuditLog, "id" | "at"> & { at?: string }
) {
  updateDb((db) => {
    db.audit.unshift({
      id: newId("a"),
      at: entry.at ?? now(),
      userId: entry.userId,
      userName: entry.userName,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      details: entry.details,
    });
    if (db.audit.length > 500) db.audit.length = 500;
  });
}