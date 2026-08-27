# Save context ก่อน compact

ก่อนที่ context จะถูก compact → ให้ Claude เขียนสรุปงานที่ทำอยู่ลงในไฟล์

## ทำอะไร
- เขียนสรุปสั้นๆ ว่ากำลังทำอะไร ถึงไหนแล้ว ต้องทำอะไรต่อ
- บันทึกลง `.claude/CONTEXT_BACKUP.md`

## เมื่อไหร่
- PreCompact — ก่อน context window เต็ม

## ตั้งค่า
เพิ่มใน `.claude/settings.json`:
```json
{
  "hooks": {
    "PreCompact": [
      {
        "command": "echo '⚠️ Context compacting soon. Summarize current work to .claude/CONTEXT_BACKUP.md'"
      }
    ]
  }
}
```
