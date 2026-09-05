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

### D13 — Mobile bottom nav: "เพิ่มเติม" overflow restored (resolves D12's deferred mobile gap)

**Decision:** `AppShell.buildMobileComposition` no longer places Profile in the bottom bar and no longer
truncates a role's reachable destinations to whatever fits in 3 tabs. The bar is now หน้าหลัก + up to 3
priority content tabs (unchanged priority order); any destination the role can read beyond those 3 renders
as a link inside a new "เพิ่มเติม" sheet (`#gl-more-btn` / `#gl-more-panel`), opened from a button appended to
`.gl-mobilenav`. The button and its badge total (sum of any badge counts among the overflowed destinations)
are omitted entirely when nothing overflows — most roles still see a plain 4-5 tab bar with no sheet at all.
Profile itself is not duplicated into the overflow sheet: it was already reachable from the topbar avatar on
every width per D11 §4, which this pass leaves unchanged.

**Why:** a treasurer (or any role reading more than 3 of the 6 content destinations) lost silent access to
the rest on mobile after the 2026-09-04 removal of the original overflow affordance — funds, reports, and
members had no path from a phone. D11 §4's own requirement ("destinations are never hidden behind Profile")
was violated by that removal. This is a bug fix for an already-approved requirement, not a new UI system: it
reuses `.gl-attention-panel`'s existing popover markup/CSS/tokens (new `.gl-more-panel` only repositions it
above the bottom bar instead of below the topbar) and the existing generic popover-toggle wiring in
`main.ts#attachShellPanels`, which already anticipated a second popover by that exact ID pair.

**Which test assertion is no longer authoritative:** `app-shell-navigation.test.ts`'s "5 core workflow tabs
with Profile and no overflow sheet" test — it pinned the exact regression this decision fixes. Replaced with
two tests: one asserting a treasurer's 3 unreachable-by-tab destinations (funds/reports/members) surface
through `#gl-more-panel` and Profile is absent from `.gl-mobilenav`, one asserting the button/panel are absent
entirely for a role (counter) whose destinations all fit as tabs.

**Not touched in this pass:** sidebar and topbar priority/grouping — reviewed against this directive's target
order (page context → primary action → utility → identity for the topbar; primary/secondary/utility grouping
for the sidebar) and already conform, so left as-is per "preserve working architecture absent a demonstrated
problem." Login and further responsive verification continue in this same pass, reported separately below.

**Status:** APPROVED & IMPLEMENTED (2026-09-05). `npm run typecheck`, `npm test` (575 passed, 22 skipped —
the two real-Postgres integration suites, pre-existing sandbox limitation, unrelated to this change),
`npm run lint:design`, `npm run build` all green.

### D14 — Login: PIN keypad press state brought back into the motion contract

**Decision:** `.gl-pin-key:active:not(:disabled)` in `src/components/login/loginStyles.ts` changes from
`transform: scale(0.95); background: color-mix(in srgb, var(--primary) 12%, var(--card));` to
`transform: scale(0.98);` only.

**Why:** `design-system-extracted/readme.md`'s binding hover/press contract states "Press = `scale(0.97–0.98)`
only, no color flash." The live rule was outside that range and added a background flash — a drift from an
already-documented contract, not a new design decision. `design-plans/03-login-pin-key-press-state.md` had
already identified and specified this exact fix (against an earlier commit hash); this pass verified the
other two login design-plans (`01`, stylesheet/markup reconciliation, and `02`, the raw `#10b981` → `--success`
token swap) were already applied in the current codebase, and applied the one that was not (`03`).

**Login review against this directive's priorities (brand recognition, clear auth purpose, simple form
hierarchy, obvious primary action, error states, responsive usability, no marketing/decorative content):** the
existing split-panel login (`LoginPage.ts`, `loginStyles.ts`) already meets these — brand mark + wordmark +
church name and a plain-language purpose statement on the vault panel, one profile-select-then-PIN flow with
a single primary action per step, explicit `checking`/`incomplete`/`locked`/`requires_reset` PIN states, no
gradients/illustrations/promotional copy. No further change made; this is a review finding, not a rewrite.

