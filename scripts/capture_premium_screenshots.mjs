/**
 * Captures the "after" screenshot set for the Premium Design waves.
 *
 * Renders each screen from its real render function against fixture props, so
 * no Supabase session is needed. Every screen is captured at desktop (1280) and
 * at the 390px mobile target.
 *
 * Usage: node scripts/capture_premium_screenshots.mjs
 * Requires the Vite dev server on http://localhost:5173.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "docs", "screenshots", "after");
const BASE_URL = process.env.GL_BASE_URL || "http://localhost:5173";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile390", width: 390, height: 844 },
];

/** Runs in the page: builds fixtures and exposes a paint(screenName) helper. */
async function installHarness(page) {
  await page.evaluate(async () => {
    const [shell, entry, review, cash, variance, list, overview, detailPage, dash, queue, sheet, modal, money] =
      await Promise.all([
        import("/src/components/layout/AppShell.ts"),
        import("/src/components/offering/OfferingEntryForm.ts"),
        import("/src/components/offering/OfferingReviewSheet.ts"),
        import("/src/components/offering/CashCountView.ts"),
        import("/src/components/offering/VarianceResolutionView.ts"),
        import("/src/components/offering/OfferingSessionList.ts"),
        import("/src/components/offering/OfferingDetailOverview.ts"),
        import("/src/pages/OfferingPage.ts"),
        import("/src/pages/DashboardPage.ts"),
        import("/src/components/approvals/ApprovalsQueueView.ts"),
        import("/src/components/approvals/ApprovalDecisionSheet.ts"),
        import("/src/components/approvals/RejectionModal.ts"),
        import("/src/lib/money.ts"),
      ]);

    const M = money.Money;
    const user = {
      name: "อาจารย์สรรเสริญ ดวงจิตร",
      role: "ศิษยาภิบาล",
      initials: "สด",
      churchName: "คริสตจักรชีวิตสุขสันต์กาฬสินธุ์",
    };

    const funds = [
      { id: "f1", name: "กองทุนทั่วไป" },
      { id: "f2", name: "กองทุนพันธกิจพิเศษ" },
    ];

    const formState = {
      serviceDate: "2026-08-23",
      serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
      channels: { cash: M.from("10000"), transfer: M.from("5000"), qr: M.from("3450") },
      allocations: [
        { id: "r1", fundId: "f1", channel: "cash", sourceType: "envelopes", amount: M.from("10000"), donorName: "", notes: "" },
        { id: "r2", fundId: "f2", channel: "qr_code", sourceType: "electronic_slip", amount: M.from("3450"), donorName: "", notes: "" },
      ],
      notes: "มีซองถวายโครงการสร้างอาคาร 3 ซอง",
    };

    const baseSession = {
      id: "1e72b32c-aaaa-bbbb-cccc-dddddddddddd",
      churchId: "c1",
      serviceDate: "2026-08-23",
      serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
      status: "variance_review",
      expectedCashAmount: M.from("10000"),
      expectedTransferAmount: M.from("5000"),
      expectedQrAmount: M.from("3450"),
      expectedTotalAmount: M.from("18450"),
      countedCashAmount: M.from("9950"),
      cashVarianceAmount: M.from("-50"),
      varianceStatus: "variance_detected",
      creatorName: "สุดารัตน์ จิณเซ่ง",
      createdAt: "2026-08-23",
      notes: "มีซองถวายโครงการสร้างอาคาร 3 ซอง",
      items: [
        { fundId: "f1", fundName: "กองทุนทั่วไป", paymentChannel: "cash", sourceType: "envelopes", amount: M.from("7000") },
        { fundId: "f1", fundName: "กองทุนทั่วไป", paymentChannel: "bank_transfer", sourceType: "electronic_slip", amount: M.from("5000") },
        { fundId: "f2", fundName: "กองทุนพันธกิจพิเศษ", paymentChannel: "cash", sourceType: "envelopes", amount: M.from("3000") },
        { fundId: "f2", fundName: "กองทุนพันธกิจพิเศษ", paymentChannel: "qr_code", sourceType: "electronic_slip", amount: M.from("3450") },
      ],
      cashCount: {
        offeringSessionId: "1e72b32c",
        b1000: 9, b500: 1, b100: 4, b50: 0, b20: 0,
        coins: M.from("50"),
        totalCashCounted: M.from("9950"),
        countedBy1: "p1", countedBy1Name: "อาจารย์ ทัศนา ดวงจิตร",
        countedBy2: "p2", countedBy2Name: "สุดารัตน์ จิณเซ่ง",
        counter1SignedAt: "2026-08-23",
      },
      revisions: [
        {
          offeringSessionId: "1e72b32c", revisionNumber: 1,
          previousCashAmount: M.from("10500"), newCashAmount: M.from("10000"),
          previousTotalAmount: M.from("18950"), newTotalAmount: M.from("18450"),
          revisionReason: "นับซองซ้ำ", revisedBy: "p1", createdAt: "2026-08-23",
        },
      ],
    };

    const profiles = [
      { id: "p1", fullName: "อาจารย์ ทัศนา ดวงจิตร" },
      { id: "p2", fullName: "สุดารัตน์ จิณเซ่ง" },
    ];

    const accounts = [
      { id: "a1", name: "กล่องเงินสดประจำสัปดาห์", code: "1001", accountType: "cash_drawer" },
      { id: "a2", name: "บัญชีธนาคารกรุงเทพ", code: "1002", accountType: "bank" },
    ];

    const mkTx = (id, ref, desc, amt, hasReceipt, isCreator, status) => ({
      id, churchId: "c1", accountId: "a1", accountName: "ธนาคารกรุงเทพ กระแสรายวัน",
      amount: M.from(amt), direction: "expense", status, description: desc,
      referenceNumber: ref, createdBy: "u1", creatorName: "สุดารัตน์ จิณเซ่ง", creatorInitials: "สด",
      createdAt: "2026-08-18", hasReceipt, isCreator,
      splits: [{ fundId: "f1", fundName: "กองทุนพันธกิจพิเศษ", amount: M.from(amt), fundBalance: M.from("9510") }],
    });

    const txs = [
      mkTx("t1", "VCH-2026-001", "ค่าเช่าสถานที่จัดค่ายเยาวชน", "12500", false, false, "pending_approval"),
      mkTx("t2", "VCH-2026-002", "อุปกรณ์สำนักงานและกระดาษ", "4200", true, false, "pending_approval"),
      mkTx("t3", "VCH-2026-003", "จัดซื้อเก้าอี้ห้องประชุมชุดใหม่", "28000", true, false, "approved"),
      mkTx("t4", "VCH-2026-004", "ค่าเดินทางเยี่ยมเยียนสมาชิก", "1500", false, true, "rejected"),
    ];

    const projections = [{
      fundId: "f1", fundName: "กองทุนพันธกิจพิเศษ",
      currentPostedBalance: M.from("9510"), approvedUnpostedImpact: M.zero(),
      evaluatingTransactionImpact: M.from("-12500"), projectedBalance: M.from("-2990"), isDeficit: true,
    }];

    const detailFor = (status, extra = {}) => {
      const page = new detailPage.OfferingPage({ from: () => ({}) }, "c1", "u1", "อาจารย์สรรเสริญ ดวงจิตร");
      page.mode = "detail";
      page.profiles = profiles;
      page.accounts = accounts;
      page.selectedCashAccountId = "a1";
      page.selectedBankAccountId = "a2";
      page.selectedSession = { ...baseSession, status, ...extra };
      page.cashCountState = {
        counter1Id: "p1", counter2Id: "p2",
        denominations: { b1000: 9, b500: 1, b100: 4, b50: 0, b20: 0, coins: M.from("50") },
      };
      return page;
    };

    const screens = {
      "01_dashboard": () => new dash.DashboardPage({}).renderHtml({
        pendingApprovalsCount: 4,
        totalFundsBalance: M.from("250000").format(),
        activeAccountsCount: 3,
        funds: [
          { name: "กองทุนทั่วไป", balance: M.from("184500") },
          { name: "กองทุนพันธกิจพิเศษ", balance: M.from("52000") },
          { name: "กองทุนสร้างพระวิหาร", balance: M.from("13500") },
        ],
      }),
      "02_approvals_queue": () =>
        `<div class="gl-page">${queue.renderApprovalsQueueViewHtml({ items: txs })}</div>`,
      "03_approval_detail": () =>
        `<div class="gl-page">${queue.renderApprovalsQueueViewHtml({ items: txs })}` +
        `${sheet.renderApprovalDecisionSheetHtml({ item: txs[0], projections })}</div>`,
      "04_reject_modal": () =>
        `<div class="gl-page">${queue.renderApprovalsQueueViewHtml({ items: txs })}` +
        `${modal.renderRejectionModalHtml({ transactionId: "t1", referenceNumber: "VCH-2026-001", amount: "฿12,500.00", type: "rejected" })}</div>`,
      "05_offering_list": () =>
        list.renderOfferingSessionListHtml({
          sessions: [
            { ...baseSession, id: "s1", status: "draft" },
            { ...baseSession, id: "s2", status: "counting", serviceDate: "2026-08-16" },
            { ...baseSession, id: "s3", status: "variance_review", serviceDate: "2026-08-09" },
            { ...baseSession, id: "s4", status: "confirmed", serviceDate: "2026-08-02" },
            { ...baseSession, id: "s5", status: "posted", serviceDate: "2026-07-26" },
          ],
          isLoading: false, errorMessage: null,
        }),
      "06_offering_entry": () =>
        entry.renderOfferingEntryFormHtml({ funds, state: formState, validationErrors: [] }),
      "07_offering_review": () =>
        review.renderOfferingReviewSheetHtml({ funds, state: formState, creatorName: "อาจารย์ ทัศนา ดวงจิตร", isSubmitting: false, errorMessage: null }),
      "08_detail_overview": () => detailFor("posted", {
        financialTransactionId: "tx-fin-777888-9999-aaaa", postedAt: "2026-08-24",
      }).renderHtml(),
      "09_cash_count": () => {
        const p = detailFor("counting");
        p.detailTab = "count";
        return p.renderHtml();
      },
      "10_cash_count_shortage": () => {
        const p = detailFor("counting");
        p.detailTab = "count";
        p.cashCountState = {
          counter1Id: "p1", counter2Id: "p2",
          denominations: { b1000: 5, b500: 3, b100: 4, b50: 0, b20: 0, coins: M.from("50") },
        };
        return p.renderHtml();
      },
      "11_variance_resolution": () => {
        const p = detailFor("variance_review");
        p.detailTab = "resolution";
        return p.renderHtml();
      },
      "12_ready_to_post": () => {
        const p = detailFor("confirmed");
        p.detailTab = "resolution";
        return p.renderHtml();
      },
      "13_posted": () => {
        const p = detailFor("posted", {
          financialTransactionId: "tx-fin-777888-9999-aaaa", postedAt: "2026-08-24",
        });
        p.detailTab = "resolution";
        return p.renderHtml();
      },
    };

    window.__paint = (name, route) => {
      document.querySelector("#app").innerHTML = shell.renderAppShellHtml(
        { activeRoute: route, pendingCount: 4, user },
        screens[name]()
      );
      window.scrollTo(0, 0);
    };
    window.__screenNames = Object.keys(screens);
  });
}

