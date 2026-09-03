# Grace Ledger — มาตรฐานและรายงานการตรวจประเมินคุณภาพระบบและโค้ด

## (System & Codebase Quality Audit Framework & Current Status Report)

> **เอกสารมาตรฐานหลัก (Single Source of Truth for System Audits & Reviews)**  
> **ปรับปรุงล่าสุด:** 3 กันยายน 2026  
> **สถานะปัจจุบัน:** 64 Test Files / 597 Tests ผ่าน 100% | Typecheck สะอาด | Design Lint สะอาด  
> **หลักการสำคัญ:** _เงินคือแกนหลักของระบบ (Money is the product); ตัวเลขผิดพลาดร้ายแรงกว่าหน้าจอแสดงผลไม่สวย_

---

## 1. บทสรุปผู้บริหารและสถานะสุขภาพระบบ (Executive Summary & Health Scorecard)

Grace Ledger ได้รับการออกแบบให้เป็นระบบปฏิบัติการทางการเงินสำหรับคริสตจักร (Church Financial OS) ภายใต้สถาปัตยกรรม **Vanilla TypeScript + Vite + PostgreSQL 17 (Supabase)** โดยไม่มีการใช้เฟรมเวิร์ก Frontend ขนาดใหญ่ เพื่อเน้นความโปร่งใส ความทนทาน และความปลอดภัยสูงสุด

การตรวจประเมินคุณภาพระบบและโค้ด (Audit & Review) ของ Grace Ledger จะยึดถือเกณฑ์ **5 Quality Gates** อย่างเคร่งครัด โดยผลการประเมินจะไม่ขึ้นกับ "เจตนาในการเขียนโค้ด" แต่ตัดสินด้วย "หลักฐานเชิงประจักษ์" (Evidence-based verification) เท่านั้น

### ตารางสรุปสุขภาพระบบปัจจุบัน (System Health Scorecard)

| เสาหลักคุณภาพ (Quality Gate)                 | เกรดประเมิน | สถานะการทดสอบเชิงประจักษ์                                        | ความเสี่ยงคงเหลือ / ข้อสังเกต                                                           |
| :------------------------------------------- | :---------: | :--------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| **Gate 1: Functional Correctness**           |    **A**    | 596/596 Unit & Integration tests ผ่านครบถ้วน                     | ครอบคลุมทั้ง Happy Path และ Failure Path ทุกโมดูลหลัก                                   |
| **Gate 2: Financial Safety**                 |   **A-**    | Phase 2B Real-PG Concurrency Matrix (13/13 scenarios ผ่าน)       | โค้ดส่วนใหญ่ใช้ `decimal.js` แต่มีจุดแปลง `toNumber()` ใน JSONB RPC payload ของระบบถวาย |
| **Gate 3: Security, RLS & Multi-Tenancy**    |    **A**    | RLS ครบทุกตาราง, Church Isolation ผ่านการทดสอบ Concurrency & E2E | Zero-Knowledge PIN ผ่าน 16/16 edge guards, Tool execution กั้นด้วย HMAC confirmation    |
| **Gate 4: UX & Responsive Craft (390px)**    |   **B+**    | `npm run lint:design` ผ่าน, หน้าจอหลักรองรับ 390px               | ระบบ Modal/Sheet และ Dense Row ปรับตามสถาปัตยกรรม Phase B/C แล้ว รอเก็บตกบางจุดย่อย     |
| **Gate 5: Writing & Single Source of Truth** |   **A-**    | ภาษาไทยกระชับ ไม่มีข้อความ Exception ดิบ, ไม่ใช้ Emoji           | ยังมีแผนการรวมศูนย์ Status Semantics (ตาม D2 ใน DECISIONS.md) รอปรับใช้ในรอบ R3         |

---

## 2. เกณฑ์มาตรฐาน 5 เสาหลัก (The 5 Quality Gates Canonical Standard)

ในการพัฒนา ปรับปรุงโค้ด หรือส่งมอบฟีเจอร์ใดๆ จะต้องผ่านเกณฑ์ทั้ง 5 ข้อนี้อย่างไม่มีข้อยกเว้น:

