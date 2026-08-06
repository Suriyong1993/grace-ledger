# Glossary — Term Definitions

**Purpose**: Every term has one meaning. Consistency prevents "did you mean X or Y?"  
**Maintenance**: When a new term is introduced, add it here + link back to source doc.  
**Authority**: This is the source of truth. Reference this, don't invent definitions.

---

## Financial / Domain Terms

### Event (noun)

A user-initiated financial action recorded in Grace Ledger. Examples: receiving offering, paying expense, depositing to bank.

**User perspective**: "I recorded an event: received ฿15,000 offering"

**System perspective**: Event generates a balanced journal entry automatically.

**Types**:

- Income event: รับเงิน (Receiving money)
- Expense event: บันทึกรายจ่าย (Recording expense)
- Transfer event: โอนเงิน (Moving money between funds)

**NOT the same as**:

- Transaction (can mean event or internal system operation)
- Journal Entry (system output, not user input)

**Used in**: UXDR-001, UXDR-002, MENTAL_MODELS.md, PHASE-0-HYPOTHESES.md (H-001)

---

### Transaction (noun)

Ambiguous term. Avoid unless context is clear.

**In Grace Ledger context**:

- User-level: synonymous with "Event"
- System-level: can refer to journal entry or event

**Better alternatives**:

- Use "Event" for user actions (รับเงิน, จ่ายค่าไฟ)
- Use "Journal Entry" for accounting records
- Use "Record" as verb (staff "record" events)

**Used in**: TEST_PLAN.md (scenario descriptions)

---

### Journal Entry (noun)

System-generated accounting record. Never created manually by staff.

**Structure**:

- Debit line (amount, account)
- Credit line (amount, account)
- Lines must balance (Dr = Cr)

**User visibility**: Hidden from Finance Staff and Leaders. Visible to Admin/Auditor only.

**Generation**: System auto-generates from Event. Example:

```
Event: รับถวาย ฿15,000 (cash)
Auto-generated Journal Entry:
  Dr. Cash          15,000
  Cr. Offering       15,000
```

**Used in**: UXDR-001, UXDR-006, MENTAL_MODELS.md

---

### Offering (noun)

Money given by church members for general church use.

**Categories**:

- Sunday worship offering (ถวายวันอาทิตย์)
- Special offering (ถวายพิเศษ)
- Tithe (สิบลด)
- Other offering

**System**: Maps to "Offering Income" account (hidden from staff).

**Used in**: MENTAL_MODELS.md, TEST_PLAN.md, UXDR-007

---

### Expense (noun)

Money spent by the church for operational purposes.

**Categories**:

- Utilities (ค่าไฟ, ค่าน้ำ)
- Salaries (เงินเดือน)
- Maintenance (ค่าซ่อมแซม)
- Other

**System**: Maps to relevant Expense account (e.g., "Utilities Expense").

**Used in**: MENTAL_MODELS.md, TEST_PLAN.md (Scenario B)

---

### Fund (noun)

A separate pot of money within the church. Used for budget tracking and segregation.

**Examples**:

- General Fund
- Building Fund
- Missions Fund
- Benevolence Fund

**Staff perspective**: "Which fund is this offering for?"

**System perspective**: Tracks by fund_id, enables fund-specific reporting.

**Used in**: MENTAL_MODELS.md, TEST_PLAN.md

---

### Receipt (noun)

Physical or digital proof of a financial transaction.

**Requirement**: Every transaction must have receipt attached.

**Formats**:

- Photo (receipt, envelope, bank slip)
- PDF (invoice, receipt scan)
- Screenshot (digital payment confirmation)

**Used in**: UXDR-007, TEST_PLAN.md, GOVERNANCE.md

---

## Workflow / Process Terms

### Approval (noun)

Authorization by a leader to proceed with a recorded transaction.

**Structure**:

- 1 approval: for transactions ≤ ฿5,000 and ฿5-50k
- 2 approvals: for transactions > ฿50,000

**Rules**:

- Must be different people (no self-approval)
- Sequential or parallel (flexible)
- Cannot be undone (irreversible)

**User perspective (Staff)**: "Waiting for approval from [Leader name]"

**User perspective (Leader)**: "I need to review and approve this"

**Used in**: MENTAL_MODELS.md, UXDR-004, TEST_PLAN.md (Scenario C)

---

### Approval Status (noun)

Current state of a transaction in the approval pipeline.

**States**:

- Draft: Created but not submitted
- Pending Approval: Submitted, awaiting leader review
- Partially Approved: 1 of 2 leaders approved
- Fully Approved: All required approvals obtained
- Rejected: Leader declined; must resubmit
- Executed: Approved and processed (payment made, cash deposited, etc.)

**Visualization**: Timeline showing who approved when.

**Used in**: UXDR-004, TEST_PLAN.md (Scenario D), MENTAL_MODELS.md

---

### Submission (noun)

Act of sending a recorded transaction to leaders for approval.

