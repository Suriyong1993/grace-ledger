# M3 Product Audit & Operational Rules
## Sunday Offering & Cash Count Workflow
**Grace Ledger: Church Financial Management System**  
**Date:** 2026-08-18  
**Status:** 🎯 **LOCKED OPERATIONAL RULES & PRODUCT AUDIT (FINAL REVISION)**

---

## 1. Context & Operational Background

หลังจากที่ได้สร้างและพิสูจน์ **Vertical Slice ของ M2 Approval Workflow** สมบูรณ์ครบทุกชั้น (Database $\rightarrow$ RLS/RPC $\rightarrow$ Service $\rightarrow$ UI Shell $\rightarrow$ Chromium Browser E2E) 

การก้าวต่อไปสู่ **M3 (Sunday Offering & Cash Count)** คือการเปลี่ยนผ่านจาก **Engineering Correctness** ไปสู่ **Product Value + Operational Governance** เพื่อแก้ปัญหาหน้างานจริงทางการเงินที่มีความเสี่ยงสูงที่สุดของคริสตจักร นั่นคือ **"การจัดการเงินสดและการตรวจรับเงินถวายวันอาทิตย์ (Sunday Offering Custody Chain)"**

---

## 2. Five Pivotal Product Questions (การตรวจประเมินผลิตภัณฑ์ 5 มิติ)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      5 CORE PRODUCT AUDIT QUESTIONS                     │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. ใครใช้? (Who uses it?)                                               │
│    ► เหรัญญิก (Treasurer) + ผู้ร่วมนับเงิน 2 คน (2 Counters)            │
│                                                                         │
│ 2. ทำงานนี้บ่อยแค่ไหน? (How often?)                                     │
│    ► ทุกสัปดาห์ (วันอาทิตย์หลังนมัสการ) + วันนมัสการพิเศษ               │
│                                                                         │
│ 3. Pain Point คืออะไร? (What are the pain points?)                      │
│    ► นับเหรียญ/แบงก์ผิด, ยอดไม่ตรง, ปนช่องทางเงินสดกับเงินโอน, จัดสรรผิด │
│                                                                         │
│ 4. ข้อมูลเข้าระบบมาจากไหน? (Where does data enter from?)               │
│    ► ถุงถวาย/ซองถวาย ──► แยกตามช่องทาง ──► นับ Denominations เฉพาะเงินสด│
│                                                                         │
│ 5. ถ้าผิด จะเสียหายเท่าไร? (What is the cost/risk of error?)            │
│    ► เงินสดตกหล่น, เสียความไว้วางใจของสมาชิก, บัญชียอดเงินสดคลาดเคลื่อน  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Seven Locked Operational Rules (7 กฎเหล็กเชิงปฏิบัติการฉบับสมบูรณ์)

### Rule 1: แยก Channel ชัดเจน — เปรียบเทียบ Cash Count กับ "Expected Cash" เท่านั้น
* ในหนึ่งรอบนมัสการ เงินถวายประกอบด้วยหลายช่องทาง: **เงินสด (Cash)**, **เงินโอน (Bank Transfer)**, **QR Code / PromptPay**
* **Expected Total:** ยอดรวมการถวายทั้งหมด = $\text{Cash} + \text{Transfer} + \text{QR}$
* **Expected Cash:** ยอดเงินสดที่ระบุจากซอง/ถุงถวาย
* **Actual Counted Cash:** ยอดเงินสดจริงจากการนับธนบัตร + เหรียญ
* **Cash Variance:** $\text{Cash Variance} = \text{Actual Counted Cash} - \text{Expected Cash}$
* **Inviolable Invariant:** **Cash Count จะนำไปเทียบเฉพาะกับ Expected Cash เท่านั้น** (ไม่นำไปเทียบกับยอดรวมที่รวมเงินโอน/QR) และห้ามนำยอด Actual ไปเขียนทับ Expected

```text
ตัวอย่าง:
Expected Entry:
  - เงินสด (Cash):       ฿10,000.00
  - เงินโอน (Transfer):   ฿3,000.00
  - คิวอาร์ (QR):         ฿5,450.00
  ───
  Expected Grand Total: ฿18,450.00

Physical Cash Count:
  - นับธนบัตร + เหรียญได้จริง: ฿9,950.00
  ───
  Cash Variance = ฿9,950.00 - ฿10,000.00 = -฿50.00
  (เงินโอน ฿3,000 และ QR ฿5,450 ไปตรวจสอบผ่านสลิป/Statement ธนาคาร ไม่ใช่นับในตาราง Denominations)
```

### Rule 2: `Offering Session` เป็น Entity หลัก (Aggregate Root) ของงานวันอาทิตย์
```text
Offering Session
      │
      ├── Offering Category Items (ทั่วไป, สิบลด, มิชชั่น, อาคาร, เยาวชน)
      │      ├── Channel Breakdown (Cash / Transfer / QR)
      │      ├── Expected Cash Total
      │      └── Expected Grand Total
      │
      ├── Cash Count (Denominations 1000/500/100/50/20 + Coins)
      │      ├── Counter 1 (สมชาย - เหรัญญิก)
      │      ├── Counter 2 (อรพิน - กรรมการการเงิน)
      │      └── Actual Counted Cash Total
      │
      ├── Cash Variance & Variance Lifecycle
      │
      ├── Confirmed (Dual Signatures Complete)
      │
      └── Posted
             ↓
        Financial Transaction (Income / Split into Funds)
             ↓
        Cash Drawer / Cash on Hand (เงินสดในมือ/ตู้เซฟ) + Bank (เงินโอน/QR)
```

