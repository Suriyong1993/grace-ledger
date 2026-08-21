Native-backed dropdown styled to match Input (same height, radius, border). Used for fund/category/fiscal-period pickers.

```jsx
<Select label="กองทุน" value={fundId} onChange={setFundId}
  options={[{ value: "general", label: "กองทุนทั่วไป" }, { value: "mission", label: "กองทุนพันธกิจ" }]} />
```
