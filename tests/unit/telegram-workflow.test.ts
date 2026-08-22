import { describe, it, expect } from "vitest";
import { TelegramFinancialFormatter, TelegramCallbackHandler } from "../../src/lib/hermes/telegram-workflow";
import { HermesGraceLedgerAdapter } from "../../src/lib/hermes/hermes-adapter";

describe("REAL-18: Telegram Financial Workflow & Formatter", () => {
  const dummyChurchId = "00000000-0000-0000-0000-000000000001";
  const dummyUserId = "00000000-0000-0000-0000-000000000002";

  it("formats monthly financial summary with Markdown formatting", () => {
    const payload = TelegramFinancialFormatter.formatFinancialSummary({
      period: "2026-08",
      total_income: "150,000.00",
      total_expense: "50,000.00",
      net_income: "100,000.00",
      funds: [
        { name: "กองทุนทั่วไป", balance: "200,000.00" },
        { name: "กองทุนพันธกิจ", balance: "80,000.00" },
      ],
    });

    expect(payload.text).toContain("สรุปภาพรวมทางการเงินประจำเดือน 2026-08");
    expect(payload.text).toContain("`150,000.00` บาท");
    expect(payload.text).toContain("`50,000.00` บาท");
    expect(payload.text).toContain("กองทุนทั่วไป: `200,000.00` บาท");
    expect(payload.parse_mode).toBe("Markdown");
  });

  it("formats draft card with uncommitted warning banner", () => {
    const payload = TelegramFinancialFormatter.formatDraftCard({
      type: "transfer",
      amount: "5,000.00",
      description: "งบสนับสนุนเยาวชน",
      source: "กองทุนทั่วไป",
      destination: "กองทุนเยาวชน",
    });

    expect(payload.text).toContain("แบบร่างการโอนเงินกองทุน (DRAFT)");
    expect(payload.text).toContain("กองทุนทั่วไป ➔ กองทุนเยาวชน");
    expect(payload.text).toContain("รายการนี้เป็นเพียง *แบบร่าง*");
  });

  it("formats action proposal card with inline buttons for Web Review and Telegram confirmation", () => {
    const payload = TelegramFinancialFormatter.formatActionProposal({
      proposal_id: "conf-123",
      action_type: "fund_transfer",
      title: "โอนเงินเข้ากองทุนพันธกิจ",
      summary: "โอนเงิน 5,000.00 บาท",
      amount: "฿5,000.00",
      financial_effect: "ลดกองทุนทั่วไป 5,000 บาท เพิ่มกองทุนพันธกิจ 5,000 บาท",
      expires_at: new Date(Date.now() + 300000).toISOString(),
      confirmation_url: "https://ledger.grace.church/confirm?id=conf-123",
      payload_hash: "0".repeat(64),
      nonce: "nonce_1234567890123456",
    });

    expect(payload.text).toContain("ข้อเสนอการดำเนินการ (ACTION PROPOSAL)");
    expect(payload.reply_markup?.inline_keyboard.length).toBe(2);
    expect(payload.reply_markup?.inline_keyboard[0][0].url).toBe("https://ledger.grace.church/confirm?id=conf-123");
    expect(payload.reply_markup?.inline_keyboard[1][0].callback_data).toBe("gl_confirm:conf-123:nonce_1234567890");
    expect(payload.reply_markup?.inline_keyboard[1][1].callback_data).toBe("gl_cancel:conf-123");
  });

  it("handles cancel callback query gracefully", async () => {
    const mockAdapter = {} as HermesGraceLedgerAdapter;
    const res = await TelegramCallbackHandler.processCallback(
      { id: "q-1", from: { id: 12345, first_name: "John" }, data: "gl_cancel:conf-123" },
      dummyChurchId,
      dummyUserId,
      mockAdapter,
      async () => null
    );

    expect(res.answer).toBe("ยกเลิกข้อเสนอเรียบร้อยแล้ว");
    expect(res.messageUpdate).toContain("ข้อเสนอนี้ถูกยกเลิก");
  });

  it("handles confirm callback query and executes action through adapter", async () => {
    const mockAdapter = {
      handleHermesToolCall: async (req: any) => {
        expect(req.tool_name).toBe("execute_confirmed_action");
        expect(req.parameters.confirmation_id).toBe("conf-123");
        expect(req.parameters.nonce).toBe("nonce_1234567890123456");
        return { success: true, message: "โอนเงินเรียบร้อยแล้ว" };
      },
    } as unknown as HermesGraceLedgerAdapter;

    const res = await TelegramCallbackHandler.processCallback(
      { id: "q-2", from: { id: 12345, first_name: "John" }, data: "gl_confirm:conf-123:nonce_1234567890" },
      dummyChurchId,
      dummyUserId,
      mockAdapter,
      async (confId) => {
        expect(confId).toBe("conf-123");
        return { nonce: "nonce_1234567890123456", payload_hash: "0".repeat(64) };
      }
    );

    expect(res.answer).toBe("ดำเนินการทางการเงินสำเร็จ");
    expect(res.messageUpdate).toContain("ดำเนินการทางการเงินเรียบร้อยแล้ว");
  });
});
