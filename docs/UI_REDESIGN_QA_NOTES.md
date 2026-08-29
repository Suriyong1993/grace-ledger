# UI redesign QA notes

## 2026-08-28

- Production deployment: `https://grace-ledger-git-main-tlcs-projects-ab505ecc.vercel.app`
- Latest commit: `a2548ed` (`feat(ui): modernize shared app shell and all routes`)
- Login route loads active profile and the PIN entry flow remains available.
- Dashboard route loads after PIN authentication; data and financial figures remain unchanged.
- Shared shell now shows the active page title, church context, and green system status indicator.
- Global UI layer now affects page spacing, surfaces, buttons, inputs, tables, stats, cards, responsive grids, mobile navigation, and reduced-motion behavior.
- Login layer now affects profile cards, PIN keypad, bootstrap CTA, focus states, and responsive spacing.
- Next: inspect the remaining routes on desktop/mobile, then run full tests/build and publish final QA summary.

## Route checks

Dashboard and Transactions both loaded successfully in production after the shared visual layer. The topbar status indicator is visible, the dashboard balance card has stronger hierarchy, quick actions are more tactile, and transaction search/filter controls plus list rows remain usable with the existing data. No financial values or transaction behavior changed.

The Offerings route loaded in production with the modern shell, a clear page header, a prominent primary action, and an empty state that explains the next step. The existing offering workflow links remain intact.

The Funds route loaded correctly with the refreshed shell, a clear balance hero, two fund cards, and a single transfer action. Financial values and transfer controls remain unchanged; the visual layer improves card hierarchy and spacing.

The Approvals route loaded correctly and its empty state remains clear and compact. The modern shell and spacing apply without changing approval actions or workflow semantics.

The Members route loaded with the refreshed page header, search field, and clean empty state. The route remains usable and readable at the current desktop viewport.

The Reports route loaded correctly after waiting for data, with month/year tab controls, print action, income/expense/net summary cards, a clear no-posted-data state, and responsible-person rows. The updated spacing and surfaces remain consistent with the rest of the application.

Source checked: https://grace-ledger-git-main-tlcs-projects-ab505ecc.vercel.app/#/reports

During the offering-form QA, the branch alias retained the list view when addressed directly as `#/offerings/new`. Source inspection found OfferingPage maintains internal mode separately from the router, so a route synchronization fix was added in commit `89450ea`. The immutable deployment URL correctly served the latest build but, as a separate Vercel hostname, was unauthenticated and its profile bootstrap request failed because the Supabase origin allowlist is scoped to the branch alias. Final verification must use the authenticated branch alias after Vercel cache propagation.

After a hard reload on the authenticated production branch alias, `#/offerings/new` now renders the real two-step offering entry form instead of the list view. The form exposes service date, service name, channel totals, fund allocation, notes, cancel, and review actions. This confirms the route-state fix is live.
