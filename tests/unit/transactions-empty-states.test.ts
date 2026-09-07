// @vitest-environment jsdom
/**
 * Transactions empty states.
 *
 * An empty list has two very different causes and they need different words
 * and different affordances: an empty ledger is not a filtering problem, and
 * telling someone to "change the filters" in that case sends them hunting for
 * a control that is not at fault. When filters *are* hiding everything, the
 * user previously had to undo each one by hand.
 *
 * These assertions go through the rendered DOM and the real listeners, so the
 * clear action is proven to reset state, resync the URL and survive a redraw.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { TransactionsPage } from "../../src/pages/TransactionsPage";

const mount = (state: Record<string, unknown>) => {
  const page: any = new TransactionsPage(null as any, "church-abc");
  Object.assign(page, { isLoading: false, transactions: [], ...state });

  const root = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(root);
  const paint = () => {
    root.innerHTML = page.renderHtml();
    page.attachEventListeners(root, paint);
  };
  paint();
  return { page, root };
};

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("empty ledger versus filtered-to-nothing", () => {
  it("says the ledger is empty when nothing is narrowing the view", () => {
    const { root } = mount({});

    expect(root.textContent).toContain("ยังไม่มีรายการเคลื่อนไหว");
    // No filter is active, so offering a reset would be nonsense.
    expect(root.querySelector("#clear-filters-btn")).toBeNull();
  });

  it("offers a reset when a filter pill is hiding everything", () => {
    const { root } = mount({ activeFilter: "income" });

    expect(root.textContent).toContain("ไม่พบรายการที่ตรงกับเงื่อนไข");
    expect(root.querySelector("#clear-filters-btn")).not.toBeNull();
  });

  it("offers a reset when a search term is hiding everything", () => {
    const { root } = mount({ searchQuery: "ไม่มีคำนี้" });

    expect(root.querySelector("#clear-filters-btn")).not.toBeNull();
  });

  it("offers a reset when only the period is narrowing the view", () => {
    const { root } = mount({ activePeriod: "last_month" });

    expect(root.querySelector("#clear-filters-btn")).not.toBeNull();
  });

  it("treats whitespace as no search at all", () => {
    const { root } = mount({ searchQuery: "   " });

    // A stray space should not make the page claim a filter is active.
    expect(root.textContent).toContain("ยังไม่มีรายการเคลื่อนไหว");
    expect(root.querySelector("#clear-filters-btn")).toBeNull();
  });
});

describe("clearing the filters", () => {
  it("resets every narrowing control in one click", () => {
    const { page, root } = mount({
      activeFilter: "expense",
      activePeriod: "last_month",
      searchQuery: "abc",
    });

    root.querySelector<HTMLButtonElement>("#clear-filters-btn")!.click();

    expect(page.activeFilter).toBe("all");
    expect(page.activePeriod).toBe("this_month");
    expect(page.searchQuery).toBe("");
  });

  it("updates the rendered empty state after clearing", () => {
    const { root } = mount({ activeFilter: "expense" });

    root.querySelector<HTMLButtonElement>("#clear-filters-btn")!.click();

    // The message must follow the state, which only happens if the redraw ran.
    expect(root.textContent).toContain("ยังไม่มีรายการเคลื่อนไหว");
    expect(root.querySelector("#clear-filters-btn")).toBeNull();
  });

  it("drops the filter query string from the URL", () => {
    const { root } = mount({ activeFilter: "expense", searchQuery: "abc" });

    root.querySelector<HTMLButtonElement>("#clear-filters-btn")!.click();

    // A cleared view must be shareable and survive a refresh as cleared.
    expect(window.location.hash).not.toContain("filter=");
    expect(window.location.hash).not.toContain("q=");
  });

  it("leaves the sort order alone — it is not a filter", () => {
    const { page, root } = mount({ activeFilter: "income", activeSort: "oldest" });

    root.querySelector<HTMLButtonElement>("#clear-filters-btn")!.click();

    expect(page.activeSort).toBe("oldest");
  });
});
