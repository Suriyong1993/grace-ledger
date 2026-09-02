/**
 * Emerald Vault identity — full-route screenshot capture.
 *
 * Renders the REAL current page classes with fixture data (no Supabase
 * session needed) inside the real AppShell, at desktop (1280px) and
 * mobile (390px). Companion to the older capture_all_pages.mjs, which
 * captures the pre-2B Approvals component UI and is kept as historical
 * evidence.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, ".screenshots", "emerald-vault");
const PORT = 5191;
const BASE_URL = `http://localhost:${PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startServer() {
  console.log(`Starting Vite on port ${PORT}...`);
  const proc = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) {
        console.log("Vite dev server is ready!");
        return proc;
      }
    } catch {
      // keep waiting
    }
  }
  throw new Error("Vite server failed to start");
}

async function installHarness(page) {
  await page.evaluate(async () => {
    const [shell, dash, txns, funds, members, reports, profile, approvals, login, list, money] =
      await Promise.all([
        import("/src/components/layout/AppShell.ts"),
        import("/src/pages/DashboardPage.ts"),
        import("/src/pages/TransactionsPage.ts"),
        import("/src/pages/FundsPage.ts"),
        import("/src/pages/MembersPage.ts"),
        import("/src/pages/ReportsPage.ts"),
        import("/src/pages/ProfilePage.ts"),
        import("/src/pages/ApprovalsPage.ts"),
        import("/src/pages/LoginPage.ts"),
        import("/src/components/offering/OfferingSessionList.ts"),
        import("/src/lib/money.ts"),
      ]);

    const M = money.Money;
    const user = {
      name: "อาจารย์สรรเสริญ ดวงจิตร",
      role: "ศิษยาภิบาล",
      initials: "สด",
      churchName: "คริสตจักรพระคุณ กาฬสินธุ์",
    };

    const approvalItem = {
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
      createdAt: "2026-09-01T09:30:00Z",
      hasReceipt: true,
      splits: [
        { fundId: "f-4", fundName: "กองทุนเยาวชนและการศึกษา", amount: M.from("8500.00"), fundBalance: M.from("12010.00") },
      ],
      isCreator: false,
    };

    const approvalsPage = new approvals.ApprovalsPage({}, "c-1", "u-approver");
    approvalsPage.items = [approvalItem, { ...approvalItem, id: "tx-2", description: "ค่าไฟฟ้าและสาธารณูปโภคประจำเดือน", referenceNumber: "EXP-0247", hasReceipt: false }];

    const profilePage = new profile.ProfilePage({}, { user, userId: "9f2c1a44-7b21-4e0f-9c31-aabbccddeeff", churchId: "c-1" });

    const sessions = [
      {
        id: "1e72b32c-aaaa-bbbb-cccc-dddddddddddd",
        churchId: "c1",
        serviceDate: "2026-08-30",
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
        createdAt: "2026-08-30",
      },
    ];

    const screens = {
      "01_dashboard": {
        route: "/",
        html: () =>
          new dash.DashboardPage({}).renderHtml({
            pendingApprovalsCount: 2,
            totalFundsBalance: "฿248,560.00",
            monthlyIncome: "฿18,450.00",
            monthlyExpense: "฿12,820.00",
            activeAccountsCount: 3,
            user,
            funds: [
              { name: "กองทุนทั่วไป", balance: M.from("128450.00"), targetAmount: M.from("150000.00") },
              { name: "กองทุนพันธกิจ", balance: M.from("42300.00") },
              { name: "กองทุนอาคารและสถานที่", balance: M.from("65800.00"), targetAmount: M.from("500000.00") },
              { name: "กองทุนเยาวชนและการศึกษา", balance: M.from("12010.00") },
            ],
            recentTransactions: [
              { id: "rec-1", title: "เงินถวายวันอาทิตย์", subtitle: "31 ส.ค. 2569", amount: M.from("18450.00"), direction: "income", date: "31 ส.ค. 2569", status: "approved" },
              { id: "rec-2", title: "ค่าไฟฟ้าและสาธารณูปโภค", subtitle: "30 ส.ค. 2569", amount: M.from("4280.00"), direction: "expense", date: "30 ส.ค. 2569", status: "approved" },
              { id: "rec-3", title: "ซื้ออุปกรณ์ห้องเรียนเยาวชน", subtitle: "28 ส.ค. 2569", amount: M.from("8500.00"), direction: "expense", date: "28 ส.ค. 2569", status: "pending" },
            ],
          }, user),
      },
      "02_transactions": {
        route: "/transactions",
        html: () => {
          const p = new txns.TransactionsPage({}, "c1");
          p.loadData();
          return p.renderHtml(user);
        },
      },
      "03_approvals": {
        route: "/approvals",
        html: () => approvalsPage.renderHtml(user),
      },
      "04_funds": {
        route: "/funds",
        html: () => {
          const p = new funds.FundsPage({}, "c1");
          p.isLoading = false;
          p.funds = [
            { id: "f1", name: "กองทุนทั่วไป", description: "ค่าใช้จ่ายดำเนินงานทั่วไปของคริสตจักร", balance: M.from("128450.00"), targetAmount: M.from("150000.00"), percentageUsed: 86, recentActivity: [] },
            { id: "f2", name: "กองทุนพันธกิจ", description: "งบสนับสนุนงานพันธกิจและผู้รับใช้", balance: M.from("42300.00"), targetAmount: null, percentageUsed: null, recentActivity: [] },
            { id: "f3", name: "กองทุนอาคารและสถานที่", description: "โครงการปรับปรุงอาคารศาสนสถาน", balance: M.from("65800.00"), targetAmount: M.from("500000.00"), percentageUsed: 13, recentActivity: [] },
          ];
          return p.renderHtml();
        },
      },
      "05_members": {
        route: "/members",
        html: () => {
          const p = new members.MembersPage({}, "c1");
          p.isLoading = false;
          p.members = [
            { id: "m1", code: "M-001", name: "วนิดา เกียรติสกุล", email: "wanida@example.com", phone: "081-234-5678", group: "ผู้ใหญ่" },
            { id: "m2", code: "M-002", name: "สมชาย ใจดี", email: "somchai@example.com", phone: "082-345-6789", group: "ผู้ใหญ่" },
            { id: "m3", code: "M-003", name: "มานะ รักพระเจ้า", email: "mana@example.com", phone: "083-456-7890", group: "เยาวชน" },
          ];
          p.givingById = {
            m1: { status: "loaded", total: M.from("12400.00"), titheCount: 4, lastGivenDate: "2026-08-30" },
            m2: { status: "loaded", total: M.from("8000.00"), titheCount: 3, lastGivenDate: "2026-08-30" },
            m3: { status: "loaded", total: M.from("1500.00"), titheCount: 1, lastGivenDate: "2026-08-16" },
          };
          return p.renderHtml(user);
        },
      },
      "06_reports": {
        route: "/reports",
        html: () => {
          const p = new reports.ReportsPage({}, "c1");
          p.isLoading = false;
          p.statement = {
            church_id: "c1",
            period_start: "2026-08-01",
            period_end: "2026-08-31",
            total_income: M.from("184500.00"),
            total_expense: M.from("121320.00"),
            net_surplus_deficit: M.from("63180.00"),
            posted_transactions_count: 42,
            categories_summary: [
              { category_id: "c1", category_name: "เงินถวาย", type: "income", total_amount: M.from("165200.00"), transaction_count: 12 },
              { category_id: "c2", category_name: "ค่าใช้จ่ายดำเนินงาน", type: "expense", total_amount: M.from("54300.00"), transaction_count: 18 },
              { category_id: "c3", category_name: "งบพันธกิจ", type: "expense", total_amount: M.from("30000.00"), transaction_count: 6 },
            ],
            funds_allocation: [
              { fund_id: "f1", fund_name: "กองทุนทั่วไป", total_allocated: M.from("98200.00"), split_count: 24 },
              { fund_id: "f2", fund_name: "กองทุนพันธกิจ", total_allocated: M.from("42300.00"), split_count: 10 },
              { fund_id: "f3", fund_name: "กองทุนอาคารและสถานที่", total_allocated: M.from("44000.00"), split_count: 8 },
            ],
            generated_at: "2026-09-01T00:00:00Z",
          };
          return p.renderHtml();
        },
      },
      "07_offerings": {
        route: "/offerings",
        html: () =>
          list.renderOfferingSessionListHtml({
            sessions,
            isLoading: false,
            errorMessage: null,
          }),
      },
      "08_profile": {
        route: "/profile",
        html: () => profilePage.renderHtml(),
      },
    };

    window.__paint = (name) => {
      const s = screens[name];
      if (!s) return;
      document.querySelector("#app").innerHTML = shell.renderAppShellHtml(
        { activeRoute: s.route, pendingCount: 2, user },
        s.html()
      );
      window.scrollTo(0, 0);
    };

    window.__paintLogin = async () => {
      const loginModule = await import("/src/pages/LoginPage.ts");
      const lp = new loginModule.LoginPage({});
      document.querySelector("#app").innerHTML = lp.renderHtml();
      window.scrollTo(0, 0);
    };

    window.__screenNames = Object.keys(screens);
  });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const viteProc = await startServer();

  try {
    const browser = await chromium.launch();

    for (const [label, viewport] of [
      ["desktop", { width: 1280, height: 880 }],
      ["mobile390", { width: 390, height: 844 }],
    ]) {
      console.log(`Capturing ${label} (${viewport.width}px)...`);
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
      const pg = await ctx.newPage();
      await pg.goto(BASE_URL, { waitUntil: "networkidle" });
      await pg.evaluate(() => document.fonts.ready);
      await installHarness(pg);

      for (const name of await pg.evaluate(() => window.__screenNames)) {
        await pg.evaluate((n) => window.__paint(n), name);
        await pg.waitForTimeout(250);
        const out = join(OUT_DIR, `${name}_${label}.png`);
        await pg.screenshot({ path: out, fullPage: label === "desktop" });
        console.log(`Saved: ${name}_${label}.png`);
      }

      await pg.evaluate(() => window.__paintLogin());
      await pg.waitForTimeout(250);
      await pg.screenshot({ path: join(OUT_DIR, `09_login_${label}.png`) });
      console.log(`Saved: 09_login_${label}.png`);

      await ctx.close();
    }

    await browser.close();
    console.log("All screenshots captured.");
  } finally {
    viteProc.kill();
  }
}

main().catch((err) => {
  console.error("Error capturing screenshots:", err);
  process.exit(1);
});
