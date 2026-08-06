# DESIGN.md — Grace Ledger Single Source of Truth

> อัปเดต: 2026-08-06 (เพิ่ม §2.4 Premium Dark Mode — live ทั้งแอป)
> รวม: LedgerCraft (designmd) + DESIGN_TOKENS.md + DESIGN_SYSTEM_V3.md + COMPONENT_LIBRARY.md + MOTION_GUIDELINES.md
> เป้าหมาย: **ป้องกัน AI slop** — ทุกหน้าต้องยึดเอกสารนี้เป็นหลัก ห้ามใช้ aesthetic ทั่วไปที่ AI มักใส่

---

## 1. หลักการกำกับ — 5 คำนิยาม

**Calm · Exact · Spacious · Quiet · Honest**

นี่คือซอฟต์แวร์การเงิน — ห้ามแลก usability กับความสวยงามเด็ดขาด
ทุกการตัดสินใจด้าน design ที่ทำให้ความเร็วกรอกข้อมูล ความอ่านง่าย ความตรวจสอบได้ (auditability) หรือความชัดเจนทางการเงินลดลง = **ปฏิเสฐทันที**

**ห้าม:**

- Decorative illustration, playful iconography, gradient ที่ไม่จำเป็น
- Animation ที่ยาวกว่า 300ms (ยกเว้น page transition)
- Shadow หนัก (heavy shadow) ที่ไหนทั้งระบบ
- สีจัดจ้าน (oversaturated) ทุกสีต้อง muted
- ขอบมนเกิน 4px สำหรับตารางและ cell (บาง element อนุญาต ดู §4)

---

## 2. ระบบสี

### 2.1 Base — Light mode

| Token          | ค่า oklch               | บทบาท                             |
| -------------- | ----------------------- | --------------------------------- |
| `--background` | `oklch(0.985 0.004 80)` | พื้นหลัง — warm near-white        |
| `--foreground` | `oklch(0.19 0.014 258)` | ข้อความหลัก — slate เข้ม          |
| `--card`       | `oklch(1 0 0)`          | การ์ด — ขาวบริสุทธิ์              |
| `--primary`    | `oklch(0.53 0.17 258)`  | น้ำเงิน muted — CTA, active state |
| `--secondary`  | `oklch(0.96 0.005 80)`  | เทาอุ่น                           |
| `--muted`      | `oklch(0.965 0.004 80)` | เทาอุ่นอ่อนกว่า                   |
| `--border`     | `oklch(0.9 0.006 80)`   | เส้นขอบ                           |

### 2.2 Finance-specific — **สีการเงินต้องใช้ตามนี้เท่านั้น**

| Token                      | ค่า oklch              | ความหมาย                                  |
| -------------------------- | ---------------------- | ----------------------------------------- |
| `--income` / `--approved`  | `oklch(0.5 0.13 155)`  | **Emerald** — รายรับ, เครดิต, อนุมัติแล้ว |
| `--expense` / `--rejected` | `oklch(0.55 0.17 25)`  | **Red** — รายจ่าย, เดบิต, ปฏิเสธ          |
| `--offering` / `--pending` | `oklch(0.7 0.13 80)`   | **Amber** — เงินถวาย, รออนุมัติ           |
| `--info`                   | `oklch(0.58 0.12 222)` | **Sky** — ข้อมูลทั่วไป (แยกจาก primary)   |

**กติกา:** ห้ามใช้สีเขียวนอกเหนือจาก income/approved, ห้ามใช้สีแดงนอกเหนือจาก expense/rejected
ทุกสีมี `-foreground` และ `-muted` ให้ใช้ (เช่น `--income-muted` สำหรับ badge)

### 2.3 Chart palette

| Token       | ค่า                    | สี                |
| ----------- | ---------------------- | ----------------- |
| `--chart-1` | `oklch(0.53 0.17 258)` | น้ำเงิน           |
| `--chart-2` | `oklch(0.5 0.13 155)`  | มรกต              |
| `--chart-3` | `oklch(0.55 0.17 25)`  | แดง               |
| `--chart-4` | `oklch(0.7 0.13 80)`   | อำพัน             |
| `--chart-5` | `oklch(0.6 0.11 195)`  | เขียวอมฟ้า (teal) |

