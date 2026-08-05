# DESIGN.md — Grace Ledger

> สรุปโทนสีและสไตล์ UI **ตามที่ implement จริง** ใน `src/styles.css` และ component
> ปัจจุบัน (ไม่ใช่เอกสารเชิง aspiration) ณ วันที่วิเคราะห์: 2026-08-05
>
> อ้างอิงจาก: `src/styles.css`, `src/components/ui/*.tsx`,
> `DESIGN_SYSTEM_V3.md`, `DESIGN_TOKENS.md`, `COMPONENT_LIBRARY.md`,
> `MOTION_GUIDELINES.md`, `RESPONSIVE_GUIDELINES.md`,
> `docs/design/GRACE_LEDGER_VNEXT_MASTERPLAN.md`
>
> ⚠️ **หมายเหตุความคลาดเคลื่อน**: `DESIGN_TOKENS.md`/`DESIGN_SYSTEM_V3.md` ยัง
> ระบุค่า radius แบบ v3.0 เดิม (การ์ด 24px / ปุ่ม 18px / input 16px) แต่
> `src/styles.css` ถูกอัปเดตเป็นค่า **vNext** ที่เล็กลงแล้ว (การ์ด 16px / ปุ่ม
> 12px / input 10px) ตามคอมมิต `67e291f` และ
> `docs/design/GRACE_LEDGER_VNEXT_MASTERPLAN.md` §4 — เอกสารนี้ยึดค่าจริงใน
> CSS เป็นหลัก (ตามกฎ "ถ้าเอกสารกับโค้ดขัดกัน โค้ดชนะ" ที่ `DESIGN_TOKENS.md`
> เขียนไว้เอง)

---

## 1. หลักการกำกับ (Governing Principle)

**นี่คือซอฟต์แวร์การเงิน — usability สำคัญกว่าความสวยงามเสมอ** การตัดสินใจ
ด้าน design ใดก็ตามที่ลดความเร็วในการกรอกข้อมูล ความอ่านง่าย ความตรวจสอบได้
(auditability) หรือความชัดเจนทางการเงิน จะถูกปฏิเสธ ไม่ว่าจะดู premium แค่ไหน

**DNA**: Apple HIG × Stripe Dashboard × Linear × Mercury × Revolut × Notion —
ผสาน "Gridgeist" thesis ของ vNext (ตัวเลข/ตารางคือ hero ไม่ใช่การ์ดตกแต่ง)

5 คำนิยาม design language (จาก vNext masterplan): **calm, exact, spacious,
quiet, honest**

---

## 2. ระบบสี (Color System)

พื้นฐานเป็นกลาง (White / Warm Gray / Slate) + สี semantic แบบ muted 5 สี
ไม่มีสีจัดจ้าน (oversaturated) เลย ทุกสีประกาศเป็น CSS custom property ด้วย
`oklch()` ใน `:root` (light) / `.dark` (dark) แล้ว re-export เป็น Tailwind
utility ผ่าน `@theme inline`

### 2.1 Base palette — Light mode

| Token | ค่า oklch | บทบาท |
|---|---|---|
| `--background` | `oklch(0.985 0.004 80)` | พื้นหลังหน้า — ขาวอมเหลืองอ่อนมาก (warm near-white) |
| `--foreground` | `oklch(0.19 0.014 258)` | ข้อความหลัก — slate เข้ม |
| `--card` | `oklch(1 0 0)` | พื้นผิวการ์ด — ขาวบริสุทธิ์ |
| `--primary` | `oklch(0.53 0.17 258)` | **น้ำเงิน muted** — CTA, active state, ระดับ Stripe/Linear |
| `--secondary` | `oklch(0.96 0.005 80)` | พื้นผิวเทาอุ่น (warm gray) |
| `--muted` | `oklch(0.965 0.004 80)` | พื้นผิวรอง เทาอุ่นอ่อนกว่า secondary |
| `--muted-foreground` | `oklch(0.5 0.014 258)` | ข้อความรอง — slate กลาง |
| `--accent` | `oklch(0.94 0.02 258)` | ฟ้าอ่อนมาก (tint) |
| `--destructive` | `oklch(0.55 0.17 25)` | **แดง muted** |
| `--border` | `oklch(0.9 0.006 80)` | เส้นขอบเทาอุ่น |
| `--input` | `oklch(0.92 0.005 80)` | พื้นหลัง input |
| `--ring` | `oklch(0.53 0.17 258)` | focus ring — เท่ากับ primary |

### 2.2 สีการเงิน (Finance-specific)

