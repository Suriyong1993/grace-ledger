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
import { FundsPage, FundDetail } from "../pages/FundsPage";
import { MembersPage, MemberRecord } from "../pages/MembersPage";
import { TransactionsPage, TransactionItem } from "../pages/TransactionsPage";
import { ApprovalsPage } from "../pages/ApprovalsPage";
import { OfferingPage } from "../pages/OfferingPage";
import { ReportsPage } from "../pages/ReportsPage";
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

const FUNDS: FundDetail[] = [
  {
    id: "fund-1",
    name: "กองทุนทั่วไป",
    description: "ค่าใช้จ่ายประจำของคริสตจักร",
    balance: Money.from(184320),
    targetAmount: null,
    percentageUsed: null,
    recentActivity: [
      {
        description: "ถวายวันอาทิตย์",
        amount: "฿18,450.00",
        date: "6 ก.ย. 2026",
        type: "in",
      },
      {
        description: "ค่าไฟฟ้าเดือนสิงหาคม",
        amount: "฿4,820.00",
        date: "3 ก.ย. 2026",
        type: "out",
      },
    ],
  },
  {
    id: "fund-2",
    name: "กองทุนอาคาร",
    description: "เพื่อการก่อสร้างและซ่อมบำรุงอาคาร",
    balance: Money.from(52400),
    targetAmount: Money.from(200000),
    percentageUsed: 26,
    recentActivity: [
      {
        description: "ถวายเจาะจงกองทุนอาคาร",
        amount: "฿12,000.00",
        date: "6 ก.ย. 2026",
        type: "in",
      },
    ],
  },
  {
    id: "fund-3",
    name: "กองทุนพันธกิจ",
    description: "สนับสนุนงานมิชชันและการประกาศ",
    balance: Money.from(11840),
    targetAmount: Money.from(50000),
    percentageUsed: 23,
    recentActivity: [],
  },
];

const MEMBERS: MemberRecord[] = [
  {
    id: "member-1",
    code: "M-0001",
    name: "สมชาย ใจดี",
    email: "somchai@example.com",
    phone: "081-234-5678",
    group: "ผู้ใหญ่",
  },
  {
    id: "member-2",
    code: "M-0002",
    name: "วรรณา รักธรรม",
    email: "wanna@example.com",
    phone: "089-876-5432",
    group: "สตรี",
  },
  {
    id: "member-3",
    code: "M-0003",
    name: "กิตติพงษ์ มานะกิจ",
    email: "kittipong@example.com",
    phone: "062-111-2233",
    group: "ชาย",
  },
  {
    id: "member-4",
    code: "M-0004",
    name: "ศิริพร แสงทอง",
    email: "siriporn@example.com",
    phone: "091-555-7788",
    group: "เยาวชน",
  },
];

const TRANSACTIONS: TransactionItem[] = [
  {
    id: "txn-1",
    code: "TXN-000128",
    description: "เงินถวายวันอาทิตย์",
    categoryName: "เงินถวาย",
    fundName: "กองทุนทั่วไป",
    accountName: "บัญชีออมทรัพย์หลัก",
    amount: Money.from(18450),
    direction: "income",
    date: new Date().toISOString(),
    dateGroup: "today",
    recordedBy: "สุดารัตน์ จิณเซ่ง",
    status: "posted",
    timeline: [
      { title: "บันทึกรายการ", detail: "สุดารัตน์", status: "done" },
      { title: "อนุมัติแล้ว", detail: "อ.สรรเสริญ", status: "done" },
      { title: "ลงบัญชีแล้ว", detail: "ระบบ", status: "done" },
    ],
  },
  {
    id: "txn-2",
    code: "TXN-000127",
    description: "ค่าไฟฟ้าเดือนสิงหาคม",
    categoryName: "สาธารณูปโภค",
    fundName: "กองทุนทั่วไป",
    accountName: "บัญชีออมทรัพย์หลัก",
    amount: Money.from(4820),
    direction: "expense",
    date: new Date().toISOString(),
    dateGroup: "today",
    recordedBy: "วรรณา รักธรรม",
    status: "pending_approval",
    attachmentName: "ใบเสร็จการไฟฟ้า.pdf",
    attachmentSize: "248 KB",
    timeline: [
      { title: "บันทึกรายการ", detail: "วรรณา", status: "done" },
      { title: "รออนุมัติ", detail: "ยังไม่มีผู้อนุมัติ", status: "active" },
      { title: "ลงบัญชี", detail: "รอขั้นก่อนหน้า", status: "pending" },
    ],
  },
  {
    id: "txn-3",
    code: "TXN-000126",
    description: "ถวายเจาะจงกองทุนอาคาร",
    categoryName: "เงินถวาย",
    fundName: "กองทุนอาคาร",
    accountName: "บัญชีออมทรัพย์หลัก",
    amount: Money.from(12000),
    direction: "income",
    date: new Date(Date.now() - 86400000).toISOString(),
    dateGroup: "yesterday",
    recordedBy: "สุดารัตน์ จิณเซ่ง",
    status: "posted",
    timeline: [
      { title: "บันทึกรายการ", detail: "สุดารัตน์", status: "done" },
      { title: "ลงบัญชีแล้ว", detail: "ระบบ", status: "done" },
    ],
  },
  {
    id: "txn-4",
    code: "TXN-000125",
    description: "ค่าเช่าสถานที่จัดค่ายเยาวชน",
    categoryName: "กิจกรรม",
    fundName: "กองทุนพันธกิจ",
    accountName: "บัญชีออมทรัพย์หลัก",
    amount: Money.from(8500),
    direction: "expense",
    date: new Date(Date.now() - 86400000).toISOString(),
    dateGroup: "yesterday",
    recordedBy: "กิตติพงษ์ มานะกิจ",
    status: "approved",
    timeline: [
      { title: "บันทึกรายการ", detail: "กิตติพงษ์", status: "done" },
      { title: "อนุมัติแล้ว", detail: "อ.สรรเสริญ", status: "done" },
      { title: "ลงบัญชี", detail: "รอดำเนินการ", status: "active" },
    ],
  },
];

