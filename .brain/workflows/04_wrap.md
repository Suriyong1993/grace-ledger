# Workflow 04: Wrap (การตรวจสอบยืนยันเชิงประจักษ์)

> **เป้าหมาย:** รันชุดคำสั่ง Automated Verification เพื่อพิสูจน์ว่าระบบทั้งหมดเขียว 100% และไม่มี Regression ใด ๆ

---

## ขั้นตอนการรัน Verification (Verification Commands)

Agent ทุกตัวต้องรันคำสั่งเหล่านี้ตามลำดับก่อนสรุปงาน:

### 1. ตรวจสอบ Type Safety
```bash
npm run typecheck
```
- **เกณฑ์ผ่าน:** ต้องได้ Exit code 0 (ไม่มี TypeScript error หรือ warning แม้แต่จุดเดียว)

### 2. รัน Automated Tests
```bash
npm test
```
- **เกณฑ์ผ่าน:** ทุกไฟล์ใน `tests/unit/` และ `tests/integration/` ต้องผ่าน (Green 100%)
- *หมายเหตุ:* ใน environment ที่ไม่มีสิทธิ์ elevated service account ของ embedded-pg อาจมี integration test บางตัวถูก skip ตามเงื่อนไขได้ แต่ unit tests ทุกไฟล์ต้องผ่าน 100%

### 3. ตรวจสอบการ Build สำหรับ Production
```bash
npm run build
```
- **เกณฑ์ผ่าน:** Vite build สำเร็จ สร้างไฟล์ bundle ใน `dist/` ได้อย่างราบรื่น

### 4. ตรวจสอบ Design System Linting (ถ้ามีการแตะ CSS / Style)
```bash
npm run lint:design
```
- **เกณฑ์ผ่าน:** ไม่มี undocumented literal colors/radius/shadows หลุดเข้ามาใน `src/`

---

## สรุปผลหลักฐาน (Evidence Capture)
- บันทึกจำนวน test ที่รันผ่าน (เช่น 64 test files / 597 tests passed)
- บันทึกสถานะ typecheck และ build ไว้เป็นหลักฐานเพื่อเตรียมส่งต่อในขั้นตอน Handoff
