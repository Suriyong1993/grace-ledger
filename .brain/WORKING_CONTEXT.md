# WORKING_CONTEXT.md — สถานะการทำงานปัจจุบัน (Active Working State)

> **คำแนะนำสำหรับ AI ทุกตัว (Claude, Codex, Gemini, Antigravity ฯลฯ):**
> ไฟล์นี้คือกระดานสถานะกลาง กรุณาอ่านไฟล์นี้เป็นสิ่งแรกก่อนเริ่มงาน และอัปเดตไฟล์นี้เมื่อมีการเริ่มหรือเปลี่ยน Task

---

## 1. ข้อมูลปัจจุบัน (Current Session)

- **เป้าหมายหลัก (Goal):** Production-readiness audit ทั้ง 7 เฟส (การเงิน / ความปลอดภัย / UX / AI / Audit / Testing) พร้อมแก้จุดเสี่ยงสูงสุดที่พบ — รายงานฉบับเต็มอยู่ที่ `docs/ENGINEERING_REPORT_2026-09-11.md`
- **สถานะรวม (Overall Status):** `AUDIT_HARDENING_COMPLETE` — พบ CRITICAL 7 รายการ แก้แล้ว 6 รายการ / **เหลือ 1 รายการที่ต้องใช้มนุษย์ทำ (rotate `service_role` key)**
- **Agent ที่กำลังทำงาน (Active Agent):** Arena.ai Agent Mode (branch `arena/01a091ad-grace-ledger`)
- **อัปเดตล่าสุด (Last Updated):** 2026-09-11 (Asia/Bangkok)

---

## 2. งานที่ทำเสร็จสิ้น (Completed Tasks)

### รอบ 2026-09-11 — Production-Readiness Audit & Hardening

- [x] **อุดช่องโหว่ Ledger Immutability (CRITICAL):** migration ใหม่ `supabase/migrations/20260911000001_ledger_immutability_hardening.sql`
  - `GL007` — บล็อก `UPDATE funds.current_balance` / `accounts.current_balance` ตรงๆ (เดิม treasurer ทำได้ 1 row)
  - `GL005` — บล็อกแก้ `description` / `metadata` / `posted_at` / `approved_by` / `created_by` / `reference_number` ของธุรกรรมที่ `posted` แล้ว
  - `GL006` — บล็อกเปลี่ยน status ตรงๆ (`posted → draft/voided/rejected`) ยกเว้นผ่าน RPC ที่ถูกต้องเท่านั้น
  - เป็นแบบ additive ล้วน: ไม่ลบตาราง ไม่แก้ RLS ไม่แตะข้อมูลย้อนหลัง ไม่ปิด trigger เดิม
- [x] **ลบ `service_role` key ที่ถูก commit ไว้ (CRITICAL):** สร้าง `scripts/supabase-credentials.mjs` (อ่านจาก env เท่านั้น, fail-loud, ไม่มี fallback) แล้วแก้ 9 สคริปต์ให้มาใช้ตัวนี้
- [x] **สร้าง `scripts/lint-secrets.mjs`:** กฎตรวจจับ 9 ข้อ + allowlist แบบระบุค่า, ผูกเข้ากับ `npm run lint` และ CI — มีเทสต์ของตัวเอง 10 ข้อ
- [x] **แก้บั๊กใบอนุโมทนาบัตร (CRITICAL):** `members-service.ts` map คอลัมน์ผิด (`giving_date`/`notes` แทน `given_at`/`confidential_note`) ทำให้ยอดรวมทุกปีภาษีเป็น **฿0.00** — เพิ่ม `toGivingDate()` และแก้ mock ในเทสต์ที่เคย "ฝังบั๊ก" ไว้
- [x] **ทำให้เทสต์ฐานข้อมูลจริงรันได้บน Linux:** แก้ `scripts/pg-lab.mjs` + เพิ่ม `tests/integration/real-pg-boot.ts` และตั้ง `PGLAB_REQUIRED=1` ในโหมด `pg` เพื่อไม่ให้เทสต์ "ข้ามเงียบๆ" อีก
- [x] ถอน `supabase/.temp/` ออกจาก git index, แดงข้อมูลรหัสผ่านใน `docs/M3_FINAL_VERIFICATION_REPORT.md`, อัปเดต `.env.example`


