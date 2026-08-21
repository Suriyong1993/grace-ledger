function ApprovalsScreen() {
  const { PageHeader, MoneyText, Button, EmptyState } = window.GraceLedgerDesignSystem_b2d940;
  const M = window.MOCK;
  return (
    <div style={{ padding: "24px 28px 40px" }}>
      <PageHeader kicker="กำกับดูแล" title="คิวอนุมัติ" description="ตรวจสอบและอนุมัติรายการก่อนบันทึกเข้าบัญชี" />
      {M.pending.length === 0 ? (
        <EmptyState title="ไม่มีรายการค้างอนุมัติ" description="รายการใหม่จะปรากฏที่นี่" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {M.pending.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "16px 20px", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", background: "var(--card)", boxShadow: "var(--shadow-sm-card)" }}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>{p.description}</div>
                <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "2px" }}>{p.meta}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <MoneyText value={p.amount} tone={p.kind} />
                <div style={{ display: "flex", gap: "6px" }}>
                  <Button variant="outline" size="sm">ปฏิเสธ</Button>
                  <Button size="sm">อนุมัติ</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
window.ApprovalsScreen = ApprovalsScreen;
