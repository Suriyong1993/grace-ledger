import React from "react";
export function Dialog({ open, title, description, children, footer, onClose }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", background: "rgb(0 0 0 / 0.4)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(480px, 92vw)", borderRadius: "var(--radius-dialog)", background: "var(--background)",
        border: "1px solid var(--border)", boxShadow: "var(--shadow-elevated)", padding: "24px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", fontWeight: 600 }}>{title}</h2>
            {description && <p style={{ margin: "6px 0 0", fontSize: "var(--text-xs)", color: "var(--muted-foreground)" }}>{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "16px", color: "var(--muted-foreground)", padding: "4px" }}>✕</button>
        </div>
        <div style={{ marginTop: "16px" }}>{children}</div>
        {footer && <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>{footer}</div>}
      </div>
    </div>
  );
}