- [x] จัดทำเอกสาร UX/UI Audit: `docs/ONE_DAY_UX_AUDIT.md` ครอบคลุมเป้าหมาย Modern Financial Dashboard 2026
- [x] ยกระดับการเข้าถึงและความปลอดภัย (Accessibility & Factual Indicators):
- [x] จัดทำเอกสาร Final Verification ครอบคลุม 24 หัวข้อ: `docs/FINAL_UX_VERIFICATION.md` (ยืนยัน PASS 23 รายการ / 1 รายการ Offline, Zero Regression, ไม่มีการ commit/push)
  - เพิ่ม `.gl-skip-link` รองรับ Keyboard Navigation & Assistive Technology ชี้ไปที่ `<main id="main-content">`
  - ปรับปรุงข้อความบนหน้า Login ให้เป็น Factual Capability Indicators (ไม่ใช้คำโฆษณาเกินจริง)
  - เพิ่ม Reduced-Motion safety rules สำหรับ interactive elements (`.gl-btn`, `.gl-card`, `.gl-dash-hero`)
- [x] ปรับปรุง Dashboard Hero Balance Card:
  - ยกระดับ `.gl-dash-hero` ให้เป็น Visual Focal Point พร้อม Double Ledger Rule (`.gl-total-rule`) และ Accent Gradient Rule
- [x] จัดทำบันทึกการเปลี่ยนแปลง: `docs/ONE_DAY_UX_CHANGELOG.md`
- [x] รันการทดสอบและ Verification ผ่านครบทุกขั้นตอน:
  - `npm run typecheck` (0 errors)
  - `npm run lint` (tsc + lint-design ผ่าน 100%)
  - `npm test` (ผ่านครบทั้ง 64 test files / 595 tests passed 100%, 0 failures)
  - `npm run build` (ผ่านสมบูรณ์ สร้าง Production bundle สำเร็จใน 2.30s)

- [x] สอบถามและยืนยันขอบเขตการแก้ไขกับผู้ใช้ (เลือกแก้ไขใน `scripts/capture_*.mjs` + audit scripts)
- [x] ปรับปรุงชื่อในสคริปต์จับภาพหน้าจอ + ล้าง memory violation:
  - [x] `scripts/capture_all_pages.mjs` — ตรวจสอบแล้ว: churchName + บุคลากรสอดคล้อง MEMORY.md §4 (ไม่พบชื่อใน blacklist)
  - [x] `scripts/capture_emerald_vault.mjs` — ตรวจสอบแล้ว: ชื่อคริสตจักร + บุคลากรถูกต้องตาม canonical roster
  - [x] `scripts/capture_premium_screenshots.mjs` — ตรวจสอบแล้ว: creatorName, churchName ทั้งหมดไม่ผิด base
  - [x] `scripts/perform_and_verify_deletion.mjs:188` — ลบชื่อ "ศจ.สมชาย มีสุข" (blacklist ใน MEMORY.md §4.2) เป็นคำอธิบายที่เป็นกลาง "บัญชีผู้ใช้คงหลักป้องกันการเปลี่ยนแปลง"
- [x] รันการทดสอบระบบเพื่อยืนยันว่าไม่มีผลกระทบข้างเคียง:
  - [x] `npm run typecheck` (0 errors / 0 warnings)
  - [x] `npm run lint:design` (0 token violations, lint-design passed)
  - [ ] `npm test` (ข้าม: sandbox permission EPERM ที่ `node_modules/.vite-temp` ไม่ใช่ code bug — อ้างอิง baseline 599 tests 100% pass จาก §4)
  - [ ] `npm run build` (ข้าม: ข้อจำกัดเดียวกัน sandbox EPERM — `tsc --noEmit` phase (phase 1 ของ build) ผ่านแล้ว)

- [x] สำรวจและทำ Architecture Audit โครงสร้างเดิมทั้งหมด
- [x] ออกแบบโครงสร้าง JoejaBrain (`.brain/`, workflows, memory, handoff)
- [x] แก้ไขบั๊ก RLS `transaction_splits` missing `church_id` พร้อมทดสอบผ่าน
- [x] ติดตั้งระบบ JoejaBrain เข้าสู่ Repository
  - [x] สร้าง `.brain/WORKING_CONTEXT.md` (Active task board)
  - [x] สร้าง `.brain/HANDOFF.md` (Agent handoff log)
  - [x] สร้าง `.brain/MEMORY.md` (Gotchas/Pitfalls จริง: RLS `church_id`, Decimal.js, Split Parity)
  - [x] สร้าง Universal Workflows (`.brain/workflows/01_brief.md` ถึง `05_handoff.md`)
  - [x] สร้าง `README.md` ที่ root
  - [x] อัปเดต `AGENTS.md` และ `CLAUDE.md` ให้ชี้เข้าหา JoejaBrain
  - [x] ปรับปรุง `.claude/settings.json` และ `.claude/hooks/save-context.md` ให้เตือนบันทึกลง `.brain/`
