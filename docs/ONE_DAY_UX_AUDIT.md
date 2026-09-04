# Grace Ledger — One-Day UX/UI Audit & Modernization Specification (September 2026)

> **Document Status:** Official Architecture & Design Audit  
> **Author:** Senior Product Designer & Staff Frontend Engineer  
> **Date:** September 2026  
> **Product Target:** Grace Ledger (Church Financial OS)  
> **Stack:** Vanilla TypeScript + Vite + Supabase (PostgreSQL 17) + decimal.js  

---

## 1. Executive Summary & Brand Translation

### 1.1 Context
Grace Ledger serves as the fiduciary operating system for **"คริสตจักรชีวิตสุขสันต์กาฬสินธุ์"**. Managing sacred tithes, offerings, fund allocations, and financial disbursements demands an interface that radiates **uncompromising trust, mathematical precision, and calm clarity**. 

Modern fintech in 2026 has departed from sterile flat templates and superficial AI gimmickry. The benchmark is set by production-ready, clear, calm, trustworthy, and accessible financial dashboard UX: high visual contrast, deliberate typography hierarchies, restrained semantic accents, tactile micro-feedback, and rigorous accessibility.

### 1.2 The Reference Translation (Emerald Vault 2026)
While consumer fintech benchmarks often rely on vibrant purple/violet gradients and floating cards, Grace Ledger's canonical identity is **"Emerald Vault"**:
- **Primary Color:** Deep Vault Evergreen (`#14532D`, `--primary`), anchoring the system in stability and growth.
- **Surface Foundations:** Warm Porcelain canvas (`#F4F5F2`, `--background`) paired with pure white operational cards (`#FFFFFF`, `--card`) and dark vault sidebar (`#0B1F17`, `--sidebar`).
- **Restrained Accents:** Controlled Teal/Indigo subtle ambient gradients reserved strictly for high-order visual anchors (e.g. Hero cards, AI assistant badges).
- **Hard Anti-Pattern Rejections:**
  - ❌ No superficial purple palettes.
  - ❌ No promotional security claims (replace with factual system capability indicators only).
  - ❌ No illegible low-contrast glassmorphism across operational tables.
  - ❌ No floating elements lacking clear borders and drop shadows.

---

## 2. Comprehensive UX/UI Audit: Current State vs. 2026 Standard

| Surface / Area | Current State (Pre-Upgrade) | 2026 Financial Standard Gap | Upgrade Action |
| :--- | :--- | :--- | :--- |
| **Login Screen** | Desktop renders a single centered card (`gl-login-card`) on an empty background; brand context is confined within the card header. | Modern financial portals use asymmetric split compositions: an inspiring brand anchor on one side and a focused, secure authentication terminal on the other. | Implement desktop two-column split layout (`gl-login-vault`): Left = Brand & factual capability indicators (PIN protected, Role-based access, Audit trail); Right = Interactive profile roster & PIN pad. Seamless single-column stack on mobile (≤768px). |
| **App Shell & Navigation** | Dark sidebar (`#0B1F17`) exists on desktop. Mobile bottom navigation was recently streamlined to 5 core tabs (`หน้าหลัก`, `การเงิน`, `เงินถวาย`, `อนุมัติ`, `โปรไฟล์`). | Skip-to-content accessibility link is missing. Active sidebar indicators lack prominent tactile depth and clear focus ring visibility across keyboard navigation. | Add accessible skip link (`.gl-skip-link`) targeting `<main id="main-content">`. Strengthen active nav indicators with accent bar, distinct pill geometry, and accessible focus states. |
| **Dashboard Visual Anchor** | Total balance is rendered inside a large card, but competes visually with the AI greeting and attention items for initial gaze priority. | 2026 executive dashboards feature a distinct **Hero Balance Focal Point** with prominent font scale (`clamp(2rem, 4vw, 2.75rem)`), tabular lining numerals, and double ledger line styling. | Modernize Balance Hero: make it the unmistakable operational anchor, flanked by clean month-over-month context metrics and quick role-based execution actions. |
| **Pending Work & Attention** | Attention alerts and approval queues are displayed effectively, but require sharper visual grouping and clearer urgency levels. | Financial operators must see actionable work partitioned by urgency: immediate approvals vs. routine session drafts. | Enhance `gl-command-center` and attention rows with distinct border-left accents, accessible status chips, and crisp contrast. |
| **Typography & Data Tables** | Numbers use `num-display` with `font-feature-settings: 'tnum'`, which is great, but metric labels and secondary notes occasionally lack sufficient contrast against muted backgrounds. | Financial interfaces require strict type scale ratios, crisp kicker labels (`text-2xs` uppercase tracking), and high readability in Thai script. | Refine typography tokens: harmonize headings with body text, ensure `--font-sans` Thai rendering uses optimal line heights (`1.5` for body, `1.2` for titles). |
| **Micro-Interactions** | Instantaneous DOM replacement occurs on full re-renders, causing abrupt visual jumps. | 2026 standards require subtle transitions: smooth hover feedback on pointer devices with equivalent pressed/focus states for keyboard and touch, and strict respect for `prefers-reduced-motion`. | Add refined CSS transition rules and subtle elevation shadows (`--shadow-card`, `--shadow-elevated`) across all cards and buttons. |

