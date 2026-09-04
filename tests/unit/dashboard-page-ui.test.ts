import { describe, it, expect } from "vitest";
import { DashboardPage, DashboardData } from "../../src/pages/DashboardPage";
import { Money } from "../../src/lib/money";
import type { AttentionSummary } from "../../src/services/attention-service";

/** Minimal pending-work fixture matching AttentionService's shape. */
function attentionFixture(
  overrides: Partial<AttentionSummary> = {},
): AttentionSummary {
  return {
    groups: [
      {
        key: "approvals",
        label: "คิวอนุมัติ",
        href: "#/approvals",
        summary: "3 รายการ · รวม ฿9,000.00 · ล่าสุด เบิกจ่ายค่าใช้จ่ายภารกิจ",
        count: 3,
        requiresAction: true,
        items: [],
      },
      {
        key: "offerings",
        label: "เงินถวาย",
        href: "#/offerings",
        summary: "ผลต่างรอดำเนินการ 1",
        count: 1,
        requiresAction: true,
        items: [],
      },
      {
        key: "drafts",
        label: "ฉบับร่าง",
        href: "#/transactions",
        summary: "2 รายการยังไม่ส่งอนุมัติ",
        count: 2,
        requiresAction: false,
        items: [],
      },
    ],
    totalCount: 6,
    loadFailed: false,
    ...overrides,
  };
}

