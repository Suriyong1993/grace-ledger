import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "docs", "screenshots", "live");
const ARTIFACT_DIR = "C:/Users/Administrator/.gemini/antigravity/brain/808a5f57-292b-472b-a0a6-7bdfb858096f";
const PORT = 5189;
const BASE_URL = `http://localhost:${PORT}`;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startServer() {
  console.log(`Starting Vite on port ${PORT}...`);
  const proc = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout.on("data", (d) => process.stdout.write(d.toString()));
  proc.stderr.on("data", (d) => process.stderr.write(d.toString()));

  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) {
        console.log("Vite dev server is ready!");
        return proc;
      }
    } catch {
      // Keep waiting
    }
  }
  throw new Error("Vite server failed to start within 15 seconds");
}

async function installScreensHarness(page) {
  await page.evaluate(async () => {
    const [shell, dash, txns, funds, members, reports, queue, sheet, list, entry, review, money] =
      await Promise.all([
        import("/src/components/layout/AppShell.ts"),
        import("/src/pages/DashboardPage.ts"),
        import("/src/pages/TransactionsPage.ts"),
        import("/src/pages/FundsPage.ts"),
        import("/src/pages/MembersPage.ts"),
        import("/src/pages/ReportsPage.ts"),
        import("/src/components/approvals/ApprovalsQueueView.ts"),
        import("/src/components/approvals/ApprovalDecisionSheet.ts"),
        import("/src/components/offering/OfferingSessionList.ts"),
        import("/src/components/offering/OfferingEntryForm.ts"),
        import("/src/components/offering/OfferingReviewSheet.ts"),
        import("/src/lib/money.ts"),
      ]);

    const M = money.Money;
    const user = {
      name: "อาจารย์สรรเสริญ ดวงจิตร",
      role: "ศิษยาภิบาล",
      initials: "สด",
      churchName: "คริสตจักรพระคุณ กาฬสินธุ์",
    };

    const dummyFunds = [
      { id: "f1", name: "กองทุนทั่วไป" },
      { id: "f2", name: "กองทุนพันธกิจ" },
      { id: "f3", name: "กองทุนอาคารและสถานที่" },
      { id: "f4", name: "กองทุนเยาวชนและการศึกษา" },
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

    const pendingApprovalsList = [
      {
        id: "tx-1",
        churchId: "c-1",
        accountId: "a-1",
        accountName: "ธนาคารกรุงไทย ···4821",
        amount: M.from("8500.00"),
        direction: "expense",
        status: "pending_approval",
        description: "ซื้ออุปกรณ์ระบบเสียงห้องเยาวชน",
        referenceNumber: "EXP-0248",
        createdBy: "u-creator",
        creatorName: "นรินทร์ สมหวัง",
        creatorInitials: "นส",
        createdAt: "2026-08-21T09:30:00Z",
        hasReceipt: true,
        splits: [{ fundId: "f-4", fundName: "กองทุนเยาวชนและการศึกษา", amount: M.from("8500.00"), fundBalance: M.from("12010.00") }],
        isCreator: false,
      },
      {
        id: "tx-2",
        churchId: "c-1",
        accountId: "a-1",
        accountName: "ธนาคารกรุงไทย ···4821",
        amount: M.from("4280.00"),
        direction: "expense",
        status: "pending_approval",
        description: "ค่าไฟฟ้าและสาธารณูปโภคประจำเดือน",
        referenceNumber: "EXP-0247",
        createdBy: "u-creator2",
        creatorName: "มนัส สุขใจ",
        creatorInitials: "มส",
        createdAt: "2026-08-20T11:30:00Z",
        hasReceipt: true,
        splits: [{ fundId: "f-1", fundName: "กองทุนทั่วไป", amount: M.from("4280.00"), fundBalance: M.from("128450.00") }],
        isCreator: false,
      },
    ];

    const offeringSessionsList = [
      {
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
        creatorName: "มนัส สุขใจ",
        createdAt: "2026-08-23",
      },
      {
        id: "2e72b32c-aaaa-bbbb-cccc-dddddddddddd",
        churchId: "c1",
        serviceDate: "2026-08-16",
        serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
        status: "posted",
        expectedCashAmount: M.from("12000"),
        expectedTransferAmount: M.from("6000"),
        expectedQrAmount: M.from("4200"),
        expectedTotalAmount: M.from("22200"),
        countedCashAmount: M.from("12000"),
        cashVarianceAmount: M.from("0"),
        varianceStatus: "balanced",
        creatorName: "มนัส สุขใจ",
        createdAt: "2026-08-16",
      },
    ];

    const screens = {
      "01_dashboard": {
        route: "/",
        render: () =>
          new dash.DashboardPage({}).renderHtml({
            pendingApprovalsCount: 2,
            totalFundsBalance: "฿248,560.00",
            monthlyIncome: "฿18,450.00",
            monthlyExpense: "฿12,820.00",
            activeAccountsCount: 3,
            funds: [
              { name: "กองทุนทั่วไป", balance: M.from("128450.00") },
              { name: "กองทุนพันธกิจ", balance: M.from("42300.00") },
              { name: "กองทุนอาคารและสถานที่", balance: M.from("65800.00") },
              { name: "กองทุนเยาวชนและการศึกษา", balance: M.from("12010.00") },
            ],
            recentTransactions: [
              {
                id: "rec-1",
                title: "เงินถวายวันอาทิตย์",
                subtitle: "กองทุนทั่วไป · เงินสด · วันนี้",
                amount: M.from("18450.00"),
                direction: "income",
                date: "วันนี้",
                status: "approved",
              },
              {
                id: "rec-2",
                title: "ค่าไฟฟ้าและสาธารณูปโภค",
                subtitle: "กองทุนทั่วไป · โอนเงิน · เมื่อวาน",
                amount: M.from("4280.00"),
                direction: "expense",
                date: "เมื่อวาน",
                status: "approved",
              },
              {
                id: "rec-3",
                title: "ซื้ออุปกรณ์ห้องเรียนเยาวชน",
                subtitle: "กองทุนเยาวชน · โอนเงิน · 14 ส.ค. 2569",
                amount: M.from("8500.00"),
                direction: "expense",
                date: "14 ส.ค. 2569",
                status: "pending",
              },
            ],
          }),
      },
      "02_transactions": {
        route: "/transactions",
        render: () => {
          const p = new txns.TransactionsPage({}, "c1");
          p.loadData();
          return p.renderHtml();
        },
      },
      "03_funds": {
        route: "/funds",
        render: () => {
          const p = new funds.FundsPage({}, "c1");
          p.loadData();
          return p.renderHtml();
        },
      },
      "04_members": {
        route: "/members",
        render: () => {
          const p = new members.MembersPage({}, "c1");
          p.loadData();
          return p.renderHtml();
        },
      },
      "05_reports": {
        route: "/reports",
        render: () => {
          const p = new reports.ReportsPage({}, "c1");
          return p.renderHtml();
        },
      },
      "06_approvals": {
        route: "/approvals",
        render: () =>
          `<div class="gl-page">${queue.renderApprovalsQueueViewHtml({ items: pendingApprovalsList })}</div>`,
      },
      "07_approval_decision": {
        route: "/approvals",
        render: () =>
          `<div class="gl-page">${queue.renderApprovalsQueueViewHtml({ items: pendingApprovalsList })}` +
          `${sheet.renderApprovalDecisionSheetHtml({
            item: pendingApprovalsList[0],
            projections: [
              {
                fundId: "f-4",
                fundName: "กองทุนเยาวชนและการศึกษา",
                currentPostedBalance: M.from("12010.00"),
                approvedUnpostedImpact: M.zero(),
                evaluatingTransactionImpact: M.from("-8500.00"),
                projectedBalance: M.from("3510.00"),
                isDeficit: false,
              },
            ],
          })}</div>`,
      },
      "08_offerings": {
        route: "/offerings",
        render: () =>
          list.renderOfferingSessionListHtml({
            sessions: offeringSessionsList,
            isLoading: false,
            errorMessage: null,
          }),
      },
      "09_offering_entry": {
        route: "/offerings/new",
        render: () =>
          entry.renderOfferingEntryFormHtml({
            funds: dummyFunds,
            state: formState,
            validationErrors: [],
          }),
      },
    };

    window.__paint = (name) => {
      const s = screens[name];
      if (!s) return;
      document.querySelector("#app").innerHTML = shell.renderAppShellHtml(
        { activeRoute: s.route, pendingCount: 2, user },
        s.render()
      );
      window.scrollTo(0, 0);
    };

    window.__screenNames = Object.keys(screens);
  });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const viteProc = await startServer();

  try {
    const browser = await chromium.launch();

    // 1. Desktop captures (1280x880)
    console.log("Capturing Desktop screens (1280px)...");
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 880 },
      deviceScaleFactor: 2,
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto(BASE_URL, { waitUntil: "networkidle" });
    await desktopPage.evaluate(() => document.fonts.ready);
    await installScreensHarness(desktopPage);

    const screenNames = await desktopPage.evaluate(() => window.__screenNames);

    for (const name of screenNames) {
      await desktopPage.evaluate((n) => window.__paint(n), name);
      await desktopPage.waitForTimeout(200);

      const filename = `${name}_desktop.png`;
      const outPath = join(OUT_DIR, filename);
      const artifactPath = join(ARTIFACT_DIR, filename);

      await desktopPage.screenshot({ path: outPath, fullPage: false });
      copyFileSync(outPath, artifactPath);
      console.log(`Saved Desktop: ${filename}`);
    }
    await desktopContext.close();

    // 2. Mobile captures (390x844)
    console.log("Capturing Mobile screens (390px)...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(BASE_URL, { waitUntil: "networkidle" });
    await mobilePage.evaluate(() => document.fonts.ready);
    await installScreensHarness(mobilePage);

    for (const name of screenNames) {
      await mobilePage.evaluate((n) => window.__paint(n), name);
      await mobilePage.waitForTimeout(200);

      const filename = `${name}_mobile390.png`;
      const outPath = join(OUT_DIR, filename);
      const artifactPath = join(ARTIFACT_DIR, filename);

      await mobilePage.screenshot({ path: outPath, fullPage: false });
      copyFileSync(outPath, artifactPath);
      console.log(`Saved Mobile: ${filename}`);
    }
    await mobileContext.close();

    await browser.close();
    console.log("All screenshots captured and copied successfully!");
  } finally {
    viteProc.kill();
  }
}

main().catch((err) => {
  console.error("Error capturing screenshots:", err);
  process.exit(1);
});
