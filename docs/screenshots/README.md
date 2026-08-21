# Premium Design — Screenshot Record

**Before:** [docs/screenshots/before/](before/) — 25 captures from the M2/M3 verification runs, taken
before any Premium Design work. Archived here because the `scripts/m*_browser_test.mjs` runners write
into `docs/screenshots/` and would otherwise overwrite them.

**After:** [docs/screenshots/after/](after/) — 39 captures produced by
[scripts/capture_premium_screenshots.mjs](../../scripts/capture_premium_screenshots.mjs).

```bash
npx vite --port 5173 &
node scripts/capture_premium_screenshots.mjs
```

Each screen is captured three ways:

| Suffix | What it is |
|---|---|
| `__desktop.png` | 1280×900, full page |
| `__mobile390.png` | 390×844, full page |
| `__mobile390_viewport.png` | 390×844, viewport only — the only capture where fixed chrome (bottom nav, sticky action bar) appears in its real position. Playwright's full-page stitching strands fixed elements mid-document, so those are neutralised for the full-page shots. |

Captures render each screen from its real render function against fixtures, so no Supabase session is
needed and the data is identical across runs. Every capture is asserted free of horizontal overflow;
the script exits non-zero if any screen overflows.

## Screen index

### Dashboard

- Before — [01_dashboard.png](before/01_dashboard.png)
- After — [desktop](after/01_dashboard__desktop.png) · [390px](after/01_dashboard__mobile390.png) · [390px viewport](after/01_dashboard__mobile390_viewport.png)
- Fund breakdown added; kicker dropped; ฿ no longer collides with the digits; hero on the 52px numeric step.

### Approval queue

- Before — [02_queue_view.png](before/02_queue_view.png)
- After — [desktop](after/02_approvals_queue__desktop.png) · [390px](after/02_approvals_queue__mobile390.png) · [390px viewport](after/02_approvals_queue__mobile390_viewport.png)
- Row is the click target (the four identical outline buttons are gone); pending total is neutral, not primary orange; bilingual title dropped.

### Approval detail

- Before — [06_two_person_rule_guard.png](before/06_two_person_rule_guard.png)
- After — [desktop](after/03_approval_detail__desktop.png) · [390px](after/03_approval_detail__mobile390.png) · [390px viewport](after/03_approval_detail__mobile390_viewport.png)
- Deficit warning is legible (was near-white on pale red); approve is the single primary, reject is quietest; emoji replaced with the SVG icon set.

### Reject / revision dialog

- Before — [05_terminal_rejected.png](before/05_terminal_rejected.png)
- After — [desktop](after/04_reject_modal__desktop.png) · [390px](after/04_reject_modal__mobile390.png) · [390px viewport](after/04_reject_modal__mobile390_viewport.png)
- role=dialog + aria-modal, Escape and backdrop close, focus moves into the textarea.

### Offering session list

- Before — [09_m3_offering_list.png](before/09_m3_offering_list.png)
- After — [desktop](after/05_offering_list__desktop.png) · [390px](after/05_offering_list__mobile390.png) · [390px viewport](after/05_offering_list__mobile390_viewport.png)
- Stacks into labelled cards at 390px instead of scrolling sideways; status badges rebuilt on the badge layer (the confirmed badge no longer carries a red border).

### Offering entry (Screen 04)

- Before — [10_m3_offering_entry_screen04.png](before/10_m3_offering_entry_screen04.png)
- After — [desktop](after/06_offering_entry__desktop.png) · [390px](after/06_offering_entry__mobile390.png) · [390px viewport](after/06_offering_entry__mobile390_viewport.png)
- Screen-number chip removed; no premature ✓/warning on an untouched ฿0.00 form; sticky action bar on mobile.

### Offering review (Screen 05)

- Before — [11_m3_offering_review_screen05.png](before/11_m3_offering_review_screen05.png)
- After — [desktop](after/07_offering_review__desktop.png) · [390px](after/07_offering_review__mobile390.png) · [390px viewport](after/07_offering_review__mobile390_viewport.png)
- Fund table stacks into cards at 390px (was clipped off-screen); 'Grand Expected Total' leftover removed.

### Session detail — overview (new)

- Before — none (this view did not exist)
- After — [desktop](after/08_detail_overview__desktop.png) · [390px](after/08_detail_overview__mobile390.png) · [390px viewport](after/08_detail_overview__mobile390_viewport.png)
- New read-only view: session facts, channel totals, fund×channel matrix, count result, audit timeline. Nothing rendered this data before.

### Cash count — zero match

- Before — [17_m3_cash_count_zero_match.png](before/17_m3_cash_count_zero_match.png)
- After — [desktop](after/09_cash_count__desktop.png) · [390px](after/09_cash_count__mobile390.png) · [390px viewport](after/09_cash_count__mobile390_viewport.png)
- Expected / counted / variance lead the screen as a live stat strip; real tabs replace the fake '1.' '2.' stepper.

### Cash count — shortage

- Before — [15_m3_cash_count_shortage_variance.png](before/15_m3_cash_count_shortage_variance.png)
- After — [desktop](after/10_cash_count_shortage__desktop.png) · [390px](after/10_cash_count_shortage__mobile390.png) · [390px viewport](after/10_cash_count_shortage__mobile390_viewport.png)
- Variance stat turns red immediately; 'Screen 06 · Cash Count & Dual Custody' chip and the formula sentence are gone; steppers are 44px and fit the card at 390px.

### Variance resolution (Screen 07)

- Before — [19_m3_screen07_variance_review.png](before/19_m3_screen07_variance_review.png)
- After — [desktop](after/11_variance_resolution__desktop.png) · [390px](after/11_variance_resolution__mobile390.png) · [390px viewport](after/11_variance_resolution__mobile390_viewport.png)
- Screen-number chip and E2E id gone from the title; dates unified to Thai; off-palette purple/blue mapped to tokens.

### Ready to post

- Before — [23_m3_post_to_ledger_preview.png](before/23_m3_post_to_ledger_preview.png)
- After — [desktop](after/12_ready_to_post__desktop.png) · [390px](after/12_ready_to_post__mobile390.png) · [390px viewport](after/12_ready_to_post__mobile390_viewport.png)
- Post is the primary (was a bespoke blue with a blue glow); account selectors have real <label for> wiring.

### Posted / success (Screen 08)

- Before — [24_m3_post_to_ledger_success.png](before/24_m3_post_to_ledger_success.png)
- After — [desktop](after/13_posted__desktop.png) · [390px](after/13_posted__mobile390.png) · [390px viewport](after/13_posted__mobile390_viewport.png)
- Posted amount is the hero and the destination accounts are shown — after posting, the old screen displayed neither.

## Before-set captures with no direct after equivalent

These recorded transient states or flows the fixture harness does not stage:

`03_approved_success` · `04_revision_requested` · `07_stale_state_banner` · `08_mobile_queue` ·
`12_m3_offering_saved_draft` · `13_m3_mobile_offering_entry` · `14_m3_cash_count_dual_custody_guard` ·
`16_m3_cash_count_reload_recovery` · `18_m3_mobile_cash_count` · `20_m3_screen07_explained_state` ·
`21_m3_screen07_confirmed_session` · `22_m3_mobile_variance_resolution` · `25_m3_mobile_posted_state`

The mobile ones among them (`08`, `13`, `18`, `22`, `25`) are the most useful comparisons for Wave 2E —
the after equivalents are the `__mobile390` and `__mobile390_viewport` captures of the same screens above.
