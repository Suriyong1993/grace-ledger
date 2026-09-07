// @vitest-environment jsdom
/**
 * Filter/period/search wiring for TransactionsPage.
 *
 * The filtering logic lived in renderHtml from the start, but nothing was
 * listening to the controls, so every pill and the period select were
 * decorative. These tests pin the behaviour end to end: click a control,
 * expect the rendered list to actually change.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { TransactionsPage } from "../../src/pages/TransactionsPage";
import { Money } from "../../src/lib/money";

const today = new Date().toISOString();

const makeTxn = (
  id: string,
  description: string,
  direction: "income" | "expense",
  amount: number,
) => ({
  id,
  code: `TXN-${id}`,
  description,
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

describe("TransactionsPage — filter wiring", () => {
  let page: any;
  let root: HTMLElement;
  let paint: () => void;

  beforeEach(() => {
    window.history.replaceState(null, "", "/#/transactions");
    page = new TransactionsPage(null as any, "church-abc");
    Object.assign(page, {
      isLoading: false,
      transactions: [
        makeTxn("1", "เงินถวายวันอาทิตย์", "income", 18450),
        makeTxn("2", "ค่าไฟฟ้า", "expense", 4820),
      ],
    });
    root = document.createElement("div");
    // focus() only works on a node that is actually in the document.
    document.body.innerHTML = "";
    document.body.appendChild(root);
    paint = () => {
      root.innerHTML = page.renderHtml();
      page.attachEventListeners(root, paint);
    };
    paint();
  });

  it("shows both transactions before filtering", () => {
    expect(root.textContent).toContain("เงินถวายวันอาทิตย์");
    expect(root.textContent).toContain("ค่าไฟฟ้า");
  });

  it("clicking the income pill hides expenses", () => {
    root
      .querySelector<HTMLButtonElement>('[data-value="income"]')!
      .click();

    expect(root.textContent).toContain("เงินถวายวันอาทิตย์");
    expect(root.textContent).not.toContain("ค่าไฟฟ้า");
    expect(page.activeFilter).toBe("income");
  });

  it("reflects the active filter in the URL so a refresh keeps it", () => {
    root
      .querySelector<HTMLButtonElement>('[data-value="expense"]')!
      .click();

    expect(window.location.hash).toContain("filter=expense");
  });

  it("changing the period select updates state", () => {
    const period = root.querySelector<HTMLSelectElement>(
      '[data-action="period"]',
    )!;
    period.value = "all";
    period.dispatchEvent(new Event("change"));

    expect(page.activePeriod).toBe("all");
    expect(window.location.hash).toContain("period=all");
  });

  it("debounced search filters the list and keeps input focus", () => {
    vi.useFakeTimers();
    const input = root.querySelector<HTMLInputElement>(
      '[data-action="search"]',
    )!;
    input.focus();
    input.value = "ไฟฟ้า";
    input.dispatchEvent(new Event("input"));

    // Nothing happens until the debounce elapses.
    expect(root.textContent).toContain("เงินถวายวันอาทิตย์");

    vi.advanceTimersByTime(250);

    expect(root.textContent).toContain("ค่าไฟฟ้า");
    expect(root.textContent).not.toContain("เงินถวายวันอาทิตย์");
    // The redraw replaced the input — the user must not lose their place.
    expect(document.activeElement).toBe(
      root.querySelector('[data-action="search"]'),
    );
    vi.useRealTimers();
  });
});