### 2.4 Dark mode — Premium (Balanced Linear/Arc)

**Status:** Live — `dark` class ผูกถาวรบน `<html>` (`__root.tsx`), `ThemeProvider defaultTheme="dark"` ทั้งแอป

| Token                | ค่า oklch               | บทบาท                                                                    |
| -------------------- | ----------------------- | ------------------------------------------------------------------------ |
| `--background`       | `oklch(0.13 0.012 258)` | พื้นหลัง — slate เข้ม                                                    |
| `--foreground`       | `oklch(0.97 0.004 258)` | ข้อความหลัก — off-white                                                  |
| `--card`             | `oklch(0.16 0.012 258)` | การ์ด — เข้มกว่า bg นิด                                                  |
| `--primary`          | `oklch(0.6 0.15 155)`   | **Emerald** (เปลี่ยนจาก blue ใน light mode) — CTA, active, positive flow |
| `--sidebar`          | `oklch(0.11 0.012 258)` | เข้มกว่า page bg                                                         |
| `--border`           | `oklch(1 0 0 / 10%)`    | white-alpha                                                              |
| `--surface-elevated` | `oklch(0.19 0.012 258)` | ยกขึ้นจาก card (hover/elevated state)                                    |
| `--border-subtle`    | `oklch(1 0 0 / 6%)`     | ขอบจางสำหรับ table cell (`border-subtle` utility)                        |

**กติกาเพิ่มเติมสำหรับ dark mode:**

- ห้าม glassmorphism/backdrop-blur ทั้งระบบ (เฉพาะ topbar `bg-background/80`)
- ห้าม gradient บน card/section/SVG stroke — ใช้ flat token color เสมอ (เช่น gauge chart progress arc ใช้ `text-primary` เดี่ยว ไม่ใช่ `linearGradient`)
- ห้าม drop-shadow glow บน icon/logo
- Animation ceiling เข้มกว่า light mode: **≤250ms** (ดู §8 สำหรับ ceiling รวม 400ms)
- Contrast ตรวจแล้ว (คำนวณจริงจาก oklch): foreground/background 18.45:1, muted-foreground/background 5.10:1 — ผ่าน WCAG AA ทุกคู่

### 2.5 กติกา hardcode

**ห้าม hardcode hex/oklch ใน component** — ต้องอ้างอิง CSS variable หรือ Tailwind utility เสมอ
(ใช้ `var(--color-primary)` หรือ `bg-primary` เท่านั้น)

---

## 3. Typography

| Token                            | ค่า                                                        |
| -------------------------------- | ---------------------------------------------------------- |
| `--font-sans` / `--font-display` | `"Inter", "Sarabun", ui-sans-serif, system-ui, sans-serif` |
| `--font-mono`                    | `"JetBrains Mono", "Fira Code", ui-monospace, monospace`   |
| Body font size                   | **15px** (ไม่ใช่ 16px default)                             |
| Line-height                      | 1.6 (body), 1.25 (heading)                                 |

- **Latin/UI/ตัวเลข**: Inter
- **ภาษาไทย**: Sarabun (Inter render ภาษาไทยไม่ดี)
- **ตัวเลข**: ใช้ `.num-display` utility เสมอ — `tabular-nums`, `font-feature-settings: "tnum" 1`
- Heading: `font-weight: 600`, `letter-spacing: -0.02em`, `text-wrap: balance`

---

## 4. Radius — **มีข้อยกเว้น อ่านให้ดี**

LedgerCraft แนะนำ 4px แต่ Grace Ledger ใช้ค่าที่มนกว่า (เหมาะกับแอคคริสตจักร ไม่ใช่ pure enterprise):

| Element      | Token             | ค่า      | หมายเหตุ                   |
| ------------ | ----------------- | -------- | -------------------------- |
| การ์ด        | `--radius-card`   | **16px** | ใช้ border แทน shadow      |
| ปุ่ม         | `--radius-button` | **12px** | ไม่ใช่ 4px แบบ LedgerCraft |
| Input/Select | `--radius-input`  | **10px** |                            |
| Dialog       | `--radius-dialog` | **20px** |                            |
| Sheet/Drawer | `--radius-sheet`  | **24px** |                            |
| Badge, Pill  | `rounded-full`    | —        |                            |
| ตาราง, cell  | **0px**           | —        | ห้ามมน, ใช้ border แยกแทน  |

