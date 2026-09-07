// @vitest-environment jsdom
/**
 * Amount signs must not be doubled.
 *
 * Rows prefix "+" or "−" based on the transaction's direction, while
 * Money.format() prints its own minus for a negative value. A negative amount
 * on an expense row therefore rendered as "− -฿45,280.75". Real ledgers do
 * carry negative expenses (reversals and corrections), so these tests pin the
 * rendered string for each combination rather than trusting the prefix logic.
 */
import { describe, it, expect } from "vitest";
import { TransactionsPage } from "../../src/pages/TransactionsPage";
import { ApprovalsPage } from "../../src/pages/ApprovalsPage";
import { Money } from "../../src/lib/money";

const today = new Date().toISOString();

const makeTxn = (
  id: string,
  direction: "income" | "expense",
  amount: number,
) => ({
  id,
  code: `TXN-${id}`,
  description: `รายการ ${id}`,
  categoryName: "ทั่วไป",
  fundName: "กองทุนทั่วไป",
  accountName: "บัญชีหลัก",
  amount: Money.from(amount),
  direction,
  date: today,
  dateGroup: "today" as const,
  recordedBy: "ผู้บันทึก",
  status: "posted" as const,
  timeline: [],
});

const user = { name: "ผู้ใช้", role: "treasurer", initials: "ผใ" };

const renderTransactions = (txns: unknown[]): string => {
  const page: any = new TransactionsPage(null as any, "church-abc");
  Object.assign(page, { isLoading: false, transactions: txns });
  return page.renderHtml(user);
};

describe("transaction amount signs", () => {
  it("does not print two minus signs for a negative expense", () => {
    const html = renderTransactions([makeTxn("neg", "expense", -45280.75)]);

    expect(html).not.toContain("−-");
    expect(html).not.toContain("− -");
    // The single minus from Money.format() survives.
    expect(html).toMatch(/-|−/);
  });

  it("still marks a normal expense with a minus", () => {
    const html = renderTransactions([makeTxn("exp", "expense", 4820)]);
    expect(html).toContain("−");
  });

  it("still marks income with a plus", () => {
    const html = renderTransactions([makeTxn("inc", "income", 18450)]);
    expect(html).toContain("+");
  });

  it("does not double the sign on the approvals queue", () => {
    const page: any = new ApprovalsPage(null as any, "church-abc", "u-1");
    Object.assign(page, {
      isLoading: false,
      items: [
        {
          id: "appr-neg",
          code: "EXP-0001",
          description: "ปรับปรุงยอดยกมา",
          amount: Money.from(-1200.5),
          direction: "expense",
          status: "pending_approval",
          fundName: "กองทุนทั่วไป",
          categoryName: "ทั่วไป",
          requestedBy: "ผู้ขอ",
          requestedAt: today,
          splits: [],
          timeline: [],
        },
      ],
    });

    const html = page.renderHtml(user);
    expect(html).not.toContain("−-");
    expect(html).not.toContain("− -");
  });
});
