Text field with a label always above it (never placeholder-as-label) and an inline error state.

```jsx
<Input label="ชื่อผู้ถวาย" placeholder="กรอกชื่อ" value={name} onChange={setName} />
<Input label="จำนวนเงิน" type="number" error="กรุณากรอกจำนวนเงิน" />
```
