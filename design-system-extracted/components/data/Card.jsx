import React from "react";
export function Card({ variant = "default", title, description, footer, children, style }) {
  const interactive = variant === "interactive";
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => interactive && setHover(false)}
      style={{
        borderRadius: "var(--radius-card)", background: "var(--card)", color: "var(--card-foreground)",
        border: `1px solid ${interactive && hover ? "color-mix(in oklch, var(--primary) 50%, transparent)" : "var(--border)"}`,
        boxShadow: "var(--shadow-sm-card)", cursor: interactive ? "pointer" : "default",
        transform: interactive && hover ? "translateY(-1px)" : "none",
        transition: "border-color 150ms, transform 150ms, box-shadow 150ms", ...style,
      }}
    >
      {(title || description) && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          {title && <div style={{ fontWeight: 600, fontFamily: "var(--font-display)" }}>{title}</div>}
          {description && <div style={{ fontSize: "var(--text-xs)", color: "var(--muted-foreground)", marginTop: "2px" }}>{description}</div>}
        </div>
      )}
      <div style={{ padding: "16px" }}>{children}</div>
      {footer && <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>{footer}</div>}
    </div>
  );
}