**Status:** APPROVED & IMPLEMENTED (2026-09-05). `npm run typecheck`, `npm test` (575/597, 22 pre-existing
skips), `npm run lint:design`, `npm run build` all green.

### D15 — The "2026 Evolved Glassmorphism" layer is retired (completes the D12 cleanup)

**Decision:** the glass treatment on the three shell/content surfaces is replaced by opaque surfaces with a
hairline border and, where a surface really overlaps, an ink-tinted token shadow.

| Surface | Was | Now |
| --- | --- | --- |
| `.gl-shell-topbar` | `card 80%` + `blur(14px) saturate(140%)` + `rgba(0,0,0,.25)` shadow + a **white** 9% bottom border | `var(--card)`, `1px solid var(--border)`, `box-shadow: none` |
| `.gl-shell-topbar` inline style (`AppShell.ts`) | `card 88%` + `blur(10px)` | `var(--card)` |
| `.gl-mobilenav` (≤768px) | `card 85%` + `blur(14px) saturate(140%)` + `rgba(0,0,0,.3)` shadow | `var(--card)`, `1px solid var(--border)`, `var(--shadow-elevated)` |
| `.gl-glass-surface` | glass utility, **zero consumers** in `src/` or `tests/` | deleted |
| `--gl-glass-blur`, `--gl-glass-border` | tokens read only by the four rules above | deleted |

**Why:**

1. **It violated a rule this repo had already written down.** `DESIGN.md` § Anti-AI-Slop Rules: "No
   glassmorphism unless justified by depth system." Nothing in the depth system justified it — `shadows.css`
   states the opposite contract: *"Border beats shadow — these are intentionally faint … Shadows are
   ink-green tinted to sit inside the porcelain palette."* The retired rules used pure black at 25–30%.
2. **It was the surviving half of a known drift.** The layer arrived in the 2026-09-04 00:22 session, the
   same session that added the "2026 Sunset Orange" CTA system. D12 removed the CTA half and left the glass
   half. This completes that cleanup; it is not a new direction.
3. **The topbar border was invisible.** `--gl-glass-border` was `rgba(255,255,255,0.09)` — 9% white on a
   porcelain-light topbar. The bar had no readable bottom edge in light mode. `var(--border)` restores it.
4. **Blur over a ledger costs legibility and frame time.** Figures scrolling under the bar were smeared, on
   the surface where a treasurer is reading amounts.

**Also corrected in the same pass, both found by bringing `app.css` under the lint (D16):**

- `.gl-dash-hero::before` — the hero's 3px crown ramped `var(--primary)` into `#0ea5e9`, a bright sky blue
  outside the Emerald Vault palette, on the single most important element of the dashboard. Now ramps
  `var(--primary)` → `var(--gl-brass-500)`, the two accents the identity owns.
- `.gl-modal-content--sheet` — `box-shadow: 0 -4px 24px rgb(0 0 0 / 0.2)` → `var(--shadow-elevated)`.

**What did NOT change:** the `!important` on the topbar rule stays — `AppShell.ts` sets that header's base
background and border as inline `style` attributes, so a stylesheet rule cannot win without it. The five
remaining `backdrop-filter` uses stay: they are overlay scrims (modal backdrop, sheet backdrop, sticky mobile
action bar), not content surfaces, and they blur at 2–6px behind a veil rather than 14px on the content
itself. `.gl-total-rule` — the 2px + 1px double underline beneath the hero balance — stays: it is the
accounting convention for a grand total, not decoration.

**Status:** APPROVED & IMPLEMENTED (2026-09-05). `npm run typecheck`, `npm test` (575 passed, 22 pre-existing
skips), `npm run lint:design`, `npm run build` all green. No test assertion changed; no test needed changing.

### D16 — `lint:design` now scans `.css`, and rejects `backdrop-filter` by count

**Decision:** `scripts/lint-design.mjs` walks `.css` files in addition to `.ts`, gains a `backdrop-filter`
pattern, and carries an allowlist entry for `src/styles/app.css` with the exact count of every literal that
remains there.

**Why:** the walker matched `entry.endsWith(".ts")` only. `src/styles/app.css` is 5,022 lines — the largest
stylesheet in the product and the one every screen loads — and it was never scanned. That gap is precisely
how the D15 layer landed with black shadows, an off-palette hex, and a white border, while `lint:design`
reported "passed". The design source of truth cannot be guarded by a check that does not read it.

