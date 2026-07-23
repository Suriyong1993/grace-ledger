/**
 * Grace Ledger v2 — Fund Service
 *
 * Manages fund lifecycle: create, update, activate/deactivate, balance queries.
 * All fund mutations are audited.
 */

import { db } from "@/server/infrastructure/db";
import { funds, chartOfAccounts, generalLedger } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { Money } from "@/server/domain/money";
import { AuditService } from "./audit.service";
import { DomainError } from "@/server/domain/journal";

export interface FundView {
  id: string;
  churchId: string;
  accountId: string;
  fundCode: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isRestricted: boolean;
  openingBalance: Money;
  currentBalance: Money;
  version: number;
}

export class FundService {
  /** List all funds for a church */
  static async listFunds(churchId: string, includeInactive = false): Promise<FundView[]> {
    const conditions = [eq(funds.churchId, churchId)];
    if (!includeInactive) {
      conditions.push(eq(funds.isActive, true));
    }
    const rows = await db.select().from(funds).where(and(...conditions));
    return rows.map(FundService.toView);
  }

  /** Get a single fund */
  static async getFund(churchId: string, fundId: string): Promise<FundView | null> {
    const rows = await db.select().from(funds).where(
      and(eq(funds.id, fundId), eq(funds.churchId, churchId))
    ).limit(1);
    if (!rows[0]) return null;
    return FundService.toView(rows[0]);
  }

  /** Create a new fund */
  static async createFund(
    input: {
      churchId: string;
      fundCode: string;
      name: string;
      accountId: string;
      description?: string;
      isRestricted?: boolean;
      openingBalance?: Money;
    },
    userId: string,
    userName: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<FundView> {
    // Validate account exists and is equity type
    const account = await db.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.id, input.accountId),
        eq(chartOfAccounts.churchId, input.churchId),
        eq(chartOfAccounts.isActive, true),
      ),
    });
    if (!account) throw new DomainError("ACCOUNT_NOT_FOUND", "Equity account not found");
    if (account.accountType !== "equity") {
      throw new DomainError("INVALID_ACCOUNT_TYPE", "Fund must link to an equity account");
    }

    const openingBalance = input.openingBalance ?? Money.zero();

    const [row] = await db.insert(funds).values({
      churchId: input.churchId,
      fundCode: input.fundCode,
      name: input.name,
      accountId: input.accountId,
      description: input.description ?? null,
      isRestricted: input.isRestricted ?? false,
      openingBalance: openingBalance.toSqlDecimal(),
      currentBalance: openingBalance.toSqlDecimal(),
    }).returning();

    await AuditService.logCreate(
      input.churchId,
      "fund",
      row.id,
      userId,
      userName,
      FundService.toView(row) as unknown as Record<string, unknown>,
      ipAddress,
      userAgent,
    );

    return FundService.toView(row);
  }

  /** Update fund metadata */
  static async updateFund(
    input: {
      churchId: string;
      fundId: string;
      name?: string;
      description?: string | null;
      isActive?: boolean;
      isRestricted?: boolean;
    },
    userId: string,
    userName: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<FundView> {
    const existing = await FundService.getFund(input.churchId, input.fundId);
    if (!existing) throw new DomainError("NOT_FOUND", "Fund not found");

    const updates: Record<string, unknown> = { updatedAt: new Date(), version: existing.version + 1 };
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.isActive !== undefined) updates.isActive = input.isActive;
    if (input.isRestricted !== undefined) updates.isRestricted = input.isRestricted;

    await db.update(funds).set(updates).where(and(eq(funds.id, input.fundId), eq(funds.churchId, input.churchId)));

    const updated = await FundService.getFund(input.churchId, input.fundId);

    await AuditService.logUpdate(
      input.churchId,
      "fund",
      input.fundId,
      userId,
      userName,
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
      ipAddress,
      userAgent,
    );

    return updated!;
  }

  /** Get fund balance from GL (authoritative source) */
  static async getFundBalance(churchId: string, fundId: string): Promise<Money> {
    const fund = await FundService.getFund(churchId, fundId);
    if (!fund) throw new DomainError("NOT_FOUND", "Fund not found");

    const glRows = await db.select({ runningBalance: generalLedger.runningBalance })
      .from(generalLedger)
      .where(
        and(
          eq(generalLedger.fundId, fundId),
          eq(generalLedger.accountId, fund.accountId),
          eq(generalLedger.churchId, churchId),
        ),
      )
      .orderBy(desc(generalLedger.createdAt))
      .limit(1);

    if (glRows[0]) {
      return Money.fromSqlDecimal(glRows[0].runningBalance);
    }
    return fund.openingBalance;
  }

  private static toView(row: Record<string, any>): FundView {
    return {
      id: row.id,
      churchId: row.churchId,
      accountId: row.accountId,
      fundCode: row.fundCode,
      name: row.name,
      description: row.description ?? null,
      isActive: row.isActive,
      isRestricted: row.isRestricted,
      openingBalance: Money.fromSqlDecimal(row.openingBalance),
      currentBalance: Money.fromSqlDecimal(row.currentBalance),
      version: row.version,
    };
  }
}