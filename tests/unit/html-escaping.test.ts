import { describe, it, expect } from "vitest";
import { renderApprovalsQueueViewHtml } from "../../src/components/approvals/ApprovalsQueueView";
import { renderProjectedBalanceCardHtml } from "../../src/components/approvals/ProjectedBalanceCard";
import { renderOfferingSessionListHtml } from "../../src/components/offering/OfferingSessionList";
import { renderCashCountViewHtml } from "../../src/components/offering/CashCountView";
import { OfferingSession } from "../../src/lib/offering/types";
import { Money } from "../../src/lib/money";

/**
 * These screens build HTML by string concatenation and the result is assigned to
 * innerHTML, so every database-derived string is an injection sink. Values the
 * code generates itself (Money.format(), status labels from constant maps,
 * literal Thai copy) are deliberately NOT escaped — escaping those would print
 * &amp; to the treasurer without preventing anything.
 */
const PAYLOAD = '<img src=x onerror="alert(1)">';
const ATTR_PAYLOAD = '" onmouseover="alert(1)';

function expectNeutralised(html: string) {
  expect(html).not.toContain("<img src=x");
  expect(html).not.toContain('onerror="alert(1)"');
  expect(html).toContain("&lt;img src=x");
}

function session(overrides: Partial<OfferingSession>): OfferingSession {
  return {
    id: "s-1",
    churchId: "c-1",
    serviceDate: "2026-08-23",
    serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
    status: "counting",
    expectedCashAmount: Money.from("1000.00"),
    expectedTransferAmount: Money.from("500.00"),
    expectedQrAmount: Money.from("250.00"),
    expectedTotalAmount: Money.from("1750.00"),
    countedCashAmount: null,
    cashVarianceAmount: null,
    varianceStatus: null,
    varianceReason: null,
    ...overrides,
  } as OfferingSession;
}

describe("HTML escaping at string-construction boundaries", () => {
  it("escapes the transaction description, fund name and creator name in the approvals queue", () => {
    const html = renderApprovalsQueueViewHtml({
      items: [
        {
          id: "t-1",
          description: PAYLOAD,
          creatorName: PAYLOAD,
          fundName: PAYLOAD,
          amount: Money.from("1000.00"),
          status: "pending_approval",
          referenceNumber: "REF-1",
          createdAt: "2026-08-01",
        },
      ] as unknown as Parameters<
        typeof renderApprovalsQueueViewHtml
      >[0]["items"],
    });

    expectNeutralised(html);
    // The generated amount is left alone — it is not user text.
    expect(html).toContain("฿1,000.00");
  });

  it("escapes the fund name on the projected balance card", () => {
    const html = renderProjectedBalanceCardHtml({
      projection: {
        fundId: "f-1",
        fundName: PAYLOAD,
        currentPostedBalance: Money.from("5000.00"),
        approvedUnpostedImpact: Money.zero(),
        evaluatingTransactionImpact: Money.from("-1000.00"),
        projectedBalance: Money.from("4000.00"),
        isDeficit: false,
      },
    });

    expectNeutralised(html);
  });

  it("escapes the service name in the offering session list", () => {
    const html = renderOfferingSessionListHtml({
      sessions: [session({ serviceName: PAYLOAD })],
      isLoading: false,
      errorMessage: null,
    });

    expectNeutralised(html);
  });

  it("escapes a quote-bearing service name so it cannot break out of an attribute", () => {
    const html = renderOfferingSessionListHtml({
      sessions: [session({ serviceName: ATTR_PAYLOAD })],
      isLoading: false,
      errorMessage: null,
    });

    expect(html).not.toContain('onmouseover="alert(1)');
    expect(html).toContain("&quot; onmouseover=&quot;alert(1)");
  });

  it("escapes the service name in the cash count heading", () => {
    const html = renderCashCountViewHtml({
      session: session({ serviceName: PAYLOAD }),
      profiles: [],
      state: {
        counter1Id: "",
        counter2Id: "",
        denominations: { b1000: 0, b500: 0, b100: 0, b50: 0, b20: 0, coins: Money.zero() },
      },
      isSubmitting: false,
      errorMessage: null,
      successMessage: null,
    });

    expectNeutralised(html);
  });
});
