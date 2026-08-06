# Grace Ledger Premium Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Grace Ledger from light mode to premium dark mode (Balanced Linear/Arc style) with emerald accent, understated luxury, and zero AI slop.

**Architecture:** Update CSS custom properties for dark mode → refactor components to use border-based depth → remove flashy animations → apply emerald accent → migrate page by page.

**Tech Stack:** React 19, TanStack Router, TypeScript, Vite, Tailwind v4, Framer Motion, shadcn/ui, Radix, Lucide React

## Global Constraints

- Dark mode only (light mode preserved but not primary focus)
- Emerald primary: `oklch(0.6 0.15 155)`
- Background slate: `oklch(0.13 0.012 258)`
- No glassmorphism / backdrop-blur (except overlays)
- No NumberTicker animation
- No gradient backgrounds on cards/sections
- Animation ≤ 250ms
- WCAG AA contrast minimum
- Follow existing DESIGN.md as source of truth

---

## Task 1: Dark Mode CSS Tokens

**Files:**

- Modify: `src/styles.css`

**Interfaces:**

- Consumes: Existing `:root` light mode tokens
- Produces: `.dark` class with all new color tokens

- [ ] **Step 1: Add dark mode CSS variables**

Replace the existing `.dark` block in `src/styles.css` with the new dark mode tokens from the spec. Key changes:

- `--background`: `oklch(0.13 0.012 258)` (slate dark)
- `--foreground`: `oklch(0.97 0.004 258)` (off-white)
- `--card`: `oklch(0.16 0.012 258)` (slate, lighter than bg)
- `--primary`: `oklch(0.6 0.15 155)` (emerald)
- `--border`: `oklch(1 0 0 / 10%)` (white-alpha)
- `--sidebar`: `oklch(0.11 0.012 258)` (darker than page bg)

- [ ] **Step 2: Add new surface tokens**

Add to `@theme inline`:

```css
--color-surface-elevated: var(--surface-elevated);
--color-border-subtle: var(--border-subtle);
--color-glow-primary: var(--glow-primary);
```

Add to `.dark`:

```css
--surface-elevated: oklch(0.19 0.012 258);
--border-subtle: oklch(1 0 0 / 6%);
--glow-primary: 0 0 20px -4px oklch(0.6 0.15 155 / 0.2);
```

- [ ] **Step 3: Add dark-specific utilities**

```css
@utility surface-elevated {
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
}

@utility border-subtle {
  border-color: var(--color-border-subtle);
}
```

- [ ] **Step 4: Verify CSS compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/styles.css
git commit -m "feat: add dark mode tokens (emerald accent, slate surfaces)"
```

---

## Task 2: Button Dark Variants

**Files:**

- Modify: `src/components/ui/button.tsx`

**Interfaces:**

- Consumes: Existing button variants
- Produces: Dark mode button styles

- [ ] **Step 1: Update button variants for dark mode**

In `button.tsx`, update the variant styles:

- `default`: `bg-primary text-primary-foreground` (emerald → dark text)
- `secondary`: `bg-secondary text-secondary-foreground border border-border`
- `outline`: `border border-border bg-transparent text-foreground`
- `ghost`: `text-muted-foreground hover:bg-secondary hover:text-foreground`
- `destructive`: `bg-destructive text-destructive-foreground`

- [ ] **Step 2: Verify button renders in dark mode**

Run: `npm run dev` → open in browser with dark class on `<html>`
Expected: Buttons visible with emerald primary, slate secondary

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat: update button variants for dark mode"
```

---

## Task 3: Card Dark Styles

**Files:**

- Modify: `src/components/ui/card.tsx`

**Interfaces:**

- Consumes: Existing card component
- Produces: Dark mode card with border-based depth

- [ ] **Step 1: Update card styles**

```tsx
// Card base
"rounded-card border border-border bg-card text-card-foreground shadow-none";
```

- [ ] **Step 2: Add hover state for interactive cards**

```tsx
// Interactive variant
"hover:border-primary/50 transition-colors duration-150";
```

- [ ] **Step 3: Verify card renders**

Run: `npm run dev` → check dashboard cards
Expected: Cards with slate background, white-alpha border, no shadow

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "feat: update card styles for dark mode (border-based depth)"
```

---

## Task 4: Input Dark Styles

**Files:**

- Modify: `src/components/ui/input.tsx`

**Interfaces:**

- Consumes: Existing input component
- Produces: Dark mode input with emerald focus ring

- [ ] **Step 1: Update input styles**

```tsx
"flex h-11 w-full rounded-input border border-border bg-input px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
```

- [ ] **Step 2: Verify focus ring is emerald**

Run: `npm run dev` → focus on input
Expected: Emerald ring on focus

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/input.tsx
git commit -m "feat: update input styles for dark mode (emerald focus ring)"
```

