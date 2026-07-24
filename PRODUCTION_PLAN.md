# Grace Ledger v2 — Production Plan
## Supabase Backend + Vercel Frontend

---

## 📡 Architecture Overview

```
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│   Vercel Frontend │◄────►│  Supabase Edge Funcs  │◄────►│  Supabase DB    │
│  (Static + SSR)  │ HTTPS │  (auth-login,         │  Pg   │  (PostgreSQL)   │
│  TanStack Start   │       │   register, getChurch)│       │  + RLS policies │
└─────────────────┘       └──────────────────────┘       └─────────────────┘
                                │
                        ┌───────┴───────┐
                        │ Supabase Auth  │
                        │ (email/password)│
                        │ + RLS + Row    │
                        │ Level Security │
                        └───────────────┘
```

- **Frontend**: Vercel (static site + SSR for TanStack Start)
- **Backend**: Supabase (managed PostgreSQL + Auth + Edge Functions + Storage)
- **Auth**: Supabase Auth (email/password → httpOnly cookies)
- **Data**: PostgreSQL with RLS policies (tenant isolation by church_id)
- **Files**: Supabase Storage (receipt attachments)

---

## Phase 1: Backend — Supabase Schema + Auth (Week 1)

### 1.1 Schema Migration (`supabase/migrations/001_init_schema.sql`)
**Already done** ✅
- All tables created with RLS enabled
- All enum types defined
- CHECK constraints for business rules (self-approval prevention, dual approval)
- Indexes for all query patterns
- `version` column for optimistic locking
- `audit_log` table (server-side, immutable)
- Row Level Security policies per table

**Why this matters for frontend:**
- Frontend queries **don't need church_id** in WHERE clause (RLS auto-filters)
- Frontend doesn't need to check permissions server-side — DB rejects unauthorized requests
- This simplifies frontend code significantly

### 1.2 Edge Functions
**Already done** ✅
- `auth-login` — email/password sign in → returns session
- `auth-register` — creates user + church record
- `get-church` — fetches user's church profile
- `_shared/cors.ts` — shared CORS headers

**Still needed:**
- `auth-logout` — server-side session invalidation (if MFA is used later)
- `upload-attachment` — presigned URL for Supabase Storage (receipt images)

---

## Phase 2: Backend — Service Layer (Week 1)

### 2.1 `src/services/supabaseClient.ts` ✅ Done
- Creates Supabase JS client with auto-refresh session
- Uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`

### 2.2 `src/services/supabaseService.ts` ✅ Done
- Full CRUD for all entities
- `getChurchId()` helper fetches church from auth session
- Self-approval prevention in `approveIncome()` and `setExpenseStatus()`
- Audit logging for every mutation
- **Removed**: `delay()` mock latency (keep or remove — debatable)

### 2.3 `src/services/church.ts` ✅ Done
- Rewritten from mock-db.ts to supabaseService.ts
- All CRUD operations query Supabase directly
- `logAudit()` helper for audit trail

### 2.4 `src/services/api.ts` ✅ Done
- Removed axios dependency for Supabase operations
- Keep as compatibility layer (empty string for API_URL)

**What this eliminates from frontend:**
- No more `loadDb()` — data comes from Supabase
- No more `demoUsers` hardcoded in auth page
- No more localStorage for data persistence
- No more "data is per-browser" problem

---

## Phase 3: Frontend — Auth Component Overhaul (Week 2)

### 3.1 `src/routes/auth.tsx` — MUST REWRITE

**Current state:** Uses `PinPad` component + `loadDb().users` (mock data)
**Target state:** Email/password form + real Supabase Auth

**Files to modify:**
```
src/routes/auth.tsx
  ├─ Remove: PinPad import
  ├─ Remove: loadDb import
  ├─ Remove: demoUsers section
  ├─ Add: Email input field
  ├─ Add: Password input field
  ├─ Add: "Forgot password?" link
  ├─ Add: "Sign up" redirect link
  └─ Change handleSubmit to call signIn(email, password)
