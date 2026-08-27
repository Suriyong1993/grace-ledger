# /gl-plan — สร้างแผนงานสำหรับ Grace Ledger

สร้างแผนงานจาก spec โดยแบ่งเป็น tasks เล็กๆ:

1. **อ่าน spec** ที่สร้างจาก `/gl-spec`

2. **แบ่งงานเป็น tasks** แต่ละ task ต้อง:
   - ทำได้ภายใน 15 นาที
   - มี test ของตัวเอง
   - ไม่กระทบ financial logic ถ้าไม่จำเป็น

3. **จัดลำดับความสำคัญ:**
   - P0: Financial logic / RLS / ความถูกต้องของเงิน
   - P1: RPC / Database
   - P2: Components / UI
   - P3: Tests / Documentation

4. **เขียนแผนในรูปแบบ:**
   ```markdown
   ## แผนงาน: [ชื่อ Feature]
   
   ### P0 — Financial Safety
   - [ ] [task 1]
   - [ ] [task 2]
   
   ### P1 — Backend (Supabase)
   - [ ] [RPC ที่ต้องสร้าง/แก้]
   
   ### P2 — Frontend (UI)
   - [ ] [components ที่ต้องสร้าง]
   
   ### P3 — Verification
   - [ ] unit tests
   - [ ] browser test (desktop + 390px)
   ```

5. **ยืนยันกับผู้ใช้** — "แผนนี้ถูกไหม? เริ่มจาก P0 ไหม?"

**ห้าม:**
- ❌ เขียนโค้ดในขั้นตอนนี้
- ❌ ข้าม P0 (financial safety)
- ❌ สร้าง RPC ใหม่ถ้าแก้ RPC เดิมได้
