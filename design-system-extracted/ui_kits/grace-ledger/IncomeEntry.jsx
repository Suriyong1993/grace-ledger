function IncomeEntryScreen() {
  const { PageHeader, Input, Select, Checkbox, Button, Card } = window.GraceLedgerDesignSystem_b2d940;
  const [step] = React.useState(1);
  const steps = ["ประเภท", "รายละเอียด", "แนบเอกสาร", "ยืนยัน"];
  return (
    <div style={{ padding: "24px 28px 40px", maxWidth: "640px" }}>
      <PageHeader kicker="รายรับ" title="บันทึกรายรับใหม่" description="ทีละขั้นตอน ตรวจสอบง่าย ไม่ต้องเข้าใจบัญชีลึก" />
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        {steps.map((s, i) => (
          <div key={s} style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", fontSize: "11px", fontWeight: 700, background: i + 1 <= step ? "var(--primary)" : "var(--secondary)", color: i + 1 <= step ? "#fff" : "var(--muted-foreground)" }}>{i + 1}</span>
            <span style={{ fontSize: "12px", color: i + 1 === step ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: i + 1 === step ? 600 : 400 }}>{s}</span>
          </div>
        ))}
      </div>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Select label="ประเภทรายรับ" value="offering" onChange={() => {}} options={[{ value: "offering", label: "เงินถวาย" }, { value: "donation", label: "เงินบริจาค" }, { value: "other", label: "รายรับอื่น" }]} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <Input label="จำนวนเงิน (บาท)" placeholder="0.00" type="number" />
            <Select label="กองทุน" value="general" onChange={() => {}} options={[{ value: "general", label: "กองทุนทั่วไป" }, { value: "mission", label: "กองทุนพันธกิจ" }]} />
          </div>
          <Input label="รายละเอียด (ถ้ามี)" placeholder="เช่น ถวายอาทิตย์ที่ 3 ส.ค." />
          <Checkbox checked={true} onChange={() => {}} label="ส่งเข้าคิวอนุมัติทันที" />
        </div>
      </Card>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
        <Button variant="outline">ย้อนกลับ</Button>
        <Button>ถัดไป</Button>
      </div>
    </div>
  );
}
window.IncomeEntryScreen = IncomeEntryScreen;
