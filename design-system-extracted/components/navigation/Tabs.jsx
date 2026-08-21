import React from "react";
export function Tabs({ items = [], value, onChange }) {
  return (
    <div style={{ display: "inline-flex", gap: "2px", padding: "3px", borderRadius: "var(--radius-full)", background: "var(--secondary)", border: "1px solid var(--border)" }}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button key={it.value} onClick={() => onChange && onChange(it.value)}
            style={{
              border: "none", borderRadius: "var(--radius-full)", padding: "7px 16px", fontSize: "var(--text-xs)",
              fontWeight: 600, fontFamily: "var(--font-sans)", cursor: "pointer",
              background: active ? "var(--card)" : "transparent",
              color: active ? "var(--foreground)" : "var(--muted-foreground)",
              boxShadow: active ? "var(--shadow-xs)" : "none",
              transition: "background 150ms var(--ease-out), color 150ms var(--ease-out)",
            }}
          >{it.label}</button>
        );
      })}
    </div>
  );
}