| Token | ค่า oklch | ความหมาย |
|---|---|---|
| `--income` / `--approved` / `--success` | `oklch(0.5 0.13 155)` | **มรกต (Emerald)** — เงินไหลเข้า / อนุมัติแล้ว |
| `--expense` / `--rejected` / `--destructive` | `oklch(0.55 0.17 25)` | **แดง (Red)** — เงินไหลออก / ปฏิเสธ |
| `--offering` / `--pending` / `--warning` | `oklch(0.7 0.13 80)` | **อำพัน (Amber)** — เงินถวาย / รออนุมัติ |
| `--info` | `oklch(0.58 0.12 222)` | **ฟ้า (Sky)** — ข้อมูลทั่วไป แยกจาก primary ชัดเจน |

แต่ละสีมี `-foreground` (ข้อความบนพื้นสีนั้น) และ `-muted` (พื้นหลัง badge)
เช่น `--income-muted: oklch(0.95 0.035 155)` สำหรับพื้นหลัง badge สีเขียวอ่อน

### 2.3 Chart palette (5 สี)

| Token | ค่า | สี |
|---|---|---|
| `--chart-1` | `oklch(0.53 0.17 258)` | น้ำเงิน (primary) |
| `--chart-2` | `oklch(0.5 0.13 155)` | มรกต (income) |
| `--chart-3` | `oklch(0.55 0.17 25)` | แดง (expense) |
| `--chart-4` | `oklch(0.7 0.13 80)` | อำพัน (offering) |
| `--chart-5` | `oklch(0.6 0.11 195)` | เขียวอมฟ้า (teal) — accent ที่ 5 แยกจาก primary |

### 2.4 Dark mode

พื้นหลัง slate เข้ม (`oklch(0.16 0.012 258)`) แนว Linear.app สีความหมายเดิม
ทั้งหมดถูกยกความสว่าง (lightness) ขึ้นเพื่อคงคอนทราสต์บนพื้นเข้ม เช่น
`--primary` จาก L=0.53 → 0.68, `--income` จาก L=0.5 → 0.6, ส่วน `--border`
เปลี่ยนไปใช้ white-alpha แทน (`oklch(1 0 0 / 8%)`)

### 2.5 กติกาการใช้สี

- **ห้าม hardcode** ค่า hex/oklch ในโค้ด component (className, inline style,
  SVG `stopColor`) ต้องอ้างอิง CSS variable (`var(--color-primary)`) หรือ
  Tailwind utility (`bg-primary`, `text-warning`) เสมอ — รอบ v3.0 พบไฟล์ที่
  ละเมิดกฎนี้ 6 ไฟล์ (ค่าเก่าจาก v2.0 ที่หลุด sync)
- สถานะ (status) ต้องสื่อด้วย **สี + ไอคอนเสมอ** ไม่ใช้สีอย่างเดียว

---

## 3. Typography

| Token | ค่า |
|---|---|
| `--font-sans` / `--font-display` | `"Inter", "Sarabun", ui-sans-serif, system-ui, sans-serif` |
| `--font-mono` | `"JetBrains Mono", "Fira Code", ui-monospace, monospace` |
| ขนาด body | **15px** (ไม่ใช่ 16px default ของ Tailwind — เผื่อผู้ใช้สูงอายุ/อาสาสมัครคริสตจักร) |
| line-height | 1.6 (body), 1.25 (heading) |

- **Latin/UI/ตัวเลข**: Inter
- **ภาษาไทย**: Sarabun (จงใจคงไว้ — Inter render ภาษาไทยได้ไม่ดี แอปนี้เป็น
  Thai-first) โหลดจาก Google Fonts ใน `src/routes/__root.tsx` (`Sarabun`
  weight 300–700, `Inter` variable font)
- **ตัวเลข**: ใช้ `tabular-nums` เสมอผ่าน utility `.num-display` หรือ
  `MoneyText` component — ตัวเลขการเงินคือจุดโฟกัสหลักของทุกหน้า
  (`font-feature-settings: "tnum" 1, "lnum" 1, "zero" 1, "ss01" 1`)
- Heading: `font-weight: 600`, `letter-spacing: -0.02em`, `text-wrap: balance`

---

## 4. Radius Scale — ⚠️ ค่าปัจจุบัน (vNext, tightened)

`src/styles.css` ปัจจุบัน (base `--radius: 0.75rem` = 12px):

| Element | Token | ค่าจริงใน CSS | ค่าที่ DESIGN_TOKENS.md เก่าระบุ |
|---|---|---|---|
| การ์ด | `--radius-card` | **1rem (16px)** | ~~24px~~ (v3.0 เดิม, เอกสารยังไม่อัปเดต) |
| ปุ่ม | `--radius-button` | **0.75rem (12px)** | ~~18px~~ |
| Input/Select | `--radius-input` | **0.625rem (10px)** | ~~16px~~ |
| Dialog | `--radius-dialog` | **1.25rem (20px)** | ~~28px~~ |
| Sheet/Drawer | `--radius-sheet` | **1.5rem (24px)** | ~~32px~~ |
| Badge | `rounded-full` (pill) | — | ตรงกัน |

