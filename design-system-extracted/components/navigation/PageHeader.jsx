import React from "react";
export function PageHeader({ kicker, title, description, actions }) {
  return (
    <header style={{ marginBottom: "24px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", paddingBottom: "20px" }}>
        <div style={{ minWidth: 0 }}>
          {kicker && (
            <p className="kicker" style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "var(--primary)" }} />
              {kicker}
            </p>
          )}
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--foreground)" }}>{title}</h1>
          {description && <p style={{ margin: "8px 0 0", maxWidth: "560px", fontSize: "var(--text-sm)", lineHeight: 1.6, color: "var(--muted-foreground)" }}>{description}</p>}
        </div>
        {actions && <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>{actions}</div>}
      </div>
      <div style={{ height: "1px", width: "100%", background: "var(--border)" }} />
    </header>
  );
}
