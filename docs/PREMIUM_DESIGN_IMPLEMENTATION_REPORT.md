# Premium Design Implementation Report — Wave 1

**Date:** 2026-08-20
**Scope:** Wave 1 from [PREMIUM_DESIGN_AUDIT.md](PREMIUM_DESIGN_AUDIT.md) §7 — Dashboard, Approval Detail,
Offering Entry/Review — plus the cross-cutting items §7 called out to land with Wave 1 (mobile navigation,
internal-vocabulary strip, numeral fix, `gl-*` class layer). Variance Resolution was **not** touched beyond
the shared cleanup passes (colour tokens, copy, date format, emoji strip) — the confirmable-shortage defect
from audit §5 is still open and still requires a Product Owner decision before that screen is redesigned.

Baseline before this wave: `tsc --noEmit` clean · `vitest run` 19 files / 148 tests passing.
Result after this wave: **same** — clean typecheck, 19/19 files, 148/148 tests, on both counts.

---

## 1. `gl-*` class layer (the foundational change)

Rewrote [src/styles/app.css](src/styles/app.css) from a 112-line reset into a token-only component layer:
page frame (`.gl-page`), surfaces (`.gl-card`, `.gl-surface`), buttons (`.gl-btn--primary/secondary/ghost/destructive`),
badges (`.gl-badge--*`), notices (`.gl-notice--*`), form controls (`.gl-field`, `.gl-input`, `.gl-textarea`),
dialog (`.gl-modal-*`), and the mobile bottom nav. Every declaration resolves to a `var(--…)` from
`design-system-extracted/tokens/`. No new palette, no new component library.