Generic scale: `rounded-sm` 8px / `rounded-md` 12px / `rounded-lg` 16px / `rounded-xl` 20px / `rounded-2xl` 24px

**กติกา:** ห้ามใช้ radius > 4px กับตารางข้อมูล — ใช้ border เป็น depth indicator แทน

---

## 5. Spacing

Tailwind v4 default scale (4px multiplier) — ไม่มี custom token
`p-1`=4px, `p-2`=8px, `p-3`=12px, `p-4`=16px, `p-6`=24px, `p-8`=32px, `p-12`=48px, `p-24`=96px

**กติกา:** ตารางใช้ `px-5 py-3` (20px/12px) เป็น compact default สำหรับ cell

---

## 6. Elevation (เงา)

ปรัชญา: **Border เหนือกว่า shadow** — ใช้เงาเฉพาะจุด overlap จริง (drawer, dialog, popover)

```css
shadow-xs:       0 1px 2px 0 rgb(0 0 0 / 0.03)
shadow-sm-card:  0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.03)
shadow-card:     0 1px 2px 0 rgb(0 0 0 / 0.04), 0 3px 10px -4px rgb(0 0 0 / 0.04)
shadow-elevated: 0 1px 4px -1px rgb(0 0 0 / 0.05), 0 6px 16px -6px rgb(0 0 0 / 0.06)
```

การ์ดเรียบใช้ border เท่านั้น — **ไม่มีเงาหนักที่ไหนในระบบ**

---

## 7. Icons

**Lucide React เท่านั้น** — ขนาด 16/20/24/32px ตามบริบท, `strokeWidth: 1.5` เป็น default, `2` เฉพาะ active state

---

## 8. Motion

**Framer Motion** เป็น JS library เดียว (GSAP ถูกถอดแล้ว) + CSS keyframe utility สำหรับ entrance

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1) /* หลัก — Emil Kowalski curve */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1) --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1) /* ใช้น้อยมาก */;
```

| ประเภท                   | ระยะเวลา        | Easing       |
| ------------------------ | --------------- | ------------ |
| Micro (press/hover)      | 100–150ms       | `--ease-out` |
| Component (dialog/sheet) | 200–250ms       | `--ease-out` |
| Page transition          | 250–300ms       | `--ease-out` |
| Stagger (list mount)     | delay 40ms/item | `--ease-out` |

**กติกาเหล็ก:**

- ห้ามเกิน 400ms ต่อ interaction
- ห้าม bounce/elastic กับ business UI
- ห้าม animate-spin/animate-bounce เพื่อ decoration
- ต้องเคารพ `prefers-reduced-motion: reduce` เสมอ
- **ห้าม NumberTicker animation** กับยอดเงินหลัก (ดูไป flashy เกินไปสำหรับแอปการเงิน)

---

## 9. Component Reference

### Buttons

- **Primary**: `bg-primary text-primary-foreground`, hover: `bg-primary/90`
- **Secondary**: `bg-secondary text-secondary-foreground`, border
- **Outline**: border, ghost text
- **Destructive**: `bg-destructive text-destructive-foreground`
- **Size**: default 44px, sm 36px (เฉพาะ action ในแถวตาราง), lg 48px
- **กติกา**: ห้ามใช้ raw `<button>` — ใช้ `ui/button.tsx` เสมอ

### Inputs

- **Default**: 1px border `#CBD5E1`, white fill, 32px height
- **Focus**: 1px border `var(--color-primary)`, 2px ring
- **Error**: 1px border `var(--color-destructive)`
- **Label** อยู่เหนือ field เสมอ — ห้ามใช้ placeholder แทน label

### Cards

- Background: white, border 1px `var(--color-border)`, radius 16px
- ไม่มี shadow หนัก — ใช้ border เป็น depth
- Hover: border เข้มขึ้น + translate-y -0.5 (interactive variant เท่านั้น)

