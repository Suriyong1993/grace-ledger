# DECISIONS.md — Grace Ledger design decision log

> Target path: repo root, `DECISIONS.md` (new file). Append-only. Every decision that changes a shared value
> or rule gets a dated entry here — this is how the "Modern UI layer vs original tokens" drift (D1) happened:
> a real decision was made in a commit message and never recorded anywhere durable.

---

## 2026-09-02 — R1 design foundation decisions

### D1 — Radius / control height canonicalized

**Decision:** the values already shipped to production (commit `a2548ed`, QA'd 2026-08-28) are canonical.
`--radius-card` 24px→**16px**, `--radius-button` 18px→**12px**, `--radius-input` 14px→**12px**,
`--radius-dialog` 28px→**20px**, `--radius-sheet` 32px→**20px** (unused until R2). Button/input height **46px**
(literal, documented in `DESIGN.md`). `--touch-target-min` (44px) unchanged.
**Why:** the second value set is what users have seen in production for two weeks; the original design-system
tokens described a product state that no longer exists. See Strategic Review §6, D1.
**Status:** APPROVED · IMPLEMENTED IN R1.

### D2 — Unified transaction status semantics

**Decision:** one status→label/color map (see `DESIGN.md` §Status semantics). `posted` = info, not approved.
`voided` = neutral, not rejected. Dashboard's "รอตรวจสอบ" → "รออนุมัติ".
**Why:** three disagreeing maps existed (`approvals/StatusBadge.ts`, `TransactionsPage.ts`, `DashboardPage.ts`
inline) — a ledger showing different labels for the same transaction on different screens is a trust problem.
**Status:** APPROVED · **not yet implemented** (R3 — requires page-level render changes, out of R1 scope).

### D3 — Modal glass flattened

**Decision:** `.gl-modal-content` becomes a solid `--popover` surface + `--shadow-elevated`. No blur/saturate
on modal content. The sticky topbar remains the one sanctioned blur in the product.
**Why:** CLAUDE.md bans glass cards; the modal glass predates that rule; GPU cost on low-end devices during
Sunday counting is a real concern.
**Status:** APPROVED · IMPLEMENTED IN R1.

### D4 — Dark mode: deferred

**Decision:** keep the complete `.dark` token set; do not build a toggle yet.
**Why:** no toggle exists today; building one now doubles QA surface mid-redesign; revisit after the offering
module's literal colors are gone (R5).
**Status:** DEFERRED, not scheduled.

### D5 — Design-system package location

**Decision:** `design-system-extracted/` in-repo remains canonical (it's what `app.css` actually imports and
what `CLAUDE.md` names). Any external design-system tool/project should sync **from** this repo after token
changes land, not the reverse.
**Status:** APPROVED, no code change required.

### D6 — Reports KPI tiles: white surface + colored value

**Decision:** Reports' fully-tinted KPI tiles and table headers will be replaced with white cards + colored
numbers, matching Dashboard/Funds. Reserve full tint for genuine alarm states (`.gl-stat--danger`).
**Status:** APPROVED, scheduled for R6 (Reports page render change) — not in R1.

### Q3 — Offering review checkpoint: kept as a mandatory confirm sheet (Option A)

**Decision:** the separate "review" screen is retired; its content (fund × channel table, expected vs
counted amounts when applicable, attestation) survives as a mandatory confirm sheet inside the entry step.
**Binding requirement:** before the user can confirm, the sheet must show fund, channel, entered amount per
channel and per fund×channel, counted amount and variance when they exist, and require an explicit
attestation checkbox before the primary action is enabled. The lifecycle transition in `lib/offering/lifecycle.ts`
does not change.
**Status:** APPROVED, scheduled for R5 (offering module redesign) — not in R1.

### Q4 — Monday deposit: non-blocking post-posted hand-off (Option B)

**Decision:** no new offering-lifecycle state. After a session reaches `posted`, a hand-off card (and a home-
screen reminder) offers to pre-fill the existing fund-transfer flow (Cash Drawer → Bank). It never
auto-executes and goes through the normal approval queue like any other transfer.
**Status:** APPROVED, scheduled for R5/R6 — not in R1.

### Q5 — Dashboard/Transactions "เดือนนี้" KPIs: use the correctly scoped source

**Decision:** both pages will consume `ReportsService.getExecutiveFinancialSummary(churchId, "YYYY-MM")`
(posted-ledger-only, month-bounded, with provenance) for their monthly income/expense KPIs, instead of
summing unfiltered/all-status local data. The transaction list itself remains an unfiltered ledger browser —
only the two KPI numbers change source.
**Status:** APPROVED, scheduled for R4 (Dashboard) / R6 (Transactions) — not in R1.

### D7 — AppShell.ts shell-mark/avatar: R1 patch superseded pre-application

**Finding:** this package (built against baseline `bee600e8` / `old-origin/main`) assumed `.gl-shell-mark`/
`.gl-shell-avatar` still used an orange gradient forced flat by an `!important` override in `app.css`.
Verified against the actual repo state during R1 execution: commit `954d2f3` ("church identity from session")
— landed after `bee600e8`, not present in the frozen Decision Record's baseline — already flattened both
selectors to solid `var(--sidebar-primary)` / `var(--sidebar-primary-foreground)` directly in `AppShell.ts`'s
own `<style>` block, with no `!important` anywhere and no gradient left in `app.css`. The prose patch
`13-AppShell.ts.patch` was not applied; its underlying goal (single non-hacky owner of shell-mark color) was
already met, via a different, identity-aligned token than the package assumed.
**Why recorded, not silently applied:** CLAUDE.md and R1's own scope forbid introducing new visual decisions
during R1; this is not a new decision, it documents that an already-approved goal was reached by an earlier,
unrelated commit before this package could land.
**Status:** RECORDED · NO CODE CHANGE APPLIED IN R1.

---

## Financial Review Items — recorded, not modified by design work

These were found during design analysis and are explicitly **out of scope** for any design task per
CLAUDE.md's financial hard-stops. They require `financial-reviewer` sign-off, not a CSS/markup change.

### FRI-1 — Keyword-based direction fallback in `ReportsService`

`src/lib/reports/reports-service.ts` (`getStatementOfFinancialPosition`) uses
`t.direction || (isExp ? "expense" : "income")` where `isExp` tests the Thai description for "จ่าย/ซื้อ/ค่า"
when `direction` is falsy. This feeds monthly totals, category totals, and — after Q5 ships —
`getExecutiveFinancialSummary`, which becomes the Dashboard/Transactions KPI source.
**Risk:** an income transaction described with "ค่า…" (e.g. rental income "ค่าเช่า…รับ") would be miscounted
as an expense. HIGH if `transactions.direction` can be null in the schema; LOW if the column is `NOT NULL`.
**Recommended remediation:** verify the column constraint in `supabase/migrations`; if nullable, treat a null
direction as a data error to surface (exclude + count in provenance), never infer from text.

### FRI-2 — Same heuristic in `DashboardPage.loadData`

`src/pages/DashboardPage.ts` infers direction from description keywords for the 5 most-recent transactions
and uses that to color/sign the recent-activity rows. Same risk class as FRI-1, smaller blast radius (5 rows).
**Recommended remediation:** read the real `direction` column (already selected by `TransactionsPage`); the
row-rendering change is a design/R4 concern, the query change needs `financial-reviewer` sign-off.

### FRI-3 — Transactions KPI sums all statuses, no date bound

`src/pages/TransactionsPage.ts`'s "รายรับ/รายจ่ายเดือนนี้" sums `this.transactions` including draft, pending,
rejected, and voided rows, with no date filter, under a "this month" label.
**Recommended remediation:** Q5 (approved) replaces this with `getExecutiveFinancialSummary`. Listed here so
`financial-reviewer` can confirm no other consumer depends on the current (incorrect) sum before it's removed.

### FRI-4 — Hard-coded dashboard trend chart scale

`src/pages/DashboardPage.ts` clamps its monthly trend bars to a `maxVal` of 5,000,000 satang (฿50,000); any
month above that renders identical to exactly ฿50,000.
**Risk:** LOW (visual only) but misleading for any church whose real numbers exceed the fixture scale.
**Recommended remediation:** derive the max from the actual data set; scheduled for R4.

### FRI-5 — `getExecutiveFinancialSummary`'s month-end bound is a literal `"YYYY-MM-31"`

`src/lib/reports/reports-service.ts` builds `monthEnd` as a string with a hard-coded `-31`, which is an
invalid date for 28/29/30-day months. Behavior depends on how Postgres/PostgREST coerces an invalid date
literal in a `.lte()` filter — unverified here.
**Risk:** LOW–MEDIUM, and this function is about to become the shared KPI source (Q5).
**Recommended remediation:** compute the real last day of the month, or filter with `< first-day-of-next-month`
instead of `<= YYYY-MM-31`. Add a unit test for February before Q5 ships.

## Open findings (design, non-financial)

- `.gl-table`'s live appearance (rounded corners via `border-collapse: separate` + `--radius-lg`) contradicts
  the documented `--radius-table: 0px` rule. Preserved as-is in R1 (current behavior); needs its own decision
  before either direction is changed. See `DESIGN.md` → Open findings.
