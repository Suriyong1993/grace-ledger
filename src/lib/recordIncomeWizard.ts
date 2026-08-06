import {
  HandHeart,
  Gift,
  Percent,
  MoreHorizontal,
  Wallet,
  Landmark,
  QrCode,
  type LucideIcon,
} from "lucide-react";

/**
 * Shared types/constants for the Record Income wizard (FS-002–FS-005).
 * Sprint 2 HTML prototype — see .claude/sprint-2-instructions.md.
 */

export type IncomeCategory = "sunday-offering" | "special-offering" | "tithe" | "other";

export interface IncomeCategoryOption {
  value: IncomeCategory;
  label: string;
  icon: LucideIcon;
}

export const INCOME_CATEGORY_OPTIONS: IncomeCategoryOption[] = [
  { value: "sunday-offering", label: "ถวายวันอาทิตย์", icon: HandHeart },
  { value: "special-offering", label: "ถวายพิเศษ", icon: Gift },
  { value: "tithe", label: "สิบลด", icon: Percent },
  { value: "other", label: "อื่นๆ", icon: MoreHorizontal },
];

export const INCOME_CATEGORY_LABEL: Record<IncomeCategory, string> = {
  "sunday-offering": "ถวายวันอาทิตย์",
  "special-offering": "ถวายพิเศษ",
  tithe: "สิบลด",
  other: "อื่นๆ",
};

export const WIZARD_STEP_LABELS = ["หมวดหมู่", "จำนวนเงิน", "ช่องทาง", "ตรวจสอบ"];

export function isIncomeCategory(value: unknown): value is IncomeCategory {
  return (
    value === "sunday-offering" ||
    value === "special-offering" ||
    value === "tithe" ||
    value === "other"
  );
}

export type IncomeDestination = "cash" | "bank" | "qr";

export interface IncomeDestinationOption {
  value: IncomeDestination;
  label: string;
  icon: LucideIcon;
}

export const INCOME_DESTINATION_OPTIONS: IncomeDestinationOption[] = [
  { value: "cash", label: "เงินสดสดใส", icon: Wallet },
  { value: "bank", label: "บัญชีธนาคารคริสตจักร", icon: Landmark },
  { value: "qr", label: "สแกน QR PromptPay", icon: QrCode },
];

export function isIncomeDestination(value: unknown): value is IncomeDestination {
  return value === "cash" || value === "bank" || value === "qr";
}
