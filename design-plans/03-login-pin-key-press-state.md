# Align PIN keypad press state with the documented motion contract

Written against: `40d02bbb539ea2cb73d10e3beac8a023cb4e7640` (branch `fix/ui-design-system-conformance`)

## Evidence chain

- Surface: Login surface family — PIN entry keypad (`LoginPage` → `PinEntryView`), rendered inside `.gl-login-screen` with `renderLoginStylesHtml()`.
- Problem: The keypad's `:active` press state uses `scale(0.92)` and a background color change — both outside the documented press contract, making the press feel heavier and flashier than the system allows.
- Design evidence:
  - `src/components/login/loginStyles.ts:346–349` — `.gl-pin-key:active:not(:disabled) { transform: scale(0.92); background: var(--accent); }`
  - Binding contract: `design-system-extracted/readme.md:47` — "Hover = subtle background tint or border-color shift, never a scale-up. **Press = scale(0.97–0.98) only, no color flash.**" (background tint on hover stays allowed; it is not part of this change).
  - Exemplar of the correct press inside the same file: `.gl-profile-card:active { transform: scale(0.98); }` (`loginStyles.ts:114–116`).
  - Runtime path: `PinEntryView.ts:127–136` emits `.gl-pin-key` buttons → `loginStyles.ts` inline `<style>` → the rule reaches every keypress on the PIN screen.
- Owner: `src/components/login/loginStyles.ts`
- Scope and affected surfaces: `.gl-pin-key:active:not(:disabled)` only — all 12 keypad keys (digits, ล้าง, backspace) on the PIN entry screen.
- Uncertainty: none — both the contract value and an in-file exemplar agree on `0.98`.

## Design decision

Bring the press state to the documented spec: `scale(0.98)` and no background change on press. The key's resting presentation (card background, 1px border) already gives the press enough feedback through scale alone, and the hover tint at `:hover` is unaffected. This is the smallest change that removes the contract violation without touching keypad geometry, sizes, or the reduced-motion guard (already provided globally by `design-system-extracted/tokens/motion.css:11–13`).

## Reuse

- Value: `scale(0.98)` — documented press range (0.97–0.98) and in-file exemplar (`.gl-profile-card:active`)
- Exemplar: `.gl-profile-card:active` (`loginStyles.ts:114–116`)
- No new token or primitive required.

## Changes

1. `src/components/login/loginStyles.ts` — `.gl-pin-key:active:not(:disabled)` (lines ~346–349)
   - Change: Replace the rule body with `transform: scale(0.98);` and remove `background: var(--accent);`. The transition block on `.gl-pin-key` (background-color transition becomes inert for press; keep it — hover still uses it) stays as is.
   - Preserve: `.gl-pin-key` base, `:hover:not(:disabled)` tint + border mix (allowed by contract), `:disabled` state, keypad grid, 56px/52px key sizes (asserted by `scripts/verify_acceptance_test.mjs:45–47`), and the shake animation on `#login-pin-group`.
   - Verify: pressing a key scales it down subtly with no orange flash; hover tint unchanged; keyboard `Enter`/digit flow untouched (`LoginPage.ts:218–250`).

## Scope

- Inherit: PIN entry screen (all 12 keys).
- Verify: mobile 390px (primary keypad surface) and desktop keyboard-driven entry; `prefers-reduced-motion` users — global guard collapses the scale transition automatically.
- Exclude: `.gl-pin-dot` fill spring (token `--ease-spring` is an official DS token — out of scope), `.gl-pin-group[data-shake]` error animation (deliberate, guarded), `.gl-profile-*` press rules (dead CSS handled by Plan 01), all hover states.

## Validation

- Product: Enter a wrong PIN → keys press cleanly (subtle scale, no color flash) → error status + shake still fire; enter a correct PIN → authenticates.
- Interface: Desktop and 390px; press-and-hold a key; rapid multi-key taps; disabled keys during `checking`/`locked` show no press effect.
- System: No press state in the login surface exceeds the 0.97–0.98 scale range or changes background on press; hover/press division matches `readme.md:47`.
- Repository: `npm run build` → exit 0; `npm test` → green; `node scripts/verify_acceptance_test.mjs` → keypad size assertions still pass.

## Stop conditions

- Stop if `readme.md`'s press range has been revised on rebase (re-read `readme.md:47` before editing — the contract, not the exemplar, is authoritative).
- Stop if the keypad rule has been renamed/moved out of `loginStyles.ts` (ownership change).

## Design documentation

- None. The press contract already exists in `design-system-extracted/readme.md:47`; this change restores conformance.
