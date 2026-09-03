# Grace Ledger — Church Financial OS

ระบบปฏิบัติการการเงินสำหรับคริสตจักร (Church Financial OS) พัฒนาด้วย **Vanilla TypeScript + Vite** และ **PostgreSQL 17 (Supabase)** โดยให้ความสำคัญสูงสุดกับความถูกต้องและปลอดภัยทางการเงิน ("Money is the product; a wrong number is worse than an ugly screen")

---

## 🚀 Quick Start

```bash
# ติดตั้ง dependencies
npm install

# รันโหมด Development (Port 5500)
npm run dev

# รัน Typecheck
npm run typecheck

# รัน Automated Tests
npm test

# Build สำหรับ Production
npm run build
```

---

## 🧠 JoejaBrain — Multi-Agent Operating System

โปรเจกต์นี้รองรับการทำงานร่วมกันระหว่างนักพัฒนาและ AI หลายระบบ (Claude Code, Gemini, Codex ฯลฯ) ผ่านระบบความรู้กลาง **JoejaBrain**:

```text
.brain/
├── WORKING_CONTEXT.md   # [Active Task] กระดานสถานะงานปัจจุบัน (อ่านก่อนเริ่มงานเสมอ)
├── HANDOFF.md           # [Agent Handoff] บันทึกการส่งมอบงานระหว่างรอบ/ระหว่าง Agent
├── MEMORY.md            # [Long-Term Memory] หลุมพรางและบทเรียนสำคัญ (Gotchas & Invariants)
└── workflows/           # [Standard Workflows] ขั้นตอนการทำงานที่เป็นเอกภาพ (01_brief ถึง 05_handoff)
```

> **คำแนะนำสำหรับ AI Agents ทุกตัว:**
> กรุณาอ่าน [`AGENTS.md`](./AGENTS.md) และ [`.brain/WORKING_CONTEXT.md`](./.brain/WORKING_CONTEXT.md) เป็นสิ่งแรกก่อนแตะต้องโค้ด

---

## 📚 เอกสารสำคัญในโครงการ (Documentation Map)

| เอกสาร | วัตถุประสงค์ |
| :--- | :--- |
| [`CLAUDE.md`](./CLAUDE.md) | **Working Agreement หลัก**: 5 Quality Gates, Financial Safety Rules, Design Tokens ("Emerald Vault"), Thai Copy Style |
| [`AGENTS.md`](./AGENTS.md) | **คู่มือสำหรับ AI Agents**: สรุปข้อจำกัดสำคัญ กฎเหล็ก และคำสั่งที่ใช้ตรวจสอบ |
| [`CONTEXT.md`](./CONTEXT.md) | **พจนานุกรมการเงิน (Domain Vocabulary)**: คำศัพท์ทางการเงินและกฎความสมดุลที่ห้ามละเมิด |
| [`DECISIONS.md`](./DECISIONS.md) | **บันทึกการตัดสินใจ (Decision Log)**: บันทึกการตัดสินใจด้านการออกแบบและโทเคนระบบ |
| [`DESIGN.md`](./DESIGN.md) | **Design System สเปก**: สเปกโทเคนการออกแบบ (Emerald Vault Identity) |
| [`COMPONENTS.md`](./COMPONENTS.md) | **UI Components Inventory**: บัญชีรายการและคลาสของ UI components ในระบบ |
| [`docs/adr/`](./docs/adr/) | **Architecture Decision Records**: ข้อตกลงสถาปัตยกรรมทางเทคนิค (ADR 0001–0005) |

---

## 🛡️ กฎเหล็กความปลอดภัยทางการเงิน (Financial Safety Hard Stops)

- **ห้ามใช้ `number` คำนวณเงิน**: ทุกยอดเงินต้องผ่าน `Money` (`decimal.js` จาก `src/lib/money.ts`)
- **Split Parity Invariant**: ผลรวมของ Split ทุกแถวต้องเท่ากับยอดรวมของ Transaction พอดีเป๊ะ
- **Two-Person Rule**: ผู้สร้างรายการไม่มีสิทธิ์อนุมัติหรือบันทึกบัญชี (direct-post) รายการของตนเอง
- **Single Source of Truth**: ห้ามคัดลอกค่าสี, กฎธุรกิจ, หรือค่าคงที่ซ้ำซ้อน
