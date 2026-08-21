import React from "react";
const VARIANT = {
  default: { background: "var(--secondary)", color: "var(--secondary-foreground)", border: "1px solid var(--border)" },
  secondary: { background: "color-mix(in oklch, var(--secondary) 60%, transparent)", color: "var(--secondary-foreground)", border: "1px solid var(--border)" },
  outline: { background: "transparent", color: "var(--foreground)", border: "1px solid var(--border)" },
  destructive: { background: "transparent", color: "var(--destructive)", border: "1px solid var(--destructive)" },
  success: { background: "transparent", color: "var(--success)", border: "1px solid var(--success)" },
  warning: { background: "transparent", color: "var(--warning)", border: "1px solid var(--warning)" },
  info: { background: "transparent", color: "var(--info)", border: "1px solid var(--info)" },
};
export function Badge({ variant = "default", children }) {
  const v = VARIANT[variant] || VARIANT.default;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px", borderRadius: "var(--radius-full)",
      padding: "2px 10px", fontSize: "var(--text-xs)", fontWeight: 600, fontFamily: "var(--font-sans)",
      ...v,
    }}>{children}</span>
  );
}
