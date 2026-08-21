import React from "react";
export function EmptyState({ title, description, action }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
      borderRadius: "var(--radius-card)", border: "1px dashed var(--border)",
      background: "color-mix(in oklch, var(--card) 30%, transparent)", padding: "64px 32px", textAlign: "center",
    }}>
      <div style={{ position: "relative", width: "56px", height: "56px", display: "grid", placeItems: "center" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "12px", border: "1px solid color-mix(in oklch, var(--border) 40%, transparent)", background: "color-mix(in oklch, var(--muted) 40%, transparent)" }} />
        <span style={{ position: "relative", fontSize: "20px", color: "color-mix(in oklch, var(--muted-foreground) 40%, transparent)" }}>▢</span>
      </div>
      <div style={{ maxWidth: "280px" }}>
        <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-base)", fontWeight: 600, color: "var(--foreground)" }}>{title}</h3>
        {description && <p style={{ margin: "6px 0 0", fontSize: "var(--text-xs)", lineHeight: 1.6, color: "var(--muted-foreground)" }}>{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
