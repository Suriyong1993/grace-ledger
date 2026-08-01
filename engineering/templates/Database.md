# Database Schema Request Template

## Table Name: `table_name`

### Schema Definition (Drizzle ORM)

```typescript
export const tableName = sqliteTable("table_name", {
  id: text("id").primaryKey(),
  churchId: text("church_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

### Indexes & Foreign Keys

- Index 1: `idx_church_id` on `church_id`

### Migration Risk Assessment

- Zero-downtime safety check: [Pass / Fail]