---

## Task 5: Badge Dark Styles

**Files:**

- Modify: `src/components/ui/badge.tsx`

**Interfaces:**

- Consumes: Existing badge component
- Produces: Dark mode badge with border-based style

- [ ] **Step 1: Update badge variants**

Change from muted background to border-based:

- `default`: `border border-border bg-secondary text-secondary-foreground`
- `secondary`: `border border-border bg-secondary/50 text-secondary-foreground`
- `destructive`: `border border-destructive text-destructive bg-transparent`
- `outline`: `border border-border text-foreground bg-transparent`

- [ ] **Step 2: Verify badges render**

Run: `npm run dev` → check status badges
Expected: Badges with border + text color, no heavy background

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "feat: update badge styles for dark mode (border-based)"
```

---

## Task 6: StatCard Dark Mode + Remove NumberTicker

**Files:**

- Modify: `src/components/shared/StatCard.tsx`

**Interfaces:**

- Consumes: Existing StatCard props
- Produces: Dark mode StatCard without NumberTicker

- [ ] **Step 1: Remove NumberTicker import and usage**

Replace:

```tsx
<NumberTicker value={value} decimalPlaces={decimals} />
```

With:

```tsx
{
  thb(value);
}
```

- [ ] **Step 2: Update StatCard styles for dark mode**

```tsx
// Card base
"group relative flex overflow-hidden rounded-card border border-border bg-card transition-colors duration-150 hover:border-primary/50";

// Accent strip (keep, but emerald)
"w-0.5 shrink-0 bg-primary";

// Value text
"num-display font-display mt-3 text-[28px] md:text-[32px] font-bold leading-none tracking-tight text-foreground";

// Trend badge
"num-display inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold";
// Positive: border-success text-success bg-transparent
// Negative: border-destructive text-destructive bg-transparent
```

- [ ] **Step 3: Verify StatCard renders**

Run: `npm run dev` → check dashboard KPI cards
Expected: Static numbers, emerald accent strip, border-based depth

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/StatCard.tsx
git commit -m "feat: update StatCard for dark mode, remove NumberTicker animation"
```

---

## Task 7: PageHeader Dark Mode

**Files:**

- Modify: `src/components/shared/PageHeader.tsx`

**Interfaces:**

- Consumes: Existing PageHeader props
- Produces: Dark mode PageHeader without gradient

- [ ] **Step 1: Remove gradient line**

Replace:

```tsx
<div className="h-px w-full bg-gradient-to-r from-primary/40 via-border/80 to-transparent" />
```

With:

```tsx
<div className="h-px w-full bg-border" />
```

- [ ] **Step 2: Update kicker style**

Replace gradient bar with simple dot:

```tsx
{
  kicker && (
    <p className="kicker mb-3 flex items-center gap-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
      {kicker}
    </p>
  );
}
```

- [ ] **Step 3: Verify PageHeader renders**

Run: `npm run dev` → check any page header
Expected: Clean header with emerald dot, solid border bottom

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/PageHeader.tsx
git commit -m "feat: update PageHeader for dark mode (remove gradient, add emerald dot)"
```

---

## Task 8: StatusBadge Dark Mode

**Files:**

- Modify: `src/components/shared/StatusBadge.tsx`

**Interfaces:**

- Consumes: Existing StatusBadge props
- Produces: Dark mode StatusBadge with border-based style

- [ ] **Step 1: Update StatusBadge variants**

```tsx
const VARIANTS = {
  paid: "border border-success text-success bg-transparent",
  approved: "border border-success text-success bg-transparent",
  overdue: "border border-warning text-warning bg-transparent",
  pending: "border border-warning text-warning bg-transparent",
  draft: "border border-muted-foreground text-muted-foreground bg-transparent",
  rejected: "border border-destructive text-destructive bg-transparent",
  expense: "border border-destructive text-destructive bg-transparent",
  income: "border border-success text-success bg-transparent",
};
```

- [ ] **Step 2: Verify StatusBadge renders**

Run: `npm run dev` → check status badges in tables
Expected: Border-based badges, clear text, no heavy background

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/StatusBadge.tsx
git commit -m "feat: update StatusBadge for dark mode (border-based)"
```

---

## Task 9: Table Dark Styles

**Files:**

- Modify: `src/components/ui/table.tsx`

**Interfaces:**

- Consumes: Existing table component
- Produces: Dark mode table with alternating rows

- [ ] **Step 1: Update table styles**

```tsx
// Table header
"border-b border-border bg-secondary";

// Table row
"border-b border-subtle transition-colors hover:bg-secondary/50";

// Table head
"h-12 px-5 text-left align-middle text-xs font-medium text-muted-foreground";

// Table cell
"px-5 py-3 align-middle text-sm";
```

