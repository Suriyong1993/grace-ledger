// @vitest-environment jsdom
/**
 * Offering cash count — contract-level integration.
 *
 * There is no reachable Supabase instance here, so this cannot prove a real
 * database write. What it CAN prove is the contract at the seam between the
 * page, the service and the Supabase adapter:
 *
 *   - the page's save button reaches the service at all
 *   - the service calls the RPC name the migration actually defines
 *   - it passes exactly the parameter names that migration declares
 *   - it reads back the response keys that migration actually returns
 *   - failures surface to the user instead of being swallowed
 *
 * The fake client is deliberately thin: it records the call and returns a
 * payload shaped like the migration's jsonb_build_object. It does not
 * reimplement any logic under test, so a drift between the adapter and
 * 20260819000011_offering_rpcs_and_triggers.sql still fails here.
 */
import { describe, it, expect, vi } from "vitest";
import { OfferingService } from "../../src/lib/offering/offering-service";
import { OfferingPage } from "../../src/pages/OfferingPage";
import { Money } from "../../src/lib/money";
import type { OfferingSession } from "../../src/lib/offering/types";

const SESSION_ID = "00000000-0000-0000-0000-0000000000aa";
const COUNTER_1 = "00000000-0000-0000-0000-0000000000b1";
const COUNTER_2 = "00000000-0000-0000-0000-0000000000b2";

/** Parameter names declared by record_cash_count() in the migration. */
const RPC_PARAMS = [
  "p_session_id",
  "p_counter1_id",
  "p_counter2_id",
  "p_bill_1000",
  "p_bill_500",
  "p_bill_100",
  "p_bill_50",
  "p_bill_20",
  "p_coins",
];

const makeClient = (
  response: { data: unknown; error: unknown },
): { client: any; calls: Array<{ fn: string; args: any }> } => {
  const calls: Array<{ fn: string; args: any }> = [];
  const client = {
    rpc: (fn: string, args: any) => {
      calls.push({ fn, args });
      return Promise.resolve(response);
    },
  };
  return { client, calls };
};

/** Shaped like the migration's RETURN jsonb_build_object(...). */
const okResponse = (countedCash = 12000, variance = 0) => ({
  data: {
    session_id: SESSION_ID,
    counted_cash: countedCash,
    expected_cash: 12000,
    cash_variance: variance,
    variance_status: variance === 0 ? "zero_match" : "shortage",
    status: variance === 0 ? "counted" : "variance_review",
  },
  error: null,
});

const denominations = {
  b1000: 10,
  b500: 4,
  b100: 0,
  b50: 0,
  b20: 0,
  coins: 0,
};

