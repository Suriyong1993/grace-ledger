# Premium Design Audit — Grace Ledger

**Date:** 2026-08-20
**Scope:** visual and structural audit only. No code changed.
**Baseline verified before audit:** `tsc --noEmit` clean · `vitest run` 19 files / 148 tests passing.

---

## 1. Current State

**Architecture.** Vanilla TypeScript + Vite. No React, no component library. Every screen is a
`render*Html(props): string` function; state changes re-render the whole page and re-attach listeners
(`src/main.ts`). Routing is hash-based (`src/router.ts`).

**Design system.** `design-system-extracted/` is a complete, well-formed token set — color, typography
(with a real numeric scale), spacing, radius, shadow, motion — plus JSX reference components. It is
imported once through [src/styles/app.css](src/styles/app.css) and then almost entirely bypassed.

**How styling actually works today.** 566 inline `style="…"` attributes across 15 files. 743 hex colour
literals, of which 166 are raw values not even used as a `var()` fallback. The design system is loaded
but the application does not consume it: it re-states approximations of it inline, screen by screen.

**Screens reviewed** (source + `docs/screenshots/`): Dashboard, Approval Queue, Approval Detail,
Sunday Offering Entry, Offering Review, Cash Count, Variance Resolution, Posted/Success, and the
390px mobile captures 08 / 13 / 18 / 22 / 25.

---

## 2. Design Strengths

Real assets worth protecting — the identity does not need replacing.

- **The token set is good.** Restrained warm-neutral base (`#FFFCF8`), one brand orange, and finance
  semantics (`--income` / `--expense` / `--pending` / `--approved` / `--rejected`) with fixed meaning.
  A shadow scale that is deliberately faint with the comment "border beats shadow". A numeric type
  ramp up to a 52px hero balance. This is already premium-financial thinking.
- **`.num-display` exists** and is applied to every amount — tabular, lining, slashed-zero.
- **Money is never a float.** `decimal.js` behind `src/lib/money.ts`, everywhere.
- **Information architecture is sound.** Queue → detail → decision, and entry → count → variance →
  confirm, both map to how the work is actually done. The Approval Detail screen puts projected fund
  balance *before* the approve button, which is the correct order of persuasion for a treasurer.
- **Safety concepts are surfaced in the UI**, not buried: two-person rule, dual custody, receipt
  presence, projected deficit, stale-state detection.
- **Layout is calm.** No gradients, no glass, no neon. The starting point is restrained.

The problem is not the design direction. It is that the craft layer never got built.

---

## 3. Problems — five themes

**T1 · The design system is loaded but not used.** Values are re-typed inline and drift: the same card
radius appears as `var(--radius-card, 14px)`, `…, 10px)` and `…, 8px)` in three files, while the token
is 24px. Off-palette colours have crept in — purple (`#6b21a8`, `#7e22ce`, `#faf5ff`) for "cash
surplus", blue (`#2563eb`, `#1d4ed8`) for "transfer/counted", slate (`#334155`). Neither is in the
system, neither is documented, and both break under `.dark` because they are literals.

**T2 · Mobile is not finished.** At 390px the sidebar is hidden with no replacement, and one whole
denomination row grid overflows its card. Two core workflows are unusable or unreachable on a phone —
the device a counting team actually holds on a Sunday.

**T3 · Internal vocabulary is shipped to users.** "Screen 06", "Slice 2 E2E 1787158297719",
"PostgreSQL 17", "(Status: counting)", and a raw exception string appear in production UI.
This is the single loudest signal that the app is a work-in-progress rather than a product.

**T4 · State is communicated by decoration, not by hierarchy.** Emoji stand in for iconography
(✅ ⚠️ 🔒 🧾 ℹ️), one glyph renders as tofu, an undefined `pulse` keyframe makes the only skeleton
static, and semantic `--*-foreground` tokens are painted onto `-muted` surfaces — which puts near-white
text on pale backgrounds, including on the deficit warning.

**T5 · Every element competes.** Four identical "ดูรายละเอียด" buttons on a queue where the whole row
is already clickable. A total-amount card in the same orange as the primary CTA. A green confirm
button on one screen and an orange one on the next. Three page-container widths (1080 / 960 / 600)
inside the same shell.

---

## 4. Findings

### P0 — usability / accessibility / trust. Blocking.