### Rule 3: มี Session Identity ชัดเจนและป้องกันการสร้างซ้ำ (Duplicate Guard)
* **Business Key:** `church_id + service_date + service_name`
* ฐานข้อมูลมี Unique Constraint ป้องกันการสร้าง session ซ้ำในรอบและวันเดียวกันโดยไม่ตั้งใจ

### Rule 4: Dual Counter Invariant — ต้องเป็นคนละคนและระบุบทบาทชัดเจน
* `counter1_id != counter2_id` บังคับใน Database Constraint, RPC, และ UI
* บันทึก Timestamp แยกรายบุคคล: `counter1_signed_at`, `counter2_signed_at`
* UI แสดงชื่อและตำแหน่งชัดเจน (เช่น *"ผู้ตรวจนับคนที่ 1: คุณสมชาย (เหรัญญิก)"* และ *"ผู้ตรวจนับคนที่ 2: คุณอรพิน (กรรมการการเงิน)"*)

### Rule 5: Variance มี Lifecycle สถานะชัดเจน (ไม่ใช่แค่ตัวเลขลอยๆ)
```text
draft ──► counting ──► counted
                         │
                         ├── Cash Variance = ฿0.00 ──► confirmed ──► posted
                         │
                         └── Cash Variance ≠ ฿0.00 ──► variance_review
                                                          ├── 1. recount (นับซ้ำ)
                                                          ├── 2. explain (ระบุเหตุผล)
                                                          └── 3. acknowledge ──► confirmed ──► posted
```

### Rule 6: การแก้ไข Expected Amount ต้องเก็บประวัติและเหตุผล (Immutable Revision Trail)
* **ห้ามแก้ไขตัวเลขเดิมย้อนหลังแบบเงียบๆ (No Silent Updates)**
* หากตรวจพบว่ากรอก Expected Amount ผิดพลาดจากซองถวาย ระบบจะสร้าง **Offering Revision Record**:
  - `original_amount`
  - `revised_amount`
  - `revision_reason`
  - `revised_by`, `revised_at`
* ข้อมูลชุดเดิม, เหตุผล, และ Audit Log จะถูกเก็บไว้เป็นหลักฐานตลอดไป

### Rule 7: แยกสถานะ `confirmed` ออกจาก `posted` และกำหนด Cash Destination ชัดเจน
* **`confirmed` (ได้รับการยืนยัน):** พยานตรวจนับ 2 คนและเหรัญญิกยืนยันความถูกต้องของเงินสดและยอดถวายครบถ้วน ข้อมูลใน Session ถูกล็อกเป็น Immutable
* **`posted` (ลงสมุดบัญชีแล้ว):** ระบบสร้าง Financial Transaction และ Transaction Splits เข้าสู่กองทุนต่างๆ เรียบร้อยแล้ว
* **Cash Destination:** เงินสดจะลงบัญชี **"เงินสดในมือ/ตู้เซฟ (Cash Drawer)"** ส่วนเงินโอน/QR จะลงบัญชี **"ธนาคาร (Bank Account)"**
* การนำเงินสดในตู้เซฟไปฝากธนาคารในวันจันทร์ เป็นกระบวนการ **Transfer Transaction** จาก `Cash Drawer` $\rightarrow$ `Bank Account`

---

## 4. Definition of Done (16 เช็กลิสต์ความสมบูรณ์ของ M3)

- [ ] **1. Session Identity:** มี identity และ metadata ประจำรอบนมัสการชัดเจน
- [ ] **2. Multi-Service Support:** รองรับหลายรอบนมัสการในวันเดียวกัน (Morning, Evening, Special)
- [ ] **3. Channel-Separated Expectations:** แยก Expected Cash ออกจาก Expected Transfer/QR
- [ ] **4. Cash-Only Denomination Count:** ตาราง Denomination เปรียบเทียบกับ Expected Cash เท่านั้น
- [ ] **5. Dual Counter Invariant:** บังคับผู้ตรวจนับ 2 คนไม่ซ้ำกัน (`counter1 != counter2`)
- [ ] **6. Variance Lifecycle:** สถานะผลต่างชัดเจน (`zero_match`, `recounting`, `explained`, `acknowledged`)
- [ ] **7. Mandatory Explanation:** ผลต่างที่ไม่เป็นศูนย์ต้องมีคำอธิบายเหตุผล
- [ ] **8. Immutable Revision Trail:** บันทึกประวัติการแก้ไข Expected พร้อมเหตุผล ห้ามแก้เงียบๆ
- [ ] **9. Duplicate Prevention:** ป้องกันการสร้าง session ซ้ำในรอบเดียวกันผ่าน Unique Constraint
- [ ] **10. Confirmed vs Posted Separation:** แยก State ระหว่างการตรวจรับเงิน (Confirmed) และการลงบัญชี (Posted)
- [ ] **11. Fund Allocation:** ระบุการจัดสรรเงินเข้ากองทุน (General, Building, Mission ฯลฯ) ชัดเจน
- [ ] **12. Account Destination:** เงินสดเข้าบัญชี `Cash Drawer` ส่วนเงินโอน/QR เข้าบัญชี `Bank`
- [ ] **13. Aggregate Separation:** แยก Offering Session Aggregate ออกจาก Financial Transaction
- [ ] **14. Full Audit Trail:** บันทึก Audit Log ทุกเหตุการณ์ (สร้าง, แก้ไข, นับ, ผลต่าง, ยืนยัน, ลงบัญชี)
- [ ] **15. Real PostgreSQL 17 Tests:** ทดสอบ RPC, Constraints, และ Invariants บน DB จริง
- [ ] **16. Real Browser E2E Tests:** ทดสอบ Flow ทั้งหมดจาก Browser จริงผ่าน Playwright
