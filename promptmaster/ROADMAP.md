# ROADMAP — Grace Ledger

> เอกสารนี้คือแผนงานจริงที่แบ่งงานเป็นชิ้นเล็กๆ
> สั่ง AI ทีละ 1 งานเท่านั้น ห้ามสั่งหลายงานพร้อมกัน

---

## วิธีใช้ Roadmap นี้

1. เลือก **Phase ที่ทำอยู่**
2. ดู **งานที่ยังไม่เสร็จ** (⬜)
3. **Copy Template** ด้านล่างของงานนั้น
4. **Paste ใน Claude** แล้วรอให้เสร็จก่อนไปงานถัดไป
5. Mark ว่าเสร็จแล้ว (✅) แล้วค่อยไปงานถัดไป

---

## Phase 0 — Foundation (ทำก่อนทุกอย่าง)

งานใน Phase นี้คือสร้างพื้นฐานให้มั่นคงก่อน

| # | งาน | สถานะ | ประมาณเวลา |
|---|-----|-------|------------|
| 0.1 | ✅ สร้าง MASTER_PROMPT.md | ✅ เสร็จ | — |
| 0.2 | ✅ สร้าง PRODUCT_BIBLE.md | ✅ เสร็จ | — |
| 0.3 | ✅ สร้าง DESIGN_BIBLE.md | ✅ เสร็จ | — |
| 0.4 | ✅ สร้าง ENGINEERING_BIBLE.md | ✅ เสร็จ | — |
| 0.5 | ✅ สร้าง AI_BIBLE.md | ✅ เสร็จ | — |
| 0.6 | ✅ รัน verification commands และ fix errors | ✅ เสร็จ | — |

### Template สำหรับงาน 0.6

```
[CONTEXT]
Project: Grace Ledger
Read: promptmaster/MASTER_PROMPT.md, promptmaster/ENGINEERING_BIBLE.md

[TASK]
รัน verification commands ทั้ง 4 ข้อและแก้ไข errors ที่พบ:
1. npm run lint
2. npm run typecheck
3. npm test
4. npm run build

[EXPECTED RESULT]
ทุกคำสั่ง Pass โดยไม่มี errors
แสดง output ของแต่ละ command ให้ฉันดู

[CONSTRAINTS]
- แก้เฉพาะ errors ที่พบ
- ห้ามเปลี่ยน Business Logic
- ห้ามเปลี่ยน API structure
```

---

## Phase 1 — Dashboard (🔴 Priority สูงสุด)

**เป้าหมาย:** เปิดแล้วเห็นสถานะการเงินทันที ไม่ต้องคลิกอะไร

| # | งาน | สถานะ | ประมาณเวลา |
|---|-----|-------|------------|
| 1.1 | ✅ ตรวจสอบ Dashboard ปัจจุบัน — อะไรทำงานได้/ไม่ได้ | ✅ เสร็จ | — |
| 1.2 | ✅ แสดงยอดเงินสดคงเหลือ (ตัวใหญ่) | ✅ เสร็จ | — |
| 1.3 | ✅ แสดงรายรับ/รายจ่ายเดือนนี้ | ✅ เสร็จ | — |
| 1.4 | ✅ แสดงรายการรออนุมัติ (Action Required) | ✅ เสร็จ | — |
| 1.5 | ✅ แสดง Recent Transactions (5 รายการล่าสุด) | ✅ เสร็จ | — |
| 1.6 | ✅ เปรียบเทียบกับสัปดาห์/เดือนก่อน (% change) | ✅ เสร็จ | — |

### Template สำหรับงาน 1.2

