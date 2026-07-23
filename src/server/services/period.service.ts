/**
 * Grace Ledger v2 — Fiscal Period Service
 *
 * Manages fiscal periods: close, reopen, status queries.
 * Closed periods block all new journal entries within their date range.
 */

import { db } from "@/server/infrastructure/db";
import { fiscalPeriods, journalEntries } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { AuditService } from "./audit.service";
import { DomainError } from "@/server/domain/journal";
import { Money } from "@/server/domain/money";

export interface PeriodView {
  id: string;
  churchId: string;
  fiscalYear: number;
  periodNumber: number;
  startDate: string;
  endDate: string;
  status: "open" | "closed" | "reconciled";
  closedBy: string | null;
  closedAt: string | null;
  version: number;
}

export class PeriodService {
  /** List fiscal periods for a church */
  static async listPeriods(churchId: string, fiscalYear?: number): Promise<PeriodView[]> {
    const conditions = [eq(fiscalPeriods.churchId, churchId)];
    if (fiscalYear) conditions.push(eq(fiscalPeriods.fiscalYear, fiscalYear));

    const rows = await db.select().from(fiscalPeriods).where(and(...conditions))
      .orderBy(fiscalPeriods.fiscalYear, fiscalPeriods.periodNumber);

    return rows.map(PeriodService.toView);
  }

  /** Get a single period */
  static async getPeriod(churchId: string, periodId: string): Promise<PeriodView | null> {
    const rows = await db.select().from(fiscalPeriods).where(
      and(eq(fiscalPeriods.id, periodId), eq(fiscalPeriods.churchId, churchId)),
    ).limit(1);
    if (!rows[0]) return null;
    return PeriodService.toView(rows[0]);
  }

  /** Check if a period is open (for journal entry validation) */
  static async isPeriodOpen(churchId: string, fiscalYear: number, periodNumber: number): Promise<boolean> {
    const rows = await db.select({ status: fiscalPeriods.status }).from(fiscalPeriods).where(
      and(
        eq(fiscalPeriods.churchId, churchId),
        eq(fiscalPeriods.fiscalYear, fiscalYear),
        eq(fiscalPeriods.periodNumber, periodNumber),
      ),
    ).limit(1);
    return rows[0]?.status === "open";
  }

  /** Close a fiscal period */
  static async closePeriod(
    churchId: string,
    periodId: string,
    userId: string,
    userName: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PeriodView> {
    const period = await PeriodService.getPeriod(churchId, periodId);
    if (!period) throw new DomainError("NOT_FOUND", "Period not found");
    if (period.status !== "open") {
      throw new DomainError("PERIOD_NOT_OPEN", `Period ${period.fiscalYear}-${period.periodNumber} is already ${period.status}`);
    }

    // Check no pending/draft entries in this period
    const pendingEntries = await db.select({ id: journalEntries.id }).from(journalEntries).where(
      and(
        eq(journalEntries.churchId, churchId),
        eq(journalEntries.fiscalYear, period.fiscalYear),
        eq(journalEntries.fiscalPeriod, period.periodNumber),
        eq(journalEntries.status, "draft"),
      ),
    ).limit(1);

    if (pendingEntries[0]) {
      throw new DomainError("PENDING_ENTRIES", "Cannot close period with draft entries. Submit or delete them first.");
    }

    await db.update(fiscalPeriods).set({
      status: "closed",
      closedBy: userId,
      closedAt: new Date(),
      updatedAt: new Date(),
      version: period.version + 1,
    }).where(eq(fiscalPeriods.id, periodId));

    const updated = await PeriodService.getPeriod(churchId, periodId);

    await AuditService.logUpdate(
      churchId,
      "fiscal_period",
      periodId,
      userId,
      userName,
      period as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
      ipAddress,
      userAgent,
    );

    return updated!;
  }

  /** Reopen a closed period */
  static async reopenPeriod(
    churchId: string,
    periodId: string,
    userId: string,
    userName: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PeriodView> {
    const period = await PeriodService.getPeriod(churchId, periodId);
    if (!period) throw new DomainError("NOT_FOUND", "Period not found");
    if (period.status !== "closed") {
      throw new DomainError("PERIOD_NOT_CLOSED", "Only closed periods can be reopened");
    }

    await db.update(fiscalPeriods).set({
      status: "open",
      reopenedBy: userId,
      reopenedAt: new Date(),
      closedBy: null,
      closedAt: null,
      updatedAt: new Date(),
      version: period.version + 1,
    }).where(eq(fiscalPeriods.id, periodId));

    const updated = await PeriodService.getPeriod(churchId, periodId);

    await AuditService.logUpdate(
      churchId,
      "fiscal_period",
      periodId,
      userId,
      userName,
      period as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
      ipAddress,
      userAgent,
    );

    return updated!;
  }

  /** Get current active period for a date */
  static async getPeriodForDate(churchId: string, dateStr: string): Promise<PeriodView | null> {
    const rows = await db.select().from(fiscalPeriods).where(
      and(
        eq(fiscalPeriods.churchId, churchId),
        // Period contains the date
        eq(fiscalPeriods.startDate, dateStr.slice(0, 10)),
      ),
    ).limit(1);

    if (rows[0]) return PeriodService.toView(rows[0]);

    // Fallback: find period that contains this date
    const all = await db.select().from(fiscalPeriods).where(
      eq(fiscalPeriods.churchId, churchId),
    );

    for (const p of all) {
      if (dateStr >= p.startDate && dateStr <= p.endDate) {
        return PeriodService.toView(p);
      }
    }
    return null;
  }

  private static toView(row: Record<string, any>): PeriodView {
    return {
      id: row.id,
      churchId: row.churchId,
      fiscalYear: row.fiscalYear,
      periodNumber: row.periodNumber,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      closedBy: row.closedBy ?? null,
      closedAt: row.closedAt?.toISOString() ?? null,
      version: row.version,
    };
  }
}