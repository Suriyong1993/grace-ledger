# Tech Lead Note — Phase A Closure

**Date**: 2026-08-04  
**Phase**: A (Infrastructure Complete)  
**Status**: Ready to transition to Prototype Development  

---

## Why Phase A Stops Here

Phase A was **not** created to build a documentation system.

Phase A exists so the team can:

- Make decisions consistently
- Capture evidence consistently  
- Move to user validation as quickly as possible

**If documentation becomes the primary work item, Phase A has failed.**

---

## Definition of Success

The first successful outcome of Grace Ledger is **not**:

- Complete documentation
- Complete architecture
- Complete database
- Complete accounting engine

**The first successful outcome is:**

> A finance staff member records a real church transaction correctly without accounting knowledge.

Everything else supports that goal.

---

## Priority Order

When priorities conflict, always choose the higher item:

```
1. Users (real behavior, real needs)
2. Workflow (process that works)
3. Product (features that matter)
4. Code (quality + maintainability)
5. Documentation (supporting infrastructure)
```

**Never reverse this order.**

Examples:

| Conflict | Resolution |
|---|---|
| User pain vs. clean code | Fix user pain first |
| User pain vs. documentation | Fix user pain first |
| Workflow vs. database design | Prioritize workflow |
| Product feature vs. architecture | Build for product need |

---

## Decision Hierarchy

When making decisions about what to build, start here:

```
User Evidence
        ↓
Product Decision
        ↓
UX Decision
        ↓
Technical Decision
        ↓
Implementation Detail
```

**Never start from technology.**

Wrong approach:
```
"We need a Knowledge Graph"
→ "Let's build it"
→ "How should it work?"
→ "What would users do with it?"
```

Right approach:
```
"Users can't find document X"
→ "Search would help"
→ "What UX for search?"
→ "How to implement?"
```

---

## Completion Rule

**A document is complete when it enables the next action, not when it cannot be improved.**

Examples:

| Document | "Complete" When | Not When |
|---|---|---|
| Hypothesis | Testable + actionable | Perfectly written |
| UXDR | Directs design + test | Every detail specified |
| Test Plan | Scenarios are clear | Coverage is exhaustive |
| LEARNING_LOG | Observation recorded | All analysis done |

Perfectionism is the enemy of learning.

---

## Team Culture Questions

Ask these questions **more often** than "Can we build this?"

Instead ask:

- Should we build this?
- What evidence supports it?
- What user problem does it solve?
- What happens if we do nothing?
- Is this reducing user effort or adding system complexity?

---

## Infrastructure Changes: Hard Rule

**No infrastructure feature may be added until:**

1. User testing has revealed specific pain, **OR**
2. Team is actively blocked by current limitations

Examples:

✅ "IDs keep duplicating in PRs" → Add CI check  
✅ "Can't trace which test validated this" → Link TEST_PLAN entries  
❌ "Graphs might be useful someday" → Don't build  
❌ "JSON export for AI" → Don't build (no pain)  

**Deferred items are in BACKLOG.md.** They stay there until pain moves them.

---

## Validation Before Scale

Never add sophistication until validation proves it's needed.

```
Wrong approach:
Prototype → Build Backend → User Test

Right approach:
Prototype → User Test → Backend (only what passed validation)
```

If 80% of backend features will be wrong post-validation, 
build the 20% that definitely works first.

---

## The North Star Metric

**Make this visible on Sprint board and README:**

> Every sprint must reduce user effort before it increases system sophistication.

When proposing features, ask:

- Does this reduce how long it takes users to accomplish their goal?
- Does this reduce confusion for users?
- Does this enable users who couldn't use the system before?

If not: It increases sophistication without reducing effort. Defer it.

---

## Success Timeline

| Milestone | Definition |
|---|---|
| **Sprint 2** | FS-001 (Finance Home) working; staff can start to record transaction |
| **Sprint 3** | Staff completes ฿15,000 offering in <3 min without accounting terms |
| **Sprint 4** | Leaders approve transactions in workflow; 2-approval validation works |
| **Sprint 5+** | Backend implementation (only what validation proved necessary) |

Success = Users doing real work, not infrastructure completion.

---

## Decision Journal

Every major decision should be recorded as UXDR or Hypothesis with:

1. Evidence (why this, not that?)
2. Validation state (tested? assumed?)
3. Related learning log entries (what taught us this?)

This keeps decisions traceable and prevents "why did we do this?" confusion 6 months later.

---

## When to Escalate

Escalate to Product Lead if:

- User testing contradicts a core hypothesis
- Required change affects multiple UXDR entries  
- Infrastructure needed urgently (genuine blocker, not convenience)
- Timeline pressure from stakeholders

Don't escalate for:
- Minor UX tweaks (iterate with users)
- Documentation questions (follow GOVERNANCE.md)
- "Nice to have" features (add to BACKLOG.md)

---

## Protecting This Discipline

This note exists because scope creep kills products.

**Symptoms that discipline is slipping:**

- 🚩 More time spent on documentation than prototypes
- 🚩 Features added without user evidence
- 🚩 Infrastructure built for "future needs"
- 🚩 Priorities reversed (documentation > users)
- 🚩 Decision hierarchy ignored (technology-first)
- 🚩 Infrastructure frozen but team keeps wanting more

**If you see these, pause and re-read this note.**

---

## One Final Principle

Grace Ledger succeeds or fails based on:

> Can someone who has never studied accounting successfully record church income without thinking about accounting?

Not: "Is the documentation comprehensive?"
Not: "Is the architecture elegant?"
Not: "Is the database optimized?"

**That one question is the entire product.**

Everything else is scaffolding.

---

**This note is intentionally brief. Brevity is the point—it must be readable when you're tempted to skip it.**

If you find yourself debating whether to add a feature or expand scope, re-read this page. It answers most questions.

---

**Phase A is complete. Build the prototype. Learn from users. That's all that matters now.**
