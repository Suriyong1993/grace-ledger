repo: Suriyong1993/grace-ledger
branch: main

## Last sync
date: 2026-08-02T12:03:00Z

### Updated in this project
- Read README, DESIGN_SYSTEM.md, app layout, dashboard route, component tree
- Redesigned full app UI as Grace Ledger.dc.html (dashboard, income, expense, offering, approvals, audit, reports)
- Added กองทุน, งบประมาณ, สมาชิก, Grace AI, LINE Bot, ตั้งค่า — all 13 screens complete
- Design System v2: DESIGN-SYSTEM-V2.md + Design System.dc.html

## Screen map
| Project screen | Repo files |
| --- | --- |
| Grace Ledger.dc.html — แดชบอร์ด | src/routes/_app.dashboard.tsx, src/components/dashboard/*, DESIGN_SYSTEM.md |
| Grace Ledger.dc.html — รายรับ/รายจ่าย | src/routes/_app.income.tsx, src/routes/_app.expense.tsx |
| Grace Ledger.dc.html — เงินถวาย | src/routes/_app.offering.tsx, src/components/shared/SundayCountSheet.tsx |
| Grace Ledger.dc.html — รออนุมัติ | src/routes/_app.approvals.tsx |
| Grace Ledger.dc.html — Audit | src/routes/_app.audit.tsx |
| Grace Ledger.dc.html — รายงาน | src/routes/_app.reports.tsx |
| Grace Ledger.dc.html — โครงหน้า/นำทาง | src/routes/_app.tsx, src/components/layout/* |