```
[CONTEXT]
Project: Grace Ledger — The Intelligent Financial Management Platform for Churches
Read: promptmaster/MASTER_PROMPT.md, promptmaster/PRODUCT_BIBLE.md, promptmaster/DESIGN_BIBLE.md

[TASK]
แก้ไข Dashboard ให้แสดงยอดเงินสดคงเหลือรวมทุก Fund เป็นตัวเลขขนาดใหญ่

[FILE TO EDIT]
หน้า Dashboard (หาไฟล์ route ที่เกี่ยวข้องใน src/routes/)

[EXPECTED RESULT]
- ตัวเลขยอดเงินสดคงเหลือ ขนาดใหญ่ อ่านได้ชัดเจน
- ใช้ font Kanit ขนาดอย่างน้อย 2.5rem
- Format: ฿ 1,234,567.00 (มี comma, 2 decimal)
- ใช้ class num-display เสมอ
- ดึงข้อมูลจาก API จริง ไม่ใช่ hardcode

[CONSTRAINTS]
- ใช้ Money class สำหรับ calculation
- church_id tenant isolation ทุก query
- ห้ามใช้ floating point
- ห้ามเขียน TODO หรือ Placeholder

[VERIFICATION]
npm run lint && npm run typecheck && npm test && npm run build
```

---

## Phase 2 — Transaction Workflow (🔴 สำคัญมาก)

**เป้าหมาย:** Workflow ครบตั้งแต่บันทึก → อนุมัติ → Audit Trail

| # | งาน | สถานะ | ประมาณเวลา |
|---|-----|-------|------------|
| 2.1 | ⬜ ทดสอบ Workflow ปัจจุบัน: บันทึก→ส่ง→อนุมัติ | ⬜ | 30 นาที |
| 2.2 | ⬜ หน้าบันทึกรายการ (Income/Expense) ทำงานได้ครบ | ⬜ | 2 ชั่วโมง |
| 2.3 | ⬜ หน้า Pending Approvals สำหรับ Pastor | ⬜ | 2 ชั่วโมง |
| 2.4 | ⬜ ปุ่ม Approve / Reject พร้อม reason | ⬜ | 1 ชั่วโมง |
| 2.5 | ⬜ Void Transaction พร้อม reason | ⬜ | 1 ชั่วโมง |
| 2.6 | ⬜ Toast notification เมื่อ status เปลี่ยน | ⬜ | 1 ชั่วโมง |

---

## Phase 3 — Role-Based Access (🔴 Security)

**เป้าหมาย:** แต่ละ Role เห็นและทำได้ตามสิทธิ์

| # | งาน | สถานะ | ประมาณเวลา |
|---|-----|-------|------------|
| 3.1 | ⬜ ตรวจสอบ Permission matrix ปัจจุบัน | ⬜ | 30 นาที |
| 3.2 | ⬜ ซ่อน/แสดง Menu ตาม Role | ⬜ | 2 ชั่วโมง |
| 3.3 | ⬜ ซ่อน/แสดง Action buttons ตาม Role | ⬜ | 2 ชั่วโมง |
| 3.4 | ⬜ Server-side permission check ทุก API endpoint | ⬜ | 3 ชั่วโมง |
| 3.5 | ⬜ ทดสอบแต่ละ Role: super_admin, pastor, treasurer, auditor | ⬜ | 1 ชั่วโมง |

---

## Phase 4 — Audit Trail & History (🔴 Trust)

**เป้าหมาย:** ดูย้อนหลังได้ทุกการเปลี่ยนแปลง

| # | งาน | สถานะ | ประมาณเวลา |
|---|-----|-------|------------|
| 4.1 | ⬜ ตรวจสอบว่า Audit Trail บันทึกครบทุก Action | ⬜ | 1 ชั่วโมง |
| 4.2 | ⬜ หน้า Transaction History (ดูย้อนหลังได้) | ⬜ | 2 ชั่วโมง |
| 4.3 | ⬜ แสดง Who did What When ชัดเจน | ⬜ | 1 ชั่วโมง |
| 4.4 | ⬜ Export Audit Trail เป็น CSV | ⬜ | 2 ชั่วโมง |

---

## Phase 5 — Reports & Export (🟡 ต้องมี)

**เป้าหมาย:** Export รายงานได้จริง

