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
**Status:** **SUPERSEDED by D8 (2026-09-02, commit `954d2f3`) — never implemented.** The Emerald Vault token
revision landed after the Decision Record was frozen and set a third, later value set: `--radius-card` 20px
(not 16px), `--radius-input` 10px (not 12px), `--radius-dialog` 24px (not 20px), `--radius-sheet` 28px,
`--radius-sm` 6px, `--radius-lg` 12px. `--radius-button` 12px is the one value D1 and D8 agree on. The
control-height literal (46px) is unaffected and still shipped. See D8 for the governing values.

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
**Status:** IMPLEMENTED in R1-d (2026-09-03). `.gl-modal-content` in
`src/styles/app.css` is flattened to solid `var(--popover)` + `var(--shadow-elevated)`,
with `backdrop-filter` blur/saturate removed, and duplicate rules de-duplicated.

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

### D8 — "Emerald Vault" identity is the canonical token set (supersedes D1)

**Decision:** the token values shipped in `design-system-extracted/tokens/{colors,radius,shadows}.css` as of
commit `954d2f3` are canonical. The R1 hand-off package's replacement token files are **rejected** — they
were authored against baseline `bee600e8` (`old-origin/main`), which predates this identity.

**Provenance verified during R1-c:**

- Commit `954d2f3`, authored by the repo owner (Suriyong1993), 2026-09-02 09:17 +0700 — newer than both the
  frozen Decision Record's baseline (`bee600e8`) and D1's cited source commit (`a2548ed`, 2026-08-28).
- The same commit wrote `Identity: "Emerald Vault" (2026-09) — porcelain surfaces, deep-evergreen brand,
dark vault sidebar, brass accents. Upgrade the craft, do not replace the identity.` into `CLAUDE.md`, so
  the decision is recorded in the governing document, not only in code.
- Currently shipped: the built stylesheet contains `#14532D` (evergreen brand), `#0B1F17` (vault sidebar),
  `#F4F5F2` (porcelain), `#2FA36B` (sidebar primary, ×5) and **zero** occurrences of `#f97316` (the old
  orange brand).

**What the hand-off package would have done if applied:** reverted `--primary` to orange `#f97316`, the
background to `#FFFCF8`, and the sidebar from the dark vault (`#0B1F17`, light text) to white with dark text
and orange accents; reverted the ink-tinted shadow ramp to neutral black; and **deleted tokens with live
consumers** — `--gl-evergreen-*` (12 refs), `--gl-brass-*` (6), `--gl-vault-950` (2), `--surface-elevated`
(4), `--border-subtle` (4), plus repointing `--sidebar-primary` (9 consumers across `AppShell.ts` and
`app.css`). That is a direct violation of CLAUDE.md's identity hard-stop.

**Correction to the hand-off's stated R1-c risk:** `00-README.md` claimed token edits have "no visual
difference" until R1-d because the files are "not imported anywhere except through `app.css`'s `@import`".
That `@import` (`src/styles/app.css:1` → `design-system-extracted/styles.css` → `tokens/*.css`) _is_ the
consumption path, and `app.css` reads the tokens directly via `var(--radius-card)`, `var(--radius-input)`,
`var(--radius-dialog)` and 13 more. Token edits render immediately; there is no safe no-op window.

**Status:** APPROVED · already shipped. R1-c changed **no** token file; it only corrected `DESIGN.md` and
this log to describe the shipped values.

### D9 — Canonical Church Officers & Governance Roster (คริสตจักรชีวิตสุขสันต์กาฬสินธุ์)

**Decision:** The canonical leadership roster for Grace Ledger is permanently established as:

1. **ศิษยาภิบาล (Pastor):** อาจารย์สรรเสริญ ดวงจิตร (`pastor`)
2. **ผู้นับเงิน (Counter 1):** อาจารย์ ทัศนา ดวงจิตร (`counter`)
3. **ผู้นับเงิน (Counter 2):** สุดารัตน์ จิณเซ่ง (`counter`)
4. **ผู้ตรวจสอบบัญชี / ผู้ดูแลระบบสูงสุด (Auditor & Super Admin):** พณ.ท่านหม่อมราชวงศ์สุริยงค์ บาลเพ็ชร (`super_admin`)