- [ ] **Step 2: Verify table renders**

Run: `npm run dev` → check any table
Expected: Slate header, alternating row borders, hover highlight

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/table.tsx
git commit -m "feat: update table styles for dark mode (alternating rows, subtle borders)"
```

---

## Task 10: Sidebar Dark Mode

**Files:**

- Modify: `src/components/layout/AppSidebar.tsx`

**Interfaces:**

- Consumes: Existing sidebar component
- Produces: Dark mode sidebar with emerald active state

- [ ] **Step 1: Update sidebar background**

```tsx
<Sidebar className="border-r border-sidebar-border bg-sidebar">
```

- [ ] **Step 2: Update active item indicator**

```tsx
// Active left border
<span className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-primary" aria-hidden />;

// Active icon bg
("bg-sidebar-accent text-sidebar-accent-foreground");
```

- [ ] **Step 3: Update hover state**

```tsx
// Nav row hover
"hover:bg-secondary hover:text-foreground";
```

- [ ] **Step 4: Verify sidebar renders**

Run: `npm run dev` → check sidebar
Expected: Darker than page bg, emerald active indicator, clean hover

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/AppSidebar.tsx
git commit -m "feat: update sidebar for dark mode (emerald active state)"
```

---

## Task 11: Topbar Dark Mode

**Files:**

- Modify: `src/components/layout/AppTopbar.tsx`

**Interfaces:**

- Consumes: Existing topbar component
- Produces: Dark mode topbar

- [ ] **Step 1: Update topbar styles**

```tsx
"border-b border-border bg-background/80 backdrop-blur-sm";
```

- [ ] **Step 2: Verify topbar renders**

Run: `npm run dev` → check topbar
Expected: Subtle blur, clean border, matches dark theme

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/AppTopbar.tsx
git commit -m "feat: update topbar for dark mode"
```

---

## Task 12: BottomNav Dark Mode

**Files:**

- Modify: `src/components/layout/BottomNav.tsx`

**Interfaces:**

- Consumes: Existing bottom nav component
- Produces: Dark mode mobile nav

- [ ] **Step 1: Update bottom nav styles**

```tsx
"border-t border-border bg-sidebar";
```

- [ ] **Step 2: Update active item**

```tsx
"text-primary"; // emerald for active
```

- [ ] **Step 3: Verify bottom nav renders**

Run: `npm run dev` → check mobile view
Expected: Dark bg, emerald active icon

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/BottomNav.tsx
git commit -m "feat: update bottom nav for dark mode"
```

---

## Task 13: Dashboard Page Dark Mode

**Files:**

- Modify: `src/routes/_app.dashboard.tsx`
- Modify: `src/components/dashboard/FundsGrid.tsx`
- Modify: `src/components/dashboard/RecentTransactionsTable.tsx`
- Modify: `src/components/dashboard/DashboardGaugeChart.tsx`

**Interfaces:**

- Consumes: All dark mode components
- Produces: Fully dark dashboard

- [ ] **Step 1: Update dashboard layout**

Ensure all cards use dark variants, remove any light-specific styles.

- [ ] **Step 2: Update FundsGrid**

```tsx
// Fund card
"rounded-card border border-border bg-card p-4 hover:border-primary/50 transition-colors";
```

- [ ] **Step 3: Update RecentTransactionsTable**

Ensure table uses dark alternating rows, sticky header.

- [ ] **Step 4: Update DashboardGaugeChart**

Change gauge colors to dark-friendly:

- Track: `var(--secondary)`
- Progress: `var(--primary)` (emerald)
- Text: `var(--foreground)`

- [ ] **Step 5: Verify dashboard renders**

Run: `npm run dev` → navigate to `/dashboard`
Expected: All elements in dark mode, no light backgrounds

- [ ] **Step 6: Commit**

```bash
git add src/routes/_app.dashboard.tsx src/components/dashboard/*.tsx
git commit -m "feat: update dashboard for dark mode"
```

---

## Task 14: Income Page Dark Mode

**Files:**

- Modify: `src/routes/_app.income.tsx`

**Interfaces:**

- Consumes: Dark mode components
- Produces: Dark income page

- [ ] **Step 1: Update page layout**

Ensure all cards, tables, forms use dark variants.

- [ ] **Step 2: Update dialog/form styles**

Dialog should use `bg-popover`, `border-border`.

- [ ] **Step 3: Verify income page renders**

Run: `npm run dev` → navigate to `/income`
Expected: Dark table, dark form, emerald primary button

- [ ] **Step 4: Commit**

```bash
git add src/routes/_app.income.tsx
git commit -m "feat: update income page for dark mode"
```

---

## Task 15: Expense Page Dark Mode