### Tables

- **ใช้กับ transaction log / audit trail** — ห้ามใช้กับ entity ที่เน้นตัวเลขใหญ่ (Funds/Budget/Projects ใช้ grid ของการ์ดแทน)
- กฎ LedgerCraft บังคับ:
  - Right-align ทุก numerical column
  - ใช้ตำแหน่งทศนิยมที่สม่ำเสมอในแต่ละคอลัมน์ (2 ตำแหน่งสำหรับเงิน, 4 สำหรับภาษี)
  - ใช้ tabular-nums ทุกตัวเลข
  - สลับพื้นหลังแถว (#FFFFFF / #F1F5F9) เมื่อมีมากกว่า 5 แถว
  - Sticky header + frozen first column สำหรับตารางกว้าง
  - Sort indicator ทุกคอลัมน์ + ตารางต้อง sortable เป็น default

### StatCard (KPI summary)

- ใช้ `border` + `bordered accent strip` (ซ้าย) แทน gradient background
- Value: `num-display font-display text-[28px] md:text-[32px] font-bold`
- **ไม่มี NumberTicker animation** — แสดงค่าตรง ๆ
- Trend indicator ใช้ `bg-success/10` หรือ `bg-destructive/10` + TrendingUp/Down icon

### PageHeader

- Kicker: `.kicker` utility (11px uppercase tracking-wider)
- Title: `font-display text-[26px] md:text-[32px] font-bold`
- Description: `text-sm text-muted-foreground`
- Actions: อยู่ขวา ไม่ใต้ title

### StatusBadge

- ใช้สี + ไอคอนเสมอ (ไม่ใช่สีอย่างเดียว)
- Paid = emerald bg + text + border
- Overdue = amber bg + text + border
- Draft = slate bg + text + border

### EmptyState

- ทุกหน้าที่ fetch data ต้องมี 3 state: **Loading (skeleton)** / **Error + retry** / **Empty + action**
- **ห้าม** silently fallback เป็นข้อมูลปลอม (fake demo data)

---

## 10. Responsive

**Desktop/laptop ก่อน, iPad เท่าเทียม, มือถือเป็นรอง**

Breakpoint: `sm` 640 / `md` 768 / `lg` 1024 (iPad) / `xl` 1280 / `2xl` 1536

| Layout     | <md       | md+                                |
| ---------- | --------- | ---------------------------------- |
| Navigation | BottomNav | AppSidebar (icon rail) + AppTopbar |

Touch target ขั้นต่ำ **44px** ทั้ง desktop และ mobile (ยกเว้น Button size="sm" 36px สำหรับ action ในแถวตาราง)

---

## 11. Accessibility

- WCAG AA contrast ขั้นต่ำ
- Keyboard navigation ครบ
- `:focus-visible` ring มองเห็นชัด (2px solid var(--color-ring))
- Screen-reader ผ่าน Radix/shadcn primitives

---

## 12. Anti-Slop Rules — **บังคับทุกหน้า**

### สิ่งที่ห้ามทำ (AI มักทำ):

1. ❌ **Gradient background บน hero/card** — ใช้ flat color + border
2. ❌ **NumberTicker animation กับเงิน** — ดู flashy ไป แสดงตัวเลขตรง ๆ
3. ❌ **Glassmorphism / backdrop-blur** เกินจำเป็น — ใช้เฉพาะ topbar
4. ❌ **Drop-shadow glow บน icon/logo** — ห้าม decoration ที่ไม่จำเป็น
5. ❌ **Hover scale-110 บนไอคอน** — ไม่จำเป็นสำหรับ data-dense UI
6. ❌ **Bounce/spring animation** — ไม่ใช่เกมหรือ social media
7. ❌ **Decorative SVG/illustration** — นี่คือซอฟต์แวร์บัญชี
8. ❌ **Fake demo data เมื่อว่าง** — ต้องมี EmptyState + action
9. ❌ **Mixed debit/credit color** — green = credit, red = debit เสมอ
10. ❌ **Rounding totals** — แสดงค่าจริงเสมอ ไม่ปัด
11. ❌ **Compact table padding ต่ำกว่า py-3 px-5** — ต้องอ่านง่าย
12. ❌ **Sticky first column ของตาราง transaction** — บังคับถ้ากว้าง

### สิ่งที่ต้ำทำ (LedgerCraft principles):

1. ✅ **ตัวเลขคือ hero** — ไม่ใช่การ์ดตกแต่ง
2. ✅ **Right-align ทุก numerical column**
3. ✅ **Tabular-nums เสมอ**
4. ✅ **Alternating row backgrounds** เมื่อ > 5 แถว
5. ✅ **Consistent decimal places** ในแต่ละคอลัมน์
6. ✅ **Border เป็น depth** ไม่ใช่ shadow
7. ✅ **สี muted** ไม่ oversaturated
8. ✅ **สี + ไอคอน** สำหรับ status เสมอ

---

## 13. ตัวอย่าง Pattern ที่ถูกต้อง

### ✅ ตาราง transaction

```tsx
<Table>
  <TableHeader className="sticky top-0 z-10 bg-card">
    <TableRow>
      <TableHead className="w-[120px]">วันที่</TableHead>
      <TableHead>รายละเอียด</TableHead>
      <TableHead>หมวดหมู่</TableHead>
      <TableHead className="text-right">จำนวน</TableHead>
      <TableHead className="text-center">สถานะ</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {rows.map((r) => (
      <TableRow key={r.id}>
        <TableCell className="num-display">{fmtDate(r.date)}</TableCell>
        <TableCell>{r.description}</TableCell>
        <TableCell>{r.category}</TableCell>
        <TableCell className="text-right num-display">
          <MoneyText value={r.amount} />
        </TableCell>
        <TableCell className="text-center">
          <StatusBadge status={r.status} />
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### ✅ การ์ด KPI

```tsx
<div className="rounded-card border border-border/60 bg-card p-5">
  <p className="kicker text-muted-foreground">รายรับเดือนนี้</p>
  <p className="num-display font-display mt-2 text-[28px] font-bold text-success">
    {thb(incomeMonth)}
  </p>
  <p className="mt-2 text-xs text-muted-foreground">{incomes.length} รายการ</p>
</div>
```

### ✅ EmptyState

```tsx
<EmptyState
  icon={ArrowDownCircle}
  title="ยังไม่มีรายรับ"
  description="เริ่มบันทึกรายรับเพื่อดูข้อมูลที่นี่"
  action={<Button onClick={() => setOpen(true)}>บันทึกรายรับ</Button>}
/>
```

---

## 14. การใช้เอกสารนี้

**ทุกครั้งที่สร้างหรือแก้ไข UI:**

1. อ่าน §12 (Anti-Slop Rules) ก่อนเป็นอันดับแรก
2. ใช้สีจาก §2 เท่านั้น
3. ใช้ radius จาก §4 เท่านั้น
4. ใช้ motion จาก §8 เท่านั้น
5. ตรวจสอบกับ §12 อีกครั้งก่อน commit

**ถ้าเอกสารนี้ขัดกับโค้ดปัจจุบัน → ให้โค้ดชนะ แล้วอัปเดตเอกสารนี้**

---

## 15. ไฟล์ที่เกี่ยวข้อง

| ไฟล์                                           | สถานะ                                             |
| ---------------------------------------------- | ------------------------------------------------- |
| `src/styles.css`                               | ✅ Source of truth ค่าจริง — อัปเดตแล้ว           |
| `DESIGN_TOKENS.md`                             | ⚠️ ล้าสมัยบางส่วน (radius เก่า) — ให้เอกสารนี้ชนะ |
| `DESIGN_SYSTEM_V3.md`                          | ✅ หลักการระดับสูง — ยังใช้ได้                    |
| `COMPONENT_LIBRARY.md`                         | ✅ สถานะ migration component                      |
| `MOTION_GUIDELINES.md`                         | ✅ รายละเอียด motion + implementation             |
| `RESPONSIVE_GUIDELINES.md`                     | ✅ Breakpoint strategy + testing checklist        |
| `docs/design/GRACE_LEDGER_VNEXT_MASTERPLAN.md` | ✅ ทิศทาง vNext                                   |