### Gate 1: ความถูกต้องเชิงฟังก์ชัน (Functional Correctness)

- **Happy Path & Failure Path:** ต้องมีชุดทดสอบครอบคลุมทั้งเส้นทางที่ทำงานสำเร็จและเส้นทางที่เกิดข้อผิดพลาด (Validation error, Network failure, Permission denied)
- **Edge Case Verification:** ทดสอบกรณีแบ่งยอดถวายไม่ตรง (Variance), การกดส่งอนุมัติซ้ำ (Double submission), และการทำงานพร้อมกันของผู้ใช้หลายคน (Race conditions)
- **Markup String Assertions:** ในการทดสอบ UI ห้ามลดทอนความเข้มงวดของ assertion ให้เป็นค่าว่างหรือหลวมเกินไป การแก้โค้ด markup ต้องอัปเดต test อย่างมีสติ

### Gate 2: ความปลอดภัยทางการเงินและความถูกต้องของตัวเลข (Financial Safety - Hard Stop)

- **Zero-Tolerance on Floating Point:** ยอดเงินทุกบาททุกสตางค์ต้องคำนวณผ่านคลาส `Money` (`decimal.js`) ใน [src/lib/money.ts](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/lib/money.ts) เท่านั้น **ห้ามใช้ชนิดข้อมูล `number` ของ JavaScript ในการบวกลบคูณหารเงินโดยเด็ดขาด**
- **Split Sum Parity (Invariance):** ผลรวมของ `transaction_splits` ต้องตรงกับ `total_amount` ของธุรกรรมเสมอ
- **Fund Balance Conservation:** ยอดเงินรวมของกองทุนทั้งหมดต้องคงที่เมื่อเกิดการโอนข้ามกองทุน (Fund Transfer) และห้ามเกิด Deadlock เมื่อโอนสวนทางกัน (ต้องใช้ Ascending Lock Order บน UUID)
- **Two-Person Rule:** การทำธุรกรรมจ่ายเงินเกินวงเงิน หรือการ Direct Post ต้องผ่านการยืนยันตัวตนและการอนุมัติจากผู้มีอำนาจอย่างน้อย 2 คน
- **Immutability of Final States:** ธุรกรรมที่อยู่ในสถานะ `posted` หรือ `voided` ต้องเป็น immutable (ห้ามแก้ไขหรือลบทั้งผ่านหน้าเว็บและผ่านคำสั่ง Direct SQL โดยมี Trigger คอยล็อกไว้)

### Gate 3: ความปลอดภัย สิทธิ์การเข้าถึง และการแยกข้อมูลคริสตจักร (Security & RLS)

- **100% RLS Enforcement:** ทุกตารางในฐานข้อมูลต้องเปิดใช้งาน Row Level Security (RLS) และผูกเงื่อนไขกับ `church_id` เพื่อป้องกันข้อมูลรั่วไหลข้ามคริสตจักร (Multi-tenancy isolation)
- **Strict RBAC:** การเข้าถึงข้อมูลและการทำรายการต้องตรงตาม Role Matrix ([src/lib/rbac.ts](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/lib/rbac.ts)): Senior Pastor, Executive Pastor, Treasurer, Finance Officer, Offering Counter, Auditor
- **RPC Injection & Input Validation:** ข้อมูลที่ส่งเข้า RPC ของ PostgreSQL ต้องผ่านการ Validate ชนิดข้อมูลและขอบเขตค่า (เช่น ด้วย Zod หรือ Database Constraints)
- **Zero-Knowledge PIN:** การยืนยันตัวตนด้วย PIN ทางการเงินต้องใช้สถาปัตยกรรมทางคริปโตกราฟีที่เซิร์ฟเวอร์ไม่ล่วงรู้รหัสผ่านจริง และ Token ต้องมีอายุสั้น (Single-use, Time-bounded)

### Gate 4: ประสบการณ์ใช้งาน งานประณีต และระบบดีไซน์ (UX & Responsive Craft)

