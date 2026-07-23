# แผนพัฒนา — ระบบจัดการการเงินคริสตจักร (Phase 1: Frontend + Mock API)

สร้าง UI/UX ครบทุกโมดูลด้วย mock data ผ่าน Axios service layer (สลับเป็น backend จริงได้ในภายหลัง) ภาษาไทยทั้งระบบ, PIN login, สกุลเงิน ฿ (ค.ศ.)

## 1) รากฐานระบบ (Foundation)

- ติดตั้ง dependencies: `axios`, `chart.js` + `react-chartjs-2`, `dayjs`, `sweetalert2`, `framer-motion`, `zod`, `react-hook-form`, `@hookform/resolvers`
- โหลดฟอนต์ Prompt / Kanit / Inter ผ่าน `<link>` ใน `__root.tsx`
- Design tokens ใน `src/styles.css`: Primary Orange, Secondary Amber, Accent Yellow, Success Green, Danger Red, bg `#FFF9F4`, card white; glassmorphism, shadow-elegant, rounded-2xl/3xl; รองรับ dark mode
- Helper: `formatTHB()`, `formatDate()` (dayjs + locale th, ค.ศ.), animation utilities
- PWA manifest (installable, home-screen icon; ยังไม่ทำ offline)

## 2) Authentication (PIN Login)

- หน้า `/auth`: numeric keypad 0–9, ลบ, ยืนยัน — แสดง dots 6 ตำแหน่ง, shake animation เมื่อ PIN ผิด
- Mock user store (localStorage) มี users 6 role: Super Admin, Pastor, Treasurer, Finance Staff, Auditor, Viewer พร้อม PIN ตัวอย่าง
- AuthContext เก็บ user + role, `ProtectedRoute` + `RoleGuard`
- หน้า lock screen อัตโนมัติหลัง idle (ตั้งได้ใน Settings)

## 3) โครงสร้าง Route & Layout

TanStack Router file-based:

```text
src/routes/
  __root.tsx           (providers, fonts, toaster)
  index.tsx            → redirect ไป /auth หรือ /dashboard
  auth.tsx             (PIN login)
  _app.tsx             (layout: sidebar + topbar + bottom nav mobile, RoleGuard)
  _app.dashboard.tsx
  _app.income.tsx / _app.income.$id.tsx
  _app.expense.tsx / _app.expense.$id.tsx
  _app.offering.tsx
  _app.funds.tsx / _app.funds.$id.tsx
  _app.budget.tsx
  _app.projects.tsx / _app.projects.$id.tsx
  _app.members.tsx
  _app.reports.tsx
  _app.audit.tsx
  _app.settings.tsx
  _app.profile.tsx
```

Layout: Sidebar (collapsible, icon-only mode), Topbar (global search, notifications, profile), Bottom Nav (mobile: Dashboard/Income/Expense/Offering/More)

## 4) API Service Layer

- `src/services/api.ts`: Axios instance, `API_URL = ""`, interceptors (auth token placeholder, error → SweetAlert2)
- `src/services/*` แยกตามโดเมน: `income.service.ts`, `expense.service.ts`, `offering.service.ts`, `funds.service.ts`, `budget.service.ts`, `projects.service.ts`, `members.service.ts`, `reports.service.ts`, `audit.service.ts`, `users.service.ts`
- ทุก service export `GET/POST/PUT/DELETE` ที่เรียก mock adapter (`src/services/mock/*`) — สลับเป็น real API ได้โดยเปลี่ยน `API_URL` และลบ mock adapter
- TanStack Query hooks: `useIncome()`, `useCreateIncome()` ฯลฯ (คงที่ไม่ว่าจะ mock หรือ real)
- Mock data seed จริงจัง (~50–100 records/โดเมน) บันทึกใน localStorage เพื่อ persist ระหว่างรีเฟรช

## 5) โมดูลหลัก (CRUD + Search + Filter + Export)

รูปแบบเดียวกันทุกโมดูล: หน้ารายการ (DataTable + filter drawer + search) → Dialog/Drawer form (RHF + Zod) → หน้ารายละเอียด → Export CSV/Excel/PDF/Print