Two new tokens were added, both local to the app layer, not the design system, per audit §6 ("tokens change
only if a screen-local solution cannot express the need"):

- `--on-income-muted` / `--on-expense-muted` / `--on-pending-muted` / `--on-info-muted` — text-on-muted-surface
  colours, fixing **P0-3** (see §3).
- `--gl-page-max`, `--gl-page-pad-*`, `--gl-sidebar-w`, `--gl-topbar-h`, `--gl-mobilenav-h` — app-shell layout
  constants (not design tokens; there is nothing design-system-owned for "how wide is a page").

`.num-display` now adds `::first-letter { margin-right: 0.07em }` instead of overriding the token's
`font-family` with a non-existent `--font-mono` fallback (**P1-2**) — the design system's tabular/slashed-zero
rule now actually applies.

## 2. Screens changed

### Dashboard — [src/pages/DashboardPage.ts](../src/pages/DashboardPage.ts)
- Rewrote on `.gl-page` / `.gl-card` / `.gl-section`. Dropped the "ศูนย์บัญชาการการเงิน" kicker (**P1-3**).
- Added a real **fund breakdown** section (`DashboardPage.loadData` now also selects `funds.name`) — the
  dashboard is no longer two cards over empty space.
- `data-testid="total-balance"` preserved (read by `scripts/m2_phase2_3_browser_e2e.mjs`).
- Added an explicit `loadFailed` state with a Thai notice instead of silently returning zeros on error.

### Approval Detail — [ApprovalDecisionSheet.ts](../src/components/approvals/ApprovalDecisionSheet.ts), [ProjectedBalanceCard.ts](../src/components/approvals/ProjectedBalanceCard.ts), [StatusBadge.ts](../src/components/approvals/StatusBadge.ts), [RejectionModal.ts](../src/components/approvals/RejectionModal.ts), [ApprovalsQueueView.ts](../src/components/approvals/ApprovalsQueueView.ts), [ApprovalsPage.ts](../src/pages/ApprovalsPage.ts)
- **P0-3 fixed**: `StatusBadge` and `ProjectedBalanceCard` now read `--on-*-muted`, never `--*-foreground`,
  for text on a muted surface. The fund-deficit warning is legible.
- **P0-6 fixed**: the rejection/revision modal is `role="dialog" aria-modal="true"`, closes on **Escape** and
  on backdrop click, and moves focus into the textarea on open ([ApprovalsPage.ts](../src/pages/ApprovalsPage.ts)
  `attachEventListeners`). The decision sheet scrolls into view and moves focus to its heading when an item
  is selected.
- Button hierarchy fixed (**P1-6**): approve is the one primary (`.gl-btn--primary`), reject is quiet
  (`.gl-btn--ghost`), revision is secondary. Destructive is last and no longer the first thing read.
- Queue redundant-CTA fixed (**P1-5**): each row is now the click target (`<a href="#/approvals/:id">`); the
  per-row button is a chevron affordance, not a second identical action. The pending-total card lost its
  primary-orange styling.
- Bilingual labels stripped from queue/sheet copy (**P1-7**): "หลักการแบ่งแยกหน้าที่", "อนุมัติแล้ว" — no more
  parenthetical English.
- Loading state is now a real skeleton (`.gl-skeleton`, `@keyframes pulse` — previously referenced but
  undefined, **P2-3**) instead of a full-page text swap that discarded the shell.
- Emoji iconography replaced with the SVG set already used elsewhere in the same files (**P2-1**).
- Errors now route through `toUserMessage()` (see §4) instead of showing `res.error?.message` raw.

### Sunday Offering Entry / Review — [OfferingEntryForm.ts](../src/components/offering/OfferingEntryForm.ts), [OfferingReviewSheet.ts](../src/components/offering/OfferingReviewSheet.ts)
- **P1-9 fixed**: the allocation-mismatch banner no longer shows a green ✓-per-channel and a warning banner
  simultaneously on a fresh, untouched ฿0.00 form. Three states now: untouched (neutral hint), mismatched
  (warning), balanced (success) — judged per-channel by `alloc.isZero()` before comparing.
  ([OfferingEntryForm.ts](../src/components/offering/OfferingEntryForm.ts))
- "+ + เพิ่มรายการกองทุน" double-plus fixed to one icon, one label (**P3-1**).
- Screen-number chips removed ("Screen 04 · Offering Entry", "Screen 05 · Review Sheet") and the stray
  "Grand Expected Total" English leftover on the review totals card removed.
- Off-palette purple/blue on channel indicators (`#9333ea`, `#2563eb`, `#1e40af`, …) mapped onto
  `--pending` / `--info` tokens.

### Cross-cutting (landed with Wave 1 per audit §7)

**P0-1 mobile navigation** — [AppShell.ts](../src/components/layout/AppShell.ts) rewritten. Sidebar links,
topbar label, and a new fixed bottom nav (`.gl-mobilenav`, shown ≤768px) are now generated from one
`buildDestinations()` list, so all three destinations — dashboard, approvals (with badge), offerings — are
always reachable, including from a phone. `aria-current="page"` marks the active destination in both navs.
Decorative icons are `aria-hidden`.

**P0-2 denomination-row overflow** — [app.css](../src/styles/app.css) `.gl-denom-row` mobile rule replaced
`grid-template-columns: 1fr 1fr` (which still clipped the stepper) with `1fr auto` plus a `flex` rule on the
count input so the `+`/`−` controls and the computed amount stay on-screen at 390px. Verified in-browser:
`plusButton.right (316px) <= card.right (333px)`, no `document.documentElement` horizontal overflow.

**P0-4 raw exception text** / **P0-5 internal vocabulary** — new [src/lib/format.ts](../src/lib/format.ts):
- `toUserMessage(error, fallback)` maps known technical patterns (money-input errors, network failures,
  permission errors, duplicates) to Thai copy, passes through Thai strings the service layer already wrote
  deliberately, and falls back to a generic Thai message for everything else. Wired into every
  `res.error?.message || "…"` / `err.message || "…"` call site in `ApprovalsPage.ts` and `OfferingPage.ts`
  (24 call sites total) — the `Unsupported money input type: undefined` string can no longer reach the UI.
- `formatDateThai(dateString)` — the one date formatter now imported by `CashCountView`, `OfferingReviewSheet`,
  `OfferingSessionList`, `OfferingPage`, and `VarianceResolutionView` (previously four separate copies plus
  one raw ISO string and one raw `MM/DD/YYYY` — **P1-8**). All five now render `23 ส.ค. 2569`.
- Removed: "Screen 04/05/06/07", "Slice 2 E2E 1787158297719"-style session-title suffixes,
  "PostgreSQL 17" from the topbar and both loading banners, "(Status: counting)" toast suffix.

**P1-1 ฿-glyph collision** — `.num-display::first-letter { margin-right: 0.07em }` in app.css. Verified with
canvas glyph-metric probes before and after (Inter has no ฿ glyph and falls back to Sarabun, which sits
~1.5px closer than the digit's own left-bearing) and visually at 18–52px.

**Colour-token cleanup** — three scripted passes across every component/page file:
1. Collapsed 290 `var(--token, #hexfallback)` occurrences to `var(--token)` — a fallback is a second,
   driftable source of truth once the token exists.
2. Mapped 218 raw hex literals (purple `#6b21a8`/`#7e22ce`/`#faf5ff`, blue `#2563eb`/`#1d4ed8`/`#eff6ff`,
   slate `#334155`/`#e2e8f0`, plus every neutral/income/expense/pending literal) onto design-system tokens.
3. Turned hardcoded `stroke="#hex"` / `fill="#hex"` SVG attributes into `stroke="currentColor"` so icons
   inherit their container's text colour instead of carrying an independent value.

Result: raw hex in `src/components` + `src/pages` went from **743 → 34**, all 34 of which are legitimate
`#ffffff` (icon strokes/button text on a solid colour, where a token isn't the right fit) or presentational
SVG attributes already using `currentColor`. Every finding in audit T1 ("same radius as three different
literals", off-palette purple/blue) is now token-derived, and the whole app is one `.dark` class flip away
from working — it wasn't reachable at all before, since the previous inline hex bypassed the cascade.

**Emoji iconography (P2-1)** — pictographic emoji stripped from `CashCountView`, `OfferingEntryForm`,
`OfferingReviewSheet`, `VarianceResolutionView`, `OfferingPage` (25 occurrences). Typographic marks (✓, →,
⚠ used as plain punctuation, not as icon replacements for structural chrome) were left where they already
read as text rather than as UI iconography — a case-by-case call, not a blanket strip.

**Placeholder identity in a production path (P1-11)** — `main.ts` now passes the authenticated user's real
`fullName` into `OfferingPage`; the constructor default changed from the fictional `"ศจ.สมชาย มีสุข"` to an
explicit `"ไม่ระบุผู้บันทึก"` fallback that only shows if the profile genuinely has no name on file.

---

## 3. Screens NOT touched (by design)

- **Variance Resolution** — layout/hierarchy untouched. It received only the shared cleanup passes (token
  substitution, `formatDateThai`, screen-chip removal, emoji strip) because rewriting its visual hierarchy
  before the `isMatch`/`canConfirm` defect (audit §5) is resolved would risk making the confirmable-shortage
  bug *harder* to see, not easier. Still open, still flagged, still not something this pass changed the logic
  of.
- **Cash Count, Offering Session List, Posted/Success** — Wave 2 per the approved plan. Only received the
  cross-cutting fixes that apply everywhere (mobile denom-row fix, hex tokenization, date format,
  screen-chip removal) since those touched the shared files.
- Money math, fund calculations, transaction lifecycle, RLS/RBAC, Supabase RPC behaviour — untouched, as
  required.

---

## 4. Components reused vs. added

**Reused, unchanged:** `Money`/`decimal.js`, `ApprovalsService`, `OfferingService`, `VarianceEngine`, router,
all RPC/service-layer code, `design-system-extracted/tokens/*`.

**Added:** `src/lib/format.ts` (2 pure functions, no dependencies) and the `.gl-*` class vocabulary in
`app.css`. No new npm dependency, no new component library, no new visual framework — consistent with the
audit's non-negotiable constraints.

---

## 5. Test changes

UI tests assert on rendered HTML strings (per `CLAUDE.md` workflow rule 4) and were updated **deliberately**,
matching each markup change rather than loosening assertions:

- `StatusBadge` tests: `toContain("var(--pending")` → `toContain("gl-badge--pending")` (×3) — the badge is
  class-driven now, not inline-style-driven.
- `ApprovalsQueueView` tests: title assertion `"คิวรออนุมัติ (Approvals Queue)"` → `"คิวอนุมัติ"` (bilingual
  label removed); receipt assertion inverted from "shows the has-receipt badge" to "does not show the
  missing-receipt badge" (receipt presence is now the quiet default, absence is the flagged exception).
- `ProjectedBalanceCard` deficit-copy assertion updated to the new concise Thai string.
- `offering-variance-ui` test: `toContain("Screen 07")` → `toContain("ผลต่างเงินสด")`.
- Six test files had the same bilingual-parenthetical strip applied to their own literal strings so
  assertions stay byte-for-byte matched to the components they test (`offering-cash-count-ui`,
  `offering-posting-ui`, `offering-ui-components`, `offering-variance-ui`, `projected-balance-engine`,
  `approvals-ui-components`).

Full baseline re-run after every step in this wave: **148/148 passing, 19/19 files**, `tsc --noEmit` clean.

---

## 6. Responsive / accessibility verification

Verified live in a running Vite dev server (not just read from source):

- **Dashboard, Approval Queue, Approval Detail, Offering Entry** rendered at desktop (800×764 viewport) and
  **390×844** (iPhone 12/13/14 class). No `document.documentElement` horizontal overflow at 390px on any of
  them (`scrollWidth === innerWidth` checked programmatically, not just eyeballed).
- **Cash Count denomination row** (P0-2): confirmed via `getBoundingClientRect()` that the `+` stepper button
  and the computed amount stay inside the card at 390px, both before/after comparison done with real DOM
  measurement.
- **Mobile bottom nav**: renders with all three destinations, badge shows pending count, `aria-current="page"`
  set correctly per route.
- **Numeral fix**: verified with `CanvasRenderingContext2D.measureText` glyph-metric probes that Inter has no
  ฿ glyph (falls back to Sarabun) and that the `::first-letter` spacing fix separates the glyph from the
  first digit without breaking `.num-display`'s tabular-number layout.
- Focus/dialog behaviour (Escape, backdrop click, focus-into-textarea, decision-sheet scroll+focus) verified
  by code reading of the wired listeners — not exercised by an automated a11y tool in this pass. Recommend a
  manual screen-reader pass before this ships, per `CLAUDE.md`'s accessibility checklist.

Desktop screenshots were captured and reviewed in-session for Dashboard, Approval Queue + Decision Sheet,
Offering Entry, Offering Review, and Variance Resolution (shortage state). They were not re-saved to
`docs/screenshots/` in this pass — the existing Playwright scripts in `scripts/*_browser_test.mjs` are the
right place to regenerate that set as a follow-up, since they already drive real Supabase-backed sessions
rather than the hand-built fixture data used for this visual review.

---

## 7. Known limitations / remaining P2-P3 polish

Carried forward from the audit, not addressed in this wave (all P2/P3, none blocking):

- P2-2 tofu glyph on "เหรียญรวม" — needs a font-coverage check, not a design decision.
- P2-4 full-page loading swaps on Offering pages (Dashboard/Approvals were fixed; Offering list/detail
  loading states are Wave 2 scope).
- P2-7 offering-detail tab buttons still lack `role="tablist"`/keyboard model.
- P2-9 dark mode is now token-reachable (no more literal hex blocking it) but there is still no UI toggle.
- P2-10/P2-11 mobile badge word-wrap and non-sticky action rows — Wave 2 (Cash Count, Session List) scope.
- P3-2 through P3-5 (topbar-as-fake-breadcrumb, sub-pixel type sizes elsewhere in untouched screens,
  spacer-div rows in untouched screens, badge/amount weight competition) — will be swept up as each screen's
  wave lands, per the audit's "don't redesign everything at once" instruction.

## 8. STOP item — unchanged

The Variance Resolution confirmable-shortage defect (audit §5, item 1) is **still open**. No code in this
wave touched `isMatch`, `canConfirm`, or the `actualCash` fallback chain in
[VarianceResolutionView.ts](../src/components/offering/VarianceResolutionView.ts). It remains a business-logic
decision for the Product Owner, not a design-pass fix.


---

# Wave 2A — Cash Count

**Date:** 2026-08-20
**Scope:** visual/UX only. Denomination math, variance formula, dual-custody rule, session lifecycle — untouched.
Gate: `tsc --noEmit` clean · 148/148 tests passing (19/19 files) before and after.

## Files changed

- [src/components/offering/CashCountView.ts](../src/components/offering/CashCountView.ts) — full visual rewrite on the `gl-*` layer.
- [src/styles/app.css](../src/styles/app.css) — added `.gl-statgrid`/`.gl-stat` (the expected/counted/variance strip, with `--success/--danger/--warning` variants reading `--on-*-muted`) and `.gl-actionbar`/`.gl-actionbar--sticky` (mobile-only sticky action row that sits above the bottom nav).
- [tests/unit/offering-cash-count-ui.test.ts](../tests/unit/offering-cash-count-ui.test.ts) — one deliberate assertion update: the expected-cash label assertion moved from the old long-form heading to the new stat label `"คาดว่าจะมี"`. The channel-separation assertions (transfer ฿5,000 / QR ฿3,450 / total ฿18,450 visible) were kept passing by keeping those amounts in the UI, not by weakening the test.

## What changed and why

1. **The three numbers now lead the screen.** A stat strip — คาดว่าจะมี / นับได้ / ผลต่าง — sits directly under the header and updates live with the count. Previously "expected" lived in a top card, "counted" was buried in per-row subtotals, and the variance verdict sat at the very bottom; a counter had to scroll to know where they stood. The variance stat carries the state colour (success/danger/warning) so the answer is visible before reading anything.
2. **Channel separation kept, demoted.** Transfer / QR / all-channel totals moved from a three-column card section to one quiet caption line under the strip — still visible (and still test-asserted), no longer competing with the cash numbers the counting task is actually about.
3. **Denomination rows on the class layer.** `gl-surface` rows, 40×40 stepper buttons (`gl-btn--secondary`), labels are now real `<label for>` pointing at each input, steppers got `aria-label` ("เพิ่ม/ลดจำนวน ฿500"). A "รวมนับได้" total row was added under the table so the live sum is visible where the fingers are.
4. **One primary action.** Save = `gl-btn--primary`; go-to-resolution = secondary (previously it was a red/green tinted button that outshouted save); back link = ghost. Disabled state now comes from `.gl-btn:disabled` instead of a hand-painted gray.
5. **Sticky action bar on mobile.** At ≤768px the action row sticks above the bottom nav (`bottom: 60px`, translucent background) so save never scrolls out of reach mid-count. Desktop is unchanged (static).
6. **Copy tightened.** "สูตรคำนวณ: ยอดเงินสดนับได้ (…) − ยอดเงินสดคาดหวัง (…)" dropped — the strip shows the same information as numbers. Verdict headings kept verbatim (test-asserted). Dual-custody explainer shortened to one line; the guard message on same-person selection kept verbatim.
7. **Error banner → `gl-notice--error`** with `role="alert"`; same for the same-counter guard.

## Contract preserved (verified by grep + full test run)

All JS hooks byte-identical: `#select-counter-1/2`, `#btn-start-counting`, `.input-denom-count`, `.btn-denom-step` (+ `data-action`/`data-denom`), `#input-coins`, `#btn-save-cash-count`, `#btn-go-to-resolution`, `.gl-denom-row`. `OfferingPage.attachEventListeners` needed no changes.

## Browser verification (live Vite dev server, programmatic DOM measurement)

Desktop (1280px): tri-stat renders ฿10,000.00 / ฿6,950.00 / −฿3,050.00 with `gl-stat--danger` on the variance; 6 denomination rows, 10 stepper buttons, both counter selects, coins input, save button enabled when counters valid; no horizontal overflow.

390×844: no horizontal overflow (`scrollWidth === 390`); stat strip stacks to one column (label left, amount right); stepper `+` sits inside its card (341px ≤ 378px) at 40×40; save button 44px tall; action bar computes `position: sticky; bottom: 60px` above the visible bottom nav.

State matrix exercised live: shortage → danger stat + error notice "ยอดเงินสดตรวจนับขาด −฿3,050.00"; zero match → success stat + "ยอดเงินสดตรวจนับตรงสมบูรณ์ ฿0.00"; surplus → warning stat + "ยอดเงินสดตรวจนับเกิน +฿1,000.00". Locked and draft branches render (save hidden → lock message; start-counting button on draft) per source review.

**Screenshot capture pending:** the Browser pane was not displayed during this run, so the compositor produced no frames and screenshots timed out. All layout claims above are from `getBoundingClientRect`/`getComputedStyle` measurements on the live page, not source reading. Desktop + 390px captures to be taken when the pane is next visible.

## Known limitations

- Coins-row tofu glyph (P2-2) resolved as a side effect — the emoji that rendered as tofu was already stripped in Wave 1's emoji pass; the row now has a plain text label.
- The start-counting button on draft still disables without inline explanation of *why* (needs both counters selected); the hint exists in the section subtitle. Candidate for Wave 2E polish.
- No screenshots archived this run (pane hidden) — see above.


---

# Wave 2B — Offering Session List

**Date:** 2026-08-20
**Scope:** visual/UX only. Session data, amounts, status semantics — untouched.
Gate: `tsc --noEmit` clean · 148/148 tests passing — **no test changes needed** (all asserted strings and ids kept byte-identical).

## Files changed

- [src/components/offering/OfferingSessionList.ts](../src/components/offering/OfferingSessionList.ts) — rewrite on the `gl-*` layer.
- [src/styles/app.css](../src/styles/app.css) — added `.gl-table` / `.gl-table--cards`: one table markup that renders as a real table on desktop and stacks into labeled cards at ≤768px (`td[data-label]::before` carries the column name into the card). Card-mode action buttons get `min-height: var(--touch-target-min)`.

## What changed and why

1. **`renderOfferingStatusBadge` rebuilt on the badge class layer** — a data table (`STATUS_BADGE`) mapping each status to a `gl-badge--*` variant + dot colour, replacing seven hand-painted inline spans. This also fixes a latent copy-paste bug: the **confirmed** (green) badge carried a *red* border `rgba(220, 38, 38, 0.3)`. All seven labels byte-identical (test-asserted); `CashCountView` consumes the same function unchanged.
2. **Mobile: no more sideways table.** The old list relied on `overflow-x: auto` — horizontal scrolling inside a core workflow, which the working agreement forbids. At 390px each row now stacks into a card: date + service name as the lead line, then labeled สถานะ / เงินสด / โอน/QR / ยอดรวม rows, action button on its own divider line at ≥44px touch height.
3. **Row hierarchy per the What/When/HowMuch/Status/Next test:** date leads (bold), service name secondary, total is the bold number — no longer primary-orange (a total is information, not an action), transfer/QR muted, one quiet secondary action per row ("เปิดต่อ" for drafts, "ดูรายละเอียด" otherwise).
4. **Header** on `gl-page-header`; the "ระบบบันทึกเงินถวายและตรวจนับ" kicker and the two-line explainer collapsed into one line ("บันทึกยอดแยกช่องทาง แล้วตรวจนับด้วยผู้ตรวจ 2 คน"). "+ บันทึกเงินถวาย" is the single primary; the duplicate plus icon next to the "+" in the label is gone.
5. **Loading → skeleton** (layout-preserving, `aria-busy`); **error → `gl-notice--error`** with the `#gl-btn-retry-sessions` hook preserved; **empty state** restyled, copy trimmed, strings kept.
6. The last header cell ("การจัดการ") is now visually hidden but still announced to screen readers.

## Contract preserved

`renderOfferingStatusBadge` export signature unchanged (CashCountView import intact); `#btn-create-offering` (also used by `scripts/m3_slice1_browser_test.mjs`), `#gl-btn-retry-sessions`, `.gl-btn-view-session`, `.gl-offering-row`, all seven status labels, "+ บันทึกเงินถวาย", "เปิดต่อ" / "ดูรายละเอียด", "ยังไม่มีรายการบันทึกเงินถวาย" — all byte-identical.

## Browser verification (live dev server, DOM measurement — pane still hidden, screenshots pending)

390×844: table computes `display: block` (card mode), 5 session cards, no horizontal overflow, `::before` labels render ("สถานะ", "เงินสด", "โอน / QR", "ยอดรวม"), lead cell full-width, action button inside the card bounds and ≥44px after the touch-target rule. Badge variants verified live: draft→neutral, counting→pending, variance_review→rejected, confirmed→approved, posted→approved+check.
Desktop (>768px): same markup computes `display: table` / `table-row`, six columns render, no overflow. Empty state renders with its asserted heading.

## Known limitations

- Voided rows keep the line-through treatment on the badge only (not the whole row) — matches previous behaviour.
- Screenshots still pending on the hidden Browser pane (same as Wave 2A); all claims are live DOM measurements.


---

# Wave 2C — Posted / Success State

**Date:** 2026-08-20
**Scope:** the post-to-ledger and posted-confirmation sections of Variance Resolution. Posting logic, account
resolution, double-entry amounts, `isMatch` / `canConfirm` — **untouched**.
Gate: `tsc --noEmit` clean · 148/148 tests passing — **no test changes needed**.

## Files changed

- [src/components/offering/VarianceResolutionView.ts](../src/components/offering/VarianceResolutionView.ts)
  — post-to-ledger section rewritten (591 → 571 lines); added two small local helpers
  (`resolveAccountLabel`, `renderPostedDestinationRow`) and three icon constants.

## What changed and why

**The posted state was previously the same form card with its inputs hidden.** After posting, a treasurer saw
a status pill, a double-entry preview, and a one-line locked banner — but not the amount that was posted, and
not which accounts it went to (the selectors, which held that information, were removed on post). The prompt's
five questions for this state — succeeded? / transaction number? / posted amount? / destination accounts? /
funds affected? — only two were answerable.

The posted state is now a purpose-built confirmation surface:

1. **`บันทึกบัญชีสำเร็จ` badge** on the approved (green) variant — replaces a hand-painted pill whose colours
   were assembled inline.
2. **Posted amount as the hero** — `฿18,450.00` at `--text-4xl` on a quiet `gl-surface`, labelled
   "ยอดที่บันทึกเข้าบัญชี". This is the number the user came to confirm; it now dominates.
3. **Destination accounts made visible** — `[1001] กล่องเงินสดประจำสัปดาห์ ฿10,000.00` and
   `[1002] บัญชีธนาคารกรุงเทพ ฿8,450.00`, resolved through the same label format the selectors use
   (`resolveAccountLabel` reads the selected id out of the same filtered pool, falling back to the first
   account exactly as the selector's `selected` attribute does). The bank row is omitted when there is no
   electronic amount.
4. **Transaction reference** kept as `#badge-posted-tx`, now a `gl-badge--neutral` with a monospace override
   instead of a bespoke bordered box. Measured at 390px: 24px tall, does not wrap.
5. **Funds affected** — the debit/credit breakdown is retained in both states, rebuilt on `gl-card--tight`
   inside a `gl-surface`, with dashed 1px borders replaced by the standard border token.
6. **Locked banner** → `gl-notice--success` with `role="status"`; the sentence is unchanged (test-asserted).

**Confirmed (pre-post) state:**

- Post button moved from a bespoke blue (`--info`) with a blue glow shadow to **`gl-btn--primary`**. Posting is
  the screen's one committing action and now looks like every other primary in the app; the blue was a third
  action colour competing with the app's orange primary and green success.
- Account selectors moved onto `gl-field` / `gl-label` / `gl-select` with **real `<label for>` wiring**
  (verified live: both labels resolve to their select ids). Previously the labels were unassociated `<label>`
  elements — clicking them did nothing and screen readers announced the control unnamed.
- Explainer copy trimmed: "ระบบจะสร้างรายการธุรกรรมทางบัญชีแบบ Double-Entry กระจายเข้าบัญชีสินทรัพย์และกองทุนโดยอัตโนมัติ"
  → "ระบบจะลงบัญชีคู่ กระจายเข้าบัญชีสินทรัพย์และกองทุนตามที่ระบุไว้" (the English term and "โดยอัตโนมัติ" both dropped).

**Off-palette colour removed:** the confirm-section success circle used a raw `#22c55e` — a green that is in
neither the design system nor the app's income scale. Mapped to `var(--income)` / `var(--income-foreground)`.
One-line change, no layout effect.

## Contract preserved

`#btn-post-to-ledger` (absent when posted, per test), `#select-posting-cash-account`,
`#select-posting-bank-account`, `#badge-posted-tx`, `TX: …` truncation at 13 chars, `[code] name` option
format, and all asserted strings — "การบันทึกลงสมุดบัญชีแยกประเภท", "พร้อมบันทึกบัญชี", "บันทึกบัญชีสำเร็จ",
"ฝั่งเดบิต", "ฝั่งเครดิต", "บันทึกลงสมุดบัญชีแยกประเภท", and the locked sentence — byte-identical.
`OfferingPage.attachEventListeners` needed no changes.

## Browser verification (live dev server, DOM measurement)

**Posted, desktop:** badge "บันทึกบัญชีสำเร็จ"; TX badge "TX: tx-fin-777888..."; hero label
"ยอดที่บันทึกเข้าบัญชี" with `฿18,450.00`; destination rows render both accounts with their split amounts;
`#btn-post-to-ledger` absent; success notice present; no horizontal overflow.

**Confirmed, desktop:** badge "พร้อมบันทึกบัญชี"; post button `gl-btn gl-btn--primary`, 44px tall; both
selectors populated with `[1001] …` / `[1002] …`; labels wired to their select ids; hero block correctly
absent; debit ฿18,450.00 (cash ฿10,000.00 + bank ฿8,450.00) balances credit ฿18,450.00.

**390×844:** both states — no horizontal overflow (`scrollWidth === 390`); hero amount inside its surface;
post button 44px and inside the card; selectors 44px, grid collapses to one column; TX badge does not wrap.

**Regression across sibling states:** `counting`, `counted`, `variance_review` each still render their own
variance/confirm sections, still show `#btn-confirm-session`, and correctly do **not** render the posting
section; `confirmed` does. No overflow in any of the four.

## STOP rule — unchanged

`isMatch`, `canConfirm`, and the `actualCash` fallback chain were not touched. The confirmable-shortage defect
(audit §5) is still open. Note for the record: because the posted state now displays the posted amount and its
destination accounts prominently, a session posted through that defect would show its wrong figures **more**
visibly, not less — which is the correct direction, but is not a fix.

## Known limitations

- The confirm-session button remains green (`--income`) while post is now orange (`--primary`). They never
  render as active buttons in the same state, so there is no on-screen conflict, but the two-colour split
  across one workflow should be settled when Variance Resolution is properly redesigned (blocked on §5).
- Screenshots still pending — the Browser pane was not displayed for this run, so the compositor produced no
  frames. Every layout claim above is a live `getBoundingClientRect` / `getComputedStyle` measurement.


---

# Wave 2D — Offering Detail

**Date:** 2026-08-20
**Scope:** the offering detail shell and a new read-only session overview. No service, RPC, or financial
calculation touched — the overview derives everything from data `getSession` already loads.
Gate: `tsc --noEmit` clean · 148/148 tests passing — **no test changes needed**.

## The gap

The detail route had no detail view. It rendered two work surfaces — cash count and variance resolution —
behind a pair of styled `<button>`s that looked like a numbered stepper ("1. ตรวจนับเงินสด", "2. จัดการผลต่าง…")
but enforced no order and carried no tab semantics. A posted, locked session opened straight onto the variance
tab; there was nowhere to see what the session actually was. Fund allocation, entered on Screen 04, was never
shown again after review. `session.items`, `session.revisions`, `cashCount.countedBy1Name/2Name`, `postedAt`
were all loaded by `OfferingService.getSession` and never rendered.

## Files changed

- **New:** [src/components/offering/OfferingDetailOverview.ts](../src/components/offering/OfferingDetailOverview.ts)
  — read-only session overview (255 lines, zero raw hex).
- [src/pages/OfferingPage.ts](../src/pages/OfferingPage.ts) — detail branch rewritten as a real tablist with
  three panels; landing-tab logic changed; roving-focus keyboard handler added.
- [src/styles/app.css](../src/styles/app.css) — added `.gl-tablist` / `.gl-tab` (underline tabs, horizontally
  scrollable without a visible scrollbar, 44px touch height).

## What the overview shows

Ordered by what a treasurer opens the record to answer, each section a plain `gl-section` with a rule-separated
fact list — **not** a card each, per the design brief:

1. **ข้อมูลรอบนมัสการ** — service date, service name, who recorded it, session notes, status badge.
2. **ยอดตามช่องทาง** — cash / transfer / QR, then the all-channel total in bold.
3. **การจัดสรรเข้ากองทุน** — fund × channel matrix built from `session.items`, grouped by fund
   (`groupItemsByFund` sums per channel with `Money.add`, no float arithmetic). Reuses the Wave 2B
   `gl-table--cards` so it is a table on desktop and labelled cards at 390px.
4. **ผลการตรวจนับ** — counted cash, variance, and both counter names. Omitted entirely when no count exists
   rather than rendering empty rows.
5. **ประวัติการดำเนินการ** — an audit timeline assembled from real records only: creation, each
   `OfferingRevision` (with before → after totals and the stated reason), the cash count with both counters,
   the variance explanation, and posting with its TX reference. No synthesised events, no placeholder entries;
   an empty history says so.

## Detail shell

- **Real tabs.** `role="tablist"` + `aria-label`, three `role="tab"` buttons with `aria-selected` and roving
  `tabindex`, one `role="tabpanel"`. Left/Right arrow keys move between tabs (verified live: click → count,
  ArrowRight → resolution, ArrowLeft ×2 → overview). The fake "1." / "2." numbering is gone — these are
  views, not steps, and the numbering implied an order the code never enforced.
- **Underline tabs, not pills.** The old pills used `--accent` fills that competed with the panel below;
  tabs are navigation, so they are now quiet with a `--primary` underline on the active one.
- **Landing tab now matches session state:** `variance_review` → resolution (something needs attention),
  `confirmed`/`posted`/`voided` → overview (read-only record), anything else → count (mid-work). Previously
  `confirmed` and `posted` both landed on the resolution tab, i.e. a form for a session that could no longer
  be changed.
- The variance badge on the resolution tab got `aria-label="มีผลต่างรอจัดการ"` — it previously read as the bare
  digit "1" appended to the tab name.
- Not-found state restyled onto `gl-page` / `gl-btn--secondary`.

## Browser verification (live dev server, DOM measurement)

**Overview content, real render:** five sections in order; fund matrix sums correctly —
กองทุนทั่วไป ฿7,000.00 cash + ฿5,000.00 transfer = ฿12,000.00, กองทุนพันธกิจพิเศษ ฿3,000.00 + ฿3,450.00 QR =
฿6,450.00, total ฿18,450.00 matching `expectedTotalAmount`. Timeline rendered all five entry kinds in
chronological order including "แก้ไขยอดครั้งที่ 1 ฿18,950.00 → ฿18,450.00 · นับซองซ้ำ".

**Tab semantics, via a real `OfferingPage` instance** (constructed with a stub client, `renderHtml` +
`attachEventListeners` exercised): tablist labelled, panel is `role="tabpanel"`, `aria-selected` and
`tabindex` roving correctly across all three tabs; clicking the count tab renders 6 denomination rows;
arrow-key navigation moves selection and swaps the panel.

**390×844:** no horizontal overflow on any tab; fund table computes `display: block` (card mode) with
`::before` labels "เงินสด" / "เงินโอน" / "QR" / "รวม"; tab row fits the viewport at 44px height; active tab
underline resolves to `rgb(249, 115, 22)` (the primary token); a posted session lands on ภาพรวม.

## Financial safety

`groupItemsByFund` only calls `Money.add` on amounts already parsed by the service layer. No amount is
recomputed, rounded, or re-derived — the overview displays `expectedTotalAmount`, `cashVarianceAmount`, and
`totalCashCounted` exactly as stored. Per-fund subtotals are new *presentation* of existing item rows; if they
ever disagreed with the stored session total that would be a data problem to report, not a display bug to
paper over.

## Known limitations

- The timeline dates use `formatDateThai`, which renders the day only — revisions made on the same day appear
  with identical timestamps. A time-of-day format would need a new formatter; deferred rather than adding a
  second date convention.
- `countedBy1Name` falls back to the raw user id in `getSession` when the profile join is absent, so the
  timeline can show an id instead of a name for older records. Service-layer behaviour, left untouched.
- Screenshots still pending — the Browser pane remained hidden for this run; all claims above are live DOM
  measurements.


---

# Wave 2E — Mobile Polish (closes Wave 2)

**Date:** 2026-08-20
**Scope:** the whole offering workflow at 390px, plus a regression pass at 800 / 1280px. No financial
behaviour touched.
Gate: `tsc --noEmit` clean · 148/148 tests passing — **no test changes needed**.

## Method

Rather than eyeballing screens, this wave ran a **programmatic 390px audit** across all nine surfaces
(Screens 04–08, session list, detail overview, dashboard, approvals + decision sheet), measuring every
element against two rules: does anything cross the viewport edge, and is any interactive control shorter than
`--touch-target-min` (44px). Then the same sweep at 800px and 1280px to catch regressions.

**Before:** 4 screens carried violations. **After:** zero across all nine, at all three widths.

## Defects found and fixed

### 1. Screen 05 review table overflowed 390px

The fund allocation table sat in a `overflow-x: auto` wrapper — horizontal scrolling inside a core workflow,
which the working agreement forbids, and the last two columns (QR, fund total) were off-screen. Moved onto
the shared `gl-table gl-table--cards` from Wave 2B, including the `tfoot` grand-total row, which now stacks
as a labelled card like the body rows. New CSS handles `tfoot` in card mode.

### 2. Touch targets below 44px on four screens

Measured shortfalls: Screen 04 date input 38px, service select 37px, three channel amount inputs 39px, add
allocation button 32px, per-row fund selects 33px; Screen 05 back-to-entry button **16px**, back-to-edit and
save-draft 39px; Screen 06 denomination steppers and inputs 40px; Screen 07 recount 36px, confirm-session
43px, back link 39px.

Fixed in two moves. The denomination controls were carrying a literal `40px` from Wave 2A — replaced with
`var(--touch-target-min)`. Everything else is inline-`padding` sizing spread across five components, so
rather than editing dozens of inline styles, a mobile-scoped rule sets `min-height: var(--touch-target-min)`
on buttons, selects, textareas and inputs inside `#main-content`, plus inline back-links which act as a
screen's back affordance. Inline styles set padding, not min-height, so the cascade applies cleanly.

### 3. `position: sticky` action bars never actually stuck

The Wave 2A sticky action bar was verified by its computed style (`position: sticky; bottom: 60px`) but never
by its behaviour. Scroll-position measurement showed it moving with the page — it was never pinning. Two
independent causes:

- **`#main-content` declares `overflow-y: auto` but never becomes a scrollport.** `#app` uses
  `min-height: 100vh` rather than a fixed height, so the flex column grows to content height (measured:
  main `scrollHeight` 1928px = `clientHeight` 1928px, document scrolls instead). Sticky inside a non-scrolling
  ancestor never triggers. Switched the mobile action bar to `position: fixed` pinned above the bottom nav,
  which does not depend on which element scrolls. The shell issue itself is left alone and reported below.
- **`.gl-fade-in` left a transform behind.** The `fadeIn` keyframes animated `translateY(4px) → 0` with
  `fill: forwards`, so every page container ended up with `transform: matrix(1,0,0,1,0,0)`. A non-`none`
  transform makes an element a containing block for fixed descendants — so even after switching to `fixed`,
  the bar positioned against `.gl-page` instead of the viewport. Changed `fadeIn` to animate opacity only.
  This was silently breaking `position: fixed` anywhere under a faded container, not just this bar.

Verified after the fix: the bar reports identical viewport coordinates (top 714, bottom 783) at scroll top,
mid-scroll and scroll bottom, sits exactly against the nav (`navTop` 783, zero overlap), and the last card of
content clears it.

Sticky action bars now apply to Screens **04, 05, 06**. Screen 07's confirm button was deliberately left in
place: it sits inside the "การยืนยันรอบเงินถวาย" card directly under the explanation the user must read before
confirming, and pinning it to the viewport would separate the action from its rationale.

### 4. Session list overflowed at 800px (found in the desktop regression pass)

The card-mode breakpoint was 768px, matching the shell. But the content column is the viewport **minus the
240px sidebar**, so at 800px a six-column table had ~560px to work with and blew past the edge — 8 overflowing
elements. The table breakpoint is now independent of the shell breakpoint at **900px**: between 769–900px the
sidebar is still shown and tables render as cards, which is correct for that band. Verified 1280px returns to
a real table with a visible header (`display: table` / `table-header-group`).

### 5. Action bar offset was 1px short

`bottom: var(--gl-mobilenav-h)` (60px) against a nav that measures 61px — the item min-height plus the nav's
1px top border. Now `calc(var(--gl-mobilenav-h) + 1px + env(safe-area-inset-bottom, 0px))`, which also handles
notched devices where the nav grows by the safe-area inset.

## Files changed

- [src/styles/app.css](../src/styles/app.css) — mobile touch-target rules; `tfoot` card mode; table card mode
  moved to its own 900px breakpoint; action bar `sticky` → `fixed` with corrected offset; `fadeIn` opacity-only.
- [src/components/offering/OfferingReviewSheet.ts](../src/components/offering/OfferingReviewSheet.ts) — fund
  table onto `gl-table--cards`; action row onto `gl-actionbar gl-actionbar--sticky`.
- [src/components/offering/OfferingEntryForm.ts](../src/components/offering/OfferingEntryForm.ts) — action
  footer onto `gl-actionbar gl-actionbar--sticky`.
- [src/components/offering/CashCountView.ts](../src/components/offering/CashCountView.ts) — denomination
  controls 40px → `var(--touch-target-min)`.

## Verification

**390×844 — all nine surfaces:** zero elements crossing the viewport edge, zero controls under 44px, no
document horizontal overflow. Denomination steppers measured 44×44, inputs 44px.

**800×— (tablet with sidebar):** zero overflow on all nine after the breakpoint fix (was 8 overflowing
elements on the session list).

**1280×900:** zero overflow on all nine; session list renders as a real table with header row.

**Action bar behaviour:** pinned and stable across scroll top / middle / bottom on Screen 06; no overlap with
the bottom nav; trailing content clears it.

Desktop `smallTargets` counts are non-zero by design — the 44px rule is mobile-scoped, and pointer targets on
desktop have no such requirement. Those are the components' original inline sizes, unchanged.

## Discovered issue — not fixed, reported

**`#main-content` has an inert `overflow-y: auto`.** The app shell sets `overflow-y: auto` on `<main>` and a
`position: sticky` topbar, which reads as an intent for main to be the scroll container. It is not: `#app` is
`min-height: 100vh`, so the column expands and the document scrolls instead. Today this is benign — the
sticky topbar happens to work against the document scrollport — but it means any future `position: sticky`
inside main will silently fail, exactly as the action bar did. The correct fix (`height: 100dvh` on `#app`
plus `min-height: 0` on the flex children) changes the app's scroll model globally and deserves its own
change with a full regression pass, not a tail-end edit in a polish wave.

## Wave 2 status

2A Cash Count · 2B Session List · 2C Posted/Success · 2D Offering Detail · 2E Mobile polish — **all complete**.
Throughout Wave 2: `tsc --noEmit` clean and 148/148 tests green at every step, with **no test modified after
Wave 2A's single deliberate label update**.

The Variance Resolution confirmable-shortage defect (audit §5) remains open and untouched.

## Known limitations

- ~~Screenshots pending~~ — **resolved**, see the Screenshot Record section below.
- The 900px table breakpoint is tuned for the current six-column tables and the 240px sidebar. A wider table
  would need its own treatment.


---

# Screenshot Record

The Browser pane stayed hidden for every Wave 1–2 run, so its `screenshot` action never had frames to
capture. Captures were produced instead with Playwright (already a devDependency, and what the existing
`scripts/m*_browser_test.mjs` runners use), which does not depend on a visible pane.

**New:** [scripts/capture_premium_screenshots.mjs](../scripts/capture_premium_screenshots.mjs) — renders each
screen from its real render function against fixtures, so it needs no Supabase session and produces identical
data every run. 13 screens × desktop (1280×900) + 390×844 full-page + 390×844 viewport = **39 captures**.
It asserts no horizontal overflow on every capture and exits non-zero if any screen fails; the current run
reports zero.

```bash
npx vite --port 5173 &
node scripts/capture_premium_screenshots.mjs
```

**Layout:**

- `docs/screenshots/before/` — the 25 pre-existing M2/M3 captures, moved here so the
  `scripts/m*_browser_test.mjs` runners (which write into `docs/screenshots/`) cannot overwrite the
  before-state record.
- `docs/screenshots/after/` — the new set.
- [docs/screenshots/README.md](screenshots/README.md) — before → after index, one entry per screen with what
  to look at in each pair.

**One capture caveat worth knowing:** Playwright stitches full-page screenshots, which leaves `position: fixed`
elements stranded partway down the image. The full-page captures therefore neutralise the bottom nav and the
sticky action bar; the `__mobile390_viewport.png` captures are the ones that show that chrome in its real
position. The first capture run had this artifact and the script was corrected before the final set.

**Spot-checked visually after capture:** dashboard desktop (fund breakdown, ฿ spacing on the 52px hero),
cash-count shortage at 390px viewport (stat strip with the red variance, fixed action bar sitting exactly
above the bottom nav, 44px steppers inside the card), and offering review at 390px (fund table stacked into
labelled cards including the total row — the Wave 2E overflow fix).


---

# Bugfix — Variance Confirmation Guard

**Date:** 2026-08-21
**Trigger:** explicit instruction to fix the STOP item from [PREMIUM_DESIGN_AUDIT.md](PREMIUM_DESIGN_AUDIT.md) §5.
**Approach:** tests first (RED → GREEN), then browser verification of every state.
**Result:** `tsc --noEmit` clean · **157/157 tests** (148 + 9 new guard tests).

## What the defect actually was

The audit recorded this as "a session with a real cash shortage can be confirmed". Reading the migration
first changed that conclusion, and it is worth stating plainly because it changes the severity:

`confirm_offering_session` ([supabase/migrations/20260819000011_offering_rpcs_and_triggers.sql](../supabase/migrations/20260819000011_offering_rpcs_and_triggers.sql))
already refuses the operation:

```sql
IF v_session.cash_variance_amount <> 0 THEN
  IF v_session.variance_status NOT IN ('explained','acknowledged')
     OR v_session.variance_reason IS NULL
     OR length(trim(v_session.variance_reason)) < 5 THEN
    RAISE EXCEPTION 'CANNOT_CONFIRM_UNRESOLVED_VARIANCE: ...';
```

**No unexplained shortage could ever be confirmed.** Money was never at risk, and no posted record is wrong.

The real defect was that the **screen disagreed with the database**: it could show a green "ยอดตรวจนับตรงกันสมบูรณ์"
and an enabled confirm button for a session the RPC would reject — telling a treasurer the count balances when
the record says it does not, and offering an action guaranteed to fail with an error they could not act on.
For a financial product that is still serious: it is a correctness-of-state defect and a trust defect, just
not a control hole. The severity in the audit was overstated; the fix was still needed.

## Root causes

Three, in [VarianceResolutionView.ts](../src/components/offering/VarianceResolutionView.ts):

1. **Two sources of truth OR-ed together.**
   ```ts
   const isMatch = varianceResult.isZeroMatch                  // recomputed live
     || session.varianceStatus === "zero_match"                // stale persisted flag
     || session.cashVarianceAmount?.isZero();                  // persisted amount
   ```
   Any one of three could declare a match. A stale `zero_match` status outvoted a live shortage.

2. **A missing count was treated as a zero count.**
   ```ts
   const actualCash = session.cashCount?.totalCashCounted || session.countedCashAmount || Money.zero();
   ```
   When the count failed to load, this manufactured ฿0.00 and with it a full-expected shortage out of
   nothing — which is how the audit's screenshot came to show −฿10,000.00 next to a green match.

3. **The confirmation rule was re-implemented instead of reused.** `canConfirm = (isMatch || isExplained) && !isLocked`,
   where `isExplained` accepted *any* non-empty reason. The domain layer already had the exact rule —
   `VarianceEngine.isVarianceAcceptableForConfirmation` — which mirrors the RPC including the 5-character
   minimum. The screen simply did not call it.

## The fix

**Stored variance is the authority.** `session.cashVarianceAmount` is the column the RPC gates on, so the
screen now displays and gates on it. The live recomputation from the count is a **cross-check**, never a
second source.

**A missing count is unknown, not zero.** `countedCash` is `Money | null`; when null the screen renders
"ยังไม่มีผลการตรวจนับเงินสด" and an em dash instead of a fabricated ฿0.00 and a fabricated shortage.

**The gate delegates to the domain engine**, evaluated against **persisted** state only:
```ts
const confirmCheck = varianceAmount === null
  ? { canConfirm: false, reason: "ยังไม่มีผลการตรวจนับเงินสด" }
  : VarianceEngine.isVarianceAcceptableForConfirmation(
      varianceAmount, session.varianceStatus, session.varianceReason);
const canConfirm = confirmCheck.canConfirm && !hasVarianceMismatch && !isLocked;
```
A typed-but-unsaved explanation no longer unlocks the button — the RPC gates on the saved reason, so the UI
must too.

**Disagreement is reported, not resolved silently.** If the stored variance and the recomputed one differ,
that is a data-integrity problem. The screen shows both numbers, blocks confirmation, and asks for a recount
rather than quietly trusting either value.

The blocked-confirmation hint now shows the engine's own reason ("พบผลต่างเงินสด (−฿50.00) ที่ยังไม่ได้รับการอธิบาย…")
instead of a generic sentence, so the message and the rule cannot drift apart.

## Tests

New: [tests/unit/offering-variance-confirmation-guard.test.ts](../tests/unit/offering-variance-confirmation-guard.test.ts)
— 9 cases, written before the fix, 6 of which failed against the old code:

| Case | Expected |
|---|---|
| Non-zero variance, no saved explanation | confirm blocked |
| Explanation typed but not saved | confirm blocked |
| Explanation persisted (≥5 chars) | confirm allowed |
| Persisted explanation shorter than 5 chars | confirm blocked |
| Genuine zero match | confirm allowed, match shown |
| **Stale `zero_match` vs stored shortage** | no match shown, confirm blocked |
| **Stored variance ≠ recomputed** | integrity warning, confirm blocked |
| **No cash count at all** | "no count" state, no fabricated shortage, confirm blocked |
| Cash-count record vs denormalised column | the recorded count wins |

One pre-existing assertion in `offering-variance-ui.test.ts` was updated deliberately: it asserted the old
generic hint sentence, and now asserts the specific reason the engine produces. The intent — confirmation is
blocked and the user is told why — is preserved and strengthened.

## Browser verification

Seven states driven through the real component in Chromium:

| State | confirm disabled | shows match | integrity alert | "no count" | fabricated −฿10,000 |
|---|---|---|---|---|---|
| Shortage, unexplained | yes | no | no | no | no |
| Explanation typed, unsaved | yes | no | no | no | no |
| Explanation saved | **no** | no | no | no | no |
| True zero match | **no** | **yes** | no | no | no |
| **Stale zero_match + shortage** | yes | no | no | no | no |
| **Stored ≠ recomputed** | yes | no | **yes** | no | no |
| **No count yet** | yes | no | no | **yes** | no |

Captures: [14_bugfix_stale_zero_match__desktop.png](screenshots/after/14_bugfix_stale_zero_match__desktop.png),
[14_bugfix_variance_mismatch__desktop.png](screenshots/after/14_bugfix_variance_mismatch__desktop.png),
[14_bugfix_no_count__desktop.png](screenshots/after/14_bugfix_no_count__desktop.png).

## Not changed

`VarianceEngine`, `Money`, `DenominationEngine`, `OfferingService`, every RPC, and the migrations are
untouched. The fix is entirely in how the screen derives state from data it is already given — the rule it
now enforces is the one the database was already enforcing.

## Follow-up

The `Money.from(undefined)` source was traced in the next section — it was a mismatched RPC response key.


---

# Bugfix — RPC Response Key Mismatches

**Date:** 2026-08-21
**Trigger:** tracing the `Unsupported money input type: undefined` source left open by the previous fix.
**Result:** `tsc --noEmit` clean · **160/160 tests** (157 + 3 contract tests).

## The source

`record_cash_count` returns this payload
([migration 20260819000011](../supabase/migrations/20260819000011_offering_rpcs_and_triggers.sql)):

```sql
RETURN jsonb_build_object(
  'session_id', p_session_id,
  'counted_cash', v_total_cash,      -- <—
  'expected_cash', v_session.expected_cash_amount,
  'cash_variance', v_variance,
  'variance_status', v_var_status,
  'status', v_next_status);
```

The client read a key that does not exist:

```ts
totalCash: Money.from(res.total_cash),   // undefined -> throws
```

**`Money.from(undefined)` throws, and it throws *after* the RPC has already committed.** The count was
written to `offering_cash_counts`, the session was updated, the variance was computed and stored — and then
the client blew up mapping the response, the `catch` turned it into `{ success: false }`, and the UI told the
user the save had failed. A false negative on a write that succeeded, which invites the user to count and
submit again.

That also explains the audit's screenshot: the session in the database had a correct zero-match, but the
client's in-memory session never received the count, so the Variance Resolution screen saw an absent count,
fabricated ฿0.00, and rendered −฿10,000.00 beside a stale green "zero match". One wrong key name produced the
entire chain.

## Why the tests did not catch it

`tests/unit/offering-service.test.ts` mocked the RPC response **from the client code** rather than from the
migration:

```ts
mockSupabase.rpc.mockResolvedValue({ data: { total_cash: 9950, ... } });
```

The mock asserted the client's imagination back to itself, so the suite stayed green. The SQL integration
runner (`scripts/m3_offering_integration_test.mjs`) exercises the RPCs directly against the database and
checks table columns — it never crosses the TypeScript mapping, so it could not see the problem either.
Neither layer was wrong on its own; nothing tested the seam between them.

## Full audit, not just the one bug

Cross-checking every offering RPC's returned keys against the keys the service reads found **four**
mismatches:

| RPC | Client read | Actually returned | Effect |
|---|---|---|---|
| `record_cash_count` | `res.total_cash` | `counted_cash` | **throws** after a committed write |
| `revise_offering_expected_amount` | `res.new_variance` | `cash_variance` | **throws** after a committed revision |
| `revise_offering_expected_amount` | `res.status` | not returned | `status` typed `OfferingSessionStatus`, always `undefined` |
| `resolve_offering_variance` | `res.status` | *(recount branch only)* | see below |

The fourth is a correction to my own first pass. My initial audit script took only the **last**
`RETURN jsonb_build_object` in each function and concluded `resolve_offering_variance` never returns
`status`. It has two branches: recount returns `{session_id, action, status}` and explain returns
`{session_id, action, variance_status, variance_reason}`. The client reading both keys is correct — each is
present in one branch. I had already "fixed" it by deleting the field before checking; that was reverted, and
the field is now typed `status?: OfferingSessionStatus` to reflect that it is branch-dependent.

## Changes

[src/lib/offering/offering-service.ts](../src/lib/offering/offering-service.ts):

- `recordCashCount`: `res.total_cash` → `res.counted_cash`.
- `reviseExpectedAmount`: `res.new_variance` → `res.cash_variance`; the phantom `status` field replaced with
  `revisionNumber` (which the RPC does return, and which is the useful value for an audit trail).
- `resolveVariance`: added `varianceReason` (returned by the explain branch) and made `status` optional with
  a comment recording that the two branches return different shapes.

Callers reload the session from the database after every one of these calls, so no consumer depended on the
fields that were wrong — the damage was confined to the throw.

[tests/unit/offering-service.test.ts](../tests/unit/offering-service.test.ts): both mocks rebuilt from the
migration payload (`counted_cash`, `cash_variance`).

## Regression guard

New: [tests/unit/offering-rpc-response-contract.test.ts](../tests/unit/offering-rpc-response-contract.test.ts).
It parses the migration for every RPC's returned keys (unioned across all `RETURN` branches) and the service
for every `res.<key>` read, then fails on any key the client expects but no branch sends. A third case fails
specifically when such a key is fed straight into `Money.from`, since that is the shape that throws instead of
degrading quietly.

**Proven to have teeth by mutation:** reintroducing `res.total_cash` makes the contract test fail 2/3 and the
behavioural service test fail its `recordCashCount` case; restoring the fix returns both to green. A test that
has never been seen failing is not evidence.

## Financial safety

No migration, RPC, engine, or `Money` code was touched. No stored amount changes. The RPCs were always
correct; only the client's reading of their replies was wrong. Sessions saved during the broken period are
intact in the database — the writes committed.

Re-submissions caused by the false failure are harmless: `record_cash_count` upserts with
`ON CONFLICT (offering_session_id) DO UPDATE SET`, so a session holds exactly one cash-count row and a repeat
submission of the same denominations rewrites the same values. No duplicate rows, no double-counted cash. The
only lasting effect of the bug was users being told a save failed when it had not.


---

# Bugfix — offering_session_items.category_id NOT NULL (blocked all offering creation)

**Date:** 2026-08-21
**Trigger:** found while building a real-browser, real-login E2E flow at the user's request ("run real browser
tests, whole flow, again") — none of the prior E2E scripts actually reached an authenticated screen (see
next section), so a new script was written that logs in through the real `#login-form`, and it hit this on
the very first "save draft."
**User decision:** presented 4 options via AskUserQuestion; user chose **revert the column to nullable**.
**Result:** `tsc --noEmit` clean · **163/163 tests** (160 + 3 new migration tests) · migration applied to the
live `grace-ledger-test` Supabase project · **verified end-to-end in a real browser**: login → create session
→ cash count → confirm → post to ledger, all the way to a real posted transaction and a dashboard balance
that moved by the posted amount.

## Why the old E2E scripts never caught this

`scripts/m2_phase2_3_browser_e2e.mjs` and `scripts/m3_slice1-4_browser_test.mjs` call
`supabase.auth.signInWithPassword` on a **separate Node-side `supabase-js` client**, then navigate the
Playwright-driven browser straight to an authenticated route. That session lives in the Node process; it
never reaches the browser's `localStorage`. Every one of those scripts' Playwright pages has always rendered
`LoginPage` and then timed out waiting for a selector that can never appear — a pre-existing gap, unrelated to
any Premium Design work, that this task's request to "run it again for real" is what finally surfaced.

New script: [scripts/e2e_full_flow_real_browser.mjs](../scripts/e2e_full_flow_real_browser.mjs) — logs in
through the real form, then drives dashboard → approvals → offerings → create → entry → review → save draft →
cash count → confirm → post, entirely through UI interactions.

## The defect

First real "save draft" through the new script failed immediately:

```
POST rpc/create_offering_session -> 400
{"code":"23502","message":"null value in column \"category_id\" of relation
\"offering_session_items\" violates not-null constraint"}
```

Traced to a genuine schema/application contract mismatch, present since before any work in this project's
session:

- [supabase/migrations/20260817000001_core_schema.sql:229](../supabase/migrations/20260817000001_core_schema.sql) —
  original `offering_session_items.category_id UUID REFERENCES categories(id)` (nullable).
- [supabase/migrations/20260819000010_offering_core_schema_repair.sql:131](../supabase/migrations/20260819000010_offering_core_schema_repair.sql) —
  later migration recreates the table with `category_id UUID NOT NULL`.
- No layer of the client was ever updated to match: `OfferingItem.categoryId` is optional everywhere in
  [types.ts](../src/lib/offering/types.ts); `OfferingEntryForm.ts` has no category field at all;
  `offering-service.ts` always sends `category_id: item.categoryId || null` (lines 157, 368). No church seeds
  a default category (`grep -n "INSERT INTO categories"` across every migration: no matches).

**Effect: no Sunday Offering session could ever be created through the UI.** Every real submission failed
with this constraint violation — the entire M3 offering module was unusable, independent of and prior to any
Premium Design work.

**Why the Node-side integration scripts didn't catch it either:** `scripts/m3_offering_integration_test.mjs`
always supplies a `category_id` it fabricates itself (`jsonb_build_object('category_id', v_cat_tithe_a, ...)`,
lines 154-406) — it tests the RPC directly with a payload the real client never sends. Same root pattern as
the RPC-response-key bugfix earlier in this session: nothing tested the seam between what the client actually
sends and what the database actually requires.

## Decision

Four options were put to the user: (a) make `category_id` nullable again, (b) add a category picker to the
entry form plus seed data, (c) have the RPC auto-assign a default category, (d) stop without fixing. **Chosen:
(a).** Category was never part of the Sunday Offering data model in the UI or in `OfferingSession`'s type —
adding a required field to satisfy a constraint that was itself the newer, unreviewed change is the wrong
direction; reverting the constraint restores the behaviour every other layer already assumed.

## Fix

New migration:
[supabase/migrations/20260821000013_offering_session_items_category_nullable.sql](../supabase/migrations/20260821000013_offering_session_items_category_nullable.sql)

```sql
ALTER TABLE offering_session_items
  ALTER COLUMN category_id DROP NOT NULL;
```

Applied to the live `grace-ledger-test` project (`jeklcfpqmytdmwczxqlx`) via the Supabase migration tool.
`get_advisors` (security) run after applying: no new findings — every warning listed pre-dates this change and
is unrelated to `offering_session_items`.

No RPC, engine, or TypeScript code changed. `category_id` was already optional end-to-end in the client; the
column just needed to agree.

## Tests

New: [tests/integration/offering-session-items-category-nullable.test.ts](../tests/integration/offering-session-items-category-nullable.test.ts) —
3 cases against pg-mem:

1. **Pre-fix reproduction** — the exact insert shape `create_offering_session` sends (fund + channel + amount,
   no category) throws against the migration-010 column definition. This is the RED that proves the repro is
   real, not assumed.
2. **Post-fix** — the same insert succeeds after applying migration 013; `category_id` reads back `NULL`.
3. **Category still accepted** — an insert that does supply a category still stores it correctly. The fix
   only removes a requirement; it does not remove the capability.

pg-mem cannot parse migration 010 in full — it uses `ALTER COLUMN status TYPE TEXT USING status::TEXT`, and
pg-mem's parser doesn't support `USING` on `ALTER COLUMN TYPE` (a pg-mem gap; the existing
`database-migrations.test.ts` suite avoids this the same way, by never loading migration 010 either). The test
reproduces migration 010's exact `offering_session_items` column list inline, then applies the real migration
013 **file** — so the fix itself is verified as real, executable SQL against the real filesystem artifact;
only the unrelated noise from 010 is stood in for.

## End-to-end verification (real browser, real login, real remote Supabase, after the fix)

All 16 steps of `scripts/e2e_full_flow_real_browser.mjs` passed:

login → dashboard (real balance ฿323,800.00) → approvals queue → offerings list → create session → fill
Screen 04 → Screen 05 review → **save draft (succeeds — no more 23502)** → open the created draft from the
list → dual-custody counter selection → count 10×฿100 to a zero match → save cash count → **confirm session
(status: confirmed)** → **post to ledger (status: posted, real TX id)** → no console errors, no horizontal
overflow.

A second full run confirmed the dashboard balance moved from ฿323,800.00 to ฿324,800.00 — the exact ฿1,000
posted by the prior run — proving the post actually committed to `transactions`, not just that the UI showed
a success banner.

Two script bugs were found and fixed while getting a clean run (not application bugs — noted for the
record since they shaped what "16 steps" means):

- `handleSaveDraft` navigates to the session **list** on success (`router.navigate("/offerings")`), not to
  the new session's detail route — the script assumed detail and was corrected to open the new draft from the
  list instead.
- A successful confirm lands on the **overview** tab by design (Wave 2D: confirmed/posted/voided sessions land
  read-only) — the post button lives on the resolution tab, so the script now returns to it before looking
  for `#btn-post-to-ledger`.
- Row selection needed to require the "ร่าง" (draft) badge, not just the ฿1,000.00 amount — after several
  successful runs in the same shared test church, multiple historical sessions share that total, and the
  amount alone matched an already-locked row from an earlier run.
- The script's fixed `service_date` collided with `uq_offering_session_service (church_id, service_date,
  service_name)` — a real, correct constraint — on the second run. The script now derives a date unique to
  each run instead of a literal.

## Not in scope

Noticed while reading the posted-session screenshot: **ผู้ตรวจนับคนที่ 1/2** (counter names) render as raw
UUIDs instead of names on this church's data — `countedBy1Name` in `offering-service.ts` falls back to the raw
id when the `profiles` join is absent. This is the same known limitation already recorded in the Wave 2D
report; not new, not touched here.

## Financial safety

Schema was touched only after explicit user approval of the specific change (nullable, not any of the other
three options). No RLS, RBAC, RPC business logic, or money calculation changed. The fix is the minimum needed
to match what every other layer already assumed: category is optional on a Sunday Offering item.