**User perspective**: "Submit for approval" button

**System perspective**: Transitions transaction from draft → pending_approval state

**Once submitted**: Staff cannot edit; only Admin/Leader can reject and create correction path

**Used in**: TEST_PLAN.md, UXDR-013

---

### Completion Time (metric)

Time elapsed from user starts task to task completion.

**Measurement**: Stopwatch from first click to final [Submit] or [Approve] button

**Target**: < 3 minutes for transaction recording

**Used in**: TEST_PLAN.md (M-001), UXDR-002, H-009

---

### Cognition Load (noun)

Mental effort required to use the system.

**Reduction techniques**:

- Hide accounting jargon
- Use sequential wizard (not all-at-once form)
- Pre-select defaults where possible
- Consistent terminology (see GLOSSARY)

**Measure**: Help requests, confusion, task errors

**Used in**: UXDR-002, PHASE-0-HYPOTHESES.md (H-002)

---

## UI / Design Terms

### Wizard (noun)

Step-by-step form flow. User progresses linearly: Step 1 → 2 → 3 → 4 → Done.

**Advantages**:

- Chunks information
- Reduces decision fatigue
- Clear progress indication

**Disadvantages**:

- Requires more clicks than single-page form
- Harder to go back and edit

**Grace Ledger**: 4-step wizard for income/expense events.

**Used in**: UXDR-002, TEST_PLAN.md

---

### Screen ID (noun)

Unique identifier for a prototype/UI screen. Format: `[Role Abbreviation]-[Number]`

**Examples**:

- `FS-001`: Finance Staff Home
- `FS-002`: Record Income Wizard Step 1
- `LD-001`: Leader Approval Queue
- `AD-001`: Admin Dashboard

**Purpose**: Trace user interface ← UXDR ← Hypothesis

**Used in**: Prototype documentation, DECISION_INDEX.md

---

### Prototype (noun)

Interactive mockup of UI, built before backend development.

**Characteristics**:

- Clickable (but not connected to database)
- Uses mock data (not real data)
- Implements key flows (recording event, approving)

**Purpose**: Test UX assumptions before building backend

**Format**: HTML + React (Phase 1), not Figma mockup

**Used in**: Test Plan, DECISION_INDEX.md

---

### Mock Data (noun)

Fake but realistic data used in prototype.

**Examples**:

- Sample offering: "Sunday Worship - ฿15,000 - 2026-08-04"
- Sample leader approvals: "Approved by Pastor Somchai at 10:15 AM"

**Purpose**: Simulate system behavior without real database

**Used in**: Prototype implementation

---

## Administrative / Process Terms

### Hypothesis (noun)

An assumption about users or the system that needs validation.

**Examples**:

- "Staff think in events, not accounting"
- "< 3 minute completion time is achievable"

**Status**:

- Not Validated: Initial assumption
- Testing: Currently in user test
- Confirmed: User test passed
- Rejected: User test contradicted

**Used in**: PHASE-0-HYPOTHESES.md, DECISION_INDEX.md

---

### UX Decision (noun)

A design choice made to implement a hypothesis.

**Format**: UXDR (UX Decision Record)

**Examples**:

- UXDR-001: Event-based workflow
- UXDR-004: Timeline approval status

**Immutable**: Once published, UXDR is never edited. If wrong, create new UXDR instead.

**Used in**: UXDR.md, DECISION_INDEX.md

---

### Traceability (noun)

Ability to trace a decision from hypothesis → design → prototype → test → result.

**Chain**:

```
H-001 (Hypothesis)
  ↓
UXDR-001 (Design Decision)
  ↓
FS-001, FS-002 (Screen IDs)
  ↓
TS-001 (Test Scenario)
  ↓
R-001 (Result)
```

**Purpose**: When something breaks, trace to the root assumption. When changing something, see all impact.

**Used in**: GOVERNANCE.md, DECISION_INDEX.md

---

### Source of Truth (noun)

Single authoritative document for a piece of information.

**Examples**:

- < 3 min target: Lives in TEST_PLAN.md, referenced elsewhere
- H-001 definition: Lives in PHASE-0-HYPOTHESES.md, referenced elsewhere
- "Offering" definition: Lives in GLOSSARY.md (this file), referenced everywhere

**Rule**: Never copy information to multiple docs. Always link back to source.

**Used in**: GOVERNANCE.md

---

### Ownership (noun)

Clear assignment of responsibility for a document.

**Required**: Every document lists owner (name + email)

**Responsibility**:

- Keep document accurate and current
- Review quarterly
- Respond to questions about the document
- Approve changes (if status is "Proposed")

**Used in**: GOVERNANCE.md

---

## Testing / Validation Terms

### Test Scenario (noun)

A specific task a user performs to validate a hypothesis.

**Format**: "User receives ฿15,000 offering. Record it."

**Measurement**: Time, errors, questions, confidence

**Used in**: TEST_PLAN.md (TS-001, TS-002, etc.)

