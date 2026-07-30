# MASTER PROMPT — Grace Ledger Product Constitution

> **สำหรับ AI ทุกตัวที่ทำงานกับ repository นี้:**
> อ่านเอกสารนี้ทั้งหมดก่อนเริ่มงานทุกครั้ง
> เอกสารนี้คือ **กฎสูงสุด** — หากมีความขัดแย้งระหว่างเอกสารอื่น ให้ยึดเอกสารนี้เป็นหลัก

---

## ตัวตนของ Grace Ledger

Grace Ledger **ไม่ใช่โปรแกรมบัญชี**

Grace Ledger คือ:

> **The Intelligent Financial Management Platform for Churches**
> แพลตฟอร์มบริหารการเงินคริสตจักร ที่เน้นความโปร่งใส ความน่าเชื่อถือ และ Workflow ที่ชัดเจน

---

## ชุดเอกสาร Product Constitution

เอกสารชุดนี้ใน `promptmaster/` คือ "รัฐธรรมนูญ" ของ Grace Ledger:

| ไฟล์ | บทบาท |
|------|--------|
| `MASTER_PROMPT.md` (นี่) | Index + กฎสูงสุด + วิธีใช้งาน |
| `PRODUCT_BIBLE.md` | Vision, Positioning, Users, Features, Roadmap |
| `DESIGN_BIBLE.md` | Design DNA, UI Language, Components, Tokens |
| `ENGINEERING_BIBLE.md` | Architecture, Code Rules, Git, Testing, Verification |
| `AI_BIBLE.md` | Grace AI Agents, Hermes, RAG, LINE, Personality |

---

## Non-Negotiable Rules (กฎที่ทำลายไม่ได้ — 10 ข้อ)

กฎทั้ง 10 ข้อนี้มีสถานะสูงกว่าทุกสิ่ง ไม่มีข้อยกเว้น:

### Business Logic Rules

1. **ห้ามทำลาย Business Logic** — ทุก Business Rule ใน BUSINESS_RULES.md คือ Law ไม่ใช่ Suggestion
2. **ทุกธุรกรรมต้องตรวจสอบย้อนหลังได้** — Audit Trail + SHA-256 Hash Chain ต้องครบทุกรายการ
3. **ห้ามลบข้อมูลจริง** — ใช้ Soft Delete (deletedAt) เสมอ ห้าม Hard Delete
4. **ห้ามใช้ Floating Point กับเงิน** — ใช้ Money class จาก src/server/domain/money.ts เท่านั้น
5. **Tenant Isolation บังคับ** — ทุก Query ต้องมี church_id filter และ RLS Policy

### AI Rules

6. **AI ไม่มีสิทธิ์อนุมัติธุรกรรม** — Human Approval เสมอ ไม่มีข้อยกเว้น
7. **ทุกคำแนะนำของ AI ต้องอธิบายเหตุผล** — Explainable AI เท่านั้น ห้ามตอบแค่ผลลัพธ์
8. **ระบบหลักต้องทำงานได้แม้ AI ใช้งานไม่ได้** — AI เป็น Enhancement ไม่ใช่ Dependency
9. **AI ไม่สามารถ override Business Rule ใดได้** — แม้ผู้ใช้จะขอก็ตาม
10. **ห้าม AI Slop** — ทุก Feature ต้องมีเหตุผล ห้ามสร้างเพราะ "AI ควรมี"

---

## Core Architecture Map (Quick Reference)

| Layer | ไฟล์สำคัญ | หน้าที่ |
|-------|-----------|---------|
| Database Schema | `src/db/schema.ts` | Drizzle ORM — 22 tables |
| Money Precision | `src/server/domain/money.ts` | THB rounding, no float |
| Double-Entry Engine | `src/server/domain/journal.ts` | Journal entries, debit/credit |
| Permissions | `src/server/auth/permissions.ts` | RBAC, dual-approval >50K THB |
| Audit Trail | `src/server/services/audit.service.ts` | SHA-256 hash chain |
| AI Proxy | `src/server/api/routes/ai-proxy.routes.ts` | Server-side AI, no key leaks |
| Test Engine | `src/server/infrastructure/db.ts` | PGlite WebAssembly |

---

## Template สำหรับสั่งงาน AI (Copy-Paste ทุกครั้ง)

```
[CONTEXT]
Project: Grace Ledger — The Intelligent Financial Management Platform for Churches
Read: promptmaster/MASTER_PROMPT.md, promptmaster/PRODUCT_BIBLE.md, promptmaster/ENGINEERING_BIBLE.md

[TASK]
<ระบุงานที่ต้องการ — 1 งาน ชัดเจน>

[FILE TO EDIT]
<ระบุไฟล์ที่ต้องแก้ไข>

[EXPECTED RESULT]
<ระบุผลลัพธ์ที่ต้องการเห็น>

[CONSTRAINTS]
- ห้ามละเมิด Non-Negotiable Rules 10 ข้อ
- ใช้ Money class สำหรับทุกการคำนวณเงิน
- church_id tenant isolation ทุก query
- Follow UI tokens ใน src/styles.css
- ห้ามเขียน TODO หรือ Placeholder
- ห้ามใช้ Floating Point กับเงิน

[VERIFICATION]
npm run lint       # 0 errors
npm run typecheck  # 0 errors
npm test           # 51/51 pass
npm run build      # Success
```

---

## Product Philosophy

```
Trust    ก่อน Beauty
Clarity  ก่อน Complexity
Human    ก่อน AI
Audit    ก่อน Automation
Church   ก่อน Enterprise
```

---

## Grace Platform Vision

Grace Ledger เป็นจุดเริ่มต้นของ Grace Platform:

```
Grace Platform
├── Grace Ledger      (NOW) — Financial Management
├── Grace Members     (NEXT) — Member & Giving Management
├── Grace Ministry    (FUTURE) — Ministry & Department
├── Grace Reports     (FUTURE) — Advanced Reporting & Analytics
├── Grace AI          (FUTURE) — AI Hub & Orchestration
├── Grace Analytics   (FUTURE) — Data & Insights
└── Grace Admin       (FUTURE) — Platform Administration
```

ทุก Module ใช้ Design Language, AI Framework, และ Architecture เดียวกัน

---

_Version: 2.0 | Updated: July 2026 | Owner: Grace Platform Team_
