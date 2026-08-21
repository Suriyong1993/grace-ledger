/* @ds-bundle: {"format":4,"namespace":"GraceLedgerDesignSystem_b2d940","components":[{"name":"Card","sourcePath":"components/data/Card.jsx"},{"name":"MoneyText","sourcePath":"components/data/MoneyText.jsx"},{"name":"StatCard","sourcePath":"components/data/StatCard.jsx"},{"name":"Badge","sourcePath":"components/feedback/Badge.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"StatusBadge","sourcePath":"components/feedback/StatusBadge.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"PageHeader","sourcePath":"components/navigation/PageHeader.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"Dialog","sourcePath":"components/overlays/Dialog.jsx"}],"sourceHashes":{"components/data/Card.jsx":"a418ceb8d7cd","components/data/MoneyText.jsx":"27322fe93c70","components/data/StatCard.jsx":"6a44e021ff86","components/feedback/Badge.jsx":"5cfa9ee1d0a8","components/feedback/EmptyState.jsx":"6af5986e3a2f","components/feedback/StatusBadge.jsx":"ad8082cf8d60","components/forms/Button.jsx":"c2ff70c86f92","components/forms/Checkbox.jsx":"7c5902422c87","components/forms/Input.jsx":"99b1d2338774","components/forms/Select.jsx":"0ce569c7976a","components/forms/Switch.jsx":"58d429fe4f6c","components/navigation/PageHeader.jsx":"8798f59cf836","components/navigation/Tabs.jsx":"d892ee1f82a1","components/overlays/Dialog.jsx":"99e2ad037601","ui_kits/grace-ledger/Approvals.jsx":"25f7faa44d80","ui_kits/grace-ledger/Dashboard.jsx":"8b898cd4d625","ui_kits/grace-ledger/IncomeEntry.jsx":"82132dd435fa","ui_kits/grace-ledger/Login.jsx":"289aa52f6e8e","ui_kits/grace-ledger/Sidebar.jsx":"0b8dd6685ced","ui_kits/grace-ledger/Topbar.jsx":"84d344cee7f0","ui_kits/grace-ledger/data.js":"3a8995cb5a5b"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.GraceLedgerDesignSystem_b2d940 = window.GraceLedgerDesignSystem_b2d940 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/data/Card.jsx
try { (() => {
function Card({
  variant = "default",
  title,
  description,
  footer,
  children,
  style
}) {
  const interactive = variant === "interactive";
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => interactive && setHover(true),
    onMouseLeave: () => interactive && setHover(false),
    style: {
      borderRadius: "var(--radius-card)",
      background: "var(--card)",
      color: "var(--card-foreground)",
      border: `1px solid ${interactive && hover ? "color-mix(in oklch, var(--primary) 50%, transparent)" : "var(--border)"}`,
      boxShadow: "var(--shadow-sm-card)",
      cursor: interactive ? "pointer" : "default",
      transform: interactive && hover ? "translateY(-1px)" : "none",
      transition: "border-color 150ms, transform 150ms, box-shadow 150ms",
      ...style
    }
  }, (title || description) && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 16px",
      borderBottom: "1px solid var(--border)"
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontFamily: "var(--font-display)"
    }
  }, title), description && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--muted-foreground)",
      marginTop: "2px"
    }
  }, description)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px"
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 16px",
      borderTop: "1px solid var(--border)"
    }
  }, footer));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Card.jsx", error: String((e && e.message) || e) }); }

// components/data/MoneyText.jsx
try { (() => {
function MoneyText({
  value,
  tone = "default"
}) {
  const color = tone === "income" ? "var(--income)" : tone === "expense" ? "var(--expense)" : "var(--foreground)";
  const prefix = tone === "income" ? "+" : tone === "expense" ? "\u2212" : "";
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2
  }).format(Math.abs(value || 0));
  return /*#__PURE__*/React.createElement("span", {
    className: "num-display",
    style: {
      fontWeight: 600,
      letterSpacing: "-0.01em",
      color
    }
  }, prefix, formatted);
}
Object.assign(__ds_scope, { MoneyText });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/MoneyText.jsx", error: String((e && e.message) || e) }); }

