# UX Decision Record (UXDR)

**Purpose**: Document every UX decision, the reasoning behind it, and success metrics.  
**Format**: Each decision is immutable (no retroactive editing); new insights create new UXDRs or revision notes.  
**Audience**: Product, Design, Engineering, Future Team Members  

---

## UXDR-001: Event-Based Workflow (Not Journal-Based)

**Decision**  
Primary UX navigation is based on events (`+ รับเงิน`, `+ บันทึกรายจ่าย`, `+ ฝากธนาคาร`), not accounting concepts (Journal, Ledger, Chart of Accounts).

**Rationale**  
Finance staff are not accountants. They think in terms of "what happened" (cash came in, we paid a bill), not "how to record it accounting-wise." See MENTAL_MODELS.md for full translation layer.

**Impact**
- ✅ Reduces cognitive load for non-accountants
- ✅ Speeds up task completion
- ❌ Hides accounting terminology (admin tools must be separate)
- ❌ Requires system to auto-generate balanced journal entries

**Success Metrics**
- Event completion time < 3 minutes
- Staff never ask "Where's the Journal Entry form?"
- Task success rate ≥ 95% when shown event-based UI
- Task success rate < 50% if shown accounting-based UI (planned alternative test)

**Status**: Not yet validated (Phase 1 testing)

**Last Updated**: 2026-08-04

---

## UXDR-002: Wizard Flow (Linear 4-Step Process)

**Decision**  
Each event follows a linear wizard: Step 1 (Type) → Step 2 (Amount) → Step 3 (Destination) → Step 4 (Review).

**Rationale**  
- Chunking reduces decision fatigue
- Linear flow mirrors pen-and-paper workflow
- Less cognitive load than a "fill all fields at once" form
- Easier to add context/help text per step

**Alternatives Considered**
- A: Single-page form (all fields visible) — rejected because overwhelming
- B: Accordion form (collapsible sections) — rejected because requires navigation
- C: Modal form (pop-up) — rejected because context loss

**Impact**
- ✅ Clearer step progression
- ✅ Allows form validation between steps
- ❌ Takes more clicks than single-page form
- ❌ Harder to go back/edit (requires backtracking)

**Success Metrics**
- Wizard completion time < 3 minutes
- Help requests per transaction < 1
- Error rate < 5%
- 0 complaints about "too many clicks"

**Status**: Not yet validated (Phase 1 testing)

**Last Updated**: 2026-08-04

---

## UXDR-003: Separate UI for Finance Staff vs. Leaders

**Decision**  
Finance Staff and Leaders see completely different UIs. No shared "transaction list" or "approval tab."

**Staff Home Screen**
```
+ รับเงิน
+ บันทึกรายจ่าย
+ ฝากธนาคาร
+ โอนเงิน

Recent Transactions (list)
```

**Leader Home Screen**
```
รอการอนุมัติ (3)
อนุมัติแล้ววันนี้ (5)
ถูก Reject (1)
```

