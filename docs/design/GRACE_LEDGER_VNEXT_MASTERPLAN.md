# Grace Ledger vNext — Masterplan

Status: approved direction (2026-08-05). Evolve, not rebuild. Screen-by-screen, quality over speed.
Basis: full-app audit (17 screens, see chat record) + `docs/ux/UXDR.md` + `docs/design/prototype/DESIGN-SYSTEM-V2.md` (historical reference only, superseded).

---

## 1. Product Vision

Grace Ledger is the financial nervous system of a church — the thing a treasurer, a finance
volunteer, and a board member all trust without thinking about it. It must feel like software a
world-class fintech built for a customer who is not an accountant and does not want to become one.

Two things have to be simultaneously true, and most finance software picks only one:
- **Calm and fast for daily use** (recording an offering should take under a minute).
- **Rigorous and provable for oversight** (every number must be traceable, every action
  attributable, nothing ever silently wrong).

vNext optimizes for trust first, clarity second, beauty third — in that order. Beauty that hides an
inconsistency is a liability in this product category.

## 2. Information Architecture

Current IA is grouped by **accounting taxonomy** (money type → funds/budget → org). It does not
distinguish the two personas who actually use the app. vNext groups by **job**, not by data model:

- **ทำรายการ (Do)** — daily, high-frequency, finance staff: Dashboard, รับเงิน (Receive Money),
  จ่ายเงิน (Pay Expense), เงินถวาย (Offering)
- **กำกับดูแล (Govern)** — occasional, leaders/admins: อนุมัติ (Approvals), กระทบยอด
  (Reconciliation), รายงาน (Reports), บันทึกตรวจสอบ (Audit Log)
- **จัดการ (Manage)** — rare, setup/admin: กองทุน (Funds), โครงการ (Projects), งบประมาณ (Budget),
  สมาชิก (Members), หมวดหมู่ & ตั้งค่า (Categories & Settings)
- **คุณ (You)** — Profile only. Settings is removed from the topbar dropdown (it already lives in
  the sidebar under Manage) — no more duplicate paths to the same page.

Grace AI and LINE move out of the unlabeled "system" cluster. Until they're wired to something real
(see §9 Roadmap, trust-fix phase) they are labeled **"ทดลอง" (Experimental)** in-product, not
presented at the same trust level as financial tools — this is a UX-honesty requirement, not
cosmetic.

Naming: income/expense pages get event-based labels in UI copy (รับเงิน / จ่ายเงิน) instead of
accounting labels (รายรับ / รายจ่าย), per UXDR-001. Route paths (`/income`, `/expense`) stay
unchanged — no backend/routing churn for a copy change.

Mobile bottom nav fixes the audited gap: Dashboard, Receive, Pay, Offering + More (was missing
Offering despite it being a core daily action).

## 3a. Gridgeist Thesis (governs all screens from here on)

**Thesis**: *A precise ledger-grid finance tool — structured rows and quiet dividers carry the
content, one restrained blue accent marks action and risk, cards are containers not decoration.*

**Ledger-grid system**:
- **Structure**: real tabular grids for anything that is actually a list of records (transactions,
  approvals, audit log, budgets) — not card-grids standing in for tables. Borders organize columns;
  they don't outline every box.
- **Type**: `.kicker` (11px/600/uppercase) for column headers and section labels — already exists,
  keep using it consistently. Numbers always `.num-display` (Inter tabular), right-aligned in any
  row context. No mono — Thai text renders poorly in monospace, skip that Raycast-style affectation.
- **Spacing**: dense inside data rows (existing `py-3/3.5` table rows), airier around section
  containers (`p-5/p-6` cards) — the contrast between dense-data and airy-frame is the rhythm, not
  uniform padding everywhere.
- **Elevation**: border-only on flat containers (`card-ledger` — already correct, keep). Shadow only
  on things that actually lift/overlap (drawer, dialog, hover-lift on interactive cards).
- **Color**: no new hues. Existing oklch semantic tokens (primary/income/expense/offering/pending)
  already form one coherent restrained-accent system — extend, never add a new color family.
- **Radius**: vNext scale from §4 (16/12/10) applies everywhere.
- **Anti-pattern to actively remove as each screen is touched**: forcing two different record types
  into one table with empty/hardcoded cells for whichever type doesn't fit (found on /income —
  Income+Offering merged, offering status hardcoded "approved") — ledger-grid means each real table
  has one real shape, not a compromise shape.

