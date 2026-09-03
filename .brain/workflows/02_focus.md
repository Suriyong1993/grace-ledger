# Workflow 02: Focus (การวางแผนและลงมือพัฒนา)

> **เป้าหมาย:** ซอยงานเป็นขั้นตอนย่อยที่ปลอดภัย จัดลำดับความสำคัญตามมาตรฐาน Grace Ledger และลงมือพัฒนาอย่างเป็นระบบ

---

## ลำดับความสำคัญในการพัฒนางาน (Priority Hierarchy)

ทุกฟีเจอร์หรือการแก้ไข ต้องจัดลำดับและทำตาม 4 ชั้นนี้เสมอ:

```text
P0: Financial Safety & Invariants (ความถูกต้องของเงิน, math, RLS, RBAC)
 ↓
P1: Backend & Database (PostgreSQL schema, RPCs, Security Definers)
 ↓
P2: Frontend & Components (Vanilla TypeScript UI, render*Html, styles)
 ↓
P3: Verification & Tests (Vitest, browser verification 390px/desktop)
```

---

## ขั้นตอนปฏิบัติ (Action Steps)

1. **แบ่งงานเป็น Tasks ย่อย**:
   - แต่ละ Task ควรมีขอบเขตชัดเจนและทดสอบได้
   - ห้ามข้ามขั้นตอน P0 โดยเด็ดขาด

2. **เขียนโค้ดตามแนวทาง Grace Ledger**:
   - **เงิน**: ใช้ `Money.from(...)` จาก `src/lib/money.ts` เสมอ
   - **UI**: ใช้ Vanilla TypeScript + `app.css` (`.gl-*` classes) ห้ามใช้ React
   - **Design Tokens**: ดึงจาก `design-system-extracted/tokens/*.css` เสมอ
   - **Single Source of Truth**: ห้ามฮาร์ดโค้ดค่าสี/ขนาด/ข้อความซ้ำซ้อน

3. **เขียน Test คู่กับโค้ดเสมอ**:
   - เพิ่มหรือปรับปรุง unit test ใน `tests/unit/` ให้ครอบคลุมทั้ง Happy Path และ Failure Path
   - ถ้าแก้ markup ให้ตรวจสอบ assertion ของ HTML string ใน test อย่างระมัดระวัง
