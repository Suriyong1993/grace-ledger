import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  HandHeart,
  Wallet,
  PiggyBank,
  Briefcase,
  Users,
  FileBarChart2,
  ScrollText,
  Settings,
  UserCircle2,
  FileSpreadsheet,
  MessageCircle,
  CheckCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Grouped primary navigation — mirrors how the church actually works
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "ภาพรวม",
    items: [
      { to: "/staff", label: "หน้าแรกเจ้าหน้าที่", icon: LayoutGrid },
      { to: "/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
    ],
  },
  {
    label: "รายการเงิน",
    items: [
      { to: "/income", label: "รายรับ", icon: ArrowDownCircle },
      { to: "/expense", label: "รายจ่าย", icon: ArrowUpCircle },
      { to: "/offering", label: "เงินถวาย", icon: HandHeart },
    ],
  },
  {
    label: "กองทุน & งบประมาณ",
    items: [
      { to: "/funds", label: "กองทุน", icon: Wallet },
      { to: "/projects", label: "โครงการ", icon: Briefcase },
      { to: "/budget", label: "งบประมาณ", icon: PiggyBank },
    ],
  },
  {
    label: "องค์กร",
    items: [
      { to: "/members", label: "สมาชิก", icon: Users },
      { to: "/approvals", label: "อนุมัติ", icon: CheckCheck },
      { to: "/reports", label: "รายงาน", icon: FileBarChart2 },
      { to: "/reconciliation", label: "กระทบยอด", icon: FileSpreadsheet },
      { to: "/audit", label: "บันทึกตรวจสอบ", icon: ScrollText },
    ],
  },
];

export const NAV_SYSTEM: NavItem[] = [
  { to: "/ai", label: "Grace AI", icon: Sparkles },
  { to: "/line-setup", label: "LINE", icon: MessageCircle },
  { to: "/settings", label: "หมวดหมู่เงินถวาย", icon: Settings },
  { to: "/profile", label: "โปรไฟล์", icon: UserCircle2 },
];

// Flat list — used by mobile sheet & command palette
export const NAV: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), ...NAV_SYSTEM];

// Legacy export kept for compatibility
export const NAV_SECONDARY: NavItem[] = [];

export const MOBILE_NAV: NavItem[] = [
  NAV_GROUPS[0].items[0], // แดชบอร์ด
  NAV_GROUPS[1].items[0], // รายรับ
  NAV_GROUPS[1].items[1], // รายจ่าย
  NAV_GROUPS[3].items[1], // รายงาน
];

export function useCurrentPath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

export { Link };
