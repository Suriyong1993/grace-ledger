import React from "react";
const TONE = {
  primary: { value: "var(--primary)", bar: "var(--primary)" },
  secondary: { value: "var(--foreground)", bar: "var(--border)" },
  success: { value: "var(--success)", bar: "var(--success)" },
  danger: { value: "var(--destructive)", bar: "var(--destructive)" },
  warning: { value: "var(--warning)", bar: "var(--warning)" },
};
export function StatCard({ label, value, hint, tone = "secondary", trend }) {
  const t = TONE[tone] || TONE.secondary;
  return (
    <div style={{ display: "flex", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", background: "var(--card)", boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
      <div style={{ width: "3px", background: t.bar, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: "18px 20px" }}>
        <p className="kicker" style={{ margin: 0 }}>{label}</p>
        <p className="num-display" style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 700, lineHeight: 1, color: t.value }}>{value}</p>
        {(hint || typeof trend === "number") && (
          <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid color-mix(in oklch, var(--border) 60%, transparent)", display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--text-2xs)", color: "var(--muted-foreground)" }}>
            {typeof trend === "number" && (
              <span className="num-display" style={{ display: "inline-flex", alignItems: "center", gap: "3px", borderRadius: "var(--radius-full)", border: `1px solid ${trend >= 0 ? "var(--success)" : "var(--destructive)"}`, color: trend >= 0 ? "var(--success)" : "var(--destructive)", padding: "1px 6px", fontWeight: 700 }}>
                {trend >= 0 ? "▲" : "▼"}{trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
              </span>
            )}
            {hint && <span>{hint}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