| # | Finding | Evidence | Direction |
|---|---|---|---|
| P0-1 | **No navigation at 390px.** `.gl-sidebar { display: none !important }` with no hamburger, drawer or bottom bar. The only nav left is the topbar strip, which renders the เงินถวาย link *only while already on that route* — so the offering module is unreachable from a phone. | [app.css:59](src/styles/app.css:59), [AppShell.ts:203](src/components/layout/AppShell.ts:203), `08_mobile_queue.png` | Add a mobile nav (bottom bar or drawer) with all three destinations always present. |
| P0-2 | **Cash-count denomination rows are clipped on mobile.** `grid-template-columns: 140px 1fr 180px` = 320px of fixed columns inside a padded card at 390px. The stepper `+`, the count input and the computed amount are cut off the right edge. Only `.gl-allocation-row` has a mobile override; `.gl-denom-row` has none. | [CashCountView.ts:283](src/components/offering/CashCountView.ts:283), [CashCountView.ts:461](src/components/offering/CashCountView.ts:461), `18_m3_mobile_cash_count.png` | Stack the row at ≤768px, same treatment `.gl-allocation-row` already gets. |
| P0-3 | **Near-white text on pale surfaces.** `--income-foreground` / `--expense-foreground` are `oklch(0.99 0 0)` — intended for text on the *solid* colour. They are used as the text colour on `-muted` backgrounds. The inline hex fallbacks look correct but never apply, because the token resolves. Affects the approved and rejected status badges, the queue error card, and the **fund-deficit warning** — the most safety-critical sentence in the product. | [StatusBadge.ts:27](src/components/approvals/StatusBadge.ts:27), [StatusBadge.ts:39](src/components/approvals/StatusBadge.ts:39), [ProjectedBalanceCard.ts:33](src/components/approvals/ProjectedBalanceCard.ts:33), [ApprovalsQueueView.ts:38](src/components/approvals/ApprovalsQueueView.ts:38) | Use a dedicated on-muted text token per status. Never pair `--x-foreground` with `--x-muted`. |
| P0-4 | **Raw exception text shown to the user.** `Unsupported money input type: undefined` is rendered in the Variance Resolution error banner. | [money.ts:48](src/lib/money.ts:48) surfaced at [VarianceResolutionView.ts:150](src/components/offering/VarianceResolutionView.ts:150), `19_m3_screen07_variance_review.png` | Map internal errors to Thai user messages; log the technical string. |
| P0-5 | **Internal identifiers in production UI.** Tab labels read "1. ตรวจนับเงินสด (Screen 06)"; session titles carry "(Slice 2 E2E 1787158297719)"; chips read "Screen 04 · Offering Entry"; the topbar reads "ระบบออนไลน์ · PostgreSQL 17"; a toast reads "(Status: counting)". | [OfferingPage.ts:343,358](src/pages/OfferingPage.ts:343), [AppShell.ts:211](src/components/layout/AppShell.ts:211), [CashCountView.ts:91](src/components/offering/CashCountView.ts:91), [OfferingEntryForm.ts:106](src/components/offering/OfferingEntryForm.ts:106), [OfferingReviewSheet.ts:98](src/components/offering/OfferingReviewSheet.ts:98) | Remove all of it. Screen numbers belong in `docs/`, not on screen. |
| P0-6 | **Zero accessibility affordances.** 0 `aria-*` attributes and 1 `role` in the entire `src/`. The reject/revision modal has no `role="dialog"`, no focus trap, no ESC, no autofocus, and its backdrop does not close it. 17 form controls, 15 `<label>`, only 6 with `for=`. Decorative SVGs are not `aria-hidden`. | [RejectionModal.ts:17](src/components/approvals/RejectionModal.ts:17), repo-wide grep | Dialog semantics + focus management first; label wiring second. |

### P1 — strong visual / product improvement

