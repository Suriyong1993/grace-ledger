# PROJECT MAP — Grace Ledger
## แผนที่ไฟล์ทั้งหมด — เวอร์ชันหลังจัดระเบียบ

---

## โครงสร้างโฟลเดอร์ (ภาพรวม)

```
grace-ledger/
|
+-- promptmaster/          คู่มือ AI + Bible (อ่านก่อนทำงานทุกครั้ง)
+-- src/                   โค้ดทั้งหมด
|   +-- routes/            หน้าต่าง ๆ ของแอป
|   +-- components/        ชิ้นส่วน UI
|   +-- server/            Logic + API + Database
|   +-- services/          ตัวกลาง client กับ database
|   +-- lib/               เครื่องมือ utility
|   +-- hooks/             React hooks
|   +-- db/                Database schema
+-- docs/                  เอกสาร Architecture (อ้างอิง)
|   +-- architecture/      ออกแบบระบบ
|   +-- business/          กฎธุรกิจ
|   +-- operations/        การ deploy และ operations
+-- supabase/migrations/   SQL สร้างฐานข้อมูล
+-- refer/                 รูปภาพอ้างอิง
+-- engineering/           Prompt เพิ่มเติม
+-- README.md              อธิบายโปรเจกต์ (อยู่ root เสมอ)
+-- CLAUDE.md              Context สำหรับ Claude (อยู่ root เสมอ)
```

---

## ROOT FOLDER — ไฟล์ที่ root ตอนนี้

| ไฟล์ | คืออะไร | ห้ามย้าย? |
|------|--------|---------|
| README.md | อธิบายโปรเจกต์สำหรับนักพัฒนา | ห้ามย้าย |
| CLAUDE.md | Context สำหรับ Claude Desktop | ห้ามย้าย |
| AGENTS.md | Config สำหรับ AI Agent framework | ห้ามย้าย |
| package.json | Dependencies ของโปรเจกต์ | ห้ามย้าย |
| tsconfig.json | TypeScript config | ห้ามย้าย |
| vite.config.ts | Build config | ห้ามย้าย |
| eslint.config.js | Lint config | ห้ามย้าย |
| docker-compose.yml | Docker setup | ห้ามย้าย |
| Dockerfile | Docker image | ห้ามย้าย |
| vercel.json | Vercel deploy config | ห้ามย้าย |
| drizzle.config.ts | Database ORM config | ห้ามย้าย |
| pr-body.md | PR template | ไม่สำคัญ |

---

## promptmaster/ — คู่มือและ Bible (เปิดก่อนทุกครั้ง)

| ไฟล์ | ใช้เมื่อ | สำคัญแค่ไหน |
|------|---------|------------|
| MASTER_PROMPT.md | ก่อนทุก session | สูงสุด |
| HOW_TO_TALK_TO_AI.md | ก่อนสั่ง AI | สูงสุด |
| ROADMAP.md | เลือกงานต่อไป | สูงสุด |
| PROJECT_MAP.md | อยากรู้ว่าไฟล์ไหนทำอะไร | สูง |
| PRODUCT_BIBLE.md | รู้จัก product vision | สูง |
| ENGINEERING_BIBLE.md | แก้โค้ด | สูง |
| DESIGN_BIBLE.md | แก้ UI | สูง |
| AI_BIBLE.md | ทำ AI feature | ปานกลาง |
| DEPLOYMENT_GUIDE.md | deploy | ปานกลาง |
| SYSTEM_ARCHITECTURE.md | ดู architecture | ปานกลาง |
| AI_PREVENTION_CHECKLIST.md | review โค้ด | ปานกลาง |

---

## src/routes/ — หน้าต่าง ๆ ของแอป (แก้ UI ที่นี่)

