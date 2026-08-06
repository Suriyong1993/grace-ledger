# Decision Index — Traceability Matrix

**Purpose**: One-stop view of all decisions and their connections.  
**Usage**: Start here to understand impact chain: Hypothesis → Design → Prototype → Test → Result  
**Maintenance**: Update whenever new hypothesis, UXDR, screen ID, or test result is added.

---

## How to Read This Matrix

### Columns

| Column            | Meaning                                   |
| ----------------- | ----------------------------------------- |
| **ID**            | Unique identifier (H-001, UXDR-001, etc.) |
| **Hypothesis**    | User assumption being tested              |
| **UX Decision**   | Design choice to implement hypothesis     |
| **Screen IDs**    | Prototype screens involved                |
| **Test Scenario** | How we validate (from TEST_PLAN.md)       |
| **Result**        | Outcome (✓ Pass, ✗ Fail, ⏳ Pending)      |
| **Status**        | Validated, Proposed, Accepted, etc.       |

### Example

```
H-001: Staff think in events
  ↓
UXDR-001: Event-based workflow
  ↓
FS-001, FS-002: Finance screens
  ↓
TS-001: Record offering task
  ↓
R-001: (Pending Phase 1 testing)
```

---

## Full Matrix

| Hypothesis                                        | Related UXDR       | Screen IDs             | Test Scenario          | Result          | Status        |
| ------------------------------------------------- | ------------------ | ---------------------- | ---------------------- | --------------- | ------------- |
| **H-001** Staff think in events, not accounting   | UXDR-001, UXDR-002 | FS-001, FS-002, FS-003 | TS-001, TS-002         | R-001 (pending) | Not Validated |
| **H-002** Wizard 4 steps < 3 min                  | UXDR-002           | FS-002, FS-003         | TS-001, TS-002         | R-002 (pending) | Not Validated |
| **H-003** Staff don't need advanced features      | UXDR-005, UXDR-006 | FS-001                 | TS-006                 | R-003 (pending) | Not Validated |
| **H-004** Role separation improves clarity        | UXDR-003           | FS-001, LD-001         | TS-003, TS-004         | R-004 (pending) | Not Validated |
| **H-005** Approval status must be clear           | UXDR-004           | LD-001, LD-002         | TS-004                 | R-005 (pending) | Not Validated |
| **H-006** 2-leader approval is secure             | UXDR-004           | LD-002                 | TS-004, TS-005         | R-006 (pending) | Not Validated |
| **H-007** Event names match staff vocabulary      | UXDR-009           | FS-002, FS-003, FS-004 | TS-001, TS-002, TS-003 | R-007 (pending) | Not Validated |
| **H-008** Hidden double-entry maintains integrity | UXDR-001, UXDR-006 | (Backend only)         | TS-007                 | R-008 (pending) | Not Validated |
| **H-009** < 3 min transaction time achievable     | UXDR-002           | FS-002, FS-003, FS-004 | TS-001, TS-002         | R-009 (pending) | Not Validated |
| **H-010** < 5% data entry error rate              | UXDR-002, UXDR-007 | FS-002, FS-003         | TS-001, TS-002         | R-010 (pending) | Not Validated |

---

## UX Decision (UXDR) Details

| UXDR         | Title                               | Hypothesis   | Impact                          | Screens                | Status   |
| ------------ | ----------------------------------- | ------------ | ------------------------------- | ---------------------- | -------- |
| **UXDR-001** | Event-based workflow (not journal)  | H-001        | Staff see events, not journals  | FS-001, FS-002         | Accepted |
| **UXDR-002** | Wizard flow (4 steps)               | H-002, H-009 | Sequential form, < 3 min target | FS-002, FS-003         | Accepted |
| **UXDR-003** | Separate UI for Finance vs Leaders  | H-004        | Different home screens by role  | FS-001, LD-001         | Accepted |
| **UXDR-004** | Timeline approval status            | H-005, H-006 | Show who approved when          | LD-002                 | Accepted |
| **UXDR-005** | Hide Chart of Accounts              | H-003        | Admin-only visibility           | FS-001                 | Accepted |
| **UXDR-006** | No manual journal entry             | H-003, H-008 | Only system-generated journals  | FS-001                 | Accepted |
| **UXDR-007** | Require receipt upload              | H-010        | Evidence for every transaction  | FS-002, FS-003, FS-004 | Accepted |
| **UXDR-008** | Approval requires detail review     | H-006        | Leader must see receipt         | LD-002                 | Accepted |
| **UXDR-009** | Thai language exclusively           | H-007        | No English except errors        | All FS, LD             | Accepted |
| **UXDR-010** | No keyboard shortcuts               | (General)    | Mouse/touch only                | All screens            | Accepted |
| **UXDR-011** | Non-technical error messages        | (General)    | User-friendly errors            | All screens            | Accepted |
| **UXDR-012** | One transaction per action          | (General)    | No batch/bulk entry             | FS-002, FS-003         | Accepted |
| **UXDR-013** | Transaction edit/void by admin only | H-010        | Immutability principle          | FS-001                 | Accepted |