| # | Finding | Evidence | Direction |
|---|---|---|---|
| P1-1 | **The ฿ glyph collides with the digits** in every amount. Inter carries no ฿, so it falls back to Sarabun at different metrics while `.num-display` applies `letter-spacing:-0.01em`. Visible on every screen, including the ฿250,000.00 hero. | `01_dashboard.png`, `02_queue_view.png`, `15_…png` | Set the currency mark in its own span at normal tracking, or load a font that carries ฿. Highest visual-cost/lowest-risk fix in the audit. |
| P1-2 | **`app.css` overrides the design system's `.num-display`** with a phantom `--font-mono` token the system deliberately does not define, dropping `slashed-zero` and `ss01`. | [app.css:26](src/styles/app.css:26) vs [tokens/typography.css](design-system-extracted/tokens/typography.css) | Delete the local override; consume the system's rule. |
| P1-3 | **Dashboard is ~60% empty** below two cards, and the balance card is the only financial content — no fund breakdown, no offering status, no recent activity. Then the same page opens with the kicker "ศูนย์บัญชาการการเงิน". | `01_dashboard.png`, [DashboardPage.ts:66](src/pages/DashboardPage.ts:66) | Give the dashboard real density: fund balances, current offering session state, recent postings. Drop the grandiose kicker. |
| P1-4 | **Three container widths inside one shell** — 1080 (dashboard, approvals page) / 960 (queue view, offering) / 600 (decision sheet) — with padding applied at both the page and the component level, so the page frame visibly shifts between routes. | [DashboardPage.ts:66](src/pages/DashboardPage.ts:66), [ApprovalsPage.ts:173](src/pages/ApprovalsPage.ts:173), [ApprovalsQueueView.ts:146](src/components/approvals/ApprovalsQueueView.ts:146), [ApprovalDecisionSheet.ts:121](src/components/approvals/ApprovalDecisionSheet.ts:121) | One page-shell width and one padding owner. |
| P1-5 | **Redundant and undifferentiated CTAs.** The whole queue row is clickable *and* carries an outlined "ดูรายละเอียด" — four identical buttons down the page. The pending-total card uses primary orange, so nothing on screen is visually the action. | `02_queue_view.png`, [ApprovalsQueueView.ts:126](src/components/approvals/ApprovalsQueueView.ts:126) | Row = the target. Drop the per-row button or demote it to a chevron. Total card goes neutral. |
| P1-6 | **Button hierarchy is inconsistent across the app.** Confirm-session is green (`--income`), every other primary is orange; on the decision sheet the destructive "ปฏิเสธ" sits leftmost and reads first. | [VarianceResolutionView.ts:401](src/components/offering/VarianceResolutionView.ts:401), [ApprovalDecisionSheet.ts:189](src/components/approvals/ApprovalDecisionSheet.ts:189) | One primary style. Success colour reports state, it does not invite clicks. Destructive last, and visually quietest. |
| P1-7 | **Bilingual double-labels throughout.** "จัดการผลต่างและยืนยันรอบ (Variance Resolution)", "ผู้ตรวจนับคนที่ 1 (Counter 1)", "คิวรออนุมัติ (Approvals Queue)" — which forces the mobile queue title onto three lines. | queue/offering/variance components, `08_mobile_queue.png` | Thai only in the UI. |
| P1-8 | **Date formats contradict each other inside one flow.** Cash Count shows `23 ส.ค. 2569` (BE); Variance Resolution shows `2026-08-23` (ISO/CE); the entry form's native date input renders `08/19/2026` (US). | `15_…png`, `19_…png`, `13_…png` | One formatter, one calendar convention, applied everywhere. |
| P1-9 | **Validation fires before the user acts.** A fresh entry form already shows "ยอดจัดสรรกองทุนยังไม่ตรงกับยอดตามช่องทาง / รวมจัดสรร: ฿0.00 · คาดหวัง: ฿0.00", while a green ✓ marks each ฿0.00 channel as allocated. | `13_m3_mobile_offering_entry.png`, [OfferingEntryForm.ts](src/components/offering/OfferingEntryForm.ts) | Validate on blur/submit, not on mount. No success mark for an untouched zero. |
| P1-10 | **Approval detail is not a sheet.** Despite the class name it renders inline below the queue — no overlay, no scroll-into-view, no focus move, no ESC. On mobile the user lands mid-page with no indication anything opened. | [ApprovalsPage.ts:173](src/pages/ApprovalsPage.ts:173), [ApprovalDecisionSheet.ts:121](src/components/approvals/ApprovalDecisionSheet.ts:121) | Make it a real sheet/dialog, or make the detail a proper route view. |
| P1-11 | **Placeholder identity in a production path.** `OfferingPage` is constructed without its `currentUserName` argument, so its default `"ศจ.สมชาย มีสุข"` is what the Review Sheet prints as the record's creator. The shell has an equivalent fallback (`"คุณสมชาย"`). | [main.ts:121](src/main.ts:121), [OfferingPage.ts:58](src/pages/OfferingPage.ts:58), [AppShell.ts:17](src/components/layout/AppShell.ts:17) | Pass the real profile. Render an explicit unknown state rather than a fictional name on a financial record. |

### P2 — refinement

