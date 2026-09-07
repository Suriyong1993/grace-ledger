// @vitest-environment jsdom
/**
 * Modal open/close wiring for FundsPage.
 *
 * The create/transfer modals are driven by state on the page instance, and
 * only appear if the caller re-renders and re-binds listeners on every state
 * change. The preview harness originally did neither, which made every modal
 * in the app look frozen. These tests pin the contract that made it work.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { FundsPage } from "../../src/pages/FundsPage";
import { Money } from "../../src/lib/money";

const makeFund = (id: string, name: string) => ({
  id,
  name,
  description: "",
  balance: Money.from(1000),
  targetAmount: null,
  percentageUsed: null,
  recentActivity: [],
});

describe("FundsPage — modal wiring", () => {
  let page: any;
  let root: HTMLElement;
  let paint: () => void;

  beforeEach(() => {
    page = new FundsPage(null as any, "church-abc");
    Object.assign(page, {
      isLoading: false,
      funds: [makeFund("f1", "กองทุนทั่วไป"), makeFund("f2", "กองทุนอาคาร")],
    });
    root = document.createElement("div");
    paint = () => {
      root.innerHTML = page.renderHtml();
      page.attachEventListeners(root, paint);
    };
    paint();
  });

  it("opens the create-fund modal on click, and closes it again", () => {
    expect(root.querySelector("#create-fund-modal")).toBeNull();

    root.querySelector<HTMLButtonElement>("#open-create-btn")!.click();
    expect(root.querySelector("#create-fund-modal")).not.toBeNull();

    root.querySelector<HTMLButtonElement>("#close-create-btn")!.click();
    expect(root.querySelector("#create-fund-modal")).toBeNull();
  });

  it("opens the transfer modal on click, and closes it again", () => {
    expect(root.querySelector("#transfer-modal")).toBeNull();

    root.querySelector<HTMLButtonElement>("#open-transfer-btn")!.click();
    expect(root.querySelector("#transfer-modal")).not.toBeNull();

    root.querySelector<HTMLButtonElement>("#close-transfer-btn")!.click();
    expect(root.querySelector("#transfer-modal")).toBeNull();
  });

  it("re-binds listeners after a re-render, so a modal can be reopened", () => {
    const open = () =>
      root.querySelector<HTMLButtonElement>("#open-create-btn")!.click();
    const close = () =>
      root.querySelector<HTMLButtonElement>("#close-create-btn")!.click();

    open();
    close();
    open();

    expect(root.querySelector("#create-fund-modal")).not.toBeNull();
  });
});
