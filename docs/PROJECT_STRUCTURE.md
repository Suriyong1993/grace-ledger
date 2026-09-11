# Project Structure

เอกสารนี้สรุปโครงสร้างโปรเจกต์ Grace Ledger หลังการจัดระเบียบไฟล์รอบล่าสุด โดยแยกให้ชัดว่าอะไรคือโค้ดที่ระบบใช้งานจริง อะไรคือเอกสารหลัก และอะไรคือไฟล์อ้างอิงเชิงประวัติ

## 1. โฟลเดอร์หลักที่เกี่ยวกับการรันระบบ

| พาธ | หน้าที่ |
| :--- | :--- |
| `src/` | โค้ดแอปหลักทั้งหมด: pages, components, services, domain libraries, styles |
| `supabase/` | SQL migrations, edge functions, Supabase config |
| `tests/` | unit tests และ integration tests |
| `scripts/` | สคริปต์ตรวจสอบ, capture, pg lab, migration audits |
| `design-system-extracted/` | design tokens และ prototype reference ที่ยังถูกอ้างอิงในเอกสาร/แนวทางของโปรเจกต์ |

## 2. เอกสารหลักที่ควรอ่านก่อนแก้ระบบ

| พาธ | หน้าที่ |
| :--- | :--- |
| `README.md` | จุดเริ่มต้นของ repo |
| `AGENTS.md` | กติกาการทำงานสำหรับ agent |
| `CLAUDE.md` | working agreement หลักของโปรเจกต์ |
| `CONTEXT.md` | ภาพรวม domain |
| `DECISIONS.md` | decision log |
| `DESIGN.md`, `DESIGN_MODERN.md`, `COMPONENTS.md` | กติกา UI และ design system |
| `.brain/` | working context, memory, handoff และ workflows |

## 3. เอกสารประวัติและไฟล์อ้างอิงที่ถูกย้าย

### `docs/history/root-reports/`

เก็บรายงานและ baseline เดิมที่ไม่ใช่ entry point หลักของ repo แล้ว:

- `ARCHITECTURE_AUDIT.md`
- `IMPLEMENTATION_PLAN.md`
- `PHASE_2B_REPORT.md`
- `REAL_PROJECT_BASELINE.md`
- `FIX_LOG.md`

### `docs/reference/archives/`

เก็บไฟล์ zip ต้นทางที่เคยวางไว้ที่ root:

- `Grace Ledger Design System.zip`
- `Grace Ledger UI Mockups.zip`

### `docs/archive/`

เก็บ artifact ส่งมอบจากรอบก่อน:

- `r1-handoff/`

## 4. สิ่งที่ตั้งใจไม่ย้าย

รายการต่อไปนี้ยังคงอยู่ที่เดิมโดยตั้งใจ เพราะมีความเป็นไปได้ว่าจะถูกใช้อ้างอิงในการพัฒนา/ตรวจสอบ หรือมีโอกาสกระทบ workflow ของทีม:

- `design-plans/`
- `mockups-extracted/`
- `fable5.1/`
- `graphify-out/`

## 5. หลักการจัดวางที่ใช้ในรอบนี้

1. ไม่ย้ายโค้ด runtime (`src/`, `supabase/`, `tests/`, `scripts/`) ถ้าไม่มีเหตุผลจำเป็น
2. ลดความรกที่ root โดยย้ายรายงานประวัติและไฟล์ archive ไปไว้ใต้ `docs/`
3. เก็บพาธของไฟล์อ้างอิงให้สื่อความหมายตามหมวด `history`, `reference`, `archive`
4. อัปเดตข้อความอ้างอิงสำคัญในเอกสารและคอมเมนต์ให้ชี้ไปตำแหน่งใหม่