| # | Finding | Evidence |
|---|---|---|
| P2-1 | Emoji used as product iconography — ✅ empty state, ⚠️ deficit, 🔒 two-person rule, 🧾 receipt, ℹ️ stale, ✕ close. The system ships real SVG icons elsewhere in the same files. | [ApprovalsQueueView.ts:56](src/components/approvals/ApprovalsQueueView.ts:56), [ApprovalDecisionSheet.ts:36,72,94](src/components/approvals/ApprovalDecisionSheet.ts:36) |
| P2-2 | A glyph renders as tofu (▯) on the "เหรียญรวม" row. | `15_…png`, `18_…png` |
| P2-3 | The only skeleton loader animates with `pulse`, which is never defined — and the branch is dead code, since the page renders its own loading state and never passes `isLoading` down. | [ApprovalsQueueView.ts:28](src/components/approvals/ApprovalsQueueView.ts:28), [app.css](src/styles/app.css) |
| P2-4 | Loading states are full-page text swaps ("กำลังโหลด… / ดึงข้อมูลจาก Supabase PostgreSQL 17") that discard the layout, so every load flashes the shell empty. | [ApprovalsPage.ts:68](src/pages/ApprovalsPage.ts:68), [OfferingPage.ts:277](src/pages/OfferingPage.ts:277) |
| P2-5 | Error surfaces use the brand-orange `--accent` as their background with a red border — warning and brand read as the same thing. | [ApprovalsPage.ts:77](src/pages/ApprovalsPage.ts:77) |
| P2-6 | Copy over-explains. "อนุมัติรายการเรียบร้อยแล้ว — รายการพร้อมสำหรับการลงบัญชี (Posted)"; "สูตรคำนวณ: ยอดเงินสดนับได้ (฿6,950.00) − ยอดเงินสดคาดหวัง (฿10,000.00)"; "ข้อมูลบัญชีและการเงินได้รับการตรวจสอบครบถ้วนแล้ว" for an empty queue. | [ApprovalsPage.ts:219](src/pages/ApprovalsPage.ts:219), [CashCountView.ts](src/components/offering/CashCountView.ts), [DashboardPage.ts:143](src/pages/DashboardPage.ts:143) |
| P2-7 | The offering detail "tabs" are two styled buttons — no `role="tablist"`, no keyboard model — presented as a numbered stepper they do not enforce. | [OfferingPage.ts:330](src/pages/OfferingPage.ts:330) |
| P2-8 | `--shadow-modal` is used but does not exist in the token set; the modal silently falls back to an inline literal. | [RejectionModal.ts:30](src/components/approvals/RejectionModal.ts:30) |
| P2-9 | Dark mode is fully specified in tokens and unreachable in the app — no toggle, and 743 light-mode hex literals would defeat it anyway. | [tokens/colors.css](design-system-extracted/tokens/colors.css) |
| P2-10 | Three status badges wrap mid-word into blobs at 390px ("รอ อนุมัติ", "ยังไม่มีใบ เสร็จ", "คุณเป็นผู้ สร้าง"). | `08_mobile_queue.png` |
| P2-11 | Mobile action rows are not sticky; the primary sits last after two secondaries and wraps to two lines. | `18_…png`, `13_…png` |

### P3 — cosmetic

| # | Finding |
|---|---|
| P3-1 | "+ + เพิ่มรายการกองทุน" — the label repeats the icon's plus. `13_…png` |
| P3-2 | The topbar strip duplicates sidebar navigation while looking like a breadcrumb, and is not one. |
| P3-3 | Sub-pixel type sizes (`13.5px`, `12.5px`, `11.5px`) invented inline, ignoring the type scale. |
| P3-4 | Rows are separated by `<div style="height:10px">` spacer divs instead of gap/margin. |
| P3-5 | The status pill and the amount both use the same weight-700, so the pill competes with the number it annotates. |

---

## 5. STOP — items that are not design work