| # | งาน | สถานะ | ประมาณเวลา |
|---|-----|-------|------------|
| 5.1 | ⬜ รายงานรายรับ-รายจ่ายรายเดือน (PDF) | ⬜ | 3 ชั่วโมง |
| 5.2 | ⬜ Export CSV สำหรับ Excel | ⬜ | 2 ชั่วโมง |
| 5.3 | ⬜ รายงาน Fund Summary | ⬜ | 2 ชั่วโมง |
| 5.4 | ⬜ ใบอนุโมทนาบัตร (Giving Statement) | ⬜ | 3 ชั่วโมง |

---

## Phase 6 — UI Polish (🟡 ทำหลัง Core เสร็จ)

**เป้าหมาย:** ดูดี ใช้งานสะดวก บน iPad

| # | งาน | สถานะ | ประมาณเวลา |
|---|-----|-------|------------|
| 6.1 | ⬜ ทดสอบบน iPad — ปรับ layout ที่มีปัญหา | ⬜ | 2 ชั่วโมง |
| 6.2 | ⬜ ฟอนต์ขนาดใหญ่ขึ้น ทุกหน้า | ⬜ | 1 ชั่วโมง |
| 6.3 | ⬜ Empty States ทุก list/table | ⬜ | 2 ชั่วโมง |
| 6.4 | ⬜ Loading States ทุก async action | ⬜ | 2 ชั่วโมง |
| 6.5 | ⬜ Error messages เป็นภาษาไทย เข้าใจง่าย | ⬜ | 1 ชั่วโมง |
| 6.6 | ⬜ Mobile responsive — bottom navigation | ⬜ | 3 ชั่วโมง |

---

## Phase 7 — AI Features (🟢 อนาคต)

ทำหลังจาก Phase 1-6 เสร็จสมบูรณ์แล้วเท่านั้น

| # | งาน | สถานะ | ประมาณเวลา |
|---|-----|-------|------------|
| 7.1 | ⬜ AI OCR ใบเสร็จ (มีอยู่แล้ว — ทดสอบและ UI) | ⬜ | 2 ชั่วโมง |
| 7.2 | ⬜ Grace Assistant (Q&A) — Basic | ⬜ | 1 วัน |
| 7.3 | ⬜ LINE Bot แจ้งเตือน | ⬜ | 2 วัน |
| 7.4 | ⬜ Grace Analyst (Financial Analysis) | ⬜ | 2 วัน |
| 7.5 | ⬜ RAG Knowledge Base | ⬜ | 3 วัน |
| 7.6 | ⬜ Hermes Orchestrator | ⬜ | 1 สัปดาห์ |

---

## วิธีสั่ง AI อย่างถูกต้อง

### ✅ สั่งแบบนี้ (ได้ผล)

```
แก้ Dashboard ให้แสดงยอดเงินสดคงเหลือรวมทุก Fund
โดยดึงข้อมูลจาก API จริง แสดงเป็น ฿ 1,234,567.00
ตัวอักษร Kanit ขนาด 2.5rem สีเข้ม
```

### ❌ ห้ามสั่งแบบนี้ (ไม่ได้ผล)

```
ช่วยปรับปรุงระบบให้ดีขึ้น
ช่วย redesign ทั้งหมด
ทำให้ดูดีกว่านี้
```

---

## Progress Tracking

อัปเดตที่นี่เมื่องานเสร็จ:

| Phase | งานทั้งหมด | เสร็จแล้ว | เหลือ |
|-------|----------|-----------|-------|
| Phase 0 — Foundation | 6 | 6 | 0 |
| Phase 1 — Dashboard | 6 | 6 | 0 |
| Phase 2 — Workflow | 6 | 0 | 6 |
| Phase 3 — Roles | 5 | 0 | 5 |
| Phase 4 — Audit | 4 | 0 | 4 |
| Phase 5 — Reports | 4 | 0 | 4 |
| Phase 6 — Polish | 6 | 0 | 6 |
| Phase 7 — AI | 6 | 0 | 6 |

---

_Version: 2.0 | July 2026 | อัปเดตทุกครั้งที่งานเสร็จ_
