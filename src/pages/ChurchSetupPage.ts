import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../lib/supabase/types";

const STEPS = [
  { title: "ข้อมูลคริสตจักร", subtitle: "ชื่อ ที่อยู่ และช่องทางติดต่อ" },
  { title: "การเงิน", subtitle: "สกุลเงิน ปีบัญชี และวงเงินอนุมัติ" },
  { title: "บัญชีเงิน", subtitle: "ธนาคารและเงินสดตั้งต้น" },
  { title: "กองทุน", subtitle: "กองทุนทั่วไปและกองทุนจำกัด" },
  { title: "หมวดหมู่", subtitle: "รายรับและรายจ่ายที่ใช้บ่อย" },
  { title: "การอนุมัติ", subtitle: "กฎอนุมัติและ Two-person rule" },
  { title: "สมาชิก", subtitle: "แนวทางจัดการสมาชิกและผู้ถวาย" },
  { title: "ตรวจสอบและเริ่มใช้", subtitle: "ยืนยันข้อมูลก่อนเปิดใช้งาน" },
] as const;

type SetupState = { name: string; address: string; phone: string; taxId: string; currency: string; fiscalYearStart: string; approvalThreshold: string; timezone: string };
const DEFAULTS: SetupState = { name: "คริสตจักรชีวิตสุขสันต์กาฬสินธุ์", address: "123 ถ.กาฬสินธุ์ อ.เมืองกาฬสินธุ์ จ.กาฬสินธุ์ 46000", phone: "043-000-000", taxId: "", currency: "THB", fiscalYearStart: "01-01", approvalThreshold: "5000", timezone: "Asia/Bangkok" };