| ไฟล์ | หน้าอะไร | สถานะ |
|------|---------|-------|
| _app.dashboard.tsx | หน้าแรก — สรุปการเงิน | ทำงานได้ (pending ไม่ครบ) |
| _app.income.tsx | บันทึกรายรับ | ทำงานได้ |
| _app.expense.tsx | บันทึกรายจ่าย | ทำงานได้ |
| _app.offering.tsx | บันทึกเงินถวาย | ทำงานได้ |
| _app.funds.tsx | จัดการกองทุน | ทำงานได้ |
| _app.budget.tsx | งบประมาณ | บางส่วน |
| _app.reconciliation.tsx | กระทบยอด | ทำงานได้ |
| _app.reports.tsx | รายงาน + Export | บางส่วน |
| _app.members.tsx | สมาชิก | ทำงานได้ |
| _app.audit.tsx | Audit Trail | ทำงานได้ |
| _app.settings.tsx | ตั้งค่า | ทำงานได้ |
| _app.projects.tsx | โปรเจกต์ | ทำงานได้ |
| _app.line-setup.tsx | ตั้งค่า LINE | ยังไม่สมบูรณ์ |
| _app.profile.tsx | โปรไฟล์ผู้ใช้ | ทำงานได้ |
| _app.tsx | Layout + Sidebar | ทำงานได้ |
| auth.tsx | หน้า Login | ทำงานได้ |
| index.tsx | Redirect ไป /dashboard | ทำงานได้ |

---

## src/server/ — Logic หัวใจ (ระวังเมื่อแก้)

### domain/ — กฎทางธุรกิจ

| ไฟล์ | ทำอะไร | ระวัง |
|------|--------|-------|
| money.ts | คำนวณเงิน ห้ามใช้ float | อย่าแตะ |
| journal.ts | ระบบบัญชีคู่ | อย่าแตะ |
| validation.ts | ตรวจสอบข้อมูล | ระวัง |
| chart-of-accounts.ts | ผังบัญชี | ระวัง |

### auth/ — ระบบสิทธิ์

| ไฟล์ | ทำอะไร |
|------|--------|
| permissions.ts | Role และ threshold อนุมัติ |
| session.ts | JWT session |
| password.ts | เข้ารหัสรหัสผ่าน |

### services/ — Business Logic

| ไฟล์ | ทำอะไร |
|------|--------|
| audit.service.ts | Audit Trail + SHA-256 |
| fund.service.ts | Fund balance |
| income.service.ts | รายรับ + Audit |
| expense.service.ts | รายจ่าย + Approval |
| period.service.ts | รอบบัญชี เปิด/ปิด |
| reconciliation.service.ts | กระทบยอด |
| transfer.service.ts | โอนระหว่าง Fund |
| auth.service.ts | Login/Logout |
| seed.service.ts | ข้อมูลทดสอบ |
| migration.service.ts | Database migration |
| attachment.service.ts | ไฟล์แนบ |

### api/routes/ — API Endpoints

| ไฟล์ | ให้บริการ |
|------|---------|
| ai-proxy.routes.ts | AI OCR — ไม่ให้ key หลุด |
| expense.routes.ts | CRUD รายจ่าย |
| income.routes.ts | CRUD รายรับ |
| offering.routes.ts | CRUD เงินถวาย |
| journal.routes.ts | Double-entry |
| fund.routes.ts | กองทุน |
| budget.routes.ts | งบประมาณ |
| audit.routes.ts | Audit log |
| period.routes.ts | รอบบัญชี |
| reconciliation.routes.ts | กระทบยอด |
| transfer.routes.ts | โอนเงิน |
| auth.routes.ts | Login/Logout |
| settings.routes.ts | ตั้งค่า |
| health.routes.ts | Health check |

---

## src/components/ — UI Components

### layout/ — โครง Layout

| ไฟล์ | ทำอะไร |
|------|--------|
| AppSidebar.tsx | Sidebar เมนูซ้าย |
| AppTopbar.tsx | Header บน |
| AppNav.tsx | Navigation |
| BottomNav.tsx | เมนูล่าง Mobile |

### shared/ — ใช้ซ้ำทุกหน้า

| ไฟล์ | ทำอะไร |
|------|--------|
| MoneyText.tsx | แสดงตัวเลขเงิน — ใช้แทน .toLocaleString |
| StatusBadge.tsx | Badge pending/approved/rejected |
| PageHeader.tsx | Header ของแต่ละหน้า |
| PageTransition.tsx | Animation เปลี่ยนหน้า |
| EmptyState.tsx | แสดงเมื่อไม่มีข้อมูล |
| ErrorBoundary.tsx | ดัก error |
| StatCard.tsx | Card ตัวเลขสถิติ |
| RoleGuard.tsx | ซ่อน/แสดงตาม Role |
| FundTransferDialog.tsx | Dialog โอนเงิน |
| SundayCountSheet.tsx | ใบนับเงินวันอาทิตย์ |
| CommandPalette.tsx | Command palette Ctrl+K |
| AttachmentInput.tsx | Upload ไฟล์ |
| PinPad.tsx | กด PIN |
| OfflineIndicator.tsx | แจ้งเตือน offline |
| ThemeProvider.tsx | Dark/Light mode |