---

### Success Criteria (noun)

Measurable thresholds determining if hypothesis is confirmed.

**Examples**:

- Task completion: < 3 minutes
- Error rate: < 5%
- Accuracy: ≥ 98%
- Questions: < 2 per task

**Used in**: PHASE-0-HYPOTHESES.md, TEST_PLAN.md, UXDR.md

---

### Go/No-Go Decision (noun)

Checkpoint after Phase 1 testing: proceed to backend development, or iterate UX?

**Go Criteria**:

- ✓ Completion time < 3 min
- ✓ 0 accounting questions
- ✓ ≥ 90% task success
- ✓ No major usability blockers

**No-Go Criteria**:

- ✗ Completion time > 4 min
- ✗ Multiple accounting questions
- ✗ < 70% task success
- ✗ Confusion about approval states

**Used in**: TEST_PLAN.md

---

## Accounting Terms (Used Internally, NOT with Users)

### Debit (noun)

Accounting entry increasing asset/expense accounts, decreasing liability/income accounts.

**User perspective**: NEVER use this term. Use "recorded" or "received" instead.

**System perspective**: Visible to Admin/Auditor, hidden from staff/leaders.

**Used in**: MENTAL_MODELS.md, internal domain code

---

### Credit (noun)

Accounting entry increasing liability/income/equity accounts, decreasing asset/expense accounts.

**User perspective**: NEVER use this term.

**System perspective**: Visible to Admin/Auditor, hidden from staff/leaders.

**Used in**: MENTAL_MODELS.md, internal domain code

---

### Double-Entry Bookkeeping (noun)

Accounting principle: every transaction has a debit and a credit, always balanced.

**User perspective**: NEVER mention this. System handles it invisibly.

**Education**: 15-min lesson for staff before launch (why it matters, why we do it).

**Used in**: MENTAL_MODELS.md, backend domain logic

---

### Chart of Accounts (noun)

Master list of all accounts (assets, liabilities, income, expenses).

**User perspective**: Hidden completely from Finance Staff and Leaders.

**Admin/Auditor perspective**: Central configuration tool.

**Used in**: UXDR-005 (why we hide it)

---

### Audit Trail (noun)

Immutable record of all transactions, approvals, and system changes.

**User perspective**: Leaders can see "who approved when" in approval timeline.

**Admin/Auditor perspective**: Detailed hash-chain verification, SQL logs, etc.

**Used in**: UXDR-008, domain/AUDIT_TRAIL.md (when created)

---

## Version / Documentation Terms

### Status (metadata field)

Current state of a document.

**Values**:

- **Not Validated**: Hypothesis not yet tested
- **Proposed**: Design decision awaiting approval
- **Accepted**: Team approved design decision
- **Testing**: Currently in user test
- **Confirmed**: User test validated it
- **Rejected**: User test contradicted it
- **Superseded**: Replaced by newer decision

**Used in**: All documents (metadata)

---

### Traceability (metadata field)

Links to other documents this one references.

**Format**: `H-001, UXDR-001, FS-001, TS-001`

**Purpose**: Quickly see what this decision touches

**Used in**: Document metadata

---

### Version (metadata field)

Document version number. Format: `Major.Minor`

- v1.0: Initial publication
- v1.1, v1.2, ...: Clarifications, typos, links (no meaning change)
- New major feature? Create new document instead (don't increment to v2.0)

**Used in**: All documents (metadata)

---

## Quick Reference Table

| Term            | Context     | Definition                                   | See Also           |
| --------------- | ----------- | -------------------------------------------- | ------------------ |
| Event           | User action | Financial action (income, expense, transfer) | Transaction        |
| Journal Entry   | Accounting  | Auto-generated Dr/Cr record                  | Debit, Credit      |
| Approval        | Workflow    | Leader authorization to proceed              | Approval Status    |
| Completion Time | Metric      | Time to finish task                          | < 3 min target     |
| Wizard          | UI          | Step-by-step form flow                       | Screen ID          |
| Hypothesis      | Product     | Assumption to validate                       | PHASE-0-HYPOTHESES |
| UXDR            | Decision    | UX design choice                             | UXDR.md            |
| Traceability    | Process     | Link hypothesis → design → test → result     | DECISION_INDEX     |

---

## Adding Terms

When you create a new concept:

1. Add definition here
2. Add "Used in: [doc names]" at bottom of definition
3. Update source docs to reference: "See GLOSSARY: [Term]"
4. Update version at top: v1.X → v1.X+1
5. Note in version history what term was added

---

## Deprecations

When a term is no longer used:

1. Keep definition but mark: ⚠️ **Deprecated** (use [new term] instead)
2. Link to replacement term
3. Note which docs still use it (for migration)

Example:

```
### Journal (deprecated)

⚠️ Use "Journal Entry" instead for accounting records.
Use "Event" for user actions.

(Historical note: "Journal" was ambiguous, so we split it.)
```