// components/data/StatCard.jsx
try { (() => {
const TONE = {
  primary: {
    value: "var(--primary)",
    bar: "var(--primary)"
  },
  secondary: {
    value: "var(--foreground)",
    bar: "var(--border)"
  },
  success: {
    value: "var(--success)",
    bar: "var(--success)"
  },
  danger: {
    value: "var(--destructive)",
    bar: "var(--destructive)"
  },
  warning: {
    value: "var(--warning)",
    bar: "var(--warning)"
  }
};
function StatCard({
  label,
  value,
  hint,
  tone = "secondary",
  trend
}) {
  const t = TONE[tone] || TONE.secondary;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      borderRadius: "var(--radius-card)",
      border: "1px solid var(--border)",
      background: "var(--card)",
      boxShadow: "var(--shadow-card)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "3px",
      background: t.bar,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: "18px 20px"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "kicker",
    style: {
      margin: 0
    }
  }, label), /*#__PURE__*/React.createElement("p", {
    className: "num-display",
    style: {
      margin: "10px 0 0",
      fontFamily: "var(--font-display)",
      fontSize: "28px",
      fontWeight: 700,
      lineHeight: 1,
      color: t.value
    }
  }, value), (hint || typeof trend === "number") && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "12px",
      paddingTop: "10px",
      borderTop: "1px solid color-mix(in oklch, var(--border) 60%, transparent)",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "var(--text-2xs)",
      color: "var(--muted-foreground)"
    }
  }, typeof trend === "number" && /*#__PURE__*/React.createElement("span", {
    className: "num-display",
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "3px",
      borderRadius: "var(--radius-full)",
      border: `1px solid ${trend >= 0 ? "var(--success)" : "var(--destructive)"}`,
      color: trend >= 0 ? "var(--success)" : "var(--destructive)",
      padding: "1px 6px",
      fontWeight: 700
    }
  }, trend >= 0 ? "▲" : "▼", trend >= 0 ? "+" : "", trend.toFixed(1), "%"), hint && /*#__PURE__*/React.createElement("span", null, hint))));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Badge.jsx
try { (() => {
const VARIANT = {
  default: {
    background: "var(--secondary)",
    color: "var(--secondary-foreground)",
    border: "1px solid var(--border)"
  },
  secondary: {
    background: "color-mix(in oklch, var(--secondary) 60%, transparent)",
    color: "var(--secondary-foreground)",
    border: "1px solid var(--border)"
  },
  outline: {
    background: "transparent",
    color: "var(--foreground)",
    border: "1px solid var(--border)"
  },
  destructive: {
    background: "transparent",
    color: "var(--destructive)",
    border: "1px solid var(--destructive)"
  },
  success: {
    background: "transparent",
    color: "var(--success)",
    border: "1px solid var(--success)"
  },
  warning: {
    background: "transparent",
    color: "var(--warning)",
    border: "1px solid var(--warning)"
  },
  info: {
    background: "transparent",
    color: "var(--info)",
    border: "1px solid var(--info)"
  }
};
function Badge({
  variant = "default",
  children
}) {
  const v = VARIANT[variant] || VARIANT.default;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      borderRadius: "var(--radius-full)",
      padding: "2px 10px",
      fontSize: "var(--text-xs)",
      fontWeight: 600,
      fontFamily: "var(--font-sans)",
      ...v
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Badge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function EmptyState({
  title,
  description,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "16px",
      borderRadius: "var(--radius-card)",
      border: "1px dashed var(--border)",
      background: "color-mix(in oklch, var(--card) 30%, transparent)",
      padding: "64px 32px",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: "56px",
      height: "56px",
      display: "grid",
      placeItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      borderRadius: "12px",
      border: "1px solid color-mix(in oklch, var(--border) 40%, transparent)",
      background: "color-mix(in oklch, var(--muted) 40%, transparent)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      fontSize: "20px",
      color: "color-mix(in oklch, var(--muted-foreground) 40%, transparent)"
    }
  }, "\u25A2")), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "280px"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontFamily: "var(--font-display)",
      fontSize: "var(--text-base)",
      fontWeight: 600,
      color: "var(--foreground)"
    }
  }, title), description && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "6px 0 0",
      fontSize: "var(--text-xs)",
      lineHeight: 1.6,
      color: "var(--muted-foreground)"
    }
  }, description)), action && /*#__PURE__*/React.createElement("div", null, action));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/StatusBadge.jsx
