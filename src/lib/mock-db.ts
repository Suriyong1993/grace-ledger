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
  User,
} from "./types";
import { now } from "./format";

const KEY = "cfm.db.v3";

export interface DB {
  users: User[];
  categories: Category[];
  funds: Fund[];
  incomes: Income[];
  expenses: Expense[];
  offerings: Offering[];
  offeringCategories: OfferingCategory[];
  offeringSubcategories: OfferingSubcategory[];
  budgets: Budget[];
  projects: Project[];
  members: Member[];
  audit: AuditLog[];
  settings: Settings;
  session: { userId: string | null };
}

const uid = () => Math.random().toString(36).slice(2, 10);

function seed(): DB {
  const ts = now();

  const users: User[] = [
    { id: "u1", name: "ศจ. สมชาย", role: "super_admin", avatarColor: "#F97316" },
    { id: "u2", name: "ศจ. วิชัย", role: "pastor", avatarColor: "#F59E0B" },
    { id: "u3", name: "คุณศิริ", role: "treasurer", avatarColor: "#EAB308" },
    { id: "u4", name: "คุณอรุณ", role: "finance_staff", avatarColor: "#22C55E" },
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
    { id: "f1", name: "กองทุนทั่วไป", openingBalance: -7553, createdAt: ts },
    { id: "f2", name: "บัญชีธนาคารคริสตจักร", openingBalance: 13825.06, createdAt: ts },
    { id: "f3", name: "กองทุนที่ดินและสิ่งปลูกสร้าง", openingBalance: 0, createdAt: ts },
    { id: "f4", name: "กองทุนพันธกิจ", openingBalance: 0, createdAt: ts },
  ];

  const offeringCategories: OfferingCategory[] = [
    { id: "cat-tithe", name: "สิบลด", color: "#EAB308", icon: "Percent", sortOrder: 1, isActive: true, createdAt: ts, updatedAt: ts },
    { id: "cat-rent", name: "ค่าเช่า", color: "#F59E0B", icon: "Home", sortOrder: 2, isActive: true, createdAt: ts, updatedAt: ts },
    { id: "cat-memorial", name: "อนุสรณ์", color: "#A855F7", icon: "Bookmark", sortOrder: 3, isActive: true, createdAt: ts, updatedAt: ts },
    { id: "cat-mission", name: "พันธกิจ", color: "#22C55E", icon: "Globe", sortOrder: 4, isActive: true, createdAt: ts, updatedAt: ts },
    { id: "cat-special", name: "ถวายพิเศษ", color: "#F97316", icon: "Gift", sortOrder: 5, isActive: true, createdAt: ts, updatedAt: ts },
    { id: "cat-land", name: "ที่ดิน", color: "#0EA5E9", icon: "MapPin", sortOrder: 6, isActive: true, createdAt: ts, updatedAt: ts },
    { id: "cat-party", name: "ปาร์ตี้", color: "#EC4899", icon: "PartyPopper", sortOrder: 7, isActive: true, createdAt: ts, updatedAt: ts },
  ];

  const offeringSubcategories: OfferingSubcategory[] = [];

  // Real Offerings History (Jan - Jul 2026)
  const offerings: Offering[] = [
    // มกราคม 2569
    { id: "o_2026_01_04_c", date: "2026-01-04", categoryId: "cat-tithe", channel: "cash", amount: 1930, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 4 ม.ค. (เงินสด)" },
    { id: "o_2026_01_04_b", date: "2026-01-04", categoryId: "cat-tithe", channel: "bank", amount: 2800, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 4 ม.ค. (ออนไลน์)" },
    { id: "o_2026_01_11_c", date: "2026-01-11", categoryId: "cat-tithe", channel: "cash", amount: 1960, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 11 ม.ค. (เงินสด)" },
    { id: "o_2026_01_11_b", date: "2026-01-11", categoryId: "cat-tithe", channel: "bank", amount: 2200, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 11 ม.ค. (ออนไลน์)" },
    { id: "o_2026_01_18_c", date: "2026-01-18", categoryId: "cat-tithe", channel: "cash", amount: 1190, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 18 ม.ค. (เงินสด)" },
    { id: "o_2026_01_18_b", date: "2026-01-18", categoryId: "cat-tithe", channel: "bank", amount: 2350, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 18 ม.ค. (ออนไลน์)" },
    { id: "o_2026_01_25_c", date: "2026-01-25", categoryId: "cat-tithe", channel: "cash", amount: 2850, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 25 ม.ค. (เงินสด)" },
    { id: "o_2026_01_25_b", date: "2026-01-25", categoryId: "cat-tithe", channel: "bank", amount: 1900, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 25 ม.ค. (ออนไลน์)" },

    // กุมภาพันธ์ 2569
    { id: "o_2026_02_01_c", date: "2026-02-01", categoryId: "cat-tithe", channel: "cash", amount: 990, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 1 ก.พ. (เงินสด)" },
    { id: "o_2026_02_01_b", date: "2026-02-01", categoryId: "cat-tithe", channel: "bank", amount: 2300, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 1 ก.พ. (ออนไลน์)" },
    { id: "o_2026_02_08_c", date: "2026-02-08", categoryId: "cat-tithe", channel: "cash", amount: 960, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 8 ก.พ. (เงินสด)" },
    { id: "o_2026_02_08_b", date: "2026-02-08", categoryId: "cat-tithe", channel: "bank", amount: 2500, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 8 ก.พ. (ออนไลน์)" },
    { id: "o_2026_02_15_c", date: "2026-02-15", categoryId: "cat-tithe", channel: "cash", amount: 2922, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 15 ก.พ. (เงินสด)" },
    { id: "o_2026_02_15_b", date: "2026-02-15", categoryId: "cat-tithe", channel: "bank", amount: 2800, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 15 ก.พ. (ออนไลน์)" },
    { id: "o_2026_02_22_c", date: "2026-02-22", categoryId: "cat-tithe", channel: "cash", amount: 1600, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 22 ก.พ. (เงินสด)" },
    { id: "o_2026_02_22_b", date: "2026-02-22", categoryId: "cat-tithe", channel: "bank", amount: 2600, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 22 ก.พ. (ออนไลน์)" },

    // มีนาคม 2569
    { id: "o_2026_03_01_c", date: "2026-03-01", categoryId: "cat-tithe", channel: "cash", amount: 1642, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 1 มี.ค. (เงินสด)" },
    { id: "o_2026_03_01_b", date: "2026-03-01", categoryId: "cat-tithe", channel: "bank", amount: 3600, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 1 มี.ค. (ออนไลน์)" },
    { id: "o_2026_03_08_c", date: "2026-03-08", categoryId: "cat-tithe", channel: "cash", amount: 3430, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 8 มี.ค. (เงินสด)" },
    { id: "o_2026_03_08_b", date: "2026-03-08", categoryId: "cat-tithe", channel: "bank", amount: 2500, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 8 มี.ค. (ออนไลน์)" },
    { id: "o_2026_03_15_c", date: "2026-03-15", categoryId: "cat-tithe", channel: "cash", amount: 1070, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 15 มี.ค. (เงินสด)" },
    { id: "o_2026_03_15_b", date: "2026-03-15", categoryId: "cat-tithe", channel: "bank", amount: 3100, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 15 มี.ค. (ออนไลน์)" },
    { id: "o_2026_03_22_c", date: "2026-03-22", categoryId: "cat-tithe", channel: "cash", amount: 4490, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 22 มี.ค. (เงินสด)" },
    { id: "o_2026_03_22_b", date: "2026-03-22", categoryId: "cat-tithe", channel: "bank", amount: 2900, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 22 มี.ค. (ออนไลน์)" },
    { id: "o_2026_03_29_c", date: "2026-03-29", categoryId: "cat-tithe", channel: "cash", amount: 1648, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 29 มี.ค. (เงินสด)" },
    { id: "o_2026_03_29_b", date: "2026-03-29", categoryId: "cat-tithe", channel: "bank", amount: 2750, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 29 มี.ค. (ออนไลน์)" },

    // เมษายน 2569
    { id: "o_2026_04_05_c", date: "2026-04-05", categoryId: "cat-tithe", channel: "cash", amount: 21020, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 5 เม.ย. (เงินสด)" },
    { id: "o_2026_04_05_b", date: "2026-04-05", categoryId: "cat-tithe", channel: "bank", amount: 2900, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 5 เม.ย. (ออนไลน์)" },
    { id: "o_2026_04_12_c", date: "2026-04-12", categoryId: "cat-tithe", channel: "cash", amount: 1085, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 12 เม.ย. (เงินสด)" },
    { id: "o_2026_04_12_b", date: "2026-04-12", categoryId: "cat-tithe", channel: "bank", amount: 3300, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 12 เม.ย. (ออนไลน์)" },
    { id: "o_2026_04_19_c", date: "2026-04-19", categoryId: "cat-tithe", channel: "cash", amount: 1390, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 19 เม.ย. (เงินสด)" },
    { id: "o_2026_04_19_b", date: "2026-04-19", categoryId: "cat-tithe", channel: "bank", amount: 3250, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 19 เม.ย. (ออนไลน์)" },
    { id: "o_2026_04_26_c", date: "2026-04-26", categoryId: "cat-tithe", channel: "cash", amount: 2860, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 26 เม.ย. (เงินสด)" },
    { id: "o_2026_04_26_b", date: "2026-04-26", categoryId: "cat-tithe", channel: "bank", amount: 9500, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 26 เม.ย. (ออนไลน์)" },

    // พฤษภาคม 2569
    { id: "o_2026_05_03_c", date: "2026-05-03", categoryId: "cat-tithe", channel: "cash", amount: 1055, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 3 พ.ค. (เงินสด)" },
    { id: "o_2026_05_03_b", date: "2026-05-03", categoryId: "cat-tithe", channel: "bank", amount: 1550, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 3 พ.ค. (ออนไลน์)" },
    { id: "o_2026_05_10_c", date: "2026-05-10", categoryId: "cat-tithe", channel: "cash", amount: 1141, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 10 พ.ค. (เงินสด)" },
    { id: "o_2026_05_10_b", date: "2026-05-10", categoryId: "cat-tithe", channel: "bank", amount: 3900, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 10 พ.ค. (ออนไลน์)" },
    { id: "o_2026_05_17_c", date: "2026-05-17", categoryId: "cat-tithe", channel: "cash", amount: 650, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 17 พ.ค. (เงินสด)" },
    { id: "o_2026_05_17_b", date: "2026-05-17", categoryId: "cat-tithe", channel: "bank", amount: 1600, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 17 พ.ค. (ออนไลน์)" },
    { id: "o_2026_05_24_c", date: "2026-05-24", categoryId: "cat-tithe", channel: "cash", amount: 2345, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 24 พ.ค. (เงินสด)" },
    { id: "o_2026_05_24_b", date: "2026-05-24", categoryId: "cat-tithe", channel: "bank", amount: 1400, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 24 พ.ค. (ออนไลน์)" },
    { id: "o_2026_05_31_c", date: "2026-05-31", categoryId: "cat-tithe", channel: "cash", amount: 940, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 31 พ.ค. (เงินสด)" },
    { id: "o_2026_05_31_b", date: "2026-05-31", categoryId: "cat-tithe", channel: "bank", amount: 4950, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 31 พ.ค. (ออนไลน์)" },

    // มิถุนายน 2569
    { id: "o_2026_06_07_c", date: "2026-06-07", categoryId: "cat-tithe", channel: "cash", amount: 610, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 7 มิ.ย. (เงินสด)" },
    { id: "o_2026_06_07_b", date: "2026-06-07", categoryId: "cat-tithe", channel: "bank", amount: 1500, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 7 มิ.ย. (ออนไลน์)" },
    { id: "o_2026_06_14_c", date: "2026-06-14", categoryId: "cat-tithe", channel: "cash", amount: 1020, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 14 มิ.ย. (เงินสด)" },
    { id: "o_2026_06_14_b", date: "2026-06-14", categoryId: "cat-tithe", channel: "bank", amount: 2050, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 14 มิ.ย. (ออนไลน์)" },
    { id: "o_2026_06_21_c", date: "2026-06-21", categoryId: "cat-tithe", channel: "cash", amount: 1930, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 21 มิ.ย. (เงินสด)" },
    { id: "o_2026_06_21_b", date: "2026-06-21", categoryId: "cat-tithe", channel: "bank", amount: 1300, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 21 มิ.ย. (ออนไลน์)" },
    { id: "o_2026_06_28_c", date: "2026-06-28", categoryId: "cat-tithe", channel: "cash", amount: 910, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 28 มิ.ย. (เงินสด)" },
    { id: "o_2026_06_28_b", date: "2026-06-28", categoryId: "cat-tithe", channel: "bank", amount: 4800, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 28 มิ.ย. (ออนไลน์)" },

    // กรกฎาคม 2569 (ถึง 19 ก.ค.)
    { id: "o_2026_07_05_c", date: "2026-07-05", categoryId: "cat-tithe", channel: "cash", amount: 2219, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 5 ก.ค. (เงินสด)" },
    { id: "o_2026_07_05_b", date: "2026-07-05", categoryId: "cat-tithe", channel: "bank", amount: 1500, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 5 ก.ค. (ออนไลน์)" },
    { id: "o_2026_07_12_c", date: "2026-07-12", categoryId: "cat-tithe", channel: "cash", amount: 1715, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 12 ก.ค. (เงินสด)" },
    { id: "o_2026_07_12_b", date: "2026-07-12", categoryId: "cat-tithe", channel: "bank", amount: 4800, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 12 ก.ค. (ออนไลน์)" },
    { id: "o_2026_07_19_c", date: "2026-07-19", categoryId: "cat-tithe", channel: "cash", amount: 1211, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 19 ก.ค. (เงินสด)" },
    { id: "o_2026_07_19_b", date: "2026-07-19", categoryId: "cat-tithe", channel: "bank", amount: 1900, fundId: "f1", createdBy: "u3", note: "อาทิตย์ที่ 19 ก.ค. (ออนไลน์)" },
  ];

  // Real Expense History (Jan - Jul 2026)
  const expenses: Expense[] = [
    // มกราคม 2569 (รวม 7,814)
    { id: "e_2026_01_04", date: "2026-01-04", categoryId: "c-oth-e", amount: 1536, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 1 ม.ค.", createdBy: "u4", status: "approved" },
    { id: "e_2026_01_11", date: "2026-01-11", categoryId: "c-oth-e", amount: 2587, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 2 ม.ค.", createdBy: "u4", status: "approved" },
    { id: "e_2026_01_25", date: "2026-01-25", categoryId: "c-oth-e", amount: 3691, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 4 ม.ค.", createdBy: "u4", status: "approved" },

    // กุมภาพันธ์ 2569 (รวม 11,367)
    { id: "e_2026_02_01", date: "2026-02-01", categoryId: "c-oth-e", amount: 4710, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 1 ก.พ.", createdBy: "u4", status: "approved" },
    { id: "e_2026_02_08", date: "2026-02-08", categoryId: "c-oth-e", amount: 1615, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 2 ก.พ.", createdBy: "u4", status: "approved" },
    { id: "e_2026_02_15", date: "2026-02-15", categoryId: "c-oth-e", amount: 2873, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 3 ก.พ.", createdBy: "u4", status: "approved" },
    { id: "e_2026_02_22", date: "2026-02-22", categoryId: "c-oth-e", amount: 2169, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 4 ก.พ.", createdBy: "u4", status: "approved" },

    // มีนาคม 2569 (รวม 24,816)
    { id: "e_2026_03_01", date: "2026-03-01", categoryId: "c-oth-e", amount: 14797, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 1 มี.ค. (ก้อนใหญ่)", createdBy: "u4", status: "approved" },
    { id: "e_2026_03_08", date: "2026-03-08", categoryId: "c-oth-e", amount: 1712, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 2 มี.ค.", createdBy: "u4", status: "approved" },
    { id: "e_2026_03_15", date: "2026-03-15", categoryId: "c-oth-e", amount: 2620, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 3 มี.ค.", createdBy: "u4", status: "approved" },
    { id: "e_2026_03_22", date: "2026-03-22", categoryId: "c-oth-e", amount: 3170, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 4 มี.ค.", createdBy: "u4", status: "approved" },
    { id: "e_2026_03_29", date: "2026-03-29", categoryId: "c-oth-e", amount: 2517, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 5 มี.ค.", createdBy: "u4", status: "approved" },

    // เมษายน 2569 (รวม 45,134)
    { id: "e_2026_04_05", date: "2026-04-05", categoryId: "c-oth-e", amount: 15951, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 1 เม.ย.", createdBy: "u4", status: "approved" },
    { id: "e_2026_04_12", date: "2026-04-12", categoryId: "c-oth-e", amount: 8206, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 2 เม.ย.", createdBy: "u4", status: "approved" },
    { id: "e_2026_04_19", date: "2026-04-19", categoryId: "c-oth-e", amount: 13625, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 3 เม.ย.", createdBy: "u4", status: "approved" },
    { id: "e_2026_04_26", date: "2026-04-26", categoryId: "c-oth-e", amount: 7352, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 4 เม.ย.", createdBy: "u4", status: "approved" },

    // พฤษภาคม 2569 (รวม 28,066)
    { id: "e_2026_05_03", date: "2026-05-03", categoryId: "c-oth-e", amount: 9740, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 1 พ.ค.", createdBy: "u4", status: "approved" },
    { id: "e_2026_05_10", date: "2026-05-10", categoryId: "c-oth-e", amount: 2087, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 2 พ.ค.", createdBy: "u4", status: "approved" },
    { id: "e_2026_05_17", date: "2026-05-17", categoryId: "c-oth-e", amount: 1635, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 3 พ.ค.", createdBy: "u4", status: "approved" },
    { id: "e_2026_05_24", date: "2026-05-24", categoryId: "c-oth-e", amount: 14604, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 4 พ.ค.", createdBy: "u4", status: "approved" },

    // มิถุนายน 2569 (รวม 23,177)
    { id: "e_2026_06_07", date: "2026-06-07", categoryId: "c-oth-e", amount: 2060, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 1 มิ.ย.", createdBy: "u4", status: "approved" },
    { id: "e_2026_06_14", date: "2026-06-14", categoryId: "c-oth-e", amount: 2250, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 2 มิ.ย.", createdBy: "u4", status: "approved" },
    { id: "e_2026_06_21", date: "2026-06-21", categoryId: "c-oth-e", amount: 3590, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 3 มิ.ย.", createdBy: "u4", status: "approved" },
    { id: "e_2026_06_28", date: "2026-06-28", categoryId: "c-oth-e", amount: 15277, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 4 มิ.ย.", createdBy: "u4", status: "approved" },

    // กรกฎาคม 2569 (รวม 5,791)
    { id: "e_2026_07_05", date: "2026-07-05", categoryId: "c-oth-e", amount: 2156, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 1 ก.ค.", createdBy: "u4", status: "approved" },
    { id: "e_2026_07_12", date: "2026-07-12", categoryId: "c-oth-e", amount: 2225, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 2 ก.ค.", createdBy: "u4", status: "approved" },
    { id: "e_2026_07_19", date: "2026-07-19", categoryId: "c-oth-e", amount: 1410, fundId: "f1", description: "รายจ่ายสัปดาห์ที่ 3 ก.ค.", createdBy: "u4", status: "approved" },
  ];

  const incomes: Income[] = [];
  const members: Member[] = [];
  const budgets: Budget[] = [];
  const projects: Project[] = [];
  const audit: AuditLog[] = [];

  const settings: Settings = {
    churchName: "ระบบการเงินคริสตจักร",
    address: "",
    taxId: "",
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
    offeringCategories,
    offeringSubcategories,
    budgets,
    projects,
    members,
    audit,
    settings,
    session: { userId: null },
  };
}

let cache: DB | null = null;

function migrateDb(db: DB): DB {
  if (!db.offeringCategories || db.offeringCategories.length === 0) {
    const fresh = seed();
    db.offeringCategories = fresh.offeringCategories;
    db.offeringSubcategories = fresh.offeringSubcategories;
  }
  return db;
}

export function loadDb(): DB {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = seed();
    return cache;
  }
  const raw = window.localStorage.getItem(KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DB;
      cache = migrateDb(parsed);
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
  // Save only metadata (settings, categories), NOT financial data (income, expense, offering)
  // This prevents localStorage from exposing all church financial records via XSS
  const safe: Partial<DB> = {
    session: cache.session,
    settings: cache.settings,
    users: cache.users,
  };
  window.localStorage.setItem(KEY, JSON.stringify(safe));
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

export function logAudit(entry: Omit<AuditLog, "id" | "at"> & { at?: string }) {
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
