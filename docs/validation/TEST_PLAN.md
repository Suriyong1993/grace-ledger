# Phase 1 Test Plan — User Validation

**Purpose**: Define concrete scenarios, tasks, and metrics for testing hypotheses with real users.  
**Participants**: Finance Staff (2), Leaders (1)  
**Duration**: ~90 minutes per session  
**Timing**: As soon as HTML prototype is ready  

---

## Test Setup

### Before Session

1. **Recruit 3 people** (NOT from Grace Ledger team):
   - Finance Staff: 2 people (varying experience with apps)
   - Leader: 1 person (church decision-maker)

2. **Prepare environment**:
   - Quiet room, 1 laptop per person
   - Stopwatch or app timer
   - Video recording (optional, but recommended)
   - Receipt samples (printed or digital)

3. **Briefing (2 min)**:
   > "We're testing a new way to record donations and expenses. You'll see a prototype (not final). Please think out loud — tell us what you're doing and why."

---

## Test Scenario A: Finance Staff Records Offering

### Background Story

> "Today, the church received ฿15,000 in cash from Sunday worship. It's in the cash box. Record this transaction."

### Task Sequence

1. **Task A-1**: Open the app, navigate to income recording
2. **Task A-2**: Create a new income record for "Sunday Offering"
3. **Task A-3**: Enter amount ฿15,000
4. **Task A-4**: Indicate it's in the cash box
5. **Task A-5**: Attach a photo of the envelope/receipt
6. **Task A-6**: Submit for approval

### Measurements

| Metric | Target | How to Measure |
|---|---|---|
| **Time to Complete** | < 3 min | Stopwatch from start to "Submit" |
| **Help Requests** | < 1 | Count "I don't know what this means" |
| **Misclicks** | 0–1 | Clicking wrong button, entering wrong field |
| **Questions Asked** | < 2 | "What does X mean?" (unscripted) |
| **Task Success** | Yes/No | Did they submit without errors? |
| **Confidence** (1–5) | ≥ 4 | "How confident are you this is correct?" |

### Observation Notes

During the task, observe and write down:

- Where do they look first? (Menu item, button, help text?)
- Do they understand "รับเงิน" (Record Income)?
- Do they hesitate on any step?
- Do they ask about Debit/Credit or Chart of Accounts? (Should be zero)
- How do they find the attachment button?
- Do they understand what ฿15,000 means?

### Success Criteria

- ✅ Completes in < 3 minutes
- ✅ Zero questions about accounting terms
- ✅ Submits with zero errors
- ✅ Confidence ≥ 4

---

## Test Scenario B: Expense Entry

### Background Story

> "The church paid ฿2,500 for electricity this month. Record this expense."

### Task Sequence

1. **Task B-1**: Navigate to expense recording
2. **Task B-2**: Select "Utilities" as category (or similar)
3. **Task B-3**: Enter amount ฿2,500
4. **Task B-4**: Indicate it's paid from cash
5. **Task B-5**: Attach invoice/receipt
6. **Task B-6**: Submit for approval

### Measurements (Same as Scenario A)

| Metric | Target |
|---|---|
| Time to Complete | < 3 min |
| Help Requests | < 1 |
| Misclicks | 0–1 |
| Questions | < 2 |
| Task Success | Yes/No |
| Confidence | ≥ 4 |

### Observation Notes

- Is "บันทึกรายจ่าย" (Record Expense) clear?
- Do they find the category dropdown easily?
- Do they understand the source (paid from cash)?

---

## Test Scenario C: Leader Reviews & Approves

### Background Story

> "You're a church leader. The finance staff submitted a ฿15,000 offering. Review it and approve or reject."

### Task Sequence

1. **Task C-1**: Open app as leader
2. **Task C-2**: Find pending approvals
3. **Task C-3**: Click to view transaction detail
4. **Task C-4**: Review amount, category, receipt
5. **Task C-5**: Click [Approve]

### Measurements

| Metric | Target | How to Measure |
|---|---|---|
| **Time to Approve** | < 2 min | Stopwatch from start to click |
| **Comprehension** | 100% | Can they tell you: amount, category, receipt? |
| **Approval Confidence** | ≥ 4 | Do they feel they reviewed it adequately? |
| **Role Clarity** | Yes | Do they understand they're NOT recording? |

