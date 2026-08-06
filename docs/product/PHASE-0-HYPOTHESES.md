# Phase 0 — Product Hypotheses

**Purpose**: Document assumptions about users, workflows, and mental models before building.  
**Status**: Not yet validated (testing in Phase 1)  
**Last Updated**: 2026-08-04  
**Owner**: Product Team

---

## Core Problem Statement

**Current State**: Finance staff use Pen+Paper for transactions (5 minutes per transaction) because the Grace Ledger UI feels "hard to use."

**Root Cause**: UI is designed for accountants (Dr/Cr mental model), but staff are not accountants. They think in _events_ (receive money, pay bills), not accounting mechanics.

**Goal**: Redesign UX to match staff mental models while maintaining backend double-entry integrity.

---

## User Hypotheses

### H-001: Staff Think in Events, Not Accounting

**Hypothesis**  
Finance staff conceptualize financial actions as _events_ ("Sunday offering received ฿15,000"), not accounting transactions ("Debit Cash, Credit Offering Income").

**Evidence Supporting**

- Current paper workflow is event-centric ("received", "paid", "transferred")
- No staff have accounting training
- Approval workflow based on transaction amount, not account types
- Staff never manually create journal entries

**How to Validate**

- Task: "Record a Sunday offering of ฿15,000 cash"
- Observe: Do they immediately look for "Offering" or "Income" category?
- Measure: Time to select category; verbalization ("I need to record offering...")

**Expected Outcome**  
Users complete transaction step without asking "What's Debit/Credit?"

---

### H-002: Linear Wizard Flow Reduces Cognitive Load

**Hypothesis**  
Guiding users through a 4-step wizard (Category → Amount → Destination → Review) takes less time and generates fewer errors than a single long form.

**Evidence Supporting**

- Pen+paper workflow has inherent sequence (write, confirm, sign)
- Chunking information reduces decision fatigue
- Current form-based UX feels overwhelming

**How to Validate**

- Task: Record transaction with wizard vs. flat form (A/B if possible)
- Measure: Completion time, errors, help requests

**Success Criteria**

- Wizard completion: < 3 minutes
- Flat form completion: > 4 minutes
- Fewer misclicks in wizard path

---

### H-003: Staff Don't Need "Advanced" Accounting Features

**Hypothesis**  
Finance staff should never encounter Chart of Accounts, Manual Journal Entries, Void Entries, or Reconciliation. These are admin/auditor tools only.

**Evidence Supporting**

- Staff's job: Record events, wait for approval, execute payment
- Complexity of these features adds cognitive load without user benefit
- Historical observation: Staff never asked for "reverse journal entry"

**How to Validate**

- Task: Ask staff "Have you ever needed to manually edit accounts?"
- Measure: Frequency of request for "advanced" features

**Success Criteria**  
No staff requests for hidden features during 6-month pilot.

---

## Workflow Hypotheses

### H-004: Role Separation Improves Clarity

**Hypothesis**  
Finance Staff and Leaders should see completely different UIs because they have different responsibilities.

| Role          | Responsibility       | Should See                                                 |
| ------------- | -------------------- | ---------------------------------------------------------- |
| Finance Staff | Record events        | "+ Record Income", "+ Record Expense", recent transactions |
| Leader        | Approve transactions | "Pending Approvals (3)", "Approved Today", approval detail |
| Admin         | Configure system     | Chart of Accounts, Audit Trail, Reports                    |

**How to Validate**

- Task (Staff): "Where do I see transactions waiting for approval?"
- Task (Leader): "Where do I go to record new income?"
- Observe confusion, role misunderstanding

**Success Criteria**

- Staff never accidentally enter approval UI
- Leaders never spend time in recording UI

---

### H-005: Approval Status Should Be Crystal Clear

**Hypothesis**  
Users should instantly understand: Where is this transaction in the approval pipeline? Who approved? Who's waiting?

Current pen+paper equivalent: "This form has 2 signatures (by [Name 1], [Name 2])"

**How to Validate**

- Task: "Tell me the status of transaction XYZ without scrolling or asking"
- Measure: Response time, accuracy

**Success Criteria**

- User identifies status in <5 seconds
- 100% accuracy on "Who approved?" question

---

### H-006: 2-Leader Approval Is Sufficiently Secure

**Hypothesis**  
Requiring 2 leaders to approve transactions (not 1 leader + 1 staff) prevents fraud effectively and reflects church governance.

**Evidence Supporting**

- Church has 2 leaders in decision-making roles
- Current pen+paper requires 2 signatures
- Prevents self-approval and single-point-of-failure

**How to Validate**

- Audit log check: Do 2 distinct leaders approve each transaction?
- Leader interview: "Does 2-approval process feel right?"

**Success Criteria**  
100% of high-value transactions have 2 distinct approvals.

---

