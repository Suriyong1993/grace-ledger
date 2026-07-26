/**
 * Grace Ledger v2 — Seed Data Service
 * Seeds a fresh database with required reference data.
 * This is NOT migration of v1 data — use MigrationService for that.
 *
 * Creates: chart of accounts, fiscal periods, default admin user, demo funds.
 */

import { db } from "@/server/infrastructure/db";
import { churches, users, funds, chartOfAccounts, fiscalPeriods, appSettings } from "@/db/schema";
import { DEFAULT_CHART_OF_ACCOUNTS } from "@/server/domain/chart-of-accounts";
import { PasswordService } from "@/server/auth/password";
import { eq } from "drizzle-orm";

export interface SeedResult {
  churchId: string;
  adminUserId: string;
  accountsSeeded: number;
  fundsSeeded: number;
  periodsSeeded: number;
  warning?: string;
}

function generateFiscalPeriods(fiscalYearStart: number, year: number) {
  const periods: Array<{
    fiscalYear: number;
    periodNumber: number;
    startDate: string;
    endDate: string;
    status: "open";
  }> = [];
  const startMonth = fiscalYearStart - 1;
  for (let i = 0; i < 12; i++) {
    const monthIndex = (startMonth + i) % 12;
    const actualYear = startMonth + i < 12 ? year : year + 1;
    const startDate = new Date(Date.UTC(actualYear, monthIndex, 1));
    const endDate = new Date(Date.UTC(actualYear, monthIndex + 1, 0));
    periods.push({
      fiscalYear: year,
      periodNumber: i + 1,
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      status: "open" as const,
    });
  }
  return periods;
}

export class SeedService {
  /**
   * Seed a fresh church with everything needed for MVP.
   * Idempotent — skips if church name already exists.
   */
  static async seed(options?: {
    churchName?: string;
    adminPassword?: string;
    fiscalYearStart?: number;
    currency?: string;
  }): Promise<SeedResult> {
    const churchName = options?.churchName ?? "คริสตจักรตัวอย่าง";
    const adminPassword = options?.adminPassword ?? "Admin@Grace2026!";
    const fiscalYearStart = options?.fiscalYearStart ?? 1;
    const currency = options?.currency ?? "THB";

    // Check if already seeded
    const existing = await db.query.churches.findFirst({
      where: eq(churches.name, churchName),
    });

    if (existing) {
      return {
        churchId: existing.id,
        adminUserId: "",
        accountsSeeded: 0,
        fundsSeeded: 0,
        periodsSeeded: 0,
        warning: `Church "${churchName}" already exists. Seed skipped.`,
      };
    }

    // 1. Create church
    const [church] = await db
      .insert(churches)
      .values({
        name: churchName,
        fiscalYearStart,
        currency,
      })
      .returning();

    // 2. Seed chart of accounts
    for (const account of DEFAULT_CHART_OF_ACCOUNTS) {
      await db.insert(chartOfAccounts).values({
        churchId: church.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        isContra: account.isContra ?? false,
        normalBalance: account.normalBalance,
        description: account.description ?? null,
        sortOrder: account.sortOrder ?? 0,
        tfrsCode: account.tfrsCode ?? null,
      });
    }

    // 3. Create fiscal periods (current year + next year)
    const currentYear = new Date().getFullYear();
    let periodsSeeded = 0;
    for (const year of [currentYear, currentYear + 1]) {
      const periods = generateFiscalPeriods(fiscalYearStart, year);
      for (const period of periods) {
        await db.insert(fiscalPeriods).values({
          churchId: church.id,
          ...period,
        });
        periodsSeeded++;
      }
    }

    // 4. Create funds
    const defaultFunds = [
      {
        code: "GEN",
        name: "กองทุนทั่วไป",
        accountCode: "3-3001",
        description: "กองทุนหลักของคริสตจักร",
      },
      {
        code: "BLDG",
        name: "กองทุนอาคารและที่ดิน",
        accountCode: "3-3002",
        description: "กองทุนเพื่อที่ดินและสิ่งปลูกสร้าง",
      },
      {
        code: "MISS",
        name: "กองทุนพันธกิจ",
        accountCode: "3-3003",
        description: "กองทุนเพื่อพันธกิจและมิชชั่น",
      },
    ];

    let fundsSeeded = 0;
    for (const fundDef of defaultFunds) {
      const coaAccount = await db.query.chartOfAccounts.findFirst({
        where: eq(chartOfAccounts.accountCode, fundDef.accountCode),
      });
      if (coaAccount) {
        await db.insert(funds).values({
          churchId: church.id,
          accountId: coaAccount.id,
          fundCode: fundDef.code,
          name: fundDef.name,
          description: fundDef.description,
          isActive: true,
        });
        fundsSeeded++;
      }
    }

    // 5. Create admin user
    const passwordHash = await PasswordService.hashPassword(adminPassword);
    const [adminUser] = await db
      .insert(users)
      .values({
        churchId: church.id,
        name: "ผู้ดูแลระบบ",
        role: "super_admin",
        passwordHash,
        isActive: true,
      })
      .returning();

    // 6. Create app settings
    await db.insert(appSettings).values({
      churchId: church.id,
      churchName,
      fiscalYearStart,
      idleTimeoutMin: 15,
      sessionMaxHours: 8,
      currency,
    });

    return {
      churchId: church.id,
      adminUserId: adminUser.id,
      accountsSeeded: DEFAULT_CHART_OF_ACCOUNTS.length,
      fundsSeeded,
      periodsSeeded,
    };
  }
}
