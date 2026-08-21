import React from "react";
const ICONS = {
  draft: "✎", pending: "◷", approved: "✓", rejected: "✕", voided: "⊘",
};
const CONFIG = {
  draft: { color: "var(--muted-foreground)" },
  pending: { color: "var(--warning)" },
  approved: { color: "var(--success)" },
  rejected: { color: "var(--destructive)" },
  voided: { color: "var(--muted-foreground)", strike: true },
};
const LABEL = { draft: "ร่าง", pending: "รออนุมัติ", approved: "อนุมัติแล้ว", rejected: "ปฏิเสธ", voided: "ยกเลิก" };
export function StatusBadge({ status = "draft", showIcon = true }) {
  const c = CONFIG[status] || CONFIG.draft;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px", borderRadius: "var(--radius-full)",
      padding: "2px 10px", fontSize: "var(--text-xs)", fontWeight: 600, fontFamily: "var(--font-sans)",
      color: c.color, border: `1px solid ${c.color}`, textDecoration: c.strike ? "line-through" : "none",
      opacity: c.strike ? 0.7 : 1,
    }}>
      {showIcon && <span aria-hidden style={{ fontSize: "10px" }}>{ICONS[status]}</span>}
      {LABEL[status]}
    </span>
  );
}