## UX Hypotheses

### H-007: Event Names Should Match User Vocabulary

**Hypothesis**  
Menu labels should use staff's own words, not accounting terminology.

| ❌ Accounting Term   | ✅ Staff Language           |
| -------------------- | --------------------------- |
| Create Journal Entry | รับเงิน (Record Income)     |
| Post to Ledger       | บันทึก (Record)             |
| Debit Cash Account   | ฝากธนาคาร (Deposit to Bank) |
| Credit Offering      | ถวาย (Offering)             |

**How to Validate**

- Task: Staff sees 3 buttons (รับเงิน, บันทึกรายจ่าย, ฝากธนาคาร)
- Measure: Do they click the correct button for the scenario?
- Alternative: Show 3 buttons with English accounting terms
- Measure: Confusion, help requests

**Success Criteria**

- Staff menu (Thai): 100% task success
- English accounting menu: <50% task success

---

### H-008: Hidden Double-Entry Maintains Integrity

**Hypothesis**  
System can enforce double-entry bookkeeping _invisibly_. Staff records event ("รับเงิน ฿15,000"), system auto-generates balanced journal entry (Dr. Cash, Cr. Offering).

**Evidence Supporting**

- All transactions at Grace Ledger have event-to-journal mapping
- No staff should need to manually balance entries
- Backend can validate Dr = Cr without exposing it to UI

**How to Validate**

- Audit sample of 10 transactions
- Check: Does each have balanced Dr/Cr?
- Staff interview: "How do you ensure entries are balanced?" (Should not need to; system does it)

**Success Criteria**

- 100% of transactions have balanced entries
- Staff never manually adjusts Dr/Cr
- Audit log shows zero balance violations

---

## Metric Hypotheses

### H-009: <3 Minute Transaction Time Is Achievable

**Hypothesis**  
Current paper workflow takes ~5 minutes (write → review → sign). With optimized UI, digital workflow should take <3 minutes.

**Evidence Supporting**

- Pen+paper has inherent overhead (find paper, find pen, handwriting)
- Digital UI can eliminate this overhead
- Staff use same category repeatedly (less decision time)

**How to Validate**

- Record 10 transactions with stopwatch
- Measure: Time per transaction, variance
- Compare: Against paper baseline (5 min)

**Success Criteria**

- Average transaction time: 2:00–2:45 min
- 90th percentile: <3:00 min

---

### H-010: <5% Error Rate on Data Entry

**Hypothesis**  
Structured UI (dropdowns for category, input validation) should reduce errors to <5% (vs. handwritten paper ~10–15% from illegibility, transposition).

**Evidence Supporting**

- Digital dropdowns prevent typos
- System validates amounts > 0
- Structured flow reduces omissions

**How to Validate**

- Record 10 transactions, audit data accuracy
- Compare entered category vs. receipt category
- Compare entered amount vs. receipt amount

**Success Criteria**

- Correctly entered category: ≥95%
- Correctly entered amount: ≥98%

---

## Success Criteria Summary

| Hypothesis | Metric                              | Target             |
| ---------- | ----------------------------------- | ------------------ |
| H-002      | Completion time (wizard)            | <3 min             |
| H-002      | Help requests                       | <1 per transaction |
| H-004      | Role confusion                      | 0 incidents        |
| H-005      | Status clarity (time to understand) | <5 sec             |
| H-007      | Task success (Thai labels)          | ≥95%               |
| H-007      | Task success (English labels)       | <50%               |
| H-009      | Avg transaction time                | 2:00–2:45 min      |
| H-010      | Data entry accuracy                 | ≥98%               |

---

## Unknowns & Risks

### Unknown-001: Does Mobile Usability Matter?

Staff might want to record transactions from phone during service. Currently not prioritizing mobile (desktop-first).

**Resolution**: After desktop pilot, evaluate mobile demand.

### Unknown-002: Will Leaders Approve Fast Enough?

2-leader approval adds latency. If approval takes 3+ days, staff might bypass system.

**Resolution**: Monitor approval SLA, adjust if >24h becomes bottleneck.

### Unknown-003: Do Staff Trust "Hidden" Double-Entry?

If staff don't understand _how_ double-entry works, do they trust the system?

**Proposed Education**: 15-min session before launch.

---

## Next Steps

1. **Phase 1a**: Create MENTAL_MODELS.md (map staff thinking ↔ system design)
2. **Phase 1b**: Create UXDR.md (document each design decision + evidence)
3. **Phase 1c**: Create TEST_PLAN.md (structured test scenarios)
4. **Phase 2**: Build HTML prototype to test H-001 through H-010
5. **Phase 3**: Sit down with staff + leaders (2–3 people, 90 min)
6. **Phase 4**: Analyze results, iterate hypotheses, update docs
7. **Phase 5**: Once validation passes, build backend + real UI