**Rationale**
- Different jobs = different information needs
- Reduces menu confusion (staff won't see approval controls)
- Clearer role separation
- Mirrors segregation of duties principle

**Impact**
- ✅ Crystal-clear role boundaries
- ✅ No accidental wrong-action (staff can't approve)
- ❌ Requires separate route guards
- ❌ Team must manage 2 UI flows

**Success Metrics**
- 0 staff entering approval UI by mistake
- 0 leaders spending time in recording UI
- Role confusion incidents: 0

**Status**: Not yet validated (Phase 1 testing)

**Last Updated**: 2026-08-04

---

## UXDR-004: Timeline-Based Approval Status

**Decision**  
Approval status displayed as a timeline:
```
✓ Recorded by Finance Staff (10:00)
✓ Leader 1 Approved (10:15)
⏳ Leader 2 Waiting...
```

NOT as:
- ❌ Status badge ("Pending (1/2 approvals)")
- ❌ Progress bar
- ❌ Tabs (Pending | Approved)

**Rationale**
- Timeline clearly shows sequence and ownership
- Instantly answers: "Who approved?" and "Who's waiting?"
- Mirrors paper workflow (signatures in order)
- No interpretation needed ("What does 1/2 mean?")

**Impact**
- ✅ Unambiguous status communication
- ✅ Shows who to follow up with
- ❌ Requires timestamp storage
- ❌ Longer visual real estate

**Success Metrics**
- Status comprehension time < 5 seconds
- 100% accuracy: "Who approved this?"
- 100% accuracy: "Who still needs to approve?"

**Status**: Not yet validated (Phase 1 testing)

**Last Updated**: 2026-08-04

---

## UXDR-005: Hide Chart of Accounts Completely

**Decision**  
Chart of Accounts, Account Master, Account Hierarchy are ADMIN ONLY. Staff and Leaders never see these menus.

**Rationale**  
- Staff don't select accounts; system selects them based on event type
- Leaders don't need account details; only transaction details
- Cognitive load for seeing 50+ account names is unnecessary

**How It Works**
```
Staff says:  "รับถวาย"
System auto-selects:
  Debit: Cash (account ID 1001)
  Credit: Offering Income (account ID 3001)

Staff never knows these account IDs exist.
```

**Impact**
- ✅ Zero menu confusion
- ✅ Smaller navigation surface
- ❌ Event-to-account mapping must be correct (no override)
- ❌ Auditor needs separate interface

**Success Metrics**
- Staff never ask "Where's Chart of Accounts?"
- Event-to-account mapping accuracy: 100%
- Support tickets about accounts: 0

**Status**: Not yet validated (Phase 1 testing)

**Last Updated**: 2026-08-04

---

## UXDR-006: No Manual Journal Entry Creation for Staff

**Decision**  
Staff cannot manually create or edit journal entries. All transactions go through event flow only.

**Rationale**
- Staff have no accounting training
- Manual entry risks unbalanced Dr/Cr
- Audit trail is clearer if every entry has an originating event
- Fraud prevention: can't create entries without event paper trail

**Exceptions** (Admin only)
- Opening balances
- Adjusting entries (with approval from finance manager)
- Reversing entries (auto-generated, not manual)

**Impact**
- ✅ Prevents user error
- ✅ Maintains audit integrity
- ❌ Edge cases (unusual transactions) require admin intervention
- ❌ Staff can't "fix" mistakes directly

**Success Metrics**
- Staff never ask "How do I create a custom journal entry?"
- 100% of journal entries have originating events
- 0 unbalanced entries created by staff

**Status**: Not yet validated (Phase 1 testing)

**Last Updated**: 2026-08-04

---

## UXDR-007: Require Receipt/Evidence Upload for Every Transaction

**Decision**  
Every transaction requires supporting evidence (photo of receipt, screenshot, PDF invoice). No exceptions.

**Rationale**
- Audit trail completeness
- Leader can verify amount matches receipt
- Fraud prevention (harder to create fictitious transactions)
- Mirrors pen-and-paper workflow ("attach receipt to form")

**Implementation**
```
Step 4 (Review) includes:
  - Transaction detail
  - Receipt preview
  - Missing receipt? ⚠️ "Cannot submit without evidence"
```

**Impact**
- ✅ Audit-ready documentation
- ✅ Reduces false transactions
- ❌ Extra step (find and upload receipt)
- ❌ Mobile camera usage required

**Success Metrics**
- 100% of transactions have attached evidence
- 0 transactions submitted without receipt
- Leader satisfaction: "I can verify every receipt"

**Status**: Not yet validated (Phase 1 testing)

**Last Updated**: 2026-08-04

---

## UXDR-008: Approval Requires Leader to Review Detail

**Decision**  
Leaders must see transaction detail before approving (amount, category, receipt). One-click approve is BLOCKED.

**Rationale**
- Fraud prevention (leader must actually check, not rubber-stamp)
- Compliance (approval must be intentional, not automatic)
- Mirrors paper workflow (leader reads form, then signs)

**Non-Negotiable**
```
Leader cannot see "Approve" button without seeing:
  - Transaction amount
  - Category
  - Receipt image
  - Staff member who recorded it
  - Timestamp
```

**Impact**
- ✅ Genuine approval (not auto-rubber-stamp)
- ✅ Audit shows leader actually reviewed
- ❌ Approval takes slightly longer (30 sec to read detail)

**Success Metrics**
- Time to review + approve: < 2 minutes
- Leader error rate (approving wrong amount): < 1%

**Status**: Not yet validated (Phase 1 testing)

**Last Updated**: 2026-08-04

---

## UXDR-009: Use Thai Language Exclusively

**Decision**  
All user-facing text is Thai. No English except for technical error messages (should be minimal).

**Rationale**
- Staff primary language is Thai
- Reduces confusion (can't accidentally click English-labeled button)
- Feels native and trusted

**Exception**
- Admin/audit interfaces may show English (auditor is often finance-trained)

**Impact**
- ✅ Accessibility for non-English speakers
- ✅ Reduced cognitive load
- ❌ Requires Thai translations for all features

**Success Metrics**
- 0 user questions about meaning of menu items
- 100% of UI text in Thai

**Status**: Not yet validated (Phase 1 testing)

**Last Updated**: 2026-08-04

---

## UXDR-010: No Keyboard Shortcuts or Advanced Gestures

**Decision**  
UX is designed for mouse/touch only. No keyboard shortcuts, command palette, or gesture shortcuts.

**Rationale**
- Staff are not power users
- Risk of accidental actions (Ctrl+Z, etc.)
- Simpler mental model (just click buttons)

**Impact**
- ✅ Accident prevention
- ✅ Simpler to learn
- ❌ Slower for power users (but staff are not power users)

**Success Metrics**
- 0 accidental actions from keyboard shortcuts

**Status**: Not yet validated (Phase 1 testing)

**Last Updated**: 2026-08-04

---

## UXDR-011: Error Messages Should Be Non-Technical

**Decision**  
All error messages are user-friendly and actionable, never expose technical jargon.

| ❌ Technical | ✅ User-Friendly |
|---|---|
| "Unbalanced entry: Dr ≠ Cr" | "กรุณาตรวจสอบจำนวนเงิน" (Check amount) |
| "FK constraint violation" | "เลือก Category ให้ครบ" (Select category) |
| "NULL value not allowed" | "ไม่เว้นช่องว่าง" (Don't leave blank) |

**Impact**
- ✅ Reduced user frustration
- ✅ Self-service error recovery
- ❌ Requires more UX copy

**Success Metrics**
- Staff can resolve 90% of errors without calling support

**Status**: Not yet validated (Phase 1 testing)

**Last Updated**: 2026-08-04

---

## UXDR-012: One-Transaction-Per-Action (No Batch)

**Decision**  
Staff records one transaction at a time. No bulk import, batch entry, or CSV upload.

**Rationale**
- Simpler mental model
- Clearer audit trail (1 transaction = 1 approval)
- Mirrors current pen-and-paper workflow
- Avoids data entry errors from copy-paste mistakes

**Future Enhancement (After Pilot)**
- Batch entry for recurring transactions (e.g., weekly staffing)
- CSV import for administrative reconciliation

**Impact**
- ✅ Clarity
- ✅ Audit trail
- ❌ Slower for high-volume scenarios (future problem, not now)

**Success Metrics**
- No requests for batch entry during pilot

**Status**: Not yet validated (Phase 1 testing)

**Last Updated**: 2026-08-04

---

## UXDR-013: Transaction Edit/Void Only by Admin

**Decision**  
Staff cannot edit or void transactions. Only Finance Manager/Admin can.

**Rationale**
- Audit trail integrity (immutability)
- Fraud prevention (can't change recorded amount)
- Compliance (transactions are permanent)

**How to "Fix" Mistakes**
1. Submit incorrect transaction to approval
2. Leader rejects with reason
3. Staff creates new corrected transaction
4. Admin can later void original (creates reversing entry)

**Impact**
- ✅ Immutable audit trail
- ✅ Fraud prevention
- ❌ Correcting mistakes requires extra steps

**Success Metrics**
- 0 staff complaints about inability to edit
- Staff understand "rejection → re-create" workflow

**Status**: Not yet validated (Phase 1 testing)

**Last Updated**: 2026-08-04

---

## Revision Log

| UXDR | Revision | Date | Change | Reason |
|---|---|---|---|---|
| UXDR-001 | 1.0 | 2026-08-04 | Initial | Phase 0 hypothesis |
| (others) | 1.0 | 2026-08-04 | Initial | Phase 0 hypothesis |

---

## Next Phase: UXDR Validation

When Phase 1 testing begins:
1. Record user behavior for each UXDR
2. Add "Validation Notes" section (what actually happened vs. assumption)
3. Create revision if data contradicts decision
4. Update success metrics with actual performance

---

## UXDR Deletion / Overriding

If user testing shows a decision is wrong:

**Process**
1. Create a new UXDR with "Reverting: UXDR-XXX" in header
2. Document why original was wrong
3. Link both documents
4. Update PHASE-0-HYPOTHESES.md with new insights

**Example**
```
UXDR-014: Show Accounts to Leaders (Reverts UXDR-005)

Reason: Pilot data showed leaders wanted to see which account
was debited (for reconciliation purposes). Revising to show
account names but NOT chart of accounts structure.
```
