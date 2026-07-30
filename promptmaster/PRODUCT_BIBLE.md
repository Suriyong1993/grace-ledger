# PRODUCT BIBLE — Grace Ledger

> อ่านก่อน: promptmaster/MASTER_PROMPT.md
> เอกสารนี้อธิบาย "ทำไม" และ "อะไร" — ก่อนจะไปถึง "อย่างไร"

---

## 1. Product Identity

### 1.1 ชื่อและคำนิยาม

- **ชื่อ:** Grace Ledger
- **Tagline:** The Intelligent Financial Management Platform for Churches
- **ไม่ใช่:** โปรแกรมบัญชี, ERP, Dashboard, Government Software
- **คือ:** แพลตฟอร์มบริหารการเงินที่เข้าใจบริบทคริสตจักร

### 1.2 Product Positioning

| Grace Ledger คือ | Grace Ledger ไม่ใช่ |
|-----------------|---------------------|
| Premium | Cheap / Generic |
| Modern | Legacy / Outdated |
| Fast | Slow / Bloated |
| Trustworthy | Risky / Opaque |
| Explainable | Black Box |
| Church-first | One-size-fits-all |
| Financial-first | Everything-in-one ERP |

### 1.3 ประโยคอธิบาย

Grace Ledger ช่วยให้คริสตจักรบริหารการเงินได้อย่างโปร่งใส น่าเชื่อถือ และมี Workflow ที่ชัดเจน โดยไม่ต้องมีความรู้บัญชีขั้นสูง และมี AI ช่วยอธิบายทุกขั้นตอน

---

## 2. ผู้ใช้งานหลัก (User Personas)

### 2.1 เหรัญญิก (Treasurer)
- **บทบาท:** บริหารการเงินประจำวัน บันทึกรายรับ-รายจ่าย
- **สิ่งที่ต้องการ:** ใช้งานง่าย บันทึกได้เร็ว ไม่ต้องรู้บัญชีลึก
- **ปัญหาปัจจุบัน:** ระบบซับซ้อน, กลัวทำผิด, ไม่มั่นใจตัวเลข
- **Permission:** `journal.write`, `offering.write`, `expense.write`, `fund.transfer`

### 2.2 ศิษยาภิบาล (Pastor)
- **บทบาท:** อนุมัติธุรกรรม ดูภาพรวมการเงินคริสตจักร
- **สิ่งที่ต้องการ:** เห็นสรุปชัด อนุมัติรวดเร็ว ไม่ต้องลงรายละเอียดมาก
- **ปัญหาปัจจุบัน:** ต้องรอข้อมูล, ไม่เห็น Big Picture, workflow ไม่ชัด
- **Permission:** `journal.approve`, `offering.approve`, `expense.approve`

### 2.3 คณะกรรมการ (Committee)
- **บทบาท:** ติดตามการเงิน ดูรายงาน ไม่ Edit
- **สิ่งที่ต้องการ:** รายงานเข้าใจง่าย Export ได้ ดูได้บน iPad
- **ปัญหาปัจจุบัน:** ข้อมูลกระจัดกระจาย, ไม่รู้จะดูตรงไหน
- **Permission:** `*.read` (read-only)

### 2.4 ผู้ตรวจสอบบัญชี (Auditor)
- **บทบาท:** ตรวจสอบย้อนหลัง ดู Audit Trail
- **สิ่งที่ต้องการ:** ข้อมูลครบ ย้อนหลังได้ Export ได้ ไม่แก้ไข
- **ปัญหาปัจจุบัน:** ไม่มี Audit Trail ที่น่าเชื่อถือ
- **Permission:** `audit.read`, `*.read` (read-only + audit access)

### 2.5 Super Admin
- **บทบาท:** จัดการระบบ สร้าง User กำหนด Permission
- **สิ่งที่ต้องการ:** ควบคุมได้ทุกอย่าง ไม่มี Blocker
- **Permission:** All permissions

---

## 3. Core Features (สิ่งที่ระบบต้องทำได้)

### 3.1 Financial Management (หัวใจหลัก)

#### Dashboard
- เงินสดคงเหลือ (Current Balance) — ตัวเลขชัด ใหญ่
- เงินถวายวันนี้ — Real-time
- รายรับ/รายจ่ายเดือนนี้
- เปรียบเทียบสัปดาห์ที่แล้ว (% change)
- รายการรออนุมัติ — Action Required badge
- ยอดยกมา (Opening Balance)

#### Transaction Workflow
```
DRAFT → PENDING → APPROVED → (VOIDED)
                ↓
            REJECTED → DRAFT (แก้แล้ว resubmit)
```
- บันทึกรายการ (Draft)
- ส่งอนุมัติ (Submit → Pending)
- อนุมัติ / ปฏิเสธ (Approve / Reject)
- Void พร้อมเหตุผล (ถ้าจำเป็น)
- ทุก State มี Audit Log

