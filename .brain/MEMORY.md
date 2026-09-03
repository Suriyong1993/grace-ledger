# MEMORY.md — คลังบทเรียนและหลุมพรางทางเทคนิค (Lessons & Gotchas)

> **หลักการบันทึก (Evidence over Assumptions):**
> บันทึกเฉพาะข้อเท็จจริง หลุมพราง และบทเรียนที่เกิดขึ้นจริงในโปรเจกต์ Grace Ledger เท่านั้น ห้ามบันทึกความเห็นลอย ๆ
> AI ทุกตัวต้องอ่านไฟล์นี้ก่อนทำการแก้ไขระบบ เพื่อป้องกันการเกิดบั๊กซ้ำ

---

## 1. ข้อมูลและสกีมาฐานข้อมูล (Database & Schema Gotchas)

### 🚨 1.1 `transaction_splits` Table Requirements
- **`church_id` เป็นคอลัมน์ `UUID NOT NULL` และผูกกับ RLS**:
  นโยบาย `p_splits_insert` ตรวจสอบ `WITH CHECK (church_id = current_user_church_id() AND has_church_access(church_id, 'finance_staff'))`
  *หลุมพราง:* หาก insert split โดยไม่ส่ง `church_id` จะทำให้ PostgreSQL ฟ้อง error ทันทีว่า:
  `new row violates row-level security policy for table "transaction_splits"`
  *กฎเหล็ก:* เวลา insert หรือ replace splits ใน Service หรือ AI tool ต้องแนบ `church_id` ในทุกแถวเสมอ
- **`category_id` อยู่ใน `transaction_splits` เท่านั้น**:
  ตาราง `transactions` ไม่มีคอลัมน์ `category_id` ห้ามใส่ `category_id` ลงใน payload ของ `transactions.insert()` เด็ดขาด ให้ใส่ใน split แต่ละตัวแทน
- **ชื่อคอลัมน์หมายเหตุคือ `note` (เอกพจน์)**:
  ใน `transaction_splits` คอลัมน์คือ `note` ไม่ใช่ `notes` และไม่ใช่ `description` (ฟิลด์ฝั่ง UI อาจชื่อ `notes` แต่ต้องแปลงเป็น `note` ก่อนบันทึกลง DB)
- **Split Immutability Guard**:
  Trigger `trg_enforce_split_immutability` จะบล็อกการ INSERT/UPDATE/DELETE split โดยตรงทันทีหากสถานะของ Parent Transaction ไม่ใช่ `draft`

---

## 2. กฎความปลอดภัยทางการเงิน (Financial Safety Invariants)

### 💰 2.1 การคำนวณเงิน (Money Math)
- **ห้ามใช้ JavaScript `number` สำหรับจำนวนเงินเด็ดขาด**:
  ต้องใช้คลาส `Money` จาก `src/lib/money.ts` (ขับเคลื่อนด้วย `decimal.js`) ทุกกรณี
- **Banker's Rounding (ADR-0004)**:
  การปัดเศษต้องเป็น Half-Even (Banker's Rounding) เสมอ
- **จำนวนเงินเป็นค่าบวกเสมอ (ADR-0001)**:
  `amount` ใน `transactions` และ `transaction_splits` เก็บเป็นตัวเลขบวกเสมอ (`amount > 0`) ทิศทางเงิน (เข้า/ออก/โอน) ถูกกำหนดโดยคอลัมน์ `direction` (`income`, `expense`, `transfer`)

### ⚖️ 2.2 Split Parity Invariant
- ผลรวมของ splits ทุกตัวต้องเท่ากับยอดรวมของ transaction พอดีเป๊ะ:
  `SUM(splits.amount) === transactions.amount`
  ห้ามมีเศษสตางค์หลุดหรือคลาดเคลื่อนแม้แต่ 0.01 บาท

### 👥 2.3 Two-Person Rule (ADR-0002)
- ผู้สร้างรายการ (creator) **ไม่มีสิทธิ์อนุมัติ (approve)** หรือ **บันทึกบัญชีโดยตรง (direct-post)** รายการของตัวเองเด็ดขาด แม้ผู้นั้นจะมีบทบาทเป็น `treasurer` หรือ `super_admin` ก็ตาม

---

## 3. สถาปัตยกรรม UI และการเขียนโค้ด (Frontend Architecture)

### 🖥️ 3.1 Stack Constraints
- **ห้ามนำ React, Vue หรือ Component Library ภายนอกเข้ามา**:
  โปรเจกต์นี้ใช้ **Vanilla TypeScript + Vite** เท่านั้น
- **การเรนเดอร์ UI**:
  ใช้โครงสร้างฟังก์ชัน `render*Html(props): string` + `attachEventListeners(root)` และ full re-render เมื่อ state เปลี่ยน
- **UI Tests อิงข้อความ HTML**:
  Unit tests ของ UI ใน `tests/unit/*-ui.test.ts` ตรวจสอบ assertion ด้วย HTML strings ตรง ๆ หากมีการปรับ markup หรือคลาส CSS จะส่งผลให้เทสต์ไม่ผ่าน ต้องอัปเดตเทสต์อย่างตั้งใจโดยไม่คลาย assertion

### 🎨 3.2 Design System ("Emerald Vault")
- **ความหมายของสีตายตัว (Semantic Colors)**:
  - เขียว/`--income`: เงินเข้า / สถานะเชิงบวก
  - เหลืองส้ม/`--pending`: รอตรวจสอบ / รอดำเนินการ
  - แดง/`--expense`: เงินออก / ข้อผิดพลาด
  - ห้ามสลับหรือใช้สีเพี้ยนไปจาก semantic
- **การใช้ Token**:
  - สีพื้นหลังและตัวหนังสือต้องจับคู่ถูกต้อง เช่น `--*-foreground` ใช้บนพื้นสีทึบ (Solid) เท่านั้น ไม่ใช้บนพื้น `-muted`
- **Mobile Target**:
  - รองรับหน้าจอ 390px (Mobile) เป็นหลัก โดย Touch targets ต้องไม่ต่ำกว่า 44px (`--touch-target-min`)

### ✍️ 3.3 ภาษาไทยใน UI (Thai UI Copy)
- ภาษาไทยกระชับ เป็นธรรมชาติของมนุษย์ ไม่แปลตรงตัวแบบ AI
- ห้ามใช้คำศัพท์เทคนิคภายในบนหน้าจอ เช่น "Slice 3", "Screen 06", "PostgreSQL 17", "(Status: draft)"
- ห้ามใช้ข้อความสองภาษาปนกัน เช่น "จัดการผลต่าง (Variance Resolution)" ให้เลือกใช้ภาษาไทยที่สละสลวย
