/**
 * Dev-only screen harness.
 *
 * The app's real screens read from Supabase, and there are environments —
 * preview sandboxes, offline machines, anywhere outside the Edge Functions'
 * CORS allowlist — where that backend simply cannot be reached. This entry
 * point renders the same production components against fixed sample data so a
 * screen can still be looked at and reviewed.
 *
 * It is a SEPARATE Vite entry (preview.html) and is never imported by
 * src/main.ts, so nothing here can reach the shipped application bundle. No
 * service is constructed, no query runs, no session exists.
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { renderAppShellHtml, AppShellUser } from "../components/layout/AppShell";
import { DashboardPage, DashboardData } from "../pages/DashboardPage";
import type { AttentionSummary } from "../services/attention-service";
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

function render(): void {
  const root = document.getElementById("app");
  if (!root) return;

  const dashboard = new DashboardPage(NO_CLIENT);
  root.innerHTML = renderAppShellHtml(
    { activeRoute: "/", user: USER, attention: ATTENTION },
    dashboard.renderHtml(DASHBOARD, USER, ATTENTION),
  );
}

render();
