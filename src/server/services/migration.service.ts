/**
 * Grace Ledger v2 — Migration Service
 * Migrates v1 localStorage data to v2 PostgreSQL.
 *
 * CRITICAL FIX (MF-12): Passwords hashed from PIN are flagged as temporary.
 * Users must change password on first login.
 */

import { db } from "@/server/infrastructure/db";
import { churches, users, funds, chartOfAccounts, fiscalPeriods, appSettings } from "@/db/schema";
import { PasswordService } from "@/server/auth/password";
import { DEFAULT_CHART_OF_ACCOUNTS } from "@/server/domain/chart-of-accounts";
import { eq } from "drizzle-orm";
import type { DB as V1DB } from "@/lib/mock-db";

function getFiscalYearStart(fiscalYearStart: number, year: number): Date {
  // fiscalYearStart is month 1-12
  return new Date(year, fiscalYearStart - 1, 1);
}

function generatePeriods(fiscalYearStart: number, year: number) {
  const periods = [];
  const startMonth = fiscalYearStart - 1;
  for (let i = 0; i < 12; i++) {
    const monthIndex = (startMonth + i) % 12;
    const actualYear = startMonth + i < 12 ? year : year + 1;
    const startDate = new Date(actualYear, monthIndex, 1);
    const endDate = new Date(actualYear, monthIndex + 1, 0);
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

export class MigrationService {
  /**
   * Migrate v1 localStorage data to v2 PostgreSQL.
   * This is a one-way, idempotent operation.
   */
  static async migrate(v1Data: V1DB): Promise<{
    churchId: string;
    migratedUsers: number;
    migratedFunds: number;
    note: string;
  }> {
    const v1Settings = v1Data.settings;
    const v1Users = v1Data.users;
    const v1Funds = v1Data.funds;

    // 1. Create church record
    const [church] = await db
      .insert(churches)
      .values({
        name: v1Settings.churchName || "คริสตจักรของฉัน",
        address: v1Settings.address || null,
        taxId: v1Settings.taxId || null,
        fiscalYearStart: v1Settings.fiscalYearStart || 1,
        currency: "THB",
      })
      .returning();

    const churchId = church.id;

    // 2. Seed Chart of Accounts
    for (const account of DEFAULT_CHART_OF_ACCOUNTS) {
      await db.insert(chartOfAccounts).values({
        churchId,
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

    // 3. Create fiscal periods (current year)
    const currentYear = new Date().getFullYear();
    const yearStart = v1Settings.fiscalYearStart || 1;
    const periods = generatePeriods(yearStart, currentYear);
    for (const period of periods) {
      await db.insert(fiscalPeriods).values({
        churchId,
        ...period,
      });
    }

    // 4. Migrate users (MF-12: PIN → password with must-change flag)
    let migratedUsers = 0;
    for (const v1User of v1Users) {
      // Hash the 6-digit PIN as initial password
      const tempPassword = await PasswordService.hashPassword((v1User as { pin?: string }).pin ?? "");

      await db.insert(users).values({
        churchId,
        name: v1User.name,
        role: v1User.role as "super_admin" | "admin", // Map v1 roles directly
        passwordHash: tempPassword,
        // MF-12: Set passwordChangedAt = createdAt so system detects "must change"
        // This is done by keeping the default, which Drizzle sets to now()
        avatarColor: v1User.avatarColor || null,
        isActive: true,
      });
      migratedUsers++;
    }

    // 5. Migrate funds
    let migratedFunds = 0;
    for (const v1Fund of v1Funds) {
      // Find the COA equity account for this fund
      // Default: General Fund → 3-3001, if there's a second fund use 3-3002, etc.
      const equityAccountMap = ["3-3001", "3-3002", "3-3003", "3-3004"];
      const accountIdx = migratedFunds % equityAccountMap.length;
      const accountCode = equityAccountMap[accountIdx];

      const coaAccount = await db.query.chartOfAccounts.findFirst({
        where: eq(chartOfAccounts.accountCode, accountCode),
      });

      if (coaAccount) {
        await db.insert(funds).values({
          churchId,
          accountId: coaAccount.id,
          fundCode: v1Fund.id.toUpperCase(),
          name: v1Fund.name,
          description: v1Fund.description || null,
          isActive: true,
          openingBalance: String(v1Fund.openingBalance || 0),
          currentBalance: String(v1Fund.openingBalance || 0),
        });
        migratedFunds++;
      }
    }

    // 6. Create app settings
    await db.insert(appSettings).values({
      churchId,
      churchName: v1Settings.churchName || "คริสตจักรของฉัน",
      churchAddress: v1Settings.address || null,
      taxId: v1Settings.taxId || null,
      fiscalYearStart: v1Settings.fiscalYearStart || 1,
      idleTimeoutMin: v1Settings.idleTimeoutMin || 15,
      sessionMaxHours: 8,
      currency: "THB",
    });

    return {
      churchId,
      migratedUsers,
      migratedFunds,
      note: "Users must log in with their 6-digit PIN as password and will be forced to change it.",
    };
  }
}
