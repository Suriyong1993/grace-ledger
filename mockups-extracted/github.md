repo: Suriyong1993/grace-ledger
branch: main

## Last sync
date: 2026-08-14T14:40:00Z

### Updated in this project
- Built `Grace Ledger Mobile OS.dc.html` — 18 mobile mockup screens in 5 flow groups.
- Product IA taken from the repo's route list (dashboard, offering, income, expense, approvals, funds, budget, members, reports, audit, reconciliation, settings).
- Mobile shell rules (bottom nav 5 items + more sheet, 44px targets, full-screen dialogs) taken from RESPONSIVE_GUIDELINES.md.

## Screen map
| Screen | Repo source |
| --- | --- |
| Home | src/routes/_app.dashboard.tsx |
| Transactions / detail | src/routes/_app.income.tsx, _app.expense.tsx |
| Sunday offering, cash count | src/routes/_app.offering.tsx, _app.record-income.step-*.tsx |
| Funds, fund detail | src/routes/_app.funds.tsx |
| Budget | src/routes/_app.budget.tsx |
| Member giving | src/routes/_app.members.tsx |
| Approvals | src/routes/_app.approvals.tsx |
| Audit trail | src/routes/_app.audit.tsx |
| Reports | src/routes/_app.reports.tsx |
| Profile / settings | src/routes/_app.profile.tsx, _app.settings.tsx |
