# ENGINEERING BIBLE — Grace Ledger

> อ่านก่อน: promptmaster/MASTER_PROMPT.md
> เอกสารนี้อธิบายกฎการเขียนโค้ด Architecture และ Process ที่ต้องปฏิบัติตามเสมอ

---

## 1. Tech Stack (สิ่งที่ใช้)

| Layer | Technology | ห้ามเปลี่ยน |
|-------|-----------|------------|
| Frontend | React 19 + TypeScript | ✅ |
| Router | TanStack Router | ✅ |
| SSR Framework | TanStack Start | ✅ |
| Styling | Tailwind CSS v4 | ✅ |
| UI Components | shadcn/ui | ✅ |
| ORM | Drizzle ORM | ✅ |
| Database | PostgreSQL 16 / Supabase | ✅ |
| Auth | JWT Sessions + Supabase Auth | ✅ |
| Test Engine | PGlite (WebAssembly Postgres) | ✅ |
| AI OCR | Fireworks AI (Kimi-K3) + Gemini | ✅ |

---

## 2. Project Structure

```
src/
├── components/           # React components
│   ├── church/           # Church-specific components
│   ├── layout/           # Layout (Sidebar, Header, etc.)
│   ├── receipts/         # Receipt/document components
│   ├── shared/           # Shared across features
│   └── ui/               # Base UI (shadcn/ui)
├── db/
│   └── schema.ts         # SINGLE SOURCE OF TRUTH for DB schema
├── hooks/                # Custom React hooks
├── lib/                  # Utilities
├── routes/               # TanStack Router pages (_app.*.tsx)
├── server/
│   ├── api/              # API routes
│   ├── auth/             # Session + permissions
│   ├── domain/           # Business Logic (journal, money, etc.)
│   ├── infrastructure/   # DB connection
│   └── services/         # Business services (Audit, Fund, Period)
└── services/             # Client-side services
```

---

## 3. Critical Domain Files (อย่าแตะโดยไม่เข้าใจ)

| ไฟล์ | ทำอะไร | ระดับความเสี่ยง |
|------|--------|----------------|
| `src/db/schema.ts` | Database schema ทั้งหมด | 🔴 Critical |
| `src/server/domain/money.ts` | Money class — no float | 🔴 Critical |
| `src/server/domain/journal.ts` | Double-entry engine | 🔴 Critical |
| `src/server/auth/permissions.ts` | RBAC + thresholds | 🔴 Critical |
| `src/server/services/audit.service.ts` | SHA-256 audit chain | 🔴 Critical |
| `src/server/api/routes/ai-proxy.routes.ts` | AI proxy (no key leaks) | 🟡 High |

---

## 4. Coding Standards

### 4.1 Money — กฎเหล็ก

```typescript
// ✅ CORRECT — ใช้ Money class เสมอ
import { Money } from "@/server/domain/money";
const amount = Money.fromTHB("1234.50");
const total = amount.add(Money.fromTHB("500.00"));

// ❌ WRONG — ห้ามเด็ดขาด
const amount = 1234.50;  // FLOAT = BUG
const amount = parseFloat("1234.50");  // BUG
```

### 4.2 Database — Tenant Isolation

```typescript
// ✅ CORRECT — church_id บังคับทุก query
const entries = await db.query.journalEntries.findMany({
  where: and(
    eq(journalEntries.churchId, ctx.churchId),  // บังคับ
    eq(journalEntries.status, "pending")
  )
});

// ❌ WRONG — ไม่มี church_id filter = security breach
const entries = await db.query.journalEntries.findMany({
  where: eq(journalEntries.status, "pending")
});
```

### 4.3 TypeScript — ห้าม any

```typescript
// ✅ CORRECT
function processTransaction(entry: JournalEntry): Result<void, AppError> {}

// ❌ WRONG
function processTransaction(entry: any): any {}
```

### 4.4 Error Handling

```typescript
// ✅ CORRECT — Return Result type, ไม่ throw
return { success: false, error: "INSUFFICIENT_FUNDS" };

// หรือใช้ neverthrow / Result pattern
return err(new AppError("INSUFFICIENT_FUNDS"));

// ❌ WRONG — ห้าม throw ใน business logic
throw new Error("Not enough funds");
```

### 4.5 Soft Delete — ห้าม Hard Delete

```typescript
// ✅ CORRECT — Soft delete เสมอ
await db.update(funds)
  .set({ deletedAt: new Date() })
  .where(eq(funds.id, fundId));

// ❌ WRONG — ห้ามเด็ดขาด
await db.delete(funds).where(eq(funds.id, fundId));
```

### 4.6 API Keys — ห้ามใน Client

```typescript
// ✅ CORRECT — ใช้ server proxy เท่านั้น
// ไฟล์: src/server/api/routes/ai-proxy.routes.ts
const response = await fireworksAI.parse(document, process.env.FIREWORKS_API_KEY);

// ❌ WRONG — ห้ามเด็ดขาด
const response = await fetch("https://api.fireworks.ai/...", {
  headers: { "Authorization": import.meta.env.VITE_FIREWORKS_KEY }  // EXPOSED!
});
```

---

## 5. Approval Thresholds (บังคับ Server-side)

