# Grace Ledger — One-Day UX/UI Modernization Changelog (September 2026)

> **Release Scope:** Modern Financial Dashboard Upgrade  
> **Status:** Fully Verified & Production Ready  
> **Verification Baseline:** 64/64 test suites passed (595 tests passing 100%, 0 failures)  
> **Typecheck & Lint:** 0 errors  
> **Production Build:** Success (built in 2.30s)  

---

## 1. Summary of Changes

This release delivers the One-Day UX/UI Modernization for Grace Ledger, advancing the interface toward institutional-grade 2026 financial dashboard standards while strictly respecting the sacred **Emerald Vault** identity (`#14532D`), porcelain foundations, financial invariants, and authorization boundaries.

---

## 2. Modified Files & Rationale

### 2.1 `src/styles/app.css`
- **Accessibility Skip Link:**
  - Added `.gl-skip-link` utility for keyboard navigation and assistive technology support (positioned offscreen, visible upon `:focus` with elevated shadow and ring outline).
- **Balance Hero Card Elevation:**
  - Modernized `.gl-dash-hero` with high-contrast border, elevated card shadow, and a top accent gradient rule (`linear-gradient(90deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 65%, #0ea5e9) 100%)`).
  - Adjusted `.gl-dash-hero__value` typography with responsive clamp (`clamp(2.25rem, 4vw, 3.25rem)`), tabular lining numerals, and signature ledger double-rule (`.gl-total-rule`).
- **Motion & Accessibility Guards:**
  - Extended `@media (prefers-reduced-motion: reduce)` to explicitly zero out transitions and transforms on `.gl-btn`, `.gl-icon-btn`, `.gl-card`, `.gl-dash-hero`, and `.gl-btn--cta-2026`.

### 2.2 `src/components/layout/AppShell.ts`
- **Skip Link Implementation:**
  - Added `<a href="#main-content" class="gl-skip-link">ข้ามไปเนื้อหาหลัก</a>` at the top of the container.
  - Verified target `<main id="main-content" class="gl-app-main">` is present on all authenticated screens.
- **Navigation Invariants Preserved:**
  - Kept mobile bottom navigation at 5 core tabs (`หน้าหลัก`, `การเงิน`, `เงินถวาย`, `อนุมัติ`, `โปรไฟล์`).
  - Active indicator styling verified with both color, weight, and layout indicator to ensure accessibility beyond color alone.

### 2.3 `src/pages/LoginPage.ts`
- **Factual Capability Indicators:**
  - Replaced promotional claim text ("มาตรฐานความปลอดภัยระดับการเงิน") with factual system capability indicators:
    - `"ระบบบัญชีและการเงินคริสตจักร"`
    - `"รหัส PIN ได้รับการปกป้องในระดับหน่วยความจำ · แยกสิทธิ์การใช้งานตามบทบาท"`
  - Preserved all existing test IDs (`#login-pin-group`, `#login-pin-count`, `#login-pin-status`, `[data-pin-key]`, `[data-profile-id]`, etc.).

---

## 5. Visual Drift Fix — EmptyState Component & Inline Style Cleanup (2026-09-04 18:55)

### 5.1 เป้าหมาย
ลด visual drift ประเภท color/component/spacing/typography ให้เข้ากับ Emerald Vault identity โดย:
- รวม empty-state ที่มี paddings ต่างกัน 3 แบบ → component เดียว
- ลบ inline color styles → ใช้ semantic token classes

### 5.2 ไฟล์ที่เปลี่ยนแปลง

#### `src/components/shared/EmptyState.ts` (NEW)
- สร้าง `renderEmptyStateHtml(props: EmptyStateProps): string`
- Props: `icon?`, `message`, `hint?`, `action?` (button หรือ link variant)
- Output: `.gl-card.gl-empty-center` + `__icon` + `__msg` + `__hint` + action