#### Offering & Collection
- บันทึกเงินถวายรายวัน
- ใบนับเงิน (Count Sheet) — ต้องมี 2 คนขึ้นไปนับ
- ยืนยันยอด / ล็อค
- สร้าง Journal Entry อัตโนมัติ

#### Expense Management
- บันทึกค่าใช้จ่าย พร้อมแนบใบเสร็จ (AI OCR)
- จัดหมวดหมู่ด้วย Chart of Accounts
- Approval Workflow ตาม Amount Threshold

#### Fund Management
- หลาย Fund ในคริสตจักรเดียว (กองทุนทั่วไป, กองทุนมิชชัน, ฯลฯ)
- โอนระหว่าง Fund พร้อม Audit
- ยอดคงเหลือแต่ละ Fund

#### Approval Thresholds
```
< ฿5,000      → Treasurer หรือ Pastor อนุมัติได้
฿5,000–50,000 → Pastor อนุมัติ
> ฿50,000     → Pastor + Super Admin (Dual Approval)
```

### 3.2 Reporting & Export

- รายงานรายรับ-รายจ่ายรายเดือน
- งบดุล (Balance Sheet)
- งบกำไรขาดทุน (Income Statement)
- รายงานเงินถวายรายบุคคล (ใบอนุโมทนาบัตร)
- Export เป็น PDF และ CSV
- Audit Trail Report

### 3.3 Trust & Accountability

- Audit Trail ทุกรายการ (SHA-256 Hash Chain)
- ย้อนดูประวัติทุก Transaction
- ดูว่าใครทำอะไร เมื่อไหร่
- Export Audit Log สำหรับผู้ตรวจสอบ

---

## 4. สิ่งที่ต้องการในแต่ละ Priority

### 🔴 Priority 1 — ต้องทำก่อน (Must Have Now)

1. **Dashboard ที่อ่านได้ทันที** — เปิดแล้วรู้สถานะการเงินทันที ไม่ต้องคลิกหลาย step
2. **Transaction Workflow ครบ** — Draft→Pending→Approved ทำงานได้จริง
3. **Audit Trail ทุก Action** — บันทึกทุกการเปลี่ยนแปลง ไม่มีช่องโหว่
4. **Export รายงาน** — PDF และ CSV พร้อมใช้
5. **Role Permissions ถูกต้อง** — แต่ละ Role เห็นและทำได้ตามสิทธิ์

### 🟡 Priority 2 — ทำเพิ่มได้ (Should Have)

6. **AI OCR สำหรับใบเสร็จ** — ถ่ายรูปแล้ว AI อ่านตัวเลขให้
7. **Notification System** — แจ้งเตือนเมื่อมีรายการรออนุมัติ
8. **Mobile-responsive UI** — ใช้บน iPhone ได้
9. **Budget vs Actual** — เปรียบเทียบงบประมาณกับค่าใช้จ่ายจริง
10. **Member Giving Report** — ใบอนุโมทนาบัตรรายปี

### 🟢 Priority 3 — อนาคต (Nice to Have)

11. **Grace AI Assistant** — ถามตอบด้วยภาษาธรรมชาติ
12. **LINE Bot Integration** — แจ้งเตือนและรับข้อมูลผ่าน LINE
13. **Hermes AI Orchestrator** — จัดการ AI หลาย Agent
14. **RAG Knowledge Base** — AI ตอบตาม Policy คริสตจักร
15. **Multi-Church Platform** — รองรับหลายคริสตจักรในระบบเดียว

---

## 5. สิ่งที่ไม่ต้องการ (Anti-Patterns)

ห้ามทำสิ่งเหล่านี้โดยเด็ดขาด:

- ❌ กราฟเยอะ — Dashboard ต้องเน้นตัวเลข ไม่ใช่ Visualization
- ❌ เมนูเยอะ — Navigation ต้องเรียบ ลึกได้ไม่เกิน 2 ชั้น
- ❌ ตัวหนังสือเล็ก — ผู้ใช้อาจเป็นผู้สูงอายุ
- ❌ คลิกหลายครั้ง — งานหลักต้องทำได้ใน 3 คลิก
- ❌ ERP หนัก — ไม่เอา Feature ที่คริสตจักรไม่ต้องการ
- ❌ AI Slop — ไม่สร้าง AI Feature เพราะ Trend
- ❌ Placeholder / TODO ในโค้ด — ทุก Feature ต้องสมบูรณ์

---

## 6. Success Criteria

ระบบประสบความสำเร็จเมื่อ:

- เหรัญญิกที่ไม่เคยใช้ระบบสามารถบันทึกธุรกรรมได้ใน 5 นาทีแรก
- ศิษยาภิบาลเปิด Dashboard แล้วเห็นสถานะการเงินทันทีโดยไม่คลิกอะไรเพิ่ม
- ผู้ตรวจสอบบัญชีสามารถ Export Audit Trail ได้ครบโดยไม่ต้องขอความช่วยเหลือ
- ระบบไม่มี Downtime ระหว่าง Service ครอบครัว (อาทิตย์ 9-12 น.)

---

_Version: 2.0 | July 2026_
