# Grace Ledger — Premium Dark Mode Design Spec

> วันที่: 2026-08-06
> สถานะ: Draft
> พื้นที่: `src/styles.css`, `src/components/**/*.tsx`, `src/routes/**/*.tsx`

---

## 1. Vision

**Grace Ledger** → Premium Dark Mode (Balanced Linear/Arc-style)

จาก light mode ปัจจุบัน → dark mode แบบ understated luxury:

- พื้นหลัง slate เข้ม + ขาวตัวอักษร contrast สูง
- Emerald เป็น accent หลัก (CTA, active state, positive money flow)
- ไม่มี glass/chrome — ใช้ border + shadow สร้าง layered depth
- Understated luxury — เงียบ สง่า ไม่ลีลา

---

## 2. Design Tokens

### 2.1 Color System — Dark Mode

```css
/* ═══════════════════════════════════════════
   DARK MODE — Balanced (Linear/Arc)
═══════════════════════════════════════════ */
.dark {
  /* ── Base ── */
  --background: oklch(0.13 0.012 258); /* slate เข้ม */
  --foreground: oklch(0.97 0.004 258); /* off-white */
  --card: oklch(0.16 0.012 258); /* slate เข้มกว่า bg นิด */
  --card-foreground: oklch(0.97 0.004 258);
  --popover: oklch(0.18 0.012 258);
  --popover-foreground: oklch(0.97 0.004 258);

  /* Primary: Emerald — CTA, active, positive flow */
  --primary: oklch(0.6 0.15 155); /* emerald */
  --primary-foreground: oklch(0.12 0.02 155);

  /* Secondary: slate อ่อนสำหรับ surface */
  --secondary: oklch(0.22 0.012 258);
  --secondary-foreground: oklch(0.9 0.006 258);

  --muted: oklch(0.19 0.012 258);
  --muted-foreground: oklch(0.6 0.012 258);
  --accent: oklch(0.24 0.04 155); /* emerald tint */
  --accent-foreground: oklch(0.82 0.09 155);

  --destructive: oklch(0.64 0.16 25);
  --destructive-foreground: oklch(0.99 0 0);

  --border: oklch(1 0 0 / 10%); /* white-alpha */
  --input: oklch(1 0 0 / 8%);
  --ring: oklch(0.6 0.15 155); /* emerald */

  /* ── Finance colors ── */
  --income: oklch(0.65 0.14 155); /* emerald สว่าง */
  --income-foreground: oklch(0.12 0.02 155);
  --income-muted: oklch(0.24 0.06 155);

  --expense: oklch(0.64 0.16 25);
  --expense-foreground: oklch(0.12 0.02 25);
  --expense-muted: oklch(0.24 0.06 25);

  --offering: oklch(0.76 0.12 80);
  --offering-foreground: oklch(0.14 0.02 80);
  --offering-muted: oklch(0.24 0.06 80);

  /* ── Workflow status ── */
  --pending: oklch(0.76 0.12 80);
  --pending-foreground: oklch(0.14 0.02 80);
  --pending-muted: oklch(0.24 0.06 80);

  --approved: oklch(0.65 0.14 155);
  --approved-foreground: oklch(0.12 0.02 155);
  --approved-muted: oklch(0.24 0.06 155);

  --rejected: oklch(0.64 0.16 25);
  --rejected-foreground: oklch(0.12 0.02 25);
  --rejected-muted: oklch(0.24 0.06 25);

  --success: oklch(0.65 0.14 155);
  --success-foreground: oklch(0.12 0.02 155);
  --warning: oklch(0.76 0.12 80);
  --warning-foreground: oklch(0.14 0.02 80);
  --info: oklch(0.66 0.11 222);
  --info-foreground: oklch(0.12 0.02 222);

  /* ── Charts ── */
  --chart-1: oklch(0.6 0.15 155); /* emerald — primary */
  --chart-2: oklch(0.65 0.14 155); /* emerald — income */
  --chart-3: oklch(0.64 0.16 25); /* red — expense */
  --chart-4: oklch(0.76 0.12 80); /* amber — offering */
  --chart-5: oklch(0.66 0.1 195); /* teal */

  /* ── Sidebar ── */
  --sidebar: oklch(0.11 0.012 258); /* เข้มกว่า page bg */
  --sidebar-foreground: oklch(0.97 0.004 258);
  --sidebar-primary: oklch(0.6 0.15 155);
  --sidebar-primary-foreground: oklch(0.12 0.02 155);
  --sidebar-accent: oklch(0.22 0.05 155);
  --sidebar-accent-foreground: oklch(0.82 0.09 155);
  --sidebar-border: oklch(1 0 0 / 8%);
  --sidebar-ring: oklch(0.6 0.15 155);
}
```

### 2.2 Surface Elevation (Dark)

```css
/* Elevation — ใช้ border แทน shadow */
--surface-elevated: oklch(0.19 0.012 258); /* ยกขึ้นจาก card */
--border-subtle: oklch(1 0 0 / 6%); /* ขอบจางๆ สำหรับ table cell */
--glow-primary: 0 0 20px -4px oklch(0.6 0.15 155 / 0.2); /* glow เฉพาะจุด */
```

