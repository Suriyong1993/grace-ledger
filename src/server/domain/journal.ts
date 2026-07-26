/**
 * Grace Ledger v2 — Journal Entry Engine
 *
 * Core double-entry accounting domain service.
 *
 * CRITICAL FIX (CF-2): Dual approval via approval_1_id/approval_2_id columns.
 * Uses SELECT ... FOR UPDATE to prevent race conditions.
 * CRITICAL FIX (CF-6): Supports "closing" entry_type for year-end close.
 */

import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { db } from "@/server/infrastructure/db";
import {
  journalEntries,
  journalEntryLines,
  generalLedger,
  chartOfAccounts,
  funds,
  fiscalPeriods,
  entryNumberCounters,
} from "@/db/schema";
import { Money } from "./money";
import type { EntryType, EntryStatus, LineType } from "./types";
import type { UserRole } from "./types";
import { getApprovalThreshold, canApproveAmount } from "@/server/auth/permissions";

// ============================================================================
// Domain Errors
// ============================================================================

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class UnbalancedEntryError extends DomainError {
  constructor(debits: Money, credits: Money) {
    super(
      "UNBALANCED_ENTRY",
      `Journal entry is unbalanced: debits ${debits.format()}, credits ${credits.format()}`,
    );
  }
}

export class InsufficientFundsError extends DomainError {
  constructor(fundId: string, fundName: string, available: Money, requested: Money) {
    super(
      "INSUFFICIENT_FUNDS",
      `Fund '${fundName}' has insufficient balance: ${available.format()} available, ${requested.format()} requested`,
      { fundId, available: available.toNumber(), requested: requested.toNumber() },
    );
  }
}

export class PeriodClosedError extends DomainError {
  constructor(fiscalYear: number, fiscalPeriod: number) {
    super("PERIOD_CLOSED", `Period ${fiscalYear}-${fiscalPeriod} is closed`);
  }
}

export class SelfApprovalError extends DomainError {
  constructor() {
    super("SELF_APPROVAL", "Cannot approve own transaction");
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(from: EntryStatus, to: EntryStatus) {
    super("INVALID_TRANSITION", `Cannot transition from '${from}' to '${to}'`);
  }
}

export class AlreadyVoidedError extends DomainError {
  constructor() {
    super("ALREADY_VOIDED", "Entry is already voided");
  }
}

// ============================================================================
// Journal Line & Entry Types
// ============================================================================

export interface CreateLineInput {
  accountId: string;
  lineType: LineType;
  amount: Money;
  fundId: string;
  memberId?: string;
  departmentId?: string;
  projectId?: string;
  description?: string;
}

export interface CreateJournalEntryInput {
  entryType: EntryType;
  postingDate: Date;
  description: string;
  fundId: string;
  fiscalYear: number;
  fiscalPeriod: number;
  lines: CreateLineInput[];
  referenceDocument?: string;
  voidParentId?: string;
}

export interface JournalEntryView {
  id: string;
  churchId: string;
  entryNumber: string;
  entryType: EntryType;
  postingDate: Date;
  description: string;
  status: EntryStatus;
  fundId: string;
  lines: JournalLineView[];
  totalDebit: Money;
  totalCredit: Money;
  createdBy: string;
  approval1Id?: string;
  approval2Id?: string;
  rejectionReason?: string;
  voidParentId?: string;
  fiscalYear: number;
  fiscalPeriod: number;
  version: number;
  createdAt: Date;
  postedAt?: Date;
}

export interface JournalLineView {
  id: string;
  accountId: string;
  lineType: LineType;
  amount: Money;
  fundId: string;
  memberId?: string;
  departmentId?: string;
  projectId?: string;
  description?: string;
}

// ============================================================================
// Journal Service (static for simplicity — no DI needed for MVP)
// ============================================================================

export class JournalService {
  /** Sum amounts by line type */
  private static sumByType(lines: CreateLineInput[], type: LineType): Money {
    return lines
      .filter((l) => l.lineType === type)
      .reduce((sum, l) => sum.add(l.amount), Money.zero());
  }

