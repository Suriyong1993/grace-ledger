# /gl-ship — ส่งมอบโค้ด

ส่งมอบโค้ดหลังจากผ่านทุก Quality Gates:

1. **ตรวจว่าผ่านทุก gate:**
   - Functional ✅
   - Financial ✅
   - Security ✅
   - UX ✅
   - Writing ✅

2. **สร้าง commit:**
   ```bash
   git add .
   git commit -m "[type]: [สั้นๆ กระชับ]

   - [รายละเอียด 1]
   - [รายละเอียด 2]"
   ```
   ใช้ conventional commits: `feat:`, `fix:`, `chore:`, `test:`

3. **Push ไป branch ที่กำหนด:**
   ```bash
   git push origin [branch-name]
   ```

4. **สร้าง PR (ถ้าต้องการ):**
   - ใช้ `gh pr create`
   - ใส่ description สั้นๆ — ทำอะไร ทำไม
   - แนบ screenshot ถ้ามี UI change

5. **สรุป:**
   - Branch: [name]
   - Commit: [message]
   - PR: [URL ถ้ามี]
   - Tests: [passed/total]
   - Breaking changes: มี/ไม่มี

**ห้าม:**
- ❌ Ship ถ้ามี gate ที่ FAIL
- ❌ Commit รวมหมดทุกไฟล์ — commit แยกตาม feature/fix
- ❌ Push โดยไม่รัน `npm test` + `npm run build`
