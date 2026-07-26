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
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

// Primary navigation — simplified for AI Expense Tracker UX
export const NAV: NavItem[] = [
  { to: "/dashboard", label: "หน้าแรก", icon: LayoutDashboard },
  { to: "/expense", label: "รายจ่าย", icon: ArrowUpCircle },
  { to: "/income", label: "รายรับ", icon: ArrowDownCircle },
  { to: "/reports", label: "รายงาน", icon: FileBarChart2 },
  { to: "/line-setup", label: "LINE", icon: MessageCircle },
  { to: "/settings", label: "ตั้งค่า", icon: Settings },
];

// Secondary nav — still accessible via sidebar but not primary
export const NAV_SECONDARY: NavItem[] = [
  { to: "/offering", label: "เงินถวาย", icon: HandHeart },
  { to: "/funds", label: "กองทุน", icon: Wallet },
  { to: "/members", label: "สมาชิก", icon: Users },
  { to: "/reconciliation", label: "กระทบยอด", icon: FileSpreadsheet },
];

export const MOBILE_NAV: NavItem[] = [NAV[0], NAV[1], NAV[2], NAV[3]];

export function useCurrentPath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

export { Link };
