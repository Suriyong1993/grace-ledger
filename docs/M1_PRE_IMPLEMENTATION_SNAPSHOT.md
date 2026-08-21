# M1 Pre-Implementation Snapshot

**Snapshot Timestamp:** 2026-08-17  
**Auditor:** Principal Engineer  
**Workspace:** `grace-ledger/`  

---

## 1. Existing Workspace Inventory

Prior to creating any database migrations or TypeScript domain layer files, a complete recursive inspection of the workspace was executed:

- **Root Directory:**
  - `Grace Ledger Design System.zip` (Source UI kit & tokens bundle)
  - `Grace Ledger UI Mockups.zip` (Source 18 mobile screens bundle)
  - `design-system-extracted/` (Unpacked design system assets, CSS tokens, React JSX components)
  - `mockups-extracted/` (Unpacked mobile mockup canvas and device frames)
  - `docs/` (`PRODUCTION_AUDIT.md`, `FOUNDATION_IMPLEMENTATION.md`)
- **Package Configuration:**
  - No existing root `package.json` was present. A clean, strict configuration supporting React 19, TypeScript 5+, TanStack ecosystem, Vitest, Decimal.js, and Supabase client will be initialized.
- **Database Configuration:**
  - No previous Supabase migrations or SQL schema existed in the workspace directory.
  - This guarantees a clean slate for applying the canonical, non-destructive migration sequence (`001_core_schema.sql`, `002_security_definers.sql`, `003_financial_rpcs_and_triggers.sql`, `004_rls_policies.sql`).

---

## 2. Baseline Architecture & Design Token Alignment

The extracted Design System (`design-system-extracted/`) provides the canonical design tokens:
- Colors: `tokens/colors.css` (`#FFFCF8` background, `#171717` ink, `#f97316` brand orange, fixed emerald/red/amber finance hues)
- Typography: `tokens/typography.css` (`Sarabun` for Thai UI text, `Inter` for Latin/numerals/display, `.num-display` tabular figures)
- Radius: `tokens/radius.css` (Cards 24px, Buttons 18px, Inputs 14px, Tables 0px)
- Motion: `tokens/motion.css` (Emil Kowalski ease-out, 400ms ceiling)

---

## 3. Conflict Analysis & Resolution

| Area | Pre-Implementation State | M1 Target Resolution | Status |
| :--- | :--- | :--- | :---: |
| **Monetary Types** | Float in JS mock files | Strict `NUMERIC(14,2)` in PostgreSQL, `Decimal.js` in TS | **RESOLVED** |
| **Fund Invariant** | Unenforced in mock data | `transaction_splits.fund_id NOT NULL` enforced in DB | **RESOLVED** |
| **Transfers** | No database atomic RPC | `transfer_funds()` atomic PostgreSQL RPC with Net=0 assertion | **RESOLVED** |
| **Member Giving** | Exposed in static mocks | Direct SELECT blocked via RLS; Secure audited RPC only | **RESOLVED** |
| **Audit Trail** | No CDC triggers | `fn_audit_log_change()` trigger on all financial tables | **RESOLVED** |

---

Snapshot confirmed. Authorized to proceed with Step 1 migrations.
