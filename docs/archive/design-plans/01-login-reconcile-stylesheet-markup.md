# Reconcile the login stylesheet owner with the rendered login markup

Written against: `40d02bbb539ea2cb73d10e3beac8a023cb4e7640` (branch `fix/ui-design-system-conformance`)

## Evidence chain

- Surface: Login surface family — profile select (`LoginPage` → `ProfileSelectView`), bootstrap modal, PIN entry (`PinEntryView`), PIN setup (`PinSetupPage` → `PinSetupView`). All render through `renderLoginStylesHtml()` into `.gl-login-screen`.
- Problem: The rendered markup and its stylesheet owner are out of sync. Every profile/bootstrap class the views actually emit has **no CSS rule anywhere the surface loads**, while the stylesheet's profile rules target a markup shape (`ul.gl-profile-grid > li > button.gl-profile-card`) that the views no longer emit. Result: profile buttons and the bootstrap modal form render with default browser styling (UA button chrome, UA fonts, no grid, unstacked action buttons).
- Design evidence:
  - Rendered classes with zero definitions (exhaustive grep of `src/**/*.{ts,css}` returned no rule): `gl-login-eyebrow`, `gl-login-profiles`, `gl-login-profiles--row-compact`, `gl-login-profiles--row`, `gl-login-profiles--grid`, `gl-profile-item`, `gl-profile-item--row`, `gl-profile-item--card`, `gl-profile-avatar--sm`, `gl-profile-role--inline`, `gl-login-profiles-hint`, `gl-login-text-btn`, `gl-bootstrap-status-icon`, `gl-bootstrap-field`, `gl-bootstrap-actions` (`src/components/login/ProfileSelectView.ts:33,82,87–88,105,110,113,123,150,177–184`).
  - Dead CSS never reached by markup: `.gl-profile-grid`, `.gl-profile-grid > li`, `.gl-profile-card` + `:hover`/`:active`/`:focus-visible`/`[data-selected="true"]` + card-avatar rules (`src/components/login/loginStyles.ts:78–149`) and the responsive `.gl-profile-grid`/`.gl-profile-card` rules (`loginStyles.ts:485–496`); also `.gl-bootstrap-trigger-wrap`/`.gl-bootstrap-trigger-btn` (`loginStyles.ts:430–454`) — the trigger markup uses `gl-login-text-btn`, not these.
  - Internal contradiction in the same component: the bootstrap dialog shell IS styled (`gl-bootstrap-dialog/title/desc`, `loginStyles.ts:456–475`) but its field/label/actions are not.
  - Binding rules: `CLAUDE.md` Design section (tokens-only; touch targets ≥44px via `--touch-target-min`, defined in `design-system-extracted/tokens/spacing.css:17`); `design-system-extracted/readme.md:47` — hover = tint/border shift, never a scale-up.
- Owner: `src/components/login/loginStyles.ts` (single stylesheet owner for the surface; markup files are NOT changed).
- Scope and affected surfaces: `LoginPage` (profiles view incl. bootstrap modal, PIN view), `PinSetupPage` — everything rendering `renderLoginStylesHtml()`.
- Uncertainty: Exact visual rhythm of the new `.gl-login-eyebrow` and `.gl-login-text-btn` (no rendered predecessor — their recipes are reconstructed from sibling rules in the same file, cited below). Verify against the design-rulebook vibe (Calm · Exact · Spacious · Quiet · Honest) in a browser before finishing.

## Design decision

Re-align the single stylesheet owner (`loginStyles.ts`) to the markup that actually renders, by (a) moving the existing `.gl-profile-card` composition values onto the classes the views emit (`.gl-profile-item--card/--row` + `.gl-login-profiles` layout variants), (b) defining the missing eyebrow/text-button/bootstrap-form classes from existing tokens and sibling recipes, and (c) deleting the dead rules. One correction at the root: the owner stylesheet and the rendered markup describe the same composition again. No markup, no tokens, and no new scales are introduced; component tests assert on markup strings and are unaffected.

