repo: Suriyong1993/grace-ledger
branch: main

## Last sync
date: 2026-08-14T14:13:04Z

### Updated in this project
- Imported color/typography/radius/shadow/motion tokens from `src/styles.css` and `DESIGN.md`
- Built Button, Input, Select, Checkbox, Switch, Badge, StatusBadge, EmptyState, Card, StatCard, MoneyText, PageHeader, Tabs, Dialog from `src/components/ui` and `src/components/shared`
- Built a click-through UI kit (login, dashboard, income entry, approvals) from `src/routes` and `src/components/dashboard`/`layout`

## Screen map
| Design system screen/file | Repo source |
| --- | --- |
| `components/forms/*` | `src/components/ui/button.tsx`, `input.tsx` |
| `components/feedback/StatusBadge.jsx` | `src/components/shared/StatusBadge.tsx` |
| `components/data/StatCard.jsx`, `MoneyText.jsx` | `src/components/shared/StatCard.tsx`, `MoneyText.tsx` |
| `components/navigation/PageHeader.jsx` | `src/components/shared/PageHeader.tsx` |
| `ui_kits/grace-ledger/Dashboard.jsx` | `src/routes/_app.dashboard.tsx`, `src/components/dashboard/*`, `src/components/layout/AppSidebar.tsx`, `AppTopbar.tsx` |
| `ui_kits/grace-ledger/IncomeEntry.jsx` | `src/routes/_app.record-income.step-*.tsx` |
| `ui_kits/grace-ledger/Approvals.jsx` | `src/routes/_app.approvals.tsx` |
| `tokens/colors.css`, `typography.css`, `radius.css`, `shadows.css`, `motion.css` | `src/styles.css`, `DESIGN.md` |