describe("DashboardPage UI — Unit Tests", () => {
  const dummySupabase = {} as any;
  const page = new DashboardPage(dummySupabase);

  it("renders hero balance card, monthly income and expense correctly", () => {
    const data: DashboardData = {
      pendingApprovalsCount: 2,
      totalFundsBalance: "฿248,560.00",
      monthlyIncome: "฿18,450.00",
      monthlyExpense: "฿12,820.00",
      activeAccountsCount: 3,
      funds: [
        { id: "f-1", name: "กองทุนทั่วไป", balance: Money.from("128450.00") },
        { id: "f-2", name: "กองทุนพันธกิจ", balance: Money.from("42300.00") },
      ],
      recentTransactions: [
        {
          id: "tx-1",
          title: "เงินถวายวันอาทิตย์",
          subtitle: "กองทุนทั่วไป · 21 ส.ค. 2569",
          amount: Money.from("18450.00"),
          direction: "income",
          date: "21 ส.ค. 2569",
          status: "approved",
        },
      ],
    };

    const html = page.renderHtml(data);

    expect(html).toContain("ยอดเงินคงเหลือทั้งหมด");
    expect(html).toContain("฿248,560.00");
    expect(html).toContain("+฿18,450.00");
    expect(html).toContain("−฿12,820.00");
    expect(html).toContain("2 กองทุน · 3 บัญชีธนาคาร + เงินสดในมือ");
  });

  it("keeps the balance, income and expense inside one hero card beside the review card — not three equal stat cards", () => {
    const html = page.renderHtml({
      pendingApprovalsCount: 0,
      totalFundsBalance: "฿248,560.00",
      monthlyIncome: "฿18,450.00",
      monthlyExpense: "฿12,820.00",
    });

    // Balance card and context card, unequal weight, side by side — not a
    // grid of equal-looking cards.
    expect(html).toContain('class="gl-dash-hero-row"');
    expect(html).toContain('class="gl-card gl-dash-hero gl-rise"');
    expect(html).toContain('class="gl-card gl-dash-context gl-rise"');
    expect(html).toContain('data-testid="total-balance"');
    // The static review card is gone — pending work lives in งานสัปดาห์นี้.
    expect(html).not.toContain('class="gl-card gl-dash-review');

    // Income/expense are typography inside the hero card, never their own
    // bordered card.
    expect(html).toContain('class="gl-dash-hero__figure">รายรับเดือนนี้');
    expect(html).toContain('class="gl-dash-hero__figure">รายจ่ายเดือนนี้');
    expect(html).not.toContain('class="gl-stats"');

    // Sign and colour stay attached to the figure they describe.
    expect(html).toContain('class="num-display gl-income">+฿18,450.00<');
    expect(html).toContain('class="num-display gl-expense">−฿12,820.00<');
  });

  it("puts the trend chart on its own full-width band above the activity split", () => {
    const html = page.renderHtml({
      pendingApprovalsCount: 0,
      historicalTrend: [
        {
          monthName: "ม.ค.",
          income: "฿90,000.00",
          expense: "฿10,000.00",
          net: "฿80,000.00",
          isPositive: true,
          incomeSatang: 9000000,
          expenseSatang: 1000000,
        },
      ],
    });

    // Twelve bars inside the narrow left column were unreadable; the chart now
    // spans the page and the split below it carries activity and funds only.
    const trendAt = html.indexOf("รายรับและรายจ่ายรายเดือน");
    const splitAt = html.indexOf('class="gl-dash-split"');
    expect(trendAt).toBeGreaterThan(-1);
    expect(splitAt).toBeGreaterThan(-1);
    expect(trendAt).toBeLessThan(splitAt);
  });

  it("staggers the trend columns left to right, capped at twelve steps", () => {
    const months = Array.from({ length: 14 }, (_, i) => ({
      monthName: `ด.${i}`,
      income: "฿1,000.00",
      expense: "฿500.00",
      net: "฿500.00",
      isPositive: true,
      incomeSatang: 100000,
      expenseSatang: 50000,
    }));

    const html = page.renderHtml({
      pendingApprovalsCount: 0,
      historicalTrend: months,
    });

    expect(html).toContain("--gl-bar-delay: 0ms;");
    expect(html).toContain("--gl-bar-delay: 40ms;");
    expect(html).toContain("--gl-bar-delay: 440ms;");
    // A 14-month series must not push the last column past the cap.
    expect(html).not.toContain("--gl-bar-delay: 480ms;");
  });

  it("renders the page heading and the period the figures describe", () => {
    const html = page.renderHtml({ pendingApprovalsCount: 0 });

    expect(html).toContain("<h1>ภาพรวมการเงิน</h1>");
    // Same locale and month style as formatDateThai — one date language app-wide.
    const period = new Date().toLocaleDateString("th-TH", {
      month: "short",
      year: "numeric",
    });
    expect(html).toContain(`ข้อมูล ณ ${period}`);
  });

  it("renders the hero action strip as one labeled primary button plus labeled icon-only controls, gated by role", () => {
    const treasurer = {
      name: "อาจารย์สรรเสริญ ดวงจิตร",
      role: "treasurer",
      initials: "สด",
    };
    const html = page.renderHtml({ pendingApprovalsCount: 0 }, treasurer);

    expect(html).toContain('href="#/offerings/new"');
    // The receipt icon deep-links into the existing create form.
    expect(html).toContain('href="#/transactions?create=1"');
    expect(html).toContain('href="#/funds"');
    expect(html).toContain('href="#/transactions"');

    // One real button carries a visible label.
    expect(html).toContain('class="gl-btn gl-btn--primary"');
    expect(html).toContain("บันทึกเงินถวาย");

    // The rest are icon-only — never four identical rectangles — but each
    // still carries an accessible name for a screen reader.
    expect(html).toContain('aria-label="บันทึกรายจ่าย"');
    expect(html).toContain('aria-label="โอนเงินกองทุน"');
    expect(html).toContain('aria-label="รายการทั้งหมด"');

    // Labels wrap naturally; a hard <br> inside a label breaks at 390px.
    expect(html).not.toContain("<br>");
  });

  it("hides the hero quick actions for roles that may not create financial records", () => {
    const viewer = {
      name: "อาจารย์สรรเสริญ ดวงจิตร",
      role: "approver",
      initials: "สด",
    };
    const html = page.renderHtml({ pendingApprovalsCount: 0 }, viewer);

    expect(html).not.toContain('href="#/offerings/new"');
    expect(html).not.toContain('aria-label="บันทึกรายจ่าย"');
    expect(html).not.toContain('aria-label="โอนเงินกองทุน"');
    // Read-only navigation stays available.
    expect(html).toContain('aria-label="รายการทั้งหมด"');
  });

  it("shows fund progress only for funds that actually have a target", () => {
    const html = page.renderHtml({
      pendingApprovalsCount: 0,
      funds: [
        {
          id: "f-1",
          name: "กองทุนอาคาร",
          balance: Money.from("25000.00"),
          targetAmount: Money.from("100000.00"),
        },
        {
          id: "f-2",
          name: "กองทุนทั่วไป",
          balance: Money.from("8000.00"),
          targetAmount: null,
        },
      ],
    });

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="25"');
    expect(html).toContain('style="width: 25%;"');
    expect(html).toContain("เป้าหมาย");
    // The untargeted fund states that plainly instead of inventing a goal.
    expect(html).toContain("ยังไม่ได้ตั้งเป้าหมายกองทุนนี้");
  });

  it("scales trend bars against the tallest month present, never a fixed ceiling", () => {
    const html = page.renderHtml({
      pendingApprovalsCount: 0,
      historicalTrend: [
        {
          monthName: "ม.ค.",
          income: "฿90,000.00",
          expense: "฿10,000.00",
          net: "฿80,000.00",
          isPositive: true,
          incomeSatang: 9000000,
          expenseSatang: 1000000,
        },
      ],
    });

    // 9,000,000 satang is well past the old hardcoded 5,000,000 ceiling; it must
    // render as the full track rather than clipping to look like an average month.
    expect(html).toContain('style="height: 96px;"');
    expect(html).toContain('style="height: 11px;"');
    expect(html).toContain("฿90,000.00");
  });

  it("renders attention queue from the shared pending-work summary", () => {
    const treasurer = {
      name: "อาจารย์สรรเสริญ ดวงจิตร",
      role: "treasurer",
      initials: "สด",
    };
    const html = page.renderHtml(
      { pendingApprovalsCount: 3 },
      treasurer,
      attentionFixture(),
    );

    // The section answers WHAT / WHY / WHERE per group; it sits below the
    // financial position hero (see "orders the page financial-position-first").
    expect(html).toContain("งานสัปดาห์นี้");
    expect(html).toContain("ต้องดำเนินการ 6 รายการ");
    expect(html).toContain("คิวอนุมัติ · 3 รายการ");
    expect(html).toContain("รวม ฿9,000.00");
    expect(html).toContain("เงินถวาย · 1 รอบ");
    expect(html).toContain("ฉบับร่าง · 2 รายการ");
    expect(html).toContain('href="#/approvals"');
    expect(html).toContain('href="#/offerings"');
    expect(html).toContain('href="#/transactions"');
  });

  it("renders a loading skeleton for the attention section while the summary loads", () => {
    const treasurer = {
      name: "อาจารย์สรรเสริญ ดวงจิตร",
      role: "treasurer",
      initials: "สด",
    };
    const html = page.renderHtml({ pendingApprovalsCount: 0 }, treasurer, null);

    expect(html).toContain("gl-attention-loading");
    expect(html).toContain("gl-skeleton");
  });

  it("renders the all-clear attention state with the weekly offering action", () => {
    const treasurer = {
      name: "อาจารย์สรรเสริญ ดวงจิตร",
      role: "treasurer",
      initials: "สด",
    };
    const html = page.renderHtml(
      { pendingApprovalsCount: 0 },
      treasurer,
      attentionFixture({ groups: [], totalCount: 0 }),
    );

    expect(html).toContain(
      "งานเป็นที่เรียบร้อย — ไม่มีสิ่งที่ต้องดำเนินการค้าง",
    );
    expect(html).toContain("บันทึกเงินถวายสัปดาห์นี้");
    // The attention badge stays silent when nothing is pending.
    expect(html).not.toMatch(/ต้องดำเนินการ \d/);
  });

  it("falls back to the legacy pending-approvals row when no summary was passed", () => {
    const html = page.renderHtml({ pendingApprovalsCount: 3 });

    expect(html).toContain("คิวอนุมัติรอพิจารณา · 3 รายการ");
    expect(html).toContain('href="#/approvals"');
  });

  it("shows the month-over-month net context beside the hero", () => {
    const html = page.renderHtml({
      pendingApprovalsCount: 0,
      monthlyIncome: "฿90,000.00",
      monthlyExpense: "฿10,000.00",
      historicalTrend: [
        {
          monthName: "ก.ค.",
          income: "฿80,000.00",
          expense: "฿20,000.00",
          net: "฿60,000.00",
          isPositive: true,
          incomeSatang: 8000000,
          expenseSatang: 2000000,
        },
        {
          monthName: "ส.ค.",
          income: "฿90,000.00",
          expense: "฿10,000.00",
          net: "฿80,000.00",
          isPositive: true,
          incomeSatang: 9000000,
          expenseSatang: 1000000,
        },
      ],
    });

    expect(html).toContain("สุทธิเทียบเดือนก่อน");
    // 80,000 − 60,000 = +20,000 month-over-month.
    expect(html).toContain("+฿20,000.00");
    expect(html).toContain(
      'ก.ค. สุทธิ <span class="num-display">+฿60,000.00</span>',
    );
  });

  it("states plainly when there is no previous month to compare against", () => {
    const html = page.renderHtml({
      pendingApprovalsCount: 0,
      monthlyIncome: "฿18,450.00",
      monthlyExpense: "฿12,820.00",
    });

    expect(html).toContain("ยังไม่มีข้อมูลเดือนก่อนสำหรับเปรียบเทียบ");
    expect(html).not.toContain('class="gl-card gl-dash-review');
  });

  it("renders empty states gracefully for funds and recent transactions", () => {
    const html = page.renderHtml({
      pendingApprovalsCount: 0,
      funds: [],
      recentTransactions: [],
    });

    expect(html).toContain("ยังไม่มีกองทุน");
    expect(html).toContain("ยังไม่มีรายการล่าสุด");
    // Fallback attention section (no summary passed) states the all-clear.
    expect(html).toContain(
      "งานเป็นที่เรียบร้อย — ไม่มีสิ่งที่ต้องดำเนินการค้าง",
    );
  });

  it("renders error notice if loadFailed is true", () => {
    const html = page.renderHtml({
      pendingApprovalsCount: 0,
      loadFailed: true,
    });

    expect(html).toContain("gl-notice--error");
    expect(html).toContain("โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง");
  });

  describe("loadData — financial correctness", () => {
    const CHURCH = "church-1";

    interface Captured {
      statementRange: { start?: string; end?: string };
      recentLimit?: number;
    }

    /**
     * Routes by table and by the filters each caller applies, so the
     * posted-ledger statement query and the recent-activity query are answered
     * with different rows — the whole point of the fix.
     */
    function makeSupabase(opts: {
      postedRows: any[];
      recentRows: any[];
      funds?: any[];
      captured: Captured;
    }) {
      const build = (table: string) => {
        const b: any = { _eq: {} as Record<string, string>, _range: {} as any };
        b.select = () => b;
        b.eq = (col: string, val: string) => {
          b._eq[col] = val;
          return b;
        };
        b.gte = (_c: string, v: string) => {
          b._range.start = v;
          return b;
        };
        b.lte = (_c: string, v: string) => {
          b._range.end = v;
          return b;
        };
        b.order = () => b;
        b.limit = (n: number) => {
          b._limit = n;
          return b;
        };
        b.maybeSingle = () => b;
        b.single = () => b;
        b.then = (resolve: any) => {
          if (table === "funds") {
            return resolve({ data: opts.funds ?? [], error: null });
          }
          if (table === "accounts") {
            return resolve({ data: [], error: null, count: 2 });
          }
          if (table === "transactions") {
            // ReportsService: status=posted plus a date range.
            if (b._eq.status === "posted" && b._range.start) {
              opts.captured.statementRange = { ...b._range };
              return resolve({ data: opts.postedRows, error: null });
            }
            // ApprovalsService: pending queue.
            if (b._eq.status === "pending_approval") {
              return resolve({ data: [], error: null });
            }
            // DashboardPage: recent-activity feed.
            opts.captured.recentLimit = b._limit;
            return resolve({ data: opts.recentRows, error: null });
          }
          return resolve({ data: [], error: null });
        };
        return b;
      };
      return { from: (table: string) => build(table) } as any;
    }

    // Five recent rows that deliberately do NOT sum to the month's totals:
    // they span other months and include a transfer.
    const recentRows = [
      {
        id: "r1",
        description: "ค่าเช่าที่ได้รับจากผู้เช่า",
        direction: "income",
        transaction_date: "2026-08-21",
        status: "posted",
        transaction_splits: [{ amount: "3000.00", fund_id: "f-1" }],
      },
      {
        id: "r2",
        description: "เงินถวายเดือนก่อน",
        direction: "income",
        transaction_date: "2026-06-02",
        status: "posted",
        transaction_splits: [{ amount: "99000.00", fund_id: "f-1" }],
      },
      {
        id: "r3",
        description: "โอนเงินระหว่างกองทุน",
        direction: "transfer",
        transaction_date: "2026-08-15",
        status: "posted",
        transaction_splits: [{ amount: "25000.00", fund_id: "f-2" }],
      },
      {
        id: "r4",
        description: "ค่าไฟฟ้า",
        direction: "expense",
        transaction_date: "2026-08-19",
        status: "posted",
        transaction_splits: [{ amount: "4280.00", fund_id: "f-1" }],
      },
      {
        id: "r5",
        description: "ถวายพิเศษ",
        direction: "income",
        transaction_date: "2026-05-11",
        status: "posted",
        transaction_splits: [{ amount: "6200.00", fund_id: "f-1" }],
      },
    ];

    const postedRows = [
      {
        id: "p1",
        amount: "50000.00",
        direction: "income",
        description: "เงินถวายวันอาทิตย์",
        transaction_date: "2026-08-02",
        status: "posted",
        transaction_splits: [
          {
            amount: "50000.00",
            fund_id: "f-1",
            category_id: "c1",
            categories: { id: "c1", name: "ถวายทั่วไป" },
            funds: { id: "f-1", name: "กองทุนทั่วไป" },
          },
        ],
      },
      {
        id: "p2",
        amount: "12500.00",
        direction: "expense",
        description: "ค่าสาธารณูปโภค",
        transaction_date: "2026-08-05",
        status: "posted",
        transaction_splits: [
          {
            amount: "12500.00",
            fund_id: "f-1",
            category_id: "c2",
            categories: { id: "c2", name: "สาธารณูปโภค" },
            funds: { id: "f-1", name: "กองทุนทั่วไป" },
          },
        ],
      },
      {
        id: "p3",
        amount: "25000.00",
        direction: "transfer",
        description: "โอนเงินระหว่างกองทุน",
        transaction_date: "2026-08-06",
        status: "posted",
        transaction_splits: [
          {
            amount: "25000.00",
            fund_id: "f-2",
            category_id: null,
            categories: null,
            funds: { id: "f-2", name: "กองทุนพันธกิจ" },
          },
        ],
      },
    ];

    it("takes the month's income and expense from the posted ledger, not from the 5-row activity list", async () => {
      const captured: Captured = { statementRange: {} };
      const page = new DashboardPage(
        makeSupabase({ postedRows, recentRows, captured }),
      );
      const data = await page.loadData(CHURCH);

      // Posted ledger for the month: 50,000 in, 12,500 out, transfer excluded.
      expect(data.monthlyIncome).toBe("฿50,000.00");
      expect(data.monthlyExpense).toBe("฿12,500.00");

      // The old code summed the activity list, which would have produced
      // 108,200 income (99,000 of it from June) and counted the transfer.
      expect(data.monthlyIncome).not.toBe("฿108,200.00");
      expect(data.recentTransactions).toHaveLength(5);
      expect(captured.recentLimit).toBe(5);
    });

    it("queries the whole current calendar month, ending on its real last day", async () => {
      const captured: Captured = { statementRange: {} };
      const page = new DashboardPage(
        makeSupabase({ postedRows, recentRows, captured }),
      );
      await page.loadData(CHURCH);

      const { start, end } = captured.statementRange;
      expect(start).toMatch(/^\d{4}-\d{2}-01$/);
      expect(end).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // "Last day" verified by behaviour, not by repeating the implementation:
      // end is in the current month, and one day later is not.
      const endDate = new Date(end + "T00:00:00");
      const dayAfter = new Date(endDate);
      dayAfter.setDate(dayAfter.getDate() + 1);
      expect(endDate.getMonth()).toBe(new Date().getMonth());
      expect(dayAfter.getMonth()).not.toBe(endDate.getMonth());
    });

    it("types each activity row from the ledger direction column, not the Thai description", async () => {
      const captured: Captured = { statementRange: {} };
      const page = new DashboardPage(
        makeSupabase({ postedRows, recentRows, captured }),
      );
      const data = await page.loadData(CHURCH);
      const rows = data.recentTransactions!;

      // Contains "ค่า" but the ledger says income.
      expect(rows[0].title).toBe("ค่าเช่าที่ได้รับจากผู้เช่า");
      expect(rows[0].direction).toBe("income");
      // A transfer stays a transfer instead of being forced into expense.
      expect(rows[2].direction).toBe("transfer");
      expect(rows[3].direction).toBe("expense");
      // No invented fund name — the query does not join funds.
      expect(rows[0].subtitle).not.toContain("กองทุนทั่วไป");
    });
  });

  describe("rendering — stored XSS", () => {
    const PAYLOAD = '<img src=x onerror="alert(1)">';

    it("escapes transaction titles, subtitles, fund names and error text", () => {
      const html = page.renderHtml({
        pendingApprovalsCount: 0,
        loadFailed: true,
        errorMessage: PAYLOAD,
        funds: [
          {
            id: "f-1",
            name: PAYLOAD,
            balance: Money.from("100.00"),
            targetAmount: Money.from("200.00"),
          },
        ],
        recentTransactions: [
          {
            id: "t-1",
            title: PAYLOAD,
            subtitle: PAYLOAD,
            amount: Money.from("100.00"),
            direction: "income",
            date: "21 ส.ค. 2569",
            status: "approved",
          },
        ],
      });

      expect(html).not.toContain("<img src=x");
      expect(html).not.toContain('onerror="alert(1)"');
      expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    });

    it("escapes the fund name inside the progress bar's aria-label", () => {
      const html = page.renderHtml({
        pendingApprovalsCount: 0,
        funds: [
          {
            id: "f-1",
            name: '" onmouseover="alert(1)',
            balance: Money.from("100.00"),
            targetAmount: Money.from("200.00"),
          },
        ],
      });

      expect(html).not.toContain('onmouseover="alert(1)');
      expect(html).toContain("&quot; onmouseover=&quot;alert(1)");
    });

    it("escapes month labels coming from the historical summaries table", () => {
      const html = page.renderHtml({
        pendingApprovalsCount: 0,
        historicalTrend: [
          {
            monthName: PAYLOAD,
            income: "฿1.00",
            expense: "฿1.00",
            net: "฿0.00",
            isPositive: true,
            incomeSatang: 100,
            expenseSatang: 100,
          },
        ],
      });

      expect(html).not.toContain("<img src=x");
      expect(html).toContain("&lt;img src=x");
    });
  });

  describe("loadData — authoritative activity amount", () => {
    /**
     * transactions.amount is the transaction's value; transaction_splits records
     * how that value is allocated across funds. The split-sum parity invariant is
     * written as sum(splits) = transactions.amount, so the header is the side
     * being validated against — it is the authoritative figure, and it is
     * complete for every status including drafts, where parity is not yet
     * enforced.
     */
    function makeSupabase(recentRows: any[]) {
      const build = (table: string) => {
        const b: any = { _eq: {} as Record<string, string>, _range: {} as any };
        b.select = () => b;
        b.eq = (c: string, v: string) => {
          b._eq[c] = v;
          return b;
        };
        b.gte = (_c: string, v: string) => {
          b._range.start = v;
          return b;
        };
        b.lte = (_c: string, v: string) => {
          b._range.end = v;
          return b;
        };
        b.order = () => b;
        b.limit = () => b;
        b.then = (resolve: any) => {
          if (table === "funds") return resolve({ data: [], error: null });
          if (table === "accounts")
            return resolve({ data: [], error: null, count: 0 });
          if (table === "transactions") {
            if (b._eq.status === "posted" && b._range.start)
              return resolve({ data: [], error: null });
            if (b._eq.status === "pending_approval")
              return resolve({ data: [], error: null });
            return resolve({ data: recentRows, error: null });
          }
          return resolve({ data: [], error: null });
        };
        return b;
      };
      return { from: (t: string) => build(t) } as any;
    }

    async function amountsFor(rows: any[]) {
      const page = new DashboardPage(makeSupabase(rows));
      const data = await page.loadData("church-1");
      return data.recentTransactions!.map((r) => ({
        amount: r.amount.format(),
        direction: r.direction,
      }));
    }

    it("shows the header amount for a normal income row", async () => {
      const rows = [
        {
          id: "i",
          description: "เงินถวาย",
          amount: "18450.00",
          direction: "income",
          transaction_date: "2026-08-21",
          status: "posted",
        },
      ];
      expect(await amountsFor(rows)).toEqual([
        { amount: "฿18,450.00", direction: "income" },
      ]);
    });

    it("shows the header amount for a normal expense row", async () => {
      const rows = [
        {
          id: "e",
          description: "ค่าไฟฟ้า",
          amount: "4280.00",
          direction: "expense",
          transaction_date: "2026-08-19",
          status: "posted",
        },
      ];
      expect(await amountsFor(rows)).toEqual([
        { amount: "฿4,280.00", direction: "expense" },
      ]);
    });

    it("shows the whole transaction for a multi-split row, not one fund's share", async () => {
      // Allocated across three funds; the row is worth 18,450 regardless of how
      // many funds it lands in. Splits are not selected at all any more.
      const rows = [
        {
          id: "m",
          description: "เงินถวายแบ่งสามกองทุน",
          amount: "18450.00",
          direction: "income",
          transaction_date: "2026-08-20",
          status: "posted",
          transaction_splits: [
            { amount: "10000.00", fund_id: "f-1" },
            { amount: "5000.00", fund_id: "f-2" },
            { amount: "3450.00", fund_id: "f-3" },
          ],
        },
      ];
      expect(await amountsFor(rows)).toEqual([
        { amount: "฿18,450.00", direction: "income" },
      ]);
    });

    it("shows a transfer at its real value instead of the zero its splits net to", async () => {
      // A transfer's legs cancel out. Summing splits reported ฿0.00 for a real
      // movement of money.
      const rows = [
        {
          id: "t",
          description: "โอนเงินระหว่างกองทุน",
          amount: "25000.00",
          direction: "transfer",
          transaction_date: "2026-08-15",
          status: "posted",
          transaction_splits: [
            { amount: "-25000.00", fund_id: "f-1" },
            { amount: "25000.00", fund_id: "f-2" },
          ],
        },
      ];
      expect(await amountsFor(rows)).toEqual([
        { amount: "฿25,000.00", direction: "transfer" },
      ]);
    });

    it("shows a half-allocated draft at its full stated value", async () => {
      // Split parity is only enforced on submit and on post, so a draft can hold
      // incomplete splits. Summing them would understate what the row is worth.
      const rows = [
        {
          id: "d",
          description: "ร่างรายการ",
          amount: "9000.00",
          direction: "expense",
          transaction_date: "2026-08-18",
          status: "draft",
          transaction_splits: [{ amount: "2000.00", fund_id: "f-1" }],
        },
      ];
      expect(await amountsFor(rows)).toEqual([
        { amount: "฿9,000.00", direction: "expense" },
      ]);
    });
  });

  describe("Profile-Centric Layout & 3-Column Metrics", () => {
    it("keeps identity in the shell header — the dashboard leads with work, not a user card", () => {
      const html = page.renderHtml(
        {
          pendingApprovalsCount: 1,
          totalFundsBalance: "฿150,000.00",
          monthlyIncome: "฿25,000.00",
          monthlyExpense: "฿10,000.00",
        },
        {
          name: "พณ.ท่านหม่อมราชวงศ์สุริยงค์ บาลเพ็ชร",
          role: "super_admin",
          initials: "สบ",
          churchName: "คริสตจักรชีวิตสุขสันต์กาฬสินธุ์",
        },
      );

      // The identity card is gone; church context survives as the header's
      // supporting line and the shell topbar/sidebar own the identity.
      expect(html).not.toContain('class="gl-card gl-dash-user-card"');
      expect(html).toContain("คริสตจักรชีวิตสุขสันต์กาฬสินธุ์ · ข้อมูล ณ");
      expect(html).toContain("<h1>ภาพรวมการเงิน</h1>");
    });

    it("calculates and displays 3-column financial metrics including net change", () => {
      const html = page.renderHtml({
        pendingApprovalsCount: 0,
        totalFundsBalance: "฿150,000.00",
        monthlyIncome: "฿30,000.00",
        monthlyExpense: "฿12,000.00",
      });

      expect(html).toContain("รายรับเดือนนี้");
      expect(html).toContain("+฿30,000.00");
      expect(html).toContain("รายจ่ายเดือนนี้");
      expect(html).toContain("−฿12,000.00");
      expect(html).toContain("ส่วนต่างสุทธิ");
      expect(html).toContain("+฿18,000.00");
    });

    it("renders the greeting as a plain page-context line, not a competing surface", () => {
      const html = page.renderHtml(
        {
          pendingApprovalsCount: 3,
          totalFundsBalance: "฿150,000.00",
          monthlyIncome: "฿30,000.00",
          monthlyExpense: "฿12,000.00",
        },
        {
          name: "อาจารย์สรรเสริญ ดวงจิตร",
          role: "pastor",
          initials: "สด",
          churchName: "คริสตจักรชีวิตสุขสันต์กาฬสินธุ์",
        },
      );

      expect(html).toContain('class="gl-dash-greeting"');
      expect(html).toContain("สวัสดีครับ อาจารย์สรรเสริญ ดวงจิตร · ศิษยาภิบาล");
      // The pending count and its action live only in the command center —
      // the greeting must never repeat them (D12: one attention source).
      expect(html).not.toContain("gl-ai-greeting");
      expect(html).not.toContain("cta-2026");
      expect(html).not.toContain("ดูงานค้าง →");
    });

    it("renders the same plain greeting line when all tasks are clear", () => {
      const html = page.renderHtml(
        {
          pendingApprovalsCount: 0,
          totalFundsBalance: "฿150,000.00",
          monthlyIncome: "฿30,000.00",
          monthlyExpense: "฿12,000.00",
        },
        {
          name: "สุดารัตน์ จิณเซ่ง",
          role: "counter",
          initials: "สด",
          churchName: "คริสตจักรชีวิตสุขสันต์กาฬสินธุ์",
        },
      );

      expect(html).toContain('class="gl-dash-greeting"');
      expect(html).toContain("สวัสดีครับ สุดารัตน์ จิณเซ่ง · ผู้นับเงิน");
      expect(html).not.toContain("ดูงานค้าง →");
    });

    it("orders the page financial-position-first: hero row before the command center (D12, supersedes D11 §5)", () => {
      const html = page.renderHtml(
        { pendingApprovalsCount: 3 },
        { name: "ทดสอบ", role: "treasurer", initials: "ท" },
        attentionFixture(),
      );

      const heroAt = html.indexOf('class="gl-dash-hero-row"');
      const commandCenterAt = html.indexOf('class="gl-command-center"');
      expect(heroAt).toBeGreaterThan(-1);
      expect(commandCenterAt).toBeGreaterThan(-1);
      expect(heroAt).toBeLessThan(commandCenterAt);
    });
  });
});
