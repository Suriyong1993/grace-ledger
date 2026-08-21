const NAV_GROUPS = [
  { label: "ภาพรวม", items: [{ key: "dashboard", label: "แดชบอร์ด" }] },
  { label: "ธุรกรรม", items: [
    { key: "income", label: "รายรับ" },
    { key: "expense", label: "รายจ่าย" },
    { key: "offering", label: "เงินถวาย" },
  ]},
  { label: "กำกับดูแล", items: [
    { key: "approvals", label: "อนุมัติ", badge: 6 },
    { key: "reports", label: "รายงาน" },
    { key: "audit", label: "ตรวจสอบ" },
  ]},
  { label: "จัดการ", items: [
    { key: "funds", label: "กองทุน" },
    { key: "budget", label: "งบประมาณ" },
    { key: "members", label: "สมาชิก" },
  ]},
];

function Sidebar({ active, onNavigate }) {
  return (
    <aside style={{ width: "220px", flexShrink: 0, background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", borderBottom: "1px solid var(--sidebar-border)" }}>
        <img src="../../assets/logo-mark.png" alt="" style={{ width: "34px", height: "34px", borderRadius: "9px" }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "13px", color: "var(--sidebar-foreground)" }}>Grace Ledger</div>
          <div style={{ fontSize: "10px", color: "var(--sidebar-icon)" }}>ระบบการเงินคริสตจักร</div>
        </div>
      </div>
      <nav style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {NAV_GROUPS.map((g) => (
          <div key={g.label} style={{ padding: "8px 12px 2px" }}>
            <p style={{ margin: "0 0 4px", padding: "0 4px", fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "color-mix(in oklch, var(--sidebar-icon) 70%, transparent)" }}>{g.label}</p>
            {g.items.map((it) => {
              const isActive = active === it.key;
              return (
                <a key={it.key} href="#" onClick={(e) => { e.preventDefault(); onNavigate(it.key); }}
                  style={{
                    position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
                    height: "36px", padding: "0 12px", borderRadius: "8px", textDecoration: "none",
                    fontSize: "13px", fontWeight: 500,
                    background: isActive ? "var(--sidebar-accent)" : "transparent",
                    color: isActive ? "var(--sidebar-primary)" : "var(--sidebar-icon)",
                  }}
                >
                  {isActive && <span style={{ position: "absolute", left: 0, top: "6px", bottom: "6px", width: "2px", borderRadius: "2px", background: "var(--sidebar-primary)" }} />}
                  <span>{it.label}</span>
                  {it.badge && <span style={{ fontSize: "10px", fontWeight: 700, background: "var(--pending)", color: "var(--pending-foreground)", borderRadius: "999px", padding: "1px 6px" }}>{it.badge}</span>}
                </a>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
window.Sidebar = Sidebar;
