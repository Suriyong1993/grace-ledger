# Grace Ledger — M3 TypeScript Domain Engine / Service Layer Report

**Milestone**: M3 — Sunday Offering & Cash Count Workflow  
**Phase**: Phase 2 — TypeScript Domain Engine & Service Layer  
**Date**: 2026-08-19  
**Status**: `VERIFIED & COMPLETE`

---

## 1. Executive Summary

Following the successful migration and live PostgreSQL 17 test suite verification (11/11 groups passing), the **M3 TypeScript Domain Engine and Service Layer** has been fully implemented and verified.

Strict design protocols were observed:
1. **Zero UI / Browser E2E code added** (reserved for Phase 3).
2. **Zero database schema modifications** (existing PostgreSQL RPCs and triggers serve as the authoritative accounting engine).
3. **Exact Decimal / Money Precision** (`Money` integer Satang and `Decimal.js` math; no floating point inaccuracies).
4. **Comprehensive Error Translation** (mapping PostgreSQL exception codes into typed `OfferingServiceError` domain exceptions with Thai and English explanations).

---

## 2. File & Component Architecture

```
src/lib/offering/
├── types.ts                   # Domain models, Enums, DTOs, & Error interfaces
├── denomination-engine.ts     # Thai Baht cash denomination calculation & validation
├── variance-engine.ts         # Channel segregation & cash-specific variance analysis
├── lifecycle.ts               # Session state machine, dual-counter & revision invariants
├── offering-service.ts        # Supabase RPC service layer with error mapping
└── index.ts                   # Unified public API export

tests/unit/
├── offering-denomination.test.ts # 6 tests (Bill counts, coin amounts, validation)
├── offering-variance.test.ts     # 5 tests (Channel separation, surplus/shortage, threshold)
├── offering-lifecycle.test.ts    # 13 tests (Transitions, shortcuts, dual counters, revisions)
└── offering-service.test.ts      # 15 tests (RPC payloads, error mapping, query parsing)
```

---

## 3. Key Modules & Technical Specifications

### 3.1. Domain Models & Types (`src/lib/offering/types.ts`)
- **Statuses**: `draft` $\rightarrow$ `counting` $\rightarrow$ `counted` / `variance_review` $\rightarrow$ `confirmed` $\rightarrow$ `posted` (or `voided`).
- **Payment Channels**: `cash`, `bank_transfer`, `qr_code`, `other`.
- **Denominations**: Bill units for ฿1,000, ฿500, ฿100, ฿50, ฿20 and Coin total.
- **DTOs**: `CreateOfferingSessionInput`, `RecordCashCountInput`, `ResolveVarianceInput`, `ReviseOfferingExpectedInput`, `PostOfferingInput`.

### 3.2. Denomination Engine (`src/lib/offering/denomination-engine.ts`)
- Computes exact sub-totals per denomination using Satang arithmetic.
- Provides complete breakdown matrices with bill counts, coin sums, and grand totals.
- Validates non-negative integer constraints for bills and positive decimal values for coins.

### 3.3. Variance & Channel Engine (`src/lib/offering/variance-engine.ts`)
- **Channel Segregation**: Groups session items by channel (`cashTotal`, `transferTotal`, `qrTotal`, `otherTotal`).
- **Cash Variance Invariant**: Compares physical cash count strictly against `expectedCashAmount` (excluding Transfer & QR amounts).
- **Confirmation Clearance**: Enforces that non-zero variances cannot transition to `confirmed` unless `variance_status` is `explained` or `acknowledged` with a reason $\ge 5$ characters.

### 3.4. Lifecycle & State Machine (`src/lib/offering/lifecycle.ts`)
- Enforces the DAG state transition matrix, blocking illegal shortcuts (e.g. `draft` $\rightarrow$ `confirmed`, `counting` $\rightarrow$ `posted`).
- Protects terminal immutable states (`posted`, `voided`).
- Validates dual-counter identity constraints (`counter1 <> counter2`).
- Validates custody accounts for posting (Cash Drawer account required; Bank account required if electronic giving exists).

### 3.5. Offering Service Layer (`src/lib/offering/offering-service.ts`)
- Wraps all 7 PostgreSQL 17 RPCs:
  1. `create_offering_session`
  2. `start_cash_count`
  3. `record_cash_count`
  4. `resolve_offering_variance`
  5. `revise_offering_expected_amount`
  6. `confirm_offering_session`
  7. `post_offering_to_ledger`
- Includes query helpers `getSession(id)` and `listSessions(churchId, status)`.
- Translates PostgreSQL error codes (`DUAL_COUNTER_VIOLATION`, `CANNOT_CONFIRM_UNRESOLVED_VARIANCE`, `INVALID_STATE_TRANSITION`, `MISSING_BANK_ACCOUNT`, `MANDATORY_REVISION_REASON`, `FORBIDDEN`) into user-facing localized errors.

---

## 4. Test Suite Verification

### Vitest Unit & Integration Suite
- **Total Test Files**: 15 / 15 Passed
- **Total Unit & Integration Tests**: 118 / 118 Passed
- **New M3 Domain Tests**: 39 Tests (100% Pass)
  - `offering-denomination.test.ts`: 6 tests
  - `offering-variance.test.ts`: 5 tests
  - `offering-lifecycle.test.ts`: 13 tests
  - `offering-service.test.ts`: 15 tests

### TypeScript Compilation
- Command: `npm run build` (`tsc --noEmit`)
- Result: **0 errors** (Clean build)

---

## 5. Next Steps

Phase 2 (TypeScript Domain Engine) is complete. The system is ready for **Phase 3 — UI Pages & Components (React & App Router)** upon user instruction.