---

## Prototype Screens (Screen IDs)

### Finance Staff Screens

| Screen ID  | Title                                       | UXDR Implements              | Test Scenario          | Status           |
| ---------- | ------------------------------------------- | ---------------------------- | ---------------------- | ---------------- |
| **FS-001** | Finance Home                                | UXDR-001, UXDR-003, UXDR-005 | TS-001, TS-002, TS-006 | Design (pending) |
| **FS-002** | Record Income Wizard - Step 1 (Category)    | UXDR-001, UXDR-002, UXDR-009 | TS-001                 | Design (pending) |
| **FS-003** | Record Income Wizard - Step 2 (Amount)      | UXDR-001, UXDR-002, UXDR-009 | TS-001                 | Design (pending) |
| **FS-004** | Record Income Wizard - Step 3 (Destination) | UXDR-001, UXDR-002, UXDR-009 | TS-001                 | Design (pending) |
| **FS-005** | Record Income Wizard - Step 4 (Review)      | UXDR-007, UXDR-008, UXDR-011 | TS-001                 | Design (pending) |
| **FS-006** | Record Expense Wizard (same flow)           | UXDR-001, UXDR-002           | TS-002                 | Design (pending) |
| **FS-007** | Transaction History                         | UXDR-003                     | TS-001, TS-002         | Design (pending) |
| **FS-008** | Error Recovery (validation fail)            | UXDR-011                     | TS-008                 | Design (pending) |

### Leader Screens

| Screen ID  | Title                         | UXDR Implements    | Test Scenario          | Status           |
| ---------- | ----------------------------- | ------------------ | ---------------------- | ---------------- |
| **LD-001** | Approval Queue (Pending list) | UXDR-003, UXDR-004 | TS-003, TS-004         | Design (pending) |
| **LD-002** | Approval Detail               | UXDR-004, UXDR-008 | TS-003, TS-004, TS-005 | Design (pending) |
| **LD-003** | Timeline Status View          | UXDR-004           | TS-004                 | Design (pending) |

### Admin Screens (Hidden from staff/leaders)

| Screen ID  | Title             | Related UXDR | Status         |
| ---------- | ----------------- | ------------ | -------------- |
| **AD-001** | Chart of Accounts | UXDR-005     | Design (later) |
| **AD-002** | Journal Ledger    | UXDR-006     | Design (later) |
| **AD-003** | Audit Trail       | UXDR-008     | Design (later) |

---

## Test Scenarios (TS-001 through TS-008)

| Scenario ID | Task                                  | Tests Hypothesis    | Tests UXDR                   | Expected Result                        | Status     |
| ----------- | ------------------------------------- | ------------------- | ---------------------------- | -------------------------------------- | ---------- |
| **TS-001**  | Record Sunday offering ฿15,000        | H-001, H-009, H-010 | UXDR-001, UXDR-002, UXDR-007 | < 3 min, 0 accounting questions        | Not Tested |
| **TS-002**  | Record expense ฿2,500                 | H-001, H-009, H-010 | UXDR-001, UXDR-002, UXDR-007 | < 3 min, correct category              | Not Tested |
| **TS-003**  | Find pending approvals                | H-004, H-005        | UXDR-003, UXDR-004           | Instant comprehension                  | Not Tested |
| **TS-004**  | Review and approve transaction        | H-005, H-006        | UXDR-004, UXDR-008           | < 2 min, 100% accuracy                 | Not Tested |
| **TS-005**  | Understand approval states (timeline) | H-005               | UXDR-004                     | 100% accuracy on status                | Not Tested |
| **TS-006**  | Search for Chart of Accounts          | H-003               | UXDR-005                     | Can't find it (good)                   | Not Tested |
| **TS-007**  | Submit invalid entry (missing amount) | H-010               | UXDR-011                     | Clear error message, recovery < 30 sec | Not Tested |
| **TS-008**  | Mobile usability (optional)           | H-009               | UXDR-002                     | < 3 min on phone                       | Not Tested |

