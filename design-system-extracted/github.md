repo: Suriyong1993/grace-ledger
branch: main

## Last sync

date: 2026-09-02T00:00:00Z

### Updated in this project

- Corrected the Stack section: the live app is vanilla TypeScript + Vite (string-rendered HTML, hash router),
  not React/TanStack/Tailwind/shadcn as previously documented. See `docs/M2_PHASE_2_2_FRONTEND_ARCHITECTURE_DECISION.md`
  in the repo for the explicit decision that rejected React.
- Corrected the Screen map below to the real files that implement each area. The previous version mapped to
  `src/components/ui/*.tsx`, `src/components/shared/*.tsx` and `src/routes/_app.*.tsx` — none of which exist
  in this repository.
- Corrected the documented font stack to Anuphan (Thai) + Space Grotesk (Latin/numerals), matching
  `index.html` and `tokens/typography.css`. Earlier revisions claimed Sarabun + Inter.
- Labeled `components/*.jsx` and `ui_kits/grace-ledger/` as prototyping-only, not production source.
- Token files (`colors.css`, `radius.css`, `shadows.css`) are **scheduled** for the D1 radius/shadow
  canonicalization and the `--on-*-muted` relocation in R1-c — not yet applied at the time of this sync. See
  the repo's `DECISIONS.md`.

## Screen map

| Design-system asset                                                                                                      | Real repo source                                                                    |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `tokens/colors.css`, `typography.css`, `spacing.css`, `radius.css`, `shadows.css`, `motion.css`, `base.css`, `fonts.css` | `design-system-extracted/tokens/*.css`, imported by `src/styles/app.css`            |
| App shell (sidebar, topbar, mobile nav)                                                                                  | `src/components/layout/AppShell.ts`                                                 |
| Dashboard                                                                                                                | `src/pages/DashboardPage.ts`                                                        |
| Transactions                                                                                                             | `src/pages/TransactionsPage.ts`                                                     |
| Funds                                                                                                                    | `src/pages/FundsPage.ts`                                                            |
| Members                                                                                                                  | `src/pages/MembersPage.ts`                                                          |
| Reports                                                                                                                  | `src/pages/ReportsPage.ts`                                                          |
| Profile                                                                                                                  | `src/pages/ProfilePage.ts`                                                          |
| Approvals queue / detail / status badge                                                                                  | `src/pages/ApprovalsPage.ts`, `src/components/approvals/*.ts`                       |
| Sunday offering (entry, review, cash count, variance, session list, detail)                                              | `src/pages/OfferingPage.ts`, `src/components/offering/*.ts`                         |
| Login / PIN                                                                                                              | `src/pages/LoginPage.ts`, `src/pages/PinSetupPage.ts`, `src/components/login/*.ts`  |
| AI drawer (Grace AI copilot UI)                                                                                          | `src/components/ai-drawer/*.ts`, `src/components/ai/ProposalConfirmationModal.ts`   |
| `.gl-*` CSS primitives/composites                                                                                        | `src/styles/app.css`                                                                |
| `components/*.jsx`, `ui_kits/grace-ledger/` (this package)                                                               | **Prototyping reference only** — not imported by, or generated from, any file above |

## Notes

- `src/router.ts` uses hash routes: `/`, `/transactions`, `/funds`, `/members`, `/reports`, `/profile`,
  `/approvals[/:id]`, `/offerings[/new|/:id]`. There is no `src/routes/` directory in this repo (a prior
  version of this document implied one).
- The repo's own `DESIGN.md`, `COMPONENTS.md`, and `DECISIONS.md` (added 2026-09-02) are now the primary
  design references for anyone working in this codebase; this design-system package supplements them for
  prototyping outside the repo.