  /** Convert DB entry to view model */
  private static toView(entry: Record<string, any>): JournalEntryView {
    return {
      id: entry.id,
      churchId: entry.churchId,
      entryNumber: entry.entryNumber ?? "",
      entryType: entry.entryType as EntryType,
      postingDate: new Date(entry.postingDate),
      description: entry.description ?? "",
      status: entry.status as EntryStatus,
      fundId: entry.fundId,
      lines: [],
      totalDebit: Money.fromSqlDecimal(entry.totalDebit),
      totalCredit: Money.fromSqlDecimal(entry.totalCredit),
      createdBy: entry.createdBy,
      approval1Id: entry.approval1Id ?? undefined,
      approval2Id: entry.approval2Id ?? undefined,
      rejectionReason: entry.rejectionReason ?? undefined,
      voidParentId: entry.voidParentId ?? undefined,
      fiscalYear: entry.fiscalYear,
      fiscalPeriod: entry.fiscalPeriod,
      version: entry.version,
      createdAt: entry.createdAt!,
    };
  }

  /**
   * Create a journal entry. The ONLY entry point for financial transactions.
   */
  static async createEntry(
    input: CreateJournalEntryInput,
    churchId: string,
    userId: string,
  ): Promise<JournalEntryView> {
    const totalDebit = JournalService.sumByType(input.lines, "debit");
    const totalCredit = JournalService.sumByType(input.lines, "credit");

    if (!totalDebit.equals(totalCredit)) {
      throw new UnbalancedEntryError(totalDebit, totalCredit);
    }
    if (totalDebit.isZero()) {
      throw new DomainError("EMPTY_ENTRY", "Journal entry cannot have zero amounts");
    }
    if (input.lines.length < 2) {
      throw new DomainError("TOO_FEW_LINES", "Must have at least 2 lines");
    }
    if (input.postingDate > new Date()) {
      throw new DomainError("FUTURE_DATE", "Posting date cannot be in the future");
    }

    return await db.transaction(async (tx) => {
      // Check fiscal period is open
      const period = await tx
        .select()
        .from(fiscalPeriods)
        .where(
          and(
            eq(fiscalPeriods.churchId, churchId),
            eq(fiscalPeriods.fiscalYear, input.fiscalYear),
            eq(fiscalPeriods.periodNumber, input.fiscalPeriod),
          ),
        )
        .limit(1)
        .for("update");

      if (!period[0]) {
        throw new DomainError(
          "PERIOD_NOT_FOUND",
          `Period ${input.fiscalYear}-${input.fiscalPeriod} not found`,
        );
      }
      if (period[0].status !== "open") {
        throw new PeriodClosedError(input.fiscalYear, input.fiscalPeriod);
      }

      // Check fund active
      const fundRows = await tx
        .select()
        .from(funds)
        .where(
          and(eq(funds.id, input.fundId), eq(funds.churchId, churchId), eq(funds.isActive, true)),
        )
        .limit(1);

      if (!fundRows[0]) {
        throw new DomainError("FUND_NOT_FOUND", `Fund ${input.fundId} not found or inactive`);
      }

      // Lock fund row
      await tx.execute(sql`SELECT 1 FROM funds WHERE id = ${input.fundId} FOR UPDATE`);

      // Validate accounts
      for (const line of input.lines) {
        const accounts = await tx
          .select()
          .from(chartOfAccounts)
          .where(
            and(
              eq(chartOfAccounts.id, line.accountId),
              eq(chartOfAccounts.churchId, churchId),
              eq(chartOfAccounts.isActive, true),
            ),
          )
          .limit(1);
        if (!accounts[0]) {
          throw new DomainError("ACCOUNT_NOT_FOUND", `Account ${line.accountId} not found`);
        }
      }

      // Balance check for expenses
      if (input.entryType === "expense" || input.entryType === "transfer") {
        await JournalService.checkFundBalance(tx, input.fundId, input.lines, churchId);
      }

      // Insert entry
      const [entry] = await tx
        .insert(journalEntries)
        .values({
          churchId,
          entryType: input.entryType,
          postingDate: input.postingDate.toISOString().slice(0, 10),
          description: input.description,
          status: "draft",
          createdBy: userId,
          fundId: input.fundId,
          referenceDocument: input.referenceDocument,
          totalDebit: totalDebit.toSqlDecimal(),
          totalCredit: totalCredit.toSqlDecimal(),
          fiscalYear: input.fiscalYear,
          fiscalPeriod: input.fiscalPeriod,
          voidParentId: input.voidParentId,
        })
        .returning();

      // Insert lines (defer fund entry for post-approval posting)
      for (const line of input.lines) {
        await tx.insert(journalEntryLines).values({
          journalEntryId: entry.id,
          churchId,
          accountId: line.accountId,
          lineType: line.lineType,
          amount: line.amount.toSqlDecimal(),
          fundId: line.fundId,
          memberId: line.memberId,
          departmentId: line.departmentId,
          projectId: line.projectId,
          description: line.description,
        });
      }

      return {
        ...JournalService.toView(entry),
        entryNumber: "",
        lines: input.lines.map((l) => ({
          id: "",
          accountId: l.accountId,
          lineType: l.lineType,
          amount: l.amount,
          fundId: l.fundId,
          memberId: l.memberId,
          departmentId: l.departmentId,
          projectId: l.projectId,
          description: l.description,
        })),
      };
    });
  }