try { (() => {
const ICONS = {
  draft: "✎",
  pending: "◷",
  approved: "✓",
  rejected: "✕",
  voided: "⊘"
};
const CONFIG = {
  draft: {
    color: "var(--muted-foreground)"
  },
  pending: {
    color: "var(--warning)"
  },
  approved: {
    color: "var(--success)"
  },
  rejected: {
    color: "var(--destructive)"
  },
  voided: {
    color: "var(--muted-foreground)",
    strike: true
  }
};
const LABEL = {
  draft: "ร่าง",
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
  voided: "ยกเลิก"
};
function StatusBadge({
  status = "draft",
  showIcon = true
}) {
  const c = CONFIG[status] || CONFIG.draft;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      borderRadius: "var(--radius-full)",
      padding: "2px 10px",
      fontSize: "var(--text-xs)",
      fontWeight: 600,
      fontFamily: "var(--font-sans)",
      color: c.color,
      border: `1px solid ${c.color}`,
      textDecoration: c.strike ? "line-through" : "none",
      opacity: c.strike ? 0.7 : 1
    }
  }, showIcon && /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      fontSize: "10px"
    }
  }, ICONS[status]), LABEL[status]);
}
Object.assign(__ds_scope, { StatusBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/StatusBadge.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
const SIZE = {
  default: {
    height: "44px",
    padding: "0 16px",
    fontSize: "var(--text-base)"
  },
  sm: {
    height: "36px",
    padding: "0 12px",
    fontSize: "var(--text-xs)"
  },
  lg: {
    height: "48px",
    padding: "0 24px",
    fontSize: "var(--text-md)"
  },
  icon: {
    height: "44px",
    width: "44px",
    padding: 0,
    fontSize: "var(--text-base)"
  }
};
const VARIANT = {
  default: {
    background: "var(--primary)",
    color: "var(--primary-foreground)",
    border: "1px solid color-mix(in oklch, var(--primary) 70%, transparent)"
  },
  secondary: {
    background: "var(--secondary)",
    color: "var(--secondary-foreground)",
    border: "1px solid var(--border)"
  },
  outline: {
    background: "transparent",
    color: "var(--foreground)",
    border: "1px solid var(--border)"
  },
  ghost: {
    background: "transparent",
    color: "var(--muted-foreground)",
    border: "1px solid transparent"
  },
  destructive: {
    background: "var(--destructive)",
    color: "var(--destructive-foreground)",
    border: "1px solid transparent"
  }
};
function Button({
  variant = "default",
  size = "default",
  disabled = false,
  icon,
  children,
  style,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  const v = VARIANT[variant] || VARIANT.default;
  const s = SIZE[size] || SIZE.default;
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      whiteSpace: "nowrap",
      borderRadius: "var(--radius-button)",
      fontWeight: 500,
      fontFamily: "var(--font-display)",
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "background-color 150ms var(--ease-out), opacity 150ms var(--ease-out)",
      opacity: disabled ? 0.5 : hover ? 0.9 : 1,
      ...s,
      ...v,
      ...style
    }
  }, icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function Checkbox({
  checked = false,
  onChange,
  label,
  disabled
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: "20px",
      height: "20px",
      borderRadius: "6px",
      flexShrink: 0,
      border: `1.5px solid ${checked ? "var(--primary)" : "var(--border)"}`,
      background: checked ? "var(--primary)" : "var(--card)",
      display: "grid",
      placeItems: "center",
      transition: "background 150ms, border-color 150ms"
    }
  }, checked && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--primary-foreground)",
      fontSize: "12px",
      fontWeight: 700,
      lineHeight: 1
    }
  }, "\u2713")), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-base)",
      color: "var(--foreground)"
    }
  }, label));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function Input({
  label,
  placeholder,
  value,
  onChange,
  error,
  disabled,
  type = "text"
}) {
  const [focused, setFocused] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "6px"
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 500,
      color: "var(--foreground)"
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    type: type,
    placeholder: placeholder,
    value: value,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      height: "44px",
      width: "100%",
      borderRadius: "var(--radius-input)",
      border: `1px solid ${error ? "var(--destructive)" : focused ? "var(--ring)" : "var(--border)"}`,
      background: "var(--input, var(--card))",
      padding: "0 14px",
      fontSize: "var(--text-base)",
      fontFamily: "var(--font-sans)",
      color: "var(--foreground)",
      outline: "none",
      boxShadow: focused ? "0 0 0 2px color-mix(in oklch, var(--ring) 25%, transparent)" : "none",
      opacity: disabled ? 0.5 : 1,
      transition: "border-color 150ms, box-shadow 150ms"
    }
  }), error && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--destructive)"
    }
  }, error));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = "เลือก..."
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "6px"
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 500,
      color: "var(--foreground)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: e => onChange && onChange(e.target.value),
    style: {
      height: "44px",
      width: "100%",
      borderRadius: "var(--radius-input)",
      border: "1px solid var(--border)",
      background: "var(--card)",
      padding: "0 36px 0 14px",
      fontSize: "var(--text-base)",
      fontFamily: "var(--font-sans)",
      color: "var(--foreground)",
      outline: "none",
      appearance: "none",
      cursor: "pointer"
    }
  }, placeholder && /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true,
    hidden: true
  }, placeholder), options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: "14px",
      top: "50%",
      transform: "translateY(-50%)",
      pointerEvents: "none",
      color: "var(--muted-foreground)",
      fontSize: "10px"
    }
  }, "\u25BE")));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function Switch({
  checked = false,
  onChange,
  label,
  disabled
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: "40px",
      height: "24px",
      borderRadius: "var(--radius-full)",
      flexShrink: 0,
      position: "relative",
      background: checked ? "var(--primary)" : "var(--border)",
      transition: "background 150ms var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: "3px",
      left: checked ? "19px" : "3px",
      width: "18px",
      height: "18px",
      borderRadius: "50%",
      background: "#fff",
      boxShadow: "0 1px 2px rgb(0 0 0 / 0.15)",
      transition: "left 150ms var(--ease-out)"
    }
  })), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-base)",
      color: "var(--foreground)"
    }
  }, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/PageHeader.jsx
