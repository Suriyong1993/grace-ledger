repo: Suriyong1993/grace-ledger
branch: main

## Last sync

date: 2026-09-02T00:00:00Z

### Updated in this project

- Corrected the Screen map below: the routes it referenced (`src/routes/_app.*.tsx`) do not exist in the
  repository. The live app has no TanStack-style route-file directory — it uses a hand-written hash router
  (`src/router.ts`) over `.ts` page controllers.
- Removed the reference to `RESPONSIVE_GUIDELINES.md`, which no longer exists in the repository.
- `Grace Ledger Mobile OS.dc.html` in this folder remains a **prototyping mockup** produced for exploration.
  It was not generated from, and should not be assumed to match, the live product's actual mobile layouts.
  For the real mobile behavior, read `src/styles/app.css`'s `@media (max-width: 768px)` rules, the repo's
  `DESIGN.md`/`COMPONENTS.md`, and the `design-plans/` documents.

## Screen map — corrected

| Mockup screen                   | Real repo source (not the file previously listed)                                  |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| Home / dashboard                | `src/pages/DashboardPage.ts`                                                       |
| Transactions / income / expense | `src/pages/TransactionsPage.ts`                                                    |
| Sunday offering, cash count     | `src/pages/OfferingPage.ts`, `src/components/offering/*.ts`                        |
| Funds                           | `src/pages/FundsPage.ts`                                                           |
| Member giving                   | `src/pages/MembersPage.ts`                                                         |
| Approvals                       | `src/pages/ApprovalsPage.ts`, `src/components/approvals/*.ts`                      |
| Reports                         | `src/pages/ReportsPage.ts`                                                         |
| Login / PIN                     | `src/pages/LoginPage.ts`, `src/pages/PinSetupPage.ts`, `src/components/login/*.ts` |
| Profile / settings              | `src/pages/ProfilePage.ts`                                                         |

No "Budget" or "Audit trail" route exists in the live router (`src/router.ts`) as of this sync — remove any
assumption that those screens are implemented; budget targets are shown as progress bars on the Funds page,
and there is no separate audit-trail UI in the current product. Settings live on the Profile route
(`/profile`), not a dedicated settings screen.