Note on one migrated value: the dead `.gl-profile-card:hover .gl-profile-avatar { transform: scale(1.06) }` rule violates the binding hover contract (`readme.md:47` "never a scale-up"). Because it never reached the surface, it was never accepted presentation — do **not** carry the hover scale into the live class; migrate only the `data-selected` scale (a state change, which the contract allows).

## Reuse

- Tokens (all existing): `--space-*`, `--text-xs/sm/base`, `--weight-semibold`, `--tracking-heading`, `--border`, `--card`, `--primary`, `--ring`, `--secondary`, `--muted-foreground`, `--foreground`, `--success`, `--radius-xl`, `--radius-sm`, `--radius-full`, `--duration-micro`, `--ease-out`, `--ease-spring`, `--touch-target-min`.
- Exemplars inside the same file:
  - Card presentation + hover/focus/selected treatment: current `.gl-profile-card` block (`loginStyles.ts:89–149`).
  - Compact row presentation: current mobile responsive card rules (`loginStyles.ts:489–497`).
  - Text button recipe: current `.gl-bootstrap-trigger-btn` (`loginStyles.ts:436–454`) — plus `min-height: var(--touch-target-min)` per `CLAUDE.md`.
  - Form-field layout: `.gl-field` (`src/styles/app.css:391–395`); label/select already covered by `.gl-label`/`.gl-input` (`app.css:397–427`) which the markup already carries.
  - Success-icon treatment (green + bottom margin): `.gl-setup-success-icon` (`loginStyles.ts:407–417`).
- No new primitive is required: every rule re-expresses an existing pattern in the owner file or `app.css`.


## Changes

All changes in `src/components/login/loginStyles.ts` only. **Do not touch any view file.**

1. `src/components/login/loginStyles.ts` — delete dead rules
   - Change: Remove `.gl-profile-grid`, `.gl-profile-grid > li`, the whole `.gl-profile-card` family (`:hover`, `:active`, `:focus-visible`, `[data-selected="true"]`, `.gl-profile-card:hover .gl-profile-avatar`, `.gl-profile-card[data-selected="true"] .gl-profile-avatar`), the responsive `.gl-profile-grid`/`.gl-profile-card` rules in the `@media (max-width: 640px)` block, and `.gl-bootstrap-trigger-wrap` + `.gl-bootstrap-trigger-btn` (their recipe is reused by `.gl-login-text-btn` below).
   - Preserve: The `@media (max-width: 640px)` block's `.gl-login-screen`, `.gl-login-brand`, `.gl-login-heading`, `.gl-profile-avatar`, `.gl-profile-text`, `.gl-profile-role`, `.gl-profile-chevron`, `.gl-pin-keypad`, `.gl-pin-key` rules.
   - Verify: `Select-String -Path src\components\login\loginStyles.ts -Pattern 'gl-profile-card|gl-profile-grid|gl-bootstrap-trigger'` → no matches.

2. `src/components/login/loginStyles.ts` — container layouts (replaces old `.gl-profile-grid`)
   - Change: Add
     - `.gl-login-profiles { width: 100%; max-width: 880px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4); }` (values from old `.gl-profile-grid`, `loginStyles.ts:78–87`)
     - `.gl-login-profiles--row-compact { display: flex; justify-content: center; }`
     - `.gl-login-profiles--row`, `.gl-login-profiles--grid` — inherit the base container (no extra rules).
     - In `@media (max-width: 640px)`: `.gl-login-profiles { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); }` (from old responsive rule, `loginStyles.ts:485–488`).
   - Preserve: `#login-profile-list` id hook and markup (`ProfileSelectView.ts:82`).
   - Verify: 2–4 profiles lay out as a multi-column grid; 5+ likewise; single profile is centered inline.