### 2.3 Component Tokens — Dark

```css
/* Card */
--card-bg: var(--card);
--card-border: var(--border);
--card-radius: var(--radius-card);

/* Button */
--btn-primary-bg: var(--primary);
--btn-primary-text: var(--primary-foreground);

/* Table */
--table-header-bg: var(--secondary);
--table-row-bg: var(--card);
--table-row-alt: var(--surface-elevated);
--table-border: var(--border-subtle);
```

---

## 3. Component Changes

### 3.1 StatCard

**ปัจจุบัน:**

- ใช้ accent strip ซ้าย (ยังคง)
- NumberTicker animation (ตัด)
- Shadow เมื่อ hover (ลด)

**ใหม่ (Dark):**

- Background: `var(--card)` → slate เข้ม
- Border: `1px solid var(--border)` → white-alpha
- NumberTicker → แสดงตัวเลขตรง ๆ ไม่ animate
- Hover: border → `var(--primary)` (emerald) 1px
- Trend badge: ใช้ border แทน muted bg
- Icon: `bg-primary/10` → `bg-accent/20` + `text-primary`

### 3.2 Table

**ปัจจุบัน:**

- Alternating rows #FFFFFF / #F1F5F9 (light)

**ใหม่ (Dark):**

- Header: `bg: var(--secondary)`, `border-bottom: 1px solid var(--border)`
- Row: `bg: var(--card)`, `border-bottom: 1px solid var(--border-subtle)`
- Alternate: `bg: var(--surface-elevated)` (subtle difference)
- Hover: `bg: var(--secondary)`, `border-color: var(--border)`
- Selected: `bg: var(--accent)`, `border-left: 2px solid var(--primary)`

### 3.3 PageHeader

**ปัจจุบัน:**

- Gradient line ล่าง (primary → transparent)
- Kicker มี gradient bar ซ้าย

**ใหม่ (Dark):**

- เปลี่ยน gradient line เป็น `border-bottom: 1px solid var(--border)`
- Kicker: ลด gradient bar ออก → ใช้ `text-primary` เป็น dot ◖ แทน
- Title: `text-foreground` (off-white)
- Description: `text-muted-foreground` (gray)

### 3.4 Button

**ปัจจุบัน:**

- Primary: blue
- Secondary: gray

**ใหม่ (Dark):**

- Primary: `bg: var(--primary)` (emerald), `text: var(--primary-foreground)` (dark)
- Secondary: `bg: var(--secondary)`, `text: var(--secondary-foreground)`, `border: 1px solid var(--border)`
- Ghost: transparent, `text: var(--muted-foreground)`
- Destructive: `bg: var(--destructive)`, `text: var(--destructive-foreground)`

### 3.5 Badge / StatusBadge

**ปัจจุบัน:**

- ใช้ muted background

**ใหม่ (Dark):**

- ใช้ border + text color แทน muted bg (อ่านชัดกว่าบน dark)
- Paid: `border: 1px solid var(--income)`, `color: var(--income)`
- Overdue: `border: 1px solid var(--warning)`, `color: var(--warning)`
- Draft: `border: 1px solid var(--muted-foreground)`, `color: var(--muted-foreground)`

### 3.6 Sidebar

**ปัจจุบัน:**

- Light background

**ใหม่ (Dark):**

- Background: `var(--sidebar)` (เข้มกว่า page bg นิด)
- Border: `1px solid var(--sidebar-border)`
- Active item: `bg: var(--sidebar-accent)`, `text: var(--sidebar-accent-foreground)`
- Active indicator: `2px solid var(--sidebar-primary)` (emerald)

### 3.7 Drawer / Sheet

**ปัจจุบัน:**

- Light background, blur overlay

**ใหม่ (Dark):**

- Background: `var(--popover)`
- Border: `1px solid var(--border)`
- Overlay: `bg-black/60 backdrop-blur-sm` (ลด blur จากเดิม)

---

## 4. Anti-Slop Rules (Dark Premium)

### ห้าม:

- ❌ Glassmorphism / backdrop-blur ทั้งระบบ (เฉพาะ overlay เท่านั้น)
- ❌ Chrome effect, shimmer, glow เกิน 1-2 จุด
- ❌ Gradient background บน card/section
- ❌ NumberTicker animation (ใช้ตัวเลขธรรมดา)
- ❌ สีจัดจ้าน — ทุกสีต้อง muted หรือ semi-transparent บน dark
- ❌ เงาหนัก — ใช้ border + subtle shadow เท่านั้น
- ❌ Accent strip หรือ decorative element ที่ไม่จำเป็น
- ❌ Drop-shadow glow บน icon/logo
- ❌ Scale-110 บน hover (icon/button)

### ต้ำ:

