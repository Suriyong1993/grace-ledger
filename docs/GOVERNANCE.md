# Documentation Governance

**Purpose**: Rules for maintaining product documentation so it doesn't rot.  
**Enforced By**: Tech Lead, Product Manager  
**Review Cadence**: Monthly

---

## Core Principles

### 1. Immutability

Once published, a document is **never edited**. If you disagree:

- Create a new document (e.g., UXDR-015 reverts UXDR-014)
- Link both for history
- Update DECISION_INDEX.md

**Why?**: Prevents "what was the original decision?" confusion. Preserves audit trail.

---

### 2. Single Source of Truth

Every piece of information lives in ONE place.

| Information           | Lives In                    | Other docs                |
| --------------------- | --------------------------- | ------------------------- |
| < 3 minute target     | TEST_PLAN.md (Metric M-001) | Link to M-001, don't copy |
| H-001 definition      | PHASE-0-HYPOTHESES.md       | Reference, don't repeat   |
| "Offering" definition | GLOSSARY.md                 | Reference everywhere      |

**Why?**: If it lives in 2 places, they'll diverge. When they diverge, which is the source of truth?

---

### 3. Traceability

Every design decision can be traced backward and forward:

```
Hypothesis (Why we think this?)
    ↓
UXDR (What decision did we make?)
    ↓
Screen ID (How does it look?)
    ↓
Test Scenario (How do we validate it?)
    ↓
Result (What happened?)
    ↓
Iteration (What did we learn?)
```

Every document must link to this chain.

**Why?**: When something breaks, you trace to the assumption. When you want to change something, you see immediate impact.

---

### 4. Minimal Documentation

Write only what's necessary. Don't over-document.

| ❌ Over-Documented           | ✅ Right-Sized                                    |
| ---------------------------- | ------------------------------------------------- |
| "Step 1: Click the button"   | "Click [Record Income]"                           |
| Full accounting textbook     | 1 paragraph explanation (see ACCOUNTING_RULES.md) |
| Repeat same decision 3 times | Reference once, link elsewhere                    |

**Why?**: Maintenance burden. More docs = more to keep in sync.

---

## Metadata Requirements

Every document starts with:

```markdown
---
type: [Hypothesis, UXDR, Test Plan, Domain Model, etc.]
status: [Not Validated, Proposed, Accepted, Confirmed, Rejected, Superseded]
owner: [Name/Email]
version: X.Y
date: YYYY-MM-DD
traceability: [H-001, UXDR-001, etc.]
related: [Link to connected docs]
---
```

### Status Definitions

| Status            | Meaning                       | Next Action                    |
| ----------------- | ----------------------------- | ------------------------------ |
| **Not Validated** | Hypothesis, no user data yet  | Review before Phase 1          |
| **Proposed**      | UX decision, not yet approved | Approval meeting needed        |
| **Accepted**      | Team agrees on decision       | Build prototype                |
| **Confirmed**     | User testing passed           | Implement with confidence      |
| **Rejected**      | User testing contradicted it  | Create new doc, don't edit     |
| **Superseded**    | Replaced by newer decision    | Keep for history, mark as such |

---

## Document Lifecycle

### Creation

1. Creator writes document with metadata
2. Adds to README.md + DECISION_INDEX.md
3. Adds to GLOSSARY.md (if new terms)
4. Marks status: "Not Validated" or "Proposed"

### Review

1. Owner/approver reviews (in order):
   - Is metadata complete?
   - Is it linked to supporting docs?
   - Are terms consistent with GLOSSARY?
   - Are metrics measurable?

2. If not ready, return with feedback
3. Creator iterates (v1.1, v1.2, etc.)
4. Once approved, status → "Accepted"

### Validation

1. During Phase 1 testing, hypothesis → "Testing"
2. After testing, status → "Confirmed ✓" or "Rejected ✗"
3. If rejected, don't edit; create new doc

### Maintenance

