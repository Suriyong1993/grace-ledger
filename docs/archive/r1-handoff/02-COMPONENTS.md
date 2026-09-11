# COMPONENTS.md — the `.gl-*` catalogue

> Target path: repo root, `COMPONENTS.md` (new file). Read before writing markup. If the pattern you need is
> here, use it — do not re-implement it inline. If it isn't here, that's a real gap: add the class to
> `src/styles/app.css`, then add its row here in the same change.

## Primitives

| Class | Purpose | Key markup | Variants | Don'ts |
|---|---|---|---|---|
| `.gl-btn` | Button base (44–46px tall, 12px radius) | `<button class="gl-btn gl-btn--primary">` | `--primary` `--secondary` `--ghost` `--destructive` `--sm` `--block` | Never two `--primary` buttons on one screen. Destructive is never `--primary`. |
| `.gl-input` / `.gl-select` / `.gl-textarea` | Form controls | `<input class="gl-input">` inside `.gl-field` | — | Don't set `border-radius`/`height` inline on these — the class owns it. |
| `.gl-field` / `.gl-label` / `.gl-hint` / `.gl-error-text` | Field wrapper | `<div class="gl-field"><label class="gl-label" for="x">…</label><input id="x" class="gl-input"></div>` | — | Always pair a real `<label for>` with its input. |
| `.gl-badge` | Status/tag pill | `<span class="gl-badge gl-badge--pending">รออนุมัติ</span>` | `--neutral` `--pending` `--approved` `--rejected` `--info` | Don't invent a 6th variant — status labels come from the single map in `DESIGN.md`. |
| `.gl-card` | Surface, 16px radius, 1px border | `<div class="gl-card">` | `--tight` (less padding) `--elevated` (one per screen max) `--attention` `--danger` | Never nest a `.gl-card` inside a `.gl-card`. |
| `.gl-notice` | Inline banner | `<div class="gl-notice gl-notice--error" role="alert">` | `--success` `--warning` `--error` | Pair with `<div class="gl-notice__body">`. |
| `.gl-skeleton` | Loading placeholder that preserves layout | `<div class="gl-skeleton" style="height:84px">` | — | Only if the branch is actually reachable (verify `isLoading` is really passed down before using this). |
| `.gl-toast` | Success banner | `<div class="gl-toast"><div class="gl-toast__body">…</div><button class="gl-toast__close">` | — | — |

## Composites

| Class | Purpose | Key markup | Notes |
|---|---|---|---|
| `.gl-page` (+ per-page `-container` variants) | Page frame, one max-width | `<div class="gl-page gl-fade-in">` | `--flush-bottom` removes bottom padding (tab headers). |
| `.gl-page-header` | Title + supporting line + optional action, flex row with border-bottom | `<div class="gl-page-header"><div><h1>…</h1><p>…</p></div></div>` | Collapses to column at ≤768px automatically. |
| `.gl-section` / `.gl-section__head` | Content block with a heading row | `<section class="gl-section"><div class="gl-section__head"><h2>…</h2></div>…</section>` | — |
| `.gl-table` / `.gl-table--cards` | One markup, table ≥900px / stacked cards <900px | `<table class="gl-table gl-table--cards"><td data-label="…">` | Lead cell: `class="gl-td-lead"`. Action cell: `class="gl-td-actions"`. |
| `.gl-statgrid` / `.gl-stat` | 3-number strip (expected/counted/variance) | `<div class="gl-statgrid"><div class="gl-stat gl-stat--danger">` | `--success` `--danger` `--warning`. Collapses to label/value rows ≤768px. |
| `.gl-tablist` / `.gl-tab` | Underline tabs | `<div class="gl-tablist"><button class="gl-tab is-active">` | Not pills — that's an intentional addition documented as such in the original DS readme. |
| `.gl-modal-backdrop` / `.gl-modal-content` | Centered dialog | `<div class="gl-modal-backdrop"><div class="gl-modal-content">` | Solid surface as of D3 — no glass. For anything with more than ~2 fields, prefer a future `.gl-sheet` (R2) once it exists; don't stack more content into a centered modal in the meantime. |
| `.gl-actionbar` / `.gl-actionbar--sticky` | Committing-action row, sticky above bottom nav on mobile | `<div class="gl-actionbar gl-actionbar--sticky">` | Fixed, not sticky, by design — see the code comment explaining why (`#main-content` never becomes a scrollport). |
| `.gl-txn-row` | Clickable list row with hover tint | `<div class="gl-txn-row" role="button" tabindex="0">` | — |

## Shell

| Class | Purpose | Owner |
|---|---|---|
| `.gl-sidebar`, `.gl-nav-item(--active)`, `.gl-shell-mark`, `.gl-shell-avatar`, `.gl-shell-topbar*` | Desktop shell | Base look owned by `AppShell.ts`'s own `<style>` block; `app.css` adds only a few non-conflicting extras (`.gl-sidebar` box-shadow, `.gl-nav-item--active` inset ring, `.gl-shell-topbar` blur/shadow). Do not re-declare `.gl-nav-item` border-radius or min-height in `app.css` again — that caused the dead-CSS issue fixed in R1. |
| `.gl-mobilenav`, `.gl-mobilenav__item`, `.gl-mobilenav__badge` | Bottom nav ≤768px | `app.css` |

## Feedback / route-level patterns (not yet promoted to reusable components — R3 candidates)

- Transaction row markup is currently duplicated between `DashboardPage.ts` and `TransactionsPage.ts`. **Do
  not copy it a third time.** R3 will extract a shared `TxnRow` helper — until then, if you need a third
  instance, flag it rather than pasting.
- Status label/color is currently defined in three places (`approvals/StatusBadge.ts`, `TransactionsPage.ts`'s
  `TXN_STATUS`, and an inline ternary in `DashboardPage.ts`). **Use `DESIGN.md`'s status table as the
  intended single truth**; R3 consolidates the code to match. Do not add a fourth definition.
- Empty-state blocks exist with three different paddings across `TransactionsPage`, `FundsPage`,
  `MembersPage`, `ApprovalsQueueView`. R3 candidate for a shared `EmptyState` helper.

## Utilities

`.gl-visually-hidden`, `.gl-fade-in`, `.gl-spin`, `.gl-loading-center`, `.kicker`, `.filter-pill` (hover state
only — `.filter-pill.is-active` was removed in R1 as dead code; active state is expressed by swapping
`.gl-btn--primary`/`.gl-btn--secondary`, see `TransactionsPage.ts`).