เหตุผล (จาก `GRACE_LEDGER_VNEXT_MASTERPLAN.md` §4): ค่าการ์ด 24px/ปุ่ม 18px
เดิมดู "soft toy" เกินไปเมื่อเทียบกับ reference set (Linear/Stripe) จึงลดลง
โดยคง token name เดิม เปลี่ยนแค่ค่า — cascade ทั้งแอปด้วยไฟล์เดียว

Generic scale (ไม่มี named token): `rounded-sm` 8px / `rounded-md` 12px /
`rounded-lg` 16px / `rounded-xl` 20px / `rounded-2xl` 24px / `rounded-full`

---

## 5. Spacing

ไม่มี custom token — ใช้ scale เริ่มต้นของ Tailwind v4 (`4px` multiplier)
ซึ่งตรงกับกติกา 8px-grid อยู่แล้ว: `p-1`=4px, `p-2`=8px, `p-3`=12px,
`p-4`=16px, `p-6`=24px, `p-8`=32px, `p-12`=48px, `p-16`=64px, `p-24`=96px

---

## 6. Elevation (เงา)

ปรัชญา vNext: **border เหนือกว่า shadow** — ใช้เงาเฉพาะจุดที่มี overlap จริง
(drawer, dialog, popover) การ์ดเรียบใช้ border เท่านั้น ไม่แต่งเงาเพิ่ม

```css
shadow-xs:       0 1px 2px 0 rgb(0 0 0 / 0.03)
shadow-sm-card:  0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.03)
shadow-card:     0 1px 2px 0 rgb(0 0 0 / 0.04), 0 3px 10px -4px rgb(0 0 0 / 0.04)
shadow-elevated: 0 1px 4px -1px rgb(0 0 0 / 0.05), 0 6px 16px -6px rgb(0 0 0 / 0.06)
shadow-primary-glow: 0 0 24px -4px oklch(0.53 0.17 258 / 0.25)
```

ไม่มีเงาหนัก (heavy shadow) ที่ไหนในระบบ — เจตนา "เงียบ" (quiet) ตามคำนิยาม
design language

---

## 7. Icons

**Lucide React เท่านั้น** ขนาด 16/20/24/32px ตามบริบท `strokeWidth: 1.5`
เป็นค่าเริ่มต้น, `2` เฉพาะ active state

---

## 8. Motion

**Framer Motion เป็น JS animation library เดียว** (GSAP ถูกถอดออกทั้งหมดใน
v3.0 rollout) ร่วมกับ CSS keyframe utility ชุดเล็กสำหรับ entrance effect
แบบ non-interactive

```css
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1)   /* หลัก — Emil Kowalski curve */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1) /* ใช้น้อยมาก ไม่ใช่ default */
```

| ประเภท | ระยะเวลา | Easing |
|---|---|---|
| Micro (press/hover) | 100–150ms | `ease` / `--ease-out` |
| Component (dialog/sheet) | 200–250ms | `--ease-out` |
| Page transition | 250–300ms | `--ease-out` |
| Stagger (list mount) | delay 40ms/item | `--ease-out` |

กติกาเหล็ก: ห้ามเกิน 400ms ต่อ interaction, ห้ามใช้ `bounce`/`elastic` กับ
business UI, ห้ามใช้ `animate-spin`/`animate-bounce` เพื่อการตกแต่ง, ต้อง
เคารพ `prefers-reduced-motion: reduce` เสมอ (มี guard ระดับ global อยู่แล้ว
ใน `src/styles.css`)

Keyframe หลักที่มี: `fade-up`, `fade-in`, `fade-down`, `scale-in`, `shake`,
`slide-in-right`, `pulse-glow` + `.stagger` สำหรับ list children

---

## 9. Component Reference (สรุปจาก COMPONENT_LIBRARY.md)