  /**
   * Approve a journal entry. Uses dual-approval columns (CF-2).
   */
  static async approveEntry(
    entryId: string,
    approverId: string,
    approverRole: UserRole,
    churchId: string,
  ): Promise<JournalEntryView> {
    return await db.transaction(async (tx) => {
      // Lock entry row (CF-2)
      const rows = await tx
        .select()
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.id, entryId),
            eq(journalEntries.churchId, churchId),
            isNull(journalEntries.deletedAt),
          ),
        )
        .limit(1)
        .for("update");

      const entry = rows[0];
      if (!entry) throw new DomainError("NOT_FOUND", "Journal entry not found");
      if (entry.status !== "pending")
        throw new InvalidTransitionError(entry.status as EntryStatus, "approved");
      if (entry.createdBy === approverId) throw new SelfApprovalError();

      const totalAmount = parseFloat(entry.totalDebit);
      if (!canApproveAmount(approverRole, totalAmount)) {
        throw new DomainError(
          "FORBIDDEN",
          `Role '${approverRole}' cannot approve ฿${totalAmount.toLocaleString()}`,
        );
      }

      const threshold = getApprovalThreshold(totalAmount);
      let approvedEntry: typeof entry = entry;

      if (threshold.requiresDualApproval) {
        if (!entry.approval1Id) {
          // First approval
          await tx
            .update(journalEntries)
            .set({ approval1Id: approverId })
            .where(eq(journalEntries.id, entryId));
          return JournalService.toView({ ...entry, approval1Id: approverId });
        } else if (entry.approval1Id === approverId) {
          throw new DomainError(
            "DUPLICATE_APPROVER",
            "Different approver required for dual approval",
          );
        } else {
          await tx
            .update(journalEntries)
            .set({ approval2Id: approverId, status: "approved", postedAt: new Date() })
            .where(eq(journalEntries.id, entryId));
          await JournalService.assignEntryNumber(tx, entry);
        }
      } else {
        await tx
          .update(journalEntries)
          .set({ approval1Id: approverId, status: "approved", postedAt: new Date() })
          .where(eq(journalEntries.id, entryId));
        await JournalService.assignEntryNumber(tx, entry);
      }

      // Get re-fetched entry with lines
      const updated = await tx
        .select()
        .from(journalEntries)
        .where(eq(journalEntries.id, entryId))
        .limit(1);
      approvedEntry = updated[0];

      // Post to GL and update fund balances
      const lines = await tx
        .select()
        .from(journalEntryLines)
        .where(eq(journalEntryLines.journalEntryId, entryId));
      await JournalService.postToLedger(tx, approvedEntry, lines, churchId);
      await JournalService.updateFundBalances(tx, lines, churchId);

