# Remove English parentheticals and internal vocabulary from Thai UI copy

Written against: `0ab8446979a9a1f8c43b686958312e6b88ffac2c` (branch `main`)

## Evidence chain

- Surface: Grace AI confirmation modal (`ProposalConfirmationModal`, reached via `GraceAiDrawer.ts:222` -> `main.ts:319`, present on every authenticated route) and the Reports screen (`ReportsPage`, route `/reports`).
- Problem: Thai UI strings carry English glosses in parentheses, and one control prints a raw database enum as its user-facing label. The same product concept is also named two different ways in Thai across screens.
- Design evidence:
  - `CLAUDE.md` Writing: "No internal vocabulary in the UI: no 'Screen 06', no 'Slice 3 E2E ...', no 'PostgreSQL 17', no '(Status: counting)', no raw exception strings."
  - `CLAUDE.md` Writing: "No bilingual double-labels - 'จัดการผลต่าง (Variance Resolution)' is documentation, not UI. Pick Thai."
  - Direct contradiction inside one control: `ReportsPage.ts:210-215` renders the month tablist with Thai qualifiers on every tab (`(ย้อนหลัง)`, `(ตรวจทาน)`) except the first, which is English (`(Live)`).
  - Direct contradiction across screens: the posting concept is called `ลงบัญชี` at `ReportsPage.ts:310` and `โพสต์` at `ProposalConfirmationModal.ts:47`.
  - Runtime path: both files render through `renderHtml()` string composition into `#app` (`main.ts:311-321`); every string listed below reaches the screen unmodified.
- Owner: the two page/component files listed under Changes. There is no shared copy module; `src/lib/format.ts` owns only date and error-message presentation.
- Scope and affected surfaces: 6 strings across 2 files.
- Uncertainty: the `CONFIRMATION_ID:` / `PAYLOAD_HASH:` identifier block at `ProposalConfirmationModal.ts:162-164` is also raw internal vocabulary, but the evidence supports more than one correction (translate the labels, or drop the block as security-context noise). It is excluded here and needs a product decision.

## Design decision

Replace each English gloss with the Thai term the product already uses elsewhere, and replace the raw enum label with the Thai action names already present in the same file. This resolves the root problem, which is that English is being used as a clarifying crutch beside Thai rather than the UI committing to Thai. No string is deleted for brevity alone; each removal either restates what the Thai already says or is replaced with an existing in-product Thai term.

## Reuse

- Thai action names already declared in the same function: `ProposalConfirmationModal.ts:44-50` (`ยืนยันการโอนเงิน`, `ยืนยันโพสต์รายการ`, `ยืนยันยกเลิกรายการ`) supply the per-action wording for the badge at line 85.
- `ลงบัญชี` as the Thai term for posted, established at `ReportsPage.ts:310` and reused in the empty-state heading at `ReportsPage.ts:309`.
- Exemplar of Thai-only role copy: `src/components/approvals/ApprovalDecisionSheet.ts:71` states a condition in Thai with no English gloss.
- No new token, primitive, or copy module required.

## Changes

1. `src/components/ai/ProposalConfirmationModal.ts:49`
   - Change: `ยืนยันยกเลิกรายการ (Void) ${proposal.amount}` -> `ยืนยันยกเลิกรายการ ${proposal.amount}`.
   - Preserve: the amount interpolation and the surrounding `if/else if` branch structure.
   - Verify: the void-action modal title reads Thai-only.

2. `src/components/ai/ProposalConfirmationModal.ts:47`
   - Change: `ยืนยันโพสต์รายการ` -> `ยืนยันลงบัญชีรายการ`, matching `ReportsPage.ts:310`.
   - Preserve: the amount interpolation.
   - Verify: the posting concept reads `ลงบัญชี` on both the modal and the Reports screen.