```typescript
// src/server/auth/permissions.ts
if (amount < 5000) {
  // treasurer หรือ pastor อนุมัติได้
} else if (amount <= 50000) {
  // pastor เท่านั้น
} else {
  // ต้องมี DUAL APPROVAL: pastor + super_admin
  // คนละคนกัน (creatorId !== approverId1 !== approverId2)
}
```

ห้ามตรวจสอบ threshold ใน Client side เท่านั้น

---

## 6. Audit Trail (บังคับทุก Action)

ทุก Action ที่เปลี่ยนข้อมูลต้องบันทึก Audit Log:

```typescript
await auditService.log({
  churchId: ctx.churchId,
  userId: ctx.userId,
  action: "JOURNAL_ENTRY_APPROVED",
  entityType: "journal_entry",
  entityId: entry.id,
  before: previousState,  // snapshot ก่อนเปลี่ยน
  after: newState,         // snapshot หลังเปลี่ยน
});
```

---

## 7. State Machine — Transaction Lifecycle

```
DRAFT ──submit──→ PENDING ──approve──→ APPROVED ──void──→ VOIDED
  │                  │
  │                  └──reject──→ REJECTED ──resubmit──→ DRAFT
  └──delete──→ (soft deleted)
```

กฎ State Machine (ห้ามละเมิด):
- `approved` → `draft` = ILLEGAL (ต้อง void ก่อน)
- `approved` → `deleted` = ILLEGAL (ห้ามลบ approved)
- `voided` → any = ILLEGAL (terminal state)
- `draft` → `approved` = ILLEGAL (ต้องผ่าน pending ก่อน)

---

## 8. Verification Commands (ต้อง Pass ก่อน Done)

**ทุกครั้งก่อนบอกว่างานเสร็จ ต้อง run และ pass ทั้ง 4 ข้อ:**

```bash
npm run lint       # ESLint — 0 errors, 0 warnings
npm run typecheck  # TypeScript — 0 errors
npm test           # 51/51 tests pass
npm run build      # Production build success
```

ห้ามบอกว่า "น่าจะ pass" — ต้อง run จริงและ paste output มาด้วย

---

## 9. Git Workflow

### 9.1 Branch Naming

```
feature/grace-ledger-<ticket>-<short-description>
fix/grace-ledger-<ticket>-<short-description>
refactor/grace-ledger-<ticket>-<short-description>
docs/grace-ledger-<ticket>-<short-description>
```

### 9.2 Commit Message

ใช้ Conventional Commits:

```
feat: add dual approval UI for transactions >50K THB
fix: prevent float arithmetic in fund balance calculation
refactor: extract Money display component
docs: update ENGINEERING_BIBLE with audit rules
test: add edge cases for period closing validation
```

### 9.3 กฎ Git (Critical)

- **ห้าม Force Push** ไปที่ branch ที่ push แล้ว (ทำลาย Lovable history)
- **ห้าม Rebase/Amend** commit ที่ push แล้ว
- ทุก commit ต้อง pass verification commands ก่อน push
- Branch อยู่ใน working state เสมอ

---

## 10. Environment Variables

### 10.1 Server-only (ห้ามใช้ VITE_ prefix)

```env
FIREWORKS_API_KEY=...      # AI OCR — server only
JWT_SECRET=...             # Session signing — server only
DATABASE_URL=...           # DB connection — server only
```

### 10.2 Client-safe (ใช้ VITE_ prefix ได้)

```env
VITE_SUPABASE_URL=...      # Public Supabase URL
VITE_SUPABASE_ANON_KEY=... # Public anon key
```

### 10.3 กฎ

- ห้ามใช้ `process.env.SECRET` ใน client code
- ห้ามใช้ `import.meta.env.VITE_` กับ secret keys
- ทุก secret route ผ่าน server proxy เท่านั้น

---

## 11. Testing Standards

### 11.1 Test Infrastructure

- ใช้ PGlite WebAssembly — ไม่ต้อง Docker
- Test ทุกอย่างใน memory — reset ทุก test
- 51 test cases ครอบคลุม core business logic

### 11.2 สิ่งที่ต้องมี Test

1. Money calculations (no float drift)
2. Double-entry validation (debit = credit)
3. Approval threshold rules
4. Period locking (ห้าม post ใน closed period)
5. Audit trail hash chain verification
6. Tenant isolation (church_id filter)

### 11.3 เมื่อเพิ่ม Feature ใหม่

- ต้องเขียน test ก่อน (TDD) หรือพร้อมกัน
- ห้าม feature ที่ไม่มี test
- Test count ต้องเพิ่มขึ้นเสมอ (ห้ามลดลง)

---

## 12. Documentation Rules

- ทุก Domain function ต้องมี JSDoc comment
- ทุก API route ต้องมี description ว่าทำอะไร
- ถ้าแก้ Business Logic ต้องอัปเดต BUSINESS_RULES.md ด้วย
- ห้าม // TODO ในโค้ด production

---

## 13. Performance Budget

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3s |
| Bundle size (initial) | < 300KB gzip |
| API response time | < 500ms (p95) |
| DB query time | < 100ms |

---

## 14. Security Rules

1. ทุก API endpoint ต้องตรวจสอบ JWT session ก่อน
2. ทุก query ต้องมี church_id filter
3. ห้าม API key ใน client bundle
4. Password ต้อง bcrypt/argon2 hash
5. ห้าม log sensitive data (password, API key, PII)
6. Rate limiting บน AI proxy endpoints

---

_Version: 2.0 | July 2026_