**Files:**

- Modify: `src/routes/_app.expense.tsx`

**Interfaces:**

- Consumes: Dark mode components
- Produces: Dark expense page

- [ ] **Step 1: Update page layout**

Same as income page — dark cards, tables, forms.

- [ ] **Step 2: Verify expense page renders**

Run: `npm run dev` → navigate to `/expense`
Expected: Dark theme consistent with income page

- [ ] **Step 3: Commit**

```bash
git add src/routes/_app.expense.tsx
git commit -m "feat: update expense page for dark mode"
```

---

## Task 16: Offering Page Dark Mode

**Files:**

- Modify: `src/routes/_app.offering.tsx`

**Interfaces:**

- Consumes: Dark mode components
- Produces: Dark offering page

- [ ] **Step 1: Update page layout**

- [ ] **Step 2: Verify offering page renders**

Run: `npm run dev` → navigate to `/offering`

- [ ] **Step 3: Commit**

```bash
git add src/routes/_app.offering.tsx
git commit -m "feat: update offering page for dark mode"
```

---

## Task 17: Remaining Pages Dark Mode

**Files:**

- Modify: `src/routes/_app.budget.tsx`
- Modify: `src/routes/_app.funds.tsx`
- Modify: `src/routes/_app.projects.tsx`
- Modify: `src/routes/_app.approvals.tsx`
- Modify: `src/routes/_app.reports.tsx`
- Modify: `src/routes/_app.settings.tsx`
- Modify: `src/routes/_app.members.tsx`
- Modify: `src/routes/_app.profile.tsx`
- Modify: `src/routes/_app.audit.tsx`
- Modify: `src/routes/_app.reconciliation.tsx`
- Modify: `src/routes/_app.line-setup.tsx`

**Interfaces:**

- Consumes: Dark mode components
- Produces: All pages in dark mode

- [ ] **Step 1: Update each page**

For each page:

1. Ensure all cards use `bg-card border-border`
2. Ensure all tables use dark alternating rows
3. Ensure all forms use dark inputs
4. Remove any light-specific styles

- [ ] **Step 2: Verify all pages render**

Run: `npm run dev` → navigate to each page
Expected: Consistent dark theme across all pages

- [ ] **Step 3: Commit**

```bash
git add src/routes/_app.*.tsx
git commit -m "feat: update all remaining pages for dark mode"
```

---

## Task 18: Animation Audit + Polish

**Files:**

- Modify: `src/styles.css`
- Modify: Any component with excessive animation

**Interfaces:**

- Consumes: All components
- Produces: Clean, understated motion

- [ ] **Step 1: Remove all NumberTicker usage**

Search for `NumberTicker` in codebase, replace with static values.

- [ ] **Step 2: Reduce animation durations**

Ensure all animations ≤ 250ms. Remove any bounce/elastic easing.

- [ ] **Step 3: Remove decorative animations**

Remove any `animate-spin`, `animate-bounce` used for decoration.

- [ ] **Step 4: Verify motion is understated**

Run: `npm run dev` → check all interactions
Expected: Quick, purposeful animations. No flashy effects.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: audit and reduce animations for understated luxury"
```

---

## Task 19: Contrast Check + Accessibility

**Files:**

- All modified files

**Interfaces:**

- Consumes: All dark mode styles
- Produces: WCAG AA compliant contrast

- [ ] **Step 1: Check contrast ratios**

Use browser DevTools or a contrast checker to verify:

- Body text vs background: ≥ 4.5:1
- Primary text vs background: ≥ 7:1 (AAA)
- Muted text vs background: ≥ 4.5:1

- [ ] **Step 2: Fix any contrast issues**

Adjust token values if needed.

- [ ] **Step 3: Verify focus states**

Ensure `:focus-visible` rings are visible in dark mode (emerald ring).

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "fix: ensure WCAG AA contrast compliance in dark mode"
```

---

## Task 20: Final Verification + Documentation

**Files:**

- Modify: `DESIGN.md`
- Modify: `src/styles.css` (if needed)

**Interfaces:**

- Consumes: All work
- Produces: Updated docs + final polish

- [ ] **Step 1: Update DESIGN.md**

Add dark mode section to DESIGN.md with the new token values.

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Run type check**

Run: `npm run typecheck`
Expected: No type errors

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: No lint errors

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "docs: update DESIGN.md with dark mode tokens, final verification"
```

---

## Self-Review Checklist

- [ ] All 20 tasks have clear file paths
- [ ] All tasks have verification steps
- [ ] No placeholders (TBD, TODO, etc.)
- [ ] Token values are consistent across tasks
- [ ] Component interfaces are clear
- [ ] Migration order is logical (tokens → components → pages → polish)

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-06-grace-ledger-premium-dark-mode.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
