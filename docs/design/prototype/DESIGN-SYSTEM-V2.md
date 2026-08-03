# Grace Ledger — Design System v2 (Single Source of Truth)

> ทุกหน้าจอใหม่และทุกการแก้ไข UI ต้องอ้างอิงไฟล์นี้ + หน้า `Design System.dc.html`
> ห้ามใช้ค่าสี/ขนาด/ระยะห่างนอกเหนือจากที่นิยามไว้ โดยไม่มีเหตุผลบันทึกเป็น ADR

## 1. Design Tokens

### Colors — Base
| Token | ค่า | ใช้เมื่อ |
| --- | --- | --- |
| background | #F8F9FC | พื้นหลังหน้า |
| foreground | #1C1E2E | ตัวอักษรหลัก / พื้น KPI เข้ม |
| card | #FFFFFF | พื้นการ์ดทุกใบ |
| muted | #F1F3FA | พื้นรอง, segmented control, hover |
| muted-2 | #FAFBFE | พื้น input, แถบหัวตาราง, hover แถว |
| muted-foreground | #6B7280 | ตัวอักษรรอง |
| faint-foreground | #9AA0B4 | meta, header ตาราง, kicker nav |
| nav-foreground | #4B5162 | ข้อความเมนูปกติ |
| border | #E2E5F1 | เส้นขอบการ์ด/ input |
| border-soft | #F1F3FA | เส้นคั่นภายในการ์ด/แถวตาราง |
| border-softer | #EDEFF7 | ขอบการ์ดย่อยในการ์ด |

### Colors — Semantic
| Token | ค่า | คู่พื้น (muted) |
| --- | --- | --- |
| primary | #4F46E5 (hover #4338CA) | #EEF2FF / ขอบ #C7D2FE |
| income / approved | #047857 (hover #065F46) | #D1FAE5 |
| expense / rejected | #BE123C | #FFE4E6 (ขอบ #FECDD3) |
| offering / pending | #B45309 | #FEF3C7 (แถบเตือน #FFFBEB ขอบ #FDE68A) |

กฎ: ห้าม hard-code สีเขียว/แดง/เหลืองอื่น — รายรับ=income, รายจ่าย=expense, เงินถวาย/รอดำเนินการ=offering/pending เสมอ

### Spacing (px)
4, 8, 12, 16, 20, 24, 32, 48 — padding การ์ดมาตรฐาน 20px, gap ระหว่างการ์ด 16px, ช่องว่างระหว่าง section 20–24px

### Radius
| Token | ค่า | ใช้เมื่อ |
| --- | --- | --- |
| sm | 6px | chip เล็ก, hash tag |
| md | 8px | ปุ่ม, input, เมนู nav item, icon button |
| lg | 10px | icon tile, การ์ดย่อยในการ์ด |
| xl | 12px | การ์ดทุกใบ |
| 2xl | 16px | dialog |
| full | 999px | badge สถานะ, avatar, จุดสี |

### Shadow
- การ์ด: ไม่มีเงา ใช้ border #E2E5F1 (ยกเว้น hover รายงาน: `0 4px 16px rgba(28,30,46,.06)`)
- ปุ่ม primary: `0 1px 2px rgba(79,70,229,.35)`
- เมนูลอย: `0 12px 32px rgba(28,30,46,.12)` · dialog: `0 24px 64px rgba(28,30,46,.24)` · drawer: `-12px 0 40px rgba(28,30,46,.18)`

### Motion
- fade-up เข้าเพจ/การ์ด: 0.3s ease-out (translateY 8px)
- เมนู/dialog: 0.15–0.2s · press: `transform:scale(.98)`
- ห้าม bounce/elastic, ห้ามเกิน 400ms, ต้องรองรับ `prefers-reduced-motion`

## 2. Typography
- ฟอนต์: **Sarabun** (ไทย/UI) + **Inter** (ตัวเลขทุกตัว) — ห้ามฟอนต์อื่น
- ตัวเลขเงินทุกตัว: `font-family:Inter` + `font-variant-numeric:tabular-nums` เสมอ

| ขั้น | ขนาด/น้ำหนัก | ใช้เมื่อ |
| --- | --- | --- |
| kicker | 11px/600, letter-spacing .08em, uppercase | ป้ายหมวด, header ตาราง |
| meta | 11–12px/400-500, #9AA0B4 หรือ #6B7280 | timestamp, ผู้บันทึก |
| body | 13px/400-500 | ข้อความทั่วไป, cell ตาราง |
| emphasis | 14px/500-600 | ชื่อรายการ, เมนู |
| card title | 15px/600 | หัวการ์ด |
| page title | 24px/700, letter-spacing -.02em | ชื่อหน้า (H1 เดียวต่อหน้า) |
| KPI | 23–26px/700, Inter tabular | ตัวเลขการ์ดสถิติ |
| hero number | 34px/700 | ตัวเลขเด่นสุดของหน้า |