      return JournalService.toView(approvedEntry);
    });
  }

  /** Reject a journal entry */
  static async rejectEntry(entryId: string, reason: string, churchId: string): Promise<void> {
    if (!reason || reason.length < 10) {
      throw new DomainError("REASON_REQUIRED", "Rejection reason must be at least 10 characters");
    }
    // RACE CONDITION FIX: Use transaction with FOR UPDATE to prevent concurrent modifications
    await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.id, entryId), eq(journalEntries.churchId, churchId)))
        .limit(1)
        .for("update");
      if (!rows[0]) throw new DomainError("NOT_FOUND", "Not found");
      if (rows[0].status !== "pending")
        throw new InvalidTransitionError(rows[0].status as EntryStatus, "rejected");
      await tx
        .update(journalEntries)
        .set({ status: "rejected", rejectionReason: reason, updatedAt: new Date() })
        .where(eq(journalEntries.id, entryId));
    });
  }

  /** Submit draft for approval */
  static async submitForApproval(entryId: string, userId: string, churchId: string): Promise<void> {
    // RACE CONDITION FIX: Use transaction with FOR UPDATE to prevent concurrent modifications
    await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.id, entryId), eq(journalEntries.churchId, churchId)))
        .limit(1)
        .for("update");
      if (!rows[0]) throw new DomainError("NOT_FOUND", "Not found");
      if (rows[0].createdBy !== userId)
        throw new DomainError("FORBIDDEN", "Only creator can submit");
      if (rows[0].status !== "draft")
        throw new InvalidTransitionError(rows[0].status as EntryStatus, "pending");
      await tx
        .update(journalEntries)
        .set({ status: "pending", updatedAt: new Date() })
        .where(eq(journalEntries.id, entryId));
    });
  }

  /** Void an approved entry */
  static async voidEntry(
    entryId: string,
    voidedBy: string,
    reason: string,
    churchId: string,
  ): Promise<JournalEntryView> {
    if (!reason) throw new DomainError("REASON_REQUIRED", "Void reason required");

    const rows = await db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, entryId), eq(journalEntries.churchId, churchId)))
      .limit(1);
    const original = rows[0];
    if (!original) throw new DomainError("NOT_FOUND", "Not found");
    if (original.status === "voided") throw new AlreadyVoidedError();
    if (original.status !== "approved")
      throw new InvalidTransitionError(original.status as EntryStatus, "voided");

    const originalLines = await db
      .select()
      .from(journalEntryLines)
      .where(eq(journalEntryLines.journalEntryId, entryId));

    const reversedLines: CreateLineInput[] = originalLines.map((l) => ({
      accountId: l.accountId,
      lineType: (l.lineType === "debit" ? "credit" : "debit") as LineType,
      amount: Money.fromSqlDecimal(l.amount),
      fundId: l.fundId,
      memberId: l.memberId ?? undefined,
      departmentId: l.departmentId ?? undefined,
      projectId: l.projectId ?? undefined,
      description: `[VOID] ${l.description ?? ""} — ${reason}`,
    }));

    // FIX: Create reversal entry first, then auto-submit for approval
    // This ensures the reversal is in the approval queue and books will balance once approved
    const reversalEntry = await JournalService.createEntry(
      {
        entryType: "void",
        postingDate: new Date(),
        description: `ยกเลิกรายการ ${original.entryNumber}: ${reason}`,
        fundId: original.fundId,
        fiscalYear: original.fiscalYear,
        fiscalPeriod: original.fiscalPeriod,
        lines: reversedLines,
        voidParentId: original.id,
      },
      churchId,
      voidedBy,
    );

    // Auto-submit the reversal for approval so it's visible in the approval queue
    await JournalService.submitForApproval(reversalEntry.id, voidedBy, churchId);

    // Only mark original as voided after reversal is created and submitted
    await db
      .update(journalEntries)
      .set({ status: "voided", updatedAt: new Date() })
      .where(eq(journalEntries.id, entryId));

    // Return the updated reversal entry (now in "pending" status)
    const updatedRows = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, reversalEntry.id))
      .limit(1);
    return JournalService.toView(updatedRows[0]);
  }

  // ========== Private helpers ==========

  private static async assignEntryNumber(tx: any, entry: any): Promise<void> {
    const prefixMap: Record<string, string> = {
      offering: "OFF",
      expense: "EXP",
      income: "INC",
      transfer: "TRF",
      opening: "OPN",
      adjustment: "ADJ",
      void: "VOID",
      closing: "CLS",
    };
    const prefix = prefixMap[entry.entryType] ?? "JNL";

    // RACE CONDITION FIX: Use atomic counter table instead of $count
    // This prevents duplicate entry numbers when multiple approvals happen concurrently
    const [counter] = await tx
      .insert(entryNumberCounters)
      .values({
        churchId: entry.churchId,
        entryType: entry.entryType,
        fiscalYear: entry.fiscalYear,
        lastNumber: 1,
      })
      .onConflictDoUpdate({
        target: [
          entryNumberCounters.churchId,
          entryNumberCounters.entryType,
          entryNumberCounters.fiscalYear,
        ],
        set: {
          lastNumber: sql`${entryNumberCounters.lastNumber} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning({ lastNumber: entryNumberCounters.lastNumber });

    const entryNumber = `${prefix}-${entry.fiscalYear}-${String(counter.lastNumber).padStart(4, "0")}`;
    await tx.update(journalEntries).set({ entryNumber }).where(eq(journalEntries.id, entry.id));
  }

  private static async checkFundBalance(
    tx: any,
    fundId: string,
    lines: CreateLineInput[],
    churchId: string,
  ): Promise<void> {
    const fundRows = await tx
      .select()
      .from(funds)
      .where(and(eq(funds.id, fundId), eq(funds.churchId, churchId)))
      .limit(1);
    const fund = fundRows[0];
    if (!fund) return;

    // Get latest GL balance
    const glRows = await tx
      .select()
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

    const currentBalance = glRows[0]
      ? Money.fromSqlDecimal(glRows[0].runningBalance)
      : Money.fromSqlDecimal(fund.openingBalance);

    const totalDraw = lines
      .filter((l) => l.accountId === fund.accountId && l.lineType === "debit")
      .reduce((sum, l) => sum.add(l.amount), Money.zero());

    if (totalDraw.isGreaterThan(currentBalance)) {
      throw new InsufficientFundsError(fundId, fund.name, currentBalance, totalDraw);
    }
  }

  private static async postToLedger(
    tx: any,
    entry: any,
    lines: any[],
    churchId: string,
  ): Promise<void> {
    for (const line of lines) {
      const acctRows = await tx
        .select()
        .from(chartOfAccounts)
        .where(eq(chartOfAccounts.id, line.accountId))
        .limit(1);
      const account = acctRows[0];
      if (!account) continue;

      const glRows = await tx
        .select()
        .from(generalLedger)
        .where(
          and(
            eq(generalLedger.accountId, line.accountId),
            eq(generalLedger.fundId, line.fundId),
            eq(generalLedger.churchId, churchId),
          ),
        )
        .orderBy(desc(generalLedger.createdAt))
        .limit(1);

      const currentBalance = glRows[0]
        ? Money.fromSqlDecimal(glRows[0].runningBalance)
        : Money.zero();
      const effectiveNormal = account.isContra
        ? account.normalBalance === "debit"
          ? "credit"
          : "debit"
        : account.normalBalance;
      const amount = Money.fromSqlDecimal(line.amount);

      let newBalance: Money;
      if (effectiveNormal === "debit") {
        newBalance =
          line.lineType === "debit" ? currentBalance.add(amount) : currentBalance.subtract(amount);
      } else {
        newBalance =
          line.lineType === "credit" ? currentBalance.add(amount) : currentBalance.subtract(amount);
      }

      await tx.insert(generalLedger).values({
        churchId,
        accountId: line.accountId,
        postingDate: entry.postingDate,
        journalEntryId: entry.id,
        journalLineId: line.id,
        fundId: line.fundId,
        debitAmount: line.lineType === "debit" ? line.amount : "0.00",
        creditAmount: line.lineType === "credit" ? line.amount : "0.00",
        runningBalance: newBalance.toSqlDecimal(),
        fiscalYear: entry.fiscalYear,
        fiscalPeriod: entry.fiscalPeriod,
      });
    }
  }

  private static async updateFundBalances(tx: any, lines: any[], _churchId: string): Promise<void> {
    const fundIds = [...new Set(lines.map((l: any) => l.fundId))];
    for (const fundId of fundIds) {
      const fundRows = await tx.select().from(funds).where(eq(funds.id, fundId)).limit(1);
      if (!fundRows[0]) continue;
      const fund = fundRows[0];

      const glEntries = await tx
        .select()
        .from(generalLedger)
        .where(and(eq(generalLedger.fundId, fundId), eq(generalLedger.accountId, fund.accountId)));

      // CRITICAL FIX: Start from opening balance, not zero.
      // For equity accounts (normal balance = credit): credits increase, debits decrease.
      const openingBalance = Money.fromSqlDecimal(fund.openingBalance);
      const balance = glEntries.reduce((acc: Money, gl: any) => {
        const d = Money.fromSqlDecimal(gl.debitAmount);
        const c = Money.fromSqlDecimal(gl.creditAmount);
        return d.isPositive() ? acc.subtract(d) : acc.add(c);
      }, openingBalance);

      await tx
        .update(funds)
        .set({
          currentBalance: balance.toSqlDecimal(),
          lastCalculatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(funds.id, fundId));
    }
  }
}