## 3. Design Language

Five words: **calm, exact, spacious, quiet, honest.**

Reference principles extracted (not copied) from Linear/Stripe/Mercury/Attio/Notion/Vercel:
- Numbers are the protagonist. Nothing competes visually with a money figure on its own row.
- Borders over shadows. Elevation is used sparingly and only to indicate literal overlap (drawers,
  dialogs, popovers) — not to decorate flat cards.
- One primary action per screen, always. Every secondary action is visually quieter (outline/ghost),
  never competing in weight.
- Motion explains state change; it never performs. 150–250ms, ease-out, transform/opacity only.
- Every async view has exactly three states it must render correctly: loading (skeleton matching
  real layout), error (message + retry, never silent fallback to zero/fake data), and empty
  (explncdanation + the one action that fixes it). No screen may skip any of the three.
- Nothing fake. A demo/placeholder value is either clearly labeled as such in the UI or does not
  exist. (Direct fix for the audit's worst finding: fabricated AI/OCR results and a component that
  silently substitutes fake demo transactions when real data is empty.)

## 4. Design System vNext

Evolve current v3 tokens (`src/styles.css`) — they are structurally sound (oklch, semantic
income/expense/offering/pending colors, Inter+Sarabun pairing already correct for a Thai/numeric UI).
Do not introduce a new palette or new fonts. Refine:

- **Radius**: current 24px card / 18px button reads slightly "soft toy" next to the Linear/Stripe
  reference set. Tighten to 16px card / 12px button / 10px input across new screens; keep the token
  names (`--radius-card`, `--radius-button`, `--radius-input`), just change the computed values —
  this cascades everywhere with a single-file change, no per-component edits needed.
- **Elevation**: keep `shadow-xs`/`shadow-card` for drawers/dialogs/popovers only. Flat cards use
  border-only (`card-ledger` already does this — keep it, stop introducing ad-hoc shadows on cards
  as new screens are built).
- **Spacing**: 8pt grid (already inherited via Tailwind v4 default scale) — no new tokens needed,
  just discipline in application.
- **Motion**: keep existing keyframes (`fade-up`, `scale-in`, etc.) — stop introducing new one-off
  animations per screen. `prefers-reduced-motion` handling already exists globally, keep it.
- **Async-state contract** (new, mandatory): every data-fetching screen implements
  loading / error / empty as three explicit branches, not implicit fallthrough. This becomes a
  lint-by-code-review rule, not a new component — see §7.

## 5. Navigation

```
ทำรายการ (Do)
  แดชบอร์ด         /dashboard
  รับเงิน           /income
  จ่ายเงิน          /expense
  เงินถวาย          /offering

กำกับดูแล (Govern)
  อนุมัติ           /approvals
  กระทบยอด          /reconciliation
  รายงาน            /reports
  บันทึกตรวจสอบ      /audit

จัดการ (Manage)
  กองทุน            /funds
  โครงการ           /projects
  งบประมาณ          /budget
  สมาชิก            /members
  หมวดหมู่ & ตั้งค่า   /settings

ทดลอง (Experimental)
  Grace AI          /ai
  LINE              /line-setup

คุณ
  โปรไฟล์           /profile   (topbar dropdown: Profile + Logout only, no duplicate Settings)
```

Mobile bottom nav: Dashboard · Receive · Pay · Offering · More.

Role-based visibility is a data change (`NavItem.roles?: Role[]`), not a new component — filter
`NAV_GROUPS`/`NAV_SYSTEM` by `can()` at render time in `AppSidebar`. Deferred to the IA/nav
implementation phase (§9), not part of the four starting screens.

## 6. Screen Inventory