- **Dashboard**: 8 stat cards, Line (Income/Expense trend), Bar (Monthly comparison), Pie (Fund/Offering distribution), Progress (Budget usage), Radar (Score), Latest tx / offerings / activities, Quick Actions FAB
- **Income**: date, category, amount, fund, description, attachment, created by, approved by, status
- **Expense**: + approval workflow (Draft → Pending → Approved/Rejected), receipt upload preview
- **Offering**: ประเภท (Sunday/Mission/Building/Special/Youth/Children/Online), ช่องทาง (Cash/Bank/QR), บันทึกเร็วสำหรับวันอาทิตย์
- **Funds**: opening balance, current balance, income/expense rollup, transfer between funds dialog
- **Budget**: Annual/Monthly/Department/Project; usage bar + alert เมื่อเกิน 80%
- **Projects**: list + detail, progress bar, timeline, budget usage
- **Members**: list, search, family group, department, contact, status
- **Reports**: 9 รายงาน + Cash Flow + Financial Statement; export PDF/Excel/CSV/Print
- **Audit Logs**: read-only, filter by user/action/date
- **Settings**: church info, categories, funds default, PIN policy, idle timeout, theme
- **Profile**: เปลี่ยน PIN, ข้อมูลส่วนตัว

## 6) UX Details

- Skeleton loaders ทุกหน้า, Empty state พร้อม illustration + action
- Framer Motion: page transition (fade+slide), card hover scale, list stagger
- SweetAlert2 สำหรับ confirm delete / success / error
- Toast (shadcn sonner) สำหรับ inline feedback
- Error boundary + หน้า 404/403/500 สวยงาม, retry button
- Global search (Cmd+K style command palette)
- Responsive: sidebar → drawer บน tablet, bottom nav บน mobile
- Accessibility: aria-label ทุกปุ่ม icon, keyboard nav, contrast AA, tap target ≥44px

## 7) RBAC Matrix

| Role          | Income | Expense      | Offering | Funds | Budget | Reports | Audit | Settings |
| ------------- | ------ | ------------ | -------- | ----- | ------ | ------- | ----- | -------- |
| Super Admin   | CRUD   | CRUD+Approve | CRUD     | CRUD  | CRUD   | View    | View  | Edit     |
| Pastor        | View   | Approve      | View     | View  | View   | View    | View  | —        |
| Treasurer     | CRUD   | CRUD         | CRUD     | CRUD  | Edit   | View    | —     | —        |
| Finance Staff | CRU    | CRU          | CRUD     | View  | View   | View    | —     | —        |
| Auditor       | View   | View         | View     | View  | View   | View    | View  | —        |
| Viewer        | View   | View         | View     | View  | View   | View    | —     | —        |

`<RoleGuard allow={[...]}>` ครอบทั้ง route และปุ่ม action

## 8) รายละเอียดทางเทคนิค

- TypeScript strict, Zod schemas อยู่ใน `src/lib/schemas/*` ใช้ทั้งใน form และ mock adapter
- Types กลาง `src/types/*` (Income, Expense, Offering, Fund, Budget, Project, Member, User, Role, AuditLog)
- Component library: `src/components/ui/*` (shadcn) + `src/components/shared/*` (StatCard, DataTable, EmptyState, PageHeader, FilterDrawer, ExportMenu, StatusBadge, MoneyText, PinPad)
- Charts wrapper `src/components/charts/*` เพื่อ theming สม่ำเสมอ
- Export: CSV (papaparse), Excel (xlsx), PDF (jspdf + autotable + ฟอนต์ไทย Sarabun embedded), Print (window.print + print stylesheet)
- ไม่มี backend ในเฟสนี้ — ทุก mutation persist ใน localStorage; log activity ลง Audit Logs อัตโนมัติ

## 9) ลำดับการส่งมอบ (Build Order)

1. Foundation (deps, tokens, fonts, layout, routing, RBAC scaffold)
2. Auth (PIN) + mock users
3. Dashboard (stat cards, charts, quick actions)
4. Income + Expense + Offering (โมดูลใหญ่ที่สุด)
5. Funds + Budget + Projects
6. Members + Reports + Audit Logs
7. Settings + Profile + polish (empty states, animations, PWA)

จบเฟส 1: ระบบใช้งานได้เต็มรูปแบบด้วย mock data, พร้อมสลับไป Lovable Cloud ในเฟส 2 โดยไม่แตะ UI

---

**หมายเหตุ**: เฟสนี้ไม่ต่อ backend จริง — เมื่อพร้อม แนะนำเปิด Lovable Cloud เพื่อทำ Auth จริง, Postgres + RLS, file storage สำหรับใบเสร็จ, และแทนที่ mock adapter ด้วย Axios call ตรงไป REST/RPC (โครงสร้าง service layer เตรียมไว้แล้ว)
