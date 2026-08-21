The primary action control — orange-fill for CTAs, with secondary/outline/ghost/destructive variants and three sizes.

```jsx
<Button variant="default" onClick={save}>บันทึกรายรับ</Button>
<Button variant="outline" size="sm">ดูรายละเอียด</Button>
<Button variant="destructive">ปฏิเสธ</Button>
```

Never use a raw `<button>` in product screens — always this component. `size="sm"` (36px) is reserved for actions inside table rows; everywhere else stays at the 44px touch-target minimum.
