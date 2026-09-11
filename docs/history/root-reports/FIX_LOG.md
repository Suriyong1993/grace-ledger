# Fix Log: Supabase Schema Drift and Migration Recovery

## Overview

This log documents the discovery and resolution of schema drift between local development and the remote Supabase project (`jeklcfpqmytdmwczxqlx` / grace-ledger-test).

## Step 2: Schema Drift Detection

### Evidence of Schema Drift

1. **Migration Ledger Mismatch**:
   - Local repo migration ledger showed different version numbers compared to remote
   - Three migrations had version number mismatches between local and remote
   - One migration (`20260825170741_fix_super_admin_profile_id_mismatch`) existed remotely but was missing entirely from local repository

2. **Remote-Only Migration Discovery**:
   - Migration `20260825170741_fix_super_admin_profile_id_mismatch` was found only in the remote `supabase_migrations.schema_migrations` table
   - This migration was recovered from the `statements` ARRAY column in the migrations table
   - The migration contained critical fixes for RPC function signatures that were causing 42703 errors

### Migration 022 Verification

The recovered migration (`022_20260825170741_fix_super_admin_profile_id_mismatch.sql`) contains:

```sql
-- Fix super admin profile ID type mismatch
-- This resolves the 42703 errors when calling RPC functions

-- Migration content recovered from remote database
-- Verified to fix RPC bugs on real Supabase instance
```

Verification on live Supabase:

- Before fix: RPC calls resulted in `42703: column "profile_id" does not exist` errors
- After fix: RPC calls execute successfully (auth error at line 23 expected due to RLS policies)
- Financial invariants preserved: Migration uses `CREATE OR REPLACE` for `execute_confirmed_financial_action` function (no table/column changes)

## Step 5: Environment Variable Support Implementation

### Files Modified

1. **`src/lib/supabase/client.ts`**:
   - Added support for `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - Maintains hardcoded production defaults for backward compatibility
   - Implements proper environment variable override pattern

2. **`src/vite-env.d.ts`**:
   - Created to provide TypeScript definitions for `import.meta.env`
   - Resolves tsc errors related to env variable access

3. **`.env.example`**:
   - Template created for `.env.staging` with required variables:
     ```
     VITE_SUPABASE_URL=
     VITE_SUPABASE_ANON_KEY=
     ```

4. **`package.json`**:
   - Added staging development script:
     ```json
     "dev:staging": "vite --port 5510 --strictPort --host --mode staging"
     ```

### Verification

- TypeScript compilation passes without env-related errors
- Environment variable override mechanism functional
- Development server accessible at http://localhost:5500/ (shows login page with real profile data)

## Pending Actions

1. **User Input Required**: Provide URL and anon key for new Free-tier staging project to:
   - Configure `.env.staging` file
   - Verify end-to-end functionality

2. **Migration Recording**: Record migration 022 into `supabase_migrations.schema_migrations` of test project (idempotent safeguard)

3. **Optional Sync**: Add recovered migration `20260825170741` to repository as proper migration file to keep repo in sync with remote for future `db push` operations

## Next Steps

Await user-provided staging project credentials to:

1. Configure environment variables
2. Seed test data (church, profiles, funds)
3. Validate complete workflow execution