| # | Screen | Route | Current avg score | vNext priority |
|---|---|---|---|---|
| 1 | Dashboard | /dashboard | 5.6 | **Phase 1** |
| 2 | Receive Money (Income) | /income | 6.1 | **Phase 2** |
| 3 | Pay Expense | /expense | 6.0 | **Phase 3** |
| 4 | Approvals | /approvals | 6.7 | **Phase 4** |
| 5 | Offering | /offering | 5.7 | Phase 5 |
| 6 | Reconciliation | /reconciliation | 6.9 | Phase 5 |
| 7 | Reports | /reports | 5.6 | Phase 5 |
| 8 | Audit Log | /audit | 6.7 | Phase 5 |
| 9 | Funds | /funds | 6.4 | Phase 6 |
| 10 | Budget | /budget | 6.1 | Phase 6 |
| 11 | Members | /members | 5.8 | Phase 6 (+ remove fake receipt button) |
| 12 | Settings | /settings | 5.3 | Phase 6 (+ rename/scope honestly) |
| 13 | Profile | /profile | 6.4 | Phase 6 |
| 14 | Grace AI | /ai | 4.4 | **Trust-fix phase** — label experimental or disconnect fake OCR/chat before any visual polish |
| 15 | LINE Setup | /line-setup | 4.7 | **Trust-fix phase** — same |
| 16 | Nav/IA shell | AppNav/Sidebar/Topbar | — | Phase 7 (role-gating infra) |
| 17 | Projects | /projects | not yet audited | Phase 6 |

## 7. Component Inventory

**Reuse as-is**: `StatCard`, `StatusBadge`, `MoneyText`, `PageHeader`, `EmptyState`, `AttachmentInput`/
`AttachmentPreview`, the Voucher Inspector drawer pattern (Expense) — this is the single best
detail-view pattern in the app and should become the template for Income/Offering detail drawers too.

**Fix in place** (bug, not redesign): `RecentTransactionsTable` silently substitutes 4 hardcoded
demo transactions whenever the real `transactions` array is empty (`displayTxs = transactions.length
> 0 ? transactions : DEFAULT_TXS`) — this is the exact "fabricated data presented as real" trust
violation flagged in the audit, just discovered in a shared component instead of a page. Fixed as
part of Phase 1 (Dashboard) since that's the only current consumer.

**New, small, shared**: none required for Phase 1–4. No new abstraction until a second concrete need
proves it (per project convention — no speculative components).

## 8. UX Principles (binding for every screen going forward)

1. Event language, not accounting language, in all UI copy (UXDR-001).
2. One primary action per screen; everything else is visually quieter.
3. Loading / error / empty are all explicitly handled — never implicit fallthrough to zero or fake
   data.
4. No feature is presented as working unless it actually is. Mocked functionality is either labeled
   "ทดลอง" in the UI or removed until real.
5. Every number a user might question has a one-hover explanation of how it's derived.
6. Progressive disclosure — dialogs/drawers over full-page forms, wizard steps over giant forms
   (already true for Income/Expense/Offering create dialogs — keep it).
7. Redundant entry points are consolidated to one canonical path per action (e.g., approve only from
   Approvals + the item's own detail drawer — not also inline in table rows duplicating both).

## 9. Implementation Roadmap

- **Phase 0** (done): this masterplan.
- **Phase 1**: Dashboard — async states, fix `RecentTransactionsTable` fake-data bug, wire or remove
  dead period filter, explain cash-balance derivation, tighten radius/spacing to vNext scale.
- **Phase 2**: Receive Money (Income) — split Income/Offering out of one forced-shared table,
  fix hardcoded offering status.
- **Phase 3**: Pay Expense — consolidate the 3 redundant approve entry-points to 1, reduce header
  button crowding to one clear primary.
- **Phase 4**: Approvals — add bulk-approve for low-risk items, add query error state.
- **Phase 5**: Offering, Reconciliation, Reports, Audit — standardize stat-card row across all
  transaction pages, add persistence to reconciliation "actual" inputs, replace Reports' raw
  category IDs with names, add real Table + pagination to Reports statement tab, fix Audit's fake
  "100% สมบูรณ์" and client-heuristic severity.
- **Phase 6**: Funds, Budget, Members, Settings, Profile, Projects — fix division-by-zero in Budget,
  remove Members' fake tax-receipt button (or wire to real PDF generation), rename/rescope Settings.
- **Trust-fix phase** (can run in parallel with Phase 5–6, does not block Phase 1–4): Grace AI and
  LINE Setup — either connect to real backends or clearly label every mocked element as
  "ทดลอง — ยังไม่เชื่อมต่อจริง" (experimental — not really connected) so no user can mistake fake
  output for real.
- **Phase 7**: Role-based nav filtering infrastructure (`NavItem.roles`, `AppSidebar` filter by
  `can()`), topbar dropdown dedup (drop Settings, keep Profile + Logout).

Each phase ships independently, gets verified in-browser before moving to the next. No phase blocks
on a later one.
