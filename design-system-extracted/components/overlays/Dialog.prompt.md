Centered modal (28px radius, blurred overlay) for confirmations and short forms — CreateFund, TransferFund, etc. On real mobile viewports the product uses a full-screen sheet instead; this component shows the desktop/iPad treatment.

```jsx
<Dialog open={open} title="สร้างกองทุนใหม่" onClose={close} footer={<><Button variant="outline" onClick={close}>ยกเลิก</Button><Button onClick={save}>บันทึก</Button></>}>
  <Input label="ชื่อกองทุน" />
</Dialog>
```