```

**New UI flow:**
```
┌──────────────────────────────────┐
│  🏛️ Grace Ledger                 │
│  ─────────────────────────────── │
│  Email:    [________________]    │
│  Password: [________________]    │
│  [ Sign In ]                      │
│                                  │
│  Forgot password?                 │
│  Don't have an account? Sign up   │
└──────────────────────────────────┘
```

**Why:** PIN 6 digit was insecure for production. Email/password is standard. Supabase handles password hashing, reset flow, lockout.

---

### 3.2 `PinPad.tsx` — KEEP but don't use for auth

**Decision:** Keep `PinPad` component for future use (e.g., transaction PIN for sensitive actions). It's a good reusable component. Just stop using it for login.

**Alternative:** Remove if truly not needed — saves ~120 LOC. **Recommendation: Keep** (can be useful for authorizing large transfers or voiding transactions).

---

### 3.3 `src/lib/auth.tsx` ✅ Already rewrote
- Uses `supabase.auth.onAuthStateChange()` instead of localStorage
- `PERMISSION_MATRIX` for role-based access control
- `can(permission)` check for UI elements
- `hasRole(...roles)` check for role-specific features

**What this means for frontend:**
- All protected routes already use `<AuthProvider>` and `useAuth()`
- `_app.tsx` already redirects unauthenticated users to `/auth`
- `RoleGuard.tsx` already uses `can()` and `hasRole()`
- No changes needed to layout/auth infrastructure

---

### 3.4 New Component (optional but recommended): `LoginForm.tsx`

**File:** `src/components/auth/LoginForm.tsx`

```tsx
// Extract login form from auth.tsx route into reusable component
// This allows:
// 1. Reuse in settings (change password flow)
// 2. Embeddable in different layouts
// 3. Testable in isolation
```

---

## Phase 4: Frontend — File Attachments for Supabase Storage (Week 2)

### 4.1 Current attachment flow (broken for production)

`AttachmentInput.tsx` stores files as `dataUrl` (base64 string) which works in localStorage but **NOT** for Supabase.

**Problem:** `dataUrl` for a receipt image can be 500KB+ — storing in PostgreSQL `TEXT` column is wasteful and slow.

**Solution:** Use Supabase Storage bucket.

### 4.2 Supabase Storage Setup

```sql
-- Run in Supabase SQL Editor
SELECT sqlfrom('SELECT storage.create_bucket('attachments', 
  {public:false, file_size_limit: 10485760, allowed_mime_types: 
    ['image/jpeg','image/png','image/pdf','application/pdf']});
-- Enable RLS on storage.objects for the attachments bucket
```

### 4.3 Edge Function for Upload Presigned URL

**Function:** `supabase/functions/upload-url/index.ts`
- Returns presigned URL for upload
- Validates file type + size before generating URL
- Logs audit

### 4.4 `AttachmentInput.tsx` changes

**Current:** Stores `dataUrl` in DB (base64 string)
```tsx
// src/components/shared/AttachmentInput.tsx
// Current pattern:
const [attachment, setAttachment] = useState<AttachmentValue>();
// setAttachment({ name, dataUrl: base64DataUrl, type, size })
// → stored in income.attachment_data_url as TEXT
```

**New:** Upload to Supabase Storage → store URL in DB
```tsx
// New pattern:
async function uploadAttachment(file: File): Promise<string> {
  // 1. Get presigned URL from Supabase Edge Function
  // 2. Upload file directly to Storage using signed URL
  // 3. Return public URL
  // 4. Store public URL in attachment_data_url column
}
```

**Frontend files to modify:**
- `src/components/shared/AttachmentInput.tsx` — add upload progress + Storage integration
- `src/services/supabaseService.ts` — add `uploadAttachment()` helper

---

## Phase 5: Frontend — Realtime Subscriptions (Week 2-3)

### 5.1 Why Realtime matters

Current: Dashboard only updates when user refreshes or re-navigates.

With Realtime: When pastor approves an income record, treasurer sees it instantly.

### 5.2 Implementation

**New file:** `src/hooks/useRealtime.ts`
```typescript
import { useEffect, useRef } from 'react';
import { supabase } from '@/services/supabaseClient';

