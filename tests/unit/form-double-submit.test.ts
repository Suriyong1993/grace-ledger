// @vitest-environment jsdom
/**
 * Double-submit guards on the fund and member forms.
 *
 * Same defect as the offering handlers: the submit button disables only on the
 * next redraw, so two clicks in one tick both reach the service. For
 * transferFunds that means moving the money twice.
 *
 * Verified as real before fixing — a probe against the pre-fix code recorded
 * 2 transferFunds calls from 2 submits.
 */
import { describe, it, expect, vi } from "vitest";
import { FundsPage } from "../../src/pages/FundsPage";
import { MembersPage } from "../../src/pages/MembersPage";
import { Money } from "../../src/lib/money";

const fund = (id: string, name: string) => ({
  id,
  name,
  description: "",
  balance: Money.from(1000),
  targetAmount: null,
  percentageUsed: null,
  recentActivity: [],
});

const slow = (value: unknown) =>
  vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 30));
    return value;
  });

const mount = (page: any) => {
  const root = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(root);
  const paint = () => {
    root.innerHTML = page.renderHtml();
    page.attachEventListeners(root, paint);
  };
  paint();
  return root;
};

const submitTwice = async (form: HTMLFormElement) => {
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 120));
};

describe("fund transfer is not submitted twice", () => {
  it("moves the money once for a double click", async () => {
    const page: any = new FundsPage(null as any, "church-abc", "treasurer");
    Object.assign(page, {
      isLoading: false,
      isTransferModalOpen: true,
      funds: [fund("f1", "กองทุนทั่วไป"), fund("f2", "กองทุนพันธกิจ")],
    });
    const transferFunds = slow({ success: true, data: {} });
    page.fundsService.transferFunds = transferFunds;
    page.loadData = vi.fn().mockResolvedValue(undefined);

    const root = mount(page);
    const form = root.querySelector<HTMLFormElement>("#transfer-form")!;
    expect(form).not.toBeNull();
    (root.querySelector("#from-fund") as HTMLSelectElement).value = "f1";
    (root.querySelector("#to-fund") as HTMLSelectElement).value = "f2";
    (root.querySelector("#transfer-amount") as HTMLInputElement).value = "100";
    // The transfer form validates a reason of >= 5 chars before it will call
    // the service. Without one the submit never reaches the double-submit
    // guard this test exists to prove.
    (root.querySelector("#transfer-reason") as HTMLTextAreaElement).value =
      "มติคณะกรรมการ";

    await submitTwice(form);

    expect(transferFunds).toHaveBeenCalledTimes(1);
  });

  // NOTE: unlike the transfer, this one also passes without the guard —
  // onStateChange() redraws synchronously before the await, so the second
  // submit reads an empty, freshly rendered name input and bails on
  // validation. That is incidental protection, not a designed one: it depends
  // on the field being required and on the redraw being synchronous. The
  // guard makes it explicit, and this test pins the observable behaviour.
  it("creates a fund once for a double click", async () => {
    const page: any = new FundsPage(null as any, "church-abc", "treasurer");
    Object.assign(page, {
      isLoading: false,
      isCreateModalOpen: true,
      funds: [fund("f1", "กองทุนทั่วไป")],
    });
    const createFund = slow({ success: true, data: {} });
    page.fundsService.createFund = createFund;
    page.loadData = vi.fn().mockResolvedValue(undefined);

    const root = mount(page);
    const form = root.querySelector<HTMLFormElement>("#create-fund-form")!;
    expect(
      form,
      "create-fund form must render for this test to mean anything",
    ).not.toBeNull();
    (root.querySelector("#fund-name-input") as HTMLInputElement).value =
      "กองทุนใหม่";

    await submitTwice(form);

    expect(createFund).toHaveBeenCalledTimes(1);
  });
});

describe("member creation is not submitted twice", () => {
  // Same incidental protection as create-fund above: passes with or without
  // the guard because the redraw clears the required name field. Kept as a
  // behavioural pin rather than as proof that the guard works.
  it("creates the member once for a double click", async () => {
    const page: any = new MembersPage(null as any, "church-abc");
    Object.assign(page, {
      isLoading: false,
      isAddMemberModalOpen: true,
      members: [],
    });
    const createMember = slow({ success: true, data: {} });
    page.membersService.createMember = createMember;
    page.loadData = vi.fn().mockResolvedValue(undefined);

    const root = mount(page);
    const form = root.querySelector<HTMLFormElement>("#add-member-form")!;
    expect(
      form,
      "add-member form must render for this test to mean anything",
    ).not.toBeNull();
    (root.querySelector("#member-name-input") as HTMLInputElement).value =
      "สมาชิกใหม่";

    await submitTwice(form);

    expect(createMember).toHaveBeenCalledTimes(1);
  });
});