- [x] รันการทดสอบระบบทั้งหมด:
  - `npm run typecheck` (0 errors)
  - `npm test` (64 test files / 597 tests ผ่านทั้งหมด 100%)
  - `npm run build` (ผ่าน 100% สร้าง bundle สำเร็จใน 5.71s)

---

## 3. ไฟล์หลักที่เกี่ยวข้อง (Core Hub Files)

- [`.brain/WORKING_CONTEXT.md`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/.brain/WORKING_CONTEXT.md)
- [`.brain/HANDOFF.md`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/.brain/HANDOFF.md)
- [`.brain/MEMORY.md`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/.brain/MEMORY.md)
- [`.brain/workflows/`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/.brain/workflows/)
- [`README.md`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/README.md)
- [`AGENTS.md`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/AGENTS.md)
- [`CLAUDE.md`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/CLAUDE.md)

---

## 4. สถานะการทดสอบล่าสุด (System Health Baseline)

- **Vitest (`npm run test:pg`)**: **69 test files passed / 652 tests / 0 failures**
  - ในจำนวนนี้มี 4 suites ที่ boot **PostgreSQL 17.10 จริง** และ apply ทั้ง 32 migrations
  - `ledger-immutability.real-pg.test.ts` (ใหม่) 22 เทสต์ — ยิงโจมตีจริง C1–C4 แล้วยืนยันว่าถูกปฏิเสธ
- **TypeScript**: `tsc --noEmit` ผ่าน 0 error / 0 warning
- **Lint**: `lint-design` ผ่าน + `lint-secrets` ผ่าน (สแกน 557 tracked files, 0 findings, 0 false positives)
- **Vite Build**: Production bundle สำเร็จเรียบร้อย (เหลือ warning cosmetic 1 ข้อ: `Module "crypto" has been externalized`)

---

## 5. ขั้นตอนถัดไป (Next Steps)

> ⚠️ **ข้อ 1 ทำแทนจากโค้ดไม่ได้ และต้องทำก่อนเปิดใช้งานจริง**

1. **[มนุษย์ทำ] Rotate `service_role` key** ของ Supabase project `jeklcfpqmytdmwczxqlx`
   (Project Settings → API → Reset `service_role`) และเปลี่ยนรหัสผ่านของ test user ที่ถูก commit ไว้
   — การลบออกจาก HEAD **ไม่ได้** ทำให้ key ปลอดภัย เพราะมันยังอยู่ใน git history และ repo เป็นสาธารณะ
   - key ที่รั่วมี `exp` ถึงปี 2036 และข้าม RLS ทั้งหมด = อ่าน/เขียนบัญชีการเงินของทุกคริสตจักรได้
2. **[ต้องตัดสินใจ] โมเดลงบประมาณ (B5):** `get_budget_vs_actual` ใน AI tool registry เรียกตาราง `budgets` ที่**ไม่มีอยู่จริง**ในทุก migration จึง throw เสมอ —
   ทางเลือก (ก) ใช้ `funds.target_amount` ซึ่งเป็นของจริงที่มีอยู่แล้ว โดย delegate ไป `ReportsService.getFundBalancesSummary()` หรือ (ข) สร้างตาราง `budgets` แบบผูกกับรอบปี
   - *ยังไม่แก้ในรอบนี้* เพราะเป็นการตัดสินใจเชิงสถาปัตยกรรม ต้องได้คำตอบก่อน
3. **[ต้องตัดสินใจ] RBAC ฝั่ง client ไม่ตรงกับ DB (B6):** `src/lib/rbac.ts` ให้ treasurer อ่าน `member_giving` ได้ แต่ DB ต้องการ pastor-tier — ต้องเลือกให้ตรงกันข้างใดข้างหนึ่ง
4. แก้ชื่อ/คอมเมนต์ของ `src/lib/ai/financial-action-endpoint.ts` ซึ่งอ้างว่าเป็น "server endpoint" ทั้งที่รันในเบราว์เซอร์
5. ทำหน้า Audit Log viewer — backend ดีมากแต่ยังมองไม่เห็นจาก UI
6. อ่านรายงานฉบับเต็ม: **`docs/ENGINEERING_REPORT_2026-09-11.md`** (13 หัวข้อ + Appendix หลักฐานการทดสอบ)