export function useRealtime<T>(
  channel: string,
  table: string,
  churchId: string,
  callback: (payload: T) => void
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const ch = supabase
      .channel(channel)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        filter: `church_id=eq.${churchId}`,
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // subscribed
        }
      });

    return () => { supabase.removeChannel(ch); };
  }, [channel, table, churchId]);
}
```

**Pages to add realtime:**
| Page | Realtime Event | Why |
|------|---------------|-----|
| Dashboard (income) | INSERT on incomes | Show new offerings instantly |
| Dashboard (expense) | INSERT on expenses | Show new expenses instantly |
| Income list | INSERT + UPDATE + DELETE | Live status changes (pending → approved) |
| Offering count sheet | INSERT + UPDATE | Counter updates in real-time |
| Audit log | INSERT | New audit entries appear at top |

### 5.3 Realtime Provider (optional)

```tsx
// src/components/shared/RealtimeProvider.tsx
// Wraps the app with realtime connection management
// Reconnects when network drops
// Batches events to avoid excessive re-renders
```

---

## Phase 6: Frontend — Error Handling & Permissions (Week 3)

### 6.1 RLS Errors → User-Friendly Messages

When Supabase RLS rejects a request, frontend must handle gracefully:

```typescript
// src/lib/error-handler.ts
export function handleSupabaseError(error: any): string {
  if (error.code === '42501') { // insufficient_privilege
    return 'คุณไม่มีสิทธิ์ดำเนินการนี้';
  }
  if (error.code === '401') {
    return 'Session expired. กรุณาเข้าสู่ระบบอีกครั้ง';
  }
  // ...map other error codes
}
```

### 6.2 Route Guards

Currently `_app.tsx` checks `user` from `useAuth()`. With Supabase:
- If session expired → Supabase auto-refreshes (silent)
- If refresh fails → `onAuthStateChange` fires with `SIGNED_OUT` event → redirect to `/auth`

**Add:** Global error boundary for 403/401 responses

### 6.3 Loading States

With real backend (not localStorage), every query is an HTTP request. Loading spinners are **required**:

```tsx
// Every page needs loading state while Supabase returns data
function IncomePage() {
  const [loading, setLoading] = useState(true);
  const incomes = useQuery(['incomes'], fetchIncomes);
  
  if (loading) return <IncomeLoadingSkeleton />;
  // ...render
}
```

---

## Phase 7: Deployment Pipeline (Week 3-4)

### 7.1 Vercel Deployment

**Prerequisites:**
1. `vercel.json` or `vercel` in project root
2. Environment variables set in Vercel dashboard OR vercel.json

**Config:**
```json
// vercel.json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm ci",
  "framework": "vite",
  "env": {
    "VITE_SUPABASE_URL": "@supabase_url",
    "VITE_SUPABASE_ANON_KEY": "@supabase_anon_key"
  }
}
```

### 7.2 Supabase Deployment

**Local → Production pipeline:**
```bash
# 1. Test migration locally with Supabase local
supabase start
supabase db push

# 2. Deploy Edge Functions
supabase functions deploy auth-login --no-verify-jwt
supabase functions deploy auth-register --no-verify-jwt
supabase functions deploy get-church

# 3. Set production env vars in Supabase dashboard
# SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY

# 4. Enable RLS (already done in migration)

