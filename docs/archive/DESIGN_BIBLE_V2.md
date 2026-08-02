# DESIGN BIBLE — Grace Ledger (ARCHIVED)

> **HISTORICAL REFERENCE ONLY.** This document's palette (Gold Amber
> primary, Kanit/Prompt fonts, iPad-first) was never implemented in
> `src/styles.css` and conflicted with the sibling `DESIGN_SYSTEM.md`
> (now also archived). Superseded by
> [`DESIGN_SYSTEM_V3.md`](../../DESIGN_SYSTEM_V3.md), the sole source of
> truth as of the v3.0 UI refactor. Nothing below this line is
> authoritative — kept for historical context only.

---

# DESIGN BIBLE — Grace Ledger

> อ่านก่อน: promptmaster/MASTER_PROMPT.md
> เอกสารนี้คือกฎการออกแบบ UI/UX ที่ AI ทุกตัวต้องปฏิบัติตาม

---

## 1. Design DNA

UI ของ Grace Ledger ได้รับแรงบันดาลใจจาก 3 แหล่ง:

| แรงบันดาลใจ          | เอามาจาก                                  |
| -------------------- | ----------------------------------------- |
| **Apple**            | ความประณีต, Simplicity, ความสงบของ Layout |
| **Stripe Dashboard** | Financial Data Display, Typography, Trust |
| **Linear**           | Productivity UI, Navigation, Fast Feel    |

สิ่งที่ต้องรู้สึกได้เมื่อเปิดแอป:

- **Premium** — ไม่ใช่ของฟรี
- **Trustworthy** — ไว้วางใจได้กับเงิน
- **Clear** — เข้าใจทันทีว่าตอนนี้อยู่ที่ไหน ทำอะไรได้

---

## 2. Color System (OKLCH)

ไฟล์อ้างอิง: `src/styles.css`

### 2.1 Light Mode Palette

```css
--background: oklch(0.978 0.01 85) /* Warm Ivory #FAF7F2 */ --foreground: oklch(0.2 0.015 60)
  /* Warm Dark Charcoal */ --primary: oklch(0.72 0.15 65) /* Gold Amber — main brand */
  --card: oklch(1 0 0) /* White cards */ --border: oklch(0.9 0.01 85) /* Subtle warm border */
  --success: oklch(0.65 0.15 150) /* Emerald green */ --destructive: oklch(0.6 0.2 25)
  /* Coral red */ --warning: oklch(0.75 0.15 85) /* Amber warning */ --muted: oklch(0.95 0.008 85)
  /* Muted background */;
```

### 2.2 กฎการใช้สี

- **ห้าม** ใช้สีแดงธรรมดา (`#FF0000`) — ใช้ `--destructive` เท่านั้น
- **ห้าม** ใช้สีเขียวธรรมดา — ใช้ `--success` เท่านั้น
- Primary Gold Amber ใช้สำหรับ: CTA buttons, Active states, Highlights
- ตัวเลขเงินบวก = `--success`, ตัวเลขเงินลบ = `--destructive`

---

## 3. Typography

### 3.1 Font Stack

```css
--font-display:
  "Kanit", "Prompt" /* Headers, Numbers, Display */ --font-sans: "Prompt",
  "Inter" /* Body, Labels, UI Text */;
```

### 3.2 ขนาด Text

| ใช้กับ                     | ขนาด        | Font   | Weight |
| -------------------------- | ----------- | ------ | ------ |
| Dashboard Number (Balance) | 2.5rem–4rem | Kanit  | 700    |
| Page Title (h1)            | 1.5rem      | Kanit  | 600    |
| Section Header (h2)        | 1.125rem    | Prompt | 600    |
| Body Text                  | 0.9375rem   | Prompt | 400    |
| Label                      | 0.8125rem   | Prompt | 500    |
| Caption / Help             | 0.75rem     | Prompt | 400    |