try { (() => {
function PageHeader({
  kicker,
  title,
  description,
  actions
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      marginBottom: "24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: "16px",
      paddingBottom: "20px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, kicker && /*#__PURE__*/React.createElement("p", {
    className: "kicker",
    style: {
      marginBottom: "12px",
      display: "flex",
      alignItems: "center",
      gap: "8px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: "var(--primary)"
    }
  }), kicker), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: "var(--font-display)",
      fontSize: "26px",
      fontWeight: 700,
      letterSpacing: "-0.02em",
      color: "var(--foreground)"
    }
  }, title), description && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "8px 0 0",
      maxWidth: "560px",
      fontSize: "var(--text-sm)",
      lineHeight: 1.6,
      color: "var(--muted-foreground)"
    }
  }, description)), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "8px"
    }
  }, actions)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "1px",
      width: "100%",
      background: "var(--border)"
    }
  }));
}
Object.assign(__ds_scope, { PageHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/PageHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  items = [],
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      gap: "2px",
      padding: "3px",
      borderRadius: "var(--radius-full)",
      background: "var(--secondary)",
      border: "1px solid var(--border)"
    }
  }, items.map(it => {
    const active = it.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: it.value,
      onClick: () => onChange && onChange(it.value),
      style: {
        border: "none",
        borderRadius: "var(--radius-full)",
        padding: "7px 16px",
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        fontFamily: "var(--font-sans)",
        cursor: "pointer",
        background: active ? "var(--card)" : "transparent",
        color: active ? "var(--foreground)" : "var(--muted-foreground)",
        boxShadow: active ? "var(--shadow-xs)" : "none",
        transition: "background 150ms var(--ease-out), color 150ms var(--ease-out)"
      }
    }, it.label);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/overlays/Dialog.jsx
try { (() => {
function Dialog({
  open,
  title,
  description,
  children,
  footer,
  onClose
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 50,
      display: "grid",
      placeItems: "center",
      background: "rgb(0 0 0 / 0.4)",
      backdropFilter: "blur(6px)"
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: "min(480px, 92vw)",
      borderRadius: "var(--radius-dialog)",
      background: "var(--background)",
      border: "1px solid var(--border)",
      boxShadow: "var(--shadow-elevated)",
      padding: "24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "12px"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: "var(--font-display)",
      fontSize: "var(--text-lg)",
      fontWeight: 600
    }
  }, title), description && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "6px 0 0",
      fontSize: "var(--text-xs)",
      color: "var(--muted-foreground)"
    }
  }, description)), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      border: "none",
      background: "transparent",
      cursor: "pointer",
      fontSize: "16px",
      color: "var(--muted-foreground)",
      padding: "4px"
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "16px"
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "20px",
      display: "flex",
      justifyContent: "flex-end",
      gap: "8px"
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/Dialog.jsx", error: String((e && e.message) || e) }); }

// ui_kits/grace-ledger/Approvals.jsx
try { (() => {
function ApprovalsScreen() {
  const {
    PageHeader,
    MoneyText,
    Button,
    EmptyState
  } = window.GraceLedgerDesignSystem_b2d940;
  const M = window.MOCK;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "24px 28px 40px"
    }
  }, /*#__PURE__*/React.createElement(PageHeader, {
    kicker: "\u0E01\u0E33\u0E01\u0E31\u0E1A\u0E14\u0E39\u0E41\u0E25",
    title: "\u0E04\u0E34\u0E27\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34",
    description: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E41\u0E25\u0E30\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E01\u0E48\u0E2D\u0E19\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E40\u0E02\u0E49\u0E32\u0E1A\u0E31\u0E0D\u0E0A\u0E35"
  }), M.pending.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    title: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E04\u0E49\u0E32\u0E07\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34",
    description: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E2B\u0E21\u0E48\u0E08\u0E30\u0E1B\u0E23\u0E32\u0E01\u0E0F\u0E17\u0E35\u0E48\u0E19\u0E35\u0E48"
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    }
  }, M.pending.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "16px",
      padding: "16px 20px",
      borderRadius: "var(--radius-card)",
      border: "1px solid var(--border)",
      background: "var(--card)",
      boxShadow: "var(--shadow-sm-card)"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "14px",
      fontWeight: 600,
      color: "var(--foreground)"
    }
  }, p.description), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "12px",
      color: "var(--muted-foreground)",
      marginTop: "2px"
    }
  }, p.meta)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "16px"
    }
  }, /*#__PURE__*/React.createElement(MoneyText, {
    value: p.amount,
    tone: p.kind
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "6px"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm"
  }, "\u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18"), /*#__PURE__*/React.createElement(Button, {
    size: "sm"
  }, "\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34")))))));
}
window.ApprovalsScreen = ApprovalsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/grace-ledger/Approvals.jsx", error: String((e && e.message) || e) }); }