/**
 * These pages hold their rows in private state that only loadData() fills,
 * and loadData() needs Supabase. Seeding the field directly is the same
 * approach the unit tests take, and it keeps the sample data here in the
 * dev-only entry rather than adding a production seam to the page.
 */
function seed<T extends object>(page: T, fields: Record<string, unknown>): T {
  Object.assign(page, fields);
  return page;
}

/**
 * Built once, not per render. These pages keep their modal open/closed state
 * on the instance, so a fresh instance each render would throw that state away
 * and the modal would never appear to open.
 */
const FUNDS_PAGE = seed(new FundsPage(NO_CLIENT, "church-abc"), {
  funds: FUNDS,
  isLoading: false,
});

const MEMBERS_PAGE = seed(new MembersPage(NO_CLIENT, "church-abc"), {
  members: MEMBERS,
  isLoading: false,
});

/**
 * Audit fixture only — deliberately hostile data used to prove the list holds
 * up: a description far longer than the column, an amount in the hundreds of
 * millions, and a negative figure. Not representative of real records; it
 * exists so overflow and truncation show up in a capture instead of in
 * production.
 */
const TRANSACTIONS_STRESS: TransactionItem[] = [
  {
    ...TRANSACTIONS[0]!,
    id: "txn-stress-1",
    code: "TXN-999001",
    description:
      "เงินถวายพิเศษสำหรับโครงการก่อสร้างอาคารอเนกประสงค์และศูนย์ฝึกอบรมผู้นำคริสตจักรประจำภูมิภาคภาคเหนือตอนบน ประจำปีงบประมาณ 2569",
    fundName: "กองทุนก่อสร้างอาคารอเนกประสงค์และศูนย์ฝึกอบรมผู้นำ",
    categoryName: "เงินถวายเพื่อการก่อสร้างและพัฒนาอาคารสถานที่",
    recordedBy: "ศาสนาจารย์ ดร. สรรเสริญ ดวงจิตรมงคลชัยวัฒน์",
    amount: Money.from(187654321.55),
  },
  {
    ...TRANSACTIONS[1]!,
    id: "txn-stress-2",
    code: "TXN-999002",
    description: "ปรับปรุงยอดยกมา (รายการติดลบ)",
    amount: Money.from(-45280.75),
    direction: "expense",
  },
  // A long tail, to check grouping and rhythm rather than a two-row list.
  ...Array.from({ length: 24 }, (_, i) => ({
    ...TRANSACTIONS[i % TRANSACTIONS.length]!,
    id: `txn-stress-bulk-${i}`,
    code: `TXN-9990${String(i + 10).padStart(2, "0")}`,
  })),
];

const TRANSACTIONS_PAGE = seed(new TransactionsPage(NO_CLIENT, "church-abc"), {
  transactions: TRANSACTIONS,
  isLoading: false,
});

const APPROVALS_PAGE = seed(new ApprovalsPage(NO_CLIENT, "church-abc", "u-1"), {
  items: PENDING_APPROVALS,
  isLoading: false,
});

/** Same page, parked in its loading state so the skeleton can be captured. */
const TRANSACTIONS_LOADING_PAGE = seed(
  new TransactionsPage(NO_CLIENT, "church-abc"),
  { transactions: [], isLoading: true },
);

/** Same page, fed the hostile fixture above. */
const TRANSACTIONS_STRESS_PAGE = seed(
  new TransactionsPage(NO_CLIENT, "church-abc"),
  { transactions: TRANSACTIONS_STRESS, isLoading: false },
);

