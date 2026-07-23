import { Link, useRouterState } from "@tanstack/react-router";
import {
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
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { to: "/dashboard", label: "ภาพรวม (แดชบอร์ด)", icon: LayoutDashboard },
  { to: "/offering", label: "บันทึกเงินถวายวันอาทิตย์", icon: HandHeart },
  { to: "/expense", label: "บันทึกรายจ่าย", icon: ArrowUpCircle },
  { to: "/members", label: "รายชื่อสมาชิก", icon: Users },
  { to: "/funds", label: "กองทุน & บัญชีธนาคาร", icon: Wallet },
  { to: "/reports", label: "รายงานสรุปการเงิน", icon: FileBarChart2 },
  { to: "/reconciliation", label: "กระทบยอดเงินสด", icon: FileSpreadsheet },
  { to: "/settings", label: "ตั้งค่าระบบ", icon: Settings },
];

export const MOBILE_NAV: NavItem[] = [NAV[0], NAV[1], NAV[2], NAV[5]];

export function useCurrentPath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

export { Link };