- **Mobile-First Target (390px):** หน้าจอทุกหน้าต้องเปิดใช้งานบนความกว้าง **390px** ได้สมบูรณ์ โดยไม่มีการล้นออกนอกจอในแนวนอน (No horizontal overflow)
- **Touch Targets:** ปุ่ม ลิงก์ และจุดสัมผัสทั้งหมดต้องมีขนาดไม่น้อยกว่า **44px** (`--touch-target-min`)
- **Complete UI States (8 สถานะ):** ส่วนประกอบ UI ต้องรองรับสถานะอย่างครบถ้วน:
  1. _Loading_ (สถานะกำลังโหลดข้อมูล)
  2. _Empty_ (สถานะยังไม่มีข้อมูล — ใช้ตระกูล `gl-empty-center` และ SVG สื่อความหมาย)
  3. _Error_ (สถานะแจ้งเตือนข้อผิดพลาดที่ผู้ใช้แก้ไขได้)
  4. _Success_ (สถานะแจ้งผลสำเร็จพร้อมตัวเลขยืนยัน)
  5. _Disabled_ (สถานะปิดการใช้งานพร้อมเหตุผล)
  6. _Permission-Denied_ (สถานะไม่มีสิทธิ์เข้าถึง)
  7. _Stale_ (สถานะข้อมูลเดิมขณะรออัปเดต)
  8. _Validation_ (สถานะตรวจสอบข้อมูลก่อนส่ง)
- **Design Tokens & No Hardcoding:** ต้องใช้เฉพาะ Design Tokens จาก `design-system-extracted/tokens/*.css` โดยผ่านคลาส `.gl-*` ใน [src/styles/app.css](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/styles/app.css) ห้ามเขียน inline style ระบุสี, border-radius, box-shadow, หรือ font-size เด็ดขาด (`npm run lint:design` ต้องผ่านเสมอ)
- **Color Semantics:** สีมีความหมายตายตัว: สีเขียวมรกต (`--income`) = รายรับ, สีเหลืองอำพัน (`--pending`) = รออนุมัติ/ข้อควรระวัง, สีแดง (`--expense`) = รายจ่าย/ข้อผิดพลาด ห้ามนำสีอื่นมาใช้ประดับโดยไม่มีเหตุผล

### Gate 5: สำนวนภาษาไทยและความเป็นแหล่งความจริงเดียว (Thai Copy & Single Source of Truth)

- **Concise Human Thai:** ภาษาไทยสั้นกระชับ ตรงประเด็น สื่อสารสถานะตรงไปตรงมา
  - _ไม่ถูกต้อง:_ "ระบบตรวจพบความคลาดเคลื่อนของยอดเงินซึ่งอาจส่งผลกระทบต่อความถูกต้องของข้อมูล"
  - _ถูกต้อง:_ "ยอดไม่ตรงกัน ฿50"
- **No Bilingual Double-Labels:** ห้ามใช้ป้ายกำกับสองภาษาคู่กัน เช่น "จัดการผลต่าง (Variance Resolution)" ให้เลือกภาษาไทยที่เข้าใจง่ายเพียงอย่างเดียว
- **No Internal Jargon:** ห้ามมีคำศัพท์ทางเทคนิคหลุดไปที่หน้าจอ เช่น ไม่พูดถึง "PostgreSQL 17", "Slice 3", "Screen 06" หรือแสดง Error stack trace ดิบๆ
- **Single Source of Truth:** ค่าคงที่ สี ตัวเลขการตั้งค่า ป้ายกำกับสถานะ (Status labels) ต้องประกาศไว้ที่ไฟล์แหล่งความจริงเดียว (Authoritative file) ห้ามคัดลอกไปนิยามซ้ำหลายที่

---

## 3. ผลการตรวจประเมินระบบปัจจุบันเชิงลึก (In-Depth Audit Findings)

จากการสแกนและตรวจสอบโครงสร้างโค้ดทั้ง Full-Stack (Database, Domain/Services, UI Pages, Build System) พบรายละเอียดดังต่อไปนี้:

