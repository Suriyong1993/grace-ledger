# Restore Inter tabular numerals on the proposal confirmation amount

Written against: `0ab8446979a9a1f8c43b686958312e6b88ffac2c` (branch `main`)

## Evidence chain

- Surface: Grace AI confirmation modal (`renderProposalConfirmationModalHtml`), rendered by `GraceAiDrawer.ts:222` inside the drawer that `main.ts:319` appends to every authenticated route.
- Problem: The confirmation amount carries `class="num-display"` but an inline `font-family: var(--font-mono)` overrides it. `--font-mono` is not defined anywhere in the project, so the declaration is invalid at computed-value time. Because `font-family` is an inherited property, it does not fall back to the class value — it computes to the value inherited from the parent element. The amount on the confirm-then-execute screen therefore renders in the ambient Sarabun stack without `tabular-nums`, `lining-nums`, or `slashed-zero`.
- Design evidence:
  - `design-system-extracted/tokens/typography.css:4-6` — "No `--font-mono` token: the source repo declares one ("JetBrains Mono") but no screen uses it and no font binary ships with the product. Add it back once a licensed font file exists." The absence is a documented decision, not an omission.
  - `design-system-extracted/tokens/typography.css:35-41` — `.num-display` is the design system's owner for money values: `font-variant-numeric: lining-nums tabular-nums slashed-zero`, `font-feature-settings:"tnum" 1,"lnum" 1,"zero" 1,"ss01" 1`, `font-family:"Inter", var(--font-sans)`.
  - `design-system-extracted/SKILL.md:11` — "Sarabun for Thai text + Inter for numerals/Latin."
  - `src/styles/app.css:56-59` — the application stylesheet states that the design system owns `.num-display` and that the app adds only currency-mark spacing to it.
- Owner: `design-system-extracted/tokens/typography.css` (`.num-display`)
- Scope and affected surfaces: three inline declarations in `src/components/ai/ProposalConfirmationModal.ts` — line 78 (TTL countdown badge), line 89 (amount), line 162 (confirmation id / payload hash block).
- Uncertainty: none. The token's absence is documented, and `.num-display` is the named owner for the amount.

## Design decision

Delete `font-family: var(--font-mono)` from all three sites. Line 89 then falls under `.num-display`, which is the design system's declared owner for every money value, restoring Inter and tabular numerals. Lines 78 and 162 inherit `--font-sans`, which is the correct stack for a countdown string and an identifier block given that the system ships no monospace face. Do not add a `--font-mono` token: `typography.css:4-6` states the token is withheld deliberately until a licensed font file exists, so introducing one would reverse a documented decision without the asset that justifies it.

## Reuse

- `.num-display` (`design-system-extracted/tokens/typography.css:35-41`) — already applied at line 89; the change simply stops overriding it.
- `--font-sans` (`design-system-extracted/tokens/typography.css:2`) — inherited default for lines 78 and 162.
- Exemplar: `src/components/offering/OfferingReviewSheet.ts:92` and `src/components/offering/VarianceResolutionView.ts:272` apply `.num-display` to money with no inline `font-family`.
- No new token or primitive required.

## Changes

1. `src/components/ai/ProposalConfirmationModal.ts` line 78 — `.gl-countdown-badge` span
   - Change: remove `font-family: var(--font-mono); ` from the inline style. Keep `font-weight: var(--weight-bold)` and the conditional `color`.
   - Preserve: the expired/active class toggle and the `--destructive` / `--warning` color branch.
   - Verify: the countdown renders in the Sarabun/Inter body stack; no other visual change.

2. `src/components/ai/ProposalConfirmationModal.ts` line 89 — amount span
   - Change: remove `; font-family: var(--font-mono)` from the inline style, leaving `font-size: var(--text-lg); font-weight: var(--weight-bold)` and `class="num-display"`.
   - Preserve: `class="num-display"`, the font-size and font-weight tokens, and `${proposal.amount}`.
   - Verify: in devtools the amount's computed `font-family` starts with `Inter`, and `font-variant-numeric` reads `lining-nums tabular-nums slashed-zero`. Digits are equal-width; the zero is slashed.

3. `src/components/ai/ProposalConfirmationModal.ts` line 162 — identifier block
   - Change: remove `font-family: var(--font-mono); ` from the inline style. Leave the remaining declarations untouched in this plan; the raw `font-size: 10px` on the same line is a separate finding and is out of scope here.
   - Preserve: `background`, `border-radius`, `padding`, `color`, `word-break`, `margin-bottom`, and both identifier lines.
   - Verify: the block still wraps on long hashes and stays visually recessed.

## Scope

- Inherit: every render of the proposal confirmation modal, on every authenticated route, for all three proposal actions (`fund_transfer`, `post_transaction`, `void_transaction`).
- Verify: no other file references `--font-mono`; confirm with `grep -rn "font-mono" src/`.
- Exclude: adding a `--font-mono` token or a monospace webfont; the raw `font-size: 10px` at line 162; the raw `rgba()` colors at lines 57 and 176; all Thai copy changes (covered by plan 05).

## Validation

- Product: open the Grace AI drawer, trigger an `ACTION_PROPOSAL`, and read the amount on the confirmation modal. The figure must be legible as money at a glance, with digits aligned in a fixed advance width.
- Interface: check all three proposal actions; check the expired and active countdown states; check the unauthorized banner state; check at desktop and 390px.
- System: confirm `.num-display` is the only owner of the amount's font stack and that no parallel money-font pattern remains in the file.
- Repository: `npm test` -> 19 test files / 148 tests pass. `npm run build` -> typecheck clean. `grep -rn "font-mono" src/` -> no matches.

## Stop conditions

- Stop if `grep` finds a `--font-mono` definition in the repository: the invalid-declaration premise then fails and the finding must be re-evaluated.
- Stop if a UI test asserts on the literal string `font-family: var(--font-mono)`; report the test before changing it, since CLAUDE.md forbids loosening an assertion to nothing.
- Stop if removing the declaration at line 89 does not change the computed font stack; that would mean the parent already resolves to Inter and the finding's consequence is overstated.

## Design documentation

- After acceptance and validation: none. `typography.css:4-6` already records the decision; this change brings a consumer into line with it rather than establishing anything new.