function esc(value: string): string { return value.replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" })[c] ?? c); }
function field(label: string, key: keyof SetupState, value: string, type = "text", hint = ""): string { return `<label class="gl-field"><span>${label}</span><input name="${key}" type="${type}" value="${esc(value)}" autocomplete="off" />${hint ? `<small>${hint}</small>` : ""}</label>`; }

export class ChurchSetupPage {
  private step = 0;
  private state: SetupState = { ...DEFAULTS };
  private saving = false;
  private error = "";

  constructor(private readonly supabase: SupabaseClient<Database>, private readonly churchId: string) {}

  async load(): Promise<void> {
    const { data } = await this.supabase.from("churches").select("name,address,phone,tax_id,currency,settings").eq("id", this.churchId).single();
    if (!data) return;
    const settings = (data.settings ?? {}) as Record<string, Json>;
    const onboarding = (settings.onboarding ?? {}) as Record<string, Json>;
    this.state = {
      name: data.name || DEFAULTS.name, address: data.address || DEFAULTS.address, phone: data.phone || DEFAULTS.phone, taxId: data.tax_id || "", currency: data.currency || "THB",
      fiscalYearStart: typeof onboarding.fiscalYearStart === "string" ? onboarding.fiscalYearStart : DEFAULTS.fiscalYearStart,
      approvalThreshold: typeof onboarding.approvalThreshold === "string" ? onboarding.approvalThreshold : DEFAULTS.approvalThreshold,
      timezone: typeof onboarding.timezone === "string" ? onboarding.timezone : DEFAULTS.timezone,
    };
  }

  renderHtml(): string {
    const current = STEPS[this.step];
    const progress = ((this.step + 1) / STEPS.length) * 100;
    return `<main class="gl-setup-page"><div class="gl-setup-card">
      <header class="gl-setup-head"><div><span class="gl-eyebrow">GRACE LEDGER · CHURCH SETUP</span><h1>ตั้งค่าคริสตจักรของคุณ</h1><p>ตั้งค่าเพียงครั้งเดียว แล้วเริ่มใช้งานการเงินจริงได้ทันที</p></div><strong>${this.step + 1} / ${STEPS.length}</strong></header>
      <div class="gl-progress"><span style="width:${progress}%"></span></div>
      <nav class="gl-setup-steps">${STEPS.map((item, i) => `<button type="button" data-step="${i}" class="${i === this.step ? "active" : ""} ${i < this.step ? "done" : ""}"><b>${i + 1}</b><span>${item.title}</span></button>`).join("")}</nav>
      <section class="gl-setup-body"><div class="gl-setup-copy"><span class="gl-eyebrow">ขั้นที่ ${this.step + 1}</span><h2>${current.title}</h2><p>${current.subtitle}</p></div>${this.renderStep()}</section>
      ${this.error ? `<div class="gl-alert gl-alert-danger">${esc(this.error)}</div>` : ""}
      <footer class="gl-setup-footer"><button class="gl-btn gl-btn-ghost" type="button" data-action="back" ${this.step === 0 ? "disabled" : ""}>ย้อนกลับ</button><button class="gl-btn gl-btn-primary" type="button" data-action="next" ${this.saving ? "disabled" : ""}>${this.step === STEPS.length - 1 ? (this.saving ? "กำลังเปิดใช้งาน…" : "ยืนยันและเริ่มใช้") : "ถัดไป"}</button></footer>
    </div></main>`;
  }

  private renderStep(): string {
    switch (this.step) {
      case 0: return `<div class="gl-form-grid">${field("ชื่อคริสตจักร", "name", this.state.name)}${field("เบอร์โทรศัพท์", "phone", this.state.phone, "tel")}${field("ที่อยู่", "address", this.state.address)}${field("เลขประจำตัวผู้เสียภาษี", "taxId", this.state.taxId, "text", "ไม่บังคับ")}</div>`;
      case 1: return `<div class="gl-form-grid">${field("สกุลเงิน", "currency", this.state.currency)}${field("วันเริ่มปีบัญชี", "fiscalYearStart", this.state.fiscalYearStart, "text", "MM-DD เช่น 01-01")}${field("เขตเวลา", "timezone", this.state.timezone)}${field("วงเงินที่ต้องขออนุมัติ", "approvalThreshold", this.state.approvalThreshold, "number", "บาท")}</div>`;
      case 2: return `<div class="gl-preview-grid"><article><b>บัญชีธนาคารหลัก</b><p>บัญชีกระแสรายวัน</p><strong>฿0.00</strong></article><article><b>เงินสด</b><p>เงินสดประจำคริสตจักร</p><strong>฿0.00</strong></article><p class="gl-muted">ระบบจะสร้างบัญชีตั้งต้นให้ 2 บัญชี ยอดเริ่มต้นเป็นศูนย์</p></div>`;
      case 3: return `<div class="gl-preview-grid"><article><b>กองทุนทั่วไป</b><p>สำหรับพันธกิจทั่วไป</p></article><article><b>กองทุนอาคาร</b><p>กองทุนจำกัดสำหรับอาคารและสถานที่</p></article><p class="gl-muted">ยอดคงเหลือจริงจะมาจากบัญชีแยกประเภท ไม่ใช่ค่าที่กรอกในหน้านี้</p></div>`;
      case 4: return `<div class="gl-chip-list"><span>ถวาย / รายรับทั่วไป</span><span>เงินเดือนและค่าตอบแทน</span><span>ค่าสาธารณูปโภค</span><span>พันธกิจ</span><span>อุปกรณ์และสำนักงาน</span><span>อาคารและสถานที่</span></div>`;
      case 5: return `<div class="gl-policy"><div><b>Approval threshold</b><p>รายการที่สูงกว่า ฿${esc(this.state.approvalThreshold)} เข้าศูนย์อนุมัติ</p></div><div><b>Two-person rule</b><p>ผู้สร้างรายการไม่สามารถอนุมัติรายการของตัวเอง</p></div><div><b>Immutable audit</b><p>การอนุมัติ ปฏิเสธ และการเปลี่ยนแปลงสำคัญถูกบันทึกอัตโนมัติ</p></div></div>`;
      case 6: return `<div class="gl-policy"><div><b>สมาชิก</b><p>เพิ่มและนำเข้าสมาชิกภายหลังได้ โดยข้อมูลยังแยกตามคริสตจักร</p></div><div><b>ผู้ถวาย</b><p>ข้อมูลผู้ถวายแยกจากสมาชิกและจำกัดเฉพาะฝ่ายการเงิน</p></div></div>`;
      default: return `<div class="gl-review"><div><span>คริสตจักร</span><b>${esc(this.state.name)}</b></div><div><span>สกุลเงิน</span><b>${esc(this.state.currency)}</b></div><div><span>เขตเวลา</span><b>${esc(this.state.timezone)}</b></div><div><span>วงเงินอนุมัติ</span><b>฿${esc(this.state.approvalThreshold)}</b></div><div class="gl-review-ok">✓ พร้อมเปิดใช้งานระบบ</div></div>`;
    }
  }

  attachEventListeners(root: HTMLElement, onComplete: () => void): void {
    root.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((button) => button.addEventListener("click", () => { const target = Number(button.dataset.step); if (target <= this.step) { this.step = target; this.rerender(root, onComplete); } }));
    root.querySelector<HTMLButtonElement>("[data-action='back']")?.addEventListener("click", () => { this.step = Math.max(0, this.step - 1); this.rerender(root, onComplete); });
    root.querySelector<HTMLButtonElement>("[data-action='next']")?.addEventListener("click", () => void this.next(root, onComplete));
    root.querySelectorAll<HTMLInputElement>("input[name]").forEach((el) => el.addEventListener("input", () => { this.state[el.name as keyof SetupState] = el.value; }));
  }

  private async next(root: HTMLElement, onComplete: () => void): Promise<void> {
    this.error = "";
    if (this.step < STEPS.length - 1) { this.step += 1; this.rerender(root, onComplete); return; }
    this.saving = true; this.rerender(root, onComplete);
    try {
      const { data: current } = await this.supabase.from("churches").select("settings").eq("id", this.churchId).single();
      const settings = (current?.settings ?? {}) as Record<string, Json>;
      const nextSettings: Record<string, Json> = { ...settings, onboarding: { completed: true, completedAt: new Date().toISOString(), fiscalYearStart: this.state.fiscalYearStart, approvalThreshold: this.state.approvalThreshold, timezone: this.state.timezone, version: 1 } };
      const { error } = await this.supabase.from("churches").update({ name: this.state.name, address: this.state.address, phone: this.state.phone, tax_id: this.state.taxId || null, currency: this.state.currency, settings: nextSettings }).eq("id", this.churchId);
      if (error) throw error;
      await this.seedDefaults();
      onComplete();
    } catch (error) {
      this.error = error instanceof Error ? error.message : "ไม่สามารถบันทึกการตั้งค่าได้";
      this.saving = false; this.rerender(root, onComplete);
    }
  }

  private async seedDefaults(): Promise<void> {
    const [{ data: accounts }, { data: funds }, { data: categories }] = await Promise.all([
      this.supabase.from("accounts").select("name").eq("church_id", this.churchId),
      this.supabase.from("funds").select("name").eq("church_id", this.churchId),
      this.supabase.from("categories").select("name").eq("church_id", this.churchId),
    ]);
    if (!(accounts ?? []).some((r) => r.name === "ธนาคารหลัก")) await this.supabase.from("accounts").insert({ church_id: this.churchId, name: "ธนาคารหลัก", type: "bank", current_balance: "0.00" });
    if (!(accounts ?? []).some((r) => r.name === "เงินสด")) await this.supabase.from("accounts").insert({ church_id: this.churchId, name: "เงินสด", type: "cash_drawer", current_balance: "0.00" });
    if (!(funds ?? []).some((r) => r.name === "กองทุนทั่วไป")) await this.supabase.from("funds").insert({ church_id: this.churchId, name: "กองทุนทั่วไป", description: "สำหรับพันธกิจทั่วไป", current_balance: "0.00" });
    if (!(funds ?? []).some((r) => r.name === "กองทุนอาคาร")) await this.supabase.from("funds").insert({ church_id: this.churchId, name: "กองทุนอาคาร", description: "กองทุนจำกัดสำหรับอาคารและสถานที่", current_balance: "0.00" });
    const defaults: Array<{ name: string; direction: "income" | "expense" }> = [{ name: "ถวาย / รายรับทั่วไป", direction: "income" }, { name: "เงินเดือนและค่าตอบแทน", direction: "expense" }, { name: "ค่าสาธารณูปโภค", direction: "expense" }, { name: "พันธกิจ", direction: "expense" }, { name: "อุปกรณ์และสำนักงาน", direction: "expense" }, { name: "อาคารและสถานที่", direction: "expense" }];
    for (const item of defaults) if (!(categories ?? []).some((r) => r.name === item.name)) await this.supabase.from("categories").insert({ church_id: this.churchId, name: item.name, direction: item.direction });
  }

  private rerender(root: HTMLElement, onComplete: () => void): void { root.innerHTML = this.renderHtml(); this.attachEventListeners(root, onComplete); }
}