// ui_kits/grace-ledger/Dashboard.jsx
try { (() => {
function DashboardScreen({
  onNavigate
}) {
  const {
    PageHeader,
    StatCard,
    Button,
    MoneyText,
    StatusBadge
  } = window.GraceLedgerDesignSystem_b2d940;
  const M = window.MOCK;
  const totalBalance = M.funds.reduce((s, f) => s + f.balance, 0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "24px 28px 40px"
    }
  }, /*#__PURE__*/React.createElement(PageHeader, {
    kicker: "\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21",
    title: "\u0E41\u0E14\u0E0A\u0E1A\u0E2D\u0E23\u0E4C\u0E14",
    description: "\u0E2A\u0E23\u0E38\u0E1B\u0E22\u0E2D\u0E14\u0E04\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D \u0E23\u0E32\u0E22\u0E23\u0E31\u0E1A-\u0E23\u0E32\u0E22\u0E08\u0E48\u0E32\u0E22 \u0E41\u0E25\u0E30\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E17\u0E35\u0E48\u0E23\u0E2D\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34",
    actions: /*#__PURE__*/React.createElement(Button, {
      onClick: () => onNavigate("income")
    }, "+ \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E23\u0E32\u0E22\u0E23\u0E31\u0E1A")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.3fr 1fr",
      gap: "16px",
      marginBottom: "16px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "surface-elevated",
    style: {
      borderRadius: "var(--radius-card)",
      padding: "28px",
      background: "var(--card)",
      border: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "kicker"
  }, "\u0E22\u0E2D\u0E14\u0E04\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E23\u0E27\u0E21"), /*#__PURE__*/React.createElement("p", {
    className: "num-display",
    style: {
      margin: "10px 0 0",
      fontFamily: "var(--font-display)",
      fontSize: "44px",
      fontWeight: 700,
      color: "var(--foreground)"
    }
  }, "\u0E3F", totalBalance.toLocaleString("en-US", {
    minimumFractionDigits: 2
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "10px 0 0",
      fontSize: "12px",
      color: "var(--muted-foreground)"
    }
  }, M.funds.length, " \u0E01\u0E2D\u0E07\u0E17\u0E38\u0E19")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "20px",
      marginTop: "20px",
      paddingTop: "16px",
      borderTop: "1px solid var(--border)",
      fontSize: "12px",
      color: "var(--muted-foreground)"
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u0E23\u0E31\u0E1A\u0E40\u0E14\u0E37\u0E2D\u0E19\u0E19\u0E35\u0E49 ", /*#__PURE__*/React.createElement(MoneyText, {
    value: 245000,
    tone: "income"
  })), /*#__PURE__*/React.createElement("span", null, "\u0E08\u0E48\u0E32\u0E22\u0E40\u0E14\u0E37\u0E2D\u0E19\u0E19\u0E35\u0E49 ", /*#__PURE__*/React.createElement(MoneyText, {
    value: 98200,
    tone: "expense"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: "var(--radius-card)",
      border: "1px solid var(--border)",
      background: "var(--card)",
      padding: "18px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: "14px",
      fontWeight: 600
    }
  }, "\u0E23\u0E2D\u0E01\u0E32\u0E23\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34"), /*#__PURE__*/React.createElement("span", {
    className: "num-display",
    style: {
      fontSize: "11px",
      fontWeight: 700,
      color: "var(--warning)",
      background: "var(--offering-muted)",
      padding: "2px 8px",
      borderRadius: "999px"
    }
  }, M.pending.length, " \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      marginTop: "12px"
    }
  }, M.pending.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    style: {
      border: "1px solid color-mix(in oklch, var(--border) 70%, transparent)",
      borderRadius: "10px",
      padding: "10px 12px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: "8px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "12.5px",
      fontWeight: 500
    }
  }, p.description), /*#__PURE__*/React.createElement(MoneyText, {
    value: p.amount,
    tone: p.kind
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "4px 0 0",
      fontSize: "11px",
      color: "var(--muted-foreground)"
    }
  }, p.meta)))), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm",
    style: {
      width: "100%",
      marginTop: "12px"
    },
    onClick: () => onNavigate("approvals")
  }, "\u0E44\u0E1B\u0E17\u0E35\u0E48\u0E04\u0E34\u0E27\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34 \u2192"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: "16px",
      marginBottom: "20px"
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "\u0E23\u0E32\u0E22\u0E23\u0E31\u0E1A\u0E40\u0E14\u0E37\u0E2D\u0E19\u0E19\u0E35\u0E49",
    value: "\u0E3F245,000.00",
    tone: "success",
    trend: 12.4,
    hint: "38 \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "\u0E23\u0E32\u0E22\u0E08\u0E48\u0E32\u0E22\u0E40\u0E14\u0E37\u0E2D\u0E19\u0E19\u0E35\u0E49",
    value: "\u0E3F98,200.00",
    tone: "danger",
    trend: -4.1,
    hint: "21 \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "\u0E40\u0E07\u0E34\u0E19\u0E16\u0E27\u0E32\u0E22\u0E2D\u0E32\u0E17\u0E34\u0E15\u0E22\u0E4C\u0E19\u0E35\u0E49",
    value: "\u0E3F42,500.00",
    tone: "primary",
    hint: "\u0E23\u0E27\u0E21\u0E17\u0E38\u0E01\u0E0A\u0E48\u0E2D\u0E07\u0E17\u0E32\u0E07"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: "var(--radius-card)",
      border: "1px solid var(--border)",
      background: "var(--card)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px 18px",
      borderBottom: "1px solid var(--border)",
      fontWeight: 600,
      fontSize: "14px"
    }
  }, "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14"), /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "13px"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: "var(--card)"
    }
  }, ["วันที่", "รายละเอียด", "หมวดหมู่", "จำนวน", "สถานะ"].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      textAlign: i === 3 ? "right" : i === 4 ? "center" : "left",
      padding: "8px 20px",
      fontSize: "11px",
      color: "var(--muted-foreground)",
      fontWeight: 600,
      borderBottom: "1px solid var(--border)"
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, M.recent.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: i,
    style: {
      background: i % 2 ? "var(--secondary)" : "var(--card)"
    }
  }, /*#__PURE__*/React.createElement("td", {
    className: "num-display",
    style: {
      padding: "10px 20px",
      borderBottom: "1px solid var(--border)"
    }
  }, r.date), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 20px",
      borderBottom: "1px solid var(--border)"
    }
  }, r.desc), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 20px",
      borderBottom: "1px solid var(--border)",
      color: "var(--muted-foreground)"
    }
  }, r.category), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 20px",
      borderBottom: "1px solid var(--border)",
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement(MoneyText, {
    value: r.amount,
    tone: r.tone
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 20px",
      borderBottom: "1px solid var(--border)",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement(StatusBadge, {
    status: r.status
  }))))))));
}
window.DashboardScreen = DashboardScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/grace-ledger/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/grace-ledger/IncomeEntry.jsx
try { (() => {
function IncomeEntryScreen() {
  const {
    PageHeader,
    Input,
    Select,
    Checkbox,
    Button,
    Card
  } = window.GraceLedgerDesignSystem_b2d940;
  const [step] = React.useState(1);
  const steps = ["ประเภท", "รายละเอียด", "แนบเอกสาร", "ยืนยัน"];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "24px 28px 40px",
      maxWidth: "640px"
    }
  }, /*#__PURE__*/React.createElement(PageHeader, {
    kicker: "\u0E23\u0E32\u0E22\u0E23\u0E31\u0E1A",
    title: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E23\u0E32\u0E22\u0E23\u0E31\u0E1A\u0E43\u0E2B\u0E21\u0E48",
    description: "\u0E17\u0E35\u0E25\u0E30\u0E02\u0E31\u0E49\u0E19\u0E15\u0E2D\u0E19 \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E07\u0E48\u0E32\u0E22 \u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E02\u0E49\u0E32\u0E43\u0E08\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E25\u0E36\u0E01"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "8px",
      marginBottom: "20px"
    }
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s,
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      gap: "8px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: "24px",
      height: "24px",
      borderRadius: "50%",
      flexShrink: 0,
      display: "grid",
      placeItems: "center",
      fontSize: "11px",
      fontWeight: 700,
      background: i + 1 <= step ? "var(--primary)" : "var(--secondary)",
      color: i + 1 <= step ? "#fff" : "var(--muted-foreground)"
    }
  }, i + 1), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "12px",
      color: i + 1 === step ? "var(--foreground)" : "var(--muted-foreground)",
      fontWeight: i + 1 === step ? 600 : 400
    }
  }, s)))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "16px"
    }
  }, /*#__PURE__*/React.createElement(Select, {
    label: "\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E23\u0E32\u0E22\u0E23\u0E31\u0E1A",
    value: "offering",
    onChange: () => {},
    options: [{
      value: "offering",
      label: "เงินถวาย"
    }, {
      value: "donation",
      label: "เงินบริจาค"
    }, {
      value: "other",
      label: "รายรับอื่น"
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "16px"
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E07\u0E34\u0E19 (\u0E1A\u0E32\u0E17)",
    placeholder: "0.00",
    type: "number"
  }), /*#__PURE__*/React.createElement(Select, {
    label: "\u0E01\u0E2D\u0E07\u0E17\u0E38\u0E19",
    value: "general",
    onChange: () => {},
    options: [{
      value: "general",
      label: "กองทุนทั่วไป"
    }, {
      value: "mission",
      label: "กองทุนพันธกิจ"
    }]
  })), /*#__PURE__*/React.createElement(Input, {
    label: "\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14 (\u0E16\u0E49\u0E32\u0E21\u0E35)",
    placeholder: "\u0E40\u0E0A\u0E48\u0E19 \u0E16\u0E27\u0E32\u0E22\u0E2D\u0E32\u0E17\u0E34\u0E15\u0E22\u0E4C\u0E17\u0E35\u0E48 3 \u0E2A.\u0E04."
  }), /*#__PURE__*/React.createElement(Checkbox, {
    checked: true,
    onChange: () => {},
    label: "\u0E2A\u0E48\u0E07\u0E40\u0E02\u0E49\u0E32\u0E04\u0E34\u0E27\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E17\u0E31\u0E19\u0E17\u0E35"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "8px",
      marginTop: "16px"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline"
  }, "\u0E22\u0E49\u0E2D\u0E19\u0E01\u0E25\u0E31\u0E1A"), /*#__PURE__*/React.createElement(Button, null, "\u0E16\u0E31\u0E14\u0E44\u0E1B")));
}
window.IncomeEntryScreen = IncomeEntryScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/grace-ledger/IncomeEntry.jsx", error: String((e && e.message) || e) }); }

