import React from "react";

const SIZE = {
  default: { height: "44px", padding: "0 16px", fontSize: "var(--text-base)" },
  sm: { height: "36px", padding: "0 12px", fontSize: "var(--text-xs)" },
  lg: { height: "48px", padding: "0 24px", fontSize: "var(--text-md)" },
  icon: { height: "44px", width: "44px", padding: 0, fontSize: "var(--text-base)" },
};

const VARIANT = {
  default: { background: "var(--primary)", color: "var(--primary-foreground)", border: "1px solid color-mix(in oklch, var(--primary) 70%, transparent)" },
  secondary: { background: "var(--secondary)", color: "var(--secondary-foreground)", border: "1px solid var(--border)" },
  outline: { background: "transparent", color: "var(--foreground)", border: "1px solid var(--border)" },
  ghost: { background: "transparent", color: "var(--muted-foreground)", border: "1px solid transparent" },
  destructive: { background: "var(--destructive)", color: "var(--destructive-foreground)", border: "1px solid transparent" },
};

export function Button({ variant = "default", size = "default", disabled = false, icon, children, style, onClick }) {
  const [hover, setHover] = React.useState(false);
  const v = VARIANT[variant] || VARIANT.default;
  const s = SIZE[size] || SIZE.default;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
        whiteSpace: "nowrap", borderRadius: "var(--radius-button)", fontWeight: 500,
        fontFamily: "var(--font-display)", cursor: disabled ? "not-allowed" : "pointer",
        transition: "background-color 150ms var(--ease-out), opacity 150ms var(--ease-out)",
        opacity: disabled ? 0.5 : hover ? 0.9 : 1,
        ...s, ...v, ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
