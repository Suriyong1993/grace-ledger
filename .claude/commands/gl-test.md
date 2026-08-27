# /gl-test — ทดสอบ Grace Ledger

รัน test และตรวจสอบความถูกต้องของโค้ด:

1. **รัน unit tests:**
   ```bash
   npm test
   ```
   — ถ้า test ไม่ผ่าน แก้โค้ดก่อนไปต่อ

2. **รัน typecheck:**
   ```bash
   npm run build
   ```
   — ถ้า type error แก้ก่อนไปต่อ

3. **ตรวจ financial correctness:**
   - ทุกค่าเงินใช้ `decimal.js`
   - การคำนวณถูกต้อง (ไม่มี rounding error)
   - บัญชีสมดุล (debit = credit)

4. **ตรวจ UI:**
   - เปิด browser ที่ 390px + desktop
   - ตรวจ loading/error/empty states
   - ตรวจ touch targets ≥44px

5. **สรุปผล:**
   ```
   Tests: XX passed, XX failed
   Typecheck: clean / XX errors
   UI: desktop ✅ / 390px ✅ / accessibility ⚠️
   ```

**ห้าม:**
- ❌ ข้าม test ที่ผลเป็น RED
- ❌ แก้ test ให้ผ่านโดยการลบ assertion
- ❌ ทดสอบแค่ desktop แล้วลืม 390px
