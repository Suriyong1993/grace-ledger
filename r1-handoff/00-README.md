# R1 Hand-off Package — Grace Ledger Design Foundation

Status: **not applied**. Nothing in `Suriyong1993/grace-ledger` has been modified — this environment has no
write/commit access to that repository. Everything below is ready-to-apply content for a human engineer or
Claude Code working directly in the repo. Built strictly from the frozen **Decision Record**
(`Decision Record.dc.html`) and its approved R1 scope (§6) and acceptance criteria (§8).

## Scope reminder (binding)

Allowed in this package: documentation, DS-package truth fixes, D1 token canonicalization, `--on-*-muted`
relocation, D3 modal-glass flattening, design lint in CI, `app.css` CSS-ownership consolidation, and
`AppShell.ts` **style-block-only** changes.

Not touched, and nothing here proposes touching: `src/pages/**` render strings, `src/components/**` render
strings (other than the one AppShell.ts style diff below), routing, state management, business logic,
financial calculations, `src/lib/**`, `supabase/**`, any test file.

## Files in this package

| # | Target path in `grace-ledger` | Type | This package |
|---|---|---|---|
| 1 | `DESIGN.md` (new, repo root) | new file | `01-DESIGN.md` |
| 2 | `COMPONENTS.md` (new, repo root) | new file | `02-COMPONENTS.md` |
| 3 | `DECISIONS.md` (new, repo root) | new file | `03-DECISIONS.md` |
| 4 | `CLAUDE.md` | patch | `04-CLAUDE.md.patch` |
| 5 | `design-system-extracted/readme.md` | full replace | `05-design-system-extracted-readme.md` |
| 6 | `design-system-extracted/github.md` | full replace | `06-design-system-extracted-github.md` |
| 7 | `mockups-extracted/github.md` | full replace | `07-mockups-extracted-github.md` |
| 8 | `design-system-extracted/tokens/radius.css` | full replace | `08-tokens-radius.css` |
| 9 | `design-system-extracted/tokens/shadows.css` | full replace | `09-tokens-shadows.css` |
| 10 | `design-system-extracted/tokens/colors.css` | full replace | `10-tokens-colors.css` |
| 11 | `design-system-extracted/tokens/motion.css` | **no change** — see note below | `11-tokens-motion-NOTE.md` |
| 12 | `src/styles/app.css` | full replace | `12-src-styles-app.css` |
| 13 | `src/components/layout/AppShell.ts` | patch (style block only) | `13-AppShell.ts.patch` |
| 14 | `scripts/lint-design.mjs` | new file | `14-scripts-lint-design.mjs` |
| 15 | `package.json` | patch | `15-package.json.patch` |
| 16 | `.github/workflows/ci.yml` | full replace | `16-ci.yml` |

## Internal review performed before finalizing this package

- **Cascade audit of every duplicated selector in `app.css`.** For each selector declared in both the
  original block and the later "Modern UI layer" block, the winning value was determined per-property (not
  per-rule), and the consolidated rule reproduces exactly what is live today — except the two explicitly
  approved changes (D1 token values, D3 modal flattening). See inline comments in `12-src-styles-app.css`
  marked `/* R1-d: … */`.
- **Cross-file ownership conflict found and NOT silently merged:** `app.css`'s "Modern UI layer" declares
  `.gl-nav-item { min-height: 44px; border-radius: 12px; }`, but `AppShell.ts`'s own inline `<style>` block
  also declares `.gl-nav-item` with `border-radius: var(--radius-sm)` (8px) and no `min-height` override.
  Because `AppShell.ts`'s `<style>` tag is inserted into the DOM *after* `app.css`'s `<link>` (it renders
  inside `#app`, which follows `<head>` in document order), and both selectors have equal specificity,
  `AppShell.ts` wins the `border-radius` property today — **`app.css`'s `border-radius: 12px` is dead code**.
  `min-height: 44px` in both places computes the same value, so it is harmless either way. Resolution:
  removed the dead `border-radius`/`min-height` declaration from `app.css`, kept `.gl-nav-item--active`'s
  `box-shadow` (a real, non-conflicting, currently-visible property no other rule sets). Verify in a browser
  after applying — computed `border-radius` of a sidebar nav item must still be 8px, unchanged.