---

## src/services/ — ตัวกลาง Client กับ Database

| ไฟล์ | ทำอะไร |
|------|--------|
| church.ts | ดึงข้อมูลจาก Supabase |
| api.ts | เรียก API server |
| aiReceiptService.ts | AI OCR ผ่าน proxy |
| fireworksAiService.ts | Fireworks AI |
| google.ts | Google Gemini |
| storage.ts | File upload |
| supabaseClient.ts | Supabase client |
| supabaseService.ts | Supabase helpers |
| peakIntegrationService.ts | PEAK integration (ยังไม่ active) |

---

## src/lib/ — Utility Tools

| ไฟล์ | ทำอะไร |
|------|--------|
| format.ts | thb(), fmtDate() — format ตัวเลขและวันที่ |
| types.ts | Type definitions |
| auth.tsx | Auth context + useAuth hook |
| csv.ts | Export CSV |
| exporters.ts | Export PDF/CSV |
| mock-db.ts | ข้อมูลปลอม |
| utils.ts | cn() merge Tailwind |
| gsap.ts | Animation |

---

## src/db/ — Database

| ไฟล์ | ทำอะไร |
|------|--------|
| schema.ts | Schema ตาราง 22 ตาราง — อย่าแตะถ้าไม่แน่ใจ |

---

## supabase/migrations/ — SQL

| ไฟล์ | ทำอะไร |
|------|--------|
| 001_init_schema.sql | สร้างตารางทั้งหมด |
| 002_line_integration.sql | LINE fields |
| 003_simplify_roles.sql | Role system |
| 004_categories_funds_sort_rls.sql | RLS policies |
| 005_attachment_storage_path.sql | Attachment |
| 006_audit_log_hash_chain.sql | SHA-256 audit |
| 007_users_password_hash.sql | Password |
| 008_create_missing_tables.sql | ตารางเพิ่มเติม |

---

## docs/ — เอกสาร Architecture (อ้างอิงเท่านั้น)

### docs/architecture/
- TARGET_ARCHITECTURE.md — architecture ปัจจุบัน
- ARCHITECTURE_DECISIONS.md — ทำไมถึงตัดสินใจแบบนี้
- ARCHITECTURE_FOUNDATION.md — จัดระเบียบเอกสาร
- ARCHITECTURE_REVIEW.md — review ก่อนหน้า
- DATABASE_V2.md — schema เป้าหมาย
- DATABASE_COMPATIBILITY_AUDIT*.md — audit DB

### docs/business/
- BUSINESS_RULES.md — กฎธุรกิจทั้งหมด (สำคัญ)
- BUSINESS_DOMAIN_AUDIT.md — analysis domain
- ACCOUNTING_ENGINE.md — ระบบบัญชีคู่
- AUDIT_TRAIL.md — ระบบ Audit
- AUTHORIZATION_MODEL.md — role และ permission
- TRANSACTION_ENGINE.md — transaction pipeline

### docs/operations/
- SECURITY_MODEL.md — security
- QUALITY_GATES.md — มาตรฐาน code
- PRODUCTION_ACCEPTANCE_CHECKLIST.md — checklist deploy
- SUCCESS_METRICS.md — KPI
- IMPLEMENTATION_ROADMAP.md — แผนเก่า (archived)
- MIGRATION_PLAN.md — migration
- PRODUCTION_PLAN.md — production plan เก่า

---

## สรุปด่วน — อยากแก้อะไร เปิดไฟล์ไหน

| อยากทำ | ไฟล์ที่แก้ |
|--------|----------|
| แก้ Dashboard | src/routes/_app.dashboard.tsx |
| แก้รายจ่าย | src/routes/_app.expense.tsx |
| แก้รายรับ | src/routes/_app.income.tsx |
| แก้เงินถวาย | src/routes/_app.offering.tsx |
| แก้ Sidebar เมนู | src/components/layout/AppSidebar.tsx |
| แก้ตัวเลขเงิน | src/components/shared/MoneyText.tsx |
| แก้กฎอนุมัติ | src/server/auth/permissions.ts |
| แก้สีและ font | src/styles.css |
| ดู role ทำอะไรได้ | src/server/auth/permissions.ts |

---

_Version: 2.1 | July 2026 | หลังจัดระเบียบโฟลเดอร์_
