export interface StatusBadgeProps {
  status: "draft" | "pending" | "approved" | "rejected" | "voided";
  /** Show a small glyph next to the label (default true) — color alone is never sufficient */
  showIcon?: boolean;
}