- **`--ease-spring` was NOT removed.** `github_search_code` confirmed 3 live consumers in
  `src/components/login/loginStyles.ts` (lines ~147, ~199, ~412). The Decision Record's R1-c language said
  "remove only after grep confirms zero consumers" — grep found consumers, so the token stays untouched.
  This is why item 11 above is a note, not a diff.
- **`.gl-table`'s current live box model already contradicts the documented `--radius-table: 0px` rule**
  (rounded corners are currently shipped via the "Modern UI layer"'s `border-collapse: separate` +
  `border-radius: var(--radius-lg)`). Per the guardrail to preserve current approved visual behavior, this
  package **does not fix that contradiction** — it is recorded as an open finding in `03-DECISIONS.md` for a
  future, explicit decision, not silently resolved here.
- **Lint false positives checked:** the initial allowlist in `14-scripts-lint-design.mjs` was built by
  running the four lint patterns against the known offending files identified in the Strategic Review
  (`ProposalConfirmationModal.ts`, `OfferingEntryForm.ts`, `OfferingReviewSheet.ts`, `VarianceResolutionView.ts`,
  `loginStyles.ts`'s legitimate pixel sizes) so that R1 lands with the lint gate green on day one; each
  allowlist entry names the phase expected to remove it.
- **Documentation paths checked**: every repo path referenced in `05`, `06`, `07` was confirmed to exist in
  the tree read for this project (`src/pages/`, `src/components/`, `design-system-extracted/`,
  `mockups-extracted/`); no path in the corrected docs points at the stale `src/routes/*.tsx` / `src/components/ui/*.tsx` files.
- **No test file appears in this package.** Confirmed no diff here touches `tests/**`, `src/lib/**`, or `supabase/**`.

## Application order and validation gates

Apply as five atomic commits, in this order. Run the stated validation after **each** one before moving to
the next; stop and report if a gate fails rather than proceeding.

### R1-a — Documentation (files 1–4)
1. Files changed: `DESIGN.md` (new), `COMPONENTS.md` (new), `DECISIONS.md` (new), `CLAUDE.md` (patch).
2. Intended change: establish the design source-of-truth hierarchy and record D1–D3/Q3–Q5/FRI-1…5 in the repo.
3. Validation: `git diff --stat` shows only these 4 files; no other file touched. Read the 3 new docs for
   internal consistency (radius values, status labels match `03-DECISIONS.md`).
4. Visual differences: none possible (docs only).
5. Rollback boundary: revert this single commit; nothing downstream depends on it yet.

### R1-b — DS-package truth (files 5–7)
1. Files changed: `design-system-extracted/readme.md`, `design-system-extracted/github.md`, `mockups-extracted/github.md`.
2. Intended change: replace the stale React/Tailwind/shadcn/Lucide/TanStack claims and screen maps with the
   real vanilla-TS architecture and file paths.
3. Validation: `grep -riE "react|tailwind|shadcn|lucide|tanstack" design-system-extracted/readme.md design-system-extracted/github.md mockups-extracted/github.md` → 0 matches outside an explicit "historical note" callout (if you choose to keep one, it must say the app no longer uses it). Every file path mentioned resolves with `git ls-files -- <path>`.
4. Visual differences: none (docs only; no runtime import from these files).
5. Rollback boundary: revert this single commit independently of R1-a.

### R1-c — Token canonicalization (files 8–11)
1. Files changed: `design-system-extracted/tokens/radius.css`, `shadows.css`, `colors.css`. `motion.css` unchanged (see note 11).
2. Intended change: D1 — `--radius-card`→16px, `--radius-button`→12px, `--radius-input`→12px,
   `--radius-dialog`→20px, `--radius-sheet`→20px (unused today, set for R2 consistency); `--shadow-card` /
   `--shadow-elevated` updated to the values already shipped in the "Modern UI layer"; `--on-{income,expense,pending,info}-muted`
   (light + dark) added to `colors.css`, matching the values currently in `app.css`.
3. Validation: `npm run build` (typecheck only touches `.ts`, so this is a no-op gate here, run anyway for
   baseline parity); no `.ts`/`.tsx` file references these tokens by literal duplicate value that would now
   diverge — confirmed by the `app.css` consolidation in R1-d, which is designed to depend on these exact values.
4. Visual differences: **none yet** — these files are not imported anywhere except through `app.css`'s
   `@import`, and `app.css` itself is not yet touched in this step. Nothing renders differently until R1-d lands.
5. Rollback boundary: revert this commit; if reverted before R1-d, zero effect. If reverted after R1-d,
   revert R1-d first (R1-d depends on these values).

### R1-d — `app.css` consolidation + AppShell style fix (files 12–13)
1. Files changed: `src/styles/app.css` (full replace), `src/components/layout/AppShell.ts` (style block only —
   `.gl-shell-mark`/`.gl-shell-avatar` flattened to solid orange in-place, matching what the `!important`
   override in `app.css` currently forces; no other line in `AppShell.ts` changes).
2. Intended change: one declaration per selector (with the documented exceptions above), D1's token values
   now take visual effect, D3 (`.gl-modal-content` flattened from glass to solid `--popover` + `--shadow-elevated`),
   dead `.filter-pill.is-active` and `.gl-nav-item` duplicate removed, `--on-*-muted` block removed from
   `app.css` (now sourced from tokens), layout-token `:root` block de-duplicated.
3. Validation:
   - `npm run build` (exit 0) and `npm test` (identical pass count to baseline — no test file changed).
   - `grep -c "^\.gl-card {" src/styles/app.css`, same for `.gl-btn {`, `.gl-input, .gl-select, .gl-textarea {`,
     `.gl-page-header {`, `.gl-table {`, `.gl-modal-content {` → each **1**.
   - Run `node scripts/capture_premium_screenshots.mjs` before applying this commit (baseline) and after;
     diff every screen. Expect **zero** pixel difference except the reject/revision dialog and any other
     `.gl-modal-content` surface (D3), where glass/blur disappears and a solid surface + slightly different
     shadow appears — that is the one approved visual change in R1.
   - Open all 9 routes at 1280×900 and 390×844 in a real browser; confirm sidebar nav item radius is still
     visually 8px (per the ownership-conflict note above) and the shell mark/avatar are still flat orange
     (unchanged appearance, cleaner source).
4. Visual differences — **expected**: modal/dialog surfaces (glass → solid). **Unexpected** (must be treated
   as a regression and reverted/fixed): any change to card radius/shadow beyond what D1 already shipped
   visually, any change to button/input height or radius, any shift in page width/padding, any change to
   table appearance, any change to badge/notice/toast radius beyond the already-live 16px.
5. Rollback boundary: revert this single commit; depends on R1-c landing first (uses its token values).

### R1-e — Design lint in CI (files 14–16)
1. Files changed: `scripts/lint-design.mjs` (new), `package.json` (patch — adds `"lint:design"` script and
   folds it into `"lint"`), `.github/workflows/ci.yml` (adds the lint step).
2. Intended change: a mechanical gate against future literal color/radius/shadow/font-size values in `src/**`.
3. Validation: `npm run lint:design` → exit 0 today, using the committed allowlist. Manually spot-check the
   allowlist against `grep -rnE "font-size:\s*[0-9.]+px|border-radius:\s*[0-9]+px|rgba?\(|#[0-9a-fA-F]{3,8}" src/` —
   every match not covered by an allowlist entry must fail the script (confirms the lint isn't accidentally
   permissive).
4. Visual differences: none (build/CI tooling only).
5. Rollback boundary: revert this commit independently; does not affect runtime.

## After R1

Per the frozen Decision Record, **do not proceed to R2 automatically**. Report back using the structure
requested: changed files, before/after design ownership, test results, design lint results, visual
regression results (expected vs unexpected), remaining risks, and a recommended R2 scope — then wait.
