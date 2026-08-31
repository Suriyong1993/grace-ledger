# ApprovalsPage — Find & Replace Emoji with SVG Icons (Finding #1)

## Objective
Replace all emoji characters used as UI icons in ApprovalsPage with proper SVG icon constants, following the pattern established in DashboardPage, TransactionsPage, FundsPage, and MembersPage.

## Context
- **CLAUDE.md Rule:** Banned: "emoji as UI iconography"
- **Reference Implementation:** DashboardPage.ts (ICON_CLOCK, ICON_INCOME, ICON_EXPENSE, ICON_TRANSFER)
- **Target Files:**
  - src/pages/ApprovalsPage.ts
  - src/components/approvals/ApprovalsQueueView.ts
  - src/components/approvals/ApprovalDecisionSheet.ts
  - src/components/approvals/RejectionModal.ts

## Task: PHASE 1 — DISCOVERY
Search through all four files and identify:
1. **Every emoji character used as UI** (not inside SVG paths or HTML comments)
2. **Exact line numbers**
3. **Context** (button label? badge? loading state? status indicator?)

### Expected Emoji Patterns (from design audit):
- 📎 (attachment/receipt flag)
- ✓ (checkmark/approve)
- ↩ (revision/undo arrow)
- ✗ (reject/X cross)
- ⏳ (clock/loading)
- ✅ (done/approved)
- 🔒 (lock/permission denied)
- ⚠️ (warning/alert)

### Output Format
Report findings as:
```
File: src/pages/ApprovalsPage.ts
  Line 199: Button label "กำลังอนุมัติ 📎" — loading state indicator
  Line 243: Status badge "✅ อนุมัติแล้ว" — success state

File: src/components/approvals/ApprovalsQueueView.ts
  Line 85: Receipt badge "ไม่มีใบเสร็จ ⏳" — missing receipt indicator
```

## Acceptance Criteria
- [ ] All emoji locations identified
- [ ] Line numbers exact
- [ ] Context clearly described
- [ ] If NO emoji found after thorough search, confirm compliance
- [ ] Total count of emoji instances

## Next Steps (in order)
1. **This task:** Discovery & reporting
2. **Task 2:** Create ICON_* SVG constants (follow DashboardPage.ts pattern)
3. **Task 3:** Replace emoji with ICON_* in all four files
4. **Task 4:** Run `npm test` + `npm run build` + verify no regression
5. **Task 5:** Visual verification at desktop + 390px mobile
