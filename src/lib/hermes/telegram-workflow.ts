/**
 * Grace Ledger — Telegram Financial Workflow & Formatter
 * 
 * Generates secure, human-verifiable Telegram message layouts and
 * inline keyboard confirmation callbacks for Hermes Telegram Gateway.
 */

import { HermesGraceLedgerAdapter } from "./hermes-adapter";

export interface TelegramInlineButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface TelegramMessagePayload {
  text: string;
  parse_mode: "Markdown" | "HTML";
  reply_markup?: {
    inline_keyboard: TelegramInlineButton[][];
  };
}

export interface TelegramCallbackQuery {
  id: string;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  message?: {
    message_id: number;
    chat: {
      id: number;
    };
  };
  data: string;
}

export class TelegramFinancialFormatter {
  /**
   * 1. Formats READ financial summary for Telegram
   */
  public static formatFinancialSummary(summary: {
    period: string;
    total_income: string;
    total_expense: string;
    net_income: string;
    funds?: Array<{ name: string; balance: string }>;
  }): TelegramMessagePayload {
    let text =
      `📊 *สรุปภาพรวมทางการเงินประจำเดือน ${summary.period}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🟢 *รายรับรวม*: \`${summary.total_income}\` บาท\n` +
      `🔴 *รายจ่ายรวม*: \`${summary.total_expense}\` บาท\n` +
      `💎 *รายรับสุทธิ*: \`${summary.net_income}\` บาท\n\n`;

    if (summary.funds && summary.funds.length > 0) {
      text += `🏦 *ยอดคงเหลือรายกองทุน*:\n`;
      for (const fund of summary.funds) {
        text += `• ${fund.name}: \`${fund.balance}\` บาท\n`;
      }
      text += `\n`;
    }

    text += `_ข้อมูลจากระบบบัญชีแยกประเภท Grace Ledger (สถิติ ณ ปัจจุบัน)_`;

    return { text, parse_mode: "Markdown" };
  }

  /**
   * 2. Formats DRAFT financial card for Telegram
   */
  public static formatDraftCard(draft: {
    type: "transfer" | "transaction";
    amount: string;
    description: string;
    source?: string;
    destination?: string;
  }): TelegramMessagePayload {
    const title = draft.type === "transfer" ? "แบบร่างการโอนเงินกองทุน" : "แบบร่างรายการธุรกรรม";
    let text =
      `📝 *${title} (DRAFT)*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 *จำนวนเงิน*: \`${draft.amount}\` บาท\n` +
      `📋 *รายละเอียด*: ${draft.description}\n`;

    if (draft.source && draft.destination) {
      text += `🔄 *เส้นทาง*: ${draft.source} ➔ ${draft.destination}\n`;
    }

    text +=
      `\n⚠️ *คำเตือน*: รายการนี้เป็นเพียง *แบบร่าง* ยังไม่มีการตัดหรือเพิ่มยอดเงินในบัญชีจริง\n` +
      `_ต้องการบันทึกจริง กรุณาสั่งให้ Grace AI เสนอขออนุมัติ_`;

    return { text, parse_mode: "Markdown" };
  }

  /**
   * 3. Formats ACTION PROPOSAL card with Web Link & Inline Buttons
   */
  public static formatActionProposal(proposal: {
    proposal_id: string;
    action_type: string;
    title: string;
    summary: string;
    amount: string;
    financial_effect: string;
    expires_at: string;
    confirmation_url: string;
    payload_hash: string;
    nonce: string;
  }): TelegramMessagePayload {
    const text =
      `⚠️ *ข้อเสนอการดำเนินการ (ACTION PROPOSAL)*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 *หัวข้อ*: ${proposal.title}\n` +
      `💰 *จำนวนเงิน*: \`${proposal.amount}\`\n` +
      `📋 *สรุป*: ${proposal.summary}\n` +
      `📈 *ผลกระทบ*: ${proposal.financial_effect}\n` +
      `⏳ *หมดอายุใน*: 5 นาที\n\n` +
      `🔒 *ความปลอดภัย*: ระบบต้องการการยืนยันตัวตนจากผู้มีอำนาจก่อนดำเนินการ`;

    // Inline Keyboards: Web Deep Link + In-Telegram 2-Step Execution
    const inline_keyboard: TelegramInlineButton[][] = [
      [
        {
          text: "🔍 ตรวจสอบและยืนยันผ่านเว็บ (แนะนำ)",
          url: proposal.confirmation_url,
        },
      ],
      [
        {
          text: "✅ ยืนยันผ่าน Telegram",
          callback_data: `gl_confirm:${proposal.proposal_id}:${proposal.nonce.substring(0, 16)}`,
        },
        {
          text: "❌ ยกเลิก",
          callback_data: `gl_cancel:${proposal.proposal_id}`,
        },
      ],
    ];

    return {
      text,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard },
    };
  }
}

export class TelegramCallbackHandler {
  /**
   * Handles button click callbacks from Telegram Inline Keyboards
   */
  public static async processCallback(
    query: TelegramCallbackQuery,
    churchId: string,
    userId: string,
    adapter: HermesGraceLedgerAdapter,
    storedHashLookup: (confId: string) => Promise<{ payload_hash: string; nonce: string } | null>
  ): Promise<{ answer: string; messageUpdate?: string }> {
    const data = query.data;

    if (data.startsWith("gl_cancel:")) {
      return {
        answer: "ยกเลิกข้อเสนอเรียบร้อยแล้ว",
        messageUpdate: "❌ *ข้อเสนอนี้ถูกยกเลิกโดยผู้ใช้*",
      };
    }

    if (data.startsWith("gl_confirm:")) {
      const parts = data.split(":");
      const confId = parts[1];

      if (!confId) {
        return { answer: "ข้อมูลข้อเสนอไม่ถูกต้อง" };
      }

      // Fetch verified nonce & hash from server-side confirmation state
      const confData = await storedHashLookup(confId);
      if (!confData) {
        return {
          answer: "ไม่พบข้อเสนอหรือข้อเสนอหมดอายุแล้ว",
          messageUpdate: "⏳ *ข้อเสนอนี้หมดอายุหรือถูกดำเนินการไปแล้ว*",
        };
      }

      const execRes = await adapter.handleHermesToolCall({
        channel: "telegram",
        session_user_id: userId,
        session_church_id: churchId,
        tool_name: "execute_confirmed_action",
        parameters: {
          confirmation_id: confId,
          nonce: confData.nonce,
          payload_hash: confData.payload_hash,
        },
      });

      if (!execRes.success) {
        return {
          answer: `การดำเนินการถูกปฏิเสธ: ${execRes.message}`,
          messageUpdate: `🚫 *การดำเนินการไม่สำเร็จ*: ${execRes.message}`,
        };
      }

      return {
        answer: "ดำเนินการทางการเงินสำเร็จ",
        messageUpdate: `✅ *ดำเนินการทางการเงินเรียบร้อยแล้ว*\nบันทึกลงระบบบัญชีแยกประเภทสมบูรณ์`,
      };
    }

    return { answer: "คำสั่งไม่รองรับ" };
  }
}
