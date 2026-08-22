# LIVE POSTGRESQL 17 VERIFICATION & CONCURRENCY GUIDE

## 1. Overview & Invariant Checklist

Grace Ledger financial core relies on PostgreSQL 17 transaction isolation and atomic locking. This guide outlines how to spin up a local PostgreSQL container, apply migrations 001 to 016, and verify live database concurrency guarantees.

### Invariants Tested on Live DB
- `SELECT ... FOR UPDATE` row locking on `action_confirmations` and `funds`.
- `idempotency_keys` uniqueness constraint under concurrent identical requests.
- Rollback semantics on overdraft (`current_balance < amount`).
- Atomic single-transaction status transition (`consumed`) coupled with financial mutation.

---

## 2. Docker Setup for PostgreSQL 17

```bash
# Launch a pristine PostgreSQL 17 instance
docker run --name grace-postgres-17 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=grace_ledger_test \
  -p 54322:5432 \
  -d postgres:17-alpine

# Wait for healthy state
docker exec -it grace-postgres-17 pg_isready -U postgres
```

---

## 3. Applying Migrations

```bash
# Apply migrations sequentially
for file in supabase/migrations/*.sql; do
  echo "Applying $file..."
  docker exec -i grace-postgres-17 psql -U postgres -d grace_ledger_test < "$file"
done
```

---

## 4. Live Concurrency Verification Script

```sql
-- Concurrency Test: Simulate two concurrent requests confirming the same action
-- Session 1:
BEGIN;
SELECT * FROM action_confirmations WHERE id = 'conf-001' FOR UPDATE;
-- (Simulate processing delay)
UPDATE action_confirmations SET status = 'consumed' WHERE id = 'conf-001';
COMMIT;

-- Session 2 (Concurrent):
-- Session 2 will block until Session 1 completes, and then fail closed when checking status = 'consumed'.
```

---

## 5. Teardown

```bash
docker stop grace-postgres-17 && docker rm grace-postgres-17
```
