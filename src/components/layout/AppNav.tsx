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
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { to: "/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { to: "/income", label: "รายรับ", icon: ArrowDownCircle },
  { to: "/expense", label: "รายจ่าย", icon: ArrowUpCircle },
  { to: "/offering", label: "เงินถวาย", icon: HandHeart },
  { to: "/funds", label: "กองทุน", icon: Wallet },
  { to: "/budget", label: "งบประมาณ", icon: PiggyBank },
  { to: "/projects", label: "โครงการ", icon: Briefcase },
  { to: "/members", label: "สมาชิก", icon: Users },
  { to: "/reports", label: "รายงาน", icon: FileBarChart2 },
  { to: "/audit", label: "Audit Logs", icon: ScrollText },
  { to: "/settings", label: "ตั้งค่า", icon: Settings },
  { to: "/profile", label: "โปรไฟล์", icon: UserCircle2 },
];

export const MOBILE_NAV: NavItem[] = [
  NAV[0], NAV[1], NAV[2], NAV[3],
];

export function useCurrentPath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

export { Link };