**What the allowlist now pins in `app.css`** (a count that moves in *either* direction fails the lint, which
is this script's existing convention):

| Pattern | Count | What they are |
| --- | --- | --- |
| literal `font-size` | 1 | dev-only HMR badge |
| literal `border-radius` | 3 | dev-only HMR badge (1), two hairline/pill radii below the smallest token (2) |
| `rgb()`/`rgba()` | 7 | dev-only HMR badge (2), overlay scrim veils (2), faint ink-tinted shadows written inline instead of as tokens (3) |
| hex | 10 | dev-only HMR badge (1), print stylesheet (9) — paper needs true black and white |
| `backdrop-filter` | 5 | overlay scrims only |

Each is R6 cleanup except the print block and the scrims, which are correct as they are.

**Verified:** injecting `.gl-drift-probe { backdrop-filter: blur(14px); background: #0ea5e9; }` into
`app.css` fails the lint on both counts and exits 1; removing it passes. The guard was tested, not assumed.

**Status:** APPROVED & IMPLEMENTED (2026-09-05). Same green gates as D15.

### D17 — Weight falls as size rises

**Decision:** at `--text-4xl` (32px) and above, a figure uses `--weight-semibold`, not `--weight-bold`. Below
32px, bold stays where it separates a value from its label at small size.

Changed — the complete set at or above 32px, found by pairing every `--weight-bold` declaration with its
`font-size`:

| Selector | Size | Was | Now |
| --- | --- | --- | --- |
| `.gl-dash-hero__value` | 40-52px | bold | semibold |
| `.gl-cashcount-summary__value` | 32px | bold | semibold |
| `.gl-approval-amount__value` | 32px | bold | semibold |
| `.gl-reports-hero__value` | 32px | bold | semibold |

`.gl-page-header h1` tops out at `--text-3xl` (26px), below the line, and keeps bold. Bold usage across
`app.css` falls from 37 declarations to 33.

**Why:** at 40-52px the size, the tight tracking and the tabular figures already carry the hierarchy. The
extra weight adds mass without adding rank, which is the "Bolder Typography" half of the same 2026-09-04
drift D12 and D15 unwound. Nothing below 32px changed: at 13px a badge or an avatar's initials needs the
weight to stay legible.

**Also in this pass:**

- `.gl-dash-hero__value` sized itself `clamp(2.25rem, 4vw, 3.25rem)`. The max already equalled `--text-6xl`,
  and the scale names both ends for this exact element — `--text-5xl` is commented "hero balance",
  `--text-6xl` "hero balance lg". The min, a bare 2.25rem, sat off the scale between `--text-4xl` and
  `--text-5xl`. Now `clamp(var(--text-5xl), 4vw, var(--text-6xl))`, so the mobile hero renders at the 40px
  the design system always specified rather than 36px. Verified with a ฿12,847,235.50 stress value at
  320-1440px: no horizontal scroll at any width.
- `.gl-page-header h1` carried `letter-spacing: -0.025em`; `--tracking-heading` is -0.02em. Now the token.
- `ApprovalsPage.ts` styled its modal close button inline with `font-size: 1.5rem` — off the scale, and
  overriding `.gl-modal-close`, which already supplies a 44px target, a tokenised size, hover and
  transitions. The five other call sites use the class alone. The inline override is deleted.
- Four spacing values with an exact token equivalent (one 12px, three 4px) now read `var(--space-3)` and
  `var(--space-1)`. The other 33 raw-px spacing values in `app.css` are 1-3px, 6px, 7px or 10px optical
  nudges with no equivalent on a 4px scale; they are left alone rather than invented into new tokens.

**Status:** APPROVED & IMPLEMENTED (2026-09-05). `npm run typecheck`, `npm test` (575 passed, 22 pre-existing
skips), `npm run lint:design`, `npm run build` all green.

### D18 — The top bar's controls never shrink; the title absorbs the squeeze

**Decision:** `.gl-shell-topbar__context` loses its percentage cap and becomes `flex: 0 0 auto`;
`.gl-shell-topbar__title` becomes `flex: 1 1 auto; min-width: 0` and ellipsizes.

**The bug.** `__context` carried `max-width: 42%` (48% under 768px) with `overflow: hidden`. On a 390px
phone that reserved 172px of a 358px content box for a row whose controls measure 247px. Measured, the tail
sat at x=405 on a 390px screen:

```
gl-shell-primary-action  w= 83  x=202  right=285
gl-attention-wrap        w= 44  x=293  right=337
gl-shell-avatar          w= 44  x=345  right=389
gl-logout-btn--topbar    w= 44  x=405  right=449   <- off screen
```

The page did not scroll sideways, so the mobile sign-out button was **invisible yet still focusable** — a
keyboard or screen-reader user could reach a control nobody could see. The cap was written when this slot
held the church name as text; it now holds the primary action, the bell, the avatar and sign-out, and a
percentage cap on fixed 44px controls clips them. The 640px rule that drops the church chip was an earlier,
partial answer to the same squeeze.

Confirmed pre-existing, not introduced by this pass: the same x=405.48 measures on `main`.

After the fix, at 390px every control ends at right=374 — exactly the content edge. Verified at 320, 360,
390, 414, 768, 1024 and 1440px: no horizontal scroll, no clipping, sign-out on screen at every mobile width.

**Accepted trade-off:** at 390px the topbar wordmark truncates to "Grace Led…". That is the intended
outcome of the rule — the wordmark is the least important thing in the bar, and the page states its own
name in an `h1` directly below. Controls win over decoration.

**No test added:** jsdom has no layout engine, so this class of regression cannot be caught by the current
suite. Catching it needs a real browser; see the follow-up note in D19.

**Status:** APPROVED & IMPLEMENTED (2026-09-05). Same green gates as D17.

### D19 — Every touch target meets the 44px the design system already sets

**Decision:** three controls that fell below `--touch-target-min` on a 390px viewport are raised to it.

| Control | Was | Why it mattered |
| --- | --- | --- |
| `.gl-shell-primary-action` (≤768px) | 40px | The app's global primary action (D11 §3) and its most-tapped control. It had been compacted in an inline `<style>` in `AppShell.ts` to fit the crowded top bar; the room came back when D18 removed the cap. The short label and narrower padding stay — they buy width without shrinking the target. |
| `.gl-attention-panel__group-head` | 37px | Tappable row in the bell panel; it had padding but no `min-height`. |
| `.gl-attention-panel__more-link` | 31px | Same. |

Measured before and after by walking every focusable element at 390px. Only `.gl-skip-link` (133×37) now
sits under 44px, and it is left alone: it is revealed on keyboard focus and is never a touch target.

**Status:** APPROVED & IMPLEMENTED (2026-09-05). Same green gates as D17.

### D20 — Press states are brought inside the documented 0.97-0.98 range

**Decision:** six press states outside the contract are corrected. `design-system-extracted/readme.md`
states it: *"Press = `scale(0.97-0.98)` only, no color flash."*

| Control | Was | Now |
| --- | --- | --- |
| `.gl-logout-btn:active` | 0.96 | 0.97 |
| `.gl-shell-icon-btn:active` | 0.96 | 0.97 |
| `.gl-modal-close:active` | 0.96 | 0.97 |
| `.gl-txn-row:active` | 0.995 | 0.98 |
| `a.gl-row:active` | 0.99 | 0.98 |
| `.gl-profile-item:active` (login) | 0.99 | 0.98 |

Small chrome controls take 0.97; full-width rows take 0.98, the gentle end, which suits their size. Half of
the product's fourteen press states were off-contract before this — three snapping harder than allowed,
three barely moving. `.gl-profile-item` is the first control a user touches on the login screen; D14 brought
`.gl-pin-key` into the contract and missed this one in the same file.

**What was left alone:** `a.gl-row:active` also sets `background: var(--accent)`. That is not the "colour
flash" the contract forbids — it is the same tint as its own `:hover`, standing in for hover on a touch
device, where none exists. Removing it would leave a touch user with a 2% scale as the only feedback. The
single remaining `scale(0.99)` in the product is the login card's entrance keyframe, which is an animation,
not a press.

**Status:** APPROVED & IMPLEMENTED (2026-09-05). Same green gates as D17.