---

## 3. Detailed Specifications by Page

### 3.1 Login Page (`src/pages/LoginPage.ts` & `src/components/login/loginStyles.ts`)
1. **Desktop Split View (≥960px):**
   - **Left Panel (Vault Showcase):** Dark vault background (`#0B1F17`), subtle radial emerald glow, Church brand mark, "คริสตจักรชีวิตสุขสันต์กาฬสินธุ์", factual capability indicators (สิทธิ์เข้าถึงแยกตามบทบาท, บันทึกตรวจสอบย้อนหลังทุกรายการ, รหัส PIN 6 หลัก).
   - **Right Panel (Authentication Terminal):** Centered high-elevation card.
     - State 1: Profile Selection roster with role tags and quick-select chevrons.
     - State 2: 6-digit PIN pad with physical keypad feel, back navigation button, secure dots indicator with error shake, and inline email bootstrap reset link.
2. **Mobile View (≤768px / 390px):**
   - Compact brand header with vault badge and church name.
   - Clean single-column layout prioritizing large touch targets (minimum 44x44px keypad buttons).
3. **Accessibility & Test Invariants:**
   - Preserve all existing DOM selectors: `#select-profile`, `[data-profile-id]`, `[data-pin-key]`, `[data-pin-action]`, `#login-pin-group`, `#login-pin-count`, `#login-pin-status`.

### 3.2 App Shell & Global Navigation (`src/components/layout/AppShell.ts`)
1. **Accessibility Skip Link:**
   - Prepend `<a href="#main-content" class="gl-skip-link">ข้ามไปเนื้อหาหลัก</a>` at the top of the shell.
   - Verify that `<main id="main-content">` exists on every authenticated route.
2. **Desktop Sidebar:**
   - Solid dark vault background (`#0B1F17`).
   - Active indicator: bold text + emerald indicator line on active tab.
   - Visible keyboard focus rings (`outline: 2px solid var(--ring); outline-offset: 2px`).
3. **Mobile Bottom Navigation:**
   - Fixed 5-tab bar (`หน้าหลัก`, `การเงิน`, `เงินถวาย`, `อนุมัติ`, `โปรไฟล์` where `โปรไฟล์` is the existing active route `#/profile` acting as the gateway to Profile, Funds, Members, and Reports).
   - Active indicator: accent color + active indicator dot.
   - Safe-area inset support (`padding-bottom: max(var(--space-2), env(safe-area-inset-bottom))`).

### 3.3 Modern Financial Dashboard (`src/pages/DashboardPage.ts`)
1. **Hero Balance Card (Visual Focal Point):**
   - Grand total funds displayed with ledger double-rule underline (`.gl-total-rule`).
   - Clear sub-breakdown: Income this month (`+฿X.XX`), Expense this month (`-฿X.XX`), Net Variance (`฿X.XX`) with explicit period label.
   - Subtle restrained emerald-to-teal gradient mesh overlay for high visual polish without noise.
2. **Operational Command Center (งานสัปดาห์นี้):**
   - High-contrast alert banner when items are pending (`gl-badge--pending`).
   - Clean cards linking directly to `#/approvals` or `#/offerings`.
3. **Role-Gated Fast Actions:**
   - Prominent primary action button (e.g. `+ บันทึกเงินถวาย` for counters, `+ บันทึกรายการ` for finance staff).
4. **Recent Activity & Fund Budgets:**
   - 2-column split on desktop, stacked on mobile.
   - Progress indicators with accessible attributes (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`) displaying current value, target, and percentage.
   - Transaction list with clear status pills (`อนุมัติแล้ว`, `รอตรวจสอบ`, `ไม่อนุมัติ`).

---

## 4. Financial Safety & Zero-Regression Guardrails
- **Money Math:** All amounts formatted strictly via `Money.format()`. Zero usage of raw JavaScript floating point math.
- **Invariants:** Split Parity (`SUM(splits) === transaction.amount`) and Two-Person Rule remain intact.
- **Verification Guarantee:** Maintain system behavior and require all existing test suites in the repository to pass without deleting, weakening, or bypassing tests.
