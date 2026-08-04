# Mental Models — User Thinking ↔ System Behavior

**Purpose**: Bridge between how users think about transactions and how the system implements them.  
**Audience**: Product, Engineering, QA  
**Why It Matters**: If these don't align, users will be confused. If they do, the UI will feel "natural."  

---

## Core Translation Layer

```
User Says           User Thinks               System Does
────────────────────────────────────────────────────────────────
"รับเงิน"          Cash came in              Debit Cash
(Record Income)                              Credit Offering Income

"จ่ายค่าไฟ"        Money went out            Debit Utilities Expense
(Record Expense)                             Credit Cash

"ฝากธนาคาร"        Move cash to bank         Debit Bank
(Deposit to Bank)                            Credit Cash

"โอนเงิน"          Move between funds        Debit Fund B
(Transfer)                                   Credit Fund A
```

---

## Mental Model: Finance Staff

### How They Think

**Staff's World = Cash Flow**

- "ได้รับเงิน" (Received money)
- "จ่ายไป" (Spent money)
- "ยังค้างอยู่" (Pending approval)
- "ดำเนินการแล้ว" (Completed)

### What They DON'T Think About

- ❌ Debit vs. Credit
- ❌ Chart of Accounts
- ❌ Ledger Posting
- ❌ Reversing Entries
- ❌ Period Closing

### Why This Matters

If UI says "Create Journal Entry", staff will be confused. If UI says "Record Sunday Offering", staff will understand immediately.

### Mapping to Events

| Staff's Language (Thai) | Staff's Mental Model | System's Event Type | System's Journal Entry |
|---|---|---|---|
| รับถวาย ฿15,000 | Cash came in from offering | `income.received` | Dr. Cash +15000 / Cr. Offering +15000 |
| จ่ายค่าไฟ ฿3,000 | We paid electric bill | `expense.recorded` | Dr. Utilities +3000 / Cr. Cash -3000 |
| ฝากธนาคาร ฿50,000 | Moving cash from safe to bank | `transfer.initiated` | Dr. Bank +50000 / Cr. Cash -50000 |
| รับค่ายศาสตราจารย์ ฿5,000 | Special donation | `income.special` | Dr. Cash +5000 / Cr. Special Donation +5000 |

---

## Mental Model: Leaders (Approvers)

### How They Think

**Leader's World = Control & Accountability**

- "สัญญาว่า ฿X ถูกต้อง?" (Is ฿X correct?)
- "ใครบันทึก?" (Who recorded?)
- "มีหลักฐาน?" (Is there receipt?)
- "ได้อนุมัติแล้ว?" (Already approved?)
- "ลงนาม" (Sign off)

### What They DON'T Think About

- ❌ Double-entry bookkeeping
- ❌ Chart of Accounts
- ❌ Audit Trail (just want confirmation)
- ❌ Financial Statements

### Why This Matters

Leaders need to see:
- Transaction detail (amount, category, receipt)
- Who recorded it
- Who else approved
- Clear [Approve] [Reject] buttons

NOT:
- Journal entries
- Ledger accounts
- Accounting terminology

### Mapping to Approval States

| Leader's Mental State | UI Should Show | System's State |
|---|---|---|
| "ยังไม่เห็น" | Nothing (not in approval queue) | `draft` |
| "รอดูแล้ว" | Transaction detail + [Approve/Reject] | `pending_approval` |
| "ได้อนุมัติแล้ว" | ✓ Checkmark + timestamp | `approved_1` |
| "รอคนที่สอง" | "Waiting for Leader 2" | `approved_1_pending_2` |
| "ทั้งคู่อนุมัติแล้ว" | ✓ Both names + timestamps | `fully_approved` |
| "ปฏิเสธ" | ✗ Rejected + reason | `rejected` |

---

## Mental Model: Admin (System Manager)

### How They Think

**Admin's World = System Integrity & Compliance**

- "ระบบถูกต้องไหม?" (Is system working correctly?)
- "มีการโกง?" (Any fraud?)
- "ตัวเลขตรงกันไหม?" (Do numbers reconcile?)
- "บันทึกมีอยู่ไหม?" (Is there an audit trail?)

### What They CAN See (Hidden from Staff/Leaders)

- ✓ Chart of Accounts
- ✓ All Journal Entries (Dr/Cr visible)
- ✓ Audit Trail (hash chain)
- ✓ Approval History (who approved when)
- ✓ Discrepancy Reports
- ✓ System Configuration

### Why This Matters

Admin uses journal entries for compliance, auditing, and debugging. Staff/Leaders never see this layer.

---

## Critical Translation: Approval Workflow

### Staff's Mental Model

```
1. Record transaction
   ↓
2. Submit for approval
   ↓
3. Wait (notification from leaders)
   ↓
4. Once both approve → Execute (deposit/pay)
```