// ui_kits/grace-ledger/Login.jsx
try { (() => {
function LoginScreen({
  onLogin
}) {
  const {
    Input,
    Button
  } = window.GraceLedgerDesignSystem_b2d940;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "760px",
      display: "grid",
      placeItems: "center",
      background: "var(--background)",
      fontFamily: "var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "360px",
      padding: "36px 32px",
      borderRadius: "var(--radius-card)",
      border: "1px solid var(--border)",
      background: "var(--card)",
      boxShadow: "var(--shadow-card)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "10px",
      marginBottom: "28px"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-mark.png",
    alt: "",
    style: {
      width: "56px",
      height: "56px",
      borderRadius: "16px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: "18px",
      color: "var(--foreground)"
    }
  }, "Grace Ledger"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "12px",
      color: "var(--muted-foreground)"
    }
  }, "\u0E23\u0E30\u0E1A\u0E1A\u0E01\u0E32\u0E23\u0E40\u0E07\u0E34\u0E19\u0E04\u0E23\u0E34\u0E2A\u0E15\u0E08\u0E31\u0E01\u0E23"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "14px"
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "\u0E2D\u0E35\u0E40\u0E21\u0E25",
    placeholder: "you@church.org"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19",
    type: "password",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
  }), /*#__PURE__*/React.createElement(Button, {
    style: {
      width: "100%",
      marginTop: "6px"
    },
    onClick: onLogin
  }, "\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A")), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: "18px",
      textAlign: "center",
      fontSize: "11px",
      color: "var(--muted-foreground)"
    }
  }, "\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E41\u0E25\u0E30\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E23\u0E30\u0E1A\u0E1A\u0E02\u0E2D\u0E07\u0E04\u0E23\u0E34\u0E2A\u0E15\u0E08\u0E31\u0E01\u0E23")));
}
window.LoginScreen = LoginScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/grace-ledger/Login.jsx", error: String((e && e.message) || e) }); }

