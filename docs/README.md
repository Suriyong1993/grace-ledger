# Grace Ledger v2 — Product Documentation

**Purpose**: Central hub for product decisions, assumptions, and design rationale.  
**Audience**: Product, Engineering, QA, Future Team Members  
**Governance**: See GOVERNANCE.md  

---

## 🗂️ Document Structure

```
docs/
├── README.md (this file)
├── GOVERNANCE.md          ← Read this first
├── GLOSSARY.md            ← Consult for term definitions
├── DECISION_INDEX.md      ← Navigate via traceability
│
├── product/
│   ├── PHASE-0-HYPOTHESES.md     (H-001 through H-010)
│   └── MENTAL_MODELS.md          (Staff → System translation)
│
├── ux/
│   ├── UXDR.md                   (UXDR-001 through UXDR-013)
│   ├── DESIGN_PRINCIPLES.md      (Coming)
│   └── WIREFRAMES.md             (Coming)
│
├── domain/
│   ├── ACCOUNTING_RULES.md       (Coming)
│   ├── EVENT_MODEL.md            (Coming)
│   ├── APPROVAL_WORKFLOW.md      (Coming)
│   └── BUSINESS_RULES.md         (Coming)
│
├── architecture/
│   ├── ADR/                      (Architecture Decision Records)
│   └── SYSTEM_ARCHITECTURE.md    (Coming)
│
└── validation/
    ├── TEST_PLAN.md              (TS-001 through TS-008)
    ├── TEST_RESULTS.md           (Populated after Phase 1)
    ├── USER_FEEDBACK.md          (Populated after Phase 1)
    └── ITERATION_LOG.md          (Populated after Phase 1)
```

---

## 📖 How to Navigate

### I'm new to Grace Ledger. Where do I start?

1. **This file** (README.md)
2. **GOVERNANCE.md** — Understand how docs are managed
3. **GLOSSARY.md** — Learn term definitions
4. **PHASE-0-HYPOTHESES.md** — Understand user assumptions
5. **MENTAL_MODELS.md** — See user ↔ system translation

### I'm building a feature. What do I need?

1. **DECISION_INDEX.md** — Find relevant hypothesis
2. **UXDR.md** — See UX decision + rationale
3. **TEST_PLAN.md** — Understand how feature is validated
4. **GLOSSARY.md** — Confirm term meanings

### I'm implementing something and got stuck. How do I know "is this right?"

1. Find your task in **DECISION_INDEX.md**
2. Follow the chain: H-XXX → UXDR-YYY → FS-ZZZ (screen ID)
3. Check **TEST_PLAN.md** → see what success looks like
4. If still unclear, check **GOVERNANCE.md** → who's the owner?

### I found a bug or have a better idea. What do I do?

