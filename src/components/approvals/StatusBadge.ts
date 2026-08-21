import { TransactionStatus } from "../../lib/transactions/types";

export interface StatusBadgeProps {
  status: TransactionStatus;
  className?: string;
}

/**
 * Status colour has fixed meaning and the text always sits on the `-muted`
 * surface, so it uses the `--on-*-muted` text tokens — never `--*-foreground`,
 * which is near-white and is meant for text on the solid colour.
 */
export const STATUS_CONFIG: Record<
  TransactionStatus,
  { label: string; variant: string }
> = {
  draft: { label: "ฉบับร่าง", variant: "neutral" },
  pending_approval: { label: "รออนุมัติ", variant: "pending" },
  approved: { label: "อนุมัติแล้ว", variant: "approved" },
  posted: { label: "บันทึกบัญชีแล้ว", variant: "info" },
  rejected: { label: "ปฏิเสธ", variant: "rejected" },
  voided: { label: "ยกเลิกแล้ว", variant: "neutral" },
};

export function renderStatusBadgeHtml(props: StatusBadgeProps): string {
  const config = STATUS_CONFIG[props.status] || STATUS_CONFIG.draft;
  const extra = props.className ? ` ${props.className}` : "";
  return `<span class="gl-badge gl-badge--${config.variant}${extra}">${config.label}</span>`;
}