```
========================================================================================
รหัสรายการ | ระดับความรุนแรง | ตำแหน่งไฟล์                               | รายละเอียดการตรวจพบ
========================================================================================
FIND-01   | HIGH (P1)       | src/lib/offering/offering-service.ts:160  | การส่ง amount ใน JSONB RPC payload
          |                 |                                           | มีการเรียก .toNumber() ส่งเข้า RPC
          |                 |                                           | เสี่ยงต่อ floating-point drift
----------------------------------------------------------------------------------------
FIND-02   | MEDIUM (P2)     | src/lib/ai/confirmation-engine.ts:146     | Dynamic import("crypto") ในโค้ด
          |                 | src/lib/transactions/idempotency.ts:38    | ฝั่งไคลเอนต์ ทำให้เกิด Vite build
          |                 |                                           | warning ตอน bundle browser assets
----------------------------------------------------------------------------------------
FIND-03   | MEDIUM (P2)     | src/pages/TransactionsPage.ts             | สถานะ TransactionStatus ยังมี map
          |                 | src/components/approvals/StatusBadge.ts   | ซ้ำซ้อนหลายไฟล์ รอการรวมศูนย์ตาม D2
----------------------------------------------------------------------------------------
FIND-04   | LOW (P3)        | src/pages/DashboardPage.ts                | การดึงตัวเลขรายรับ-รายจ่ายประจำเดือน
          |                 |                                           | ควรผูกกับ ReportsService ตาม Q5
========================================================================================
```

### การวิเคราะห์เชิงลึกแต่ละรายการ

#### [FIND-01] การแปลงยอดเงินเป็น `number` ใน RPC Payload ของระบบถวาย

