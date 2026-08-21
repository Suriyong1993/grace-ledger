The base surface — white, 24px radius, border (not shadow) for depth. `interactive` adds hover lift for clickable cards (fund cards, project cards).

```jsx
<Card title="กองทุนทั่วไป" description="เปิดเมื่อ ม.ค. 2568">฿128,450.00</Card>
<Card variant="interactive" onClick={openFund}>...</Card>
```

Funds/Budget/Projects use card grids instead of tables — tables are reserved for transaction logs and audit trails.
