import React from "react";
export function MoneyText({ value, tone = "default" }) {
  const color = tone === "income" ? "var(--income)" : tone === "expense" ? "var(--expense)" : "var(--foreground)";
  const prefix = tone === "income" ? "+" : tone === "expense" ? "\u2212" : "";
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "THB", minimumFractionDigits: 2 }).format(Math.abs(value || 0));
  return <span className="num-display" style={{ fontWeight: 600, letterSpacing: "-0.01em", color }}>{prefix}{formatted}</span>;
}
