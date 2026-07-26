/**
 * Grace Ledger v2 — Chart of Accounts Domain Model
 *
 * CRITICAL FIX (MF-11): Includes 3-3005 Opening Balance Equity account
 * CRITICAL FIX (CF-4): church_id on all accounts for tenant isolation
 */

import type { AccountType, NormalBalance } from "./types";

export interface Account {
  id: string;
  churchId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  parentId: string | null;
  isActive: boolean;
  isContra: boolean;
  normalBalance: NormalBalance;
  description: string | null;
  sortOrder: number;
  tfrsCode: string | null;
  version: number;
}

export interface CreateAccountInput {
  churchId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  parentId?: string | null;
  isActive?: boolean;
  isContra?: boolean;
  normalBalance: NormalBalance;
  description?: string | null;
  sortOrder?: number;
  tfrsCode?: string | null;
}

/** Default Thai Church Chart of Accounts — v2 (with 3-3005 Opening Balance Equity per MF-11 fix) */
export const DEFAULT_CHART_OF_ACCOUNTS: Omit<CreateAccountInput, "churchId">[] = [
  // ============ 1xxx ASSETS ============
  {
    accountCode: "1-1001",
    accountName: "เงินสด",
    accountType: "asset",
    normalBalance: "debit",
    description: "เงินสดในมือ",
    sortOrder: 1,
    tfrsCode: "A100",
  },
  {
    accountCode: "1-1002",
    accountName: "เงินฝากธนาคาร",
    accountType: "asset",
    normalBalance: "debit",
    description: "เงินฝากธนาคารทุกบัญชี",
    sortOrder: 2,
    tfrsCode: "A110",
  },
  {
    accountCode: "1-1003",
    accountName: "ลูกหนี้",
    accountType: "asset",
    normalBalance: "debit",
    description: "ลูกหนี้เงินยืม/อื่น ๆ",
    sortOrder: 3,
    tfrsCode: "A120",
  },
  {
    accountCode: "1-1004",
    accountName: "ที่ดิน",
    accountType: "asset",
    normalBalance: "debit",
    description: "ที่ดินของคริสตจักร",
    sortOrder: 4,
    tfrsCode: "A200",
  },
  {
    accountCode: "1-1005",
    accountName: "อาคาร",
    accountType: "asset",
    normalBalance: "debit",
    description: "อาคารและสิ่งปลูกสร้าง",
    sortOrder: 5,
    tfrsCode: "A210",
  },
  {
    accountCode: "1-1006",
    accountName: "อุปกรณ์",
    accountType: "asset",
    normalBalance: "debit",
    description: "อุปกรณ์สำนักงานและอื่น ๆ",
    sortOrder: 6,
    tfrsCode: "A220",
  },
  {
    accountCode: "1-1007",
    accountName: "ค่าเสื่อมราคาสะสม",
    accountType: "asset",
    isContra: true,
    normalBalance: "credit",
    description: "ค่าเสื่อมราคาสะสม-อาคารและอุปกรณ์",
    sortOrder: 7,
    tfrsCode: "A299",
  },

  // ============ 2xxx LIABILITIES ============
  {
    accountCode: "2-2001",
    accountName: "เจ้าหนี้การค้า",
    accountType: "liability",
    normalBalance: "credit",
    description: "เจ้าหนี้ค่าสินค้า/บริการ",
    sortOrder: 8,
    tfrsCode: "L100",
  },
  {
    accountCode: "2-2002",
    accountName: "เงินกู้ยืม",
    accountType: "liability",
    normalBalance: "credit",
    description: "เงินกู้ยืมจากสถาบันการเงิน",
    sortOrder: 9,
    tfrsCode: "L200",
  },
  {
    accountCode: "2-2003",
    accountName: "ภาษีหัก ณ ที่จ่ายค้างจ่าย",
    accountType: "liability",
    normalBalance: "credit",
    description: "ภ.ง.ด.3, ภ.ง.ด.53 ค้างจ่าย",
    sortOrder: 10,
    tfrsCode: "L300",
  },
  {
    accountCode: "2-2004",
    accountName: "เงินประกันสังคมค้างจ่าย",
    accountType: "liability",
    normalBalance: "credit",
    description: "ประกันสังคมค้างจ่าย",
    sortOrder: 11,
    tfrsCode: "L310",
  },

  // ============ 3xxx EQUITY ============
  {
    accountCode: "3-3001",
    accountName: "กองทุนทั่วไป",
    accountType: "equity",
    normalBalance: "credit",
    description: "กองทุนทั่วไปของคริสตจักร",
    sortOrder: 12,
    tfrsCode: "E100",
  },
  {
    accountCode: "3-3002",
    accountName: "กองทุนอาคารและที่ดิน",
    accountType: "equity",
    normalBalance: "credit",
    description: "กองทุนที่ดินและสิ่งปลูกสร้าง",
    sortOrder: 13,
    tfrsCode: "E110",
  },
  {
    accountCode: "3-3003",
    accountName: "กองทุนพันธกิจ",
    accountType: "equity",
    normalBalance: "credit",
    description: "กองทุนเพื่อพันธกิจและมิชชั่น",
    sortOrder: 14,
    tfrsCode: "E120",
  },
  {
    accountCode: "3-3004",
    accountName: "กำไรสะสม",
    accountType: "equity",
    normalBalance: "credit",
    description: "กำไรสะสมยกมา",
    sortOrder: 15,
    tfrsCode: "E200",
  },
  // MF-11: Opening Balance Equity — required for initial church setup
  {
    accountCode: "3-3005",
    accountName: "กำไรสะสมต้นงวด / Opening Balance Equity",
    accountType: "equity",
    normalBalance: "credit",
    description: "ยอดยกมาตั้งต้น — ใช้สำหรับตั้งยอดเริ่มต้นระบบเท่านั้น",
    sortOrder: 16,
    tfrsCode: "E210",
  },

  // ============ 4xxx INCOME ============
  {
    accountCode: "4-4001",
    accountName: "เงินถวายสิบลด",
    accountType: "income",
    normalBalance: "credit",
    description: "รายได้จากสิบลด",
    sortOrder: 17,
    tfrsCode: "I100",
  },
  {
    accountCode: "4-4002",
    accountName: "เงินถวายพิเศษ",
    accountType: "income",
    normalBalance: "credit",
    description: "รายได้จากถวายพิเศษ",
    sortOrder: 18,
    tfrsCode: "I110",
  },
  {
    accountCode: "4-4003",
    accountName: "เงินถวายพันธกิจ",
    accountType: "income",
    normalBalance: "credit",
    description: "รายได้จากถวายพันธกิจ",
    sortOrder: 19,
    tfrsCode: "I120",
  },
  {
    accountCode: "4-4004",
    accountName: "เงินบริจาค",
    accountType: "income",
    normalBalance: "credit",
    description: "เงินบริจาคทั่วไป",
    sortOrder: 20,
    tfrsCode: "I130",
  },
  {
    accountCode: "4-4005",
    accountName: "ดอกเบี้ยรับ",
    accountType: "income",
    normalBalance: "credit",
    description: "ดอกเบี้ยเงินฝากธนาคาร",
    sortOrder: 21,
    tfrsCode: "I200",
  },
  {
    accountCode: "4-4006",
    accountName: "รายได้ค่าเช่า",
    accountType: "income",
    normalBalance: "credit",
    description: "รายได้จากการให้เช่าทรัพย์สิน",
    sortOrder: 22,
    tfrsCode: "I210",
  },
  {
    accountCode: "4-4007",
    accountName: "รายรับอื่น ๆ",
    accountType: "income",
    normalBalance: "credit",
    description: "รายรับอื่น ๆ ที่ไม่ได้จัดประเภท",
    sortOrder: 23,
    tfrsCode: "I999",
  },

  // ============ 5xxx EXPENSES ============
  {
    accountCode: "5-5001",
    accountName: "เงินเดือนบุคลากร",
    accountType: "expense",
    normalBalance: "debit",
    description: "เงินเดือนและค่าจ้างบุคลากร",
    sortOrder: 24,
    tfrsCode: "E100",
  },
  {
    accountCode: "5-5002",
    accountName: "ค่าสาธารณูปโภค",
    accountType: "expense",
    normalBalance: "debit",
    description: "ค่าไฟฟ้า น้ำประปา โทรศัพท์ อินเทอร์เน็ต",
    sortOrder: 25,
    tfrsCode: "E200",
  },
  {
    accountCode: "5-5003",
    accountName: "ค่าซ่อมบำรุง",
    accountType: "expense",
    normalBalance: "debit",
    description: "ค่าซ่อมแซมและบำรุงรักษา",
    sortOrder: 26,
    tfrsCode: "E210",
  },
  {
    accountCode: "5-5004",
    accountName: "ค่าพันธกิจ",
    accountType: "expense",
    normalBalance: "debit",
    description: "ค่าใช้จ่ายด้านพันธกิจและมิชชั่น",
    sortOrder: 27,
    tfrsCode: "E300",
  },
  {
    accountCode: "5-5005",
    accountName: "ค่าวัสดุอุปกรณ์",
    accountType: "expense",
    normalBalance: "debit",
    description: "ค่าวัสดุสำนักงานและอุปกรณ์",
    sortOrder: 28,
    tfrsCode: "E310",
  },
  {
    accountCode: "5-5006",
    accountName: "ค่าเดินทาง",
    accountType: "expense",
    normalBalance: "debit",
    description: "ค่าเดินทางและที่พัก",
    sortOrder: 29,
    tfrsCode: "E320",
  },
  {
    accountCode: "5-5007",
    accountName: "ค่าใช้จ่ายอื่น ๆ",
    accountType: "expense",
    normalBalance: "debit",
    description: "ค่าใช้จ่ายเบ็ดเตล็ด",
    sortOrder: 30,
    tfrsCode: "E999",
  },
];

/** Get accounts by type */
export function getAccountsByType(type: AccountType): (typeof DEFAULT_CHART_OF_ACCOUNTS)[number][] {
  return DEFAULT_CHART_OF_ACCOUNTS.filter((a) => a.accountType === type);
}

/** Check if account type has a normal debit balance */
export function isNormalDebit(accountType: AccountType, isContra: boolean): boolean {
  const normalMap: Record<AccountType, "debit" | "credit"> = {
    asset: "debit",
    liability: "credit",
    equity: "credit",
    income: "credit",
    expense: "debit",
  };
  const normal = normalMap[accountType];
  if (isContra) {
    return normal === "credit";
  }
  return normal === "debit";
}