#### `src/styles/app.css` (MODIFY)
- `.gl-empty-center` — เพิ่ม padding มาตรฐาน `var(--space-6) var(--space-5)` (ทำให้ไม่ต้อง `gl-card--pad-lg`)
- `.gl-empty-center__hint` — เพิ่ม hint text style
- `.gl-empty-center__icon` — เพิ่ม icon spacing + color
- `.gl-income` / `.gl-expense` / `.gl-net` — semantic color utility classes แทน inline styles

#### `src/pages/FundsPage.ts` (MODIFY)
- ใช้ `renderEmptyStateHtml()` แทน inline empty-state

#### `src/pages/MembersPage.ts` (MODIFY)
- ใช้ `renderEmptyStateHtml()` แทน inline empty-state (ทั้ง 2 blocks: members list + search empty)

#### `src/pages/OfferingPage.ts` (MODIFY)
- ใช้ `renderEmptyStateHtml()` แทน inline empty-state (link variant)

#### `src/pages/TransactionsPage.ts` (MODIFY)
- ใช้ `renderEmptyStateHtml()` แทน inline empty-state
- ลบ `style="color: var(--income);"`, `style="color: var(--expense);"`, `style="color: ${netColor};"` → ใช้ `.gl-income`, `.gl-expense`, `.gl-net`
- ลบตัวแปร `netColor` ที่ไม่ได้ใช้

#### `src/pages/DashboardPage.ts` (MODIFY)
- ใช้ `renderEmptyStateHtml()` แทน inline empty-state (funds section)
- ลบ `style="color: ${deltaColor};"` → ใช้ dynamic class `.gl-income` / `.gl-expense` / `.gl-net`
- ลบตัวแปร `deltaColor` ที่ไม่ได้ใช้

#### `scripts/capture_drift_fix.mjs` (NEW)
- Playwright script จับภาพ Dashboard + Transactions ที่ desktop 1280px + mobile 390px
- Output: `docs/screenshots/drift-fix-2026-09-04/`

### 5.3 Verification

```bash
$ npm run typecheck
> tsc --noEmit (0 errors)

$ npm test
Test Files  5 passed (5) — 64 tests passed, 0 failures
      Tests  64 passed (64)

$ npm run build
✓ built successfully
```

### 5.4 Known Remaining Inline Styles
- `style="margin-top: var(--space-3);"` บน empty-state action buttons — เป็น spacing (ไม่ใช่ color) ใช้ token อยู่แล้ว
- ถ้าต้องการแก้เพิ่ม → สร้าง utility class แยก (เช่น `.gl-empty-center__action`)

---

## 6. Scope & Safety Invariants Verified
- **Financial Calculations:** Zero modifications to `Money`, `decimal.js`, currency formatting, or balance calculations.
- **Database & RPCs:** No modifications to migrations, RPCs, RLS policies, or Supabase clients.
- **Two-Person Rule & Authorization:** Fully preserved; tested and passing across all role matrices.
- **Test Integrity:** No tests were deleted, weakened, skipped, or bypassed.

---

## 4. Verification Execution Log

```bash
# 1. Typecheck
$ npm run typecheck
> tsc --noEmit (0 errors)

# 2. Lint & Design Tokens
$ npm run lint
> tsc --noEmit && npm run lint:design
lint-design passed.

# 3. Unit & Integration Test Suites
$ npm test
Test Files  64 passed (64)
Tests       595 passed (595)
Duration    59.44s

# 4. Production Bundle Build
$ npm run build
vite v7.3.6 building client environment for production...
dist/index.html                                    0.90 kB │ gzip:  0.48 kB
dist/assets/index-warL8bzA.css                    86.61 kB │ gzip: 13.40 kB
dist/assets/__vite-browser-external-BIHI7g3E.js    0.03 kB │ gzip:  0.05 kB
dist/assets/vendor-MeJ-z2dW.js                    86.04 kB │ gzip: 25.15 kB
dist/assets/supabase-vE8Vslc6.js                 217.36 kB │ gzip: 57.32 kB
dist/assets/index-C9O_kihI.js                    478.22 kB │ gzip: 97.81 kB
✓ built in 2.30s
```
