/**
 * Dev-only screen harness.
 *
 * The app's real screens read from Supabase, and there are environments —
 * preview sandboxes, offline machines, anywhere outside the Edge Functions'
 * CORS allowlist — where that backend simply cannot be reached. This entry
 * point renders the same production components against fixed sample data so
 * the screens can still be looked at and reviewed.
 *
 * It is a SEPARATE Vite entry (preview.html) and is never imported by
 * src/main.ts, so nothing here can reach the shipped application bundle. No
 * service is constructed, no query runs, no session exists.
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { renderAppShellHtml, AppShellUser } from "../components/layout/AppShell";
import { DashboardPage, DashboardData } from "../pages/DashboardPage";
import { renderApprovalsQueueViewHtml } from "../components/approvals/ApprovalsQueueView";
import { renderOfferingSessionListHtml } from "../components/offering/OfferingSessionList";
import type { AttentionSummary } from "../services/attention-service";
import type { PendingApprovalItem } from "../lib/transactions/types";
import type { OfferingSession } from "../lib/offering/types";
import { Money } from "../lib/money";
import "../styles/app.css";

/** renderHtml() never touches the client, so a null stub is enough. */
const NO_CLIENT = null as unknown as SupabaseClient;

const USER: AppShellUser = {
  name: "อาจารย์สรรเสริญ ดวงจิตร",
  role: "pastor",
  initials: "สด",
  churchName: "คริสตจักรเกรซแบ๊บติสต์",
};

const ATTENTION: AttentionSummary = {
  totalCount: 3,
  loadFailed: false,
  groups: [
    {
      key: "approvals",
      label: "รออนุมัติ",
      href: "#/approvals",
      summary: "คำขอเบิกจ่าย 2 รายการรอการพิจารณาจากคุณ · เก่าสุด 2 วัน",
      count: 2,
      requiresAction: true,
      items: [
        {
          id: "tx-1",
          title: "ซื้ออุปกรณ์ระบบเสียงห้องเยาวชน",
          meta: "฿8,500.00 · นรินทร์ สมหวัง · 21 ส.ค. 2569",
          href: "#/approvals",
        },
        {
          id: "tx-2",
          title: "ค่าไฟฟ้าและสาธารณูปโภคประจำเดือน",
          meta: "฿4,280.00 · สุดารัตน์ จิณเซ่ง · 20 ส.ค. 2569",
          href: "#/approvals",
        },
      ],
    },
    {
      key: "offerings",
      label: "เงินถวายวันอาทิตย์",
      href: "#/offerings",
      summary: "รอบนมัสการล่าสุดมีผลต่างเงินสดรอดำเนินการ",
      count: 1,
      requiresAction: true,
      items: [
        {
          id: "s-1",
          title: "รอบนมัสการวันอาทิตย์ (เช้า)",
          meta: "มีผลต่างรอดำเนินการ · ขาด ฿50.00 · 23 ส.ค. 2569",
          href: "#/offerings",
        },
      ],
    },
  ],
};

