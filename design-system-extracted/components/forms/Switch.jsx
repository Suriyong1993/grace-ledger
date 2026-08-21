import React from "react";
export function Switch({ checked = false, onChange, label, disabled }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: "10px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      <span
        onClick={() => !disabled && onChange && onChange(!checked)}
        style={{
          width: "40px", height: "24px", borderRadius: "var(--radius-full)", flexShrink: 0, position: "relative",
          background: checked ? "var(--primary)" : "var(--border)", transition: "background 150ms var(--ease-out)",
        }}
      >
        <span style={{
          position: "absolute", top: "3px", left: checked ? "19px" : "3px", width: "18px", height: "18px",
          borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgb(0 0 0 / 0.15)",
          transition: "left 150ms var(--ease-out)",
        }} />
      </span>
      {label && <span style={{ fontSize: "var(--text-base)", color: "var(--foreground)" }}>{label}</span>}
    </label>
  );
}
