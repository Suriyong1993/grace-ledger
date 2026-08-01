# Shared Project Brain — API Specification

## Service Layer Interface Contract (`src/services/church.ts`)

| Function                  | Parameters              | Return Type           | Description                      |
| ------------------------- | ----------------------- | --------------------- | -------------------------------- |
| `listExpense()`           | `none`                  | `Promise<Expense[]>`  | Fetches all expense transactions |
| `createExpense(data)`     | `ExpenseInput`          | `Promise<Expense>`    | Creates a new expense entry      |
| `setExpenseStatus(id, s)` | `id: string, s: Status` | `Promise<void>`       | Updates approval status          |
| `listIncome()`            | `none`                  | `Promise<Income[]>`   | Fetches all income entries       |
| `listOffering()`          | `none`                  | `Promise<Offering[]>` | Fetches Sunday offering records  |
| `listFunds()`             | `none`                  | `Promise<Fund[]>`     | Fetches fund ledgers             |
| `listAudit()`             | `none`                  | `Promise<AuditLog[]>` | Fetches audit trail feed         |