# 5. Create Storage bucket for attachments via dashboard
```

### 7.3 CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      
      - run: npm ci
      - run: npm run test
      - run: npm run build
      
      - uses: supabase/setup-cli@v1
        with: { version: 'latest' }
      - run: supabase db push  # deploy migrations
      - run: supabase functions deploy --all
      
      - uses: vercel-action@v30
        with:
          token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## Phase 8: Data Migration (Week 3)

### 8.1 Seed Users

The demo users from `mock-db.ts` (demouser1–demouser4) need to be migrated to Supabase Auth + users table.

**Script:** `supabase/functions/seed-demo-users/index.ts`
1. Create auth users with passwords (use admin API)
2. Insert records into `users` table with church_id
3. Seed demo data (chart of accounts, funds, sample transactions)

### 8.2 Data Export/Import

Existing `localStorage` data → SQL `INSERT` statements or `COPY` command.

**Tooling:**
1. Supabase Dashboard → SQL Editor → Run migration
2. Or use `psql` with the connection string
3. Or build a migration script in Edge Function

---

## 📋 Complete File Change Map

### Files Already Modified ✅
| File | Status | What changed |
|------|--------|-------------|
| `supabase/migrations/001_init_schema.sql` | ✅ New | Full schema + RLS + indexes |
| `supabase/functions/auth-login/index.ts` | ✅ New | Email/password login |
| `supabase/functions/auth-register/index.ts` | ✅ New | Registration + role |
| `supabase/functions/get-church/index.ts` | ✅ New | Get current user's church |
| `supabase/functions/_shared/cors.ts` | ✅ New | Shared CORS headers |
| `src/services/supabaseClient.ts` | ✅ New | Supabase JS client factory |
| `src/services/supabaseService.ts` | ✅ New | Full CRUD service layer |
| `src/services/church.ts` | ✅ Rewritten | Business logic → Supabase |
| `src/services/api.ts` | ✅ Updated | Supabase-compatible bridge |
| `src/lib/auth.tsx` | ✅ Rewritten | PIN → email/password auth |
| `.env.example` | ✅ Updated | Supabase + Vercel vars |

### Files Still Need Modifying ⏳ **
| File | Priority | What needs to change |
|------|----------|---------------------|
| `src/routes/auth.tsx` | **P0** | PIN Pad → Email/Password form |
| `src/routes/_app.settings.tsx` | P1 | Remove `resetDb` import from mock-db |
| `src/components/shared/PinPad.tsx` | Optional | Keep for future use (transaction PIN) |
| `src/components/shared/AttachmentInput.tsx` | P1 | Add Supabase Storage upload flow |
| `src/lib/mock-db.ts` | P2 | Mark deprecated or remove |
| `src/routes/_app.audit.tsx` | P1 | Add realtime subscription for audit log |
| `src/routes/_app.dashboard.tsx` | P1 | Add realtime subscription |
| `src/routes/_app.income.tsx` | P1 | Handle RLS 403 errors, add realtime |
| `src/routes/_app.expense.tsx` | P1 | Handle RLS 403 errors, add realtime |
| `src/routes/_app.offering.tsx` | P1 | Add realtime subscription |
| `src/hooks/useRealtime.ts` | P1 | New hook for Supabase Realtime |
| `src/lib/error-handler.ts` | P2 | New — map Supabase errors to Thai messages |

### Files to Create ➕ NEW
| File | Purpose |
|------|---------|
| `supabase/startup.sql` | Auto-run migrations when Supabase starts locally |
| `supabase/functions/upload-url/index.ts` | Generate presigned URL for attachments |
| `src/components/auth/LoginForm.tsx` | Reusable login form component |
| `src/components/auth/RegisterForm.tsx` | Sign-up form |
| `src/hooks/useRealtime.ts` | Supabase Realtime subscription hook |
| `.vercel.json` | Vercel configuration |
| `.github/workflows/deploy.yml` | CI/CD pipeline |
| `src/lib/error-handler.ts` | Error message mapping |

---

## 🔑 Key Principles for Frontend-Backend Cohesion

1. **Frontend trusts the backend**
   - RLS handles access control → frontend doesn't need to filter by church_id
   - Backend returns 403 → frontend shows "ไม่มีสิทธิ์"
   - Backend handles transactions → frontend doesn't need to retry

2. **Error boundaries everywhere**
   - Every `supabase.from().select()` wrapped in try/catch
   - Toast notifications for errors (sonner is already used)
   - Redirect to `/auth` on 401 (session expired)

3. **Loading states for every query**
   - TanStack Query's `isLoading` → show skeleton
   - Never leave user waiting with blank screen

4. **Realtime where it counts**
   - Dashboard: always fresh
   - Forms: optimistic updates (show immediately, sync later)
   - Audit log: append-only, no refresh needed from user

5. **File uploads via Storage**
   - Never store base64 in database
   - Always use presigned URLs (client uploads directly to Storage)
   - Validate file type + size client-side before upload

---

## 📊 Timeline Summary

```
Week 1: Backend Schema + Auth + Service Layer   (✅ Done)
Week 2: Frontend Auth Flow + Attachments         (⏳ Pending)
Week 3: Realtime + Error Handling + CI/CD         (⏳ Pending)
Week 4: Data Migration + Testing + Deploy         (⏳ Pending)
```

---

## 🎯 What to Do Next

**Immediate next step:** Rewrite `src/routes/auth.tsx` to replace PIN Pad with email/password form.

"แข็ดแหล็ด" ต้องการเริ่มตรงไหนครับ؟
1. Rewrite `auth.tsx` (login page) — **P0**
2. Add error handling across all pages — **P1**
3. Set up Vercel deployment — **P1**
4. Add Realtime subscriptions — **P2**
5. File attachments via Supabase Storage — **P1**

เลือกได้เลยครับ หรือให้ผมเริ่ม task แรกก็ได้