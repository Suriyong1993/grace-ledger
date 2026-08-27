# Auto-format code หลังเขียนไฟล์

หลังจากเขียน/แก้ไฟล์ `.ts`, `.tsx`, `.css`, `.json` เสร็จ → รัน format อัตโนมัติ

## ทำอะไร
- รัน `npx prettier --write <file>` สำหรับไฟล์ที่แก้
- รัน `npx eslint --fix <file>` ถ้ามี config

## เมื่อไหร่
- PostToolUse — หลัง Edit/Write tool success

## ตั้งค่า
เพิ่มใน `.claude/settings.json`:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "command": "npx prettier --write \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
      }
    ]
  }
}
```
