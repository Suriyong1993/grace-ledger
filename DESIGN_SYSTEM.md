# Grace Ledger — Design System

> **GROUND TRUTH** — ทุก AI session ที่ทำงาน frontend ต้อง read ไฟล์นี้ก่อน
> ห้ามออกนอกกรอบที่กำหนดโดยไม่มีเหตุผลชัดเจน

---

## 1. DNA

| แกน | ความหมาย | ตัวอย่างที่อ้างอิง |
|---|---|---|
| **Apple** | Whitespace หายใจ, Typography น้ำหนักดี, ไม่รก | SF Pro, iCloud.com |
| **Stripe** | Trust signal, ตัวเลขอ่านได้ชัด, Data dense แต่ไม่หนัก | dashboard.stripe.com |
| **Linear** | Dark-first option, Clean geometric, Purposeful animation | linear.app |

**สิ่งที่ต้องรักษา:**
- ตัวเลขเงินทุกตัว: `tabular-nums`, `font-family: Inter`
- ทุก status ต้องมี color coding ชัดเจน (ไม่ใช่ text อย่างเดียว)
- Animation ต้องมีประโยชน์ — ไม่ใช่แค่สวย

---

## 2. Color Tokens

ทั้งหมดนิยามใน `src/styles.css` → `@theme inline` + `:root` + `.dark`

### 2.1 Base Palette

| Token | Light Value | Dark Value | ใช้เมื่อ |
|---|---|---|---|
| `--color-background` | Cool near-white #F8F9FC | Deep slate #111827 | Page background |
| `--color-foreground` | Deep slate #1C1E2E | Near-white #F0F3FF | Body text |
| `--color-card` | Pure white | #1E2235 | Card backgrounds |
| `--color-muted` | #F1F3FA | #262B40 | Subtle backgrounds |
| `--color-muted-foreground` | #6B7280 | #8B91A8 | Secondary text |
| `--color-border` | #E2E5F1 | 8% white | Dividers, card borders |

### 2.2 Primary

| Token | Value | หมายเหตุ |
|---|---|---|
| `--color-primary` | Indigo-600 #4F46E5 | Trust, authority, CTAs |
| `--color-primary-foreground` | White | Text บน primary bg |

**ห้ามใช้ Tailwind `blue-*` generic — ใช้ `primary` เสมอ**

### 2.3 Finance Colors (สำคัญมาก)

| Token | สี | ใช้เมื่อ |
|---|---|---|
| `--color-income` | Emerald | รายรับ — positive |
| `--color-income-muted` | Emerald-100 | badge bg สำหรับ รายรับ |
| `--color-expense` | Rose | รายจ่าย — outflow |
| `--color-expense-muted` | Rose-100 | badge bg สำหรับ รายจ่าย |
| `--color-offering` | Amber | เงินถวาย — sacred |
| `--color-offering-muted` | Amber-100 | badge bg สำหรับ เงินถวาย |

### 2.4 Workflow Status Colors

| Token | สี | ใช้เมื่อ |
|---|---|---|
| `--color-pending` | Amber | รอการอนุมัติ |
| `--color-approved` | Emerald | อนุมัติแล้ว |
| `--color-rejected` | Rose | ปฏิเสธ |

---

## 3. Typography

### 3.1 Fonts

```
Body / UI:   Sarabun 400/500/600 (Thai), Inter 400/500/600 (Latin)
Display:     Sarabun 600/700 (headings)
Numbers:     Inter + tabular-nums (ตัวเลขเงินทุกตัว)
```

ห้ามใช้ Prompt, Kanit, หรือ system-ui สำหรับ headings อีกต่อไป

### 3.2 Type Scale

| Class | Size | Weight | ใช้เมื่อ |
|---|---|---|---|
| `.kicker` | 11px | 600 | Label section, category |
| `text-xs` | 12px | 400/500 | Meta, timestamp, helper |
| `text-sm` | 14px | 400/500 | Body text, table rows |
| `text-base` | 15px | 400 | Default body |
| `text-lg` | 18px | 500/600 | Sub-headings |
| `text-xl` | 20px | 600 | Page section headers |
| `text-2xl` | 24px | 600/700 | Page titles |
| `text-3xl` | 30px | 700 | KPI numbers, hero stats |
| `text-4xl+` | 36px+ | 700 | Dashboard big numbers only |

### 3.3 Number Display Rule

**ทุกตัวเลขเงิน ทุกตัวเลข status count:**
```tsx
<span className="num-display">1,234,567</span>
// หรือใช้ MoneyText component
```

ห้าม render ตัวเลขเงินแบบ plain `<span>` โดยไม่มี `num-display`

---

## 4. Spacing & Layout

| ระดับ | Value | ใช้เมื่อ |
|---|---|---|
| `gap-1` / `p-1` | 4px | Internal micro spacing |
| `gap-2` / `p-2` | 8px | Badge padding, icon gap |
| `gap-3` / `p-3` | 12px | Card internal tight |
| `gap-4` / `p-4` | 16px | Standard card padding |
| `gap-6` / `p-6` | 24px | Card comfortable padding |
| `gap-8` / `p-8` | 32px | Section spacing |
| `gap-12` | 48px | Major section breaks |

### Layout Constants
- **Sidebar width**: 240px (collapsed: 56px)
- **Topbar height**: 56px
- **Main content max-width**: 1200px
- **Page padding**: `px-4 md:px-8 py-6`
- **Card gap**: `gap-4 md:gap-6`

---

## 5. Border Radius

