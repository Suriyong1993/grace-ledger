# วิธีสั่ง AI สำหรับ Grace Ledger

## กระดาษโกง — Copy-Paste ได้เลย

---

## Template 1 — เริ่มต้น Session ใหม่ทุกครั้ง

ก่อนสั่งงานอะไรก็ตาม paste ข้อความนี้ก่อนเสมอ:

---

คุณกำลังทำงานกับโปรเจกต์ Grace Ledger

อ่านไฟล์เหล่านี้ก่อน แล้วยืนยันว่าเข้าใจแล้ว:

1. promptmaster/MASTER_PROMPT.md
2. promptmaster/ENGINEERING_BIBLE.md

สรุปให้ฉันฟังสั้น ๆ ว่า Grace Ledger คืออะไร และกฎที่ห้ามละเมิดมีอะไรบ้าง

---

## Template 2 — สั่งงาน 1 อย่าง (ใช้ทุกครั้งที่อยากทำอะไร)

Copy แล้วเติมส่วนที่เป็นวงเล็บให้ครบ:

---

[CONTEXT]
โปรเจกต์: Grace Ledger — แพลตฟอร์มบริหารการเงินคริสตจักร
อ่าน: promptmaster/MASTER_PROMPT.md และ promptmaster/ENGINEERING_BIBLE.md

[งานที่ต้องทำ]
(เขียนงานที่ต้องการที่นี่ — 1 งาน ชัดเจน)

[ไฟล์ที่ต้องแก้]
(ระบุไฟล์ที่เกี่ยวข้อง เช่น src/routes/\_app.dashboard.tsx)

[ผลลัพธ์ที่ต้องการ]
(บอกว่าอยากเห็นอะไร เช่น "ปุ่มนี้ทำงานได้" หรือ "ตัวเลขแสดงถูก")

[ข้อห้าม]

- ห้ามแก้ไฟล์อื่นที่ไม่เกี่ยวข้อง
- ห้ามใช้ตัวเลขทศนิยม (float) กับเงิน
- ห้าม TODO หรือ Placeholder
- ห้ามลบข้อมูลจริง (ใช้ soft delete เท่านั้น)

[ตรวจสอบก่อน Done]
รัน npm run lint && npm run typecheck && npm test
บอกผลลัพธ์ให้ฉันด้วย

---

## Template 3 — แก้ Bug หรือ UI เร็ว ๆ

สำหรับงานเล็ก ๆ ที่รู้ชัดเจน:

---

แก้ปัญหานี้ใน Grace Ledger:

ปัญหา: (อธิบายปัญหาที่เจอ)
หน้าที่มีปัญหา: (ชื่อหน้า เช่น Dashboard, หน้ารายจ่าย)
สิ่งที่ควรเป็น: (อธิบายว่าอยากให้เป็นอย่างไร)

อ่าน promptmaster/MASTER_PROMPT.md ก่อนเริ่มแก้
รัน npm run lint && npm test ให้ผ่านก่อนบอกว่าเสร็จ

---

## ตัวอย่างที่ 1 — แก้ Dashboard (งานที่ต้องทำตอนนี้)

---

[CONTEXT]
โปรเจกต์: Grace Ledger
อ่าน: promptmaster/MASTER_PROMPT.md

[งานที่ต้องทำ]
Dashboard แสดง "รออนุมัติ" แค่รายการจ่าย (expense)
อยากให้รวม รายรับ (income) และ เงินถวาย (offering) ด้วย

[ไฟล์ที่ต้องแก้]
src/routes/\_app.dashboard.tsx
บรรทัดประมาณ 139 (ตรง pendingExpenses)

[ผลลัพธ์ที่ต้องการ]
ตัวเลข "รออนุมัติ" บน Dashboard รวมทุกประเภทรายการ
ทั้ง income, expense, และ offering

[ข้อห้าม]

- ห้ามแก้ไฟล์อื่น
- ห้าม float กับเงิน

[ตรวจสอบก่อน Done]
npm run lint && npm run typecheck && npm test

---

## ตัวอย่างที่ 2 — แก้ตัวเลขเงินผิดกฎ

---

แก้ปัญหานี้ใน Grace Ledger:

ปัญหา: ตัวเลขเงินบาง ๆ ใน Dashboard ใช้ .toLocaleString() โดยตรง
ซึ่งผิดกฎ ต้องใช้ thb() หรือ MoneyText component

หน้าที่มีปัญหา: src/routes/\_app.dashboard.tsx
บรรทัดที่ผิด: 291, 355, 634

สิ่งที่ควรเป็น: เปลี่ยน .toLocaleString("th-TH") เป็น thb() ทุกที่ในไฟล์นี้

อ่าน promptmaster/MASTER_PROMPT.md ก่อนเริ่มแก้
รัน npm run lint && npm test ให้ผ่านก่อนบอกว่าเสร็จ

---

## สิ่งที่ห้ามพิมพ์ (AI จะทำผิดทันที)

ห้ามพิมพ์ "ช่วยปรับปรุงระบบ" — กว้างเกิน AI ไม่รู้จะทำอะไร
ห้ามพิมพ์ "ช่วย redesign ทั้งหมด" — AI จะทำลาย layout ที่ดีอยู่แล้ว
ห้ามพิมพ์ "ทำให้สวยขึ้น" — ไม่มี criteria AI จะเดาเอง
ห้ามพิมพ์ "เพิ่ม feature ใหม่" — ไม่รู้ว่า feature อะไร
ห้ามพิมพ์ "แก้ให้ทำงานได้" — ไม่รู้ว่าอะไรพัง

---

## Roadmap — ดูว่าต้องทำอะไรต่อ

เปิดไฟล์นี้ทุกครั้งก่อนสั่ง AI:

    promptmaster/ROADMAP.md

ดู งานที่ยังไม่ทำ (สัญลักษณ์สี่เหลี่ยม) แล้ว copy template ที่มีอยู่ในนั้น

---

## ไฟล์ Bible ที่ AI ต้องอ่าน

ทำงานทั่วไป -> promptmaster/MASTER_PROMPT.md
แก้ UI/Design -> promptmaster/DESIGN_BIBLE.md
แก้โค้ด/Logic -> promptmaster/ENGINEERING_BIBLE.md
เรื่อง AI Feature -> promptmaster/AI_BIBLE.md
ดู Feature ที่ต้องมี -> promptmaster/PRODUCT_BIBLE.md
ดูลำดับงาน -> promptmaster/ROADMAP.md

---

เวอร์ชัน: 2.0 | July 2026