describe("OfferingService.recordCashCount — Supabase adapter contract", () => {
  it("calls the RPC the migration defines, with its exact parameter names", async () => {
    const { client, calls } = makeClient(okResponse());
    const service = new OfferingService(client);

    const res = await service.recordCashCount({
      sessionId: SESSION_ID,
      counter1Id: COUNTER_1,
      counter2Id: COUNTER_2,
      denominations,
    });

    expect(res.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("record_cash_count");
    // Exact set: a renamed or dropped parameter is a broken contract even if
    // every value happens to be right.
    expect(Object.keys(calls[0].args).sort()).toEqual([...RPC_PARAMS].sort());
  });

  it("forwards the counted denominations rather than a derived total", async () => {
    const { client, calls } = makeClient(okResponse());
    const service = new OfferingService(client);

    await service.recordCashCount({
      sessionId: SESSION_ID,
      counter1Id: COUNTER_1,
      counter2Id: COUNTER_2,
      denominations,
    });

    const args = calls[0].args;
    expect(args.p_session_id).toBe(SESSION_ID);
    expect(args.p_counter1_id).toBe(COUNTER_1);
    expect(args.p_counter2_id).toBe(COUNTER_2);
    expect(args.p_bill_1000).toBe(10);
    expect(args.p_bill_500).toBe(4);
    expect(args.p_coins).toBe(0);
  });

  it("reads back the response keys the migration returns", async () => {
    const { client } = makeClient(okResponse(11500, -500));
    const service = new OfferingService(client);

    const res = await service.recordCashCount({
      sessionId: SESSION_ID,
      counter1Id: COUNTER_1,
      counter2Id: COUNTER_2,
      denominations,
    });

    expect(res.success).toBe(true);
    expect(res.data?.totalCash.toNumber()).toBe(11500);
    expect(res.data?.varianceAmount.toNumber()).toBe(-500);
    expect(res.data?.varianceStatus).toBe("shortage");
    expect(res.data?.status).toBe("variance_review");
  });

  it("rejects dual-custody violations before touching the database", async () => {
    const { client, calls } = makeClient(okResponse());
    const service = new OfferingService(client);

    const res = await service.recordCashCount({
      sessionId: SESSION_ID,
      counter1Id: COUNTER_1,
      counter2Id: COUNTER_1,
      denominations,
    });

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe("VALIDATION_ERROR");
    // The important half: no write was attempted.
    expect(calls).toHaveLength(0);
  });

  it("rejects malformed denominations before touching the database", async () => {
    const { client, calls } = makeClient(okResponse());
    const service = new OfferingService(client);

    const res = await service.recordCashCount({
      sessionId: SESSION_ID,
      counter1Id: COUNTER_1,
      counter2Id: COUNTER_2,
      denominations: { ...denominations, b1000: -3 },
    });

    expect(res.success).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("surfaces a database error instead of reporting success", async () => {
    const { client } = makeClient({
      data: null,
      error: { code: "P0001", message: "SESSION_LOCKED: already posted" },
    });
    const service = new OfferingService(client);

    const res = await service.recordCashCount({
      sessionId: SESSION_ID,
      counter1Id: COUNTER_1,
      counter2Id: COUNTER_2,
      denominations,
    });

    expect(res.success).toBe(false);
    expect(res.data).toBeUndefined();
  });
});

describe("OfferingPage cash count — UI through to the data layer", () => {
  const session: OfferingSession = {
    id: SESSION_ID,
    churchId: "church-abc",
    serviceDate: "2026-09-06",
    serviceName: "รอบนมัสการเช้า",
    status: "counting",
    expectedCashAmount: Money.from(12000),
    expectedTransferAmount: Money.zero(),
    expectedQrAmount: Money.zero(),
    expectedTotalAmount: Money.from(12000),
  };

  const mountDetail = (serviceOverrides: Record<string, any>) => {
    const page: any = new OfferingPage(null as any, "church-abc", "u-1");
    Object.assign(page, {
      isLoading: false,
      mode: "detail",
      detailTab: "count",
      selectedSession: session,
      profiles: [],
      cashCountState: {
        counter1Id: COUNTER_1,
        counter2Id: COUNTER_2,
        // Page state holds coins as Money; the service input accepts the
        // looser shape. Seeding the service shape here would not render.
        denominations: { ...denominations, coins: Money.zero() },
      },
    });
    Object.assign(page.offeringService, serviceOverrides);

    const root = document.createElement("div");
    document.body.innerHTML = "";
    document.body.appendChild(root);
    const paint = () => {
      root.innerHTML = page.renderHtml();
      page.attachEventListeners(root, paint);
    };
    paint();
    return { page, root, paint };
  };

  it("save reaches the service with the counters the user picked", async () => {
    const recordCashCount = vi.fn().mockResolvedValue({
      success: true,
      data: {
        sessionId: SESSION_ID,
        totalCash: Money.from(12000),
        varianceAmount: Money.zero(),
        varianceStatus: "zero_match",
        status: "counted",
      },
    });
    const { page, root } = mountDetail({ recordCashCount });
    page.loadInitialData = vi.fn().mockResolvedValue(undefined);

    const saveBtn = root.querySelector<HTMLButtonElement>("#btn-save-cash-count");
    expect(saveBtn, "cash count save button must be rendered").not.toBeNull();
    saveBtn!.click();
    await vi.waitFor(() => expect(recordCashCount).toHaveBeenCalled());

    expect(recordCashCount.mock.calls[0][0]).toMatchObject({
      sessionId: SESSION_ID,
      counter1Id: COUNTER_1,
      counter2Id: COUNTER_2,
    });
  });

  it("re-reads the session after a successful save rather than trusting local state", async () => {
    const recordCashCount = vi.fn().mockResolvedValue({
      success: true,
      data: {
        sessionId: SESSION_ID,
        totalCash: Money.from(12000),
        varianceAmount: Money.zero(),
        varianceStatus: "zero_match",
        status: "counted",
      },
    });
    const { page, root } = mountDetail({ recordCashCount });
    const loadInitialData = vi.fn().mockResolvedValue(undefined);
    page.loadInitialData = loadInitialData;

    root.querySelector<HTMLButtonElement>("#btn-save-cash-count")!.click();
    await vi.waitFor(() => expect(loadInitialData).toHaveBeenCalledWith(SESSION_ID));
  });

  it("shows the failure to the user when the data layer rejects the save", async () => {
    const recordCashCount = vi.fn().mockResolvedValue({
      success: false,
      error: { code: "SESSION_LOCKED", message: "SESSION_LOCKED" },
    });
    const { page, root, paint } = mountDetail({ recordCashCount });
    page.loadInitialData = vi.fn().mockResolvedValue(undefined);

    root.querySelector<HTMLButtonElement>("#btn-save-cash-count")!.click();
    await vi.waitFor(() => expect(recordCashCount).toHaveBeenCalled());
    paint();

    expect(page.errorMessage).toBeTruthy();
    expect(page.successMessage).toBeNull();
  });

  it("blocks the save and never calls the service when one counter is missing", async () => {
    const recordCashCount = vi.fn();
    const { page, root } = mountDetail({ recordCashCount });
    page.cashCountState.counter2Id = "";

    root.querySelector<HTMLButtonElement>("#btn-save-cash-count")!.click();
    await Promise.resolve();

    expect(recordCashCount).not.toHaveBeenCalled();
    expect(page.errorMessage).toContain("ผู้ร่วมตรวจนับ");
  });
});
