/**
 * Grace Ledger v2 — Fund Transfer Service
 *
 * Atomic fund-to-fund transfers using balanced journal entries.
 * Transfer: Debit source fund's equity, Credit destination fund's equity.
 * Both entries go through the double-entry journal with full approval workflow.
 */

import { JournalService } from "@/server/domain/journal";
import { Money } from "@/server/domain/money";
import { FundService } from "./fund.service";
import { PeriodService } from "./period.service";
import { AuditService } from "./audit.service";
import { DomainError } from "@/server/domain/journal";
import { db } from "@/server/infrastructure/db";
import { chartOfAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export interface TransferInput {
  fromFundId: string;
  toFundId: string;
  amount: Money;
  description: string;
  postingDate: string;
  fiscalYear: number;
  fiscalPeriod: number;
}

export class TransferService {
  /**
   * Create a fund transfer as a balanced journal entry.
   * Creates: debit from-fund equity, credit to-fund equity.
   * The journal entry must go through approval before it posts.
   */
  static async createTransfer(
    input: TransferInput,
    churchId: string,
    userId: string,
    userName: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Validate funds
    const fromFund = await FundService.getFund(churchId, input.fromFundId);
    if (!fromFund || !fromFund.isActive) {
      throw new DomainError("FUND_NOT_FOUND", "Source fund not found or inactive");
    }

    const toFund = await FundService.getFund(churchId, input.toFundId);
    if (!toFund || !toFund.isActive) {
      throw new DomainError("FUND_NOT_FOUND", "Destination fund not found or inactive");
    }

    if (input.fromFundId === input.toFundId) {
      throw new DomainError("SAME_FUND", "Cannot transfer to the same fund");
    }

    if (input.amount.isZero() || input.amount.isNegative()) {
      throw new DomainError("INVALID_AMOUNT", "Transfer amount must be positive");
    }

    // Check period
    const isOpen = await PeriodService.isPeriodOpen(churchId, input.fiscalYear, input.fiscalPeriod);
    if (!isOpen) {
      throw new DomainError("PERIOD_CLOSED", "Cannot create transfer in a closed period");
    }

    // Get the COA equity accounts for both funds
    const fromAccount = await db.query.chartOfAccounts.findFirst({
      where: and(eq(chartOfAccounts.id, fromFund.accountId), eq(chartOfAccounts.churchId, churchId)),
    });
    const toAccount = await db.query.chartOfAccounts.findFirst({
      where: and(eq(chartOfAccounts.id, toFund.accountId), eq(chartOfAccounts.churchId, churchId)),
    });

    if (!fromAccount || !toAccount) {
      throw new DomainError("ACCOUNT_NOT_FOUND", "Equity account mapping missing");
    }

    // Create the journal entry with balanced lines:
    // Debit: Source fund's equity account (reduces it)
    // Credit: Destination fund's equity account (increases it)
    const entry = await JournalService.createEntry(
      {
        entryType: "transfer",
        postingDate: new Date(input.postingDate),
        description: input.description || `โอนระหว่างกองทุน: ${fromFund.name} → ${toFund.name}`,
        fundId: input.fromFundId,
        fiscalYear: input.fiscalYear,
        fiscalPeriod: input.fiscalPeriod,
        lines: [
          {
            accountId: fromAccount.id,
            lineType: "debit",
            amount: input.amount,
            fundId: input.fromFundId,
            description: `โอนออกไปยัง ${toFund.name}`,
          },
          {
            accountId: toAccount.id,
            lineType: "credit",
            amount: input.amount,
            fundId: input.toFundId,
            description: `รับโอนจาก ${fromFund.name}`,
          },
        ],
      },
      churchId,
      userId,
    );

    await AuditService.logCreate(
      churchId,
      "transfer",
      entry.id,
      userId,
      userName,
      {
        entryNumber: entry.entryNumber,
        fromFund: fromFund.name,
        toFund: toFund.name,
        amount: input.amount.toNumber(),
      },
      ipAddress,
      userAgent,
    );

    return entry;
  }
}