**Enforcement:** All fallback identities, mockups, seed data, and component defaults are unified to these 4 real church officers. Legacy test fixtures (such as "ศจ.สมชาย มีสุข" and "มนัส สุขใจ") from earlier milestones are completely superseded and harmonized across `fable5.1/`, `src/`, and test suites.
**Status:** APPROVED & IMPLEMENTED (2026-09-03).

### D10 — `transaction_splits` immutability is DB-enforced (resolves Phase 2B Finding #1)

**Decision:** `transaction_splits` rows are immutable once their parent transaction leaves `draft`.
Enforcement lives in migration `20260903000000_split_immutability_guard.sql`:

1. `trg_enforce_split_immutability` — `BEFORE INSERT OR UPDATE OR DELETE` row trigger on
   `transaction_splits` (SECURITY INVOKER) rejecting direct end-user writes unless the parent status is
   `draft`. The exemption check uses `current_user`: SECURITY DEFINER RPCs (e.g. `void_transaction`'s
   reversal-entry split copy) and `service_role` run as a non-end-user current_user and keep working,
   mirroring how the RLS policies are written `TO authenticated`.
2. `fn_lock_transaction_status_for_split_guard` — SECURITY DEFINER helper that locks the parent row
   (`FOR KEY SHARE`, the same lock strength the FK check takes) and returns its status, scoped by
   `current_user_church_id()` and failing closed (NULL parent ⇒ reject). The definer is **required**:
   as `authenticated`, a locking-clause read on `transactions` additionally applies the UPDATE policy's
   `USING` clause, which excludes non-draft rows for finance_staff — the check would silently read NULL
   and allow the write (observed directly in the Phase 2B lab). The lock makes the status check atomic
   against a concurrent submit/approve/post (Phase 2B scenarios C/E).

