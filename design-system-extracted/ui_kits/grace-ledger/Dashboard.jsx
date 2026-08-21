function DashboardScreen({ onNavigate }) {
  const { PageHeader, StatCard, Button, MoneyText, StatusBadge } = window.GraceLedgerDesignSystem_b2d940;
  const M = window.MOCK;
  const totalBalance = M.funds.reduce((s, f) => s + f.balance, 0);
  return (
    <div style={{ padding: "24px 28px 40px" }}>
      <PageHeader kicker="ภาพรวม" title="แดชบอร์ด" description="สรุปยอดคงเหลือ รายรับ-รายจ่าย และรายการที่รออนุมัติ"
        actions={<Button onClick={() => onNavigate("income")}>+ บันทึกรายรับ</Button>} />

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div className="surface-elevated" style={{ borderRadius: "var(--radius-card)", padding: "28px", background: "var(--card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <p className="kicker">ยอดคงเหลือรวม</p>
            <p className="num-display" style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontSize: "44px", fontWeight: 700, color: "var(--foreground)" }}>฿{totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            <p style={{ margin: "10px 0 0", fontSize: "12px", color: "var(--muted-foreground)" }}>{M.funds.length} กองทุน</p>
          </div>
          <div style={{ display: "flex", gap: "20px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border)", fontSize: "12px", color: "var(--muted-foreground)" }}>
            <span>รับเดือนนี้ <MoneyText value={245000} tone="income" /></span>
            <span>จ่ายเดือนนี้ <MoneyText value={98200} tone="expense" /></span>
          </div>
        </div>
        <div style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border)", background: "var(--card)", padding: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>รอการอนุมัติ</h3>
            <span className="num-display" style={{ fontSize: "11px", fontWeight: 700, color: "var(--warning)", background: "var(--offering-muted)", padding: "2px 8px", borderRadius: "999px" }}>{M.pending.length} รายการ</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
            {M.pending.map((p) => (
              <div key={p.id} style={{ border: "1px solid color-mix(in oklch, var(--border) 70%, transparent)", borderRadius: "10px", padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                  <span style={{ fontSize: "12.5px", fontWeight: 500 }}>{p.description}</span>
                  <MoneyText value={p.amount} tone={p.kind} />
                </div>
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted-foreground)" }}>{p.meta}</p>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" style={{ width: "100%", marginTop: "12px" }} onClick={() => onNavigate("approvals")}>ไปที่คิวอนุมัติ →</Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginBottom: "20px" }}>
        <StatCard label="รายรับเดือนนี้" value="฿245,000.00" tone="success" trend={12.4} hint="38 รายการ" />
        <StatCard label="รายจ่ายเดือนนี้" value="฿98,200.00" tone="danger" trend={-4.1} hint="21 รายการ" />
        <StatCard label="เงินถวายอาทิตย์นี้" value="฿42,500.00" tone="primary" hint="รวมทุกช่องทาง" />
      </div>

      <div style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border)", background: "var(--card)", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "14px" }}>รายการล่าสุด</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead><tr style={{ background: "var(--card)" }}>
            {["วันที่", "รายละเอียด", "หมวดหมู่", "จำนวน", "สถานะ"].map((h, i) => (
              <th key={h} style={{ textAlign: i === 3 ? "right" : i === 4 ? "center" : "left", padding: "8px 20px", fontSize: "11px", color: "var(--muted-foreground)", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {M.recent.map((r, i) => (
              <tr key={i} style={{ background: i % 2 ? "var(--secondary)" : "var(--card)" }}>
                <td className="num-display" style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)" }}>{r.date}</td>
                <td style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)" }}>{r.desc}</td>
                <td style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>{r.category}</td>
                <td style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", textAlign: "right" }}><MoneyText value={r.amount} tone={r.tone} /></td>
                <td style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", textAlign: "center" }}><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
window.DashboardScreen = DashboardScreen;
