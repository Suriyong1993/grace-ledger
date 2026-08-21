export interface StatCardProps {
  label: string;
  /** Pre-formatted display value, e.g. "฿128,450.00" */
  value: string;
  hint?: string;
  tone?: "primary" | "secondary" | "success" | "danger" | "warning";
  /** Percent change — renders a ▲/▼ chip; omit rather than show 0 */
  trend?: number;
}