### Observation Notes

- Can they instantly find pending approvals?
- Do they understand the approval status (e.g., "1/2 approvals done")?
- Do they see the receipt clearly?
- Do they feel comfortable approving based on the info shown?

---

## Test Scenario D: Understanding Approval States

### Background Story

> "Tell me the status of these 3 transactions without asking questions."

Show leader 3 transactions in different states:
1. Draft (not submitted)
2. Pending approval (1/2 done)
3. Fully approved

### Task

- Tell you the status of each
- Tell you who approved each
- Tell you who's waiting (if applicable)

### Measurements

| Metric | Target |
|---|---|
| Status comprehension time | < 5 sec per transaction |
| Accuracy (who approved?) | 100% |
| Accuracy (who's waiting?) | 100% |
| Confidence | ≥ 4 |

### Success Criteria

- ✅ Instantly understands all 3 states
- ✅ No confusion between pending/approved
- ✅ Knows exactly who to follow up with

---

## Test Scenario E: Staff's Mental Model (Qualitative)

### Unscripted Interview (5–10 min)

1. **Q1**: "How do you currently record donations? Walk me through it."
   - Listen for: cash box, amount, receipt, who approves
   - Note: Do they use accounting language or simple language?

2. **Q2**: "What should happen between when you record something and when it's actually processed?"
   - Listen for: approval, payment, reconciliation

3. **Q3**: "When would you ever need to edit or delete a transaction?"
   - Listen for: mistakes, fraud concerns

4. **Q4**: "What would confuse you about this app?"
   - Listen for: terminology, navigation, concepts

### Notes to Record

- Staff's native vocabulary (not our jargon)
- Mental model (do they think events, or accounting?)
- Concerns (fraud, mistakes, compliance)

---

## Test Scenario F: Finding Advanced Features (Negative Test)

### Background Story

> "Try to find the Chart of Accounts menu."

### Task

Staff member looks for Chart of Accounts (which should be hidden).

### Measurements

| Metric | Target |
|---|---|
| Time to realize it doesn't exist | < 1 min |
| Reaction (confused? relieved?) | Note behavior |
| Do they ask for it? | Should be: No |

### Success Criteria

- ✅ Staff can't find Chart of Accounts (good, it should be hidden)
- ✅ They don't ask "Where is it?" (means they didn't expect it)
- ✅ They don't miss it (means it's not needed)

---

## Test Scenario G: Error Recovery

### Background Story

> "Try to submit a transaction with NO amount, or amount = 0."

### Task Sequence

1. Go through transaction entry
2. Leave amount blank (or enter 0)
3. Try to submit

### Measurements

| Metric | Target |
|---|---|
| Error message clarity | Can they understand what's wrong? |
| Recovery time | < 30 sec to fix |
| Frustration | Low (they understand the problem) |

### Success Criteria

- ✅ Error message is clear (not technical jargon)
- ✅ Staff immediately know how to fix it
- ✅ No "Why did this happen?" questions

---

## Test Scenario H: Mobile Usability (If Testing Mobile)

### Background Story

> "Record the offering using your phone, not the laptop."

### Task

Same as Scenario A, but on mobile.

### Measurements

| Metric | Target |
|---|---|
| Time | < 3 min (same target as desktop) |
| Usability issues | Note any mobile-specific problems |
| Willingness to use on phone | "Would you record transactions on your phone?" |

### Note

Desktop-first, but if staff insist on mobile, test it.

---

## Metrics Summary Table

| Scenario | Primary Metric | Target | Validation Rule |
|---|---|---|---|
| A (Offering) | Time to complete | < 3 min | ✅ Pass if avg < 3 min |
| B (Expense) | Time to complete | < 3 min | ✅ Pass if avg < 3 min |
| C (Approval) | Time to approve | < 2 min | ✅ Pass if avg < 2 min |
| D (Status clarity) | Comprehension time | < 5 sec | ✅ Pass if 100% accuracy |
| E (Mental model) | Qualitative match | Matches hypothesis | ✅ Pass if no contradictions |
| F (Hidden features) | Feature discoverability | Can't find Chart of Accounts | ✅ Pass if hidden correctly |
| G (Error recovery) | Message clarity | User understands error | ✅ Pass if 100% clarity |
| H (Mobile) | Time (if applicable) | < 3 min | ⚠️ Optional test |