| Component | Radius (ตามค่า vNext จริง) | Height/ขนาด | หมายเหตุ |
|---|---|---|---|
| **Button** (`ui/button.tsx`) | `rounded-button` 12px | `default` 44px, `sm` 36px, `lg` 48px, `icon` 44×44 | variant: default/secondary/outline/ghost/destructive/link — ห้ามใช้ raw `<button>` |
| **Input/Textarea/Select** | `rounded-input` 10px | 44px min | label อยู่เหนือ field เสมอ ห้ามใช้ placeholder แทน label |
| **Card** (`ui/card.tsx`) | `rounded-card` 16px | variant: default/stat/interactive | `interactive` = hover-lift + translate-y -0.5, border-only ไม่มีเงาหนัก |
| **Dialog** | `rounded-dialog` 20px | full-screen บนมือถือ (`<sm`), centered บน `sm+` | action ทำลายข้อมูล (void/reject/delete) ต้องผ่าน dialog นี้เสมอ |
| **Drawer/Sheet** | `rounded-sheet` 24px (directional) | overlay `bg-black/40 backdrop-blur-md` | Drawer = bottom sheet มือถือ, Sheet = side panel ทุก breakpoint |
| **Table** | — | — | ใช้กับ transaction log / audit trail; การ์ด grid ยังใช้ได้กับ entity ที่เน้นตัวเลขใหญ่ (Funds/Budget/Projects) |
| **Badge** | `rounded-full` (pill) | — | variant: default/secondary/destructive/outline/success/warning/info; `StatusBadge` เป็น typed wrapper |
| **Skeleton** | — | — | ใช้ composite template (`TableSkeleton`, `DashboardSkeleton` ฯลฯ) แทนการ hand-roll loop |
| **Chart** (`ui/chart.tsx`) | — | Recharts wrapper | ยกเว้น `DashboardGaugeChart.tsx` ที่เป็น hand-drawn SVG โดยเจตนา |

---

## 10. Responsive

**ลำดับความสำคัญ: Desktop/laptop ก่อน, iPad เท่าเทียมกันเป็นอันดับสอง,
มือถือใช้งานได้แต่เป็นรอง** — เพราะเป็นซอฟต์แวร์การเงินที่เน้นตารางหนาแน่น
และ workflow อนุมัติหลายขั้นตอน ไม่ใช่แอปเสพเนื้อหา

Breakpoint มาตรฐาน Tailwind ไม่ปรับแต่ง: `sm` 640 / `md` 768 / `lg` 1024
(**เทียบเท่า iPad — ได้รับการดูแลระดับ first-class**) / `xl` 1280 / `2xl`
1536 (ยังมี gap — ยังไม่ได้ tuning เฉพาะ `2xl` ทุกหน้า)

| Layout shell | มือถือ (`<md`) | Desktop/iPad (`lg+`) |
|---|---|---|
| Navigation | `BottomNav` (5 รายการ + Sheet "เพิ่มเติม") | `AppSidebar` (collapsible icon rail) + `AppTopbar` |

Touch target ขั้นต่ำ **44px เสมอ** ทั้งมือถือและ desktop (ไม่ลดขนาดแม้มี mouse)
ยกเว้น `Button size="sm"` (36px) ที่เจตนาไว้สำหรับปุ่ม action ในแถวตารางที่แน่น

---

## 11. Accessibility

WCAG AA contrast ขั้นต่ำ, keyboard navigation ครบ, `:focus-visible` ring
มองเห็นชัด (`outline: 2px solid var(--color-ring)`), screen-reader ผ่าน
Radix/shadcn primitives, touch target 44px (ยกเว้นตามที่ระบุด้านบน)

---

## 12. Async-state contract (vNext, บังคับทุกหน้าที่ fetch data)

ทุกหน้าที่โหลดข้อมูลต้อง render 3 สถานะแยกกันชัดเจน ห้าม fallthrough แบบ implicit:

1. **Loading** — skeleton ที่ตรงกับ layout จริง
2. **Error** — ข้อความ + ปุ่ม retry ห้าม silent fallback เป็นค่า 0/ข้อมูลปลอม
3. **Empty** — คำอธิบาย + action เดียวที่แก้ปัญหาได้

กติกานี้เกิดจาก audit ที่พบปัญหาร้ายแรงสุด: มี component ที่ silently สลับไป
แสดงข้อมูลธุรกรรมปลอม (fake demo data) เมื่อข้อมูลจริงว่างเปล่า

---

## 13. แหล่งอ้างอิงฉบับเต็ม

| เอกสาร | เนื้อหา |
|---|---|
| `src/styles.css` | **Source of truth ตัวจริง** — ทุกค่าที่ implement |
| `DESIGN_SYSTEM_V3.md` | หลักการ/ปรัชญาระดับสูง (ค่า radius บางส่วนล้าสมัย ดู §4) |
| `DESIGN_TOKENS.md` | ตาราง token (ค่า radius ล้าสมัย ดู §4) |
| `COMPONENT_LIBRARY.md` | สถานะ migration ของแต่ละ component แบบละเอียด |
| `MOTION_GUIDELINES.md` | duration/easing ฉบับเต็ม + reference implementation |
| `RESPONSIVE_GUIDELINES.md` | breakpoint strategy + testing checklist |
| `docs/design/GRACE_LEDGER_VNEXT_MASTERPLAN.md` | ทิศทาง vNext ปัจจุบัน (Gridgeist thesis, radius tightening, async-state contract) |