ห้ามตัวอักษรเล็กกว่า 11px

## 3. Color System — การใช้งาน
- จำนวนเงิน: รายรับ `+฿x,xxx` สี income, รายจ่าย `−฿x,xxx` สี expense (เครื่องหมาย − จริง ไม่ใช่ hyphen)
- สถานะต้องมี **สี + จุด/ไอคอน + ข้อความ** เสมอ ห้ามใช้สีอย่างเดียว
- Dark mode: ยังไม่เปิดใช้ (roadmap) — ออกแบบ light ก่อนเสมอ

## 4. Component Library (ดูตัวอย่างจริงใน Design System.dc.html)
- **Button primary**: พื้น primary, ขาว, radius 8, padding 9×14, 13px/600 + เงา primary
- **Button secondary**: พื้นขาว ขอบ border, hover ขอบ #C7CBE0 พื้น #FAFBFE
- **Button danger**: ขาว ตัวแดง ขอบ #FECDD3, hover พื้น #FFF1F2 (ปุ่มทึบแดงเฉพาะยืนยันใน dialog)
- **Input/Select/Textarea**: ขอบ border, radius 8, พื้น #FAFBFE, focus outline 2px primary
- **Status badge**: pill radius full, 11px/600, จุดสี 5px — pending/approved/rejected เท่านั้น
- **Segmented tabs**: ราง #F1F3FA radius 8, แท็บเลือก = พื้นขาว + เงา `0 1px 3px rgba(28,30,46,.1)`
- **Card**: ขาว, ขอบ border, radius 12, padding 20
- **Icon tile**: 34–38px, radius 10, พื้น muted ของสี semantic
- **Dialog**: 400px, radius 16, มีบรรทัด "บันทึกลง Audit Trail" ทุกการยืนยัน
- **Drawer/Sheet**: กว้าง 400–420px จากขวา, overlay `rgba(28,30,46,.32)`
- **Toast**: พื้น #1C1E2E ลอยกลางล่าง, ไอคอนถูกสีเขียว, หายเอง ~2.6s
- ไอคอน: **Lucide เท่านั้น**, stroke 1.5 (2 เมื่อ active/ยืนยัน), ขนาด 13–17px ใน UI

## 5. Navigation Principles
- Sidebar 240px คงที่ + Topbar 56px · เนื้อหากว้างสุด 1200px, padding 28×32
- เมนูจัดกลุ่ม: ภาพรวม / การเงิน / การควบคุม / จัดการ / ระบบ — ไม่เกิน 6 กลุ่ม
- หน้าไหนมีของค้าง แสดง badge จำนวนบนเมนู (เช่น รออนุมัติ)
- ทุกหน้าเข้าถึงได้ ≤ 2 คลิก · การกระทำหลักของหน้าอยู่มุมขวาบนเสมอ (ปุ่ม primary เดียวต่อหน้า)
- Role ปัจจุบันเห็นได้ตลอดที่ topbar · role อ่านอย่างเดียวมีแถบเหลืองแจ้งใต้ topbar

## 6. Responsive Rules (Desktop-first → iPad → มือถือ)
- แถว KPI: `repeat(auto-fit,minmax(210px,1fr))` — ห้าม fix จำนวนคอลัมน์
- Layout 2 คอลัมน์: flex-wrap (ซ้าย `flex:2 1 420px`, ขวา `flex:1 1 280px`)
- ตารางทุกตัว: ห่อด้วย `overflow-x:auto` + `min-width:820px` — ห้ามปล่อยให้คอลัมน์ทับกัน
- ตัวเลข/ข้อความยาว: `white-space:nowrap` + ellipsis ใน cell
- Touch target ≥ 44px บนอุปกรณ์สัมผัส