---

## Results (R-001 through R-010)

Populated during Phase 1 testing. Example format:

```
R-001: H-001 Validation

Hypothesis: Staff think in events, not accounting

Test Scenario: TS-001, TS-002 (Record offering and expense)

Participant 1:
  - Time: 2:45 ✓
  - Questions: 0 ✓
  - Success: Yes ✓
  - Confidence: 4.5/5 ✓

Participant 2:
  - Time: 3:15 (slightly over)
  - Questions: 1 ("What's 'รับเข้าที่'?")
  - Success: Yes ✓

Result: CONFIRMED (with minor UX clarification needed)
Update: UXDR-001 v1.1 - Add help text to "รับเข้าที่" field
```

---

## Known Issues / Conflicts

None documented yet (Phase 0).

Once testing begins, if conflicts arise:

- Document here
- Don't edit conflicting UXDRs
- Create resolution plan
- Update when resolved

Example format:

```
## Conflict: UXDR-004 vs UXDR-008

UXDR-004: "Show who approved in timeline"
UXDR-008: "Approval requires detail review" (implies leader sees receipt, not just names)

Issue: How can we show names without showing detail?

Resolution: Approve can show both. Timeline shows names. Clicking approval shows detail.

Resolved: [Date]
```

---

## Pending Work

### Before Phase 1 (Prototype Ready)

- [ ] All 13 UXDRs reviewed and marked "Accepted"
- [ ] Screen IDs FS-001 through FS-008, LD-001 through LD-003 designed
- [ ] HTML prototype built with screen IDs embedded
- [ ] TEST_PLAN.md reviewed (8 scenarios ready)
- [ ] GLOSSARY.md reviewed (terms finalized)

### During Phase 1 (Testing)

- [ ] Run TS-001 through TS-008 with 3 participants
- [ ] Record results (R-001 through R-010)
- [ ] Analyze patterns (where all 3 struggled)
- [ ] Make Go/No-Go decision

### After Phase 1

- [ ] Update hypothesis status (Confirmed or Rejected)
- [ ] Create iteration log (what changed, why)
- [ ] Proceed to backend development OR iterate UX

---

## Generating This Matrix

**Current**: Hand-maintained (this file).

**Future**: Could be auto-generated from metadata in individual docs.

When adding new hypothesis or UXDR:

1. Add row to relevant section
2. Link all connected items (UXDR, screens, tests)
3. Verify no orphaned items
4. Check for conflicts

---

## Quick Navigation

### By Role

**Product Manager**: See PHASE-0-HYPOTHESES.md, UXDR.md

**Engineer**: See MENTAL_MODELS.md, UXDR.md, Screen IDs

**QA**: See TEST_PLAN.md, Test Scenarios (TS-001 through TS-008)

**Tech Lead**: See GOVERNANCE.md, DECISION_INDEX.md

### By Question

**"Why did we design it this way?"**  
→ Find hypothesis, trace to UXDR, check rationale

**"What screens implement this decision?"**  
→ Find UXDR, look at "Screen IDs" column

**"How do we test this?"**  
→ Find UXDR, look at "Test Scenario" column, see TEST_PLAN.md

**"Did we validate this?"**  
→ Find hypothesis, check "Result" column, see TEST_RESULTS.md (after Phase 1)

---

## Version History

| Version | Date       | Change                                |
| ------- | ---------- | ------------------------------------- |
| 1.0     | 2026-08-04 | Initial matrix (Phase 0, all pending) |