Also in `20260903000001_drop_ambiguous_transfer_funds_overload.sql`: the dormant legacy 5-argument
`transfer_funds` overload (Phase 2B Finding #2) is dropped; all callers use the 6-argument form.

`vitest.config.ts` sets `fileParallelism: false` — two test files boot PgLab embedded PostgreSQL on one
fixed Windows service name; concurrent files would stop each other's lab mid-run (Phase 2B J/K/L flakes).

Phase 2B scenarios B/C/D/E/I now assert the policy and pass; C2/C3/E2 run their out-of-band split INSERT
in the lab owner context so the second-line integrity nets (post/approve split-sum checks) stay verified.
**Status:** APPROVED & IMPLEMENTED (2026-09-03). Full suite 587/587 green.

### D11 — Shell & Dashboard operate as an attention-driven command center (Phase A)

**Decision (product/workflow, no financial semantics touched):**

1. **Role-gated navigation.** Sidebar and mobile bottom-bar destinations are filtered by the existing
   RBAC matrix (`can(role, "read", resource)`) via `AppShell`'s destination resources and
   `rbac.toUserRole` (unknown roles fall back to `member`, the least-privileged view). Authorization
   rules themselves are untouched — this only stops the UI advertising destinations a session cannot use.
2. **One attention source.** `src/services/attention-service.ts` aggregates pending approvals, offering
   sessions in `variance_review`/`counted`/`draft`, and draft transactions from the existing services,
   role-filtered before querying. The shell bell ("งานที่ต้องดำเนินการ" panel) and the Dashboard
   "งานสัปดาห์นี้" section render the same truth; the summary reloads on every navigation so badges are
   never stale. No notification backend was invented; groups a role cannot read are never fetched.
3. **Global primary action.** The topbar carries "บันทึกรายการ" for roles with
   `create` on `transactions`, deep-linking `#/transactions?create=1` into the existing create form
   (`TransactionsPage.consumeDeepLinkActions`, one-shot; the router strips query strings when matching).
   No second transaction workflow was created.
4. **Mobile composition.** Bottom bar = หน้าหลัก + up to three workflow tabs (ถวาย → อนุมัติ → การเงิน,
   role-gated) + "เพิ่มเติม" sheet carrying every other reachable destination + destinations are never
   hidden behind Profile. Profile stays in the topbar avatar on all widths.
5. **Dashboard order = ATTENTION → ACTION → CONTEXT.** The identity card is removed (identity lives in
   the shell); "งานสัปดาห์นี้" leads with actionable rows; the balance hero keeps its approved
   structure; a "สุทธิเทียบเดือนก่อน" context card (derived from the already-loaded historical series —
   display math only) replaces the static review card.

**Status:** APPROVED & IMPLEMENTED (2026-09-03).

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

> **RESOLVED (verified during Phase A, 2026-09-03).** The dashboard trend no
> longer clamps to a fixed 5,000,000-satang ceiling — `DashboardPage` derives
> the bar scale from the tallest month in the loaded series, and
> `dashboard-page-ui.test.ts` pins "never a fixed ceiling". This entry is
> retained as history; no `financial-reviewer` action remains.

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

---

## 2026-09-05 — Premium UI/UX refinement (user-directed Master Engineering Directive)

### D12 — Dashboard order is financial-position-first (supersedes D11 §5 only)

**Decision:** D11 §5 ("Dashboard order = ATTENTION → ACTION → CONTEXT") is superseded for ordering only. The
Dashboard now renders **FINANCIAL POSITION → MOVEMENT (income/expense inside the hero) → CONTEXT (net vs.
last month) → ACTION (งานสัปดาห์นี้ command center) → EXPLANATION (trend chart) → DETAIL (recent activity /
funds split)**. The balance hero (`.gl-dash-hero-row`) is now the first section after the page header;
`.gl-command-center` renders immediately after it, still full width and fully visible — not hidden, not
shrunk, not merged into a sidebar — just one section lower than before.

**What did NOT change (D11 §1-4 remain in force):** role-gated navigation, `AttentionService` as the single
source for the shell bell and this section, the global primary action in the topbar, and mobile composition
(hero/greeting still lead on mobile too, per the same order).

**Also fixed in this pass — duplicate attention messaging (was two competing surfaces):** a
"Grace AI Personalized Greeting" card (`.gl-ai-greeting`, added 2026-09-04 00:22, _after_ D11 shipped) had
drifted into repeating the same pending-count message and a second call-to-action (`.gl-btn--cta-2026`)
already shown in the command center below it. Consolidated to one attention source: the greeting is now a
plain text line (`.gl-dash-greeting`, no card/gradient/icon/button) carrying only name + role; the count and
the action to address it live solely in `.gl-command-center`.

**Also removed — the orange "2026 Sunset Orange" CTA system:** `.gl-btn--cta-2026`, `--gl-cta-accent`,
`--gl-cta-accent-hover`, `--gl-cta-on-accent`, `--gl-spring-easing`, and the now-orphaned
`@keyframes gl-fade-slide-in` — this was a second, un-approved accent/CTA system layered on top of the
Emerald Vault button hierarchy (`gl-btn--primary`/`--secondary`), introduced in the same 2026-09-04 00:22
session. Its only consumer was the greeting button removed above. `gl-btn--primary`/`--secondary` remain the
only button hierarchy.

**Which test assertions are no longer authoritative:** `dashboard-page-ui.test.ts`'s two "2026 AI ... greeting"
tests (asserted `.gl-ai-greeting`, the duplicate count, and `.gl-btn--cta-2026`) — replaced with tests
asserting the plain `.gl-dash-greeting` line and the _absence_ of the removed classes, plus a new test
pinning hero-before-command-center ordering.

**Not touched in this pass (deferred, separate report before proceeding):** sidebar, topbar grouping, mobile
bottom-nav overflow (a real "no destination should silently disappear" gap exists for high-privilege roles;
fixing it means partially reversing the 2026-09-04 removal of the "เมนูเพิ่มเติม" affordance — user confirmed
reintroducing a minimal overflow entry point is wanted, scheduled for the next pass), login, tables, charts.

**Status:** APPROVED & IMPLEMENTED (2026-09-05). `npm run typecheck`, `npm test` (596/596), `npm run
lint:design`, `npm run build` all green; verified `.gl-ai-greeting`/`cta-2026`/`gl-fade-slide-in` are absent
from the built `dist/` bundle.