## 7. Accessibility
- Contrast ≥ 4.5:1 (คู่สีทั้งหมดข้างต้นผ่านแล้ว — ห้ามจางกว่า #9AA0B4 บนพื้นขาว)
- Focus ring: outline 2px primary ทุก input/ปุ่ม
- สถานะไม่พึ่งสีอย่างเดียว (จุด + ข้อความ)
- รองรับ `prefers-reduced-motion` · ฟิลด์บังคับมี `*` แดง + ข้อความ error ชัดเจน

## 8. Empty States
การ์ดขาว กลางหน้า: icon tile 48px สี semantic + หัวข้อ 15px/600 + คำอธิบาย 1 บรรทัด + (ถ้ามี) ปุ่มการกระทำถัดไป — ห้ามปล่อยพื้นที่ว่างเปล่า

## 9. Error States
- ฟอร์ม: กล่อง `#FFF1F2` ขอบ `#FECDD3` ตัวแดง อธิบายวิธีแก้ (ไม่ใช่แค่ "ผิดพลาด")
- เครือข่าย/ระบบ: การ์ด empty-state โทน expense + ปุ่ม "ลองใหม่"
- ไม่มีสิทธิ์: ไอคอนกุญแจ + "บทบาทของคุณไม่มีสิทธิ์…" — ไม่ซ่อนเฉย ๆ ถ้าผู้ใช้ควรรู้ว่าฟีเจอร์มีอยู่

## 10. Loading States
- ใช้ skeleton (แท่งสี #F1F3FA มี shimmer) รูปทรงตรงกับเนื้อหาจริง — ห้าม spinner หมุนกลางจอ
- ปุ่มกำลังทำงาน: disabled + ข้อความ "กำลังบันทึก…"

## 11. Table Standards
- Header: 11px/600 uppercase #9AA0B4 พื้น #FAFBFE
- แถว: padding 12×18, เส้นคั่น #F1F3FA, hover #FAFBFE, คลิกเปิด drawer รายละเอียด
- เงิน: ชิดขวา, Inter tabular · วันที่: 13px #6B7280
- ตัวกรองเป็น segmented tabs + ปุ่มส่งออกขวาบนของการ์ดตาราง
- ตารางยาว: sticky header + แบ่งหน้า (มาตรฐานสำหรับหน้าที่จะพัฒนา)

## 12. Form Standards
- ฟอร์มอยู่ใน drawer 420px จากขวา — ไม่เปลี่ยนหน้า
- จำนวนเงิน = ฟิลด์แรก ใหญ่สุด (20px/600 Inter) · ฟิลด์บังคับ: จำนวนเงิน + คำอธิบาย
- แนบหลักฐานมีเสมอ (กรอบเส้นประ + ระบุว่า AI อ่านใบเสร็จได้)
- Submit = "บันทึกและส่งขออนุมัติ" — ทุกรายการเข้าสถานะ pending เสมอ ไม่มีทางลัด
- Validate ตอน submit แสดง error รวมใต้ฟอร์ม + คงค่าที่กรอกไว้

## 13. Dashboard Standards
- ลำดับข้อมูล: (1) เงินสดคงเหลือรวม — การ์ดเข้ม #1C1E2E เด่นสุด (2) รายรับ/รายจ่ายเดือนนี้ + เทียบเดือนก่อน (3) เงินถวายล่าสุด (4) กองทุน (5) รายการล่าสุด (6) รออนุมัติ + งบประมาณ + AI insight ในคอลัมน์ขวา
- KPI ทุกใบ: kicker + ตัวเลข Inter + บรรทัดบริบท 1 บรรทัด (delta หรือคำอธิบาย)
- Quick actions (บันทึกรายรับ/รายจ่าย) ที่หัวหน้า เห็นเฉพาะ role ที่มีสิทธิ์

## 14. AI Workspace Standards (Grace AI)
- การ์ด AI: พื้น gradient #EEF2FF→#FAFBFF ขอบ #C7D2FE — โทน primary แยกจากข้อมูลการเงินจริงชัดเจน
- ทุก insight ต้องมี: ข้อความอธิบายเหตุผล + chip "หลักฐาน: n รายการ" + chip "ความมั่นใจ x%" + บรรทัด guardrail "AI ให้ข้อสังเกตเท่านั้น — ไม่แก้ไขหรืออนุมัติข้อมูลการเงิน"
- AI ห้ามมีปุ่มที่แก้ไขข้อมูลการเงินโดยตรง — ได้แค่ลิงก์พาไปดูหลักฐาน/หน้าเกี่ยวข้อง
- น้ำเสียง: สุภาพ สงบ ให้คำแนะนำแบบที่ปรึกษา ไม่ฟันธง

---
_v2.0 · 2026-08-02 · คู่กับหน้า Design System.dc.html (ตัวอย่างจริงทุก component)_
