import React from "react";
export function Select({ label, value, onChange, options = [], placeholder = "เลือก..." }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {label && <label style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--foreground)" }}>{label}</label>}
      <div style={{ position: "relative" }}>
        <select
          value={value} onChange={(e) => onChange && onChange(e.target.value)}
          style={{
            height: "44px", width: "100%", borderRadius: "var(--radius-input)",
            border: "1px solid var(--border)", background: "var(--card)", padding: "0 36px 0 14px",
            fontSize: "var(--text-base)", fontFamily: "var(--font-sans)", color: "var(--foreground)",
            outline: "none", appearance: "none", cursor: "pointer",
          }}
        >
          {placeholder && <option value="" disabled hidden>{placeholder}</option>}
          {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
        <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--muted-foreground)", fontSize: "10px" }}>▾</span>
      </div>
    </div>
  );
}