- ✅ 1 border สีขาว-alpha บน card (แทน shadow)
- ✅ Contrast สูง (foreground vs background ≥ 10:1)
- ✅ Emerald ใช้ sparingly — CTA, active, positive flow เท่านั้น
- ✅ Understated motion — 150-250ms, ease-out
- ✅ ใช้ border-subtle สำหรับ table cell (6% white-alpha)
- ✅ Surface-elevated สำหรับ hover state / elevated card

---

## 5. Migration Strategy

### Phase 1: Tokens (1 commit)

- อัปเดต `:root` / `.dark` ใน `src/styles.css` → ใช้ dark mode ใหม่
- เพิ่ม `@theme inline` สำหรับ surface-elevated, border-subtle, glow-primary
- เพิ่ม `@utility` สำหรับ dark-specific patterns

### Phase 2: Component พื้นฐาน (1-2 commits)

- Button, Card, Input, Badge, StatCard → รองรับ dark mode
- ลด animation ที่ฟุ่มเฟือย
- เปลี่ยน NumberTicker → static display

### Phase 3: Layout Shell (1 commit)

- AppSidebar, AppTopbar, BottomNav → dark mode
- ปรับ contrast + border

### Phase 4: Dashboard (1-2 commits)

- หน้าแรด → ปรับ table, stat cards, gauge chart
- Transaction Sheet/Drawer

### Phase 5: Transaction Pages (2-3 commits)

- Income, Expense, Offering → dark mode + premium feel
- Form + Dialog

### Phase 6: เหลือ (2-3 commits)

- Budget, Funds, Projects, Approvals, Reports, Settings

### Phase 7: Polish (1 commit)

- Animation/transition audit
- Contrast check
- ลบ dead code / unused animations

---

## 6. File Impact

| ไฟล์                                    | Phase | การเปลี่ยนแปลง                      |
| --------------------------------------- | ----- | ----------------------------------- |
| `src/styles.css`                        | 1     | Tokens, @theme, @utility            |
| `src/components/ui/button.tsx`          | 2     | Dark variants                       |
| `src/components/ui/card.tsx`            | 2     | Border-based depth                  |
| `src/components/ui/input.tsx`           | 2     | Dark focus ring                     |
| `src/components/ui/badge.tsx`           | 2     | Border-based badge                  |
| `src/components/ui/table.tsx`           | 2     | Dark table styles                   |
| `src/components/shared/StatCard.tsx`    | 2     | ตัด NumberTicker, ปรับ hover        |
| `src/components/shared/PageHeader.tsx`  | 2     | ลด gradient, ปรับ kicker            |
| `src/components/shared/StatusBadge.tsx` | 2     | Border-based badge                  |
| `src/components/layout/AppSidebar.tsx`  | 3     | Dark sidebar + active state         |
| `src/components/layout/AppTopbar.tsx`   | 3     | Dark topbar                         |
| `src/components/layout/BottomNav.tsx`   | 3     | Dark mobile nav                     |
| `src/routes/_app.dashboard.tsx`         | 4     | Dashboard dark mode                 |
| `src/components/dashboard/*.tsx`        | 4     | FundsGrid, TransactionsTable, Gauge |
| `src/routes/_app.income.tsx`            | 5     | Income page                         |
| `src/routes/_app.expense.tsx`           | 5     | Expense page                        |
| `src/routes/_app.offering.tsx`          | 5     | Offering page                       |
| `src/routes/_app.budget.tsx`            | 6     | Budget page                         |
| `src/routes/_app.funds.tsx`             | 6     | Funds page                          |
| `src/routes/_app.projects.tsx`          | 6     | Projects page                       |
| `src/routes/_app.approvals.tsx`         | 6     | Approvals page                      |
| `src/routes/_app.reports.tsx`           | 6     | Reports page                        |
| `src/routes/_app.settings.tsx`          | 6     | Settings page                       |

---

## 7. Success Criteria

- [ ] ทุกหน้า render ได้ใน dark mode (ไม่มี hardcoded light color แฝง)
- [ ] Contrast ratio ≥ WCAG AA (4.5:1) สำหรับ body text
- [ ] Emerald ใช้เฉพาะ CTA, active state, positive flow
- [ ] ไม่มี NumberTicker ในแอปอีกต่อไป
- [ ] ไม่มี gradient background บน card/section
- [ ] ไม่มี backdrop-blur ทั้งระบบ (เฉพาะ overlay)
- [ ] Animation ทุกอย่าง ≤ 250ms
- [ ] Table: alternating rows มองเห็นชัด (subtle แต่มี)
- [ ] Table: sticky header + frozen first column สำหรับ wide tables
- [ ] Sidebar: เข้มกว่า page background อย่างน้อย 2% lightness
- [ ] ทุก component มี dark variant ใน Storybook (ถ้ามี)

---

## 8. Out of Scope

- ❌ Light mode ยังคงรองรับ (dual mode) — ยังไม่ต้องทำตอนนี้
- ❌ Theme toggle (user เลือก dark/light) — ยังไม่ต้องทำ
- ❌ Font change (ยังคง Inter + Sarabun)
- ❌ Layout structure change (ยังคง sidebar + topbar)
- ❌ New features (เน้น UI polish อย่างเดียว)