const OFFERING_LIST_PAGE = seed(
  new OfferingPage(NO_CLIENT, "church-abc", "u-1"),
  { isLoading: false, mode: "list", sessions: OFFERING_SESSIONS },
);

/**
 * A second instance parked on the detail view. The detail tabs and the
 * counting flow are only reachable once a session is selected, and selecting
 * one goes through the service, so the harness seeds the selection directly.
 */
const OFFERING_DETAIL_PAGE = seed(
  new OfferingPage(NO_CLIENT, "church-abc", "u-1"),
  {
    isLoading: false,
    mode: "detail",
    detailTab: "overview",
    selectedSession: OFFERING_SESSIONS[0],
    profiles: [],
  },
);

/**
 * Reports parked on its error state. Every populated view needs a live
 * statement from Supabase, but the period tabs, the retry control and the
 * error presentation are all real UI worth being able to click.
 */
const REPORTS_PAGE = seed(new ReportsPage(NO_CLIENT, "church-abc"), {
  isLoading: false,
  errorMessage: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ (โหมดตัวอย่าง)",
});

interface Screen {
  id: string;
  label: string;
  route: string;
  render: () => string;
  /**
   * Wire the page's own event listeners after its markup is in the DOM.
   *
   * Without this the harness was markup-only: every button rendered but
   * nothing responded, so anything behind an interaction — the create/transfer
   * modals, the approve confirmation, tab switches — looked frozen. The page
   * instance has to be the *same* one that produced the markup, since that is
   * where the open/closed state lives, so screens that need interaction build
   * their instance once and reuse it across re-renders.
   */
  attach?: (root: HTMLElement, rerender: () => void) => void;
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
    // The full page rather than the queue component alone, so the two-tap
    // approve confirmation and the detail panel are reachable here.
    render: () => APPROVALS_PAGE.renderHtml(USER),
    attach: (root, rerender) =>
      APPROVALS_PAGE.attachEventListeners(root, rerender),
  },
  {
    id: "offerings",
    label: "เงินถวาย",
    route: "/offerings",
    // The real page, not the list component alone: the component cannot reach
    // the detail view, so the tabs and the counting flow were unreachable.
    render: () => OFFERING_LIST_PAGE.renderHtml(),
    attach: (root, rerender) =>
      OFFERING_LIST_PAGE.attachEventListeners(root, rerender),
  },
  {
    id: "offering-detail",
    label: "เงินถวาย (รายละเอียด)",
    route: "/offerings",
    render: () => OFFERING_DETAIL_PAGE.renderHtml(),
    attach: (root, rerender) =>
      OFFERING_DETAIL_PAGE.attachEventListeners(root, rerender),
  },
  {
    id: "transactions",
    label: "รายการเงิน",
    route: "/transactions",
    render: () => TRANSACTIONS_PAGE.renderHtml(USER),
    attach: (root, rerender) =>
      TRANSACTIONS_PAGE.attachEventListeners(root, rerender),
  },
  {
    id: "funds",
    label: "กองทุน",
    route: "/funds",
    render: () => FUNDS_PAGE.renderHtml(),
    attach: (root, rerender) =>
      FUNDS_PAGE.attachEventListeners(root, rerender),
  },
  {
    id: "members",
    label: "สมาชิก",
    route: "/members",
    render: () => MEMBERS_PAGE.renderHtml(),
    attach: (root, rerender) =>
      MEMBERS_PAGE.attachEventListeners(root, rerender),
  },
  {
    id: "reports",
    label: "รายงาน",
    route: "/reports",
    render: () => REPORTS_PAGE.renderHtml(),
    attach: (root, rerender) =>
      REPORTS_PAGE.attachEventListeners(root, rerender),
  },
  {
    id: "transactions-loading",
    label: "รายการเงิน (กำลังโหลด)",
    route: "/transactions",
    render: () => TRANSACTIONS_LOADING_PAGE.renderHtml(USER),
  },
  {
    id: "transactions-stress",
    label: "รายการเงิน (ข้อมูลสุดขีด)",
    route: "/transactions",
    render: () => TRANSACTIONS_STRESS_PAGE.renderHtml(USER),
    attach: (root, rerender) =>
      TRANSACTIONS_STRESS_PAGE.attachEventListeners(root, rerender),
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

  // paint() re-enters itself as the page's onStateChange: opening a modal
  // mutates state on the page instance, so the screen must be redrawn and its
  // listeners re-bound against the new nodes. Without the re-bind, the modal
  // would open once and its close button would be inert.
  const paint = (): void => {
    root.innerHTML = renderAppShellHtml(
      { activeRoute: screen.route, user: USER, attention: ATTENTION },
      screen.render(),
    );
    screen.attach?.(root, paint);
  };

  paint();
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", render);
render();
