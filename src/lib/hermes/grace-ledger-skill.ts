/**
 * Grace Ledger — Hermes Agent Skill Interface
 * 
 * Thin tool definitions and execution handlers for Hermes Agent Gateway.
 * Strictly adheres to the Zero-Bypass Financial Security Boundary.
 */

import { HermesGraceLedgerAdapter, HermesToolRequest, HermesToolResponse } from "./hermes-adapter";

export interface HermesContext {
  channel: "telegram" | "api" | "hermes_internal";
  userId: string;
  churchId: string;
}

export interface HermesSkillTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: Record<string, any>, context: HermesContext) => Promise<string>;
}

export class HermesGraceLedgerSkill {
  private adapter: HermesGraceLedgerAdapter;

  constructor(adapter: HermesGraceLedgerAdapter) {
    this.adapter = adapter;
  }

  /**
   * Dispatches tool invocation and formats human-readable response for messaging
   */
  private async runTool(toolName: string, args: Record<string, any>, context: HermesContext): Promise<string> {
    const req: HermesToolRequest = {
      channel: context.channel,
      session_user_id: context.userId,
      session_church_id: context.churchId,
      tool_name: toolName,
      parameters: args,
    };

    const res: HermesToolResponse = await this.adapter.handleHermesToolCall(req);

    if (!res.success) {
      return `❌ **เกิดข้อผิดพลาดในการดำเนินการ**: ${res.message || "ระบบปฏิเสธคำขอตามนโยบายความปลอดภัย"}`;
    }

    if (res.status === "requires_confirmation" && res.proposal) {
      const p = res.proposal;
      return (
        `⚠️ **ต้องการการยืนยันจากมนุษย์ (ACTION PROPOSAL)**\n\n` +
        `📋 **รายการ**: ${p.title}\n` +
        `💰 **จำนวนเงิน**: ${p.amount}\n` +
        `📝 **รายละเอียด**: ${p.summary}\n` +
        `⏳ **หมดอายุใน**: 5 นาที\n\n` +
        `🔗 **กดยืนยันการดำเนินการผ่านระบบที่ปลอดภัย**: [คลิกที่นี่เพื่อตรวจสอบและยืนยัน](${p.confirmation_url})\n\n` +
        `*(เพื่อความปลอดภัยทางบัญชี รายการนี้ยังไม่มีการเปลี่ยนแปลงยอดเงินในบัญชีจริง)*`
      );
    }

    if (res.tool_name === "execute_confirmed_action") {
      return `✅ **ดำเนินการทางการเงินสำเร็จ**: ${res.message || "บันทึกลงระบบบัญชีแยกประเภทเรียบร้อยแล้ว"}`;
    }

    // Standard READ/DRAFT presentation
    if (res.data) {
      return `📊 **ข้อมูลทางการเงินจาก Grace Ledger**:\n\`\`\`json\n${JSON.stringify(res.data, null, 2)}\n\`\`\``;
    }

    return `✅ ${res.message || "ดำเนินการเรียบร้อยแล้ว"}`;
  }

  /**
   * Returns registered tool definitions for Hermes Agent
   */
  public getTools(): HermesSkillTool[] {
    return [
      {
        name: "gl_get_financial_summary",
        description: "ดึงสรุปรายงานทางการเงินประจำเดือน (รายรับ รายจ่าย ยอดคงเหลือ)",
        parameters: {
          type: "object",
          properties: {
            period: { type: "string", description: "ปีและเดือนในรูปแบบ YYYY-MM เช่น 2026-08" },
          },
          required: ["period"],
        },
        execute: (args, ctx) => this.runTool("get_financial_summary", args, ctx),
      },
      {
        name: "gl_get_fund_balance",
        description: "ตรวจสอบยอดเงินคงเหลือในกองทุนเฉพาะ",
        parameters: {
          type: "object",
          properties: {
            fund_id: { type: "string", description: "UUID ของกองทุน" },
          },
          required: ["fund_id"],
        },
        execute: (args, ctx) => this.runTool("get_fund_balance", args, ctx),
      },
      {
        name: "gl_create_draft_transfer",
        description: "สร้างแบบร่างการโอนเงินระหว่างกองทุน (ไม่กระทบยอดเงินจริง)",
        parameters: {
          type: "object",
          properties: {
            from_fund_id: { type: "string", description: "UUID กองทุนต้นทาง" },
            to_fund_id: { type: "string", description: "UUID กองทุนปลายทาง" },
            amount: { type: "string", description: "จำนวนเงิน เช่น 5000.00" },
            notes: { type: "string", description: "บันทึกช่วยจำ" },
          },
          required: ["from_fund_id", "to_fund_id", "amount"],
        },
        execute: (args, ctx) => this.runTool("create_transfer_draft", args, ctx),
      },
      {
        name: "gl_propose_fund_transfer",
        description: "สร้างข้อเสนอการโอนเงินระหว่างกองทุน (ต้องได้รับการยืนยันก่อนมีผล)",
        parameters: {
          type: "object",
          properties: {
            from_fund_id: { type: "string", description: "UUID กองทุนต้นทาง" },
            to_fund_id: { type: "string", description: "UUID กองทุนปลายทาง" },
            amount: { type: "string", description: "จำนวนเงิน เช่น 5000.00" },
            reason: { type: "string", description: "เหตุผลการโอนเงิน" },
          },
          required: ["from_fund_id", "to_fund_id", "amount", "reason"],
        },
        execute: (args, ctx) => this.runTool("propose_fund_transfer", args, ctx),
      },
      {
        name: "gl_confirm_action",
        description: "ยืนยันและดำเนินการข้อเสนอทางการเงินด้วย Confirmation ID และ Nonce",
        parameters: {
          type: "object",
          properties: {
            confirmation_id: { type: "string", description: "UUID ของข้อเสนอ" },
            nonce: { type: "string", description: "Nonce ประจำข้อเสนอ" },
            payload_hash: { type: "string", description: "SHA-256 Payload Hash" },
          },
          required: ["confirmation_id", "nonce", "payload_hash"],
        },
        execute: (args, ctx) => this.runTool("execute_confirmed_action", args, ctx),
      },
    ];
  }
}