const DASHBOARD: DashboardData = {
  pendingApprovalsCount: 2,
  totalFundsBalance: "฿248,560.00",
  monthlyIncome: "฿18,450.00",
  monthlyExpense: "฿12,820.00",
  activeAccountsCount: 3,
  funds: [
    { id: "f1", name: "กองทุนทั่วไป", balance: Money.from("128450.00") },
    { id: "f2", name: "กองทุนพันธกิจ", balance: Money.from("42300.00") },
    {
      id: "f3",
      name: "กองทุนอาคารและสถานที่",
      balance: Money.from("65800.00"),
      targetAmount: Money.from("100000.00"),
    },
    {
      id: "f4",
      name: "กองทุนเยาวชนและการศึกษา",
      balance: Money.from("12010.00"),
    },
  ],
  recentTransactions: [
    {
      id: "rec-1",
      title: "เงินถวายวันอาทิตย์",
      subtitle: "กองทุนทั่วไป · เงินสด",
      amount: Money.from("18450.00"),
      direction: "income",
      date: "วันนี้",
      status: "approved",
    },
    {
      id: "rec-2",
      title: "ค่าไฟฟ้าและสาธารณูปโภค",
      subtitle: "กองทุนทั่วไป · โอนเงิน",
      amount: Money.from("4280.00"),
      direction: "expense",
      date: "เมื่อวาน",
      status: "approved",
    },
    {
      id: "rec-3",
      title: "ซื้ออุปกรณ์ห้องเรียนเยาวชน",
      subtitle: "กองทุนเยาวชนและการศึกษา · โอนเงิน",
      amount: Money.from("8500.00"),
      direction: "expense",
      date: "14 ส.ค. 2569",
      status: "pending",
    },
    {
      id: "rec-4",
      title: "โอนเข้ากองทุนอาคาร",
      subtitle: "กองทุนทั่วไป → กองทุนอาคารและสถานที่",
      amount: Money.from("15000.00"),
      direction: "transfer",
      date: "12 ส.ค. 2569",
      status: "approved",
    },
  ],
  historicalTrend: [
    {
      monthName: "พ.ค.",
      income: "฿21,300.00",
      expense: "฿14,100.00",
      net: "+฿7,200.00",
      isPositive: true,
      incomeSatang: 2130000,
      expenseSatang: 1410000,
    },
    {
      monthName: "มิ.ย.",
      income: "฿19,800.00",
      expense: "฿16,450.00",
      net: "+฿3,350.00",
      isPositive: true,
      incomeSatang: 1980000,
      expenseSatang: 1645000,
    },
    {
      monthName: "ก.ค.",
      income: "฿17,200.00",
      expense: "฿18,900.00",
      net: "−฿1,700.00",
      isPositive: false,
      incomeSatang: 1720000,
      expenseSatang: 1890000,
    },
    {
      monthName: "ส.ค.",
      income: "฿18,450.00",
      expense: "฿12,820.00",
      net: "+฿5,630.00",
      isPositive: true,
      incomeSatang: 1845000,
      expenseSatang: 1282000,
      isPartial: true,
    },
  ],
};

const PENDING_APPROVALS: PendingApprovalItem[] = [
  {
    id: "tx-1",
    churchId: "c-1",
    accountId: "a-1",
    accountName: "ธนาคารกรุงไทย ···4821",
    amount: Money.from("8500.00"),
    direction: "expense",
    status: "pending_approval",
    description: "ซื้ออุปกรณ์ระบบเสียงห้องเยาวชน",
    referenceNumber: "EXP-0248",
    createdBy: "u-creator",
    creatorName: "นรินทร์ สมหวัง",
    creatorInitials: "นส",
    createdAt: "2026-08-21T09:30:00Z",
    hasReceipt: true,
    splits: [
      {
        churchId: "c-1",
        fundId: "f-4",
        fundName: "กองทุนเยาวชนและการศึกษา",
        fundBalance: Money.from("12010.00"),
        amount: Money.from("8500.00"),
      },
    ],
    isCreator: false,
  },
  {
    id: "tx-2",
    churchId: "c-1",
    accountId: "a-1",
    accountName: "ธนาคารกรุงไทย ···4821",
    amount: Money.from("4280.00"),
    direction: "expense",
    status: "pending_approval",
    description: "ค่าไฟฟ้าและสาธารณูปโภคประจำเดือน",
    referenceNumber: "EXP-0247",
    createdBy: "u-creator2",
    creatorName: "สุดารัตน์ จิณเซ่ง",
    creatorInitials: "สจ",
    createdAt: "2026-08-20T11:30:00Z",
    hasReceipt: true,
    splits: [
      {
        churchId: "c-1",
        fundId: "f-1",
        fundName: "กองทุนทั่วไป",
        fundBalance: Money.from("128450.00"),
        amount: Money.from("4280.00"),
      },
    ],
    isCreator: false,
  },
];

