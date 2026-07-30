# Grace Ledger v2 — Accounting Engine

**Version:** 2.0
**Date:** 22 July 2026
**Audience:** Senior engineers implementing the financial core

---

## Table of Contents

1. [Double-Entry Fundamentals](#1-double-entry-fundamentals)
2. [Chart of Accounts](#2-chart-of-accounts)
3. [Journal Entry Engine](#3-journal-entry-engine)
4. [General Ledger & Posting Rules](#4-general-ledger--posting-rules)
5. [Fund Accounting Layer](#5-fund-accounting-layer)
6. [Trial Balance](#6-trial-balance)
7. [Financial Transaction Mapping](#7-financial-transaction-mapping)
8. [Period Opening & Closing](#8-period-opening--closing)
9. [Reconciliation Engine](#9-reconciliation-engine)
10. [Budget Integration](#10-budget-integration)
11. [Financial Statement Generation](#11-financial-statement-generation)

---

## 1. Double-Entry Fundamentals

### 1.1 The Accounting Equation

The system enforces the fundamental accounting equation at all times:

```
Assets = Liabilities + Equity
```

Expanded:

```
Assets = Liabilities + Equity + (Income - Expenses)
```

In double-entry terms:

```
Σ Debits = Σ Credits  (for every journal entry)
```

### 1.2 Normal Balances by Account Type

| Account Type | Normal Balance | To Increase | To Decrease |
| ------------ | -------------- | ----------- | ----------- |
| Asset        | Debit          | Debit       | Credit      |
| Liability    | Credit         | Credit      | Debit       |
| Equity       | Credit         | Credit      | Debit       |
| Income       | Credit         | Credit      | Debit       |
| Expense      | Debit          | Debit       | Credit      |

### 1.3 Money Type

All monetary values use a precise `Money` value object:

```typescript
// src/server/domain/money.ts
export class Money {
  private constructor(
    private readonly amountInSatang: bigint, // Stored in satang (1/100 of THB) for exact precision
  ) {}

  static fromBaht(baht: number): Money {
    // Convert to satang to avoid floating-point precision issues
    const satang = BigInt(Math.round(baht * 100));
    return new Money(satang);
  }

  static zero(): Money {
    return new Money(0n);
  }

  add(other: Money): Money {
    return new Money(this.amountInSatang + other.amountInSatang);
  }

  subtract(other: Money): Money {
    return new Money(this.amountInSatang - other.amountInSatang);
  }

  multiply(factor: number): Money {
    const result = Number(this.amountInSatang) * factor;
    return new Money(BigInt(Math.round(result)));
  }

  isGreaterThan(other: Money): boolean {
    return this.amountInSatang > other.amountInSatang;
  }

  isGreaterThanOrEqual(other: Money): boolean {
    return this.amountInSatang >= other.amountInSatang;
  }

  isZero(): boolean {
    return this.amountInSatang === 0n;
  }

  isNegative(): boolean {
    return this.amountInSatang < 0n;
  }

  equals(other: Money): boolean {
    return this.amountInSatang === other.amountInSatang;
  }

  toNumber(): number {
    return Number(this.amountInSatang) / 100;
  }

  format(locale: string = "th-TH"): string {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 2,
    }).format(this.toNumber());
  }

  toString(): string {
    return this.amountInSatang.toString();
  }
}
```

---

## 2. Chart of Accounts

### 2.1 Account Code Structure

```
{type_major}{type_minor}{account_number}
  1-1001     = Cash on Hand (Asset #001)
  4-4002     = Special Offerings (Income #002)
  5-5003     = Maintenance (Expense #003)
```

| Prefix | Account Type | Normal Balance |
| ------ | ------------ | -------------- |
| 1xxx   | Asset        | Debit          |
| 2xxx   | Liability    | Credit         |
| 3xxx   | Equity       | Credit         |
| 4xxx   | Income       | Credit         |
| 5xxx   | Expense      | Debit          |

### 2.2 Account Domain Model

```typescript
// src/server/domain/chart-of-accounts.ts
export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type NormalBalance = "debit" | "credit";

export interface Account {
  id: string;
  accountCode: string; // e.g., '1-1001'
  accountName: string; // e.g., 'เงินสด'
  accountType: AccountType;
  parentId: string | null; // For hierarchical accounts
  isActive: boolean;
  isContra: boolean; // Contra accounts (e.g., accumulated depreciation)
  normalBalance: NormalBalance;
  description: string | null;
  sortOrder: number;
  tfrsCode: string | null; // Thai Financial Reporting Standards mapping
}

// Default Thai Church Chart of Accounts
export const DEFAULT_CHART_OF_ACCOUNTS: Omit<
  Account,
  "id" | "createdAt" | "updatedAt" | "version"
>[] = [
  // ============ 1xxx ASSETS ============
  {
    accountCode: "1-1001",
    accountName: "เงินสด",
    accountType: "asset",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "debit",
    description: "เงินสดในมือ",
    sortOrder: 1,
    tfrsCode: "A100",
  },
  {
    accountCode: "1-1002",
    accountName: "เงินฝากธนาคาร",
    accountType: "asset",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "debit",
    description: "เงินฝากธนาคารทุกบัญชี",
    sortOrder: 2,
    tfrsCode: "A110",
  },
  {
    accountCode: "1-1003",
    accountName: "ลูกหนี้",
    accountType: "asset",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "debit",
    description: "ลูกหนี้เงินยืม/อื่น ๆ",
    sortOrder: 3,
    tfrsCode: "A120",
  },
  {
    accountCode: "1-1004",
    accountName: "ที่ดิน",
    accountType: "asset",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "debit",
    description: "ที่ดินของคริสตจักร",
    sortOrder: 4,
    tfrsCode: "A200",
  },
  {
    accountCode: "1-1005",
    accountName: "อาคาร",
    accountType: "asset",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "debit",
    description: "อาคารและสิ่งปลูกสร้าง",
    sortOrder: 5,
    tfrsCode: "A210",
  },
  {
    accountCode: "1-1006",
    accountName: "อุปกรณ์",
    accountType: "asset",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "debit",
    description: "อุปกรณ์สำนักงานและอื่น ๆ",
    sortOrder: 6,
    tfrsCode: "A220",
  },
  {
    accountCode: "1-1007",
    accountName: "ค่าเสื่อมราคาสะสม",
    accountType: "asset",
    parentId: null,
    isActive: true,
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
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "credit",
    description: "เจ้าหนี้ค่าสินค้า/บริการ",
    sortOrder: 8,
    tfrsCode: "L100",
  },
  {
    accountCode: "2-2002",
    accountName: "เงินกู้ยืม",
    accountType: "liability",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "credit",
    description: "เงินกู้ยืมจากสถาบันการเงิน",
    sortOrder: 9,
    tfrsCode: "L200",
  },
  {
    accountCode: "2-2003",
    accountName: "ภาษีหัก ณ ที่จ่ายค้างจ่าย",
    accountType: "liability",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "credit",
    description: "ภ.ง.ด.3, ภ.ง.ด.53 ค้างจ่าย",
    sortOrder: 10,
    tfrsCode: "L300",
  },
  {
    accountCode: "2-2004",
    accountName: "เงินประกันสังคมค้างจ่าย",
    accountType: "liability",
    parentId: null,
    isActive: true,
    isContra: false,
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
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "credit",
    description: "กองทุนทั่วไปของคริสตจักร",
    sortOrder: 12,
    tfrsCode: "E100",
  },
  {
    accountCode: "3-3002",
    accountName: "กองทุนอาคารและที่ดิน",
    accountType: "equity",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "credit",
    description: "กองทุนที่ดินและสิ่งปลูกสร้าง",
    sortOrder: 13,
    tfrsCode: "E110",
  },
  {
    accountCode: "3-3003",
    accountName: "กองทุนพันธกิจ",
    accountType: "equity",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "credit",
    description: "กองทุนเพื่อพันธกิจและมิชชั่น",
    sortOrder: 14,
    tfrsCode: "E120",
  },
  {
    accountCode: "3-3004",
    accountName: "กำไรสะสม",
    accountType: "equity",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "credit",
    description: "กำไรสะสมยกมา",
    sortOrder: 15,
    tfrsCode: "E200",
  },

  // ============ 4xxx INCOME ============
  {
    accountCode: "4-4001",
    accountName: "เงินถวายสิบลด",
    accountType: "income",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "credit",
    description: "รายได้จากสิบลด",
    sortOrder: 16,
    tfrsCode: "I100",
  },
  {
    accountCode: "4-4002",
    accountName: "เงินถวายพิเศษ",
    accountType: "income",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "credit",
    description: "รายได้จากถวายพิเศษ",
    sortOrder: 17,
    tfrsCode: "I110",
  },
  {
    accountCode: "4-4003",
    accountName: "เงินถวายพันธกิจ",
    accountType: "income",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "credit",
    description: "รายได้จากถวายพันธกิจ",
    sortOrder: 18,
    tfrsCode: "I120",
  },
  {
    accountCode: "4-4004",
    accountName: "เงินบริจาค",
    accountType: "income",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "credit",
    description: "เงินบริจาคทั่วไป",
    sortOrder: 19,
    tfrsCode: "I130",
  },
  {
    accountCode: "4-4005",
    accountName: "ดอกเบี้ยรับ",
    accountType: "income",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "credit",
    description: "ดอกเบี้ยเงินฝากธนาคาร",
    sortOrder: 20,
    tfrsCode: "I200",
  },
  {
    accountCode: "4-4006",
    accountName: "รายได้ค่าเช่า",
    accountType: "income",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "credit",
    description: "รายได้จากการให้เช่าทรัพย์สิน",
    sortOrder: 21,
    tfrsCode: "I210",
  },
  {
    accountCode: "4-4007",
    accountName: "รายรับอื่น ๆ",
    accountType: "income",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "credit",
    description: "รายรับอื่น ๆ ที่ไม่ได้จัดประเภท",
    sortOrder: 22,
    tfrsCode: "I999",
  },

  // ============ 5xxx EXPENSES ============
  {
    accountCode: "5-5001",
    accountName: "เงินเดือนบุคลากร",
    accountType: "expense",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "debit",
    description: "เงินเดือนและค่าจ้างบุคลากร",
    sortOrder: 23,
    tfrsCode: "E100",
  },
  {
    accountCode: "5-5002",
    accountName: "ค่าสาธารณูปโภค",
    accountType: "expense",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "debit",
    description: "ค่าไฟฟ้า น้ำประปา โทรศัพท์ อินเทอร์เน็ต",
    sortOrder: 24,
    tfrsCode: "E200",
  },
  {
    accountCode: "5-5003",
    accountName: "ค่าซ่อมบำรุง",
    accountType: "expense",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "debit",
    description: "ค่าซ่อมแซมและบำรุงรักษา",
    sortOrder: 25,
    tfrsCode: "E210",
  },
  {
    accountCode: "5-5004",
    accountName: "ค่าพันธกิจ",
    accountType: "expense",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "debit",
    description: "ค่าใช้จ่ายด้านพันธกิจและมิชชั่น",
    sortOrder: 26,
    tfrsCode: "E300",
  },
  {
    accountCode: "5-5005",
    accountName: "ค่าวัสดุอุปกรณ์",
    accountType: "expense",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "debit",
    description: "ค่าวัสดุสำนักงานและอุปกรณ์",
    sortOrder: 27,
    tfrsCode: "E310",
  },
  {
    accountCode: "5-5006",
    accountName: "ค่าเดินทาง",
    accountType: "expense",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "debit",
    description: "ค่าเดินทางและที่พัก",
    sortOrder: 28,
    tfrsCode: "E320",
  },
  {
    accountCode: "5-5007",
    accountName: "ค่าใช้จ่ายอื่น ๆ",
    accountType: "expense",
    parentId: null,
    isActive: true,
    isContra: false,
    normalBalance: "debit",
    description: "ค่าใช้จ่ายเบ็ดเตล็ด",
    sortOrder: 29,
    tfrsCode: "E999",
  },
];
```

---

## 3. Journal Entry Engine

### 3.1 Journal Entry Domain Model

```typescript
// src/server/domain/journal.ts

export type EntryType =
  | "offering"
  | "expense"
  | "income"
  | "transfer"
  | "opening"
  | "adjustment"
  | "void";
export type EntryStatus = "draft" | "pending" | "approved" | "rejected" | "voided";
export type LineType = "debit" | "credit";

export interface JournalEntryLine {
  id: string;
  accountId: string; // References chart_of_accounts.id
  lineType: LineType;
  amount: Money;
  fundId: string;
  memberId?: string;
  departmentId?: string;
  projectId?: string;
  description?: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string; // e.g., 'OFF-2026-0042'
  entryType: EntryType;
  postingDate: Date;
  description: string;
  status: EntryStatus;
  lines: JournalEntryLine[]; // Minimum 2 lines (at least 1 debit + 1 credit)
  totalDebit: Money;
  totalCredit: Money;
  fundId: string;
  createdBy: string; // User ID
  approvedBy?: string;
  rejectionReason?: string;
  voidParentId?: string; // If this is a void entry, references the original
  referenceDocument?: string;
  fiscalYear: number;
  fiscalPeriod: number; // 1-12
  version: number;
  createdAt: Date;
  postedAt?: Date;
  updatedAt: Date;
}
```

### 3.2 Journal Creation Rules

```typescript
// src/server/domain/journal.ts
export class JournalService {
  /**
   * Creates a journal entry with validation and posting.
   * This is the ONLY entry point for financial transactions.
   */
  async createEntry(input: CreateJournalEntryInput, userId: string): Promise<JournalEntry> {
    // 1. Validate the entry balances
    this.validateBalance(input.lines);

    // 2. Validate all account IDs exist and are active
    await this.validateAccounts(input.lines);

    // 3. Validate the fiscal period is open
    await this.validatePeriod(input.fiscalYear, input.fiscalPeriod);

    // 4. Validate fund balance (if the entry draws from a fund)
    await this.validateFundBalance(input.lines, input.fundId);

    // 5. Generate sequential entry number
    const entryNumber = await this.generateEntryNumber(input.entryType, input.fiscalYear);

    // 6. Calculate totals
    const totalDebit = this.sumByType(input.lines, "debit");
    const totalCredit = this.sumByType(input.lines, "credit");

    // 7. Create entry within a database transaction
    return await this.db.transaction(async (tx) => {
      const entry = await this.journalRepo.create(tx, {
        ...input,
        entryNumber,
        totalDebit,
        totalCredit,
        status: "draft",
        createdBy: userId,
      });

      // 8. Post to general ledger
      await this.ledgerRepo.post(tx, entry);

      // 9. Update fund balance
      await this.fundRepo.updateBalance(tx, input.fundId);

      // 10. Create audit record
      await this.auditRepo.record(tx, {
        eventType: "journal_entry_created",
        entityType: "journal_entry",
        entityId: entry.id,
        userId,
        action: "create",
        afterState: entry,
      });

      return entry;
    });
  }

  /**
   * Validate that total debits equal total credits.
   * Throws UnbalancedEntryError if not balanced.
   */
  private validateBalance(lines: CreateLineInput[]): void {
    const totalDebit = this.sumByType(lines, "debit");
    const totalCredit = this.sumByType(lines, "credit");

    if (!totalDebit.equals(totalCredit)) {
      throw new UnbalancedEntryError(
        totalDebit,
        totalCredit,
        `Journal entry is unbalanced: debits ${totalDebit.format()}, credits ${totalCredit.format()}. Difference: ${totalDebit.subtract(totalCredit).format()}`,
      );
    }

    if (totalDebit.isZero()) {
      throw new EmptyEntryError("Journal entry cannot have zero amounts");
    }
  }

  private sumByType(lines: CreateLineInput[], type: LineType): Money {
    return lines
      .filter((l) => l.lineType === type)
      .reduce((sum, l) => sum.add(l.amount), Money.zero());
  }
}
```

### 3.3 Entry Number Generation

Entry numbers follow the format `{TYPE}-{YEAR}-{SEQUENCE}`:

```typescript
private async generateEntryNumber(entryType: EntryType, fiscalYear: number): Promise<string> {
  const prefix = {
    'offering': 'OFF',
    'expense': 'EXP',
    'income': 'INC',
    'transfer': 'TRF',
    'opening': 'OPN',
    'adjustment': 'ADJ',
    'void': 'VOID',
  }[entryType];

  // Get the next sequence number for this type and year
  // Uses PostgreSQL sequence or a sequence table to guarantee no gaps
  const sequence = await this.sequenceRepo.nextValue(`${prefix}-${fiscalYear}`);

  return `${prefix}-${fiscalYear}-${String(sequence).padStart(4, '0')}`;
}
```

---

## 4. General Ledger & Posting Rules

### 4.1 Posting Algorithm

The posting engine maintains a running balance for every account-fund combination.

```typescript
// src/server/domain/general-ledger.ts
export class GeneralLedgerPostingEngine {
  /**
   * Posts a journal entry to the general ledger.
   * This updates running balances for all affected accounts.
   */
  async post(tx: Transaction, entry: JournalEntry): Promise<void> {
    for (const line of entry.lines) {
      // Get the current running balance for this account+fund
      const currentBalance = await this.ledgerRepo.getCurrentBalance(
        tx,
        line.accountId,
        line.fundId,
        entry.fiscalYear,
        entry.fiscalPeriod,
      );

      // Calculate new running balance based on normal balance
      const account = await this.accountRepo.findById(tx, line.accountId);
      const newBalance = this.calculateNewBalance(
        currentBalance,
        line,
        account.normalBalance,
        account.isContra,
      );

      // Verify balance doesn't violate constraints
      // For equity/fund accounts: balance should not go negative without authorization
      // (This is the fund overdraft check)
      if (account.accountType === "equity" && newBalance.isNegative()) {
        throw new InsufficientFundsError(
          line.fundId,
          account.accountName,
          currentBalance,
          line.amount,
        );
      }

      // Insert GL entry
      await this.ledgerRepo.insert(tx, {
        accountId: line.accountId,
        postingDate: entry.postingDate,
        journalEntryId: entry.id,
        journalLineId: line.id,
        fundId: line.fundId,
        debitAmount: line.lineType === "debit" ? line.amount : Money.zero(),
        creditAmount: line.lineType === "credit" ? line.amount : Money.zero(),
        runningBalance: newBalance,
        fiscalYear: entry.fiscalYear,
        fiscalPeriod: entry.fiscalPeriod,
      });
    }
  }

  private calculateNewBalance(
    currentBalance: Money,
    line: JournalEntryLine,
    normalBalance: NormalBalance,
    isContra: boolean,
  ): Money {
    // Contra accounts behave opposite to their type
    const effectiveNormal = isContra
      ? normalBalance === "debit"
        ? "credit"
        : "debit"
      : normalBalance;

    // For normal-balance = debit accounts:
    //   Debit increases, Credit decreases
    // For normal-balance = credit accounts:
    //   Credit increases, Debit decreases
    if (effectiveNormal === "debit") {
      if (line.lineType === "debit") {
        return currentBalance.add(line.amount);
      } else {
        return currentBalance.subtract(line.amount);
      }
    } else {
      if (line.lineType === "credit") {
        return currentBalance.add(line.amount);
      } else {
        return currentBalance.subtract(line.amount);
      }
    }
  }
}
```

### 4.2 Balance Query

```typescript
/**
 * Get the running balance for a specific account+fund at a point in time.
 */
async getBalance(
  accountId: string,
  fundId: string,
  asOfDate?: Date,
): Promise<Money> {
  const latest = await this.ledgerRepo.getLatestEntry(
    accountId,
    fundId,
    asOfDate,
  );

  return latest?.runningBalance ?? Money.zero();
}

/**
 * Get all balances for a fund (across all accounts).
 */
async getFundBalances(fundId: string): Promise<Map<string, Money>> {
  const entries = await this.ledgerRepo.getLatestPerAccount(fundId);
  const balances = new Map<string, Money>();

  for (const entry of entries) {
    balances.set(entry.accountId, entry.runningBalance);
  }

  return balances;
}
```

---

## 5. Fund Accounting Layer

### 5.1 Fund Balance Management

Funds are equity accounts in the chart of accounts. The fund's balance is the running balance of its associated equity account(s).

```typescript
// src/server/domain/fund-accounting.ts
export class FundAccountingService {
  /**
   * Get the current balance of a fund.
   * This reads from the stored running balance, not computed ad-hoc.
   */
  async getFundBalance(fundId: string): Promise<Money> {
    const fund = await this.fundRepo.findById(fundId);
    // Fund balance = sum of running balances for all equity accounts linked to this fund
    const balance = await this.ledgerRepo.getBalance(fund.accountId, fundId);
    return balance;
  }

  /**
   * Validate that a fund has sufficient balance for an expense.
   * Throws InsufficientFundsError if balance is too low.
   */
  async validateSufficientBalance(fundId: string, amount: Money): Promise<void> {
    const balance = await this.getFundBalance(fundId);
    if (balance.isLessThan(amount)) {
      const fund = await this.fundRepo.findById(fundId);
      throw new InsufficientFundsError(
        fundId,
        fund.name,
        balance,
        amount,
        `กองทุน "${fund.name}" มียอดคงเหลือไม่เพียงพอ: คงเหลือ ${balance.format()} ต้องการ ${amount.format()}`,
      );
    }
  }

  /**
   * Update the stored fund balance after a journal entry is posted.
   * Called atomically within the same transaction as the journal entry.
   */
  async updateFundBalance(tx: Transaction, fundId: string): Promise<void> {
    const fund = await this.fundRepo.findByIdForUpdate(tx, fundId);
    const newBalance = await this.computeFundBalanceFromLedger(tx, fundId);

    await this.fundRepo.updateBalance(tx, fundId, newBalance);
  }

  /**
   * Compute the fund balance by summing the relevant GL entries.
   * This is the verification check — it should always match the stored balance.
   */
  private async computeFundBalanceFromLedger(tx: Transaction, fundId: string): Promise<Money> {
    const fund = await this.fundRepo.findById(fundId);
    const entries = await this.ledgerRepo.findByAccount(tx, fund.accountId);

    return entries.reduce((balance, entry) => {
      if (entry.debitAmount.isGreaterThan(Money.zero())) {
        return balance.subtract(entry.debitAmount);
      }
      return balance.add(entry.creditAmount);
    }, Money.zero());
  }
}
```

### 5.2 Fund Transfer (Atomic)

A fund transfer moves value from one fund to another as a balanced journal entry.

```typescript
async transferFunds(
  fromFundId: string,
  toFundId: string,
  amount: Money,
  userId: string,
  transferType: 'permanent' | 'loan' | 'allocation' = 'permanent',
  loanTerms?: {
    expectedRepaymentDate?: Date;
    interestRate?: number; // annual percentage, 0 for interest-free
  }
): Promise<JournalEntry> {
  // 1. Validate balance in source fund
  await this.fundService.validateSufficientBalance(fromFundId, amount);

  const fromFund = await this.fundRepo.findById(fromFundId);
  const toFund = await this.fundRepo.findById(toFundId);

  const entryInput: CreateJournalEntryInput = {
    entryType: 'transfer',
    postingDate: new Date(),
    description: transferType === 'loan'
      ? `เงินกู้ระหว่างกองทุน: ${fromFund.name} → ${toFund.name}`
      : `โอนระหว่างกองทุน: ${fromFund.name} → ${toFund.name}`,
    fundId: fromFundId, // Primary fund
    fiscalYear: this.getFiscalYear(new Date()),
    fiscalPeriod: this.getFiscalPeriod(new Date()),
    lines: [
      // Debit: Source fund equity (decreases equity)
      {
        accountId: fromFund.accountId,
        lineType: 'debit',
        amount,
        fundId: fromFundId,
        description: `โอนออกไปยัง ${toFund.name}`,
      },
      // Credit: Destination fund equity (increases equity)
      {
        accountId: toFund.accountId,
        lineType: 'credit',
        amount,
        fundId: toFundId,
        description: `รับโอนจาก ${fromFund.name}`,
      },
    ],
  };

  // Create as 'approved' (transfers may bypass approval based on config)
  const entry = await this.journalService.createEntry(entryInput, userId);

  // If it's a loan, record the loan terms
  if (transferType === 'loan' && loanTerms) {
    await this.loanRepo.create({
      journalEntryId: entry.id,
      fromFundId,
      toFundId,
      amount,
      expectedRepaymentDate: loanTerms.expectedRepaymentDate,
      interestRate: loanTerms.interestRate ?? 0,
      status: 'outstanding',
    });
  }

  return entry;
}
```

---

## 6. Trial Balance

### 6.1 Trial Balance Generation

The trial balance lists all accounts with their debit and credit balances at a point in time. It must balance (total debits = total credits).

```typescript
export interface TrialBalanceLine {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debitBalance: Money;
  creditBalance: Money;
}

export interface TrialBalance {
  asOfDate: Date;
  lines: TrialBalanceLine[];
  totalDebits: Money;
  totalCredits: Money;
  isBalanced: boolean;
}

export class TrialBalanceService {
  async generateTrialBalance(
    asOfDate: Date,
    fundId?: string, // Optional: generate for a single fund
  ): Promise<TrialBalance> {
    const accounts = await this.accountRepo.findAllActive();
    const lines: TrialBalanceLine[] = [];

    for (const account of accounts) {
      const balance = await this.ledgerRepo.getBalance(account.id, fundId, asOfDate);

      // Classify balance as debit or credit based on account type
      const line = this.classifyBalance(account, balance);
      lines.push(line);
    }

    const totalDebits = lines.reduce((sum, l) => sum.add(l.debitBalance), Money.zero());
    const totalCredits = lines.reduce((sum, l) => sum.add(l.creditBalance), Money.zero());

    return {
      asOfDate,
      lines,
      totalDebits,
      totalCredits,
      isBalanced: totalDebits.equals(totalCredits),
    };
  }

  private classifyBalance(account: Account, balance: Money): TrialBalanceLine {
    let debitBalance = Money.zero();
    let creditBalance = Money.zero();

    // For normal-debit accounts: positive balance = debit
    // For normal-credit accounts: positive balance = credit
    if (account.normalBalance === "debit") {
      if (balance.isGreaterThan(Money.zero())) {
        debitBalance = balance;
      } else {
        creditBalance = Money.zero().subtract(balance); // negative debit = credit
      }
    } else {
      if (balance.isGreaterThan(Money.zero())) {
        creditBalance = balance;
      } else {
        debitBalance = Money.zero().subtract(balance); // negative credit = debit
      }
    }

    return {
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      debitBalance,
      creditBalance,
    };
  }
}
```

---

## 7. Financial Transaction Mapping

Every church financial operation maps to a balanced journal entry. This section defines the standard mappings.

### 7.1 Offering (เงินถวาย)

**Business event:** A member gives an offering during Sunday service.

**Journal entry:**

| Account                       | Debit  | Credit |
| ----------------------------- | ------ | ------ |
| 1-1001 เงินสด (Cash)          | ฿1,000 | —      |
| 4-4001 เงินถวายสิบลด (Tithes) | —      | ฿1,000 |

**Accounting narrative:** Debit Cash (asset increases), Credit Tithe Income (income increases).

```typescript
async recordOffering(
  amount: Money,
  offeringCategoryId: string,
  fundId: string,
  channel: 'cash' | 'bank',
  memberId?: string,
  note?: string,
): Promise<JournalEntry> {
  const category = await this.offeringCategoryRepo.findById(offeringCategoryId);
  const assetAccount = channel === 'cash' ? '1-1001' : '1-1002';

  return this.journalService.createEntry({
    entryType: 'offering',
    postingDate: new Date(),
    description: note ?? `เงินถวาย: ${category.name}`,
    fundId,
    fiscalYear: this.getFiscalYear(new Date()),
    fiscalPeriod: this.getFiscalPeriod(new Date()),
    lines: [
      {
        accountId: assetAccount,
        lineType: 'debit',
        amount,
        fundId,
        memberId,
        description: `รับเงินถวาย${memberId ? ' จากสมาชิก' : ''}`,
      },
      {
        accountId: category.accountId,
        lineType: 'credit',
        amount,
        fundId,
        memberId,
        description: `เงินถวาย: ${category.name}`,
      },
    ],
  }, userId);
}
```

### 7.2 Expense (รายจ่าย)

**Business event:** Church pays for utilities.

**Journal entry:**

| Account                           | Debit  | Credit |
| --------------------------------- | ------ | ------ |
| 5-5002 ค่าสาธารณูปโภค (Utilities) | ฿2,500 | —      |
| 1-1001 เงินสด (Cash)              | —      | ฿2,500 |

**Accounting narrative:** Debit Utility Expense (expense increases), Credit Cash (asset decreases).

```typescript
async recordExpense(
  amount: Money,
  expenseAccountCode: string,
  fundId: string,
  vendor?: string,
  description?: string,
): Promise<JournalEntry> {
  // Validate fund has sufficient balance
  await this.fundService.validateSufficientBalance(fundId, amount);

  return this.journalService.createEntry({
    entryType: 'expense',
    postingDate: new Date(),
    description: description ?? `${vendor ? `ผู้ขาย: ${vendor} — ` : ''}รายจ่าย`,
    fundId,
    fiscalYear: this.getFiscalYear(new Date()),
    fiscalPeriod: this.getFiscalPeriod(new Date()),
    lines: [
      {
        accountId: expenseAccountCode,
        lineType: 'debit',
        amount,
        fundId,
        description: vendor ? `ผู้ขาย: ${vendor}` : undefined,
      },
      {
        accountId: '1-1001', // Cash
        lineType: 'credit',
        amount,
        fundId,
        description: 'จ่ายเงินสด',
      },
    ],
  }, userId);
}
```

### 7.3 Fund Transfer (โอนระหว่างกองทุน)

**Business event:** Transfer ฿10,000 from General Fund to Building Fund.

**Journal entry:**

| Account                            | Debit   | Credit  |
| ---------------------------------- | ------- | ------- |
| 3-3001 กองทุนทั่วไป (General Fund) | ฿10,000 | —       |
| 3-3002 กองทุนอาคาร (Building Fund) | —       | ฿10,000 |

**Accounting narrative:** Debit General Fund equity (decreases), Credit Building Fund equity (increases). No cash changes hands — this is purely equity reclassification.

### 7.4 Opening Balance (ยอดยกมา)

**Business event:** Set opening balances at the start of a fiscal year.

**Journal entry:**

| Account                            | Debit   | Credit  |
| ---------------------------------- | ------- | ------- |
| 1-1002 เงินฝากธนาคาร (Bank)        | ฿50,000 | —       |
| 3-3001 กองทุนทั่วไป (General Fund) | —       | ฿50,000 |

### 7.5 Void Transaction (ยกเลิกรายการ)

**Business event:** Void a previously approved expense of ฿2,500.

**Original entry (locked, inaccessible):**

| Account          | Debit  | Credit |
| ---------------- | ------ | ------ |
| 5-5002 Utilities | ฿2,500 | —      |
| 1-1001 Cash      | —      | ฿2,500 |

**Voiding entry (reversal):**

| Account          | Debit  | Credit |
| ---------------- | ------ | ------ |
| 1-1001 Cash      | ฿2,500 | —      |
| 5-5002 Utilities | —      | ฿2,500 |

```typescript
async voidEntry(originalEntryId: string, reason: string, userId: string): Promise<JournalEntry> {
  const original = await this.journalRepo.findById(originalEntryId);

  if (!original) throw new NotFoundError('Journal entry not found');
  if (original.status === 'voided') throw new AlreadyVoidedError('Entry is already voided');
  if (original.status !== 'approved') throw new InvalidTransitionError('Only approved entries can be voided');

  // Create reversing entry
  const reversedLines = original.lines.map(line => ({
    ...line,
    lineType: line.lineType === 'debit' ? 'credit' as const : 'debit' as const,
    description: `[VOID] ${line.description ?? ''} — เหตุผล: ${reason}`,
  }));

  return this.journalService.createEntry({
    entryType: 'void',
    postingDate: new Date(),
    description: `ยกเลิกรายการ ${original.entryNumber}: ${reason}`,
    fundId: original.fundId,
    fiscalYear: this.getFiscalYear(new Date()),
    fiscalPeriod: this.getFiscalPeriod(new Date()),
    lines: reversedLines,
    voidParentId: original.id,
  }, userId);
}
```

---

## 8. Period Opening & Closing

### 8.1 Period Lifecycle

```
OPEN ───→ CLOSED ───→ RECONCILED
  ↑                      │
  └──── (reopen) ────────┘ (requires auditor permission)
```

### 8.2 Period Close Algorithm

```typescript
export class PeriodService {
  async closePeriod(periodId: string, userId: string): Promise<void> {
    const period = await this.periodRepo.findById(periodId);

    if (period.status !== "open") {
      throw new PeriodAlreadyClosedError(periodId);
    }

    // Verify prior period is reconciled (or this is the first period)
    if (period.periodNumber > 1) {
      const priorPeriod = await this.periodRepo.findByYearAndNumber(
        period.fiscalYear,
        period.periodNumber - 1,
      );
      if (priorPeriod.status !== "reconciled") {
        throw new PriorPeriodNotReconciledError(
          `ต้องปิดงวด ${priorPeriod.fiscalYear}-${priorPeriod.periodNumber} ก่อน`,
        );
      }
    }

    await this.db.transaction(async (tx) => {
      // 1. Verify no pending transactions in this period
      const pendingCount = await this.journalRepo.countPendingInPeriod(
        tx,
        period.fiscalYear,
        period.periodNumber,
      );
      if (pendingCount > 0) {
        throw new PendingTransactionsExistError(`มี ${pendingCount} รายการที่ยังรออนุมัติในงวดนี้`);
      }

      // 2. Snapshot fund balances at period close
      const funds = await this.fundRepo.findAllActive(tx);
      for (const fund of funds) {
        const balance = await this.ledgerRepo.getBalance(
          tx,
          fund.accountId,
          fund.id,
          period.endDate,
        );

        await this.periodRepo.saveFundSnapshot(tx, {
          periodId,
          fundId: fund.id,
          closingBalance: balance,
        });
      }

      // 3. Mark period as closed
      await this.periodRepo.updateStatus(tx, periodId, "closed", userId);
    });
  }

  async reopenPeriod(periodId: string, userId: string): Promise<void> {
    const period = await this.periodRepo.findById(periodId);

    if (period.status === "reconciled") {
      throw new PeriodAlreadyReconciledError(
        "ไม่สามารถเปิดงวดที่กระทบยอดแล้ว — ต้องขอสิทธิ์ผู้ตรวจสอบ",
      );
    }

    // Require auditor or super_admin role to reopen
    const user = await this.userRepo.findById(userId);
    if (!["super_admin", "auditor"].includes(user.role)) {
      throw new UnauthorizedError("เฉพาะผู้ดูแลระบบหรือผู้ตรวจสอบเท่านั้นที่สามารถเปิดงวดได้");
    }

    await this.periodRepo.updateStatus(tx, periodId, "open", userId);
  }
}
```

### 8.3 Fiscal Year Determination

```typescript
/**
 * Determine the fiscal year and period for a given date.
 * Uses the church's configured fiscalYearStart (default: 1 = January).
 */
getFiscalYearAndPeriod(date: Date, fiscalYearStartMonth: number): { year: number; period: number } {
  const month = date.getMonth() + 1; // JavaScript months are 0-indexed

  if (month >= fiscalYearStartMonth) {
    const period = month - fiscalYearStartMonth + 1;
    return { year: date.getFullYear(), period };
  } else {
    // Date falls in the prior fiscal year
    const period = (12 - fiscalYearStartMonth + 1) + month;
    return { year: date.getFullYear() - 1, period };
  }
}
```

---

## 9. Reconciliation Engine

### 9.1 Reconciliation Domain Model

```typescript
export interface ReconciliationRecord {
  id: string;
  periodId: string;
  fundId: string;
  openingBalance: Money; // From previous reconciliation
  systemBalance: Money; // Calculated from GL
  actualBalance: Money; // From bank statement / cash count
  variance: Money; // systemBalance - actualBalance
  explanation: string | null; // Required if variance != 0
  isReconciled: boolean;
  previousReconciliationId: string | null;
  reconciledBy: string;
  reconciledAt: Date;
}
```

### 9.2 Reconciliation Process

```typescript
export class ReconciliationService {
  async reconcile(
    periodId: string,
    fundId: string,
    actualBalance: Money,
    explanation: string,
    userId: string,
  ): Promise<ReconciliationRecord> {
    const period = await this.periodRepo.findById(periodId);

    if (period.status !== "closed") {
      throw new PeriodNotClosedError("ต้องปิดงวดก่อนการกระทบยอด");
    }

    return await this.db.transaction(async (tx) => {
      // 1. Get the opening balance from the previous reconciliation
      const previousReconciliation = await this.reconciliationRepo.findLatestForFund(
        tx,
        fundId,
        periodId,
      );
      const openingBalance = previousReconciliation?.systemBalance ?? Money.zero();

      // 2. Calculate system balance from GL
      const systemBalance = await this.computeSystemBalance(
        tx,
        fundId,
        period.startDate,
        period.endDate,
      );

      // 3. Calculate variance
      const variance = systemBalance.subtract(actualBalance);

      // 4. Require explanation if variance is material (> ฿100)
      if (variance.abs().isGreaterThan(Money.fromBaht(100)) && !explanation) {
        throw new ReconciliationExplanationRequiredError(
          `ผลต่าง ${variance.format()} ต้องมีคำอธิบาย`,
        );
      }

      // 5. Create reconciliation record
      const record = await this.reconciliationRepo.create(tx, {
        periodId,
        fundId,
        openingBalance,
        systemBalance,
        actualBalance,
        variance,
        explanation,
        isReconciled: true,
        previousReconciliationId: previousReconciliation?.id ?? null,
        reconciledBy: userId,
        reconciledAt: new Date(),
      });

      // 6. Check if all funds are reconciled for this period
      const allFundsReconciled = await this.areAllFundsReconciled(tx, periodId);
      if (allFundsReconciled) {
        // Lock the period
        await this.periodRepo.updateStatus(tx, periodId, "reconciled", userId);
      }

      return record;
    });
  }

  private async computeSystemBalance(
    tx: Transaction,
    fundId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<Money> {
    const fund = await this.fundRepo.findById(fundId);
    const entries = await this.ledgerRepo.findByAccountAndDateRange(
      tx,
      fund.accountId,
      fromDate,
      toDate,
    );

    return entries.reduce((balance, entry) => {
      if (entry.creditAmount.isGreaterThan(Money.zero())) {
        return balance.add(entry.creditAmount);
      }
      return balance.subtract(entry.debitAmount);
    }, Money.zero());
  }
}
```

---

## 10. Budget Integration

### 10.1 Budget vs. Actual Calculation

Budget utilization is computed dynamically from the general ledger, never from a stored `used` field.

```typescript
export class BudgetService {
  async getBudgetUtilization(budgetId: string): Promise<BudgetUtilization> {
    const budget = await this.budgetRepo.findById(budgetId);

    if (budget.status !== "approved") {
      throw new BudgetNotApprovedError("งบประมาณยังไม่ได้รับการอนุมัติ");
    }

    // Build the query to calculate actual spending
    const actualSpent = await this.ledgerRepo.sumDebitsByAccount(
      budget.accountId,
      budget.fundId,
      budget.fiscalYear,
      budget.fiscalPeriod,
      budget.departmentId,
      budget.projectId,
    );

    const remaining = budget.budgetedAmount.subtract(actualSpent);
    const utilizationPct = budget.budgetedAmount.isZero()
      ? 0
      : (actualSpent.toNumber() / budget.budgetedAmount.toNumber()) * 100;

    return {
      budgetId: budget.id,
      budgetName: budget.name,
      budgetedAmount: budget.budgetedAmount,
      actualSpent,
      remaining,
      utilizationPct,
      isOverBudget: remaining.isNegative(),
    };
  }
}
```

---

## 11. Financial Statement Generation

### 11.1 Balance Sheet (งบแสดงฐานะการเงิน)

```typescript
export interface BalanceSheet {
  asOfDate: Date;
  churchName: string;
  assets: BalanceSheetSection; // Accounts 1xxx
  liabilities: BalanceSheetSection; // Accounts 2xxx
  equity: BalanceSheetSection; // Accounts 3xxx + net income
  totalAssets: Money;
  totalLiabilitiesAndEquity: Money;
}

export class ReportService {
  async generateBalanceSheet(asOfDate: Date): Promise<BalanceSheet> {
    const trialBalance = await this.trialBalanceService.generateTrialBalance(asOfDate);

    const assets = this.buildSection(trialBalance, "asset");
    const liabilities = this.buildSection(trialBalance, "liability");
    const equity = this.buildSection(trialBalance, "equity");

    // Net Income = Total Income - Total Expenses
    const totalIncome = this.buildSection(trialBalance, "income").total;
    const totalExpenses = this.buildSection(trialBalance, "expense").total;
    const netIncome = totalIncome.subtract(totalExpenses);

    // Add net income to equity
    equity.lines.push({
      accountCode: "",
      accountName: "รายได้สูง(ต่ำ)กว่าค่าใช้จ่ายสุทธิ",
      balance: netIncome,
    });
    equity.total = equity.total.add(netIncome);

    const totalAssets = assets.total;
    const totalLiabilitiesAndEquity = liabilities.total.add(equity.total);

    return {
      asOfDate,
      churchName: await this.settingsRepo.getChurchName(),
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilitiesAndEquity,
    };
  }
}
```

### 11.2 Income Statement (งบรายได้และค่าใช้จ่าย)

```typescript
export interface IncomeStatement {
  periodStart: Date;
  periodEnd: Date;
  churchName: string;
  income: {
    lines: { accountCode: string; accountName: string; amount: Money }[];
    total: Money;
  };
  expenses: {
    lines: { accountCode: string; accountName: string; amount: Money }[];
    total: Money;
  };
  netIncome: Money;
}

export class ReportService {
  async generateIncomeStatement(periodStart: Date, periodEnd: Date): Promise<IncomeStatement> {
    // Get period-specific trial balance (filtered by date range)
    const lines = await this.ledgerRepo.getPeriodActivity(periodStart, periodEnd);

    const incomeLines = lines.filter((l) => l.accountType === "income");
    const expenseLines = lines.filter((l) => l.accountType === "expense");

    const totalIncome = incomeLines.reduce((sum, l) => sum.add(l.creditAmount), Money.zero());
    const totalExpenses = expenseLines.reduce((sum, l) => sum.add(l.debitAmount), Money.zero());

    return {
      periodStart,
      periodEnd,
      churchName: await this.settingsRepo.getChurchName(),
      income: {
        lines: incomeLines.map((l) => ({
          accountCode: l.accountCode,
          accountName: l.accountName,
          amount: l.creditAmount,
        })),
        total: totalIncome,
      },
      expenses: {
        lines: expenseLines.map((l) => ({
          accountCode: l.accountCode,
          accountName: l.accountName,
          amount: l.debitAmount,
        })),
        total: totalExpenses,
      },
      netIncome: totalIncome.subtract(totalExpenses),
    };
  }
}
```

---

## Invariant Summary

The accounting engine enforces these invariants:

1. **Σ debits = Σ credits** for every journal entry — enforced by CHECK constraint and application validation
2. **No negative fund balances** (without authorized overdraft) — enforced at posting time
3. **Period must be open** for new transactions — validated before posting
4. **Prior period must be reconciled** before closing current period — enforced in close algorithm
5. **Approved entries can only be voided, not deleted** — enforced by state machine
6. **Running balance = previous running balance + debit − credit** for asset/expense accounts; **+ credit − debit** for liability/equity/income accounts
7. **Trial balance must balance** — total debits = total credits at all times
8. **Fund balance = stored value** — computed balance is verified against stored balance on every post; mismatch triggers an alert

---

_This accounting engine is the core of Grace Ledger v2. It converts every financial operation into balanced, auditable journal entries. No financial data exists outside of the general ledger._
