# Visual Audit Report

Chromium 149.0.7827.0 · dev preview harness with mock data · commits `4a57ef8`..`a4528fc`

Everything below was found by opening a capture or measuring in the browser.
Nothing in the "Issues Found" table comes from reading source alone.

## Screens Reviewed

33 viewport captures opened and inspected individually — 11 screens × 3
viewports (desktop 1280×900, tablet 768×1024, mobile 375×812).

Screens: dashboard, dashboard-empty, transactions, transactions-loading,
transactions-stress, approvals, offerings, offering-detail, funds, members,
reports.

Two captures are taken per screen: `fullPage` and `viewport/`. The review used
the viewport shots, because a fullPage shot repaints `position: fixed` chrome
at every scroll band and reads as broken layout when it is not.

Reports renders only its error state in the harness (no reachable database), so
its populated layout was **not** reviewed. See Still Unverified.

## Issues Found

| ID | Page | Viewport | Problem | Severity | Evidence |
|----|------|----------|---------|----------|----------|
| V1 | Dashboard (all pages) | all | Attention and overflow popovers painted over the page while `hidden` was true — `[hidden]` has no `!important` reset and loses to the panel's own `display: flex` | **P0** | measured `{hidden: true, display: "flex", painted: true}` |
| V2 | Funds | all | Feature stat tile: label and caption pinned `--muted-foreground` over the brand gradient — **1.45:1** contrast on the page's headline figure | **P1** | computed colours + contrast calc; `funds-mobile.png` |
| V3 | Transactions | all | Negative expense rendered `− -฿45,280.75` — `Money.format()` emits its own minus and the row added a second | **P1** | `transactions-stress-desktop.png` |
| V4 | Transactions | all | Filter bar markup had no CSS: search icon addon stretched to 926px as a bar *above* the input; every control on its own row (~145px wasted) | **P1** | measured icon `926×19` above input; `transactions-desktop.png` |
| V5 | Offerings, Cash count | tablet | Inline flex styles duplicated `.gl-page-header` and outranked its own `max-width: 768px` override, so the title sat at x=400 in a 744px header | **P2** | measured `flexDir: row`, `h1x: 400`; `offerings-tablet.png` |
| V6 | Members | all | Search input was an inline copy of the search pattern that reset border/background but not `font-family` → fell back to Arial | **P2** | computed `inputFont: "Arial"` vs body `Anuphan` |
| V7 | Offering detail | all | No `<h1>` — page opened straight into its tablist; only the topbar named the session | **P2** | `h1Count: 0`; `offering-detail-desktop.png` |
| V8 | Dashboard | all | "All transactions" hero action was icon-only; it is the only action a pastor can see, so it rendered as a lone unlabelled square | **P2** | `dashboard-desktop.png` + role gating |
| V9 | Approvals | mobile | Refresh button pinned `min-height: 36px` inline, below the 44px touch minimum | **P1** | measured 36px (fixed in `4a57ef8`) |
| V10 | preview harness | tablet | `preview.html` linked `app.css` that `previewMain.ts` also imports; the second copy's base rules re-applied after the first copy's media queries | **P2** (harness) | enumerated CSSOM: rule listed twice |
| V11 | Transactions | all | Loading state collapses summary + filter bar to one small card, so layout jumps when data lands | **P3** | `transactions-loading-desktop.png` — **not fixed** |

## Fixes Applied

| ID | Before | After | Verified |
|----|--------|-------|----------|
| V1 | panel painted while `hidden` | global `[hidden] { display: none !important }`; toggle re-proven open→`flex`, closed→`none` | desktop |
| V2 | 1.45:1 dark grey on coral | label/value/hint `inherit` the card's white (4.01:1); caption held at 0.88 opacity | mobile + tablet + desktop |
| V3 | `− -฿45,280.75` | `−฿45,280.75`; guard applied at all 5 sign sites; 4 regression tests added | desktop + tablet + mobile |
| V4 | icon bar above input, 4 stacked rows | icon flush inside field, one search row + one wrapping control row | desktop + tablet + mobile |
| V5 | title at x=400, desktop row at 768px | stacked, left-aligned; `.gl-page-header--start` modifier replaces the inline style | tablet + desktop |
| V6 | Arial | `Anuphan, Inter, …` via shared `.gl-searchfield` | desktop + tablet + mobile |
| V7 | `h1Count: 0` | session name + date as `h1`; all 11 screens now have exactly one `h1` | desktop + tablet + mobile |
| V8 | bare icon | labelled secondary button; 2 tests updated | desktop + tablet + mobile |
| V9 | 36px | 44px coarse / 34px fine | mobile + desktop |
| V10 | sheet loaded twice | single import | tablet |

## Interaction States Verified

Driven in-browser and compared pixel-by-pixel between states
(`scripts/interaction-audit.mjs`, 12 controls × 3 states = 36 captures).

| Component | Default | Hover | Focus-visible |
|---|---|---|---|
| Primary button (offerings) | ok | changes | changes |
| Secondary button (dashboard) | ok | changes | changes |
| Approve button (approvals) | ok | changes | changes |
| Detail button (approvals) | ok | changes | changes |
| Filter pill — inactive | ok | changes | changes |
| Filter pill — active | ok | no change (already filled) | changes |
| Period select | ok | changes | changes |
| Search input (transactions) | ok | no change (text field) | changes |
| Member search | ok | no change (text field) | changes |
| Tab — inactive | ok | changes | changes |
| Tab — active | ok | no change (already current) | changes |

**Every control has a visible keyboard focus state** — 2px solid ring at 2px
offset, confirmed unclipped by neighbours in a padded capture. The
NO-HOVER-CHANGE entries are all states that are correctly already at their
terminal appearance; none is a defect.

Error state verified on reports (desktop/tablet/mobile). Loading state verified
on transactions. **Disabled and active/pressed states were not captured** — the
harness renders no disabled control (`0` found).

## Stress Cases Verified

Audit-only fixture (`TRANSACTIONS_STRESS`, harness file only — no production
logic touched):

| Case | Result |
|---|---|
| 124-char Thai description | truncates with ellipsis, no overflow |
| Long fund + category names | tags truncate; row height stable |
| ฿187,654,321.55 | fits at all three viewports, tabular alignment holds |
| Negative amount (−฿45,280.75) | **found V3**; now renders one minus |
| 26 rows | date grouping and rhythm hold |
| Empty state | verified (dashboard-empty) |
| Loading state | verified — **found V11** |
| Error state | verified (reports) |

## Final Verification

typecheck ✅ · lint + design validation ✅ · **721 passed / 24 skipped (78 files)** ✅ ·
build ✅ (494.74 kB, css 78.66 kB) · console errors **none** · horizontal overflow
**none at any viewport** · touch targets **no app-owned control under 44px** ·
harness leakage into `dist` **0**

## Still Unverified

- **Reports populated layout** — only its error state renders in the harness, so
  period selection, table density and number formatting are unreviewed.
- **Profile** — no harness screen exists; never captured at any viewport.
- **Disabled and active/pressed states** — no disabled control is reachable in
  the harness.
- **Modals** — the reject sheet, cash-count and add-member modals were not opened;
  no modal state was captured at any viewport.
- **V11 (loading layout jump)** — proven, deliberately left unfixed: a skeleton
  matching the loaded layout is a larger change than this pass should make.
- **Real data** — every capture uses mock fixtures; Supabase is unreachable from
  this sandbox, so nothing here is verified against production data.
- **Real devices** — all measurements are emulated viewports in one Chromium
  build. No Safari, no Firefox, no physical device.