### 3.3 กฎ Typography

- **ฟอนต์ต้องใหญ่กว่าปกติ** — ผู้สูงอายุต้องอ่านได้ชัด minimum 15px
- **ตัวเลขเงิน** ต้องใช้ `.num-display` class (Tabular Numbers) เสมอ
- **ภาษาไทย** ต้องเลือก Prompt ไม่ใช่ Inter (Inter render ไทยไม่ดี)
- ห้าม mix font ใน Element เดียวกัน

---

## 4. Layout & Spacing

### 4.1 Primary Platform

**iPad เป็น First-class Platform** (ไม่ใช่ Desktop)

เหตุผล: เหรัญญิกและศิษยาภิบาลใช้ iPad ในการทำงานจริง

```
iPad (1024px):     Primary breakpoint
Desktop (1280px+): Second priority
Mobile (375px):    Must work, not primary
```

### 4.2 Layout Rules

- Sidebar navigation สำหรับ Desktop และ iPad
- Bottom navigation สำหรับ Mobile
- Max content width: 1200px (ไม่ให้กว้างเกินจนอ่านยาก)
- Content padding: 24px (tablet), 32px (desktop)

### 4.3 Grid System

- 12-column grid
- Gap ระหว่าง cards: 16px
- Section spacing: 32px
- Page-level padding: 24px

---

## 5. Component Rules

### 5.1 Cards

```css
/* ทุก Card ต้องใช้ style นี้ */
rounded-xl border border-border/80 bg-card shadow-2xs
```

- Cards ต้อง padding ภายใน 20px–24px
- ห้าม nested cards ลึกเกิน 1 ชั้น
- Cards ที่ clickable ต้องมี hover state

### 5.2 Buttons

```css
/* Primary CTA */
bg-primary text-primary-foreground active:scale-[0.98] transition-all duration-150

/* ทุก Button ต้องมี */
- Active press scale: active:scale-[0.98]
- Transition: transition-all duration-150
- Min height: 44px (touch target)
- Loading state เสมอ (ไม่ให้ click ซ้ำ)
```

### 5.3 Financial Numbers

```html
<!-- ใช้ class num-display กับตัวเลขเงินทุกตัว -->
<span class="num-display font-display">฿ 1,234,567.00</span>
```

- ตัวเลขเงินต้องมีทศนิยม 2 ตำแหน่งเสมอ
- ใช้ comma separators: 1,234,567.00
- บวก = emerald, ลบ = coral red
- ตัวเลขขนาดใหญ่บน Dashboard → ฟอนต์ใหญ่ขึ้น

### 5.4 Form Elements

- Label อยู่เหนือ Input เสมอ (ไม่ใช่ Placeholder)
- ข้อความ Error แสดงใต้ Input ทันที (real-time validation)
- Required fields มี \* สีแดง
- Input height minimum 44px (touch-friendly)
- Focus state ต้องชัดเจน (ring + color)

### 5.5 Tables (ใช้น้อยที่สุด)

- ถ้าข้อมูลมีน้อยกว่า 5 columns → ใช้ Card list แทน
- ถ้าจำเป็นต้องใช้ table → sticky header, สลับสี row
- Mobile: ซ่อน column ที่ไม่จำเป็น

---

## 6. Navigation Structure

### 6.1 Main Navigation (Sidebar)

```
Dashboard           ← หน้าแรก, ตัวเลขหลัก
├── รายรับ          ← Income Transactions
├── รายจ่าย         ← Expense Transactions
├── เงินถวาย         ← Offering & Collection
├── กองทุน           ← Fund Management
├── รายงาน           ← Reports & Export
├── ผู้ใช้งาน         ← User Management (Admin only)
└── ตั้งค่า           ← Settings (Admin only)
```

- Navigation ลึกสูงสุด 2 ชั้น (Main → Sub)
- Active state ชัดเจน (left border + background)
- Icon + Label เสมอ (ไม่ใช้ icon เดี่ยว)