3. `src/components/login/loginStyles.ts` — profile items (replaces old `.gl-profile-card`)
   - Change: Add `.gl-profile-item--card` with the exact composition of the old `.gl-profile-card` block (`loginStyles.ts:89–108`): flex column, centered, `gap: var(--space-4)`, `width: 100%`, `min-height: 190px`, `padding: var(--space-6) var(--space-4)`, `font-family: inherit`, `color: inherit`, `cursor: pointer`, `text-align: center`, `border: 1px solid var(--border)`, `border-radius: var(--radius-xl)`, `background: var(--card)`, and the same transition block. Re-target from the dead rules, unchanged except the class name: `:hover` (border-color `var(--primary)`, translateY(-2px), primary-tinted shadow), `:active` (`scale(0.98)`), `:focus-visible` (2px `var(--ring)` outline, offset 2px), `[data-selected="true"]` (primary border + `0 0 0 3px var(--accent)` ring), and the `[data-selected="true"] .gl-profile-avatar` primary treatment (`loginStyles.ts:109–149`).
     - **Drop** the `:hover .gl-profile-avatar { transform: scale(1.06) }` rule when migrating (see Design decision). Keep `[data-selected="true"] .gl-profile-avatar` scale.
   - Change: Add `.gl-profile-item--row` — the compact row presentation from the old mobile rules (`loginStyles.ts:493–496`) promoted to base: flex row, `align-items: center`, `justify-content: flex-start`, `text-align: left`, `min-height: 72px`, `padding: var(--space-3) var(--space-4)`, plus the same border/radius/background/cursor/transition as `--card`, and the same hover/focus-visible/selected re-targets.
   - Change: In `@media (max-width: 640px)` add `.gl-profile-item--card { flex-direction: row; align-items: center; justify-content: flex-start; text-align: left; min-height: 72px; padding: var(--space-3) var(--space-4); }` (old mobile collapse, retargeted).
   - Preserve: `.gl-profile-avatar`, `.gl-profile-text`, `.gl-profile-name`, `.gl-profile-role`, `.gl-profile-chevron` rules unchanged (they already match the emitted markup, incl. the mobile chevron reveal at `loginStyles.ts:500`).
   - Verify: every interactive state (hover border shift, focus ring, selected ring, active press) is visible on profile buttons at desktop and 390px; no avatar scale-up on hover.

4. `src/components/login/loginStyles.ts` — avatar/role modifiers
   - Change: Add `.gl-profile-avatar--sm { width: 50px; height: 50px; font-size: var(--text-base); }` (values from old responsive avatar rule, `loginStyles.ts:497`) and `.gl-profile-role--inline { background: transparent; padding: 0; align-self: auto; }` (the row-compact branch is documented "inline, no card" — `ProfileSelectView.ts:101`).
   - Preserve: base `.gl-profile-avatar` (68px) and `.gl-profile-role` (pill) for the `--card` presentation.
   - Verify: single-profile view shows a 50px avatar and plain-text role; card views keep the 68px avatar and pill role.


5. `src/components/login/loginStyles.ts` — eyebrow + text button + hint
   - Change: Add
     - `.gl-login-eyebrow { font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--muted-foreground); letter-spacing: var(--tracking-heading); text-align: center; margin: 0 0 var(--space-2); }` (secondary-label recipe from `.gl-login-tagline`/`.gl-setup-prompt-sub` siblings)
     - `.gl-login-text-btn` = the `.gl-bootstrap-trigger-btn` recipe (`loginStyles.ts:436–454`: transparent bg, no border, `var(--text-xs)`, `var(--muted-foreground)`, underline offset 3px, `padding: var(--space-2) var(--space-3)`, `border-radius: var(--radius-sm)`, hover → `var(--foreground)`, focus-visible 2px `var(--ring)` outline) **plus** `display: inline-flex; align-items: center; min-height: var(--touch-target-min);` (CLAUDE.md touch-target rule; `--touch-target-min` = 44px in `spacing.css:17`)
     - `.gl-login-profiles-hint { margin-top: var(--space-8); display: flex; justify-content: center; }` (rhythm from old `.gl-bootstrap-trigger-wrap`, `loginStyles.ts:430–435`)
   - Preserve: the "ยังไม่มีบัญชี? ตั้งค่าครั้งแรก" copy and `#login-trigger-bootstrap` id (`ProfileSelectView.ts:88`).
   - Verify: trigger reads as a quiet text link, ≥44px touch target, visible focus ring.

