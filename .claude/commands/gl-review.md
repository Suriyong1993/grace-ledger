# /gl-review — ตรวจโค้ดก่อน merge

ตรวจโค้ดอย่างละเอียดตาม Quality Gates ของ Grace Ledger:

## 1. Financial Correctness
- ทุกค่าเงินใช้ `decimal.js`
- การคำนวณถูกต้องไม่มี rounding error
- บัญชีสมดุล
- ไม่มี hardcoded financial numbers

## 2. Security Review
- RLS ยังทำงาน — ไม่มี data leak ระหว่าง churches
- RBAC ถูกต้อง — ผู้ใช้เห็นเฉพาะของตัวเอง
- ไม่มี unvalidated input ถึง RPC
- SQL injection prevention

## 3. UX Review
- Desktop ✅ + 390px ✅
- Loading/error/empty/success/states ครบ
- Touch targets ≥44px
- Keyboard focus visible
- Label for ทุก input

## 4. Anti-Slop Review
- ไม่มี emoji เป็น UI icon
- ไม่มี gradient background
- ไม่มี orb decoration
- ไม่มี scale-on-hover
- ไม่มี fake data ใน production path
- ไม่มี "TODO" ที่ทำงานไม่ครบ

## 5. Thai Writing Review
- UI copy กระชับ เข้าใจง่าย
- ไม่ใช้ "Screen 06", "Slice 3", "PostgreSQL 17"
- ไม่มี bilingual double-labels
- วันที่ format เดียวกันทั้งแอป

**ผลออกมาในรูปแบบ:**
```
Quality Gate 1 — Functional: PASS / FAIL
Quality Gate 2 — Financial: PASS / FAIL
Quality Gate 3 — Security: PASS / FAIL
Quality Gate 4 — UX: PASS / FAIL
Quality Gate 5 — Writing: PASS / FAIL

สรุป: READY TO SHIP / NEEDS WORK
```

**ห้าม:**
- ❌ PASS โดยไม่ตรวจจริง
- ❌ ข้าม Financial หรือ Security gate
- ❌ ปล่อย AI-sounding copy ผ่าน