### 6.2 Dashboard Layout

```
┌─────────────────────────────────────────────┐
│  HEADER: Church Name | Date | User           │
├──────┬──────────────────────────────────────┤
│      │  ┌─────────┐ ┌─────────┐ ┌────────┐ │
│ NAV  │  │ Balance │ │ Income  │ │Expense │ │
│      │  │ (BIG)   │ │(Month)  │ │(Month) │ │
│      │  └─────────┘ └─────────┘ └────────┘ │
│      │                                      │
│      │  ┌─────────────────────────────────┐ │
│      │  │ Pending Approvals (Action Req.) │ │
│      │  └─────────────────────────────────┘ │
│      │                                      │
│      │  Recent Transactions                 │
└──────┴──────────────────────────────────────┘
```

---

## 7. UX Rules (สิ่งที่ต้องทำ)

### 7.1 Accessibility

- Font size minimum 15px สำหรับ body text
- Touch target minimum 44px x 44px
- Color contrast ratio ≥ 4.5:1 (WCAG AA)
- ทุก Form field ต้องมี label ที่อ่านได้ (ไม่ใช้แค่ placeholder)
- Focus indicators ชัดเจน

### 7.2 Performance

- Page load < 2 วินาที บน 4G
- ห้ามใช้ Animation หนัก (framer-motion ใช้ได้ แต่ duration < 300ms)
- ห้าม animation loop ที่รบกวนสายตา
- Skeleton loading สำหรับ data-heavy components

### 7.3 Empty States

- ทุก list/table ต้องมี Empty State
- Empty State ต้องอธิบายว่า "ยังไม่มีข้อมูล" + "ทำอะไรได้" (CTA)
- ห้ามแสดง error เมื่อ list ว่างเปล่า

### 7.4 Error Handling

- Error messages เป็นภาษาไทย เข้าใจง่าย
- ห้าม Technical error เช่น "Error 500" — แสดง "ระบบขัดข้อง กรุณาลองใหม่"
- Toast notification สำหรับ Success/Error actions
- Form validation แสดง real-time

### 7.5 Loading States

- ทุก async action ต้องมี loading indicator
- ห้าม double-submit (disable button ขณะ loading)
- Skeleton UI สำหรับ initial page load

---

## 8. Notifications

### 8.1 Toast Notifications (In-app)

- Success: สีเขียว, ขวาล่าง, 3 วินาทีแล้วหาย
- Error: สีแดง, ขวาล่าง, คงอยู่จนกว่า user จะ dismiss
- Warning: สีส้ม, ขวาล่าง, 5 วินาที
- Info: สีน้ำเงิน, ขวาล่าง, 3 วินาที

### 8.2 Action Required Badges

- Dashboard แสดง badge ถ้ามีรายการรออนุมัติ
- Sidebar icon มี red dot ถ้ามี pending action

---

## 9. Mobile Rules

- Bottom navigation แทน Sidebar บน Mobile
- ซ่อน secondary columns บน screen เล็ก
- Full-width cards บน Mobile
- Larger touch targets บน Mobile
- Swipe actions สำหรับ list items (approve/reject)

---

## 10. Design Don'ts

- ❌ ห้าม gradient text (อ่านยาก, ไม่ professional)
- ❌ ห้ามใช้ animation ที่กวนสายตา
- ❌ ห้ามใช้ font ขนาดเล็กกว่า 13px
- ❌ ห้ามใช้ line-height น้อยกว่า 1.5 สำหรับ body text
- ❌ ห้ามซ่อน navigation บน Desktop
- ❌ ห้ามใช้สีพาสเทลเข้มมากจนอ่านยาก
- ❌ ห้าม placeholder text แทน label
- ❌ ห้ามใช้ Alert dialog สำหรับทุกการกระทำ

---

_Version: 2.0 | July 2026_
