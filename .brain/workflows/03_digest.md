# Workflow 03: Digest (การตรวจสอบคุณภาพผ่าน 5 Quality Gates)

> **เป้าหมาย:** ทบทวนงานเทียบกับเกณฑ์ความปลอดภัยทั้ง 5 ด้าน ก่อนจะส่งต่อไปยังขั้นตอน Wrap หรือ Ship
> เกณฑ์เหล่านี้ผ่านได้ด้วย "หลักฐานเชิงประจักษ์ (Evidence)" เท่านั้น ไม่ผ่านด้วยความรู้สึกหรือข้อความกล่าวอ้าง

---

## 5 Quality Gates Checklists

### 1. Functional Correctness (ความถูกต้องตามฟังก์ชัน)
- [ ] Happy path ทำงานได้สมบูรณ์
- [ ] Failure path (กรณีผิดพลาด/ข้อมูลไม่ครบ/เน็ตเวิร์กล้มเหลว) แสดง Error State ชัดเจน (Fail-Closed)
- [ ] ไม่มี mock data หรือ fallback หลุดไปใน production path

### 2. Financial Correctness (ความถูกต้องทางการเงิน)
- [ ] ทุกค่าเงินใช้ `Money` (`decimal.js`) — ไม่มีตัวแปร `number` ในการคำนวณเงิน
- [ ] Split Parity: ผลรวมของ split เท่ากับยอดรวมรายการพอดี
- [ ] Two-Person Rule: ผู้สร้างรายการไม่สามารถอนุมัติรายการตนเองได้
- [ ] Invariant ไม่ติดลบ (Non-negative) ถูกบังคับใช้

### 3. Security Review (ความปลอดภัยและสิทธิ์)
- [ ] ตารางใหม่หรือแถวที่เพิ่มมี RLS ครอบคลุม และไม่ลืมส่ง `church_id`
- [ ] RBAC ตรวจสอบสิทธิ์ถูกต้อง (เช่น `finance_staff`, `treasurer`)
- [ ] ไม่มีการรั่วไหลของข้อมูลข้าม Tenant (คริสตจักร)

### 4. UX & Design Review (การออกแบบและการแสดงผล)
- [ ] ตรวจสอบการแสดงผลที่หน้าจอ Desktop และ Mobile (390px)
- [ ] ทุกสถานะของ UI ครบถ้วน: Loading / Empty / Error / Success / Disabled
- [ ] Touch targets ≥ 44px (`--touch-target-min`)
- [ ] ใช้ Semantic Color ถูกต้อง: เขียว=รายรับ, แดง=รายจ่าย, ส้ม=รอดำเนินการ
- [ ] ไม่มี emoji ปนใน UI iconography (ใช้ inline SVG เท่านั้น)

### 5. AI-Slop & Thai Writing Review (ภาษาไทยในระบบ)
- [ ] ภาษาไทยกระชับ เป็นภาษาที่มนุษย์ใช้จริง
- [ ] ไม่มีคำศัพท์เทคนิคภายในบนหน้าจอ (เช่น "Slice 3", "PostgreSQL 17")
- [ ] ไม่มี bilingual double-labels (เช่น "จัดการผลต่าง (Variance Resolution)")
- [ ] รูปแบบวันที่ (Date format) สม่ำเสมอตลอดทั้งหน้า
