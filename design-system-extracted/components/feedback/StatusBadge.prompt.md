Transaction/approval status pill. Always pairs color with a glyph and label — never color alone (colorblind-safe, and matches the audit-trail transparency principle).

```jsx
<StatusBadge status="pending" />
<StatusBadge status="approved" />
<StatusBadge status="rejected" />
```

Status set is fixed: `draft`, `pending`, `approved`, `rejected`, `voided`. pending/approved/rejected reuse the finance semantic colors (amber/emerald/red) — do not invent new status colors.
