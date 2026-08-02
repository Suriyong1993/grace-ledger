# Component Library — Grace Ledger v3.0

> Canonical component reference. "Status" reflects what's actually true
> in the codebase as of the v3.0 rollout, not aspirational — see the
> Final UI Migration Report (in the v3.0 blueprint) for what remains.

## Button

**File:** `src/components/ui/button.tsx`
**Variants:** `default` (primary), `secondary`, `outline`, `ghost`, `destructive`, `link`
**Sizes:** `default` (h-11/44px), `sm` (h-9/36px), `lg` (h-12/48px), `icon` (h-11×w-11)
**Radius:** `rounded-button` (18px)
**Status:** Canonical, no duplicates remain — every raw `<button>` in the
app has been migrated (roughly 20 instances across 10 files).

**Usage rule:** never render a raw `<button>`. The `sm` size (36px) is a
deliberate exception to the 44px touch-target default, reserved for
dense table-row actions where mouse/keyboard is the primary input, not
touch — e.g. inline approve/reject buttons in a transaction table.

```tsx
<Button variant="destructive" onClick={handleReject}>ปฏิเสธ</Button>
<Button asChild variant="outline"><Link to="/approvals">ดูรายการ</Link></Button>
```

## Input / Textarea / Select

**Files:** `src/components/ui/input.tsx`, `textarea.tsx`, `select.tsx`
**Radius:** `rounded-input` (16px)
**Height:** 44px (`h-11`) minimum
**Status:** Canonical.

**Usage rule:** label always above the field (never placeholder-as-label).

## Card

**File:** `src/components/ui/card.tsx`
**Variants:** `default` (static, no hover), `stat` (padding preset for KPI cards), `interactive` (hover-lift + press feedback — opt-in, not automatic)
**Radius:** `rounded-card` (24px)
**Status:** Canonical for new/touched code. **Not fully consolidated** —
`.card-ledger` (a CSS utility class, not the `<Card>` component) is still
used across most routes. Since Phase 1, `.card-ledger` compiles to the
*same* `rounded-card`/border/background as `<Card>`, so there is no
visual inconsistency — only an architectural one. A full JSX-level swap
was deferred as low-value, high-risk code churn (see the Card row in the
blueprint's Component Migration Tracking table).

```tsx
<Card variant="interactive" onClick={openDetail}>
  <CardHeader><CardTitle>กองทุนทั่วไป</CardTitle></CardHeader>
  <CardContent>...</CardContent>
</Card>
```

## Dialog

**File:** `src/components/ui/dialog.tsx`
**Radius:** `rounded-dialog` (28px)
**Responsive:** full-screen on mobile (`< sm`), centered modal on `sm+`
**Status:** Canonical.

**Usage rule:** every destructive action (void, reject, delete) must use
this — see Approvals' `RejectDialog` for the reference pattern (Textarea
reason field + `variant="destructive"` confirm button, disabled while
empty/submitting).

## Drawer / Sheet

**Files:** `src/components/ui/drawer.tsx` (bottom sheet, mobile), `sheet.tsx` (side panel, all breakpoints)
**Radius:** `rounded-sheet` (32px), directional per side (`rounded-t-sheet` for Drawer, `rounded-l/r/t/b-sheet` for Sheet by `side` prop)
**Status:** Canonical, overlay treatment unified (`bg-black/40 backdrop-blur-md`, previously inconsistent between Dialog/Drawer/Sheet).

**Usage rule:** the row-detail-via-Sheet pattern (used on Dashboard,
Members) is the standard drill-in pattern — prefer it over navigating to
a separate detail route for lightweight inspection.

## Table

**File:** `src/components/ui/table.tsx`
**Status:** Canonical for the primary transaction-log screens (Income,
Expense, Offering, Members, Reconciliation). **Not migrated:** raw
`<table>` markup still exists in `ChurchHandwrittenFormScannerModal.tsx`
and `SundayCountSheet.tsx`.

**Usage rule (card-vs-table decision, resolved in Phase 6):** use `Table`
for genuinely tabular, many-row data (transaction logs, audit trails).
Card grids remain acceptable — not a violation — for a handful of rich,
multi-metric entities where a large hero number matters more than column
density (Funds, Budget, Projects: one card per fund/budget-line/project,
each showing name + accent + progress + a large balance figure).

## Badge

**File:** `src/components/ui/badge.tsx`
**Variants:** `default`, `secondary`, `destructive`, `outline`, `success`, `warning`, `info`
**Shape:** `rounded-full` (pill)
**Status:** Canonical. `StatusBadge` (`src/components/shared/StatusBadge.tsx`)
is a typed wrapper over this — same DOM/CSS system, not a parallel
implementation.

```tsx
<StatusBadge status="pending" />   {/* renders <Badge variant="outline" className="badge-pending"> internally */}
```

## Skeleton

**Files:** `src/components/ui/skeleton.tsx` (primitive), `src/components/shared/Skeleton.tsx` (composite templates: `TableSkeleton`, `StatGridSkeleton`, `DashboardSkeleton`, `FormSkeleton`, `PageHeaderSkeleton`, `PageSkeleton`, `CardSkeleton`, `StatCardSkeleton`, `TableRowSkeleton`)
**Status:** **Primitive deduplicated** (composite templates now build on
the one base `Skeleton`, previously each defined their own). **Not
done:** several routes (Budget, Funds, Income, Expense, Offering,
Reconciliation) still hand-roll their own `Array.from({length:n}).map(...)`
skeleton loops instead of using the existing composite templates above —
this is straightforward follow-up work, not attempted in this rollout.

## Empty State

**Files:** `src/components/ui/empty-state.tsx` (canonical), `src/components/shared/EmptyState.tsx` (deprecated re-export, kept for the 8 existing call sites)
**Status:** **Primitive promoted, not fully rolled out.** 7 of 15
authenticated routes (Income, Expense, Offering, Members, Funds, Budget,
Projects) still have no empty-state handling at all — not a regression,
this rollout didn't add new UI to routes that lacked it, only relocated
the primitive.

## Statistic / Financial Summary Card

**File:** `src/components/shared/StatCard.tsx`
**Status:** Canonical for Dashboard, Reports, Budget. `dashboard/FundsGrid.tsx`
still implements its own fund-balance cards rather than reusing `StatCard`
— not consolidated in this rollout (see Card row above).

**Motion:** entrance animation is Framer Motion (`initial`/`animate`/`transition`,
`duration: 0.25`, `ease: [0.23, 1, 0.32, 1]`) — migrated off GSAP.

## Chart

**File:** `src/components/ui/chart.tsx` (Recharts wrapper)
**Status:** `DashboardGaugeChart.tsx` remains a hand-drawn SVG gauge, not
Recharts — a documented exception (small, self-contained, backed by a
real math utility `lib/gauge-utils.ts`, not duplicated elsewhere; a
Recharts rewrite of its center-text-overlay + gradient arc was judged
disproportionate-risk for a component that already works correctly).

## Navigation (Sidebar / Topbar / Bottom Nav)

**Files:** `src/components/layout/AppSidebar.tsx`, `AppTopbar.tsx`, `BottomNav.tsx`, `AppNav.tsx`
**Status:** Canonical, single nav-data source (`AppNav.tsx`'s `NAV_GROUPS`/`NAV_SYSTEM`/`MOBILE_NAV`) already drove both Sidebar and BottomNav before this rollout — no consolidation needed, only token migration.

## Toast, Alert, Avatar, Calendar

Inherited as-is from shadcn/ui — no duplication found, low change. Toast
uses `sonner`; Alert/Avatar/Calendar are standard Radix-backed primitives.