### System's Reality

```
1. User creates Event (รับเงิน)
   ↓
2. System generates balanced Journal Entry
   ↓
3. Entry waits in "pending_approval" state
   ↓
4. Leader 1 checks detail, clicks [Approve]
   ↓
5. Entry moves to "approved_1_pending_2"
   ↓
6. Leader 2 checks, clicks [Approve]
   ↓
7. Entry moves to "approved_2" (fully_approved)
   ↓
8. Staff can now see "Approved" and proceed with execution
```

### How UI Must Translate This

**Staff View (Recording)**
```
[รับเงิน]
  └─ ประเภท: ถวาย
  └─ จำนวน: 15,000
  └─ รับเข้าที่: เงินสด
  └─ [บันทึก]

Status: "รอการอนุมัติ"
```

**Leader View (Approving)**
```
Transaction: Sunday Offering ฿15,000

Recorded by: Finance Staff (วันนี้ 10:00)
Category: Offering
Destination: Cash Box
Receipt: [attachment]

Approval Status:
  ✓ Leader 1: Approved (10:15)
  ⏳ Leader 2: Waiting...

[Approve] [Reject] [Comment]
```

**What System Never Shows Users**
```
❌ Journal Entry:
   Dr. Cash                    15,000
   Cr. Offering Income              15,000
   (This is internal)

❌ Ledger Posting
❌ Account Balance Changes
❌ Trial Balance
```

---

## Event Types & Their Mental Model Translations

### Income Events

| Event | Staff Mental Model | System Journal | Status Flow |
|---|---|---|---|
| `offering.sunday` | "รับถวายวันอาทิตย์" | Dr. Cash / Cr. Offering Income | pending → approved → executed |
| `offering.special` | "รับถวายพิเศษ" | Dr. Cash / Cr. Special Offering | pending → approved → executed |
| `tithe.received` | "รับสิบลด" | Dr. Cash / Cr. Tithe Income | pending → approved → executed |
| `donation.grant` | "รับทุนสนับสนุน" | Dr. Cash / Cr. Grants | pending → approved → executed |

### Expense Events

| Event | Staff Mental Model | System Journal | Status Flow |
|---|---|---|---|
| `expense.utilities` | "จ่ายค่าไฟ" | Dr. Utilities / Cr. Cash | pending → approved → executed |
| `expense.salary` | "จ่ายเงินเดือน" | Dr. Salaries / Cr. Cash | pending → approved → executed |
| `expense.maintenance` | "จ่ายค่าซ่อมแซม" | Dr. Maintenance / Cr. Cash | pending → approved → executed |
| `expense.other` | "จ่ายอื่นๆ" | Dr. Other / Cr. Cash | pending → approved → executed |

### Transfer Events

| Event | Staff Mental Model | System Journal | Status Flow |
|---|---|---|---|
| `transfer.to_bank` | "ฝากธนาคาร" | Dr. Bank / Cr. Cash | pending → approved → executed |
| `transfer.between_funds` | "โอนเงิน" | Dr. Fund B / Cr. Fund A | pending → approved → executed |

---

## Approval Authority Mental Model

### Staff Thinking

```
"ผมบันทึก → เจ้านายอนุมัติ → จ่ายได้"
I record → Boss approves → I pay
```

### System Reality

```
APPROVAL_THRESHOLDS = {
  ≤ ฿5,000:     1 admin approval needed
  ฿5–50k:       1 admin approval needed
  > ฿50,000:    2 super_admin approvals needed
  Self-approval: BLOCKED (fraud prevention)
}
```

### Leader Thinking

```
"฿50,000 ต้องลงนาม 2 คน" (>฿50k needs 2 signatures)
This reflects church governance reality.
```

### Translation to UI

```
For Transaction ฿100,000:

Staff sees: "รอการอนุมัติ 2 คน"
            (Waiting for 2 approvals)

Leader sees: "ต้องได้อนุมัติจาก..."
            (Requires approval from...)

System enforces: approval_1_id ≠ approval_2_id
                (Different people must sign)
```

---

## What This Document Enables

1. **Product Team**: Ensures UI language matches user thinking
2. **Engineering**: Understands which internal complexity to hide
3. **QA**: Tests that system behaves as staff expect
4. **Audit**: Verifies integrity (double-entry) is maintained invisibly
5. **New Hires**: Learns why UX is designed this way

---

## Validation Checklist

Before building prototype, confirm:

- [ ] Staff mental model matches Event-based UI?
- [ ] Leader mental model matches Approval UI?
- [ ] Admin features are fully hidden from staff/leaders?
- [ ] Approval states (pending → approved → executed) match user expectations?
- [ ] Thai labels match staff's actual vocabulary?
- [ ] No accounting jargon visible to staff/leaders?
- [ ] System integrity (Dr = Cr) is maintained invisibly?
