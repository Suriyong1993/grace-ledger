# /gl-build — เขียนโค้ดสำหรับ Grace Ledger

เขียนโค้ดตามแผนที่สร้างจาก `/gl-plan` โดยทำตามขั้นตอน:

1. **อ่านแผน** จาก `/gl-plan` — รู้ว่าต้องทำ task อะไรบ้าง
2. **อ่าน `CLAUDE.md`** ส่วน "Financial safety — hard stops" และ "Design"
3. **ทำ task ทีละ task** จาก P0 → P1 → P2 → P3:
   - P0: Financial logic / RLS / ความถูกต้องของเงิน
   - P1: Supabase RPC / Database
   - P2: Components / UI (ใช้ design tokens จาก `design-system-extracted/tokens/`)
   - P3: Tests / Documentation
4. **รัน test หลังแต่ละ task** — `npm test` ถ้า test ผ่านได้ ถ้าไม่ผ่านแก้ก่อนไปต่อ
5. **ตรวจ design tokens** — ใช้ token ที่มีอยู่ ห้ามสร้างใหม่ถ้าไม่จำเป็น

**กฎสำคัญ:**
- ✅ ใช้ `decimal.js` สำหรับทุกค่าเงิน
- ✅ ใช้ design tokens จาก `design-system-extracted/tokens/*.css`
- ✅ เขียน test ก่อนเสมอ (TDD)
- ✅ Component ใหม่ต้องทำงานได้ทั้ง desktop + 390px
- ✅ UI copy เป็นภาษาไทยตามกฎใน CLAUDE.md (ไม่ใช่ AI-sounding)

**ห้าม:**
- ❌ ใช้ `number` สำหรับเงิน
- ❌ สร้าง design token ใหม่ถ้ามีอยู่แล้ว
- ❌ ใช้ emoji, gradient, orb, scale-on-hover, fake data
- ❌ ข้าม P0 (financial safety)
- ❌ เขียน test ที่ไม่ได้ทำงานจริง