const ROUTES = {
  "01_dashboard": "/",
  "02_approvals_queue": "/approvals",
  "03_approval_detail": "/approvals",
  "04_reject_modal": "/approvals",
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const results = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await installHarness(page);

    const names = await page.evaluate(() => window.__screenNames);

    for (const name of names) {
      const route = ROUTES[name] || "/offerings";
      await page.evaluate(([n, r]) => window.__paint(n, r), [name, route]);
      await page.waitForTimeout(180); // let the fade-in settle

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );

      // A viewport capture first: fixed chrome (bottom nav, action bar) only
      // renders in its real place when the shot is viewport-sized.
      if (vp.name === "mobile390") {
        await page.screenshot({ path: join(OUT_DIR, `${name}__mobile390_viewport.png`) });
      }

      // Then the full-page capture. Playwright stitches full-page shots, which
      // strands fixed elements mid-document; neutralise them so the page reads
      // as one continuous document.
      await page.addStyleTag({
        content: `.gl-mobilenav, .gl-actionbar--sticky, .gl-modal-backdrop { position: static !important; }
                  header { position: static !important; }`,
      });
      await page.screenshot({ path: join(OUT_DIR, `${name}__${vp.name}.png`), fullPage: true });
      await page.evaluate(() => {
        const tags = [...document.querySelectorAll("style")].filter((t) =>
          t.textContent.includes("gl-actionbar--sticky")
        );
        tags.forEach((t) => t.remove());
      });

      results.push({ screen: name, viewport: vp.name, overflow });
    }

    await context.close();
  }

  await browser.close();

  const bad = results.filter((r) => r.overflow);
  console.log(`captured ${results.length} screenshots -> docs/screenshots/after/`);
  console.log(bad.length === 0 ? "no horizontal overflow on any capture" : `OVERFLOW: ${JSON.stringify(bad)}`);
  if (bad.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