const OFFERING_SESSIONS: OfferingSession[] = [
  {
    id: "1e72b32c-aaaa-bbbb-cccc-dddddddddddd",
    churchId: "c1",
    serviceDate: "2026-08-23",
    serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
    status: "variance_review",
    expectedCashAmount: Money.from("10000"),
    expectedTransferAmount: Money.from("5000"),
    expectedQrAmount: Money.from("3450"),
    expectedTotalAmount: Money.from("18450"),
    countedCashAmount: Money.from("9950"),
    cashVarianceAmount: Money.from("-50"),
    varianceStatus: "variance_detected",
    creatorName: "อาจารย์ ทัศนา ดวงจิตร",
    createdAt: "2026-08-23",
  },
  {
    id: "2e72b32c-aaaa-bbbb-cccc-dddddddddddd",
    churchId: "c1",
    serviceDate: "2026-08-16",
    serviceName: "รอบนมัสการวันอาทิตย์ (เช้า)",
    status: "posted",
    expectedCashAmount: Money.from("12000"),
    expectedTransferAmount: Money.from("6000"),
    expectedQrAmount: Money.from("4200"),
    expectedTotalAmount: Money.from("22200"),
    countedCashAmount: Money.from("12000"),
    cashVarianceAmount: Money.from("0"),
    varianceStatus: "zero_match",
    creatorName: "อาจารย์ ทัศนา ดวงจิตร",
    createdAt: "2026-08-16",
  },
];

interface Screen {
  id: string;
  label: string;
  route: string;
  render: () => string;
}

const SCREENS: Screen[] = [
  {
    id: "dashboard",
    label: "หน้าหลัก",
    route: "/",
    render: () =>
      new DashboardPage(NO_CLIENT).renderHtml(DASHBOARD, USER, ATTENTION),
  },
  {
    id: "approvals",
    label: "คิวอนุมัติ",
    route: "/approvals",
    render: () =>
      `<div class="gl-page">${renderApprovalsQueueViewHtml({
        items: PENDING_APPROVALS,
      })}</div>`,
  },
  {
    id: "offerings",
    label: "เงินถวาย",
    route: "/offerings",
    render: () =>
      renderOfferingSessionListHtml({
        sessions: OFFERING_SESSIONS,
        isLoading: false,
        errorMessage: null,
      }),
  },
  {
    id: "dashboard-empty",
    label: "หน้าหลัก (ยังไม่มีข้อมูล)",
    route: "/",
    render: () =>
      new DashboardPage(NO_CLIENT).renderHtml(
        {
          pendingApprovalsCount: 0,
          totalFundsBalance: "฿0.00",
          monthlyIncome: "฿0.00",
          monthlyExpense: "฿0.00",
          activeAccountsCount: 0,
          funds: [],
          recentTransactions: [],
          historicalTrend: [],
        },
        USER,
        { groups: [], totalCount: 0, loadFailed: false },
      ),
  },
];

function currentScreen(): Screen {
  const wanted = window.location.hash.replace(/^#/, "");
  return SCREENS.find((screen) => screen.id === wanted) ?? SCREENS[0]!;
}

function renderSwitcher(active: Screen): void {
  const bar = document.getElementById("preview-screens");
  if (!bar) return;
  bar.innerHTML = SCREENS.map(
    (screen) =>
      `<button type="button" data-screen="${screen.id}" aria-pressed="${
        screen.id === active.id
      }">${screen.label}</button>`,
  ).join("");

  bar.querySelectorAll<HTMLButtonElement>("[data-screen]").forEach((button) => {
    button.addEventListener("click", () => {
      window.location.hash = button.dataset.screen ?? "";
    });
  });
}

function render(): void {
  const root = document.getElementById("app");
  if (!root) return;

  const screen = currentScreen();
  renderSwitcher(screen);
  root.innerHTML = renderAppShellHtml(
    { activeRoute: screen.route, user: USER, attention: ATTENTION },
    screen.render(),
  );
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", render);
render();
