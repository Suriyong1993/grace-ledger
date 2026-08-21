import React from "react";
export function Checkbox({ checked = false, onChange, label, disabled }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: "10px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      <span
        onClick={() => !disabled && onChange && onChange(!checked)}
        style={{
          width: "20px", height: "20px", borderRadius: "6px", flexShrink: 0,
          border: `1.5px solid ${checked ? "var(--primary)" : "var(--border)"}`,
          background: checked ? "var(--primary)" : "var(--card)",
          display: "grid", placeItems: "center", transition: "background 150ms, border-color 150ms",
        }}
      >
        {checked && <span style={{ color: "var(--primary-foreground)", fontSize: "12px", fontWeight: 700, lineHeight: 1 }}>✓</span>}
      </span>
      {label && <span style={{ fontSize: "var(--text-base)", color: "var(--foreground)" }}>{label}</span>}
    </label>
  );
}
