import React from "react";
export function Input({ label, placeholder, value, onChange, error, disabled, type = "text" }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {label && <label style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--foreground)" }}>{label}</label>}
      <input
        type={type} placeholder={placeholder} value={value} disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          height: "44px", width: "100%", borderRadius: "var(--radius-input)",
          border: `1px solid ${error ? "var(--destructive)" : focused ? "var(--ring)" : "var(--border)"}`,
          background: "var(--input, var(--card))", padding: "0 14px", fontSize: "var(--text-base)",
          fontFamily: "var(--font-sans)", color: "var(--foreground)", outline: "none",
          boxShadow: focused ? "0 0 0 2px color-mix(in oklch, var(--ring) 25%, transparent)" : "none",
          opacity: disabled ? 0.5 : 1, transition: "border-color 150ms, box-shadow 150ms",
        }}
      />
      {error && <span style={{ fontSize: "var(--text-2xs)", color: "var(--destructive)" }}>{error}</span>}
    </div>
  );
}