---

## Success Criteria (Overall)

After testing 3 participants, review:

| Test Type | Pass Condition | Fail Condition |
|---|---|---|
| **Transaction Time** | Avg < 3 min, 90th %-ile < 3:30 | Any participant > 4 min |
| **Error Rate** | < 5% errors per transaction | > 10% errors |
| **Accounting Confusion** | 0 questions about Dr/Cr | Any question about accounting terms |
| **Approval Clarity** | 100% understand status | Any misunderstanding of approval state |
| **Role Separation** | Staff never enter leader UI | Any accidental role crossing |
| **Feature Completeness** | All tasks completed successfully | Any task blocked or impossible |

---

## Go / No-Go Decision

### Go (Proceed to Backend Development)
- ✅ Transaction time < 3 min
- ✅ 0 accounting jargon questions
- ✅ ≥ 90% task success rate
- ✅ Leaders understand approval workflow
- ✅ No major usability blockers

### No-Go (Iterate UX)
- ❌ Transaction time > 4 min
- ❌ Multiple accounting questions (indicates hypothesis wrong)
- ❌ < 70% task success rate
- ❌ Confusion about approval states
- ❌ Staff/leaders mixing up roles

---

## Iteration Process (If No-Go)

If test fails:

1. **Identify issue**: Which scenario(s) failed?
2. **Root cause**: Was it UX unclear, or was hypothesis wrong?
3. **Iterate**:
   - If UX issue: Fix wireframe, test again
   - If hypothesis issue: Update PHASE-0-HYPOTHESES.md, redesign
4. **Repeat**: Test with 1–2 more participants

---

## Data Recording

### During Test

1. **Video** (optional, recommended):
   - Screen recording of app interaction
   - Participant's face/reactions (if consent given)

2. **Handwritten Notes**:
   - Participant name, role (staff/leader), date
   - Where they paused, what confused them
   - Direct quotes ("Why is it called...?")

3. **Measurements**:
   - Time per task (stopwatch)
   - Number of clicks/errors
   - Help requests

### After Test

1. **Summary Sheet** (per participant):
   ```
   Participant: Finance Staff #1
   Date: 2026-08-15
   
   Task A-1 (Navigate to income): 12 sec
   Task A-2 (Select offering): 8 sec, 1 question ("What's ถวาย?")
   Task A-3 (Enter amount): 15 sec, 0 questions
   ...
   
   Overall: Success, 2:45 total, 2 help requests, Confidence 4.5/5
   ```

2. **Consolidated Report** (after all 3 participants):
   - Average times per task
   - Common patterns (where everyone struggled)
   - Outliers (one person had trouble, others didn't)
   - Themes from qualitative interviews

---

## Template: Test Session Checklist

```
[ ] Room is quiet and distraction-free
[ ] Laptop/device is ready
[ ] App prototype is loaded
[ ] Timer is ready
[ ] Consent for video (if recording)
[ ] Participant briefed on "think out loud"
[ ] Scenario story cards printed
[ ] Receipt samples ready
[ ] Observation sheet printed

During Test:
[ ] Note start time
[ ] Record help requests
[ ] Note pauses/confusion
[ ] Measure end time
[ ] Ask post-task confidence (1–5)
[ ] Ask qualitative questions
[ ] Thank participant

After Test:
[ ] Fill out summary sheet
[ ] Review video (if applicable)
[ ] Note any technical issues
[ ] Upload/archive data
```

---

## Next Steps

1. **Build HTML prototype** (based on UXDR + MENTAL_MODELS)
2. **Recruit 3 participants** (Finance Staff × 2, Leader × 1)
3. **Run test sessions** (1–2 hours per person)
4. **Analyze results**:
   - Do metrics pass go/no-go criteria?
   - What patterns emerged?
   - What hypotheses were wrong?
5. **Document findings** in `TEST_RESULTS.md`
6. **Iterate** if needed, or proceed to backend development if go/no-go passed
