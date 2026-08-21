Dashed-border placeholder for a data view with nothing in it yet. Every fetch-driven screen needs loading/error/empty states — this is the empty one. Never silently fall back to fake demo data.

```jsx
<EmptyState title="ยังไม่มีรายรับ" description="เริ่มบันทึกรายรับเพื่อดูข้อมูลที่นี่"
  action={<Button onClick={openForm}>บันทึกรายรับ</Button>} />
```