1. Check **GOVERNANCE.md** → "Updating Documents"
2. Create a new UXDR (don't edit old ones)
3. Link old UXDR: "UXDR-XXX Revision: Superseded by UXDR-YYY"
4. Update **DECISION_INDEX.md**

---

## 🔗 Traceability: How It Works

Every hypothesis flows through the system like this:

```
HYPOTHESIS (H-001)
  "Staff think in events, not accounting"
  
  ↓ Shapes Design Decision
  
UXDR (UXDR-001)
  "Event-based workflow (not journal-based)"
  
  ↓ Implemented as
  
PROTOTYPE SCREEN (FS-001)
  "Finance Home with event buttons"
  
  ↓ Tested by
  
TEST SCENARIO (TS-001)
  "Finance Staff Records Offering"
  
  ↓ Results in
  
RESULT (R-001)
  "Task completed in 2:45, no accounting questions"
  
  ↓ Feeds back into
  
ITERATION (I-001)
  "H-001 Confirmed ✓ — Staff naturally think in events"
```

**Why this matters**: If you change your mind about H-001, you immediately know:
- Which UX to change (UXDR-001)
- Which screens to update (FS-001)
- Which tests to re-run (TS-001)

No "discovery" phase, no "where did this come from?"

---

## 📋 Document Types & Lifecycle

### Hypotheses (PHASE-0-HYPOTHESES.md)

| State | Meaning | Action |
|---|---|---|
| **Not Validated** | Assumption, not yet tested | Review before Phase 1 |
| **Testing** | Currently in user test | Don't change; record results |
| **Confirmed ✓** | User test passed | Implement with confidence |
| **Failed ✗** | User test contradicted it | Revise and re-test |
| **Superseded** | Replaced by better hypothesis | Keep for history |

### UX Decisions (UXDR.md)

| State | Meaning | Action |
|---|---|---|
| **Proposed** | Awaiting approval | Review in design meeting |
| **Accepted** | Team agreed | Build prototype |
| **Validated** | User test confirmed | Implement |
| **Rejected** | User test contradicted | Create new UXDR, don't edit old |
| **Superseded** | Replaced by new decision | Link both for history |

### Never Edit Old Decisions

Once a decision is published (even if just proposed), it's immutable. If you disagree:
- Create a new UXDR (e.g., UXDR-014: "Reverts UXDR-004")
- Explain why old decision is wrong
- Link both documents

This preserves history and prevents "did we decide this or not?" confusion.

---

## 🏷️ Metadata Requirements

Every document must have (top of file):

```markdown
---
type: Hypothesis | UXDR | Test Plan | etc.
status: Not Validated | Proposed | Accepted | Confirmed | Rejected | Superseded
owner: [Name/Role]
version: 1.0
date: YYYY-MM-DD
traceability: H-001, UXDR-001, FS-001, TS-001
related: [Link to related docs]
---
```

Example:

```markdown
# UXDR-001: Event-Based Workflow

**Type**: UX Decision  
**Status**: Accepted  
**Owner**: Product Team  
**Version**: 1.0  
**Date**: 2026-08-04  
**Traceability**: H-001, FS-001, TS-001  
**Related**: MENTAL_MODELS.md, UXDR-002  
```

---

## ⚠️ Anti-Patterns (Don't Do This)

### ❌ Copy-Pasting Between Docs

BAD:
```
UXDR-001: "Staff think in events..."
UXDR-002: "Staff think in events... (same text)"
```

GOOD:
```
UXDR-001: "Staff think in events..."
UXDR-002: "Builds on UXDR-001 — see H-001"
```

### ❌ Ambiguous Terms

BAD:
```
"Transaction time should be fast"
```

GOOD:
```
"Completion time < 3 minutes (see GLOSSARY.md: Completion Time)"
```

### ❌ Editing Old Decisions

BAD:
```
UXDR-001 (created 2026-08-04)
        ↓
UXDR-001 EDITED 2026-09-15 (nobody knows what changed)
```

GOOD:
```
UXDR-001 (created 2026-08-04, Superseded by UXDR-014)
        ↓
UXDR-014 (created 2026-09-15, "Reverts UXDR-001 because...")
```

### ❌ Orphaned Documents

BAD:
```
Created: DESIGN_PRINCIPLES.md
Nobody links to it.
```

GOOD:
```
Created: DESIGN_PRINCIPLES.md
Links from: DECISION_INDEX.md, UXDR-001, UXDR-003
```

---

## 🔄 Version Management

Single file, multiple versions in history:

```markdown
# UXDR-001: Event-Based Workflow

**Version**: 1.2  
**Status**: Accepted  

## Version History

| Version | Date | Change | Reason |
|---|---|---|---|
| 1.0 | 2026-08-04 | Initial | Phase 0 hypothesis |
| 1.1 | 2026-08-10 | Clarified "Event" definition | Added GLOSSARY reference |
| 1.2 | 2026-08-15 | Added success metrics | Feedback from design review |

## Current Content (v1.2)

...
```

NEVER create separate files like `UXDR-001-v2.md`. Keep everything in one place with version tracking.

---

## 👥 Ownership & Escalation

Every decision needs a clear owner:

```
UXDR-001
Owner: Product Manager (ptasana@gmail.com)
Reviewer: Tech Lead
Approver: Project Sponsor
```

If you disagree with a decision:
1. Comment in the document (markdown comment)
2. Tag owner
3. If no consensus, escalate to Approver

---

## 📆 Review Cadence

| When | What | Owner |
|---|---|---|
| Before Phase 1 | All Hypotheses + UXDR | Product Manager |
| After Phase 1 | Test Results + Iterations | Product + QA |
| Monthly | Orphaned docs, consistency | Tech Lead |
| At code review | Reference docs in PR comments | Engineer |

---

## 🚨 Red Flags (Maintenance Needed)

- [ ] Any UXDR without a traceability link
- [ ] Hypothesis not linked to any UXDR
- [ ] Glossary term used inconsistently
- [ ] Document older than 3 months without "reviewed on [DATE]"
- [ ] Status says "Not Validated" but it's been 6 months (either validate or archive)

---

## 📦 Creating New Documents

When you create a new document:

1. **Add to this README** (link + brief description)
2. **Add to DECISION_INDEX** (if it's a decision)
3. **Add to GLOSSARY** (if it introduces new terms)
4. **Add metadata** (type, status, owner, version, traceability)
5. **Link backwards** (reference supporting docs)

Template for new UXDR:

```markdown
# UXDR-XXX: [Title]

**Type**: UX Decision  
**Status**: Proposed  
**Owner**: [Name]  
**Version**: 1.0  
**Date**: YYYY-MM-DD  
**Traceability**: H-XXX  
**Related**: [Other docs]  

## Decision

[One sentence: what are we deciding?]

## Rationale

[Why this decision?]

## Impact

- ✅ [Positive consequence]
- ❌ [Negative consequence]

## Success Metrics

| Metric | Target |
|---|---|
| [Metric 1] | [Target] |

## Status

Not yet validated (Phase 1 testing)
```

---

## 🎓 Learning Path for New Team Members

**Day 1:**
- Read this README
- Read GOVERNANCE.md
- Read GLOSSARY.md

**Day 2:**
- Read PHASE-0-HYPOTHESES.md
- Read MENTAL_MODELS.md

**Day 3:**
- Read UXDR.md (focus on UXDRs related to your task)
- Read TEST_PLAN.md

**Day 4:**
- Pick a task from DECISION_INDEX.md
- Follow the chain: H → UXDR → Test → Result
- Ask questions if anything is unclear

**By Day 5:**
- New team member should be able to:
  - Explain why a UX decision was made
  - Know what success looks like
  - Understand the user mental model
  - Avoid building something that violates a decision

---

## 🔍 FAQ

**Q: I want to change a UX decision. Do I edit UXDR-001?**  
A: No. Create UXDR-014 (next number) explaining why UXDR-001 is wrong. Link both. Never edit old UXDRs.

**Q: Where do I track bugs or edge cases?**  
A: Not in these docs. Use GitHub issues, linked to relevant UXDR.

**Q: What if two UXDRs conflict?**  
A: Note it in GOVERNANCE.md under "Known Issues". Plan to resolve in next iteration.

**Q: Can I add my own document?**  
A: Yes. Add it to README.md + DECISION_INDEX.md. Follow metadata requirements.

---

## Next Steps

1. Review GOVERNANCE.md (how to maintain these docs)
2. Review GLOSSARY.md (term definitions)
3. Review DECISION_INDEX.md (cross-references)
4. Proceed to Phase 1 (Prototype + Testing)