3. `src/components/ai/ProposalConfirmationModal.ts:85`
   - Change: replace `${proposal.action.replace("_", " ")}` with a Thai label derived from `proposal.action` using the same three-branch mapping already computed for `actionTitle` at lines 44-50: `fund_transfer` -> `โอนเงิน`, `post_transaction` -> `ลงบัญชี`, `void_transaction` -> `ยกเลิกรายการ`, with a Thai default of `ทำรายการ`. Hoist the mapping to a `const` beside `actionTitle` so both use one source.
   - Preserve: the `gl-badge gl-badge--action` classes and the surrounding flex row. Remove `text-transform: uppercase` from the inline style, which has no meaning for Thai script.
   - Verify: the badge reads `โอนเงิน` / `ลงบัญชี` / `ยกเลิกรายการ`, never `FUND TRANSFER`.

4. `src/components/ai/ProposalConfirmationModal.ts:183`
   - Change: `เฉพาะเหรัญญิก (Treasurer) หรือผู้ดูแลระบบเท่านั้น...` -> `เฉพาะเหรัญญิกหรือผู้ดูแลระบบเท่านั้น...`.
   - Preserve: the `role="alert"` attribute, the `<strong>` lead-in, and the destructive styling.
   - Verify: the unauthorized banner reads Thai-only and is still announced.

5. `src/pages/ReportsPage.ts:310`
   - Change: `...ผ่านการอนุมัติและลงบัญชี (Posted) ในช่วงเวลา...` -> `...ผ่านการอนุมัติและลงบัญชีในช่วงเวลา...`.
   - Preserve: the empty-state layout and the `max-width: 420px` measure.
   - Verify: the empty-state paragraph reads Thai-only.

6. `src/pages/ReportsPage.ts:210`
   - Change: `ส.ค. 2569 (Live)` -> `ส.ค. 2569`.
   - Preserve: the `data-period="2026-08"` attribute, the `is-active` conditional, and every other tab label including the Thai qualifiers `(ย้อนหลัง)` and `(ตรวจทาน)`.
   - Verify: no English remains in the tablist; the Thai qualifiers still distinguish historical and under-review periods.

## Scope

- Inherit: the proposal confirmation modal on every authenticated route, all three proposal actions, and the `/reports` empty and populated states.
- Verify: search for further English glosses with `grep -rnoE "[ก-๙][^\"\`<>]{0,30}\([A-Za-z ]{3,30}\)" src/` after the change; expect no matches in user-facing strings.
- Exclude: the `CONFIRMATION_ID:` / `PAYLOAD_HASH:` block (`ProposalConfirmationModal.ts:162-164`) pending a product decision; the hardcoded `data-period` month values in the tablist, which are a data-wiring concern, not a design one; all font, spacing, and color work.

## Validation

- Product: a treasurer opens the void-action confirmation modal and the Reports empty state and can read every word without knowing English.
- Interface: all three proposal actions; the unauthorized and expired modal states; `/reports` with and without posted transactions; desktop and 390px, where the longer Thai badge label must not wrap the badge row.
- System: confirm the action label is derived from one mapping shared with `actionTitle`, not a second parallel switch.
- Repository: `npm test` -> 19 test files / 148 tests pass. `npm run build` -> typecheck clean.

## Stop conditions

- Stop and report if a UI test asserts on the literal strings `(Void)`, `(Treasurer)`, `(Posted)`, `(Live)`, or the uppercased enum. Update the assertion to the new Thai string; never weaken it to a substring match that would pass either way.
- Stop if `proposal.action` can hold a value outside the three known branches; the Thai default `ทำรายการ` must then be confirmed as acceptable rather than assumed.
- Stop if the Thai badge label overflows the flex row at 390px; that is a layout decision outside this plan's scope.

## Design documentation

- After acceptance and validation: record in `CLAUDE.md` under Writing that `ลงบัญชี` is the app-wide Thai term for the posted state, so the `โพสต์` variant does not reappear.
