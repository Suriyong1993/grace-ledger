# Replace raw hex `#10b981` with the `--success` token in the PIN-setup success state

Written against: `40d02bbb539ea2cb73d10e3beac8a023cb4e7640` (branch `fix/ui-design-system-conformance`)

## Evidence chain

- Surface: Login surface family — PIN setup success card ("ตั้งรหัส PIN สำเร็จ!"), rendered by `PinSetupPage` inside `.gl-login-screen`.
- Problem: `.gl-setup-success-icon` colors its checkmark and background with raw hex `#10b981` — a green that exists nowhere in the design system's palette.
- Design evidence:
  - `src/components/login/loginStyles.ts:407–417` — `background: color-mix(in srgb, #10b981 15%, transparent); color: #10b981;`
  - Binding contract: `CLAUDE.md` Design section — "Reuse existing tokens: color… No new palette"; adherence lint `design-system-extracted/_adherence.oxlintrc.json:35` — "Raw hex color — use a design-system color token via var()"; `CLAUDE.md` — positive/success color is emerald via fixed-meaning tokens.
  - The correct token exists and is theme-aware: `--success: var(--gl-emerald-600)` (light, `tokens/colors.css:66`) and `--success: oklch(0.65 0.14 155)` (dark, `tokens/colors.css:133`). `--gl-emerald-600: #16a34a` ≠ `#10b981`, so the raw value is a genuinely different color, not a copy of the token.
  - Runtime path: `PinSetupPage.ts:32` injects `renderLoginStylesHtml()`; `PinSetupView.ts:42–47` renders `.gl-setup-success-icon`; the tokens reach the surface via `index.html` → `src/styles/app.css` → `design-system-extracted/styles.css`.
- Owner: `src/components/login/loginStyles.ts`
- Scope and affected surfaces: `.gl-setup-success-icon` only (PIN setup success card). Both light and dark themes.
- Uncertainty: none.

## Design decision

Swap the two raw hex references for the existing `--success` token. This restores the tokens-only contract and makes the success icon follow the theme switch like every other success/positive element in the product (e.g. `.gl-notice--success` in `app.css:365–369` already goes through tokens). Visual identity is preserved: `--success` is the system's green; the 15% background tint recipe stays.

## Reuse

- Token: `--success` (`design-system-extracted/tokens/colors.css:66` light / `:133` dark)
- Exemplar: `.gl-setup-success-icon`'s own `color-mix` background pattern; tokenized sibling `.gl-notice--success` (`src/styles/app.css:365–369`)
- No new primitive required.

## Changes

1. `src/components/login/loginStyles.ts` — `.gl-setup-success-icon` (lines ~407–417)
   - Change: Replace `background: color-mix(in srgb, #10b981 15%, transparent);` with `background: color-mix(in srgb, var(--success) 15%, transparent);` and `color: #10b981;` with `color: var(--success);`. Nothing else in the rule changes.
   - Preserve: icon dimensions (64px circle), flex centering, `margin-bottom: var(--space-4)`, and the inline SVG checkmark in `PinSetupView.ts:43–46`.
   - Verify: computed `color` of `.gl-setup-success-icon` resolves to the `--success` value (light: `#16a34a`; switches with `.dark`); raw `#10b981` no longer present anywhere in the file.

## Scope

- Inherit: PIN setup success card (only consumer of `.gl-setup-success-icon`).
- Verify: light **and** dark theme rendering of the success card; `tests/unit/pin-setup-ui.test.ts` (asserts `gl-setup-success-card` markup — untouched).
- Exclude: `.gl-bootstrap-status-icon` coloring (covered by Plan 01), all other green/positive surfaces, any token renames.

## Validation

- Product: Complete the PIN setup flow via magic link → success card shows a green check consistent with the app's success color before auto-redirect.
- Interface: The success card at desktop and 390px, in light and dark themes — icon legible on both.
- System: `grep`-level proof that the surface contains no raw hex from this change; palette comes solely from `tokens/colors.css`.
- Repository: `npm run build` → exit 0; `npm test` → green; `Select-String -Path src\components\login\loginStyles.ts -Pattern '#10b981'` → no matches.

## Stop conditions

- Stop if `--success` has been renamed/removed on rebase — re-resolve the token before editing; do not substitute a different green by eye.
- Stop if the success card markup has moved out of the login surface family (ownership change).

## Design documentation

- None. The tokens-only rule is already documented in `CLAUDE.md`; this change restores conformance, it does not alter a decision.
