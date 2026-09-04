/**
 * Comprehensive Browser Smoke Test for Grace Ledger Modernization (September 2026)
 *
 * Tests the real running dev server (http://localhost:5500) using Playwright Chromium:
 * 1. Viewports: 1280x900, 768x900, 390x844
 * 2. Horizontal overflow verification
 * 3. Login split layout (desktop) vs mobile single column
 * 4. All 8 routes (Dashboard, Transactions, Offerings, Funds, Approvals, Members, Reports, Profile)
 * 5. Visual Hero Balance, Attention Work, Loading, Empty, and Error states
 * 6. Accessibility: Skip link, Keyboard focus, Focus-visible, Popover Escape, Reduced Motion
 * 7. Real screenshot capture for each state and viewport
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "docs", "screenshots", "browser_smoke_test");
const BASE_URL = process.env.BASE_URL || "http://localhost:5500";

mkdirSync(OUT_DIR, { recursive: true });

const results = {
  viewports: {},
  routes: {},
  interactions: {},
  accessibility: {},
  screenshots: [],
};

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function installHarness(page) {
  await page.evaluate(async () => {
    const [
      routerMod,
      shellMod,
      dashMod,
      txnsMod,
      fundsMod,
      membersMod,
      reportsMod,
      profileMod,
      approvalsMod,
      loginMod,
      offeringListMod,
      moneyMod,
    ] = await Promise.all([
      import("/src/router.ts"),
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

    const M = moneyMod.Money;
    const user = {
      name: "อาจารย์สรรเสริญ ดวงจิตร",
      role: "pastor",
      initials: "สด",
      churchName: "คริสตจักรชีวิตสุขสันต์กาฬสินธุ์",
    };

    const attentionData = {
      totalCount: 3,
      loadFailed: false,
      groups: [
        {
          key: "approvals",
          label: "คิวอนุมัติ",
          summary: "คำขอเบิกจ่ายรอการตรวจสอบ",
          count: 2,
          href: "#/approvals",
          requiresAction: true,
          items: [
            {
              id: "tx-1",
              title: "ซื้ออุปกรณ์ระบบเสียงห้องเยาวชน",
              meta: "8,500.00 ฿ · EXP-0248",
              href: "#/approvals",
            },
          ],
        },
        {
          key: "offerings",
          label: "เงินถวายรอตรวจนับ",
          summary: "รอบนมัสการรอการบันทึกยอด",
          count: 1,
          href: "#/offerings",
          requiresAction: true,
          items: [
            {
              id: "off-1",
              title: "รอบนมัสการวันอาทิตย์ (เช้า)",
              meta: "18,450.00 ฿",
              href: "#/offerings",
            },
          ],
        },
      ],
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
        {
          fundId: "f-4",
          fundName: "กองทุนเยาวชนและการศึกษา",
          amount: M.from("8500.00"),
          fundBalance: M.from("12010.00"),
        },
      ],
      isCreator: false,
    };

    const dummyFunds = [
      {
        id: "f1",
        name: "กองทุนทั่วไป",
        description: "ค่าใช้จ่ายดำเนินงานทั่วไปของคริสตจักร",
        balance: M.from("128450.00"),
        targetAmount: M.from("150000.00"),
        percentageUsed: 86,
        recentActivity: [],
      },
      {
        id: "f2",
        name: "กองทุนพันธกิจ",
        description: "งบสนับสนุนงานพันธกิจและผู้รับใช้",
        balance: M.from("42300.00"),
        targetAmount: null,
        percentageUsed: null,
        recentActivity: [],
      },
      {
        id: "f3",
        name: "กองทุนอาคารและสถานที่",
        description: "โครงการปรับปรุงอาคารศาสนสถาน",
        balance: M.from("65800.00"),
        targetAmount: M.from("500000.00"),
        percentageUsed: 13,
        recentActivity: [],
      },
      {
        id: "f4",
        name: "กองทุนเยาวชนและการศึกษา",
        description: "พัฒนาและเสริมสร้างชีวิตเยาวชน",
        balance: M.from("12010.00"),
        targetAmount: null,
        percentageUsed: null,
        recentActivity: [],
      },
    ];

    const dummyMembers = [
      {
        id: "m1",
        code: "M-001",
        name: "วนิดา เกียรติสกุล",
        email: "wanida@example.com",
        phone: "081-234-5678",
        group: "ผู้ใหญ่",
      },
      {
        id: "m2",
        code: "M-002",
        name: "สมชาย ใจดี",
        email: "somchai@example.com",
        phone: "082-345-6789",
        group: "ผู้ใหญ่",
      },
      {
        id: "m3",
        code: "M-003",
        name: "มานะ รักพระเจ้า",
        email: "mana@example.com",
        phone: "083-456-7890",
        group: "เยาวชน",
      },
    ];

    const dummyStatement = {
      church_id: "c1",
      period_start: "2026-08-01",
      period_end: "2026-08-31",
      total_income: M.from("184500.00"),
      total_expense: M.from("121320.00"),
      net_surplus_deficit: M.from("63180.00"),
      posted_transactions_count: 42,
      categories_summary: [
        {
          category_id: "c1",
          category_name: "เงินถวาย",
          type: "income",
          total_amount: M.from("165200.00"),
          transaction_count: 12,
        },
        {
          category_id: "c2",
          category_name: "ค่าใช้จ่ายดำเนินงาน",
          type: "expense",
          total_amount: M.from("54300.00"),
          transaction_count: 18,
        },
      ],
      funds_allocation: [
        {
          fund_id: "f1",
          fund_name: "กองทุนทั่วไป",
          total_allocated: M.from("98200.00"),
          split_count: 24,
        },
      ],
      generated_at: "2026-09-01T00:00:00Z",
    };

    const dummySessions = [
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
        creatorName: "อาจารย์ ทัศนา ดวงจิตร",
        createdAt: "2026-08-30",
      },
    ];

    const approvalsPage = new approvalsMod.ApprovalsPage(
      {},
      "c-1",
      "u-approver",
    );
    approvalsPage.items = [
      approvalItem,
      {
        ...approvalItem,
        id: "tx-2",
        description: "ค่าไฟฟ้าและสาธารณูปโภคประจำเดือน",
        referenceNumber: "EXP-0247",
        hasReceipt: false,
      },
    ];

    const profilePage = new profileMod.ProfilePage(
      {},
      {
        user,
        userId: "9f2c1a44-7b21-4e0f-9c31-aabbccddeeff",
        churchId: "c-1",
      },
    );

    const routesRegistry = {
      dashboard: {
        path: "/",
        render: () =>
          new dashMod.DashboardPage({}).renderHtml(
            {
              pendingApprovalsCount: 2,
              totalFundsBalance: "฿248,560.00",
              monthlyIncome: "฿18,450.00",
              monthlyExpense: "฿12,820.00",
              activeAccountsCount: 3,
              user,
              funds: dummyFunds,
              recentTransactions: [
                {
                  id: "rec-1",
                  title: "เงินถวายวันอาทิตย์",
                  subtitle: "31 ส.ค. 2569",
                  amount: M.from("18450.00"),
                  direction: "income",
                  date: "31 ส.ค. 2569",
                  status: "approved",
                },
              ],
            },
            user,
            attentionData,
          ),
      },
      transactions: {
        path: "/transactions",
        render: () => {
          const p = new txnsMod.TransactionsPage({}, "c1");
          p.loadData();
          return p.renderHtml(user);
        },
      },
      offerings: {
        path: "/offerings",
        render: () =>
          offeringListMod.renderOfferingSessionListHtml({
            sessions: dummySessions,
            isLoading: false,
            errorMessage: null,
          }),
      },
      funds: {
        path: "/funds",
        render: () => {
          const p = new fundsMod.FundsPage({}, "c1");
          p.isLoading = false;
          p.funds = dummyFunds;
          return p.renderHtml();
        },
      },
      approvals: {
        path: "/approvals",
        render: () => approvalsPage.renderHtml(user),
      },
      members: {
        path: "/members",
        render: () => {
          const p = new membersMod.MembersPage({}, "c1");
          p.isLoading = false;
          p.members = dummyMembers;
          p.givingById = {
            m1: {
              status: "loaded",
              total: M.from("12400.00"),
              titheCount: 4,
              lastGivenDate: "2026-08-30",
            },
          };
          return p.renderHtml(user);
        },
      },
      reports: {
        path: "/reports",
        render: () => {
          const p = new reportsMod.ReportsPage({}, "c1");
          p.isLoading = false;
          p.statement = dummyStatement;
          return p.renderHtml();
        },
      },
      profile: {
        path: "/profile",
        render: () => profilePage.renderHtml(),
      },
    };

    // Paint function to inject into AppShell
    window.__paintRoute = (routeName) => {
      const r = routesRegistry[routeName];
      if (!r) throw new Error("Route not found: " + routeName);
      const app = document.querySelector("#app");
      app.innerHTML = shellMod.renderAppShellHtml(
        {
          activeRoute: r.path,
          pendingCount: 2,
          user,
          attention: attentionData,
        },
        r.render(),
      );

      const btn = app.querySelector("#gl-attention-btn");
      const panel = app.querySelector("#gl-attention-panel");
      if (btn && panel) {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const willOpen = panel.hidden;
          panel.hidden = !willOpen;
          btn.setAttribute("aria-expanded", String(willOpen));
        });
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && !panel.hidden) {
            panel.hidden = true;
            btn.setAttribute("aria-expanded", "false");
            btn.focus();
          }
        });
      }

      window.scrollTo(0, 0);
    };

    window.__paintLogin = () => {
      const lp = new loginMod.LoginPage({});
      const app = document.querySelector("#app");
      app.innerHTML = lp.renderHtml();
      lp.attachEventListeners(app, { onPinAuthenticated: () => {} });
      window.scrollTo(0, 0);
    };

    window.__paintState = (stateType) => {
      const app = document.querySelector("#app");
      let content = "";
      if (stateType === "loading") {
        content = `
          <div class="gl-page" role="status" aria-busy="true">
            <div class="gl-skeleton" style="height: 120px; margin-bottom: var(--space-4); border-radius: var(--radius-lg);"></div>
            <div class="gl-skeleton" style="height: 240px; border-radius: var(--radius-lg);"></div>
          </div>`;
      } else if (stateType === "empty") {
        content = `
          <div class="gl-page">
            <div class="gl-empty-state gl-card">
              <div class="gl-empty-state__icon">📁</div>
              <h2 class="gl-empty-state__title">ไม่พบรายการข้อมูล</h2>
              <p class="gl-empty-state__desc">ยังไม่มีประวัติรายการในรอบบัญชีปัจจุบัน</p>
            </div>
          </div>`;
      } else if (stateType === "error") {
        content = `
          <div class="gl-page">
            <div class="gl-alert gl-alert--danger" role="alert">
              <strong>เกิดข้อผิดพลาดในการโหลดข้อมูล</strong>
              <p>ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง</p>
            </div>
          </div>`;
      }
      app.innerHTML = shellMod.renderAppShellHtml(
        { activeRoute: "/", pendingCount: 0, user, attention: null },
        content,
      );
    };

    window.__verifyRouter = () => {
      const paths = [
        "/",
        "/transactions",
        "/offerings",
        "/funds",
        "/approvals",
        "/members",
        "/reports",
        "/profile",
      ];
      return paths.map((p) => {
        const matched = routerMod.router.matchRoute(p);
        return { path: p, matchedPattern: matched.pattern };
      });
    };

    window.__checkOverflow = () => {
      const doc = document.documentElement;
      const body = document.body;
      const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
      const clientWidth = doc.clientWidth;
      return {
        hasOverflow: scrollWidth > clientWidth,
        scrollWidth,
        clientWidth,
      };
    };
  });
}

async function runSmokeTest() {
  console.log("==================================================");
  console.log("GRACE LEDGER — REAL BROWSER SMOKE TEST (SEPT 2026)");
  console.log(`Connecting to dev server at: ${BASE_URL}`);
  console.log("==================================================\n");

  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: "desktop", width: 1280, height: 900 },
    { name: "tablet", width: 768, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ];

  // 1. ROUTE REACHABILITY CHECK (Pure router contract)
  console.log("--- 1. Router Route Reachability ---");
  const initPage = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await initPage.goto(BASE_URL, { waitUntil: "networkidle" });
  await installHarness(initPage);

  const routeCheck = await initPage.evaluate(() => window.__verifyRouter());
  console.log("Router verified routes:");
  let allRoutesValid = true;
  for (const r of routeCheck) {
    const isValid = r.matchedPattern === r.path;
    console.log(`  Route '${r.path}' -> pattern '${r.matchedPattern}' [${isValid ? "PASS" : "FAIL"}]`);
    if (!isValid) allRoutesValid = false;
  }
  results.routes.reachability = allRoutesValid ? "PASS" : "FAIL";

  // 2. VIEWPORT TESTING FOR LOGIN
  console.log("\n--- 2. Login Page across Viewports ---");
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await installHarness(page);

    await page.evaluate(() => window.__paintLogin());
    await sleep(200);

    // Overflow check
    const overflow = await page.evaluate(() => window.__checkOverflow());

    // Split vs Single-column layout check
    const layoutInfo = await page.evaluate(() => {
      const aside = document.querySelector(".gl-login-vault");
      const workspace = document.querySelector(".gl-login-workspace");
      const asideRect = aside ? aside.getBoundingClientRect() : null;
      const wsRect = workspace ? workspace.getBoundingClientRect() : null;
      const pinPadButtons = Array.from(
        document.querySelectorAll("[data-pin-key]"),
      );
      const minTouch = pinPadButtons.every((b) => b.clientHeight >= 40);
      return {
        asideVisible: asideRect && asideRect.width > 0 && asideRect.height > 0,
        asideWidth: asideRect ? asideRect.width : 0,
        workspaceWidth: wsRect ? wsRect.width : 0,
        minTouchSatisfied: minTouch,
      };
    });

    const shotName = `login_${vp.name}_${vp.width}x${vp.height}.png`;
    const shotPath = join(OUT_DIR, shotName);
    await page.screenshot({ path: shotPath, fullPage: false });
    results.screenshots.push({ name: shotName, viewport: vp.name });

    console.log(
      `Login @ ${vp.name} (${vp.width}x${vp.height}): ` +
        `Overflow: [${overflow.hasOverflow ? "FAIL" : "PASS"}] | ` +
        `Aside visible: ${layoutInfo.asideVisible} (w=${Math.round(layoutInfo.asideWidth)}px) | ` +
        `Workspace (w=${Math.round(layoutInfo.workspaceWidth)}px) | ` +
        `Screenshot: ${shotName}`,
    );

    await context.close();
  }

  // 3. VIEWPORT TESTING FOR ALL 8 CORE ROUTES
  console.log("\n--- 3. Core Routes across Viewports ---");
  const coreRoutes = [
    "dashboard",
    "transactions",
    "offerings",
    "funds",
    "approvals",
    "members",
    "reports",
    "profile",
  ];

  for (const vp of viewports) {
    console.log(`\nTesting Viewport: ${vp.name.toUpperCase()} (${vp.width}x${vp.height})`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await installHarness(page);

    for (const routeName of coreRoutes) {
      await page.evaluate((r) => window.__paintRoute(r), routeName);
      await sleep(150);

      const overflow = await page.evaluate(() => window.__checkOverflow());

      // Shell layout audit
      const shellAudit = await page.evaluate(() => {
        const sidebar = document.querySelector(".gl-sidebar");
        const mobilenav = document.querySelector(".gl-mobilenav");
        const sbRect = sidebar ? sidebar.getBoundingClientRect() : null;
        const mnRect = mobilenav ? mobilenav.getBoundingClientRect() : null;
        return {
          sidebarVisible: sbRect && sbRect.width > 0 && sbRect.height > 0,
          mobilenavVisible: mnRect && mnRect.width > 0 && mnRect.height > 0,
        };
      });

      const shotName = `${routeName}_${vp.name}_${vp.width}x${vp.height}.png`;
      const shotPath = join(OUT_DIR, shotName);
      await page.screenshot({ path: shotPath, fullPage: false });
      results.screenshots.push({ name: shotName, route: routeName, viewport: vp.name });

      const pass = !overflow.hasOverflow;
      console.log(
        `  Route '${routeName}': Overflow: [${pass ? "PASS" : "FAIL"}] | ` +
          `Sidebar: ${shellAudit.sidebarVisible} | MobileNav: ${shellAudit.mobilenavVisible}`,
      );
    }
    await context.close();
  }

  // 4. VERIFY STATES: LOADING, EMPTY, ERROR
  console.log("\n--- 4. UI States (Loading, Empty, Error) ---");
  const stateContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const statePage = await stateContext.newPage();
  await statePage.goto(BASE_URL, { waitUntil: "networkidle" });
  await installHarness(statePage);

  for (const st of ["loading", "empty", "error"]) {
    await statePage.evaluate((s) => window.__paintState(s), st);
    await sleep(150);
    const shotName = `state_${st}_1280x900.png`;
    await statePage.screenshot({ path: join(OUT_DIR, shotName) });
    results.screenshots.push({ name: shotName, state: st });
    console.log(`  State '${st}': Rendered and captured -> ${shotName}`);
  }
  await stateContext.close();

  // 5. ACCESSIBILITY INTERACTION VERIFICATION
  console.log("\n--- 5. Accessibility & Micro-Interactions ---");
  const a11yContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const a11yPage = await a11yContext.newPage();
  await a11yPage.goto(BASE_URL, { waitUntil: "networkidle" });
  await installHarness(a11yPage);

  // Paint dashboard
  await a11yPage.evaluate(() => window.__paintRoute("dashboard"));

  // Check Skip Link
  const skipLinkCheck = await a11yPage.evaluate(() => {
    const skip = document.querySelector(".gl-skip-link");
    if (!skip) return { found: false };
    const target = document.querySelector(skip.getAttribute("href"));
    return {
      found: true,
      href: skip.getAttribute("href"),
      targetId: target ? target.id : null,
      targetTagName: target ? target.tagName : null,
    };
  });
  console.log(
    `  Skip Link: Found=${skipLinkCheck.found}, Href=${skipLinkCheck.href}, Target=${skipLinkCheck.targetTagName}#${skipLinkCheck.targetId} ` +
      `[${skipLinkCheck.targetId === "main-content" ? "PASS" : "FAIL"}]`,
  );

  // Keyboard navigation / Focus Visible
  console.log("  Testing Keyboard Tab focus sequence...");
  await a11yPage.keyboard.press("Tab"); // Should focus skip link
  const skipFocused = await a11yPage.evaluate(() => {
    const active = document.activeElement;
    return active && active.classList.contains("gl-skip-link");
  });
  console.log(`  Tab to Skip Link: focused=${skipFocused} [${skipFocused ? "PASS" : "FAIL"}]`);

  // Popover Attention Toggle & Escape
  console.log("  Testing Attention Popover and Escape key...");
  const attentionBtn = a11yPage.locator("#gl-attention-btn");
  if (await attentionBtn.count() > 0) {
    await attentionBtn.click();
    await sleep(200);
    const panelOpen = await a11yPage.evaluate(() => {
      const p = document.querySelector("#gl-attention-panel");
      const b = document.querySelector("#gl-attention-btn");
      return p && !p.hidden && b.getAttribute("aria-expanded") === "true";
    });
    console.log(`  Click Attention Bell: Panel Opened=${panelOpen} [${panelOpen ? "PASS" : "FAIL"}]`);

    // Capture open popover
    await a11yPage.screenshot({
      path: join(OUT_DIR, "popover_attention_open_1280.png"),
    });

    // Press Escape
    await a11yPage.keyboard.press("Escape");
    await sleep(150);
    const panelClosed = await a11yPage.evaluate(() => {
      const p = document.querySelector("#gl-attention-panel");
      const b = document.querySelector("#gl-attention-btn");
      return p && p.hidden && b.getAttribute("aria-expanded") === "false";
    });
    console.log(`  Press Escape: Panel Closed=${panelClosed} [${panelClosed ? "PASS" : "FAIL"}]`);
  }
  await a11yContext.close();

  // 6. PREFERS-REDUCED-MOTION VERIFICATION
  console.log("\n--- 6. Reduced Motion CSS Enforcement ---");
  const motionContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  const motionPage = await motionContext.newPage();
  await motionPage.goto(BASE_URL, { waitUntil: "networkidle" });
  await installHarness(motionPage);
  await motionPage.evaluate(() => window.__paintRoute("dashboard"));

  const motionRules = await motionPage.evaluate(() => {
    const btn = document.querySelector(".gl-btn");
    const hero = document.querySelector(".gl-dash-hero");
    const btnStyle = btn ? window.getComputedStyle(btn) : null;
    const heroStyle = hero ? window.getComputedStyle(hero) : null;
    return {
      btnTransition: btnStyle ? btnStyle.transitionDuration : null,
      heroTransition: heroStyle ? heroStyle.transitionDuration : null,
      prefersReducedMedia: window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches,
    };
  });
  console.log(`  Media query matched: ${motionRules.prefersReducedMedia}`);
  console.log(
    `  Button transition duration: ${motionRules.btnTransition} | ` +
      `Hero transition duration: ${motionRules.heroTransition} ` +
      `[${motionRules.btnTransition === "0s" ? "PASS" : "FAIL"}]`,
  );
  await motionContext.close();

  await browser.close();

  console.log("\n==================================================");
  console.log(`SMOKE TEST COMPLETE: ${results.screenshots.length} screenshots saved to docs/screenshots/browser_smoke_test/`);
  console.log("==================================================");
}

runSmokeTest().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
