/**
 * Grace Ledger v2 — Reconciliation Service
 *
 * Manages bank/cash reconciliation for church funds.
 * Creates reconciliation records, links to journal entries if needed.
 */

import { db } from "@/server/infrastructure/db";
import { reconciliations, fiscalPeriods, generalLedger } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { Money } from "@/server/domain/money";
import { AuditService } from "./audit.service";
import { FundService } from "./fund.service";
import { PeriodService } from "./period.service";
import { DomainError } from "@/server/domain/journal";

export interface ReconciliationView {
  id: string;
  churchId: string;
  periodId: string;
  fundId: string;
  openingBalance: Money;
  systemBalance: Money;
  actualBalance: Money;
  variance: Money;
  explanation: string | null;
  isReconciled: boolean;
  previousReconciliationId: string | null;
  reconciledBy: string;
  reconciledAt: string;
}

export class ReconciliationService {
  /** Get reconciliation for a period + fund */
  static async getReconciliation(
    churchId: string,
    periodId: string,
    fundId: string,
  ): Promise<ReconciliationView | null> {
    const rows = await db
      .select()
      .from(reconciliations)
      .where(
        and(
          eq(reconciliations.churchId, churchId),
          eq(reconciliations.periodId, periodId),
          eq(reconciliations.fundId, fundId),
        ),
      )
      .limit(1);
    if (!rows[0]) return null;
    return ReconciliationService.toView(rows[0]);
  }

  /** List reconciliations for a period */
  static async listForPeriod(churchId: string, periodId: string): Promise<ReconciliationView[]> {
    const rows = await db
      .select()
      .from(reconciliations)
      .where(and(eq(reconciliations.churchId, churchId), eq(reconciliations.periodId, periodId)));
    return rows.map(ReconciliationService.toView);
  }

  /** Create a reconciliation record */
  static async reconcile(
    input: {
      churchId: string;
      periodId: string;
      fundId: string;
      actualBalance: Money;
      explanation?: string;
    },
    userId: string,
    userName: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ReconciliationView> {
    const period = await PeriodService.getPeriod(input.churchId, input.periodId);
    if (!period) throw new DomainError("NOT_FOUND", "Period not found");

    const fund = await FundService.getFund(input.churchId, input.fundId);
    if (!fund) throw new DomainError("NOT_FOUND", "Fund not found");

    // Calculate system balance from GL
    const systemBalance = await FundService.getFundBalance(input.churchId, input.fundId);

    // Get previous reconciliation opening balance
    const prevRec = await db
      .select()
      .from(reconciliations)
      .where(
        and(eq(reconciliations.churchId, input.churchId), eq(reconciliations.fundId, input.fundId)),
      )
      .orderBy(desc(reconciliations.createdAt))
      .limit(1);

    const openingBalance = prevRec[0]
      ? Money.fromSqlDecimal(prevRec[0].actualBalance)
      : fund.openingBalance;

    const variance = input.actualBalance.subtract(systemBalance);

    const [row] = await db
      .insert(reconciliations)
      .values({
        churchId: input.churchId,
        periodId: input.periodId,
        fundId: input.fundId,
        openingBalance: openingBalance.toSqlDecimal(),
        systemBalance: systemBalance.toSqlDecimal(),
        actualBalance: input.actualBalance.toSqlDecimal(),
        variance: variance.toSqlDecimal(),
        explanation: input.explanation ?? null,
        isReconciled: true,
        previousReconciliationId: prevRec[0]?.id ?? null,
        reconciledBy: userId,
        reconciledAt: new Date(),
      })
      .returning();

    // Update period status to reconciled
    await db
      .update(fiscalPeriods)
      .set({ status: "reconciled", updatedAt: new Date() })
      .where(and(eq(fiscalPeriods.id, input.periodId), eq(fiscalPeriods.churchId, input.churchId)));

    const view = ReconciliationService.toView(row);

    await AuditService.logCreate(
      input.churchId,
      "reconciliation",
      row.id,
      userId,
      userName,
      view as unknown as Record<string, unknown>,
      ipAddress,
      userAgent,
    );

    return view;
  }

  private static toView(row: typeof reconciliations.$inferSelect): ReconciliationView {
    return {
      id: row.id,
      churchId: row.churchId,
      periodId: row.periodId,
      fundId: row.fundId,
      openingBalance: Money.fromSqlDecimal(row.openingBalance),
      systemBalance: Money.fromSqlDecimal(row.systemBalance),
      actualBalance: Money.fromSqlDecimal(row.actualBalance),
      variance: Money.fromSqlDecimal(row.variance),
      explanation: row.explanation ?? null,
      isReconciled: row.isReconciled,
      previousReconciliationId: row.previousReconciliationId ?? null,
      reconciledBy: row.reconciledBy,
      reconciledAt: row.reconciledAt.toISOString(),
    };
  }
}