// ui_kits/grace-ledger/Sidebar.jsx
try { (() => {
const NAV_GROUPS = [{
  label: "ภาพรวม",
  items: [{
    key: "dashboard",
    label: "แดชบอร์ด"
  }]
}, {
  label: "ธุรกรรม",
  items: [{
    key: "income",
    label: "รายรับ"
  }, {
    key: "expense",
    label: "รายจ่าย"
  }, {
    key: "offering",
    label: "เงินถวาย"
  }]
}, {
  label: "กำกับดูแล",
  items: [{
    key: "approvals",
    label: "อนุมัติ",
    badge: 6
  }, {
    key: "reports",
    label: "รายงาน"
  }, {
    key: "audit",
    label: "ตรวจสอบ"
  }]
}, {
  label: "จัดการ",
  items: [{
    key: "funds",
    label: "กองทุน"
  }, {
    key: "budget",
    label: "งบประมาณ"
  }, {
    key: "members",
    label: "สมาชิก"
  }]
}];
function Sidebar({
  active,
  onNavigate
}) {
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: "220px",
      flexShrink: 0,
      background: "var(--sidebar)",
      borderRight: "1px solid var(--sidebar-border)",
      display: "flex",
      flexDirection: "column",
      height: "100%"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "14px 16px",
      borderBottom: "1px solid var(--sidebar-border)"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-mark.png",
    alt: "",
    style: {
      width: "34px",
      height: "34px",
      borderRadius: "9px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: "13px",
      color: "var(--sidebar-foreground)"
    }
  }, "Grace Ledger"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "10px",
      color: "var(--sidebar-icon)"
    }
  }, "\u0E23\u0E30\u0E1A\u0E1A\u0E01\u0E32\u0E23\u0E40\u0E07\u0E34\u0E19\u0E04\u0E23\u0E34\u0E2A\u0E15\u0E08\u0E31\u0E01\u0E23"))), /*#__PURE__*/React.createElement("nav", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "8px 0"
    }
  }, NAV_GROUPS.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.label,
    style: {
      padding: "8px 12px 2px"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 4px",
      padding: "0 4px",
      fontSize: "10px",
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "color-mix(in oklch, var(--sidebar-icon) 70%, transparent)"
    }
  }, g.label), g.items.map(it => {
    const isActive = active === it.key;
    return /*#__PURE__*/React.createElement("a", {
      key: it.key,
      href: "#",
      onClick: e => {
        e.preventDefault();
        onNavigate(it.key);
      },
      style: {
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        height: "36px",
        padding: "0 12px",
        borderRadius: "8px",
        textDecoration: "none",
        fontSize: "13px",
        fontWeight: 500,
        background: isActive ? "var(--sidebar-accent)" : "transparent",
        color: isActive ? "var(--sidebar-primary)" : "var(--sidebar-icon)"
      }
    }, isActive && /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        left: 0,
        top: "6px",
        bottom: "6px",
        width: "2px",
        borderRadius: "2px",
        background: "var(--sidebar-primary)"
      }
    }), /*#__PURE__*/React.createElement("span", null, it.label), it.badge && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "10px",
        fontWeight: 700,
        background: "var(--pending)",
        color: "var(--pending-foreground)",
        borderRadius: "999px",
        padding: "1px 6px"
      }
    }, it.badge));
  })))));
}
window.Sidebar = Sidebar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/grace-ledger/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/grace-ledger/Topbar.jsx
try { (() => {
function Topbar({
  user
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      height: "56px",
      borderBottom: "1px solid var(--border)",
      background: "var(--background)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 20px",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "4px"
    }
  }, ["ภาพรวม", "รายรับ", "รายจ่าย", "เงินถวาย", "รายงาน"].map((l, i) => /*#__PURE__*/React.createElement("span", {
    key: l,
    style: {
      fontSize: "12.5px",
      fontWeight: 500,
      padding: "6px 12px",
      borderRadius: "999px",
      color: i === 0 ? "var(--background)" : "var(--muted-foreground)",
      background: i === 0 ? "var(--foreground)" : "transparent"
    }
  }, l))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "10px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: "34px",
      height: "34px",
      borderRadius: "8px",
      background: "var(--secondary)",
      display: "grid",
      placeItems: "center",
      fontSize: "13px",
      color: "var(--muted-foreground)"
    }
  }, "\uD83D\uDD0D"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      border: "1px solid var(--border)",
      borderRadius: "10px",
      padding: "5px 10px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: "22px",
      height: "22px",
      borderRadius: "6px",
      background: "var(--primary)",
      color: "#fff",
      fontSize: "11px",
      fontWeight: 700,
      display: "grid",
      placeItems: "center"
    }
  }, user.name[0]), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "12px",
      fontWeight: 600,
      color: "var(--foreground)"
    }
  }, user.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "10px",
      color: "var(--muted-foreground)"
    }
  }, user.role)))));
}
window.Topbar = Topbar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/grace-ledger/Topbar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/grace-ledger/data.js
try { (() => {
window.MOCK = {
  funds: [{
    id: "general",
    name: "กองทุนทั่วไป",
    balance: 482300
  }, {
    id: "mission",
    name: "กองทุนพันธกิจ",
    balance: 128450
  }, {
    id: "building",
    name: "กองทุนอาคาร",
    balance: 950000
  }],
  pending: [{
    id: "1",
    kind: "income",
    description: "เงินถวายอาทิตย์ที่ 3 ส.ค.",
    amount: 42500,
    meta: "โดย คุณสมชาย · 2 ชม. ที่แล้ว"
  }, {
    id: "2",
    kind: "expense",
    description: "ค่าซ่อมเครื่องเสียง",
    amount: 8200,
    meta: "โดย คุณวิภา · เมื่อวาน"
  }, {
    id: "3",
    kind: "expense",
    description: "ค่าไฟฟ้าเดือน ส.ค.",
    amount: 15300,
    meta: "โดย คุณวิภา · 2 วันที่แล้ว"
  }],
  recent: [{
    date: "3 ส.ค. 2569",
    desc: "ถวายรวมนมัสการ",
    category: "เงินถวาย",
    amount: 42500,
    tone: "income",
    status: "approved"
  }, {
    date: "2 ส.ค. 2569",
    desc: "ค่าไฟฟ้าเดือน ส.ค.",
    category: "ค่าใช้จ่ายอาคาร",
    amount: 15300,
    tone: "expense",
    status: "pending"
  }, {
    date: "1 ส.ค. 2569",
    desc: "ถวายพันธกิจพิเศษ",
    category: "กองทุนพันธกิจ",
    amount: 12000,
    tone: "income",
    status: "approved"
  }, {
    date: "30 ก.ค. 2569",
    desc: "ค่าซ่อมเครื่องเสียง",
    category: "อุปกรณ์",
    amount: 8200,
    tone: "expense",
    status: "pending"
  }, {
    date: "28 ก.ค. 2569",
    desc: "ถวายสิบลด คุณสมชาย",
    category: "เงินถวาย",
    amount: 6000,
    tone: "income",
    status: "approved"
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/grace-ledger/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Card = __ds_scope.Card;

__ds_ns.MoneyText = __ds_scope.MoneyText;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.StatusBadge = __ds_scope.StatusBadge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.PageHeader = __ds_scope.PageHeader;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Dialog = __ds_scope.Dialog;

})();