1. Every doc has an owner (and owner's email)
2. Owner reviews doc quarterly (minimum)
3. If unchanged in 6+ months, add "Last reviewed: [DATE]"
4. If outdated, create "XXXXX-Superseded-By.md"

---

## How to Edit (Never Edit Old Docs)

### Scenario: "This UXDR is wrong. I want to change it."

❌ WRONG:

```
Edit UXDR-001.md directly.
Change text.
Commit.
```

✅ RIGHT:

1. Create new file: `UXDR-014.md` (next available number)

```markdown
---
type: UXDR
status: Proposed
owner: [You]
version: 1.0
date: 2026-09-15
traceability: [Related to H-001]
related: UXDR-004
---

# UXDR-014: [New Decision]

**Reverts**: UXDR-004

## Why UXDR-004 Was Wrong

[Explain the problem with old decision]

## New Decision

[What are we doing instead?]

## Impact

[What changes?]
```

2. Update UXDR-004's footer:

```
**Status**: Superseded
**Superseded By**: UXDR-014
```

3. Update DECISION_INDEX.md to show both

4. Mark old doc as "Superseded" in metadata

---

## Version Numbering

Single file, versioned history inside:

```markdown
# UXDR-001: Event-Based Workflow

**Version**: 1.3  
**Status**: Accepted

## Version History

| Ver | Date       | Change                | Author | Reason                 |
| --- | ---------- | --------------------- | ------ | ---------------------- |
| 1.0 | 2026-08-04 | Initial               | PM     | Phase 0 decision       |
| 1.1 | 2026-08-08 | Clarified scope       | PM     | Design review feedback |
| 1.2 | 2026-08-12 | Added success metrics | QA     | Added test plan ref    |
| 1.3 | 2026-08-15 | Updated owner         | TL     | Ownership change       |
```

RULES:

- v1.0 = initial publication
- v1.1, v1.2, ... = clarifications, links, typos (no meaning change)
- Major meaning change? Create new UXDR instead (don't v2.0)

---

## Preventing Rot (Maintenance Checklist)

### Monthly (Tech Lead)

- [ ] Are there orphaned documents (created but not linked)?
- [ ] Are there conflicting UXDRs that both claim to be active?
- [ ] Do all documents have owners?
- [ ] Are version numbers sequential (no gaps)?

### Quarterly (Product Manager + Tech Lead)

- [ ] Are there UXDRs from 3+ months ago still marked "Proposed"? (Approve or reject)
- [ ] Are Hypotheses still marked "Not Validated"? (Test or discard)
- [ ] Has GLOSSARY drifted from actual usage? (Update)
- [ ] Are screen IDs in prototype still matching referenced UXDRs?

### Annually (Full Team)

- [ ] Archive superseded documents (move to `docs/archive/`)
- [ ] Update README with new team learning path
- [ ] Review GOVERNANCE itself — is it working?

---

## Handling Conflicts

### Scenario: Two UXDRs Seem to Contradict

Example:

```
UXDR-001: "Hide Journal entries from staff"
UXDR-007: "Show ledger balance to staff"  (seems contradictory)
```

**Process**:

1. Document the conflict in GOVERNANCE.md under "Known Issues":

```
## Known Issues

### Conflict: UXDR-001 vs UXDR-007
- UXDR-001: Hide journals
- UXDR-007: Show ledger balance
- Tension: Balance is derived from journals, so how hide one but show other?
- Resolution: [Explain how they actually work together]
- Target Resolution: Phase 2 testing
```

2. Don't edit either UXDR
3. Create a new explanatory document (e.g., `ux/DESIGN_CONSISTENCY.md`)
4. Update DECISION_INDEX to surface this
5. Resolve in next design review

---

## Who Has Authority?

| Role                | Authority                        | Scope                 |
| ------------------- | -------------------------------- | --------------------- |
| **Product Manager** | Approve hypotheses + UXDR        | What we're building   |
| **Tech Lead**       | Approve domain/architecture docs | How we're building it |
| **QA Lead**         | Approve test plans               | How we validate it    |
| **Project Sponsor** | Resolve escalations              | Tie-breaking          |

If you disagree with a decision:

1. Comment in the document (mention @owner)
2. If no resolution in 48h, escalate to next level
3. Keep discussion in docs (don't rehash in Slack)

---

## Glossary Management

GLOSSARY.md is the **source of truth** for every term.

### Adding a Term

1. Check if it's already there
2. If not, add to GLOSSARY.md:

```markdown
## Event

A financial action recorded by staff (Receiving money, paying bill, transferring funds).

**System representation**: Generates balanced journal entry automatically.

**See also**: Transaction (different), Journal Entry (output)

**Used in**: UXDR-001, PHASE-0-HYPOTHESES.md (H-001)
```

3. Update documents using this term to link: `See GLOSSARY: Event`
4. Update GLOSSARY.md's "Used in" when a new doc references it

### Changing a Definition

1. **If meaning hasn't changed**: Edit GLOSSARY directly, update version
2. **If meaning has changed**:
   - Create GLOSSARY-v2.md? No! Keep one GLOSSARY
   - Note in Version History what changed + why
   - Search for all usages, ensure they still make sense
   - Update all docs that reference it

---

## Traceability Matrix (DECISION_INDEX.md)

DECISION_INDEX.md is auto-generated reference table:

```markdown
| Hypothesis                | UXDR               | Screen ID      | Test   | Result    |
| ------------------------- | ------------------ | -------------- | ------ | --------- |
| H-001: Staff think events | UXDR-001, UXDR-002 | FS-001, FS-002 | TS-001 | R-001 ✓   |
| H-002: Wizard < 3 min     | UXDR-002           | FS-002, FS-003 | TS-002 | R-002 ✓   |
| H-003: Hide accounts      | UXDR-005           | FS-001         | TS-006 | (pending) |
```

**Purpose**:

- One view of all decisions
- See what's tested, what's pending
- Spot gaps (hypothesis not covered by UXDR? Red flag)

**Maintenance**:

- Update when new hypothesis created
- Update when UXDR added
- Update TEST_RESULTS.md, reflect in DECISION_INDEX
- Check for inconsistencies monthly

---

## CI/CD for Docs (Automated Checks)

When you `git commit` to docs/:

### Proposed Pre-Commit Hook

```bash
# Check 1: All docs have metadata
✓ Metadata present (type, status, owner, version, date, traceability)

# Check 2: No file duplication
✓ No two docs have same content

# Check 3: Traceability links valid
✓ Referenced docs exist (e.g., "See H-001" → PHASE-0-HYPOTHESES.md exists)

# Check 4: GLOSSARY references
✓ All used terms are in GLOSSARY.md

# Check 5: Version numbers
✓ File versions match metadata versions
✓ No gaps in numbering (UXDR-001, UXDR-002, ... no UXDR-010)
```

**Implementation**: Add `.github/workflows/doc-lint.yml`

---

## Review Checklist (Before Committing Doc Changes)

```markdown
### Metadata

- [ ] type: [filled]
- [ ] status: [filled]
- [ ] owner: [filled]
- [ ] version: [incremented from previous]
- [ ] date: [today or last review]
- [ ] traceability: [filled if applicable]

### Linking

- [ ] Document appears in README.md?
- [ ] Document appears in DECISION_INDEX.md?
- [ ] All referenced docs exist?
- [ ] All reference links point to correct section?

### Glossary

- [ ] All new terms added to GLOSSARY.md?
- [ ] Terms used consistently throughout?
- [ ] GLOSSARY.md shows "Used in: [this doc]"?

### Content

- [ ] Single source of truth maintained (no duplication)?
- [ ] Traceability chain complete (H→UXDR→Test)?
- [ ] Metrics are measurable (not vague)?
- [ ] Owner is clear (who can approve changes)?

### Maintenance

- [ ] If updating old doc: new version number only, don't edit text?
- [ ] If disagreeing: created new doc, linked old one?
- [ ] If superseding: marked old as "Superseded", linked new?
```

---

## Example: Adding a New UXDR (Full Workflow)

### Step 1: Write UXDR-014

```markdown
---
type: UXDR
status: Proposed
owner: Product Manager (ptasana@gmail.com)
version: 1.0
date: 2026-08-20
traceability: H-005
related: UXDR-001, TEST_PLAN.md (TS-005)
---

# UXDR-014: [Decision]

...
```

### Step 2: Add to README.md

```markdown
13. **UXDR.md** (ux/UXDR.md)
    - [UXDR-001 through UXDR-013 listed]
    - UXDR-014: [New title] (Proposed)
```

### Step 3: Add to DECISION_INDEX.md

```markdown
| H-005 | UXDR-014 | FS-005 | TS-005 | (pending) |
```

### Step 4: Add terms to GLOSSARY.md

(If introduced new terms)

### Step 5: Commit with message

```
docs: add UXDR-014 [title]

- Addresses H-005
- Tied to TS-005 test scenario
- Status: Proposed (awaiting PM review)
```

### Step 6: Review

PM reviews checklist, marks status "Accepted" (v1.1), commits update.

---

## When to Archive Documents

Move to `docs/archive/` when:

- Status is "Rejected" AND >3 months old (not relevant anymore)
- Status is "Superseded" AND >6 months old (historical interest only)
- Orphaned document (created but never linked or used)

Archive file naming: `archive/[ORIGINAL-FILENAME]-archived-2026-09-01.md`

Keep a manifest: `docs/archive/MANIFEST.md` listing what's archived + why.

---

## Questions & Escalation

**Q: Can I edit a doc to fix typos?**  
A: Yes. Typo fixes don't require new version (v1.0 stays v1.0), just commit the fix.

**Q: What if I disagree with a decision?**  
A: Comment in the doc (markdown comment), @mention owner. If no resolution in 48h, escalate to Project Sponsor.

**Q: Can we delete old decisions?**  
A: No. Archive them instead (move to `docs/archive/`).

**Q: How often should I update docs?**  
A: When status changes (e.g., testing → confirmed). Add version history entry.

**Q: What if docs become outdated after launch?**  
A: They're living documents. Continue to update them. Never let them drift from reality.