```
--radius-sm:  4px   (small elements)
--radius-md:  6px   (default cards, inputs)
--radius-lg:  8px   (large cards)
--radius-xl:  12px  (modals, sheets)
--radius-2xl: 16px  (hero sections)
--radius-full: 9999px (pills, avatars)
```

ห้ามใช้ `rounded-full` สำหรับ button ทั่วไป — ใช้ `rounded-md` หรือ `rounded-lg`

---

## 6. Component Patterns

### 6.1 Stat/KPI Card
```tsx
<div className="card-ledger p-6 shadow-sm-card">
  <p className="kicker">รายรับเดือนนี้</p>
  <p className="mt-2 text-3xl font-bold num-display amount-income">
    1,234,567
  </p>
  <p className="mt-1 text-xs text-muted-foreground">
    +12% จากเดือนก่อน
  </p>
</div>
```

### 6.2 Status Badge
ใช้ component `StatusBadge` เสมอ — ห้าม hard-code สีเอง

```tsx
<StatusBadge status="pending" />   // Amber
<StatusBadge status="approved" />  // Emerald
<StatusBadge status="rejected" />  // Rose
```

### 6.3 Transaction Row
```tsx
<div className="flex items-center gap-3 py-3 border-b border-border hover-lift">
  <div className="h-9 w-9 rounded-lg grid place-items-center bg-income-muted">
    <ArrowDownLeft className="h-4 w-4 text-income" />
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-sm font-medium truncate">คำอธิบาย</p>
    <p className="text-xs text-muted-foreground">วันที่</p>
  </div>
  <span className="num-display amount-income text-sm font-semibold">+1,000</span>
</div>
```

### 6.4 Primary Button
```tsx
<Button className="bg-primary text-primary-foreground hover:bg-primary/90 active-press">
  บันทึก
</Button>
```

### 6.5 Danger/Reject Action
```tsx
<Button variant="destructive" className="active-press">
  ปฏิเสธ
</Button>
```

---

## 7. Icons

ใช้ **Lucide React** เท่านั้น — ห้ามนำ icon library อื่นมาผสม

| ขนาด | Class | ใช้เมื่อ |
|---|---|---|
| 16px | `h-4 w-4` | Inline, nav items |
| 20px | `h-5 w-5` | Buttons, list items |
| 24px | `h-6 w-6` | Feature icons |
| 32px | `h-8 w-8` | Empty state, hero |

`strokeWidth` ควรเป็น `1.5` (default) — ใช้ `2` สำหรับ active state เท่านั้น

---

## 8. Motion Guidelines

| ประเภท | Duration | Easing | ใช้เมื่อ |
|---|---|---|---|
| Micro (press, hover) | 100-150ms | `ease` | Button press, hover bg |
| Component (modal, sheet) | 200-250ms | `--ease-out` | Dialog open/close |
| Page transition | 250-300ms | `--ease-out` | Route change |
| Stagger list | 40ms delay each | `--ease-out` | List mount |

**ห้าม:**
- Animation ที่นานกว่า 400ms สำหรับ UI interaction
- `bounce` หรือ `elastic` easing สำหรับ business UI
- `animate-spin` หรือ `animate-bounce` (ดู amateur)

---

## 9. Dos and Don'ts

### ทำ
- ใช้ semantic color tokens เสมอ (`text-primary`, `text-income`, `bg-expense-muted`)
- ทุกตัวเลขเงิน: `.num-display` + Inter font
- Cards ใช้ `.card-ledger` หรือ `.card-subtle`
- Status ใช้ color + icon ไม่ใช่ text อย่างเดียว
- Approve/Reject ต้องมี confirmation dialog
- ทุก destructive action ต้องมี confirm

### ห้ามทำ
- Hard-code hex color เช่น `text-[#C08233]` หรือ `bg-[#4F46E5]`
- ใช้ `tailwind blue-*`, `green-*`, `red-*` แทน semantic tokens
- ทำ gradient ซับซ้อนโดยไม่จำเป็น
- Font size เล็กกว่า 11px
- Animation ที่ไม่มี `prefers-reduced-motion` fallback

---

## 10. Role-Based UI

| Role | ความสามารถพิเศษ |
|---|---|
| เหรัญญิก | อนุมัติ/ปฏิเสธ, Export |
| ศิษยาภิบาล | View all, ไม่สามารถแก้ไข |
| คณะกรรมการ | View reports, Approve งบประมาณ |
| ผู้ตรวจสอบ | Read-only, Audit trail |
| Super Admin | ทุกอย่าง |

ใช้ `RoleGuard` component ห่อ element ที่ต้องการ permission

---

## 11. Approval Workflow States

```
draft → pending → approved
                → rejected → (แก้ไข) → pending
```

| State | Badge | Icon | Action Available |
|---|---|---|---|
| `draft` | Gray | FileEdit | Edit, Submit |
| `pending` | Amber | Clock | Approve, Reject (เหรัญญิก+) |
| `approved` | Emerald | CheckCircle2 | View, Export |
| `rejected` | Rose | XCircle | View reason, Re-submit |

---

## 12. File Naming Convention

```
src/
  routes/
    _app.<page>.tsx          (Route files)
  components/
    layout/                  (AppSidebar, AppTopbar, BottomNav, AppNav)
    shared/                  (PageHeader, MoneyText, StatusBadge, etc.)
    ui/                      (shadcn/ui base components)
    <feature>/               (Feature-specific components)
```

---

*อัปเดตล่าสุด: 2026-07-31 | Version 2.0*
