# Grace Ledger — Interactive Prototype & Design Reference

This directory contains the original interactive prototype, component showcase, and design specification files for Grace Ledger.

## Directory Contents

| File                                                 | Description                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| [`Grace Ledger.dc.html`](./Grace%20Ledger.dc.html)   | Interactive HTML prototype covering all 13 screens               |
| [`support.js`](./support.js)                         | Supporting JS script for interactive prototype state transitions |
| [`Design System.dc.html`](./Design%20System.dc.html) | Interactive component showcase for UI states and tokens          |
| [`github.md`](./github.md)                           | Mapping of prototype screens to codebase routes                  |

> `DESIGN-SYSTEM-V2.md` has been removed — its content is superseded by `DESIGN.md` at the repo root.

---

## Prototype Screen Mapping (13 Screens)

| Screen Name               | Prototype Section      | Application Route / Code Location                                                                                                |
| ------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **แดชบอร์ด** (Dashboard)  | `Grace Ledger.dc.html` | [`src/routes/_app.dashboard.tsx`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/routes/_app.dashboard.tsx)   |
| **รายรับ** (Income)       | `Grace Ledger.dc.html` | [`src/routes/_app.income.tsx`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/routes/_app.income.tsx)         |
| **รายจ่าย** (Expense)     | `Grace Ledger.dc.html` | [`src/routes/_app.expense.tsx`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/routes/_app.expense.tsx)       |
| **เงินถวาย** (Offering)   | `Grace Ledger.dc.html` | [`src/routes/_app.offering.tsx`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/routes/_app.offering.tsx)     |
| **รออนุมัติ** (Approvals) | `Grace Ledger.dc.html` | [`src/routes/_app.approvals.tsx`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/routes/_app.approvals.tsx)   |
| **Audit Log**             | `Grace Ledger.dc.html` | [`src/routes/_app.audit.tsx`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/routes/_app.audit.tsx)           |
| **รายงาน** (Reports)      | `Grace Ledger.dc.html` | [`src/routes/_app.reports.tsx`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/routes/_app.reports.tsx)       |
| **กองทุน** (Funds)        | `Grace Ledger.dc.html` | [`src/routes/_app.funds.tsx`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/routes/_app.funds.tsx)           |
| **งบประมาณ** (Budget)     | `Grace Ledger.dc.html` | [`src/routes/_app.budget.tsx`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/routes/_app.budget.tsx)         |
| **สมาชิก** (Members)      | `Grace Ledger.dc.html` | [`src/routes/_app.projects.tsx`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/routes/_app.projects.tsx)     |
| **Grace AI**              | `Grace Ledger.dc.html` | [`src/routes/_app.dashboard.tsx`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/routes/_app.dashboard.tsx)   |
| **LINE Bot**              | `Grace Ledger.dc.html` | [`src/routes/_app.line-setup.tsx`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/routes/_app.line-setup.tsx) |
| **ตั้งค่า** (Settings)    | `Grace Ledger.dc.html` | [`src/routes/_app.settings.tsx`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/routes/_app.settings.tsx)     |

---

## Design System Architecture

- Single source of truth: [`DESIGN.md`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/DESIGN.md) — consolidates the former `DESIGN_SYSTEM_V3.md`, `DESIGN_TOKENS.md`, `COMPONENT_LIBRARY.md`, and `MOTION_GUIDELINES.md` (all removed).
