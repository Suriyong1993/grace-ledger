# ApprovalsPage replaces emoji glyphs with the app's SVG icon system

Written against: e5694f8a2f9a5c914d9d89bd2be67f9998330b57 (working tree has uncommitted local changes to `src/pages/ApprovalsPage.ts` already — this plan targets that current on-disk state, not the commit's version of the file).

## Evidence chain

- Surface: `src/pages/ApprovalsPage.ts` — loading state, empty state, receipt flag (list row + detail panel), and the approve / request-revision / reject buttons (list-row quick-approve and detail-panel action strip)
- Problem: Eight sites render raw emoji characters (`⏳ ✅ ✓ ↩ ✗ 📎`) as functional UI icons instead of inline SVG
- Design evidence: `CLAUDE.md` (repo root, Design section) — "Banned: ... emoji as UI iconography." No documented exception exists for this page or pattern.
- Owner: the per-page `const ICON_* = "<svg ...>...</svg>"` convention — defined and consumed in `src/pages/DashboardPage.ts:54-62` and `src/pages/TransactionsPage.ts:43-50` (also `FundsPage.ts`, `MembersPage.ts`). Every sibling page renders icons this way; `ApprovalsPage.ts` currently has zero `ICON_*` constants and zero `<svg` icon usage outside `renderDirectionIcon` (income/expense/transfer glyph, already SVG and out of scope here).
- Scope and affected surfaces: `src/pages/ApprovalsPage.ts` only. `tests/unit/approvals-page-ui.test.ts` asserts on the literal emoji strings at lines 60, 82, 165 and must be updated in the same change (per `CLAUDE.md` workflow rule: "markup refactors break [tests] ... update deliberately, never by loosening the assertion to nothing").
- Uncertainty: None on the contract or the pattern to follow. Exact `width`/`height` for each icon at each call site is an implementation judgment call (see Changes) — pick values that preserve each icon's current visual weight relative to the surrounding text, not a specific pixel figure mandated here.

## Design decision

Replace each emoji with an inline SVG icon, following the exact `const ICON_* = "<svg ...>"` module-level convention already proven in `DashboardPage.ts` / `TransactionsPage.ts`. Two of the six needed icons already exist verbatim in the codebase and must be reused rather than redrawn; the other four are new but follow the same stroke-based, `currentColor`/token-colored, `aria-hidden="true" focusable="false"` style already established.

## Reuse

- Exemplar (icon-in-button composition): `src/pages/DashboardPage.ts:569-572` — `` `${ICON_PLUS}<span>บันทึกเงินถวาย</span>` `` inside a `gl-btn`. ApprovalsPage's icon+label buttons should follow this same `${ICON_X}<span>label</span>` structure, not bare-icon buttons, since these are labeled actions (not icon-only controls).
- Reuse exact existing icon (do not redraw): `ICON_CLOCK` from `src/pages/DashboardPage.ts:54` — `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>` — for the loading state (replaces `⏳`).
- Reuse exact existing icon (do not redraw): `ICON_RECEIPT` from `src/pages/DashboardPage.ts:60` — `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5"/></svg>` — for both receipt-flag sites (replaces `📎` at line 166 and line 243).
- New icons required (none of these exist elsewhere in the repo under this exact shape — confirmed by searching `ICON_` constants across `src/pages/*.ts`): a checkmark (approve, replaces `✓`), an undo/corner-arrow (request revision, replaces `↩`), an X (reject, replaces `✗`), a check-in-circle or check-in-clipboard (empty state, replaces `✅`). These belong as new `const ICON_*` declarations at the top of `ApprovalsPage.ts`, in the same position/style Dashboard and Transactions use (module scope, above the class).
  - `ICON_CHECK`: standard checkmark polyline, e.g. `<polyline points="20 6 9 17 4 12"/>`, stroke width and `aria-hidden`/`focusable` attributes matching the reused icons above.
  - `ICON_UNDO`: corner-up-left / rotate-back glyph (visually distinct from `ICON_CHECK`/`ICON_CLOSE`, communicates "send back"), same stroke style.
  - `ICON_CLOSE`: reuse the shape already defined as `ICON_CLOSE` in `src/pages/TransactionsPage.ts:48` (`<path d="M18 6L6 18M6 6l12 12"/>`) — same visual language for "close/reject" is already established there; redeclare it locally in `ApprovalsPage.ts` per the existing per-page-constant convention (no shared icon module exists to import from).
  - `ICON_CHECK_CIRCLE`: a checkmark-in-circle or checkmark-in-clipboard for the "all clear" empty state — may reuse the checkmark motif from `ICON_APPROVALS` in `src/components/layout/AppShell.ts` (nav icon for this same page) for visual continuity with the page's own nav icon, if the shape adapts cleanly at empty-state size; otherwise a plain check-circle in the same stroke style is acceptable.

If a new primitive is required: these four new icons belong only in `ApprovalsPage.ts` as local `const ICON_*` declarations — the codebase has no shared icon module today (each page redeclares its own, including duplicate `ICON_TRANSFER`/`ICON_PLUS`/`ICON_CLOSE` shapes across `DashboardPage.ts`, `TransactionsPage.ts`, `FundsPage.ts`, `MembersPage.ts`). Do not introduce a shared icon module as part of this fix — that would widen scope beyond this surface and duplicate-vs-consolidate is not this plan's problem to solve.

## Changes

1. `src/pages/ApprovalsPage.ts` — add icon constants
   - Change: add `ICON_CLOCK`, `ICON_RECEIPT` (both copied verbatim from `DashboardPage.ts`), and new `ICON_CHECK`, `ICON_UNDO`, `ICON_CLOSE`, `ICON_CHECK_CIRCLE` as module-level `const` declarations above the `ApprovalsPage` class, matching the existing declaration style (template-literal SVG strings, `aria-hidden="true" focusable="false"`, `stroke="currentColor"` or token color where the emoji it replaces carried color).
   - Preserve: no existing constant, import, or class member is touched by this step.
   - Verify: file still compiles; no duplicate `const` names.

2. `src/pages/ApprovalsPage.ts:166` — receipt link in detail panel
   - Change: replace the `📎 มีเอกสารใบเสร็จแนบ` text with `${ICON_RECEIPT} มีเอกสารใบเสร็จแนบ` (icon sized down to sit inline with the 0.82rem text, e.g. via a wrapping `<span>` with explicit small width/height override, or by using the icon at its native 18px and accepting the slightly larger glyph — pick whichever keeps the link visually balanced).
   - Preserve: the `<a>` element, `href`, `target`, `rel`, and surrounding text exactly as-is.
   - Verify: rendered link shows an SVG receipt icon before the text, no layout shift beyond the icon's own footprint.

3. `src/pages/ApprovalsPage.ts:184,186` — primary "อนุมัติ" button in detail panel (enabled and disabled variants)
   - Change: replace `>✓ อนุมัติ</button>` with `>${ICON_CHECK}<span>อนุมัติ</span></button>` in both the enabled and `disabled` button variants, following the `${ICON_X}<span>label</span>` structure from the Dashboard exemplar.
   - Preserve: `gl-btn gl-btn--primary`/`gl-btn-approve` classes, `data-id`, `disabled` attribute and its styling, `min-height: 48px` sizing.
   - Verify: both button states (enabled for non-creator, disabled for creator) render the checkmark icon plus label; existing `attachEventListeners` selector `.gl-btn-approve` still matches (selector is class-based, unaffected by inner content change).

4. `src/pages/ApprovalsPage.ts:189` — "ขอแก้ไข" (request revision) button
   - Change: replace `>↩ ขอแก้ไข</button>` with `>${ICON_UNDO}<span>ขอแก้ไข</span></button>`.
   - Preserve: `gl-btn gl-btn--secondary gl-btn-request-revision` classes, `data-id`, sizing.
   - Verify: `.gl-btn-request-revision` selector in `attachEventListeners` still matches; icon renders before label.

5. `src/pages/ApprovalsPage.ts:191` — "ปฏิเสธ" (reject) button
   - Change: replace `>✗ ปฏิเสธ</button>` with `>${ICON_CLOSE}<span>ปฏิเสธ</span></button>`, keeping the existing `color: var(--expense)` inline style so the icon (via `currentColor`) and label both render in the expense/red tone.
   - Preserve: `gl-btn gl-btn--secondary gl-btn-reject` classes, `data-id`, sizing, the `color: var(--expense)` styling.
   - Verify: `.gl-btn-reject` selector still matches; icon and text both render in expense red.

6. `src/pages/ApprovalsPage.ts:243` — receipt flag in list-row metadata
   - Change: replace `📎 ใบเสร็จ` with `${ICON_RECEIPT} ใบเสร็จ` (icon sized to sit inline with the 0.75rem meta text — same sizing judgment call as change 2).
   - Preserve: the `color: var(--income)` wrapping span, surrounding "บันทึกโดย" text and layout.
   - Verify: rendered card shows the receipt icon inline with "ใบเสร็จ" in income-green.

7. `src/pages/ApprovalsPage.ts:259` — quick-approve button on list row
   - Change: replace `>✓ อนุมัติ</button>` with `>${ICON_CHECK}<span>อนุมัติ</span></button>`.
   - Preserve: `gl-btn gl-btn--primary gl-btn--sm gl-quick-approve` classes, `data-id`, `aria-label`, sizing.
   - Verify: `.gl-quick-approve` selector still matches; the JS that sets `btn.textContent = "กำลังอนุมัติ…"` on click (line 425) still works since it targets `textContent` — confirm this doesn't need to become `innerHTML`/a separate label update to avoid wiping the icon during the in-flight "approving…" state, and adjust that click handler if needed so the icon isn't silently dropped mid-action.

8. `src/pages/ApprovalsPage.ts:327` — loading state icon
   - Change: replace the `⏳` div content with `ICON_CLOCK` (sized larger than its 20px default to match the prior 1.5rem/24px emoji weight — wrap in a sized container or pass explicit width/height on this usage).
   - Preserve: the surrounding `gl-card` loading container, "กำลังโหลดรายการรออนุมัติ…" text.
   - Verify: loading state renders the clock icon instead of the hourglass emoji.

9. `src/pages/ApprovalsPage.ts:362` — empty state icon
   - Change: replace the `✅` div content with `ICON_CHECK_CIRCLE` (sized to match the prior 2.5rem emoji weight).
   - Preserve: surrounding empty-state copy and card.
   - Verify: empty state renders the check icon instead of the checkmark emoji.

## Scope

- Inherit: none — every change is local to `ApprovalsPage.ts`; no other page imports from or renders through this file.
- Verify: `tests/unit/approvals-page-ui.test.ts` lines 60, 82, 165 assert `toContain("⏳")`, `toContain("✅")`, `toContain("📎")` respectively — these must be updated to assert on the new SVG markup (or a stable marker within it, e.g. a distinguishing `<path>`/`<circle>` fragment unique to each new icon) rather than deleted or loosened to a no-op assertion.
- Exclude: `renderDirectionIcon` (income/expense/transfer glyph — already SVG, untouched); the emoji present in `OfferingPage.ts` (separate surface, explicitly out of scope per this audit — CLAUDE.md notes it as "complex but stable," not part of this task); any shared/consolidated icon module (not introduced by this plan, see Reuse section).

## Validation

- Product: open the approvals queue as a church user with at least one pending item that has a receipt attached; step through loading → list → detail panel → each of the three actions (approve, request revision, reject) → confirm empty state after clearing the queue. Every icon slot shows an SVG glyph, never emoji.
- Interface: `#/approvals` route, desktop and 390px, both the list-row quick-approve button and the detail-panel action strip, both the enabled and disabled (`isCreator`) states of the approve button, light and dark theme if the app has a dark mode toggle active.
- System: after the change, grep `ApprovalsPage.ts` for the emoji characters (`⏳ ✅ ✓ ↩ ✗ 📎`) and confirm zero remaining matches; confirm the new `ICON_*` constants follow the same declaration shape (`aria-hidden="true" focusable="false"`, `stroke="currentColor"` or explicit token color) as `DashboardPage.ts`/`TransactionsPage.ts` so no new parallel icon-styling convention is introduced.
- Repository: `npx vitest run tests/unit/approvals-page-ui.test.ts` → all tests pass (including the three updated assertions); `npm run build` → typecheck clean.

## Stop conditions

- Stop if the quick-approve button's in-flight `textContent = "กำลังอนุมัติ…"` update (change 7) turns out to require a broader rework of that click handler than a one-line adjustment — flag it rather than expanding this plan into an interaction-logic change.
- Stop if no existing icon shape in the repo can be adapted for `ICON_CHECK_CIRCLE` without visually diverging from the stroke-icon style used everywhere else — surface the discrepancy instead of inventing a filled/different-style icon.

## Design documentation

- After acceptance and validation: none — this restores existing documented policy (CLAUDE.md's emoji ban and the established `ICON_*` convention), it does not create a new design decision to record.