> **Status 2026-08-21: RESOLVED.** Both items below were fixed under an explicit instruction to do so,
> outside the design waves, with tests first. See
> [PREMIUM_DESIGN_IMPLEMENTATION_REPORT.md](PREMIUM_DESIGN_IMPLEMENTATION_REPORT.md#bugfix--variance-confirmation-guard).
> The findings are kept below as the original record.

Per the financial-safety rule, reporting rather than touching:

1. **A ฿10,000 shortage renders as a green "Zero Match" and stays confirmable.** In
   `19_m3_screen07_variance_review.png`: expected ฿10,000.00, actual ฿0.00, variance −฿10,000.00 — and
   the card, the banner and the confirm button all present success. `isMatch` is an OR across three
   sources, so a stale `session.varianceStatus === "zero_match"` overrides the live computation, and
   `canConfirm = (isMatch || isExplained) && !isLocked` then unlocks confirmation.
   [VarianceResolutionView.ts:38-52](src/components/offering/VarianceResolutionView.ts:38)
   **Impact:** a session with a real cash shortage can be confirmed. **Required change:** derive
   `isMatch` from the computed variance only, and treat the persisted status as display metadata.
   This is business logic — it needs a decision and a test, not a restyle.

2. **`actualCash` silently degrades to zero.** `session.cashCount?.totalCashCounted || session.countedCashAmount || Money.zero()`
   turns the "Unsupported money input type: undefined" failure into a legitimate-looking ฿0.00 rather
   than an error state. Same file, line 35. Feeds directly into (1).

Both are out of scope for a design pass and are the reason Variance Resolution is **not** in the first
implementation wave below.

---

## 6. Recommended Direction

Keep the identity. Build the craft layer that the token set already assumes.

1. **Consume the design system instead of restating it.** Introduce a thin CSS layer of `gl-*` classes
   (`.gl-card`, `.gl-stat`, `.gl-btn--primary/secondary/destructive`, `.gl-badge--*`, `.gl-page`)
   defined purely in terms of existing tokens, and move markup onto those classes screen by screen.
   No new framework, no new dependency, no token invention. This is the single change that fixes T1,
   makes dark mode reachable, and stops the drift.
2. **Fix the numerals first.** ฿-glyph collision and the `.num-display` override are cheap, and money
   is the primary content of every screen — the perceived quality jump per line changed is highest here.
3. **One page shell.** One max-width, one padding owner, one page-header pattern (kicker / title /
   supporting line), one card spacing rhythm.
4. **Rebuild hierarchy per screen:** one primary action, secondaries quiet, destructive last and
   quietest. Success colour reports state and never invites a click.
5. **Finish mobile as a first-class target, not a media-query afterthought.** Real navigation, no
   overflow in counting workflows, sticky primary action, ≥44px targets.
6. **Strip the workshop out of the product.** Screen numbers, slice IDs, engine names, raw exception
   strings, emoji iconography — all out.
7. **Make states intentional.** Skeletons that preserve layout, empty states that say the one true
   thing, errors in Thai, disabled controls that explain themselves next to the control.

Tokens change only if a screen-local solution cannot express the need — most likely candidates, if any:
a `--on-*-muted` text token per status (required by P0-3) and a border-strength token.

---

## 7. Screens Selected for Upgrade

Wave 1 — the three reference screens. Everything else follows their vocabulary.

| Order | Screen | Why first | Carries |
|---|---|---|---|
| 1 | **Dashboard** | Every session starts here; it is the emptiest and the most quoted screen. | page shell, stat/hero surface, numeral treatment, kicker/title pattern |
| 2 | **Approval Detail** | Densest hierarchy problem and the highest-stakes decision in the product. | sheet/dialog pattern, button hierarchy, status + deficit colour semantics, focus management |
| 3 | **Sunday Offering Entry / Review** | Longest form, most mobile exposure, most validation. | form controls, inline validation, allocation rows, sticky mobile actions |

Wave 2, after Wave 1 is approved: Approval Queue, Cash Count (includes P0-2), Offering Session List,
Posted/Success.

Wave 3, after the STOP items in §5 are resolved: Variance Resolution.

**Cross-cutting, landing with Wave 1:** P0-1 mobile navigation, P0-5 internal-vocabulary strip,
P1-1/P1-2 numerals, and the `gl-*` class layer.

---

## 8. Constraints and risks

- **UI tests assert on rendered HTML strings.** `approvals-ui-components`, `offering-ui-components`,
  `offering-cash-count-ui`, `offering-variance-ui`, `offering-posting-ui` will break on markup moves.
  Update them deliberately, never by weakening an assertion to nothing.
- **Full re-render on every state change** means no CSS transition survives an update, and focus is
  lost on each render. Any interaction polish has to account for that, or it will fight the harness.
- **Screenshots in `docs/screenshots/` are the "before" set.** Recapture desktop + 390px per screen at
  the same paths for the implementation report.
- Design work touches no money math, no lifecycle, no schema, no RPC, no RLS/RBAC. If it appears to
  need to, that is a §5 item.

---

## 9. Status

Audit complete. **No code changed. Awaiting Product Owner approval** on §6 direction and §7 wave
order before any implementation begins.