6. `src/components/login/loginStyles.ts` — bootstrap modal form
   - Change: Add
     - `.gl-bootstrap-field { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-5); }` (layout from `.gl-field`, `app.css:391–395`; spacing rhythm from `.gl-bootstrap-desc` margin, `loginStyles.ts:470–475`)
     - `.gl-bootstrap-label` — no additional rule required: the markup already pairs `gl-label` (`app.css:397–401`) and renders correctly. Leave the class present in markup; do not add an empty rule. (If a future override is needed, it belongs here.)
     - `.gl-bootstrap-actions { display: flex; gap: var(--space-3); } .gl-bootstrap-actions .gl-btn { flex: 1; }` (ยกเลิก secondary + ส่งลิงก์ primary side by side)
     - `.gl-bootstrap-status-icon { font-size: var(--text-2xl); font-weight: var(--weight-bold); color: var(--success); margin: 0 0 var(--space-4); }` (green + bottom-margin treatment mirrors sibling `.gl-setup-success-icon`, `loginStyles.ts:407–417`; `--success` exists in light and dark palettes, `tokens/colors.css:66,133`)
   - Preserve: `.gl-bootstrap-dialog/title/desc` rules; markup (`ProfileSelectView.ts:140–194`).
   - Verify: modal shows label-above-select, two equal buttons in one row; "sent" state shows a green check above the title.

## Scope

- Inherit: `LoginPage` (profiles + bootstrap modal + PIN views) and `PinSetupPage` (PIN setup + success) — both inject `renderLoginStylesHtml()` and pick up every rule automatically.
- Verify: `tests/unit/pin-setup-ui.test.ts` (asserts `gl-setup-success-card` and copy — markup untouched, must stay green); any login E2E script selecting profile buttons (`scripts/*`) — selectors are ids/`data-profile-id`, unchanged.
- Exclude: `.gl-pin-*` rules (Plan 03 handles the one press-state change), `.gl-setup-*` rules except where cited as exemplar, `EmailFallbackView.ts` (dead code — separate cleanup, not this plan), any dark-theme work beyond what existing tokens already provide.

## Validation

- Product: Log in as an existing user — select a profile (1, 2–4, and 5+ profile shapes if reachable), enter PIN, land on dashboard. Bootstrap modal: open, cancel, send state, sent state all present and legible.
- Interface: Desktop (1440px) and 390px. Check: profile grid collapses to single column on mobile; chevron appears on card items at 390px; keypad unchanged; no horizontal overflow; focus ring visible on every button (Tab order); all four profiles/bootstrap states (loading / error+retry / empty / ready).
- System: No rule in `loginStyles.ts` targets a class the views cannot emit, and no emitted login class lacks a rule from `loginStyles.ts`, `app.css`, or `design-system-extracted/tokens/*.css`. No new color/scale/radius value appears outside existing tokens (exception: the pixel sizes already present in the file — 50/68/72/76/190px — carried over, not introduced).
- Repository: `npm run build` → exit 0; `npm test` → 148+ tests green, 0 failed; `Select-String -Path src\components\login\loginStyles.ts -Pattern 'gl-profile-card|gl-profile-grid|gl-bootstrap-trigger'` → no matches.

## Stop conditions

- Stop if the views' class names have changed again on rebase (re-run the evidence grep; the mapping table must match rendered markup before editing).
- Stop if reconciling reveals a state the views emit that this plan does not cover — report it; do not improvise a rule.
- Stop if removing the avatar hover scale is contested: restore it only with an explicit, documented exception; never silently.

## Design documentation

- None. `CLAUDE.md` already states the tokens-only and touch-target contracts this plan enforces; no documented decision changes.