- **ตำแหน่ง:** [src/lib/offering/offering-service.ts](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/lib/offering/offering-service.ts#L160)
- **ปัญหา:** โค้ดแปลง `Money.from(item.amount).toNumber()` เพื่อประกอบเป็นอ็อบเจกต์ JSONB ส่งให้ RPC `create_offering_session` แม้ว่าฝั่ง PostgreSQL จะ cast เป็น `::NUMERIC` แต่ใน JavaScript ตัวเลขขนาดใหญ่หรือทศนิยมอาจเกิด precision loss ก่อนถูกแปลงเป็น JSON string
- **แนวทางแก้ไข:** ส่งเป็นสตริงของตัวเลข (`item.amount.toString()`) หรือแปลงเป็นหน่วยสตางค์ (Integer Cents) โดยให้ PostgreSQL แปลงกลับเป็น NUMERIC จากสตริง

#### [FIND-02] Vite Build Warning เรื่อง `crypto` Module

- **ตำแหน่ง:** [src/lib/ai/confirmation-engine.ts](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/lib/ai/confirmation-engine.ts#L146), [src/lib/transactions/idempotency.ts](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/lib/transactions/idempotency.ts#L38)
- **ปัญหา:** มีการใส่โค้ด fallback `await import("crypto")` สำหรับรันบน Node.js ซึ่งทำให้ Vite ส่งคำเตือน `[plugin vite:resolve] Module "crypto" has been externalized for browser compatibility`
- **แนวทางแก้ไข:** แยก helper ฟังก์ชันสำหรับสภาพแวดล้อม Browser (ใช้ `window.crypto.subtle` เสมอ) และแยกโค้ด Node.js ออกจาก Client runtime bundle

#### [FIND-03] การรวมศูนย์ Transaction Status Semantics (สอดคล้องกับ DECISIONS.md D2)

- **ตำแหน่ง:** [src/pages/TransactionsPage.ts](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/pages/TransactionsPage.ts), [src/components/approvals/StatusBadge.ts](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/components/approvals/StatusBadge.ts)
- **ปัญหา:** มีการนิยามป้ายกำกับสถานะ (เช่น "รอตรวจสอบ" vs "รออนุมัติ", สีประจำสถานะ) แยกกันในแต่ละหน้า
- **แนวทางแก้ไข:** ใช้คลาสหรือโมดูลร่วม `src/components/shared/TransactionStatusBadge.ts` ตามข้อตกลง D2

---

## 4. เกณฑ์การประเมินความรุนแรงและเกณฑ์ตัดสิน (Severity Matrix & Release Readiness)

### นิยามระดับความรุนแรง (Severity Levels)

- **CRITICAL (Hard Stop):** ข้อบกพร่องที่ทำให้ตัวเลขการเงินผิดพลาด, ข้อมูลรั่วไหลข้ามคริสตจักร, สามารถบายพาส RLS หรือฝ่าฝืน Double-Entry / Fund Conservation ได้ **(บล็อกการปล่อยระบบทันที ต้องหยุดงานอื่นเพื่อแก้ไข)**
- **HIGH:** ข้อบกพร่องด้านความปลอดภัยที่อาจเกิดขึ้นได้ในกรณีพิเศษ, ปัญหาการแสดงผลบนหน้าจอ 390px ที่ทำให้ผู้ใช้กดปุ่มทำธุรกรรมไม่ได้, การแปลงตัวเลขที่มีความเสี่ยง **(ต้องแก้ไขก่อนเปิดให้ผู้ใช้งานจริงในคริสตจักร)**
- **MEDIUM:** หนี้ทางเทคนิค (Technical Debt), ความซ้ำซ้อนของนิยามข้อมูล (Violation of Single Source of Truth), Build warnings ที่ไม่กระทบการทำงานหลัก
- **LOW:** การปรับแต่งถ้อยคำภาษาไทยให้สละสลวยยิ่งขึ้น, การจัดระยะห่าง (Spacing) ให้เนียนตาตามโทเค็น

### ตารางประเมินความพร้อมปล่อยใช้งานจริง (Release Readiness by Module)

| โมดูลงาน (Module)                     |           ระดับความพร้อม           | เงื่อนไขก่อนอนุมัติให้ใช้งานจริง (Go/No-Go Gate)                                   |
| :------------------------------------ | :--------------------------------: | :--------------------------------------------------------------------------------- |
| **Authentication & PIN**              |      **พร้อมใช้งาน (Ready)**       | ผ่าน 16 zero-knowledge tests ครบถ้วน, ล็อกอินแยกระดับบาทหลวง/เหรัญญิกได้สมบูรณ์    |
| **Dashboard (ภาพรวมการเงิน)**         |      **พร้อมใช้งาน (Ready)**       | มี Operational Spine "งานสัปดาห์นี้" แสดงรายการรออนุมัติและการถวายเรียบร้อย        |
| **Transactions (สมุดบัญชีรายวัน)**    |      **พร้อมใช้งาน (Ready)**       | แถวรายการแบบ Dense Tactile Row, กรองข้อมูลได้ถูกต้อง, รองรับการแสดงผลบนมือถือ      |
| **Approvals (การอนุมัติสองชั้น)**     |      **พร้อมใช้งาน (Ready)**       | แยกประเภทธุรกรรมชัดเจน, ตรวจสอบ Two-Person Rule ในระดับ RPC แน่นหนา                |
| **Offering (การนับและบันทึกยอดถวาย)** | **ต้องเก็บงาน P1 (Action Needed)** | แก้ไข FIND-01 (ส่งยอดเงินเป็นสตริงเข้า RPC) และทดสอบกระบวนการกระทบยอด Variance ซ้ำ |
| **Funds (การบริหารกองทุน)**           |      **พร้อมใช้งาน (Ready)**       | คำนวณยอดคงเหลือและเป้าหมายถูกต้อง, Ascending Lock Order ป้องกัน Deadlock ได้จริง   |
| **Reports (รายงานการเงิน)**           |      **พร้อมใช้งาน (Ready)**       | การแสดงผลตัวเลขใช้สีและโครงสร้าง White Card + Colored Number ตามข้อตกลง D6         |

---

## 5. คู่มือปฏิบัติการตรวจสอบสำหรับทีมและ AI Agents (Operational Audit Runbook)

ในการพัฒนาฟีเจอร์ใหม่ หรือการ Review โค้ดก่อน Merge ทุกครั้ง ให้ปฏิบัติตามลำดับขั้นตอนดังนี้:

### ขั้นตอนที่ 1: ตรวจสอบความถูกต้องของสถาปัตยกรรมและการคำนวณ (Automated Verification)

รันคำสั่งตรวจสอบแบบอัตโนมัติ:

```bash
# 1. รันการทดสอบ Unit และ Integration ทั้งหมด
npm test

# 2. ตรวจสอบ Type Safety และ Design System Lint
npm run lint

# 3. ทดสอบการ Build Client Assets สำหรับ Production
npm run build
```

_เกณฑ์ผ่าน:_ ทั้ง 3 คำสั่งต้องออกจากคำสั่งด้วย exit code `0` และไม่มี Error หลุดรอด

### ขั้นตอนที่ 2: ตรวจสอบแกนความปลอดภัยทางการเงิน (Financial Safety Verification)

ค้นหาว่ามีการใช้ floating point หรือ `number` กับตัวเลขเงินหรือไม่:

```bash
# ค้นหาว่ามีฟังก์ชันคำนวณเงินดิบหรือไม่
grep -rn "Math.round" src/lib/
grep -rn "parseFloat" src/
```

_เกณฑ์ผ่าน:_ การคำนวณยอดเงิน รายรับ รายจ่าย กองทุน ต้องใช้ `Money` จาก [src/lib/money.ts](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/lib/money.ts) เท่านั้น

### ขั้นตอนที่ 3: ตรวจสอบการแสดงผลบนอุปกรณ์พกพา (Mobile Viewport 390px Check)

- เปิดหน้าเว็บด้วยความกว้างหน้าจอ **390px**
- ตรวจสอบว่าตารางบัญชี, ปุ่มกดนับยอดถวาย, และ Modal ยืนยันการทำรายการ พอดีกับหน้าจอ ไม่ล้นไปด้านข้าง และแตะต้องได้สะดวกด้วยนิ้วมือ (Touch Target $\ge 44\text{px}$)

### ขั้นตอนที่ 4: ตรวจสอบสำนวนภาษาไทย (Thai Copywriting Check)

- ตรวจสอบว่าไม่มีภาษาอังกฤษปนในจุดที่ควรเป็นภาษาไทย (ยกเว้นชื่อเฉพาะหรือสัญลักษณ์สากล)
- ตรวจสอบว่าไม่มีการใช้วงเล็บภาษาอังกฤษกำกับหลังคำไทย (No bilingual double-labels)
- ข้อความแสดงสถานะว่างเปล่าหรือข้อผิดพลาดต้องสุภาพและบอกวิธีแก้ไขแก่ผู้ใช้ชัดเจน

### ขั้นตอนที่ 5: การส่งต่องานให้ Specialist Agents

- **เมื่อมีการแก้โค้ดคำนวณเงินหรือ RPC:** ส่งให้ `financial-reviewer` ตรวจสอบ
- **เมื่อมีการสร้างหรือปรับเปลี่ยน UI Component:** ส่งให้ `ui-reviewer` ตรวจสอบ
- **เมื่อมีการเขียนหรือปรับข้อความภาษาไทยในหน้าจอ:** ส่งให้ `thai-writer` ตรวจสอบ

---

## 6. สรุปและขั้นตอนถัดไป (Next Steps)

1. **บันทึกเอกสารนี้เป็นมาตรฐานหลักของโปรเจกต์** เพื่อให้ทีมพัฒนาและ AI Agents ใช้ยึดถือในการทำ Task ต่อๆ ไป
2. **ดำเนินการปรับปรุงประเด็น High Priority (FIND-01):** เปลี่ยนการส่งพารามิเตอร์ `amount` ใน [src/lib/offering/offering-service.ts](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/lib/offering/offering-service.ts) ให้เป็น String หรือ Satang Cents เพื่อขจัดความเสี่ยง Precision loss โดยเด็ดขาด
3. **ขจัด Build Warning (FIND-02):** ปรับปรุง `confirmation-engine.ts` และ `idempotency.ts` ไม่ให้โหลดโมดูล Node.js เข้าสู่ Bundle ฝั่งเบราว์เซอร์
