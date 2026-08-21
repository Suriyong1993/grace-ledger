function Topbar({ user }) {
  return (
    <header style={{ height: "56px", borderBottom: "1px solid var(--border)", background: "var(--background)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0 }}>
      <div style={{ display: "flex", gap: "4px" }}>
        {["ภาพรวม", "รายรับ", "รายจ่าย", "เงินถวาย", "รายงาน"].map((l, i) => (
          <span key={l} style={{ fontSize: "12.5px", fontWeight: 500, padding: "6px 12px", borderRadius: "999px", color: i === 0 ? "var(--background)" : "var(--muted-foreground)", background: i === 0 ? "var(--foreground)" : "transparent" }}>{l}</span>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ width: "34px", height: "34px", borderRadius: "8px", background: "var(--secondary)", display: "grid", placeItems: "center", fontSize: "13px", color: "var(--muted-foreground)" }}>🔍</span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid var(--border)", borderRadius: "10px", padding: "5px 10px" }}>
          <span style={{ width: "22px", height: "22px", borderRadius: "6px", background: "var(--primary)", color: "#fff", fontSize: "11px", fontWeight: 700, display: "grid", placeItems: "center" }}>{user.name[0]}</span>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground)" }}>{user.name}</div>
            <div style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>{user.role}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
window.Topbar = Topbar;
