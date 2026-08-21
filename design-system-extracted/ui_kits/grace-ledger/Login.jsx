function LoginScreen({ onLogin }) {
  const { Input, Button } = window.GraceLedgerDesignSystem_b2d940;
  return (
    <div style={{ minHeight: "760px", display: "grid", placeItems: "center", background: "var(--background)", fontFamily: "var(--font-sans)" }}>
      <div style={{ width: "360px", padding: "36px 32px", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", background: "var(--card)", boxShadow: "var(--shadow-card)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", marginBottom: "28px" }}>
          <img src="../../assets/logo-mark.png" alt="" style={{ width: "56px", height: "56px", borderRadius: "16px" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "18px", color: "var(--foreground)" }}>Grace Ledger</div>
            <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>ระบบการเงินคริสตจักร</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Input label="อีเมล" placeholder="you@church.org" />
          <Input label="รหัสผ่าน" type="password" placeholder="••••••••" />
          <Button style={{ width: "100%", marginTop: "6px" }} onClick={onLogin}>เข้าสู่ระบบ</Button>
        </div>
        <p style={{ marginTop: "18px", textAlign: "center", fontSize: "11px", color: "var(--muted-foreground)" }}>สำหรับผู้ดูแลและผู้ดูแลระบบของคริสตจักร</p>
      </div>
    </div>
  );
}
window.LoginScreen = LoginScreen;
